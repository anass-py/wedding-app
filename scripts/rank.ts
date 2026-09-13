/**
 * AI photo ranking — scores every unscored photo with Claude vision and writes
 * the result to `photo_scores`. The app blends this score with guest hearts.
 *
 *   npm run rank            # score new photos once
 *   npm run rank:watch      # keep polling every 60 s (leave running on the wedding day)
 *   npm run rank -- --all   # re-score everything (e.g. after changing the prompt)
 *
 * Env (see .env.example): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 * Optional: RANK_MODEL (default claude-opus-5), RANK_CONCURRENCY (default 4)
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { z } from "zod";

// Keep in sync with src/config.ts THEMES.
const THEMES = ["couple", "ceremony", "decoration", "guests", "dance", "food", "details", "venue", "other"] as const;

const Verdict = z.object({
  score: z.number().min(0).max(10).describe("Overall quality, 0-10, one decimal"),
  theme: z.enum(THEMES).describe("The single best-fitting theme"),
  tags: z.array(z.string()).max(5).describe("Up to 5 short lowercase tags"),
  reason: z.string().max(160).describe("One short sentence, guest-friendly, explaining the score"),
});

const SYSTEM = `You are the photo judge for a wedding's live photo wall. Guests upload phone photos during the day; the wall shows the best five overall and per theme.

Score each photo 0-10 for how much it deserves to be on that wall, weighing:
- the moment: emotion, candid joy, a real story (weighs the most)
- composition and framing
- focus, sharpness, motion blur
- light and exposure (a dark reception is normal — judge whether the light is used well, not whether it is bright)
Be discriminating: a typical casual phone snapshot is a 4-6. Reserve 8+ for photos a professional would be proud of. Blurry, accidental, screenshots, or photos of nothing in particular: 0-3. Do not reward duplicates of the same instant more than once — if it looks like a burst frame, score it as an ordinary snapshot.

Pick exactly one theme:
- couple: the bride and/or groom are the clear subject
- ceremony: vows, rings, aisle, officiant, first kiss
- decoration: table settings, flowers, lighting, cake as decor
- guests: friends and family as the subject
- dance: dance floor, music, party
- food: dishes, drinks, the cake being cut or eaten
- details: dress, shoes, rings, invitations, small close-ups
- venue: the place itself, wide shots, landscape, sunset
- other: anything else

Tags are short and lowercase, e.g. "first dance", "laughing", "golden hour", "group photo". The reason is one warm sentence a guest could read.`;

const MODEL = process.env.RANK_MODEL ?? "claude-opus-5";
const CONCURRENCY = Number(process.env.RANK_CONCURRENCY ?? 4);
const BUCKET = "photos";

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    console.error(`Missing env var ${name} (see .env.example)`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(env("SUPABASE_URL", process.env.VITE_SUPABASE_URL), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const anthropic = new Anthropic();

interface PhotoRow {
  id: string;
  path: string;
  caption: string | null;
}

async function unscoredPhotos(all: boolean): Promise<PhotoRow[]> {
  const { data: photos, error } = await supabase.from("photos").select("id, path, caption").eq("kind", "photo").order("created_at");
  if (error) throw error;
  if (all) return photos;
  const { data: scored, error: e2 } = await supabase.from("photo_scores").select("photo_id");
  if (e2) throw e2;
  const done = new Set(scored.map((s) => s.photo_id));
  return photos.filter((p) => !done.has(p.id));
}

async function scoreOne(photo: PhotoRow): Promise<void> {
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(photo.path);
  if (error) throw error;
  const data = Buffer.from(await blob.arrayBuffer()).toString("base64");

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { effort: "medium", format: zodOutputFormat(Verdict) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
          {
            type: "text",
            text: photo.caption ? `Guest caption: "${photo.caption}"\nJudge this photo.` : "Judge this photo.",
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    console.warn(`  ${photo.id}: refused (${response.stop_details?.category ?? "?"}) — scoring 0`);
    await upsert(photo.id, { score: 0, theme: "other", tags: [], reason: "Not scored." });
    return;
  }
  const v = response.parsed_output;
  if (!v) throw new Error("Could not parse model output");
  await upsert(photo.id, v);
  console.log(`  ${photo.id.slice(0, 8)}  ${v.score.toFixed(1).padStart(4)}  ${v.theme.padEnd(10)} ${v.reason}`);
}

async function upsert(photo_id: string, v: z.infer<typeof Verdict>) {
  const { error } = await supabase
    .from("photo_scores")
    .upsert({ photo_id, score: Math.round(v.score * 10) / 10, theme: v.theme, tags: v.tags, reason: v.reason, model: MODEL, scored_at: new Date().toISOString() });
  if (error) throw error;
}

export async function rankOnce(all = false): Promise<number> {
  const todo = await unscoredPhotos(all);
  if (todo.length === 0) return 0;
  console.log(`Scoring ${todo.length} photo(s) with ${MODEL}…`);
  let next = 0;
  let failures = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, todo.length) }, async () => {
      while (next < todo.length) {
        const photo = todo[next++];
        try {
          await scoreOne(photo);
        } catch (e) {
          failures++;
          if (e instanceof Anthropic.RateLimitError) {
            console.warn(`  ${photo.id}: rate limited, will retry next pass`);
            await new Promise((r) => setTimeout(r, 10_000));
          } else if (e instanceof Anthropic.APIError) {
            console.error(`  ${photo.id}: API error ${e.status}: ${e.message}`);
          } else {
            console.error(`  ${photo.id}:`, e instanceof Error ? e.message : e);
          }
        }
      }
    }),
  );
  if (failures) console.warn(`${failures} photo(s) failed; they stay unscored and are retried next pass.`);
  return todo.length;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const watch = args.has("--watch");
  const all = args.has("--all");
  do {
    const n = await rankOnce(all && !watch);
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
