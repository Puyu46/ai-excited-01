// gen.mjs — programmatic renderer for ai-excited-01 (round 3)
// "The Whale That Jumped Through the Sun"
// Node stdlib only: hand-rolled PNG encoder (zlib deflate + CRC32).
// Scene: dramatic sunset sky, blazing sun with glow, a giant whale
// leaping diagonally straight through the sun, ocean with waves and
// a big breach splash, light particles and birds.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

// ---------- deterministic PRNG (mulberry-style LCG) ----------
let seed = 20261116;
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

// ---------- pixel helpers ----------
function blend(x, y, r, g, b, a) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const i = (y * W + x) * 3;
  if (a >= 1) {
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    return;
  }
  px[i] = Math.round(px[i] + (r - px[i]) * a);
  px[i + 1] = Math.round(px[i + 1] + (g - px[i + 1]) * a);
  px[i + 2] = Math.round(px[i + 2] + (b - px[i + 2]) * a);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t) | 0, lerp(c1[1], c2[1], t) | 0, lerp(c1[2], c2[2], t) | 0];
}

// Vertical gradient band from y0 to y1 through color stops [[t, [r,g,b]], ...]
function vgrad(y0, y1, stops) {
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / (y1 - y0);
    let c = stops[stops.length - 1][1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t <= stops[s + 1][0]) {
        const tt = (t - stops[s][0]) / (stops[s + 1][0] - stops[s][0]);
        c = mix(stops[s][1], stops[s + 1][1], tt);
        break;
      }
    }
    for (let x = 0; x < W; x++) blend(x, y, c[0], c[1], c[2], 1);
  }
}

function fillCircle(cx, cy, r, c, a = 1) {
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) blend(x, y, c[0], c[1], c[2], a);
    }
  }
}

function fillEllipse(cx, cy, rx, ry, c, a = 1) {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) blend(x, y, c[0], c[1], c[2], a);
    }
  }
}

// Scanline polygon fill.
function fillPolygon(pts, c, a = 1) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      if ((p1[1] <= y && p2[1] > y) || (p2[1] <= y && p1[1] > y)) {
        xs.push(p1[0] + ((y - p1[1]) * (p2[0] - p1[0])) / (p2[1] - p1[1]));
      }
    }
    xs.sort((u, v) => u - v);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) {
        blend(x, y, c[0], c[1], c[2], a);
      }
    }
  }
}

// Thick polyline: overlapping circles along the path.
function strokePath(pts, c, w, a = 1) {
  for (let i = 0; i < pts.length - 1; i++) {
    const x1 = pts[i][0];
    const y1 = pts[i][1];
    const x2 = pts[i + 1][0];
    const y2 = pts[i + 1][1];
    const d = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.ceil(d / 1.5));
    for (let s = 0; s <= n; s++) {
      fillCircle(x1 + ((x2 - x1) * s) / n, y1 + ((y2 - y1) * s) / n, w / 2, c, a);
    }
  }
}

function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}
function sampleCubic(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(cubic(p0, p1, p2, p3, i / n));
  return out;
}

// ---------- 1. sky ----------
vgrad(0, 720, [
  [0, [13, 17, 54]],
  [0.35, [44, 42, 110]],
  [0.62, [138, 61, 124]],
  [0.85, [255, 122, 64]],
  [1, [255, 166, 88]],
]);

// ---------- 2. sun: glow then blazing core ----------
const SUN = [512, 400];
for (let r = 480; r > 200; r -= 6) {
  const a = 0.05 + 0.12 * (1 - r / 480);
  fillCircle(SUN[0], SUN[1], r, [255, 140, 60], a);
}
// Extra-wide faint halo so the sun burns through the whole sky.
for (let r = 510; r > 480; r -= 8) {
  fillCircle(SUN[0], SUN[1], r, [255, 120, 50], 0.03);
}
for (let r = 196; r > 0; r -= 2) {
  const t = r / 196;
  const c = mix([255, 250, 205], [255, 168, 60], t);
  fillCircle(SUN[0], SUN[1], r, c, 1);
}
// Sun rim: crisp bright edge.
for (let r = 196; r > 186; r--) fillCircle(SUN[0], SUN[1], r, [255, 214, 110], 0.25);

