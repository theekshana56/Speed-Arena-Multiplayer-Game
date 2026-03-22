/**
 * carPhysics.js - Client-side Car Physics Engine
 *
 * Features:
 * - Client-side prediction for instant response
 * - Handbrake/drift mechanics (Spacebar)
 * - Damage system with health tracking
 * - Oval track with proper collision detection
 * - Respawn system when health reaches zero
 */

// ─── Physics Constants ──────────────────────────────────────────────────────

export const TOP_SPEED = 600.0;
export const MAX_REVERSE_SPEED = 200.0;
export const ACCELERATION = 240.0;
export const BRAKE_DECELERATION = 450.0;
export const FRICTION = 1.5;
export const TURN_SPEED = 3.5;
export const MIN_TURN_SPEED = 10.0;
export const GRIP = 3.0;
export const DRIFT_THRESHOLD = 200.0;
export const CENTRIFUGAL_FACTOR = 0.15;

// Handbrake constants
export const HANDBRAKE_GRIP = 0.3; // Much lower grip when handbraking
export const HANDBRAKE_DECELERATION = 500.0; // Strong deceleration
export const HANDBRAKE_TURN_BOOST = 2.0; // Increased turn rate

// Damage constants
export const MAX_HEALTH = 100;
export const COLLISION_DAMAGE = 15; // Damage per wall hit
export const SPEED_DAMAGE_MULTIPLIER = 0.05; // Higher speed = more damage

// ─── Oval Track Configuration ───────────────────────────────────────────────

/**
 * Oval track defined by center, radii for outer and inner boundaries
 */
export const TRACK_CONFIG = {
  centerX: 510,
  centerY: 350,
  outerRadiusX: 380,
  outerRadiusY: 255,
  innerRadiusX: 260,
  innerRadiusY: 150,
  trackWidth: 120, 
};

/**
 * Respawn points around the track (used when car needs to respawn)
 * Format: { x, y, angle }
 */
export const RESPAWN_POINTS = [
  { x: 185, y: 350, angle: -Math.PI / 2 },   // Left side, facing up
  { x: 510, y: 605, angle: 0 },              // Bottom, facing right
  { x: 835, y: 350, angle: Math.PI / 2 },    // Right side, facing down
  { x: 510, y: 95,  angle: Math.PI },        // Top, facing left
];

/**
 * Starting grid positions for races (left side of track, facing up)
 */
export const STARTING_POSITIONS = [
  { x: 165, y: 390, angle: -Math.PI / 2 },
  { x: 165, y: 435, angle: -Math.PI / 2 },
  { x: 210, y: 390, angle: -Math.PI / 2 },
  { x: 210, y: 435, angle: -Math.PI / 2 },
];

/**
 * Lap tracking configuration
 * Uses checkpoint system - must pass checkpoint before finish line counts
 */
export const LAP_CONFIG = {
  totalLaps: 3,
  // Checkpoint is on the right side of the track (opposite of finish line)
  checkpoint: {
    x: 835,
    y: 350,
    radius: 90, // Detection radius
  },
  // Finish line is on the left side of the track
  finishLine: {
    x: 185,
    y: 350,
    radius: 90, // Detection radius
  },
};

/**
 * Checks if car is near a checkpoint/finish line
 */
export function isNearPoint(carX, carY, pointX, pointY, radius) {
  const dx = carX - pointX;
  const dy = carY - pointY;
  return Math.sqrt(dx * dx + dy * dy) <= radius;
}

/**
 * Updates lap tracking for a car
 * Returns lap event: 'checkpoint', 'lap_complete', 'race_finish', or null
 */
export function updateLapTracking(carState, totalLaps = LAP_CONFIG.totalLaps) {
  const { x, y } = carState;

  // Initialize lap tracking state if needed
  if (carState.passedCheckpoint === undefined) {
    carState.passedCheckpoint = false;
  }
  if (carState.currentLap === undefined) {
    carState.currentLap = 0;
  }
  if (carState.isFinished === undefined) {
    carState.isFinished = false;
  }

  // Don't track if already finished
  if (carState.isFinished) {
    return null;
  }

  // Check checkpoint (right side of track)
  if (!carState.passedCheckpoint &&
      isNearPoint(x, y, LAP_CONFIG.checkpoint.x, LAP_CONFIG.checkpoint.y, LAP_CONFIG.checkpoint.radius)) {
    carState.passedCheckpoint = true;
    return 'checkpoint';
  }

  // Check finish line (left side of track) - only counts if checkpoint was passed
  if (carState.passedCheckpoint &&
      isNearPoint(x, y, LAP_CONFIG.finishLine.x, LAP_CONFIG.finishLine.y, LAP_CONFIG.finishLine.radius)) {
    carState.passedCheckpoint = false; // Reset for next lap
    carState.currentLap++;

    // Check if race is complete
    if (carState.currentLap >= totalLaps) {
      carState.isFinished = true;
      carState.finishTime = Date.now();
      return 'race_finish';
    }

    return 'lap_complete';
  }

  return null;
}

// ─── Main Physics Update ────────────────────────────────────────────────────

/**
 * Updates car physics for one frame with handbrake support.
 */
