/**
 * Storage usage + a full local copy of every photo / video.
 *   npm run backup                     # how much space the wall uses (nothing downloaded)
 *   npm run backup -- --download       # mirror everything into ./backup/photos/ (re-runnable:
 *                                      #   files already there with the same size are skipped)
 *   npm run backup -- --download ~/Mariage
 *   STORAGE_BUCKET=photos-dev npm run backup
 * Also writes index.json next to the files: who posted what, when, caption, hearts.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const bucket = process.env.STORAGE_BUCKET ?? "photos";
const schema = process.env.SUPABASE_DB_SCHEMA ?? (bucket === "photos-dev" ? "dev" : "public");
if (!url || !key) {
  console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
const sb = createClient(url, key, { db: { schema }, auth: { persistSession: false } });

const args = process.argv.slice(2);
const download = args.includes("--download");
const dirArg = args.find((a) => !a.startsWith("--"));
const outDir = path.resolve((dirArg ?? `backup/${bucket}`).replace(/^~(?=\/|$)/, os.homedir()));

interface Obj {
  path: string;
  size: number;
}

async function walk(prefix = ""): Promise<Obj[]> {
  const out: Obj[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const o of data ?? []) {
      const p = prefix ? `${prefix}/${o.name}` : o.name;
      if (o.id) out.push({ path: p, size: Number(o.metadata?.size ?? 0) });
      else out.push(...(await walk(p)));
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

const mb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`);
const isVideo = (p: string) => /\.(mp4|mov|webm|m4v)$/i.test(p);

const objects = await walk();
const total = objects.reduce((s, o) => s + o.size, 0);
const videos = objects.filter((o) => isVideo(o.path));
const vBytes = videos.reduce((s, o) => s + o.size, 0);
console.log(`bucket ${bucket}: ${objects.length} files, ${mb(total)}`);
console.log(`  videos  ${videos.length} files, ${mb(vBytes)}`);
console.log(`  images  ${objects.length - videos.length} files, ${mb(total - vBytes)}  (full size + thumbnails + posters)`);

if (!download) {
  console.log(`\nnpm run backup -- --download   → copies everything to ${outDir}`);
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });
let got = 0;
let skipped = 0;
let failed = 0;
for (const [i, o] of objects.entries()) {
  const dest = path.join(outDir, o.path);
  if (fs.existsSync(dest) && fs.statSync(dest).size === o.size) {
    skipped++;
    continue;
  }
  const { data, error } = await sb.storage.from(bucket).download(o.path);
  if (error || !data) {
    failed++;
    console.error(`  ✗ ${o.path}: ${error?.message ?? "empty"}`);
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await data.arrayBuffer()));
  got++;
  if (got % 25 === 0) console.log(`  ${i + 1}/${objects.length}`);
}

// Who posted what — so the files make sense without the app.
const { data: rows, error } = await sb
  .from("photos")
  .select("id, kind, storage_path, thumb_path, caption, created_at, duration, guests!photos_guest_id_fkey(name), hearts(count)")
  .order("created_at");
if (error) console.error(`index.json skipped: ${error.message}`);
else fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(rows, null, 2));

console.log(`\n${got} downloaded, ${skipped} already there, ${failed} failed → ${outDir}`);
