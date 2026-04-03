package com.speedarena.track;

/**
 * Forest track world scale and OBB math — mirrors frontend {@code trackGeometry.js}.
 */
public final class TrackGeometry {

    public static final double FOREST_SCALE = 20.0;
    /** Half length along road strip (world px), matches ~80 Unity units * scale / 2 */
    public static final double ROAD_HALF_LENGTH = 800.0;
    public static final double ROAD_HALF_WIDTH = 350.0;
    /** Radius for sector checkpoint triggers (world px) */
    public static final double CHECKPOINT_TRIGGER_RADIUS = 900.0;
    public static final double FINISH_HALF_LENGTH = 800.0;
    public static final double FINISH_HALF_WIDTH = 380.0;
    public static final double FINISH_CROSS_VEL_DOT_MIN = 28.0;
    public static final int MAX_SECTOR_ID = 16;

    private TrackGeometry() {}

    public static double toWorldX(double jsonX) {
        return jsonX * FOREST_SCALE;
    }

    public static double toWorldY(double jsonY) {
        return jsonY * FOREST_SCALE;
    }

    public static double degreesToRadians(double deg) {
        return Math.toRadians(deg);
    }

    /**
     * Axis-aligned box in local space: |lx| &lt;= halfW, |ly| &lt;= halfH where X is along strip length.
     */
    public static boolean pointInObb(double px, double py, double cx, double cy,
                                       double rotRad, double halfW, double halfH) {
        double dx = px - cx;
        double dy = py - cy;
        double c = Math.cos(-rotRad);
        double s = Math.sin(-rotRad);
        double lx = c * dx - s * dy;
        double ly = s * dx + c * dy;
        return Math.abs(lx) <= halfW && Math.abs(ly) <= halfH;
    }

    public static double signedDistanceAlongNormal(double px, double py, double cx, double cy, double rotRad) {
        double nx = -Math.sin(rotRad);
        double ny = Math.cos(rotRad);
        return (px - cx) * nx + (py - cy) * ny;
    }

    public static double distanceAlongTangent(double px, double py, double cx, double cy, double rotRad) {
        double tx = Math.cos(rotRad);
        double ty = Math.sin(rotRad);
        return (px - cx) * tx + (py - cy) * ty;
    }

    public static double velocityDotNormal(double vx, double vy, double rotRad) {
        double nx = -Math.sin(rotRad);
        double ny = Math.cos(rotRad);
        return vx * nx + vy * ny;
    }
}
