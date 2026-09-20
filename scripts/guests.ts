/**
 * Who joined, from where, on what — for the hosts.
 *   npm run guests            # production
 *   SUPABASE_DB_SCHEMA=dev npm run guests
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false }, db: { schema: process.env.SUPABASE_DB_SCHEMA || "public" } });

const { data: guests, error } = await sb.from("guests").select("id, name, created_at").order("created_at");
if (error) throw error;
const { data: devices } = await sb.from("guest_devices").select("guest_id, device, locale, city, region, country, created_at, last_seen");
const { data: photos } = await sb.from("photos").select("guest_id, kind");
const { data: messages } = await sb.from("messages").select("guest_id");

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const ago = (iso?: string | null) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 2) return "● online";
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return fmt(iso);
};
const online = (devices ?? []).filter((d) => d.last_seen && Date.now() - new Date(d.last_seen).getTime() < 2 * 60_000);
console.log(`\n${guests.length} guests · ${new Set(online.map((d) => d.guest_id)).size} online now\n`);
guests.forEach((g, i) => {
  const mine = (devices ?? []).filter((d) => g.id === d.guest_id);
  const np = (photos ?? []).filter((p) => p.guest_id === g.id);
  const nm = (messages ?? []).filter((m) => m.guest_id === g.id).length;
  const seen = mine.map((d) => d.last_seen ?? d.created_at).sort().at(-1);
  console.log(`${String(i + 1).padStart(2, "0")}. ${g.name}  ${ago(seen)}  — joined ${fmt(g.created_at)} · ${np.filter((p) => p.kind !== "video").length} photos · ${np.filter((p) => p.kind === "video").length} videos · ${nm} words`);
  for (const d of mine) {
    const where = [d.city, d.region, d.country].filter(Boolean).join(", ") || "location unknown";
    console.log(`      ${d.device ?? "device unknown"}  ·  ${where}  ·  ${d.locale ?? ""}  ·  ${ago(d.last_seen ?? d.created_at)}`);
  }
});
console.log();
