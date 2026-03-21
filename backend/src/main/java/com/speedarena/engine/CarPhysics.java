package com.speedarena.engine;

import com.speedarena.model.PlayerState;
import org.springframework.stereotype.Component;

/**
 * CarPhysics - High-fidelity 2D car physics engine.
 *
 * Physics Model Overview:
 * ─────────────────────────────────────────────────────────────────────────────
 * This engine simulates realistic car movement using:
 *
 * 1. TRIGONOMETRIC MOVEMENT
 *    - Car position updates based on facing angle using cos/sin
 *    - Movement vector: (cos(angle) * speed, sin(angle) * speed)
 *
 * 2. ACCELERATION & FRICTION
 *    - Gradual speed buildup when accelerating
 *    - Exponential friction decay when coasting
 *    - Separate braking deceleration
 *
 * 3. DRIFT/MOMENTUM (Centrifugal Force Simulation)
 *    - At high speeds, turning causes outward slide
 *    - Velocity has separate X/Y components that blend toward facing direction
 *    - Creates realistic "drifting" feel when cornering fast
 *
 * Coordinate System:
 *   - Angle 0 = facing RIGHT (positive X)
 *   - Angle PI/2 = facing DOWN (positive Y)
 *   - Angles are in RADIANS
 */
@Component
public class CarPhysics {

    // ─── Physics Constants ──────────────────────────────────────────────────────

    /**
     * Maximum forward speed in pixels per second.
     * Equivalent to roughly 200 km/h at game scale.
     */
    public static final double TOP_SPEED = 400.0;

    /**
     * Maximum reverse speed (slower than forward).
     */
    public static final double MAX_REVERSE_SPEED = 150.0;

    /**
     * Acceleration rate in pixels per second squared.
     * Time to reach top speed = TOP_SPEED / ACCELERATION ≈ 2.5 seconds
     */
    public static final double ACCELERATION = 160.0;

    /**
     * Braking deceleration (stronger than friction).
     */
    public static final double BRAKE_DECELERATION = 300.0;

    /**
     * Friction coefficient (0-1). Applied each tick when not accelerating.
     * Creates exponential speed decay: speed *= (1 - FRICTION * deltaTime)
     */
    public static final double FRICTION = 1.5;

    /**
     * Turning speed in radians per second.
     * Full 360° rotation takes: 2*PI / TURN_SPEED ≈ 2.1 seconds
     */
    public static final double TURN_SPEED = 3.0;

    /**
     * Minimum speed required to turn (prevents spinning in place).
     */
    public static final double MIN_TURN_SPEED = 10.0;

    /**
     * Grip factor (0-1). How quickly velocity aligns to facing direction.
     * Lower = more drift, Higher = more grip.
     *
     * At GRIP = 0.1:
     *   - 10% of velocity aligns to facing direction each second
     *   - Creates noticeable drift at high speeds
     */
    public static final double GRIP = 3.0;

    /**
     * Drift threshold - speed above which drift becomes noticeable.
     */
    public static final double DRIFT_THRESHOLD = 150.0;

    /**
     * Centrifugal force multiplier when turning at high speed.
     * Creates outward slide proportional to: turnRate * speed * CENTRIFUGAL_FACTOR
     */
    public static final double CENTRIFUGAL_FACTOR = 0.15;

    // ─── Main Physics Update ────────────────────────────────────────────────────

