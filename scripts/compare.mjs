/**
 * Build every tagged version into .compare/dist/<tag>/ and serve them all from one
 * page so you can flip between versions on your phone.
 *
 *   npm run compare              # builds (if needed) and serves on http://localhost:5555
 *   npm run compare -- --rebuild # force rebuilding every version
 */
import { execSync, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const WORK = join(ROOT, ".compare");
const DIST = join(WORK, "dist");
const PORT = Number(process.env.PORT ?? 5555);
const rebuild = process.argv.includes("--rebuild");

const tags = execSync("git tag --list 'v*' --sort=v:refname", { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);
if (tags.length === 0) {
  console.error("No version tags found.");
  process.exit(1);
}

// One-line descriptions from VERSIONS.md ("| v0.3 | ... |")
const notes = {};
try {
  for (const line of readFileSync(join(ROOT, "VERSIONS.md"), "utf8").split("\n")) {
    const m = line.match(/^\|\s*(v[\d.]+)\s*\|\s*(.+?)\s*\|\s*$/);
    if (m) notes[m[1]] = m[2];
  }
} catch {
  /* optional */
}

mkdirSync(DIST, { recursive: true });
for (const tag of tags) {
  const out = join(DIST, tag);
  if (existsSync(join(out, "index.html")) && !rebuild) {
    console.log(`${tag}: already built`);
    continue;
  }
  console.log(`${tag}: building…`);
  const src = join(WORK, "src", tag);
  rmSync(src, { recursive: true, force: true });
  mkdirSync(src, { recursive: true });
  execSync(`git archive ${tag} | tar -x -C "${src}"`, { cwd: ROOT, shell: "/bin/sh" });
  symlinkSync(join(ROOT, "node_modules"), join(src, "node_modules"), "dir");
  const r = spawnSync("npx", ["vite", "build", "--base", `/${tag}/`, "--outDir", out, "--emptyOutDir"], { cwd: src, stdio: "pipe", encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    process.exit(1);
  }
  // No service workers in the comparison build — they would fight over scopes.
  for (const f of readdirSync(out)) if (/^(sw|workbox-.*)\.js$/.test(f) || f === "registerSW.js") rmSync(join(out, f));
}
// Manifest icons use absolute /icons/… paths.
cpSync(join(ROOT, "public", "icons"), join(DIST, "icons"), { recursive: true });

const rows = tags
  .map(
    (t) => `<a class="v" href="/${t}/"><span class="tag">${t}</span><span class="note">${(notes[t] ?? "").replace(/`/g, "")}</span></a>`,
  )
  .join("\n");
writeFileSync(
  join(DIST, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wedding app — versions</title>
<style>
body{margin:0;background:#100e0c;color:#f4ede3;font:15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:28px 18px 48px}
h1{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;font-size:34px;margin:0 0 4px}
p{color:#a89f92;margin:0 0 22px}
.v{display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:start;padding:14px 12px;margin:0 -12px;border-radius:14px;text-decoration:none;color:inherit;border-bottom:1px solid rgba(217,181,109,.14)}
.v:active{background:#1a1714}
.tag{font-family:"Cormorant Garamond",Georgia,serif;font-size:22px;color:#d9b56d;font-weight:600}
.note{font-size:13px;color:#cfc6b8}
</style></head><body>
<h1>Wedding app</h1><p>${tags.length} versions — tap one. Your name and language carry over between them.</p>
${rows}
</body></html>`,
);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(DIST, path));
  if (!file.startsWith(DIST)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    // SPA fallback inside a version folder (e.g. /v0.6/tv)
    const m = path.match(/^\/(v[\d.]+)\//);
    file = m ? join(DIST, m[1], "index.html") : join(DIST, "index.html");
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(file));
}).listen(PORT, "0.0.0.0", () => {
  const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address;
  console.log(`\nAll versions:  http://localhost:${PORT}/`);
  if (lan) console.log(`On your phone: http://${lan}:${PORT}/   (same WiFi)`);
  console.log("Ctrl+C to stop.\n");
});
