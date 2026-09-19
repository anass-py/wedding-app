/**
 * Applies supabase/schema.sql to the project — no copy/paste into the SQL editor.
 *   npm run migrate
 * Needs SUPABASE_ACCESS_TOKEN in .env (supabase.com → Account → Access Tokens → generate).
 * Without it, prints what to paste instead.
 */
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

if (!ref) {
  console.error("VITE_SUPABASE_URL missing or malformed in .env");
  process.exit(1);
}
if (!token) {
  console.log("SUPABASE_ACCESS_TOKEN not set — open the Supabase dashboard → SQL Editor and run supabase/schema.sql.");
  console.log("(Create a token at supabase.com/dashboard/account/tokens and add SUPABASE_ACCESS_TOKEN=… to .env to let this script do it.)");
  process.exit(2);
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
console.log("schema.sql applied ✓");
