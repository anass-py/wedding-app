/**
 * Optional: fetch trend videos so they play natively in the app (autoplay, no embed).
 * Needs yt-dlp on the machine running the worker:  brew install yt-dlp   (or pip install yt-dlp)
 * Enable with TRENDS_DOWNLOAD=1 in .env. Each reel is ~5–20 MB in storage.
 *
 *   TRENDS_DOWNLOAD=1 npm run trends
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
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

async function hasYtDlp(): Promise<boolean> {
  try {
    await run("yt-dlp", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function trendsOnce(): Promise<number> {
  if (!process.env.TRENDS_DOWNLOAD) return 0;
  const { data: todo, error } = await supabase().from("trends").select("id, url, provider").is("video_path", null).order("created_at");
  if (error) throw error;
  if (!todo?.length) return 0;
  if (!(await hasYtDlp())) {
    console.warn("trends: yt-dlp not installed (brew install yt-dlp) — leaving embeds as they are.");
    return 0;
  }
  const ffmpeg = await ffmpegPath();
  console.log(`Fetching ${todo.length} trend video(s)…`);
  for (const t of todo) {
    const dir = await mkdtemp(join(tmpdir(), "trend-"));
    try {
      await run("yt-dlp", ["-f", "bv*[height<=1080]+ba/b[height<=1080]/b", "--merge-output-format", "mp4", "-o", join(dir, "in.%(ext)s"), "--no-playlist", "--quiet", t.url], { maxBuffer: 1 << 26 });
      const input = (await readdir(dir)).find((f) => f.startsWith("in."));
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
        })
        .eq("id", t.id);
      if (e3) throw e3;
      console.log(`  ${t.id.slice(0, 8)}  ${t.provider}  → stored`);
    } catch (e) {
      console.error(`  ${t.id.slice(0, 8)}  ${t.provider}: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
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