export function updateCarPhysics(carState, input, deltaTime) {
  deltaTime = Math.min(deltaTime, 0.1);

  let { speed, angle, velocityX = 0, velocityY = 0 } = carState;
  const { accelerate, brake, turnLeft, turnRight, handbrake = false } = input;

  // ─── 1. Handle Acceleration/Braking/Handbrake ─────────────────────────────

  if (handbrake) {
    // Handbrake: strong deceleration, increased drift
    speed *= Math.pow(1.0 - HANDBRAKE_DECELERATION * 0.001, deltaTime * 60);
    if (Math.abs(speed) < 5) speed = 0;
  } else if (accelerate) {
    speed += ACCELERATION * deltaTime;
    speed = Math.min(speed, TOP_SPEED);
  } else if (brake) {
    if (speed > 0) {
      speed -= BRAKE_DECELERATION * deltaTime;
      speed = Math.max(speed, 0);
    } else {
      speed -= ACCELERATION * 0.5 * deltaTime;
      speed = Math.max(speed, -MAX_REVERSE_SPEED);
    }
  } else {
    speed *= Math.pow(1.0 - FRICTION * 0.1, deltaTime * 10);
    if (Math.abs(speed) < 1.0) speed = 0;
  }

  // ─── 2. Handle Turning (with handbrake boost) ─────────────────────────────

  let turnRate = 0;

  if (Math.abs(speed) > MIN_TURN_SPEED) {
    const speedFactor = Math.min(1.0, Math.abs(speed) / 100.0);
    let effectiveTurnSpeed = TURN_SPEED * speedFactor;

    // Handbrake increases turn rate for drifting
    if (handbrake) {
      effectiveTurnSpeed *= HANDBRAKE_TURN_BOOST;
    }

    const directionMultiplier = speed >= 0 ? 1.0 : -1.0;

    if (turnLeft) {
      turnRate = -effectiveTurnSpeed * directionMultiplier;
    } else if (turnRight) {
      turnRate = effectiveTurnSpeed * directionMultiplier;
    }

    angle += turnRate * deltaTime;
    angle = normalizeAngle(angle);
  }

  // ─── 3. Calculate Velocity with Drift Physics ─────────────────────────────

  const intendedVx = Math.cos(angle) * speed;
  const intendedVy = Math.sin(angle) * speed;

  // Grip is reduced during handbrake (more drift)
  const currentGrip = handbrake ? HANDBRAKE_GRIP : GRIP;
  const blendFactor = 1.0 - Math.exp(-currentGrip * deltaTime);

  velocityX = velocityX + (intendedVx - velocityX) * blendFactor;
  velocityY = velocityY + (intendedVy - velocityY) * blendFactor;

  // Centrifugal force (stronger when handbraking)
  if (Math.abs(speed) > DRIFT_THRESHOLD && turnRate !== 0) {
    const centrifugalMultiplier = handbrake ? 2.0 : 1.0;
    const centrifugalForce = Math.abs(turnRate) * Math.abs(speed) * CENTRIFUGAL_FACTOR * centrifugalMultiplier;
    const centrifugalAngle = angle + (turnRate > 0 ? -Math.PI / 2 : Math.PI / 2);

    velocityX += Math.cos(centrifugalAngle) * centrifugalForce * deltaTime;
    velocityY += Math.sin(centrifugalAngle) * centrifugalForce * deltaTime;
  }

  // ─── 4. Update Position ───────────────────────────────────────────────────

  carState.x += velocityX * deltaTime;
  carState.y += velocityY * deltaTime;
  carState.angle = angle;
  carState.speed = speed;
  carState.velocityX = velocityX;
  carState.velocityY = velocityY;
}

// ─── Oval Track Collision Detection ─────────────────────────────────────────

/**
 * Checks if a point is inside an ellipse.
 */
function isInsideEllipse(x, y, centerX, centerY, radiusX, radiusY) {
  const dx = x - centerX;
  const dy = y - centerY;
  return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1;
}

/**
 * Checks if a point is on the valid track area (between inner and outer ellipse).
 */
export function isOnTrack(x, y) {
  const { centerX, centerY, outerRadiusX, outerRadiusY, innerRadiusX, innerRadiusY } = TRACK_CONFIG;

  const insideOuter = isInsideEllipse(x, y, centerX, centerY, outerRadiusX, outerRadiusY);
  const insideInner = isInsideEllipse(x, y, centerX, centerY, innerRadiusX, innerRadiusY);

  return insideOuter && !insideInner;
}

/**
 * Gets the closest point on an ellipse boundary.
 */
function getClosestPointOnEllipse(x, y, centerX, centerY, radiusX, radiusY) {
  const dx = x - centerX;
  const dy = y - centerY;
  const angle = Math.atan2(dy / radiusY, dx / radiusX);

  return {
    x: centerX + radiusX * Math.cos(angle),
    y: centerY + radiusY * Math.sin(angle),
  };
}

/**
 * Handles collision with track boundaries.
 * Returns collision info including damage.
 */
