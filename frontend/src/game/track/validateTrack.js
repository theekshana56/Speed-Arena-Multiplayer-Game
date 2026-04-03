/**
 * Strict orthogonal closed-track validation for generator vertices (+y down, implicit closure).
 *
 * Start/finish strips that lie *mid-edge* must NOT add an extra vertex on the same straight
 * (that creates a 180° turn). Use one edge (e.g. 400,560 → 160,560) and keep START_LINE {p1,p2}
 * as metadata on that segment.
 */

const EPS = 1e-9;

/**
 * Closed segments [a,b] and [c,d] intersect (including collinear overlap or T-touch).
 * Used for self-intersection checks on non-adjacent edges.
 */
export function segmentsIntersect(a, b, c, d) {
  const cross = (o, p, q) =>
    (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);

  const onSegment = (p, q, r) =>
    q.x <= Math.max(p.x, r.x) + EPS &&
    q.x + EPS >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) + EPS &&
    q.y + EPS >= Math.min(p.y, r.y);

  const o1 = cross(a, b, c);
  const o2 = cross(a, b, d);
  const o3 = cross(c, d, a);
  const o4 = cross(c, d, b);

  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;

  return o1 * o2 < 0 && o3 * o4 < 0;
}

function twiceSignedArea(verts) {
  let s = 0;
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i];
    const q = verts[(i + 1) % verts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s;
}

export function isClockwise(verts) {
  return twiceSignedArea(verts) < 0;
}

function edgesAdjacent(i, j, n) {
  if (i === j) return true;
  if (Math.abs(i - j) === 1) return true;
  if ((i === 0 && j === n - 1) || (i === n - 1 && j === 0)) return true;
  return false;
}

/**
 * @param {{x:number,y:number}[]} verts
 * @returns {true}
 * @throws {Error}
 */
export function validateTrack(verts) {
  if (!verts || !Array.isArray(verts)) {
    throw new Error('Invalid track: verts must be an array');
  }
  if (verts.length < 4) {
    throw new Error(`Invalid track: need at least 4 vertices, got ${verts.length}`);
  }

  for (let i = 0; i < verts.length; i++) {
    const p = verts[i];
    if (
      typeof p !== 'object' ||
      p === null ||
      typeof p.x !== 'number' ||
      typeof p.y !== 'number' ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y)
    ) {
      throw new Error(`Invalid track: vertex at index ${i} must be { x, y } with finite numbers`);
    }
  }

  const n = verts.length;

  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    if (a.x === b.x && a.y === b.y) {
      throw new Error(`Invalid track: duplicate consecutive points at index ${i}`);
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx !== 0 && dy !== 0) {
      throw new Error(`Invalid track: diagonal segment at index ${i}`);
    }
    if (dx === 0 && dy === 0) {
      throw new Error(`Invalid track: zero-length segment at index ${i}`);
    }
  }

  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n];
    const cur = verts[i];
    const next = verts[(i + 1) % n];
    const v1x = cur.x - prev.x;
    const v1y = cur.y - prev.y;
    const v2x = next.x - cur.x;
    const v2y = next.y - cur.y;
    const dot = v1x * v2x + v1y * v2y;
    if (dot !== 0) {
      const lenSq1 = v1x * v1x + v1y * v1y;
      const lenSq2 = v2x * v2x + v2y * v2y;
      const parallel = lenSq1 > 0 && lenSq2 > 0 && dot * dot === lenSq1 * lenSq2;
      const hint = parallel
        ? ' (180° collinear — remove intermediate point on same straight; keep start/finish as metadata on the edge)'
        : '';
      throw new Error(`Invalid track: turn at vertex ${i} is not 90° (dot=${dot})${hint}`);
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (edgesAdjacent(i, j, n)) continue;
      const a = verts[i];
      const b = verts[(i + 1) % n];
      const c = verts[j];
      const d = verts[(j + 1) % n];
      if (segmentsIntersect(a, b, c, d)) {
        throw new Error(`Invalid track: self-intersection between segments ${i} and ${j}`);
      }
    }
  }

  const area2 = twiceSignedArea(verts);
  if (area2 === 0) {
    throw new Error('Invalid track: degenerate polygon (zero area)');
  }
  if (!isClockwise(verts)) {
    throw new Error('Invalid track: winding must be clockwise (for this engine convention)');
  }

  return true;
}
