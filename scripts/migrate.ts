/**
 * Applies supabase/schema.sql to the project — no copy/paste into the SQL editor.
 *   npm run migrate            # production tables (public.*)
 *   npm run migrate -- --dev   # development copy (dev.*), from supabase/schema.dev.sql
 * Uses SUPABASE_ACCESS_TOKEN (Management API) if set, else the service-role key through the
 * public.exec_sql() helper (created by schema.sql — the very first run must be pasted by hand).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const dev = process.argv.includes("--dev");
const sql = readFileSync(new URL(dev ? "../supabase/schema.dev.sql" : "../supabase/schema.sql", import.meta.url), "utf8");

if (!ref) {
  console.error("VITE_SUPABASE_URL missing or malformed in .env");
  process.exit(1);
}
if (!token) {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) {
    console.log("Neither SUPABASE_ACCESS_TOKEN nor SUPABASE_SERVICE_ROLE_KEY set — paste supabase/schema.sql in the SQL Editor.");
    process.exit(2);
  }
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const { error } = await sb.rpc("exec_sql", { sql });
  if (error) {
    if (/could not find the function/i.test(error.message)) {
      console.error("public.exec_sql() is not there yet: paste supabase/schema.sql once in the SQL Editor; after that this command works on its own.");
    } else console.error(`Migration failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`${dev ? "schema.dev.sql" : "schema.sql"} applied via exec_sql ✓`);
  process.exit(0);
}
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`Migration failed (${res.status}): ${text.slice(0, 800)}`);
  process.exit(1);
}
console.log(`${dev ? "schema.dev.sql" : "schema.sql"} applied ✓`);
