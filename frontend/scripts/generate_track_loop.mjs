/**
 * Legacy U-notch layout (outer rectangle + top U). Superseded by generate_track_sketch.mjs
 * for the sketch-based inner-S track; kept for reference / diff.
 * Straights every STEP (80 json); bends at vertices; END on left vertical.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FRONT = path.join(__dirname, '../src/game/levels/track_forest.json');
const OUT_BACK = path.join(
  __dirname,
  '../../backend/src/main/resources/track/track_forest.json',
);

const STEP = 80;
const BEND_OFF = STEP * 0.48;
const EDGE_TRIM = STEP * 0.35;

/** Clockwise centerline corners (json units). U opens south from top edge. */
const VERTS = [
  { x: 880, y: 80 }, // top-right, along top from right
  { x: 640, y: 80 }, // top before U
  { x: 640, y: 240 }, // U south
  { x: 400, y: 240 }, // U west
  { x: 400, y: 80 }, // U north
  { x: 0, y: 80 }, // top-left
  { x: 0, y: 800 }, // bottom-left
  { x: 880, y: 800 }, // bottom-right
];

const items = [];
const checkpoints = [];

let roadId = 0;
let bendId = 0;

function road(x, y, rot, name) {
  items.push({ type: 'road-1', x, y, rot, name, id: -1 });
}
function bend(x, y, rot, name) {
  items.push({ type: 'road-2', x, y, rot, name, id: -1 });
}
function chk(x, y, id, name) {
  checkpoints.push({ type: 'checkpoint', x, y, rot: 0, name, id });
}
function finish(x, y, rot) {
  items.push({ type: 'finish-line-1', x, y, rot, name: 'Finish', id: 0 });
}
function start(x, y, rot) {
  items.push({ type: 'start-pos', x, y, rot, name: 'Grid', id: -1 });
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** 0=E, 1=S, 2=W, 3=N in canvas space (+y down) */
function dirIndex(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 0 : 2;
  return dy > 0 ? 1 : 3;
}

function straightRot(d) {
  return d === 0 || d === 2 ? 0 : 90;
}

/**
 * Bend rotation for 90° corner: incoming dir di, outgoing do (each 0–3).
 * Tuned for road-bend-1 asset with clockwise outer loop.
 */
function bendRot(di, dout) {
  const key = `${di}->${dout}`;
  const map = {
    '1->2': 0, // S to W
    '2->3': -90, // W to N (U inner corner)
    '3->0': 180, // N to E
    '0->1': -90, // E to S
    '0->3': 90, // E to N
    '3->2': -90, // N to W
    '2->1': 180, // W to S
    '1->0': 90, // S to E
  };
  if (map[key] != null) return map[key];
  return 0;
}

function bendOffset(v, di, dout) {
  const ox =
    (dout === 0 ? 1 : dout === 2 ? -1 : di === 0 ? 1 : di === 2 ? -1 : 0) * BEND_OFF * 0.6;
  const oy =
    (dout === 1 ? 1 : dout === 3 ? -1 : di === 1 ? 1 : di === 3 ? -1 : 0) * BEND_OFF * 0.6;
  return { x: v.x + ox, y: v.y + oy };
}

const n = VERTS.length;
for (let i = 0; i < n; i++) {
  const a = VERTS[i];
  const b = VERTS[(i + 1) % n];
  const c = VERTS[(i + 2) % n];
  const di = dirIndex(a.x, a.y, b.x, b.y);
  const dout = dirIndex(b.x, b.y, c.x, c.y);
  const L = dist(a, b);
  const ux = (b.x - a.x) / L;
  const uy = (b.y - a.y) / L;

  let t = EDGE_TRIM;
  while (t < L - EDGE_TRIM) {
    road(a.x + ux * t, a.y + uy * t, straightRot(di), `St-${roadId++}`);
    t += STEP;
  }

  const bo = bendOffset(b, di, dout);
  bend(bo.x, bo.y, bendRot(di, dout), `Bd-${bendId++}`);
}

// --- Lap path (same corners, for checkpoints) ---
const raw = [];
for (let i = 0; i < n; i++) {
  const a = VERTS[i];
  const b = VERTS[(i + 1) % n];
  const L = dist(a, b);
  const ux = (b.x - a.x) / L;
  const uy = (b.y - a.y) / L;
  let t = 0;
  while (t < L) {
    raw.push({ x: a.x + ux * t, y: a.y + uy * t });
    t += STEP * 0.5;
  }
}

// END: left vertical, horizontal checkered strip (rot 0), vy > 0 completes lap
const finishX = 0;
const finishY = 7 * STEP; // 560 — below mid left (Start above)
finish(finishX, finishY, 0);

let bestIdx = 0;
let bestD = Infinity;
for (let i = 0; i < raw.length; i++) {
  const d = (raw[i].x - finishX) ** 2 + (raw[i].y - finishY) ** 2;
  if (d < bestD) {
    bestD = d;
    bestIdx = i;
  }
}
const line = raw.slice(bestIdx).concat(raw.slice(0, bestIdx));

function segLen2(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
const seg = [];
let totalL = 0;
for (let i = 0; i < line.length; i++) {
  const a = line[i];
  const b = line[(i + 1) % line.length];
  const l = segLen2(a, b);
  seg.push({ a, b, l });
  totalL += l;
}

for (let s = 1; s <= 16; s++) {
  let d = ((s - 0.5) / 16) * totalL;
  for (const e of seg) {
    if (d <= e.l) {
      const t = e.l > 0 ? d / e.l : 0;
      chk(
        e.a.x + (e.b.x - e.a.x) * t,
        e.a.y + (e.b.y - e.a.y) * t,
        s,
        `Sector-${s}`,
      );
      break;
    }
    d -= e.l;
  }
}

// Start grid above END (smaller y), facing down
for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 3; col++) {
    start(finishX + (col - 1) * 10, finishY - 24 - row * 12, 90);
  }
}

// Side patch in U-bay grass
items.push({
  type: 'side-ground-1',
  x: 520,
  y: 160,
  rot: 0,
  name: 'Bay',
  id: -1,
});

const pad = STEP * 2;
const treePts = [
  { x: -pad, y: -pad },
  { x: 880 + pad, y: -pad },
  { x: 880 + pad, y: 800 + pad },
  { x: -pad, y: 800 + pad },
  { x: 520, y: 400 },
];
for (let i = 0; i < treePts.length; i++) {
  const p = treePts[i];
  items.push({ type: 'tree-1', x: p.x, y: p.y, rot: 0, name: `Tr-${i}`, id: -1 });
}

const roadsAndBends = items.filter(
  (o) => o.type === 'road-1' || o.type === 'road-2' || o.type === 'side-ground-1',
);
const trees = items.filter((o) => o.type === 'tree-1');
const startsArr = items.filter((o) => o.type === 'start-pos');
const finishArr = items.filter((o) => o.type === 'finish-line-1');

const layout = [
  ...checkpoints,
  ...finishArr,
  ...roadsAndBends,
  ...startsArr,
  ...trees,
];

const json = JSON.stringify(layout, null, 2);
fs.writeFileSync(OUT_FRONT, json);
if (fs.existsSync(path.dirname(OUT_BACK))) {
  fs.writeFileSync(OUT_BACK, json);
  console.log('Synced backend copy');
}
console.log('Wrote', OUT_FRONT, 'count', layout.length, 'roads+bends', roadsAndBends.length);
