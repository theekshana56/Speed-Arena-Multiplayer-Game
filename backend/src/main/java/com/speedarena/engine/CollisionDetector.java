package com.speedarena.engine;

import com.speedarena.model.PlayerState;
import org.springframework.stereotype.Component;

/**
 * CollisionDetector - Handles all collision detection for the racing game.
 *
 * Detection Types:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. BOUNDARY COLLISION - Player leaving the track bounds
 * 2. CAR-TO-CAR COLLISION - Two players colliding (optional)
 * 3. TRACK WALL COLLISION - Collision with inner track obstacles
 *
 * Track Layout:
 * ┌────────────────────────────────────────────────────────────────────┐
 * │  OUTER BOUNDARY (grass/wall)                                        │
 * │  ┌────────────────────────────────────────────────────────────────┐ │
 * │  │                                                                │ │
 * │  │   ┌──────────────────────────────────────────────────────┐    │ │
 * │  │   │                  INNER INFIELD                        │    │ │
 * │  │   │                  (non-drivable)                       │    │ │
 * │  │   │                                                       │    │ │
 * │  │   └──────────────────────────────────────────────────────┘    │ │
 * │  │                                                                │ │
 * │  │   ←────────── TRACK (safe zone) ──────────→                   │ │
 * │  └────────────────────────────────────────────────────────────────┘ │
 * │                                                                      │
 * └────────────────────────────────────────────────────────────────────┘
 */
@Component
public class CollisionDetector {

    // ─── Track Configuration ────────────────────────────────────────────────────

    /** Outer track boundary (total canvas size) */
    private double outerLeft = 50;
    private double outerTop = 50;
    private double outerRight = 1150;
    private double outerBottom = 750;

    /** Inner infield boundary (non-drivable center area) */
    private double innerLeft = 200;
    private double innerTop = 200;
    private double innerRight = 1000;
    private double innerBottom = 600;

    /** Car hitbox dimensions (for collision calculations) */
    public static final double CAR_WIDTH = 40;
    public static final double CAR_HEIGHT = 20;

    /** Speed penalty when hitting a wall */
    public static final double WALL_BOUNCE_FACTOR = 0.3;

    /** Push-back distance when colliding */
    public static final double COLLISION_PUSHBACK = 5.0;

    // ─── Boundary Collision Detection ───────────────────────────────────────────

    /**
     * Checks if a player is within the valid track boundaries.
     * The track is a rectangular "donut" shape - valid area is between
     * the outer boundary and inner infield.
     *
     * @param player The player to check
     * @return true if player is within bounds, false if out of bounds
     */
    public boolean isWithinBounds(PlayerState player) {
        double x = player.getX();
        double y = player.getY();

        // Check outer boundary (must be inside)
        boolean insideOuter = x >= outerLeft && x <= outerRight &&
                              y >= outerTop && y <= outerBottom;

        // Check inner boundary (must be outside)
        boolean outsideInner = x < innerLeft || x > innerRight ||
                               y < innerTop || y > innerBottom;

        return insideOuter && outsideInner;
    }

    /**
     * Checks if a position is within track bounds.
     * Overloaded method for coordinate-based checks.
     *
     * @param x X coordinate
     * @param y Y coordinate
     * @return true if within bounds
     */
    public boolean isWithinBounds(double x, double y) {
        boolean insideOuter = x >= outerLeft && x <= outerRight &&
                              y >= outerTop && y <= outerBottom;

        boolean outsideInner = x < innerLeft || x > innerRight ||
                               y < innerTop || y > innerBottom;

        return insideOuter && outsideInner;
    }

    /**
     * Detailed collision result with collision type and correction vector.
     */
    public static class CollisionResult {
        public boolean hasCollision;
        public CollisionType type;
        public double correctionX;
        public double correctionY;
        public double newSpeed;

        public enum CollisionType {
            NONE,
            OUTER_LEFT,
            OUTER_RIGHT,
            OUTER_TOP,
            OUTER_BOTTOM,
            INNER_LEFT,
            INNER_RIGHT,
            INNER_TOP,
            INNER_BOTTOM
        }