// ---------- 3. soft clouds ----------
const cloud = (cx, cy, rx, ry, a) => {
  fillEllipse(cx, cy, rx, ry, [255, 205, 180], a);
  fillEllipse(cx - rx * 0.4, cy + 6, rx * 0.55, ry * 0.6, [255, 225, 200], a * 0.9);
  fillEllipse(cx + rx * 0.45, cy + 8, rx * 0.5, ry * 0.55, [255, 215, 190], a * 0.8);
};
cloud(175, 255, 150, 26, 0.22);
cloud(855, 205, 165, 30, 0.2);
cloud(830, 610, 125, 22, 0.18);
cloud(150, 590, 110, 20, 0.16);

// ---------- 4. ocean ----------
vgrad(720, 1024, [
  [0, [11, 94, 143]],
  [0.45, [8, 62, 102]],
  [1, [4, 38, 63]],
]);

// Sun reflection: shimmering gold dashes under the sun.
for (let y = 732; y < 1010; y += 9) {
  const half = 130 - (y - 732) * 0.14;
  let x = SUN[0] - half + rnd() * 20;
  while (x < SUN[0] + half) {
    const len = 12 + rnd() * 34;
    const pts = [];
    for (let s = 0; s <= 4; s++) pts.push([x + (len * s) / 4, y + Math.sin(s * 1.2) * 1.5]);
    strokePath(pts, [255, 186, 92], 3, 0.32 + rnd() * 0.2);
    x += len + 14 + rnd() * 26;
  }
}

// ---------- 5. waves (sine crests) ----------
function wave(yBase, amp, len, c, w, a) {
  const pts = [];
  for (let x = -20; x <= W + 20; x += 8) {
    pts.push([x, yBase + Math.sin((x / len) * Math.PI * 2 + yBase) * amp]);
  }
  strokePath(pts, c, w, a);
}
wave(768, 9, 190, [255, 255, 255], 4, 0.32);
wave(828, 12, 230, [255, 255, 255], 4, 0.26);
wave(898, 10, 170, [190, 225, 245], 4, 0.22);
wave(962, 13, 250, [255, 255, 255], 5, 0.2);
wave(1000, 11, 200, [150, 200, 230], 4, 0.18);

// ---------- 6. the whale ----------
// Local coords: nose at left, tail at right, y down. Rotated ~65 deg so the
// nose points up-left through the sun and the tail dives down-right.
const ANG = (65 * Math.PI) / 180;
const COS = Math.cos(ANG);
const SIN = Math.sin(ANG);
const CX = 480;
const CY = 380;
function xform(p) {
  return [CX + p[0] * COS - p[1] * SIN, CY + p[0] * SIN + p[1] * COS];
}
function xformAll(pts) {
  return pts.map(xform);
}

// Whale outline as cubic segments (local space).
const segTopHead = sampleCubic([10, 78], [60, 30], [140, 8], [230, 12], 24);
const segBack = sampleCubic([230, 12], [320, 16], [400, 28], [470, 48], 24);
const segFlukeUp = sampleCubic([470, 48], [520, 20], [548, 4], [568, 2], 14);
const segFlukeNotch = sampleCubic([568, 2], [552, 34], [534, 52], [520, 62], 10);
const segFlukeLow = sampleCubic([520, 62], [546, 96], [560, 114], [566, 122], 12);
// Belly: tail stock back to the nose along the underside.
const segBellyMain = sampleCubic([505, 88], [420, 128], [300, 148], [190, 140], 24);
const segBellyNose = sampleCubic([190, 140], [120, 132], [50, 118], [10, 78], 16);

const whalePts = xformAll([
  ...segTopHead,
  ...segBack.slice(1),
  ...segFlukeUp.slice(1),
  ...segFlukeNotch.slice(1),
  ...segFlukeLow.slice(1),
  ...segBellyMain.slice(1),
  ...segBellyNose.slice(1),
]);

const NAVY = [22, 32, 74];
fillPolygon(whalePts, NAVY, 1);

// Belly band: lighter stripe along the underside.
const bellyOuter = [...segBellyMain, ...segBellyNose];
const bellyInner = [...segBellyMain, ...segBellyNose].map((p) => [p[0], p[1] - 30]);
const bellyPts = xformAll([...bellyOuter, ...bellyInner.reverse()]);
fillPolygon(bellyPts, [111, 177, 229], 0.9);