    /**
     * Updates a player's physics state for one frame.
     *
     * Input Processing:
     *   - accelerate: W or Up arrow held
     *   - brake: S or Down arrow held
     *   - turnLeft: A or Left arrow held
     *   - turnRight: D or Right arrow held
     *
     * @param player    The player state to update (modified in-place)
     * @param accelerate true if accelerating
     * @param brake     true if braking/reversing
     * @param turnLeft  true if turning left
     * @param turnRight true if turning right
     * @param deltaTime Time elapsed since last update in SECONDS
     */
    public void update(PlayerState player, boolean accelerate, boolean brake,
                       boolean turnLeft, boolean turnRight, double deltaTime) {

        // Clamp delta time to prevent physics explosion on lag spikes
        deltaTime = Math.min(deltaTime, 0.1); // Max 100ms per tick

        // Get current state
        double speed = player.getSpeed();
        double angle = player.getAngle();
        double vx = player.getVelocityX();
        double vy = player.getVelocityY();

        // ─── 1. Handle Acceleration/Braking ─────────────────────────────────────

        if (accelerate) {
            // Accelerate forward
            speed += ACCELERATION * deltaTime;
            speed = Math.min(speed, TOP_SPEED);
        } else if (brake) {
            // Braking or reversing
            if (speed > 0) {
                // Braking while moving forward
                speed -= BRAKE_DECELERATION * deltaTime;
                speed = Math.max(speed, 0);
            } else {
                // Reversing (accelerate backwards)
                speed -= ACCELERATION * 0.5 * deltaTime; // Slower reverse acceleration
                speed = Math.max(speed, -MAX_REVERSE_SPEED);
            }
        } else {
            // Coasting - apply friction
            // Exponential decay: speed approaches 0 asymptotically
            speed *= Math.pow(1.0 - FRICTION * 0.1, deltaTime * 10);

            // Stop completely at very low speeds to prevent infinite drift
            if (Math.abs(speed) < 1.0) {
                speed = 0;
            }
        }

        // ─── 2. Handle Turning ──────────────────────────────────────────────────

        double turnRate = 0;

        // Only allow turning if moving fast enough
        if (Math.abs(speed) > MIN_TURN_SPEED) {
            // Turn rate scales with speed (can't turn as sharply at high speed)
            // But we cap it to prevent weird behavior at very low speeds
            double speedFactor = Math.min(1.0, Math.abs(speed) / 100.0);
            double effectiveTurnSpeed = TURN_SPEED * speedFactor;

            // Reverse turning direction when going backwards
            double directionMultiplier = speed >= 0 ? 1.0 : -1.0;

            if (turnLeft) {
                turnRate = -effectiveTurnSpeed * directionMultiplier;
            } else if (turnRight) {
                turnRate = effectiveTurnSpeed * directionMultiplier;
            }

            angle += turnRate * deltaTime;

            // Normalize angle to [0, 2*PI)
            angle = normalizeAngle(angle);
        }

        // ─── 3. Calculate Velocity with Drift Physics ───────────────────────────

        /*
         * Drift Physics Explanation:
         * ─────────────────────────────────────────────────────────────────
         * In a simple physics model, the car would instantly move in its
         * facing direction. But real cars have momentum - when you turn,
         * the car doesn't instantly change direction.
         *
         * We model this with two velocity components:
         * 1. "Intended velocity" - direction the car is facing * speed
         * 2. "Actual velocity" - the current vx/vy
         *
         * The actual velocity gradually blends toward the intended velocity
         * based on the GRIP factor. Lower grip = more slide/drift.
         *
         * Additionally, when turning at high speed, centrifugal force
         * pushes the car outward (perpendicular to facing direction).
         */

        // Calculate intended velocity (where the car "wants" to go)
        double intendedVx = Math.cos(angle) * speed;
        double intendedVy = Math.sin(angle) * speed;

        // Blend actual velocity toward intended (grip simulation)
        // Higher grip = faster alignment to facing direction
        double blendFactor = 1.0 - Math.exp(-GRIP * deltaTime);
        vx = vx + (intendedVx - vx) * blendFactor;
        vy = vy + (intendedVy - vy) * blendFactor;

        // Apply centrifugal force when turning at high speed
        if (Math.abs(speed) > DRIFT_THRESHOLD && turnRate != 0) {
            /*
             * Centrifugal force is perpendicular to facing direction.
             * Perpendicular vector: (-sin(angle), cos(angle)) for left,
             *                       (sin(angle), -cos(angle)) for right
             *
             * Force magnitude scales with turn rate and speed.
             */
            double centrifugalForce = Math.abs(turnRate) * Math.abs(speed) * CENTRIFUGAL_FACTOR;

            // Direction of centrifugal force (opposite to turn direction)
            double centrifugalAngle = angle + (turnRate > 0 ? -Math.PI/2 : Math.PI/2);

            vx += Math.cos(centrifugalAngle) * centrifugalForce * deltaTime;
            vy += Math.sin(centrifugalAngle) * centrifugalForce * deltaTime;
        }

        // ─── 4. Update Position ─────────────────────────────────────────────────

        double newX = player.getX() + vx * deltaTime;
        double newY = player.getY() + vy * deltaTime;

        // ─── 5. Store Updated State ─────────────────────────────────────────────

        player.setX(newX);
        player.setY(newY);
        player.setAngle(angle);
        player.setSpeed(speed);
        player.setVelocityX(vx);
        player.setVelocityY(vy);
        player.setServerTimestamp(System.currentTimeMillis());
    }

    /**
     * Simplified update for when we just have input flags.
     * Assumes a standard tick rate of 60fps (16.67ms per tick).
     */
    public void update(PlayerState player, boolean accelerate, boolean brake,
                       boolean turnLeft, boolean turnRight) {
        update(player, accelerate, brake, turnLeft, turnRight, 1.0 / 60.0);
    }

    // ─── Utility Methods ────────────────────────────────────────────────────────

    /**
     * Normalizes an angle to the range [0, 2*PI).
     *
     * @param angle The angle in radians
     * @return Normalized angle
     */
    public static double normalizeAngle(double angle) {
        angle = angle % (2 * Math.PI);
        if (angle < 0) {
            angle += 2 * Math.PI;
        }
        return angle;
    }

    /**
     * Calculates the difference between two angles (shortest path).
     *
     * @param from Source angle in radians
     * @param to   Target angle in radians
     * @return Signed difference (-PI to PI)
     */
    public static double angleDifference(double from, double to) {
        double diff = normalizeAngle(to - from);
        if (diff > Math.PI) {
            diff -= 2 * Math.PI;
        }
        return diff;
    }

    /**
     * Gets the current speed as a percentage of top speed.
     * Useful for speedometer display.
     *
     * @param speed Current speed
     * @return Percentage (0-100)
     */
    public static double getSpeedPercentage(double speed) {
        return Math.min(100, Math.abs(speed) / TOP_SPEED * 100);
    }

    /**
     * Converts speed from pixels/second to a display-friendly "km/h" value.
     * Scale: 400 pixels/sec = 200 km/h
     *
     * @param speed Speed in pixels per second
     * @return Display speed in "km/h"
     */
    public static int getDisplaySpeed(double speed) {
        return (int) (Math.abs(speed) * 0.5);
    }
}
