// Builds the app icons from the logo (assets/logo.png) into public/icons.
// Run: node scripts/make-icons.mjs   (the PNGs are committed)
//
// Rounded icons get the same corner radius on all four corners, cut into the
// bitmap's alpha channel (no SVG, no CSS mask), with anti-aliased edges.
// Two icons stay square on purpose:
// - apple-touch-icon: iOS rounds it itself and turns transparent corners black.
// - icon-maskable-512: Android crops it to its own shape; it must be full-bleed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const SRC = "assets/logo.png";
/** Corner radius as a fraction of the icon side (same on every corner). */
const RADIUS = 0.22;

// ---- PNG decode (8-bit RGB/RGBA, non-interlaced) ----
function decode(buf) {
  let p = 8, w = 0, h = 0, ct = 0, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9];
      if (data[8] !== 8 || data[12] !== 0 || (ct !== 2 && ct !== 6)) throw new Error("need 8-bit RGB/RGBA, non-interlaced");
    } else if (type === "IDAT") idat.push(data);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat));
  const out = new Float64Array(w * h * 4), prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) out[(y * w + x) * 4 + k] = k < bpp ? cur[x * bpp + k] : 255;
    cur.copy(prev);
  }
  return { w, h, px: out };
}

// ---- PNG encode (8-bit RGBA) ----
function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encode(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let i = 0; i < size * 4; i++) raw[y * (size * 4 + 1) + 1 + i] = rgba[y * size * 4 + i];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Resample (box filter over the source area, premultiplied alpha) ----
function resample(src, size) {
  const out = new Uint8Array(size * size * 4), sx = src.w / size, sy = src.h / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const x0 = x * sx, x1 = x0 + sx, y0 = y * sy, y1 = y0 + sy;
    let r = 0, g = 0, b = 0, a = 0, wt = 0;
    for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
      const cw = Math.max(0, Math.min(x1, xx + 1) - Math.max(x0, xx)), ch = Math.max(0, Math.min(y1, yy + 1) - Math.max(y0, yy));
      const wgt = cw * ch, i = (Math.min(yy, src.h - 1) * src.w + Math.min(xx, src.w - 1)) * 4, al = src.px[i + 3] / 255;
      r += src.px[i] * al * wgt; g += src.px[i + 1] * al * wgt; b += src.px[i + 2] * al * wgt; a += al * wgt; wt += wgt;
    }
    const o = (y * size + x) * 4;
    out[o] = a ? Math.round(r / a) : 0; out[o + 1] = a ? Math.round(g / a) : 0; out[o + 2] = a ? Math.round(b / a) : 0;
    out[o + 3] = Math.round((a / wt) * 255);
  }
  return out;
}

/** Coverage (0..1) of pixel (x, y) by a rounded square with corner radius rad, 4x4 supersampled. */
function coverage(x, y, size, rad) {
  const SS = 4;
  let hit = 0;
  for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
    const px = x + (i + 0.5) / SS, py = y + (j + 0.5) / SS;
    const cx = Math.min(Math.max(px, rad), size - rad), cy = Math.min(Math.max(py, rad), size - rad);
    if ((px - cx) ** 2 + (py - cy) ** 2 <= rad * rad) hit++;
  }
  return hit / (SS * SS);
}

function icon(src, size, rounded) {
  const px = resample(src, size);
  if (rounded) {
    const rad = RADIUS * size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4 + 3;
      px[o] = Math.round(px[o] * coverage(x, y, size, rad));
    }
  }
  return encode(size, px);
}

const src = decode(readFileSync(SRC));
mkdirSync("public/icons", { recursive: true });
for (const [name, size, rounded] of [
  ["icon-192", 192, true],
  ["icon-512", 512, true],
  ["logo-64", 64, true],
  ["icon-maskable-512", 512, false],
  ["apple-touch-icon", 180, false],
]) {
  writeFileSync(`public/icons/${name}.png`, icon(src, size, rounded));
  console.log(`wrote public/icons/${name}.png${rounded ? ` (corner radius ${Math.round(RADIUS * size)} px)` : " (square)"}`);
}
