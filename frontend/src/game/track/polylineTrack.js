/**
 * Production polyline track (JSON units, +y down). World = * FOREST_SCALE.
 * Track is built from modular straight + 90° curve blocks (no filled polygon).
 */

import { FOREST_SCALE } from './trackGeometry.js';

/** Closed orthogonal centerline (implicit closure). */
export const VERTS_SKETCH_V2_CLEAN = [
  { x: 400, y: 560 },
  { x: 160, y: 560 },
  { x: 160, y: 640 },
  { x: 240, y: 640 },
  { x: 240, y: 720 },
  { x: 80, y: 720 },
  { x: 80, y: 800 },
  { x: 320, y: 800 },
  { x: 320, y: 880 },
  { x: 880, y: 880 },
  { x: 880, y: 720 },
  { x: 1040, y: 720 },
  { x: 1040, y: 160 },
  { x: 880, y: 160 },
  { x: 880, y: 80 },
  { x: 560, y: 80 },
  { x: 560, y: 240 },
  { x: 400, y: 240 },
  { x: 400, y: 400 },
  { x: 640, y: 400 },
  { x: 640, y: 640 },
  { x: 400, y: 640 },
];

/** Mid-edge start/finish strip (JSON units). */
export const START_LINE = {
  p1: { x: 240, y: 560 },
  p2: { x: 160, y: 560 },
};

const STEP = 80;
const BEND_OFF = STEP * 0.48;
const EDGE_TRIM = STEP * 0.35;

export function toWorldVerts(verts) {
  return verts.map((p) => ({ x: p.x * FOREST_SCALE, y: p.y * FOREST_SCALE }));
}

export function getBoundingBox(verts) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of verts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
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

function bendRot(di, dout) {
  const key = `${di}->${dout}`;
  const map = {
    '1->2': 0,
    '2->3': -90,
    '3->0': 180,
    '0->1': -90,
    '0->3': 90,
    '3->2': -90,
    '2->1': 180,
    '1->0': 90,
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

/** 2D cross product of incoming edge (a→b) and outgoing (b→c); sign = turn sense in +y-down plane. */
export function turnCross2D(ax, ay, bx, by, cx, cy) {
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = cx - bx;
  const v2y = cy - by;
  return v1x * v2y - v1y * v2x;
}

/**
 * Convert closed orthogonal polyline into modular blocks (straights + 90° curves).
 * @returns {{ type: 'straight'|'curve', x: number, y: number, rotation: number, cross: number }[]}
 */
export function buildTrackBlocksFromVerts(verts) {
  const n = verts.length;
  const blocks = [];

  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const c = verts[(i + 2) % n];
    const di = dirIndex(a.x, a.y, b.x, b.y);
    const dout = dirIndex(b.x, b.y, c.x, c.y);
    const L = dist(a, b);
    const ux = (b.x - a.x) / L;
    const uy = (b.y - a.y) / L;

    let t = EDGE_TRIM;
    while (t < L - EDGE_TRIM) {
      blocks.push({
        type: 'straight',
        x: a.x + ux * t,
        y: a.y + uy * t,
        rotation: straightRot(di),
      });
      t += STEP;
    }

    const cross = turnCross2D(a.x, a.y, b.x, b.y, c.x, c.y);
    const bo = bendOffset(b, di, dout);
    const rotation = bendRot(di, dout);
    blocks.push({
      type: 'curve',
      x: bo.x,
      y: bo.y,
      rotation,
      cross,
    });
  }

  return blocks;
}

/** Map modular blocks to engine layout items (road-1 / road-2). */
export function blocksToRoadLayout(blocks) {
  return blocks.map((b, i) => {
    if (b.type === 'straight') {
      return {
        type: 'road-1',
        x: b.x,
        y: b.y,
        rot: b.rotation,
        rotation: b.rotation,
        name: `St-${i}`,
        id: -1,
      };
    }
    return {
      type: 'road-2',
      x: b.x,
      y: b.y,
      rot: b.rotation,
      rotation: b.rotation,
      name: `Bd-${i}`,
      id: -1,
    };
  });
}

function polylineLength(verts) {
  let L = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    L += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return L;
}

function pointAtDistance(verts, dist) {
  const n = verts.length;
  const total = polylineLength(verts);
  let remaining = ((dist % total) + total) % total;
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg) {
      const t = seg > 0 ? remaining / seg : 0;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
    }
    remaining -= seg;
  }
  return { ...verts[0] };
}