export function handleCollision(carState) {
  const { x, y, speed } = carState;
  const { centerX, centerY, outerRadiusX, outerRadiusY, innerRadiusX, innerRadiusY } = TRACK_CONFIG;

  const PUSHBACK = 8;
  const BOUNCE_FACTOR = 0.3;

  let collided = false;
  let damage = 0;

  // Check outer boundary (car went outside track)
  if (!isInsideEllipse(x, y, centerX, centerY, outerRadiusX, outerRadiusY)) {
    const closest = getClosestPointOnEllipse(x, y, centerX, centerY, outerRadiusX, outerRadiusY);

    // Push back inside
    const dx = closest.x - x;
    const dy = closest.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      carState.x = closest.x + (dx / dist) * PUSHBACK;
      carState.y = closest.y + (dy / dist) * PUSHBACK;
    }

    // Bounce velocity
    carState.velocityX *= -BOUNCE_FACTOR;
    carState.velocityY *= -BOUNCE_FACTOR;
    carState.speed *= BOUNCE_FACTOR;

    collided = true;
    damage = COLLISION_DAMAGE + Math.abs(speed) * SPEED_DAMAGE_MULTIPLIER;
  }

  // Check inner boundary (car went into infield)
  if (isInsideEllipse(x, y, centerX, centerY, innerRadiusX, innerRadiusY)) {
    const closest = getClosestPointOnEllipse(x, y, centerX, centerY, innerRadiusX, innerRadiusY);

    // Push back outside inner ellipse
    const dx = x - closest.x;
    const dy = y - closest.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      carState.x = closest.x + (dx / dist) * PUSHBACK;
      carState.y = closest.y + (dy / dist) * PUSHBACK;
    } else {
      // Car is exactly at center, push in a random direction
      carState.x = closest.x + PUSHBACK;
    }

    // Bounce velocity
    carState.velocityX *= -BOUNCE_FACTOR;
    carState.velocityY *= -BOUNCE_FACTOR;
    carState.speed *= BOUNCE_FACTOR;

    collided = true;
    damage = COLLISION_DAMAGE + Math.abs(speed) * SPEED_DAMAGE_MULTIPLIER;
  }

  return { collided, damage: Math.round(damage) };
}

/**
 * Applies damage to car and checks for respawn.
 * Returns true if car needs to respawn.
 */
export function applyDamage(carState, damage) {
  if (!carState.health) carState.health = MAX_HEALTH;

  carState.health -= damage;

  if (carState.health <= 0) {
    carState.health = 0;
    return true; // Needs respawn
  }

  return false;
}

/**
 * Respawns the car at the nearest respawn point.
 */
export function respawnCar(carState) {
  const { x, y } = carState;

  // Find nearest respawn point
  let nearestPoint = RESPAWN_POINTS[0];
  let nearestDist = Infinity;

  RESPAWN_POINTS.forEach((point) => {
    const dist = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestPoint = point;
    }
  });

  // Reset car state at respawn point
  carState.x = nearestPoint.x;
  carState.y = nearestPoint.y;
  carState.angle = nearestPoint.angle;
  carState.speed = 0;
  carState.velocityX = 0;
  carState.velocityY = 0;
  carState.health = MAX_HEALTH;

  return nearestPoint;
}

// ─── Legacy Square Track (for backwards compatibility) ─────────────────────

export const TRACK_BOUNDS = {
  outer: { left: 50, top: 50, right: 1150, bottom: 750 },
  inner: { left: 200, top: 200, right: 1000, bottom: 600 },
};

export function isWithinBounds(x, y) {
  return isOnTrack(x, y);
}

// ─── Utility Functions ──────────────────────────────────────────────────────

export function normalizeAngle(angle) {
  angle = angle % (2 * Math.PI);
  if (angle < 0) angle += 2 * Math.PI;
  return angle;
}

export function getDisplaySpeed(speed) {
  return Math.round(Math.abs(speed) * 0.5);
}

export function getSpeedPercentage(speed) {
  return Math.min(100, (Math.abs(speed) / TOP_SPEED) * 100);
}

export function createCarState(playerId, x = 150, y = 380, angle = -Math.PI / 2) {
  return {
    id: playerId,
    x,
    y,
    angle,
    speed: 0,
    velocityX: 0,
    velocityY: 0,
    currentLap: 0,
    isFinished: false,
    inputSequence: 0,
    health: MAX_HEALTH,
  };
}

export function interpolateCarState(from, to, t) {
  t = Math.max(0, Math.min(1, t));

  let angleDiff = to.angle - from.angle;
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

  return {
    ...to,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    angle: normalizeAngle(from.angle + angleDiff * t),
    speed: from.speed + (to.speed - from.speed) * t,
    health: to.health,
  };
}

export default {
  updateCarPhysics,
  handleCollision,
  applyDamage,
  respawnCar,
  isOnTrack,
  isWithinBounds,
  normalizeAngle,
  getDisplaySpeed,
  getSpeedPercentage,
  createCarState,
  interpolateCarState,
  TOP_SPEED,
  MAX_HEALTH,
  TRACK_CONFIG,
  TRACK_BOUNDS,
  STARTING_POSITIONS,
  RESPAWN_POINTS,
};
