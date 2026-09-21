/**
 * Fetches trend videos so they play natively in the app (autoplay, no embed, no platform chrome).
 * Runs inside `npm run worker`; `npm run trends` runs one pass.
 *
 * Needs yt-dlp:  python3 -m pip install --user yt-dlp curl_cffi
 *   - YouTube and TikTok work anonymously.
 *   - Instagram only works logged in: set YTDLP_BROWSER=brave (or chrome/safari) on the laptop
 *     to borrow your browser's Instagram login, or YTDLP_COOKIES=/path/to/cookies.txt.
 * TRENDS_DOWNLOAD=0 disables fetching (embeds only). Each reel is ~5–20 MB in storage.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { createClient } from "@supabase/supabase-js";
import { ffmpegPath } from "./transcode";

const run = promisify(execFile);
const DB_SCHEMA = process.env.SUPABASE_DB_SCHEMA || "public";
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || "photos";

let client: ReturnType<typeof make> | null = null;
function make() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false }, db: { schema: DB_SCHEMA } });
}
function supabase() {
  client ??= make();
  return client;
}

async function ytDlp(): Promise<string | null> {
  const candidates = [process.env.YTDLP_PATH, "yt-dlp", join(homedir(), "Library/Python/3.14/bin/yt-dlp"), join(homedir(), "Library/Python/3.13/bin/yt-dlp"), join(homedir(), ".local/bin/yt-dlp"), "/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp"].filter(Boolean) as string[];
  for (const c of candidates) {
    if (c !== "yt-dlp" && !existsSync(c)) continue;
    try {
      await run(c, ["--version"]);
      return c;
    } catch {
      /* next */
    }
  }
  return null;
}

async function ytDlpArgs(): Promise<string[]> {
  const args = ["--js-runtimes", "node", "--no-playlist", "--quiet", "--no-warnings"];
  if (process.env.YTDLP_BROWSER) args.push("--cookies-from-browser", process.env.YTDLP_BROWSER);
  else if (process.env.YTDLP_COOKIES) args.push("--cookies", process.env.YTDLP_COOKIES);
  return args;
}

export async function trendsOnce(): Promise<number> {
  if (process.env.TRENDS_DOWNLOAD === "0") return 0;
  const retryBefore = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: all, error } = await supabase().from("trends").select("id, url, provider, fetch_attempted_at").is("video_path", null).order("created_at");
  if (error) throw error;
  const todo = (all ?? []).filter((t) => !t.fetch_attempted_at || t.fetch_attempted_at < retryBefore);
  if (!todo.length) return 0;
  const bin = await ytDlp();
  if (!bin) {
    console.warn("trends: yt-dlp not installed (python3 -m pip install --user yt-dlp curl_cffi) — embeds stay as they are.");
    return 0;
  }
  const ffmpeg = await ffmpegPath();
  const common = [...(await ytDlpArgs()), "--ffmpeg-location", ffmpeg];
  console.log(`Fetching ${todo.length} trend video(s)…`);
  for (const t of todo) {
    const dir = await mkdtemp(join(tmpdir(), "trend-"));
    try {
      await supabase().from("trends").update({ fetch_attempted_at: new Date().toISOString() }).eq("id", t.id);
      await run(bin, [...common, "-f", "bv*[height<=1080]+ba/b[height<=1080]/b", "--merge-output-format", "mp4", "-o", join(dir, "in.%(ext)s"), t.url], { maxBuffer: 1 << 26 });
      const files = (await readdir(dir)).filter((f) => f.startsWith("in."));
      const input = files.find((f) => f === "in.mp4") ?? files.find((f) => /\.(mp4|mov|webm|mkv)$/i.test(f) && !/\.m4a$/i.test(f)) ?? files[0];
      if (!input) throw new Error("no file downloaded");
      const out = join(dir, "out.mp4");
      const poster = join(dir, "poster.jpg");
      await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", join(dir, input), "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-movflags", "+faststart", "-t", "90", out], { maxBuffer: 1 << 26 });
      await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-ss", "1", "-i", out, "-frames:v", "1", "-vf", "scale='min(720,iw)':-2", poster]);
      const probe = await run(ffmpeg, ["-hide_banner", "-i", out]).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
      const dims = /(\d{3,4})x(\d{3,4})/.exec(String((probe as { stderr?: string }).stderr ?? ""));
      const dur = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(String((probe as { stderr?: string }).stderr ?? ""));
      const base = `trends/${t.id}`;
      const { error: e1 } = await supabase().storage.from(STORAGE_BUCKET).upload(`${base}.mp4`, await readFile(out), { contentType: "video/mp4", cacheControl: "31536000", upsert: true });
      if (e1) throw e1;
      const { error: e2 } = await supabase().storage.from(STORAGE_BUCKET).upload(`${base}_t.jpg`, await readFile(poster), { contentType: "image/jpeg", cacheControl: "31536000", upsert: true });
      if (e2) throw e2;
      const { error: e3 } = await supabase()
        .from("trends")
        .update({
          video_path: `${base}.mp4`,
          thumb_path: `${base}_t.jpg`,
          width: dims ? Number(dims[1]) : null,
          height: dims ? Number(dims[2]) : null,
          duration: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null,
          fetch_error: null,
        })
        .eq("id", t.id);
      if (e3) throw e3;
      console.log(`  ${t.id.slice(0, 8)}  ${t.provider}  → stored`);
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).split("\n").find((l) => /ERROR/.test(l)) ?? (e instanceof Error ? e.message.split("\n")[0] : String(e));
      const short = msg.replace(/^ERROR:\s*/, "").slice(0, 300);
      await supabase().from("trends").update({ fetch_error: short }).eq("id", t.id);
      console.error(`  ${t.id.slice(0, 8)}  ${t.provider}: ${short}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  return todo.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  trendsOnce().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
