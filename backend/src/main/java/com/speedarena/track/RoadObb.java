package com.speedarena.track;

/** One road sprite as an oriented rectangle in world pixels. */
public record RoadObb(double cx, double cy, double rotRad, double halfLength, double halfWidth) {

    public boolean contains(double px, double py) {
        return TrackGeometry.pointInObb(px, py, cx, cy, rotRad, halfLength, halfWidth);
    }
}
