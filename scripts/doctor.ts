/**
 * Checks the Supabase setup end-to-end, the way the app will use it.
 *   npm run doctor
 * Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env (and, if present,
 * SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY for the worker).
 */
import { createClient } from "@supabase/supabase-js";

const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string, fix?: string) => {
  console.log(`  ✗ ${msg}`);
  if (fix) console.log(`      → ${fix}`);
  failures++;
};
let failures = 0;

// 1×1 white JPEG so the upload test passes the bucket's image-only MIME rule.
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  console.log("\nSupabase doctor\n");
  if (!url || !anon || url.includes("xxxx")) {
    bad("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing", "copy .env.example to .env and paste the Project URL and anon key");
    return done();
  }
  ok(`project ${url}`);
  const sb = createClient(url, anon);

  // Anonymous auth
  const { data: auth, error: authErr } = await sb.auth.signInAnonymously();
  if (authErr || !auth.session) {
    bad(`anonymous sign-in: ${authErr?.message ?? "no session"}`, "Dashboard → Authentication → Sign In / Providers → enable “Allow anonymous sign-ins”");
    return done();
  }
  ok("anonymous sign-in works");
  const uidv = auth.session.user.id;

  // Tables & columns
  const { error: guestsErr } = await sb.from("guests").select("id").limit(1);
  if (guestsErr) bad(`table guests: ${guestsErr.message}`, "SQL Editor → paste supabase/schema.sql → Run");
  else ok("table guests");
  const { error: photosErr } = await sb.from("photos").select("id, kind, duration").limit(1);
  if (photosErr) bad(`table photos: ${photosErr.message}`, "re-run supabase/schema.sql (it adds the v1.2 video columns safely)");
  else ok("table photos (with video columns)");
  const { error: scoresErr } = await sb.from("photo_scores").select("photo_id").limit(1);
  if (scoresErr) bad(`table photo_scores: ${scoresErr.message}`, "re-run supabase/schema.sql");
  else ok("table photo_scores");

  // Guest row insert (RLS) — then clean up
  const name = `doctor-${Date.now()}`;
  const { data: guest, error: insErr } = await sb.from("guests").insert({ auth_id: uidv, name }).select("id").single();
  if (insErr) bad(`insert guest (RLS): ${insErr.message}`, "re-run supabase/schema.sql so the policies exist");
  else ok("guest can register (RLS insert policy)");

  // Storage upload into own folder, public URL readable, delete
  const path = `${uidv}/doctor.jpg`;
  const { error: upErr } = await sb.storage.from("photos").upload(path, TINY_JPEG, { contentType: "image/jpeg" });
  if (upErr) bad(`storage upload: ${upErr.message}`, "bucket “photos” or its policies are missing — re-run supabase/schema.sql");
  else {
    ok("storage upload allowed");
    const pub = sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
    const res = await fetch(pub);
    if (res.ok) ok("uploaded file is publicly readable");
    else bad(`public URL returned ${res.status}`, "bucket must be public (schema.sql sets it)");
    await sb.storage.from("photos").remove([path]);
  }

  // Realtime
  const realtime = await new Promise<string>((resolve) => {
    const ch = sb.channel("doctor").on("postgres_changes", { event: "*", schema: "public", table: "photos" }, () => undefined);
    const t = setTimeout(() => resolve("timeout"), 8000);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(t);
        resolve(status);
      }
    });
  });
  if (realtime === "SUBSCRIBED") ok("realtime channel subscribes (live updates will work)");
  else bad(`realtime: ${realtime}`, "Database → Publications → supabase_realtime must include photos, hearts, photo_scores (schema.sql does this)");
  await sb.removeAllChannels();

  // Clean up the doctor guest (own row: RLS allows update but not delete — service role below if available)
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (service) {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { count, error } = await admin.from("photos").select("id", { count: "exact", head: true });
    if (error) bad(`service role key: ${error.message}`, "Project Settings → API Keys → service_role (secret)");
    else ok(`service role key works (${count ?? 0} photos in the database)`);
    if (guest) await admin.from("guests").delete().eq("id", guest.id);
    await admin.auth.admin.deleteUser(uidv).catch(() => undefined);
  } else {
    console.log("  · SUPABASE_SERVICE_ROLE_KEY not set — needed only for npm run worker / memories");
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      await new Anthropic().models.retrieve(process.env.RANK_MODEL ?? "claude-opus-5");
      ok("Anthropic API key works");
    } catch (e) {
      bad(`Anthropic API key: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    console.log("  · ANTHROPIC_API_KEY not set — needed only for AI ranking / memories");
  }

  console.log("\n  Reminder (cannot be checked from here): Authentication → Rate Limits → anonymous sign-ins ≥ 500/hour.");
  done();
}

function done() {
  console.log(failures ? `\n${failures} problem(s) found.\n` : "\nAll good — run npm run dev and open it on your phone.\n");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
