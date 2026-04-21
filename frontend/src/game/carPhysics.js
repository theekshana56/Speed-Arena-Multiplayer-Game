/**
 * carPhysics.js - Full Forest Track Physics Engine (Corrected Scale)
 */

import {
  FOREST_SCALE,
  isOnRoad as isOnRoadObb,
  updateForestLapTracking,
  getStartPositionsFromLayout,
} from './track/trackGeometry.js';

export { FOREST_SCALE, getStartPositionsFromLayout } from './track/trackGeometry.js';

// ─── Physics Constants ──────────────────────────────────────────────────────

export const TOP_SPEED = 720.0;
export const MAX_REVERSE_SPEED = 250.0;
export const ACCELERATION = 300.0;
export const BRAKE_DECELERATION = 500.0;
export const FRICTION = 2.0;
export const TURN_SPEED = 5.2;
export const MIN_TURN_SPEED = 10.0;
export const GRIP = 4.5;
export const DRIFT_THRESHOLD = 350.0;

export const HANDBRAKE_GRIP = 0.6;
export const HANDBRAKE_DECELERATION = 600.0;
export const HANDBRAKE_TURN_BOOST = 2.5;

export const MAX_HEALTH = 100;

export const STARTING_POSITIONS = [
  { x: 1310, y: 400, angle: Math.PI / 2 },
  { x: 1646, y: 400, angle: Math.PI / 2 },
  { x: 1308, y: 742, angle: Math.PI / 2 },
  { x: 1644, y: 742, angle: Math.PI / 2 },
  { x: 1310, y: 572, angle: Math.PI / 2 },
  { x: 1646, y: 572, angle: Math.PI / 2 },
];

export const LAP_CONFIG = {
  totalLaps: 3,
  detectionRadius: 40 * FOREST_SCALE,
};

export function isNearPoint(carX, carY, pointX, pointY, radius) {
  const dx = carX - pointX;
  const dy = carY - pointY;
  return dx * dx + dy * dy <= radius * radius;
}

export function updateLapTracking(carState, totalLaps = 3, trackLayout = []) {
  return updateForestLapTracking(carState, totalLaps, trackLayout);
}

export function updateCarPhysics(carState, input, deltaTime) {
  deltaTime = Math.min(deltaTime, 0.1);
  let { speed, angle, velocityX = 0, velocityY = 0 } = carState;
  const { accelerate, brake, turnLeft, turnRight, handbrake = false } = input;

  if (handbrake) {
    speed *= Math.pow(0.93, deltaTime * 60);
  } else if (accelerate) {
    speed += ACCELERATION * deltaTime;
    speed = Math.min(speed, TOP_SPEED);
  } else if (brake) {
    if (speed > 0) speed = Math.max(0, speed - BRAKE_DECELERATION * deltaTime);
    else speed = Math.max(-MAX_REVERSE_SPEED, speed - ACCELERATION * 0.5 * deltaTime);
  } else {
    speed *= Math.pow(0.96, deltaTime * 10);
  }

  if (Math.abs(speed) > MIN_TURN_SPEED) {
    const sFactor = Math.min(1.0, Math.abs(speed) / 128.0);
    const tSpeed = TURN_SPEED * sFactor * (handbrake ? HANDBRAKE_TURN_BOOST : 1.0);
    const dir = speed >= 0 ? 1 : -1;
    if (turnLeft) angle -= tSpeed * dir * deltaTime;
    if (turnRight) angle += tSpeed * dir * deltaTime;
  }

  const iVx = Math.cos(angle) * speed;
  const iVy = Math.sin(angle) * speed;
  const grip = handbrake ? HANDBRAKE_GRIP : GRIP;
  const blend = 1.0 - Math.exp(-grip * deltaTime);

  carState.velocityX = (velocityX || 0) + (iVx - (velocityX || 0)) * blend;
  carState.velocityY = (velocityY || 0) + (iVy - (velocityY || 0)) * blend;
  carState.x += carState.velocityX * deltaTime;
  carState.y += carState.velocityY * deltaTime;
  carState.angle = normalizeAngle(angle);
  carState.speed = speed;
}

export function isOnRoad(x, y, trackLayout = []) {
  return isOnRoadObb(x, y, trackLayout);
}

export function handleCollision(carState, trackLayout = []) {
  if (isOnRoad(carState.x, carState.y, trackLayout)) return { collided: false, damage: 0 };
  carState.speed *= Math.pow(0.9, 1);
  return { collided: true, damage: 0.15 };
}

export function applyDamage(carState, damage) {
  carState.health = Math.max(0, (carState.health || MAX_HEALTH) - damage);
  return carState.health <= 0;
}

export function respawnCar(carState, trackLayout = []) {
  const slots = getStartPositionsFromLayout(trackLayout);
  const start = slots[0] || STARTING_POSITIONS[0];
  carState.x = start.x;
  carState.y = start.y;
  carState.angle = start.angle;
  carState.speed = 0;
  carState.velocityX = 0;
  carState.velocityY = 0;
  carState.health = MAX_HEALTH;
}

export function normalizeAngle(angle) {
  angle = angle % (2 * Math.PI);
  if (angle < 0) angle += 2 * Math.PI;
  return angle;
}

export function getDisplaySpeed(speed) {
  return Math.round(Math.abs(speed) * 0.4);
}

export function getSpeedPercentage(speed) {
  return Math.min(100, (Math.abs(speed) / TOP_SPEED) * 100);
}

/**
 * @param {object|null} spawn optional { x, y, angle } world pixels + radians
 */
export function createCarState(playerId, spawn = null) {
  let x;
  let y;
  let angle;
  if (spawn && typeof spawn.x === 'number' && typeof spawn.y === 'number' && typeof spawn.angle === 'number') {
    x = spawn.x;
    y = spawn.y;
    angle = spawn.angle;
  } else {
    const s = STARTING_POSITIONS[Math.floor(Math.random() * STARTING_POSITIONS.length)];
    x = s.x;
    y = s.y;
    angle = s.angle;
  }
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
    health: MAX_HEALTH,
    passedCheckpoint: false,
    lapNextSectorId: 1,
    lapFinishCooldown: false,
  };
}

export function interpolateCarState(from, to, t) {
  t = Math.max(0, Math.min(1, t));
  let aDiff = to.angle - from.angle;
  if (aDiff > Math.PI) aDiff -= 2 * Math.PI;
  if (aDiff < -Math.PI) aDiff += 2 * Math.PI;
  return {
    ...to,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    angle: normalizeAngle(from.angle + aDiff * t),
    speed: from.speed + (to.speed - from.speed) * t,
  };
}

export default {
  updateCarPhysics,
  handleCollision,
  applyDamage,
  respawnCar,
  normalizeAngle,
  getDisplaySpeed,
  getSpeedPercentage,
  createCarState,
  interpolateCarState,
  TOP_SPEED,
  MAX_HEALTH,
  STARTING_POSITIONS,
  FOREST_SCALE,
  updateLapTracking,
  LAP_CONFIG,
  isOnRoad,
  getStartPositionsFromLayout,
};
