/**
 * Forest track OBB + lap rules — mirrors backend TrackGeometry / LapTracker.
 */

export const FOREST_SCALE = 20;
export const ROAD_HALF_LENGTH = 800;
export const ROAD_HALF_WIDTH = 350;
export const CHECKPOINT_TRIGGER_RADIUS = 900;
export const FINISH_HALF_LENGTH = 800;
export const FINISH_HALF_WIDTH = 380;
export const FINISH_CROSS_VEL_DOT_MIN = 28;
export const MAX_SECTOR_ID = 16;
const ARMED_SECTOR = MAX_SECTOR_ID + 1;

export function toWorldX(jsonX) {
  return jsonX * FOREST_SCALE;
}

export function toWorldY(jsonY) {
  return jsonY * FOREST_SCALE;
}

/** Even-odd point-in-polygon (closed polyline, implicit edge last->first). */
export function pointInPolygon(px, py, poly) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const denom = yj - yi;
    if (Math.abs(denom) < 1e-12) continue;
    const intersect =
      (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / denom + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isRibbonRoadType(item) {
  return item && item.type === 'track-ribbon' && item.outer && item.inner;
}

/** Exported for unit tests */
export function pointInObb(px, py, cx, cy, rotRad, halfW, halfH) {
  const dx = px - cx;
  const dy = py - cy;
  const c = Math.cos(-rotRad);
  const s = Math.sin(-rotRad);
  const lx = c * dx - s * dy;
  const ly = s * dx + c * dy;
  return Math.abs(lx) <= halfW && Math.abs(ly) <= halfH;
}

function isRoadType(type) {
  return type === 'road-1' || type === 'road-2';
}

export function isOnRoad(x, y, trackLayout) {
  if (!trackLayout || trackLayout.length === 0) return true;
  const ribbon = trackLayout.find(isRibbonRoadType);
  if (ribbon) {
    return (
      pointInPolygon(x, y, ribbon.outer) && !pointInPolygon(x, y, ribbon.inner)
    );
  }
  for (const item of trackLayout) {
    if (!item.type || !isRoadType(item.type)) continue;
    const rotRad = ((item.rot || 0) * Math.PI) / 180;
    const cx = toWorldX(item.x);
    const cy = toWorldY(item.y);
    if (pointInObb(x, y, cx, cy, rotRad, ROAD_HALF_LENGTH, ROAD_HALF_WIDTH)) {
      return true;
    }
  }
  return false;
}

function sectorCenters(trackLayout, sectorId) {
  const out = [];
  for (const item of trackLayout) {
    if (item.type === 'checkpoint' && item.id === sectorId) {
      out.push({ x: toWorldX(item.x), y: toWorldY(item.y) });
    }
  }
  return out;
}

export function isNearSector(x, y, trackLayout, sectorId) {
  const centers = sectorCenters(trackLayout, sectorId);
  const r = CHECKPOINT_TRIGGER_RADIUS;
  const r2 = r * r;
  for (const c of centers) {
    const dx = x - c.x;
    const dy = y - c.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

function primaryFinish(trackLayout) {
  const items = trackLayout.filter((i) => i.type === 'finish-line-1');
  return items.length ? items[0] : null;
}

function finishSlabContains(px, py, finishItem) {
  const rotRad = ((finishItem.rot || 0) * Math.PI) / 180;
  const cx = toWorldX(finishItem.x);
  const cy = toWorldY(finishItem.y);
  return pointInObb(px, py, cx, cy, rotRad, FINISH_HALF_LENGTH, FINISH_HALF_WIDTH);
}

function signedDistAlongNormal(px, py, cx, cy, rotRad) {
  const nx = -Math.sin(rotRad);
  const ny = Math.cos(rotRad);
  return (px - cx) * nx + (py - cy) * ny;
}

function distAlongTangent(px, py, cx, cy, rotRad) {
  const tx = Math.cos(rotRad);
  const ty = Math.sin(rotRad);
  return (px - cx) * tx + (py - cy) * ty;
}

function velDotNormal(vx, vy, rotRad) {
  const nx = -Math.sin(rotRad);
  const ny = Math.cos(rotRad);
  return vx * nx + vy * ny;
}

/**
 * @returns {'checkpoint'|'lap_complete'|'race_finish'|null}
 */
export function updateForestLapTracking(carState, totalLaps, trackLayout) {
  if (carState.isFinished) return null;
  if (!trackLayout || trackLayout.length === 0) return null;

  const x = carState.x;
  const y = carState.y;
  const vx = carState.velocityX || 0;
  const vy = carState.velocityY || 0;

  let prevX = carState._lapPrevX;
  let prevY = carState._lapPrevY;
  carState._lapPrevX = x;
  carState._lapPrevY = y;

  if (prevX === undefined || prevY === undefined) {
    return null;
  }

  if (carState.lapFinishCooldown) {
    const fin = primaryFinish(trackLayout);
    const stillInside = fin && finishSlabContains(x, y, fin);
    if (!stillInside) carState.lapFinishCooldown = false;
    return null;
  }

  let next = carState.lapNextSectorId;
  if (next == null || next < 1) next = 1;
  carState.lapNextSectorId = next;

  if (next >= 1 && next <= MAX_SECTOR_ID) {
    if (isNearSector(x, y, trackLayout, next)) {
      const n = next + 1;
      carState.lapNextSectorId = n;
      if (n === ARMED_SECTOR) {
        carState.passedCheckpoint = true;
        return 'checkpoint';
      }
    }
  }

  if (carState.lapNextSectorId === ARMED_SECTOR) {
    const fin = primaryFinish(trackLayout);
    if (!fin) return null;
    const rotRad = ((fin.rot || 0) * Math.PI) / 180;
    const cx = toWorldX(fin.x);
    const cy = toWorldY(fin.y);

    const sdPrev = signedDistAlongNormal(prevX, prevY, cx, cy, rotRad);
    const sdCurr = signedDistAlongNormal(x, y, cx, cy, rotRad);
    const tCurr = distAlongTangent(x, y, cx, cy, rotRad);
    const tPrev = distAlongTangent(prevX, prevY, cx, cy, rotRad);

    const inSlab = finishSlabContains(x, y, fin);
    const wasInSlab = finishSlabContains(prevX, prevY, fin);
    const crossedPlane = sdPrev * sdCurr < 0;
    const alongOk =
      Math.abs(tCurr) <= FINISH_HALF_LENGTH && Math.abs(tPrev) <= FINISH_HALF_LENGTH;
    const vDot = velDotNormal(vx, vy, rotRad);

    if (
      crossedPlane &&
      alongOk &&
      vDot >= FINISH_CROSS_VEL_DOT_MIN &&
      (inSlab || wasInSlab)
    ) {
      carState.currentLap = (carState.currentLap || 0) + 1;
      carState.lapNextSectorId = 1;
      carState.passedCheckpoint = false;
      carState.lapFinishCooldown = true;

      if (carState.currentLap >= totalLaps) {
        carState.isFinished = true;
        return 'race_finish';
      }
      return 'lap_complete';
    }
  }

  return null;
}

export function getStartPositionsFromLayout(trackLayout) {
  if (!trackLayout || !trackLayout.length) return [];
  return trackLayout
    .filter((i) => i.type === 'start-pos')
    .map((i) => ({
      x: toWorldX(i.x),
      y: toWorldY(i.y),
      angle: ((i.rot || 0) * Math.PI) / 180,
    }));
}

/** AI: next sector centroid or first checkpoint */
export function getSectorTargetWorld(trackLayout, sectorId) {
  const pts = sectorCenters(trackLayout, sectorId);
  if (!pts.length) return null;
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / pts.length, y: sy / pts.length };
}