/**
 * Full game layout: road blocks + checkpoints + finish + grid (no ribbon / offsetPolyline).
 */
export function buildPolylineGameLayoutFromVerts(verts, startLine) {
  const blocks = buildTrackBlocksFromVerts(verts);
  const roads = blocksToRoadLayout(blocks);

  const totalL = polylineLength(verts);
  const checkpoints = [];
  const nSec = 16;
  for (let s = 1; s <= nSec; s++) {
    const d = ((s - 0.5) / nSec) * totalL;
    const p = pointAtDistance(verts, d);
    checkpoints.push({
      type: 'checkpoint',
      x: p.x,
      y: p.y,
      rot: 0,
      name: `Sector-${s}`,
      id: s,
    });
  }

  const midX = (startLine.p1.x + startLine.p2.x) / 2;
  const midY = (startLine.p1.y + startLine.p2.y) / 2;

  const finishLine = {
    type: 'finish-line-1',
    x: midX,
    y: midY,
    rot: 90,
    rotation: 90,
    name: 'Finish',
    id: 0,
  };

  const grid = [];
  const gx = midX;
  const gy = midY - 12;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      grid.push({
        type: 'start-pos',
        x: gx + (col - 1) * 10,
        y: gy - row * 12,
        rot: 90,
        rotation: 90,
        name: 'Grid',
        id: -1,
      });
    }
  }

  return [...roads, ...checkpoints, finishLine, ...grid];
}

/** Same geometry as legacy single-track build (forest). */
export function buildPolylineGameLayout() {
  return buildPolylineGameLayoutFromVerts(VERTS_SKETCH_V2_CLEAN, START_LINE);
}

function translateVerts(verts, dx, dy) {
  return verts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

function translateStartLine(sl, dx, dy) {
  return {
    p1: { x: sl.p1.x + dx, y: sl.p1.y + dy },
    p2: { x: sl.p2.x + dx, y: sl.p2.y + dy },
  };
}

const FOREST_TRACK = { verts: VERTS_SKETCH_V2_CLEAN, startLine: START_LINE };
/** Offset copies of the same course so lobby map choice changes world placement (canvas client). */
const DESERT_TRACK = {
  verts: translateVerts(VERTS_SKETCH_V2_CLEAN, 280, 120),
  startLine: translateStartLine(START_LINE, 280, 120),
};
const SNOW_TRACK = {
  verts: translateVerts(VERTS_SKETCH_V2_CLEAN, -120, -200),
  startLine: translateStartLine(START_LINE, -120, -200),
};

/**
 * SpeedArenaNetBridge.LoadMap + room state: lowercase forest | desert | snow only.
 * Returns "" when input is blank (lobby: no map chosen yet). Unknown strings → forest.
 */
export function canonicalMapId(raw) {
  const m = raw == null ? '' : String(raw).toLowerCase().trim();
  if (!m) return '';
  if (m === 'desert' || m === 'snow' || m === 'forest') return m;
  return 'forest';
}

/** Canvas / physics default when a map id is required (never ""). */
export function normalizeMapId(mapId) {
  return canonicalMapId(mapId) || 'forest';
}

export function getMapTrackPreset(mapId) {
  switch (normalizeMapId(mapId)) {
    case 'desert':
      return DESERT_TRACK;
    case 'snow':
      return SNOW_TRACK;
    default:
      return FOREST_TRACK;
  }
}

export function buildPolylineGameLayoutForMap(mapId) {
  const { verts, startLine } = getMapTrackPreset(mapId);
  return buildPolylineGameLayoutFromVerts(verts, startLine);
}
