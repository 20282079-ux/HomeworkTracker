// Minimal zero-dependency build: assembles the static PWA into dist/.
//
// The app is plain HTML/CSS/JS with no bundler, so "building" means copying
// the site files verbatim into dist/ (the directory production hosting
// serves). The only non-trivial part is verifying integrity: every asset in
// index.html's script/link tags, the manifest, and the service worker's
// APP_SHELL must be present in dist, and every file referenced by the shell
// must exist. A missing asset would silently break offline installs, so the
// build fails loudly instead of shipping a broken shell.
//
// Usage: node scripts/build.mjs [--out dist]
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT = resolve(ROOT, process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "dist");

// Site files copied into dist (relative to project root).
const SITE_FILES = [
  "index.html",
  "manifest.json",
  "sw.js",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
];

const SITE_DIRS = ["css", "js"];

// ── Parse every local asset index.html references via href=/src= ──
async function referencedAssets() {
  const html = await readFile(join(ROOT, "index.html"), "utf8");
  const refs = new Set();
  for (const m of html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
    const ref = m[1];
    // Skip external origins, data URIs, fragments and protocol links.
    if (!ref.startsWith("/")) continue;
    refs.add(ref.replace(/^\//, "").split("#")[0].split("?")[0]);
  }
  return [...refs];
}

async function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(base, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(p, p)));
    else out.push(p);
  }
  return out;
}

async function main() {
  // Build into a temp dir first, then swap into place so a failure never
  // leaves a half-copied dist behind.
  const tmp = await mkdtemp(join(tmpdir(), "hw-tracker-build-"));
  try {
    for (const file of SITE_FILES) {
      await cp(join(ROOT, file), join(tmp, file));
    }
    for (const dir of SITE_DIRS) {
      await cp(join(ROOT, dir), join(tmp, dir), { recursive: true });
    }

    // ── Integrity checks ──
    const problems = [];
    const built = new Set((await listFiles(tmp)).map((p) => p.slice(tmp.length + 1)));

    // 1. Every asset referenced by index.html must exist in the build.
    for (const ref of await referencedAssets()) {
      if (!built.has(ref)) problems.push(`index.html references /${ref} but it is missing from the build`);
    }

    // 2. Every APP_SHELL entry in sw.js must exist in the build (the '/','/'
    //    root and external fonts are excluded).
    const sw = await readFile(join(ROOT, "sw.js"), "utf8");
    const shell = sw.match(/var APP_SHELL = \[([\s\S]*?)\];/)?.[1] ?? "";
    for (const m of shell.matchAll(/'([^']+)'/g)) {
      const ref = m[1].replace(/^\//, "");
      if (ref === "" || ref.startsWith("http")) continue;
      if (!built.has(ref)) problems.push(`sw.js APP_SHELL lists /${ref} but it is missing from the build`);
    }

    if (problems.length) {
      console.error("Build integrity check failed:");
      for (const p of problems) console.error(`  - ${p}`);
      process.exit(1);
    }

    // Swap the verified build into place.
    await rm(OUT, { recursive: true, force: true });
    await mkdir(OUT, { recursive: true });
    await cp(tmp, OUT, { recursive: true });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  const files = await listFiles(OUT);
  console.log(`Built ${files.length} files → ${OUT}`);
}

main().catch((err) => {
  console.error("[build]", err);
  process.exit(1);
});
