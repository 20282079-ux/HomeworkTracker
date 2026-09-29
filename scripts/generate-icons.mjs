// Generates the PWA PNG icons (icon-192.png, icon-512.png,
// apple-touch-icon.png) using the same palette as icon.svg.
//
// iOS ignores SVG home-screen icons entirely, so raster icons are required
// for the app to install cleanly on an iPhone. Zero dependencies: the PNG is
// encoded by hand with node:zlib.
//
// Usage:  npm run icons
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

// Theme palette (matches css/styles.css --bg / --accent2).
const BG_TOP = [26, 27, 46]; // #1a1b2e
const BG_BOTTOM = [14, 15, 26]; // #0e0f1a
const GLYPH = [167, 139, 250]; // #a78bfa

const smoothstep = (edge0, edge1, v) => {
  const t = Math.max(0, Math.min(1, (v - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

// Signed distance to a rounded rectangle centred on the origin.
function roundedRectSDF(x, y, halfW, halfH, r) {
  const qx = Math.abs(x) - (halfW - r);
  const qy = Math.abs(y) - (halfH - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

// Shortest distance from (px,py) to the segment (ax,ay)-(bx,by).
function segmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// All geometry is expressed in a 0..1 unit square so it scales to any size.
const CHECK = [
  [0.26, 0.52, 0.44, 0.7],
  [0.44, 0.7, 0.76, 0.32],
];
const STROKE_HALF = 0.055;

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const aa = 1.5 / size; // ~1.5px antialias band in unit space

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Unit coordinates in 0..1, origin top-left (matches the CHECK points).
      const ux = (x + 0.5) / size;
      const uy = (y + 0.5) / size;

      // Base plate: rounded square, radius 22% of the icon.
      const baseAlpha = 1 - smoothstep(-aa, aa, roundedRectSDF(ux - 0.5, uy - 0.5, 0.5, 0.5, 0.22));

      // Vertical background gradient.
      const bg = BG_TOP.map((c, i) => Math.round(c + (BG_BOTTOM[i] - c) * uy));

      // Glyph: thick checkmark, same mark the app uses for completed tasks.
      let d = Infinity;
      for (const [ax, ay, bx, by] of CHECK) d = Math.min(d, segmentDist(ux, uy, ax, ay, bx, by));
      const glyphAlpha = 1 - smoothstep(STROKE_HALF - aa, STROKE_HALF + aa, d);

      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(bg[c] + (GLYPH[c] - bg[c]) * glyphAlpha);
      px[i + 3] = Math.round(baseAlpha * 255);
    }
  }
  return px;
}

// ── Minimal PNG encoder (truecolour + alpha, no filtering) ──
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePNG(rgba, size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter type: None
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const TARGETS = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
];

for (const [name, size] of TARGETS) {
  writeFileSync(resolve(ROOT, name), encodePNG(render(size), size));
  console.log(`wrote ${name} (${size}×${size})`);
}