        public CollisionResult() {
            this.hasCollision = false;
            this.type = CollisionType.NONE;
            this.correctionX = 0;
            this.correctionY = 0;
            this.newSpeed = 0;
        }
    }

    /**
     * Performs detailed boundary collision detection and returns correction data.
     * This is the main method called by the game engine.
     *
     * @param player The player state to check
     * @return CollisionResult with correction data if collision occurred
     */
    public CollisionResult checkBoundaryCollision(PlayerState player) {
        CollisionResult result = new CollisionResult();
        double x = player.getX();
        double y = player.getY();
        double speed = player.getSpeed();

        // Half dimensions for hitbox calculations
        double halfWidth = CAR_WIDTH / 2;
        double halfHeight = CAR_HEIGHT / 2;

        // Check outer boundaries
        if (x - halfWidth < outerLeft) {
            result.hasCollision = true;
            result.type = CollisionResult.CollisionType.OUTER_LEFT;
            result.correctionX = outerLeft + halfWidth + COLLISION_PUSHBACK;
            result.correctionY = y;
            result.newSpeed = -speed * WALL_BOUNCE_FACTOR;
        } else if (x + halfWidth > outerRight) {
            result.hasCollision = true;
            result.type = CollisionResult.CollisionType.OUTER_RIGHT;
            result.correctionX = outerRight - halfWidth - COLLISION_PUSHBACK;
            result.correctionY = y;
            result.newSpeed = -speed * WALL_BOUNCE_FACTOR;
        } else if (y - halfHeight < outerTop) {
            result.hasCollision = true;
            result.type = CollisionResult.CollisionType.OUTER_TOP;
            result.correctionX = x;
            result.correctionY = outerTop + halfHeight + COLLISION_PUSHBACK;
            result.newSpeed = -speed * WALL_BOUNCE_FACTOR;
        } else if (y + halfHeight > outerBottom) {
            result.hasCollision = true;
            result.type = CollisionResult.CollisionType.OUTER_BOTTOM;
            result.correctionX = x;
            result.correctionY = outerBottom - halfHeight - COLLISION_PUSHBACK;
            result.newSpeed = -speed * WALL_BOUNCE_FACTOR;
        }

        // Check inner boundary collision (hitting the infield)
        if (!result.hasCollision) {
            boolean inInfieldX = x > innerLeft && x < innerRight;
            boolean inInfieldY = y > innerTop && y < innerBottom;

            if (inInfieldX && inInfieldY) {
                // Player is inside the infield, push them out
                // Find the closest edge to push toward

                double distToLeft = x - innerLeft;
                double distToRight = innerRight - x;
                double distToTop = y - innerTop;
                double distToBottom = innerBottom - y;

                double minDist = Math.min(Math.min(distToLeft, distToRight),
                                          Math.min(distToTop, distToBottom));

                result.hasCollision = true;
                result.newSpeed = -speed * WALL_BOUNCE_FACTOR;

                if (minDist == distToLeft) {
                    result.type = CollisionResult.CollisionType.INNER_LEFT;
                    result.correctionX = innerLeft - halfWidth - COLLISION_PUSHBACK;
                    result.correctionY = y;
                } else if (minDist == distToRight) {
                    result.type = CollisionResult.CollisionType.INNER_RIGHT;
                    result.correctionX = innerRight + halfWidth + COLLISION_PUSHBACK;
                    result.correctionY = y;
                } else if (minDist == distToTop) {
                    result.type = CollisionResult.CollisionType.INNER_TOP;
                    result.correctionX = x;
                    result.correctionY = innerTop - halfHeight - COLLISION_PUSHBACK;
                } else {
                    result.type = CollisionResult.CollisionType.INNER_BOTTOM;
                    result.correctionX = x;
                    result.correctionY = innerBottom + halfHeight + COLLISION_PUSHBACK;
                }
            }
        }

        return result;
    }

