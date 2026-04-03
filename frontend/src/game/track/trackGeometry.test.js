import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pointInObb,
  isOnRoad,
  updateForestLapTracking,
  FOREST_SCALE,
} from './trackGeometry.js';

describe('trackGeometry', () => {
  test('pointInObb center', () => {
    assert.equal(pointInObb(0, 0, 0, 0, 0, 100, 50), true);
  });

  test('pointInObb outside', () => {
    assert.equal(pointInObb(200, 0, 0, 0, 0, 100, 50), false);
  });

  test('isOnRoad with mock straight segment', () => {
    const layout = [
      { type: 'road-1', x: 0, y: 0, rot: 0 },
    ];
    const cx = 0 * FOREST_SCALE;
    assert.equal(isOnRoad(cx, 0, layout), true);
  });

  test('updateForestLapTracking needs prev position', () => {
    const layout = [{ type: 'checkpoint', x: 0, y: 0, rot: 0, id: 1 }];
    const car = {
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      currentLap: 0,
      lapNextSectorId: 1,
      isFinished: false,
      passedCheckpoint: false,
      lapFinishCooldown: false,
    };
    assert.equal(updateForestLapTracking(car, 3, layout), null);
  });
});
