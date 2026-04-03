package com.speedarena.track;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TrackGeometryTest {

    @Test
    void pointInObb_centerInside() {
        double rot = 0;
        assertTrue(TrackGeometry.pointInObb(10, 5, 0, 0, rot, 50, 20));
    }

    @Test
    void pointInObb_outsideWidth() {
        double rot = 0;
        assertFalse(TrackGeometry.pointInObb(60, 0, 0, 0, rot, 50, 20));
    }

    @Test
    void pointInObb_rotated45() {
        double rot = Math.PI / 4;
        double c = Math.cos(rot);
        double s = Math.sin(rot);
        // Along local X axis from center, half-length 100
        double px = 50 * c;
        double py = 50 * s;
        assertTrue(TrackGeometry.pointInObb(px, py, 0, 0, rot, 100, 30));
    }

    @Test
    void velocityDotNormal_matchesFacing() {
        double rot = 0;
        double vd = TrackGeometry.velocityDotNormal(0, 100, rot);
        assertTrue(vd > 0);
    }
}
