/**
 * Makes guest videos play everywhere. Phones upload whatever they have (an iPhone
 * .mov is HEVC, which Android Chrome can't play); this converts each new video to
 * H.264 MP4 (max 1280px, faststart) and points the row at the converted file.
 *
 *   npm run transcode            # convert new videos once
 *   npm run transcode -- --watch # keep going every 60 s
 *   KEEP_ORIGINALS=1 …           # keep the original upload in storage (default: deleted)
 *
 * Needs ffmpeg: bundled via the ffmpeg-static package, or set FFMPEG_PATH.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const run = promisify(execFile);
const BUCKET = "photos";
const WEB_SUFFIX = "_web.mp4";

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    console.error(`Missing env var ${name} (see .env.example)`);
    process.exit(1);
  }
  return v;
}

export async function ffmpegPath(): Promise<string> {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const mod = (await import("ffmpeg-static")) as { default?: string | null };
    if (mod.default) return mod.default;
  } catch {
    /* not installed */
  }
  return "ffmpeg";
}

const supabase = createClient(env("SUPABASE_URL", process.env.VITE_SUPABASE_URL), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

interface VideoRow {
  id: string;
  path: string;
}

async function pendingVideos(): Promise<VideoRow[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("id, path")
    .eq("kind", "video")
    .not("path", "like", `%${WEB_SUFFIX}`)
    .order("created_at");
  if (error) throw error;
  return data;
}

async function transcodeOne(row: VideoRow, ffmpeg: string): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "wedding-"));
  try {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(row.path);
    if (error) throw error;
    const input = join(dir, "in" + (row.path.match(/\.\w+$/)?.[0] ?? ".bin"));
    const output = join(dir, "out.mp4");
    await writeFile(input, Buffer.from(await blob.arrayBuffer()));
    await run(ffmpeg, [
      "-y", "-hide_banner", "-loglevel", "error",
      "-i", input,
      "-vf", "scale='min(1280,iw)':-2",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-profile:v", "main", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-ac", "2",
      "-movflags", "+faststart",
      output,
    ], { maxBuffer: 1 << 26 });
    const webPath = row.path.replace(/\.\w+$/, "") + WEB_SUFFIX;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(webPath, await readFile(output), { contentType: "video/mp4", cacheControl: "31536000", upsert: true });
    if (upErr) throw upErr;
    const { error: dbErr } = await supabase.from("photos").update({ path: webPath }).eq("id", row.id);
    if (dbErr) throw dbErr;
    if (!process.env.KEEP_ORIGINALS) await supabase.storage.from(BUCKET).remove([row.path]);
    console.log(`  ${row.id.slice(0, 8)}  ${row.path} → ${webPath}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function transcodeOnce(): Promise<number> {
  const todo = await pendingVideos();
  if (todo.length === 0) return 0;
  const ffmpeg = await ffmpegPath();
  console.log(`Transcoding ${todo.length} video(s)…`);
  for (const row of todo) {
    try {
      await transcodeOne(row, ffmpeg);
    } catch (e) {
      console.error(`  ${row.id}:`, e instanceof Error ? e.message : e);
    }
  }
  return todo.length;
}

async function main() {
  const watch = process.argv.includes("--watch");
  do {
    const n = await transcodeOnce();
    if (watch) {
      if (n === 0) process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 60_000));
    }
  } while (watch);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
