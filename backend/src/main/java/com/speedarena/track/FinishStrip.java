package com.speedarena.track;

/** Finish line strip for plane-crossing detection. */
public record FinishStrip(double cx, double cy, double rotRad) {

    public boolean containsSlab(double px, double py) {
        return TrackGeometry.pointInObb(px, py, cx, cy, rotRad,
                TrackGeometry.FINISH_HALF_LENGTH, TrackGeometry.FINISH_HALF_WIDTH);
    }
}