    /**
     * Applies collision correction to a player state.
     * Call this after checkBoundaryCollision if hasCollision is true.
     *
     * @param player The player to correct
     * @param result The collision result with correction data
     */
    public void applyCollisionCorrection(PlayerState player, CollisionResult result) {
        if (!result.hasCollision) return;

        player.setX(result.correctionX);
        player.setY(result.correctionY);
        player.setSpeed(result.newSpeed);

        // Also reduce velocity momentum in the collision direction
        if (result.type.name().contains("LEFT") || result.type.name().contains("RIGHT")) {
            player.setVelocityX(-player.getVelocityX() * WALL_BOUNCE_FACTOR);
        } else {
            player.setVelocityY(-player.getVelocityY() * WALL_BOUNCE_FACTOR);
        }
    }

    // ─── Car-to-Car Collision ───────────────────────────────────────────────────

    /**
     * Checks if two players are colliding.
     * Uses circle-based collision for simplicity.
     *
     * @param player1 First player
     * @param player2 Second player
     * @return true if the players are colliding
     */
    public boolean areColliding(PlayerState player1, PlayerState player2) {
        double dx = player1.getX() - player2.getX();
        double dy = player1.getY() - player2.getY();
        double distance = Math.sqrt(dx * dx + dy * dy);

        // Collision radius (approximate circle around car)
        double collisionRadius = (CAR_WIDTH + CAR_HEIGHT) / 2;

        return distance < collisionRadius;
    }

    /**
     * Handles collision between two cars.
     * Applies push-apart forces to both players.
     *
     * @param player1 First player
     * @param player2 Second player
     */
    public void handleCarCollision(PlayerState player1, PlayerState player2) {
        if (!areColliding(player1, player2)) return;

        double dx = player2.getX() - player1.getX();
        double dy = player2.getY() - player1.getY();
        double distance = Math.sqrt(dx * dx + dy * dy);

        if (distance == 0) {
            // Edge case: exact same position, push apart randomly
            dx = 1;
            dy = 0;
            distance = 1;
        }

        // Normalize direction
        dx /= distance;
        dy /= distance;

        // Push both cars apart
        double pushDistance = COLLISION_PUSHBACK;
        player1.setX(player1.getX() - dx * pushDistance);
        player1.setY(player1.getY() - dy * pushDistance);
        player2.setX(player2.getX() + dx * pushDistance);
        player2.setY(player2.getY() + dy * pushDistance);

        // Reduce both players' speeds on collision
        player1.setSpeed(player1.getSpeed() * 0.7);
        player2.setSpeed(player2.getSpeed() * 0.7);
    }

    // ─── Track Configuration Setters ────────────────────────────────────────────

    /**
     * Configures the outer track boundary.
     */
    public void setOuterBoundary(double left, double top, double right, double bottom) {
        this.outerLeft = left;
        this.outerTop = top;
        this.outerRight = right;
        this.outerBottom = bottom;
    }

    /**
     * Configures the inner infield boundary.
     */
    public void setInnerBoundary(double left, double top, double right, double bottom) {
        this.innerLeft = left;
        this.innerTop = top;
        this.innerRight = right;
        this.innerBottom = bottom;
    }

    /**
     * Configures track for a given canvas size.
     * Creates a proportional track layout.
     *
     * @param canvasWidth  Canvas width in pixels
     * @param canvasHeight Canvas height in pixels
     */
    public void configureForCanvasSize(int canvasWidth, int canvasHeight) {
        // Outer boundary with margin
        double margin = 50;
        this.outerLeft = margin;
        this.outerTop = margin;
        this.outerRight = canvasWidth - margin;
        this.outerBottom = canvasHeight - margin;

        // Inner infield (centered, taking up about 60% of track area)
        double innerMargin = canvasWidth * 0.15;
        this.innerLeft = outerLeft + innerMargin;
        this.innerTop = outerTop + innerMargin;
        this.innerRight = outerRight - innerMargin;
        this.innerBottom = outerBottom - innerMargin;
    }

    // ─── Getters ────────────────────────────────────────────────────────────────

    public double getOuterLeft() { return outerLeft; }
    public double getOuterTop() { return outerTop; }
    public double getOuterRight() { return outerRight; }
    public double getOuterBottom() { return outerBottom; }
    public double getInnerLeft() { return innerLeft; }
    public double getInnerTop() { return innerTop; }
    public double getInnerRight() { return innerRight; }
    public double getInnerBottom() { return innerBottom; }
}
