/**
 * Memories film — turns the wedding's photos and clips into a short edited video
 * (Ken-Burns motion, crossfades, chapter titles, music), like the automatic
 * "memories" on iPhone / Google Photos.
 *
 *   npm run memories                          # from Supabase → memories.mp4 (1080×1920, phone/WhatsApp)
 *   npm run memories -- --landscape           # 1920×1080 for the TV
 *   npm run memories -- --music song.mp3      # background music (looped, faded)
 *   npm run memories -- --count 28            # how many moments (default 28)
 *   npm run memories -- --lang fr             # chapter titles in French
 *   npm run memories -- --from ./folder       # use local photos/videos instead of Supabase
 *   npm run memories -- --no-ai               # skip Claude; order by score + time
 *   npm run memories -- --out film.mp4
 *
 * Story selection uses Claude (ANTHROPIC_API_KEY) to pick and sequence the moments and
 * write the chapter titles; rendering is ffmpeg (bundled via ffmpeg-static).
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { RANKING, WEDDING } from "../src/config";
import { ffmpegPath } from "./transcode";

const run = promisify(execFile);

// ── CLI ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const LANDSCAPE = flag("landscape");
const W = LANDSCAPE ? 1920 : 1080;
const H = LANDSCAPE ? 1080 : 1920;
const FPS = 30;
const COUNT = Number(opt("count", "28"));
const LANG = opt("lang", "en") === "fr" ? "fr" : "en";
const MUSIC = opt("music");
const FROM = opt("from");
const OUTFILE = resolve(opt("out", "memories.mp4")!);
const USE_AI = !flag("no-ai") && !!process.env.ANTHROPIC_API_KEY;
const PHOTO_SEC = 3.4;
const CLIP_SEC = 3.6;
const CARD_SEC = 2.6;
const XFADE = 0.6;
const FONT =
  opt("font") ??
  [
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "C:/Windows/Fonts/georgia.ttf",
  ].find((f) => existsSync(f));

// ── Candidates ──────────────────────────────────────────────────────────────
interface Moment {
  id: string;
  kind: "photo" | "video";
  file: string; // local path once downloaded
  url?: string;
  at: string;
  guest: string;
  caption: string | null;
  theme: string | null;
  score: number | null;
  hearts: number;
  duration: number | null;
  tags: string[];
  reason: string | null;
}

function finalScore(m: Moment): number {
  const heartsNorm = (Math.min(m.hearts, RANKING.HEART_SATURATION) / RANKING.HEART_SATURATION) * 10;
  return RANKING.AI_WEIGHT * (m.score ?? 0) + RANKING.HEART_WEIGHT * heartsNorm;
}

async function fromSupabase(dir: string): Promise<Moment[]> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --from <folder>)");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("photos")
    .select("id, kind, path, created_at, caption, duration, guest:guests!photos_guest_id_fkey(name), hearts(guest_id), photo_scores(score, theme, tags, reason)")
    .order("created_at");
  if (error) throw error;
  const rows = data as unknown as {
    id: string; kind: string | null; path: string; created_at: string; caption: string | null; duration: number | null;
    guest: { name: string } | { name: string }[] | null; hearts: unknown[] | null;
    photo_scores: { score: number | string; theme: string; tags: string[] | null; reason: string | null } | null;
  }[];
  return rows.map((r) => {
    const g = Array.isArray(r.guest) ? r.guest[0] : r.guest;
    const s = Array.isArray(r.photo_scores) ? r.photo_scores[0] : r.photo_scores;
    return {
      id: r.id,
      kind: r.kind === "video" ? "video" : "photo",
      file: join(dir, r.id + extname(r.path)),
      url: sb.storage.from("photos").getPublicUrl(r.path).data.publicUrl,
      at: r.created_at,
      guest: g?.name ?? "?",
      caption: r.caption,
      theme: s?.theme ?? null,
      score: s ? Number(s.score) : null,
      hearts: r.hearts?.length ?? 0,
      duration: r.duration,
      tags: s?.tags ?? [],
      reason: s?.reason ?? null,
    };
  });
}

async function fromFolder(folder: string): Promise<Moment[]> {
  const files = (await readdir(folder)).filter((f) => /\.(jpe?g|png|webp|mp4|mov|m4v)$/i.test(f)).sort();
  return files.map((f, i) => ({
    id: `local-${i}`,
    kind: /\.(mp4|mov|m4v)$/i.test(f) ? "video" : "photo",
    file: join(folder, f),
    at: new Date(2000, 0, 1, 0, i).toISOString(),
    guest: "",
    caption: null,
    theme: null,
    score: null,
    hearts: 0,
    duration: null,
    tags: [],
    reason: null,
  }));
}

// ── Story ───────────────────────────────────────────────────────────────────
interface Chapter {
  title: string;
  ids: string[];
}
interface Story {
  title: string;
  subtitle: string;
  chapters: Chapter[];
}

const StorySchema = z.object({
  title: z.string().max(40).describe("Film title, e.g. the couple's names"),
  subtitle: z.string().max(60).describe("One short warm line under the title"),
  chapters: z
    .array(
      z.object({
        title: z.string().max(32).describe("Short chapter title card, 1-4 words"),
        ids: z.array(z.string()).min(2).describe("Moment ids in the order they should play"),
      }),
    )
    .min(2)
    .max(6),
});

function fallbackStory(all: Moment[]): Story {
  const pool = [...all].sort((a, b) => finalScore(b) - finalScore(a)).slice(0, Math.max(COUNT, Math.ceil(COUNT * 1.6)));
  pool.sort((a, b) => a.at.localeCompare(b.at));
  const step = pool.length / COUNT;
  const chosen = Array.from({ length: Math.min(COUNT, pool.length) }, (_, i) => pool[Math.floor(i * step)]);
  const third = Math.ceil(chosen.length / 3);
  const titles = LANG === "fr" ? ["Le début", "La fête", "Jusqu'au bout de la nuit"] : ["The beginning", "The celebration", "Into the night"];
  return {
    title: WEDDING.couple,
    subtitle: WEDDING.date,
    chapters: [0, 1, 2]
      .map((k) => ({ title: titles[k], ids: chosen.slice(k * third, (k + 1) * third).map((m) => m.id) }))
      .filter((c) => c.ids.length > 0),
  };
}

async function aiStory(all: Moment[]): Promise<Story> {
  const client = new Anthropic();
  const lines = all
    .map((m) =>
      [
        m.id,
        m.kind,
        m.at.slice(11, 16),
        m.theme ?? "-",
        m.score != null ? `score ${m.score.toFixed(1)}` : "unscored",
        `${m.hearts}♥`,
        m.guest ? `by ${m.guest}` : "",
        m.tags.length ? m.tags.slice(0, 4).join(",") : "",
        m.caption ? `"${m.caption}"` : "",
        m.reason ?? "",
      ]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
  const response = await client.messages.parse({
    model: process.env.RANK_MODEL ?? "claude-opus-5",
    max_tokens: 4000,
    output_config: { effort: "medium", format: zodOutputFormat(StorySchema) },
    system: `You are editing a short wedding memories film for the couple ${WEDDING.couple} (${WEDDING.date}). You receive every photo/clip guests posted, one per line: id | kind | time | theme | AI score | hearts | photographer | tags | caption | judge's note.

Choose about ${COUNT} moments and sequence them into a film with 3-5 chapters that follows the day (getting ready → ceremony → couple → guests & details → dance/party). Rules:
- Prefer high scores and hearts, but the story matters more than raw score: include the ceremony, the couple, the decor, the guests, the party.
- Keep chronological order inside and across chapters.
- Variety: no more than 3 consecutive moments from the same photographer or theme; include a few video clips if there are any (they play ~3 s each).
- Never pick the same instant twice (burst frames, near-duplicates).
- Titles are short, warm, in ${LANG === "fr" ? "French" : "English"}; the film title is the couple's names; subtitle is one short line.
Only use ids from the list.`,
    messages: [{ role: "user", content: lines }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Claude did not return a story");
  const known = new Set(all.map((m) => m.id));
  const story = response.parsed_output;
  story.chapters = story.chapters.map((c) => ({ ...c, ids: c.ids.filter((id) => known.has(id)) })).filter((c) => c.ids.length > 0);
  if (story.chapters.length === 0) throw new Error("Story had no usable moments");
  return story;
}

// ── Render ──────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/%/g, "\\%");

function motion(i: number): string {
  // Four Ken-Burns presets, alternated for variety. `on` = output frame number.
  const frames = PHOTO_SEC * FPS;
  const zIn = `min(1.14,1+0.14*on/${frames})`;
  const zOut = `max(1,1.14-0.14*on/${frames})`;
  const cx = "iw/2-(iw/zoom/2)";
  const cy = "ih/2-(ih/zoom/2)";
  const panX = `(iw-iw/zoom)*on/${frames}`;
  const panY = `(ih-ih/zoom)*on/${frames}`;
  const presets = [
    `z='${zIn}':x='${cx}':y='${cy}'`,
    `z='${zOut}':x='${cx}':y='${cy}'`,
    `z='1.12':x='${panX}':y='${cy}'`,
    `z='1.12':x='${cx}':y='${panY}'`,
  ];
  return presets[i % presets.length];
}

async function renderPhoto(ffmpeg: string, m: Moment, i: number, out: string) {
  // Upscale a bit so zoompan has room, then animate to the exact output size.
  const vf = `scale=${W * 1.25}:${H * 1.25}:force_original_aspect_ratio=increase,crop=${W * 1.25}:${H * 1.25},zoompan=${motion(i)}:d=1:s=${W}x${H}:fps=${FPS},format=yuv420p`;
  await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-loop", "1", "-framerate", String(FPS), "-i", m.file, "-vf", vf, "-t", String(PHOTO_SEC), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-an", out], { maxBuffer: 1 << 26 });
  return PHOTO_SEC;
}

async function renderClip(ffmpeg: string, m: Moment, out: string) {
  const dur = Math.min(CLIP_SEC, Math.max(1.5, (m.duration ?? CLIP_SEC) - 0.2));
  const start = m.duration && m.duration > dur + 1 ? Math.min(1, (m.duration - dur) / 2) : 0;
  const vf = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1,format=yuv420p`;
  await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(start), "-i", m.file, "-t", String(dur), "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-an", out], { maxBuffer: 1 << 26 });
  return dur;
}

async function renderCard(ffmpeg: string, title: string, subtitle: string | null, out: string, big = false) {
  const size = big ? Math.round(W * 0.085) : Math.round(W * 0.062);
  const texts = FONT
    ? [
        `drawtext=fontfile='${FONT}':text='${esc(title)}':fontcolor=0xf4ede3:fontsize=${size}:x=(w-text_w)/2:y=(h-text_h)/2${subtitle ? `-${Math.round(size * 0.45)}` : ""}`,
        subtitle
          ? `drawtext=fontfile='${FONT}':text='${esc(subtitle)}':fontcolor=0xd9b56d:fontsize=${Math.round(size * 0.42)}:x=(w-text_w)/2:y=(h+text_h)/2+${Math.round(size * 0.55)}`
          : "",
        // small gold ornament line
        `drawbox=x=(iw-${Math.round(W * 0.12)})/2:y=(ih/2)+${Math.round(size * (subtitle ? 1.55 : 0.95))}:w=${Math.round(W * 0.12)}:h=2:color=0xd9b56d@0.6:t=fill`,
      ]
        .filter(Boolean)
        .join(",")
    : "null";
  await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=0x100e0c:s=${W}x${H}:r=${FPS}:d=${CARD_SEC}`, "-vf", `${texts},format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", out], { maxBuffer: 1 << 26 });
  return CARD_SEC;
}

async function download(m: Moment) {
  if (!m.url || existsSync(m.file)) return;
  const res = await fetch(m.url);
  if (!res.ok) throw new Error(`download ${m.id}: ${res.status}`);
  await writeFile(m.file, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const ffmpeg = await ffmpegPath();
  const work = await mkdtemp(join(tmpdir(), "memories-"));
  const media = join(work, "media");
  await mkdir(media);
  try {
    const all = FROM ? await fromFolder(resolve(FROM)) : await fromSupabase(media);
    if (all.length < 4) throw new Error(`Only ${all.length} moments found — need at least 4.`);
    console.log(`${all.length} moments available.`);

    let story: Story;
    if (USE_AI && all.some((m) => m.score != null)) {
      console.log("Asking Claude to sequence the story…");
      story = await aiStory(all);
    } else {
      if (USE_AI) console.log("No AI scores yet (run the worker first) — ordering by hearts and time.");
      story = fallbackStory(all);
    }
    const byId = new Map(all.map((m) => [m.id, m]));
    const picked = story.chapters.flatMap((c) => c.ids.map((id) => byId.get(id)!));
    console.log(`"${story.title}" — ${story.chapters.length} chapters, ${picked.length} moments:`);
    story.chapters.forEach((c) => console.log(`  • ${c.title} (${c.ids.length})`));

    // Download (Supabase) then render every segment.
    let k = 0;
    for (const m of picked) {
      await download(m);
      process.stdout.write(`\r  downloading ${++k}/${picked.length}`);
    }
    console.log();

    const segments: { file: string; dur: number }[] = [];
    let n = 0;
    const seg = () => join(work, `seg-${String(n++).padStart(3, "0")}.mp4`);
    let f = seg();
    segments.push({ file: f, dur: await renderCard(ffmpeg, story.title, story.subtitle, f, true) });
    let i = 0;
    for (const chapter of story.chapters) {
      f = seg();
      segments.push({ file: f, dur: await renderCard(ffmpeg, chapter.title, null, f) });
      for (const id of chapter.ids) {
        const m = byId.get(id)!;
        f = seg();
        try {
          segments.push({ file: f, dur: m.kind === "video" ? await renderClip(ffmpeg, m, f) : await renderPhoto(ffmpeg, m, i++, f) });
        } catch (e) {
          console.warn(`  skipped ${m.id}: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
        }
        process.stdout.write(`\r  rendering ${segments.length}/${picked.length + story.chapters.length + 2}`);
      }
    }
    f = seg();
    segments.push({ file: f, dur: await renderCard(ffmpeg, story.title, LANG === "fr" ? "Merci d’avoir été là" : "Thank you for being there", f) });
    console.log();

    // Crossfade everything together.
    const inputs = segments.flatMap((s) => ["-i", s.file]);
    let filter = "";
    let prev = "[0:v]";
    let offset = 0;
    for (let j = 1; j < segments.length; j++) {
      offset += segments[j - 1].dur - XFADE;
      const outLabel = j === segments.length - 1 ? "[vout]" : `[v${j}]`;
      filter += `${prev}[${j}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}${outLabel};`;
      prev = outLabel;
    }
    const total = segments.reduce((a, s) => a + s.dur, 0) - XFADE * (segments.length - 1);
    const args = ["-y", "-hide_banner", "-loglevel", "error", ...inputs];
    if (MUSIC) {
      args.push("-stream_loop", "-1", "-i", resolve(MUSIC));
      filter += `[${segments.length}:a]atrim=0:${total.toFixed(3)},afade=t=in:d=1.5,afade=t=out:st=${(total - 3).toFixed(3)}:d=3[aout]`;
    } else filter = filter.replace(/;$/, "");
    args.push("-filter_complex", filter, "-map", "[vout]");
    if (MUSIC) args.push("-map", "[aout]", "-c:a", "aac", "-b:a", "160k");
    args.push("-t", total.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUTFILE);
    console.log(`  mixing ${segments.length} segments (${Math.round(total)} s)…`);
    await run(ffmpeg, args, { maxBuffer: 1 << 26 });
    console.log(`\nDone → ${OUTFILE}  (${Math.round(total)} s, ${W}×${H}${MUSIC ? ", with music" : ", silent — add --music song.mp3"})`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