// Pectoral fin.
fillPolygon(
  xformAll([
    [170, 118],
    [252, 140],
    [214, 170],
    [176, 150],
  ]),
  [14, 24, 58],
  1,
);

// Eye: white with dark pupil.
const eye = xform([78, 58]);
fillCircle(eye[0], eye[1], 10, [255, 255, 255], 1);
fillCircle(eye[0] + 2, eye[1] - 1, 5, [10, 12, 30], 1);
// Mouth: short smiling curve near the nose.
strokePath(
  xformAll(
    sampleCubic([28, 96], [52, 108], [78, 112], [102, 106], 10),
  ),
  [10, 14, 34],
  4,
  0.9,
);
// Sunlit rim along the whale's back (gold edge where the sun hits it).
strokePath(xformAll([...segTopHead, ...segBack.slice(1)]), [255, 209, 102], 5, 0.9);

// ---------- 7. breach splash ----------
// Water entry point where the body crosses the surface.
const BREACH = [600, 720];
// Foam ring at the waterline.
fillEllipse(BREACH[0], BREACH[1] + 4, 165, 30, [255, 255, 255], 0.45);
fillEllipse(BREACH[0], BREACH[1] + 4, 130, 20, [11, 94, 143], 0.55);
fillEllipse(BREACH[0], BREACH[1] + 2, 100, 14, [255, 255, 255], 0.5);
// Spray arcs fanning upward.
for (let a = 0; a < 4; a++) {
  const r = 55 + a * 42;
  const pts = [];
  for (let t = -0.9; t <= 0.9; t += 0.15) {
    pts.push([BREACH[0] + Math.sin(t) * r, BREACH[1] - Math.cos(t) * r * 0.85]);
  }
  strokePath(pts, [255, 255, 255], 5 - a, 0.75 - a * 0.15);
}
// Droplets.
for (let i = 0; i < 150; i++) {
  const ang = -Math.PI / 2 + (rnd() - 0.5) * 2.2;
  const dist = 30 + rnd() * 190;
  const dx = Math.cos(ang) * dist;
  const dy = Math.sin(ang) * dist * 0.8;
  fillCircle(BREACH[0] + dx, BREACH[1] + dy, 1.5 + rnd() * 5, [255, 255, 255], 0.55 + rnd() * 0.4);
}
// A few big flying drops catching the sun.
for (let i = 0; i < 14; i++) {
  const ang = -Math.PI / 2 + (rnd() - 0.5) * 1.8;
  const dist = 90 + rnd() * 170;
  fillCircle(
    BREACH[0] + Math.cos(ang) * dist,
    BREACH[1] + Math.sin(ang) * dist * 0.8,
    4 + rnd() * 5,
    [255, 224, 150],
    0.9,
  );
}

// ---------- 8. sparkles around the sun ----------
for (let i = 0; i < 80; i++) {
  const x = 60 + rnd() * (W - 120);
  const y = 40 + rnd() * 600;
  const d = Math.hypot(x - SUN[0], y - SUN[1]);
  if (d < 210) continue; // keep the sun disc clean
  const s = 2 + rnd() * 4;
  const a = 0.4 + rnd() * 0.5;
  const c = rnd() < 0.5 ? [255, 220, 140] : [255, 255, 255];
  strokePath(
    [
      [x - s, y],
      [x + s, y],
    ],
    c,
    2,
    a,
  );
  strokePath(
    [
      [x, y - s],
      [x, y + s],
    ],
    c,
    2,
    a,
  );
}

// ---------- 9. birds ----------
function bird(cx, cy, s) {
  strokePath(
    [
      [cx - s, cy],
      [cx - s * 0.4, cy - s * 0.55],
      [cx, cy],
      [cx + s * 0.4, cy - s * 0.55],
      [cx + s, cy],
    ],
    [28, 18, 58],
    3,
    0.85,
  );
}
bird(250, 180, 16);
bird(330, 148, 12);
bird(762, 168, 14);
bird(702, 118, 11);
bird(185, 330, 13);

// ---------- PNG encode ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0; // filter: none
  raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: truecolor RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync('entry.png', png);
console.log(`entry.png written: ${png.length} bytes (${W}x${H})`);
