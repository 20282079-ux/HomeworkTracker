// Minimal zero-dependency static file server.
//
// The app must be served over http:// — opening index.html from the file
// system breaks the service worker, so the app can't be installed or run
// offline.
//
// Usage:  node scripts/serve.mjs [port]     (or set PORT / HOST)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.env.PORT || process.argv[2] || 8123);
const HOST = process.env.HOST || "0.0.0.0";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let filePath = normalize(join(ROOT, pathname));

    // Never serve outside the project root, and never expose installed deps.
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      res.writeHead(403, { "content-type": "text/plain" }).end("Forbidden");
      return;
    }
    if (filePath.split(sep).includes("node_modules")) {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }

    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = join(filePath, "index.html");
      info = await stat(filePath).catch(() => null);
    }
    if (!info || !info.isFile()) {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }

    const body = await readFile(filePath);
    const type = filePath.endsWith(`${sep}manifest.json`)
      ? "application/manifest+json; charset=utf-8"
      : TYPES[extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "content-type": type,
      "content-length": body.length,
      "cache-control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (err) {
    console.error("[serve]", err);
    res.writeHead(500, { "content-type": "text/plain" }).end("Server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Homework Tracker → http://localhost:${PORT}`);
});
