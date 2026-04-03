import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTrack, segmentsIntersect } from './validateTrack.js';
import {
  VERTS_SKETCH_V2_CLEAN,
  START_LINE,
} from './polylineTrack.js';
export { VERTS_SKETCH_V2_CLEAN, START_LINE };

describe('validateTrack', () => {
  test('VERTS_SKETCH_V2_CLEAN passes strict validation', () => {
    assert.equal(validateTrack(VERTS_SKETCH_V2_CLEAN), true);
  });

  test('rejects too few vertices', () => {
    assert.throws(() => validateTrack([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]), /at least 4/);
  });

  test('rejects diagonal segment', () => {
    assert.throws(
      () =>
        validateTrack([
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 0 },
          { x: 1, y: -1 },
        ]),
      /diagonal/,
    );
  });

  test('rejects 180° collinear midpoint on an edge', () => {
    const bad = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    assert.throws(() => validateTrack(bad), /not 90°/);
  });

  test('segmentsIntersect crossing', () => {
    assert.equal(
      segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: -1 }, { x: 1, y: 1 }),
      true,
    );
    assert.equal(
      segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }),
      false,
    );
  });
});
