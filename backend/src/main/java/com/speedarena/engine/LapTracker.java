package com.speedarena.engine;

import com.speedarena.model.GameState;
import com.speedarena.model.PlayerState;
import org.springframework.stereotype.Component;

/**
 * LapTracker - Detects lap completions and manages checkpoint progression.
 *
 * Lap Detection Strategy:
 * ─────────────────────────────────────────────────────────────────────────────
 * To prevent "cheating" (crossing finish line backward or shortcutting),
 * we use a checkpoint system:
 *
 * 1. Player must pass through CHECKPOINT (middle of track)
 * 2. Then cross FINISH LINE while moving in correct direction
 * 3. Only then does the lap count increment
 *
 * Track Layout with Checkpoints:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                         FINISH LINE (Y threshold)                    │
 * │  ══════════════════════════════════════════════════════════════════  │
 * │  │                                                                │  │
 * │  │               ↑                                                │  │
 * │  │               │  Racing                                        │  │
 * │  │               │  Direction                                     │  │
 * │  │               │  (counter-clockwise)                           │  │
 * │  │                                                                │  │
 * │  │  ─────────────────────────────────────────────────────────────  │  │
 * │  │                    CHECKPOINT (Y threshold)                    │  │
 * │  │                                                                │  │
 * │  │                                                                │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * └─────────────────────────────────────────────────────────────────────┘
 */
@Component
public class LapTracker {

    // ─── Track Checkpoint Configuration ─────────────────────────────────────────

    /**
     * Finish line Y coordinate (top of track).
     * Crossing this line (from below to above) completes a lap.
     */
    private double finishLineY = 100;

    /**
     * Finish line X boundaries (must cross within this range).
     */
    private double finishLineXStart = 50;
    private double finishLineXEnd = 150;

    /**
     * Checkpoint Y coordinate (bottom half of track).
     * Must cross this before finish line counts.
     */
    private double checkpointY = 500;

    /**
     * Checkpoint X boundaries.
     */
    private double checkpointXStart = 50;
    private double checkpointXEnd = 150;

    /**
     * Direction threshold - velocity Y must be negative (moving up)
     * when crossing finish line.
     */
    private double minCrossingSpeed = 20;

    // ─── State Tracking ─────────────────────────────────────────────────────────

    /**
     * Tracks the previous Y position of each player (to detect line crossing).
     * Key: Player ID, Value: Previous Y position
     */
    private final java.util.Map<String, Double> previousYPositions =
            new java.util.concurrent.ConcurrentHashMap<>();

    // ─── Methods ────────────────────────────────────────────────────────────────

    /**
     * Updates lap tracking for a player.
     * Call this every tick after physics update.
     *
     * @param player The player to check
     * @param gameState The current game state (for lap limit checking)
     * @return LapEvent describing what happened (if anything)
     */
    public LapEvent update(PlayerState player, GameState gameState) {
        String playerId = player.getId();
        double currentY = player.getY();
        double currentX = player.getX();

        // Get previous Y (or set it if first time)
        Double previousY = previousYPositions.get(playerId);
        if (previousY == null) {
            previousYPositions.put(playerId, currentY);
            return LapEvent.NONE;
        }

        // Store current position for next tick
        previousYPositions.put(playerId, currentY);

        // Don't track laps if race hasn't started or player is finished
        if (!gameState.isRaceStarted() || player.isFinished()) {
            return LapEvent.NONE;
        }

        // Check checkpoint crossing (bottom of track)
        if (!player.isPassedCheckpoint()) {
            if (crossedCheckpoint(previousY, currentY, currentX)) {
                player.setPassedCheckpoint(true);
                return LapEvent.CHECKPOINT_PASSED;
            }
        }

        // Check finish line crossing (top of track)
        if (player.isPassedCheckpoint()) {
            if (crossedFinishLine(previousY, currentY, currentX, player.getVelocityY())) {
                // Increment lap
                int newLap = player.getCurrentLap() + 1;
                player.setCurrentLap(newLap);
                player.setPassedCheckpoint(false); // Reset for next lap

                // Check if race is complete
                if (newLap >= GameState.MAX_LAPS) {
                    player.setFinished(true);
                    player.setFinishTime(System.currentTimeMillis());
                    int position = gameState.recordFinish();
                    player.setFinishPosition(position);
                    return LapEvent.RACE_FINISHED;
                }

                return LapEvent.LAP_COMPLETED;
            }
        }

        return LapEvent.NONE;
    }

    /**
     * Checks if the player crossed the checkpoint line.
     * Checkpoint is crossed when moving from above to below the checkpoint Y.
     */
    private boolean crossedCheckpoint(double previousY, double currentY, double currentX) {
        // Check X is within checkpoint bounds
        if (currentX < checkpointXStart || currentX > checkpointXEnd) {
            return false;
        }

        // Check if crossed the line (from above to below)
        // Note: Y increases downward, so "below" means larger Y
        return previousY < checkpointY && currentY >= checkpointY;
    }

    /**
     * Checks if the player crossed the finish line.
     * Finish line is crossed when:
     * 1. Moving from below to above the finish Y
     * 2. X is within finish line bounds
     * 3. Moving upward (velocityY < 0) with minimum speed
     */
    private boolean crossedFinishLine(double previousY, double currentY,
                                       double currentX, double velocityY) {
        // Check X is within finish line bounds
        if (currentX < finishLineXStart || currentX > finishLineXEnd) {
            return false;
        }

        // Check if crossed the line (from below to above)
        // Y decreases when moving up
        boolean crossedLine = previousY > finishLineY && currentY <= finishLineY;

        // Check moving in correct direction (upward)
        boolean correctDirection = velocityY < -minCrossingSpeed;

        return crossedLine && correctDirection;
    }

    /**
     * Resets tracking state for a player (call when player joins/leaves).
     */
    public void resetPlayer(String playerId) {
        previousYPositions.remove(playerId);
    }

    /**
     * Resets all tracking state (call when starting a new race).
     */
    public void resetAll() {
        previousYPositions.clear();
    }

    // ─── Configuration ──────────────────────────────────────────────────────────

    /**
     * Configures finish line position.
     */
    public void setFinishLine(double y, double xStart, double xEnd) {
        this.finishLineY = y;
        this.finishLineXStart = xStart;
        this.finishLineXEnd = xEnd;
    }

    /**
     * Configures checkpoint position.
     */
    public void setCheckpoint(double y, double xStart, double xEnd) {
        this.checkpointY = y;
        this.checkpointXStart = xStart;
        this.checkpointXEnd = xEnd;
    }

    /**
     * Configures both finish line and checkpoint for a track size.
     * Sets finish line at top, checkpoint at bottom.
     */
    public void configureForTrack(double trackTop, double trackBottom,
                                   double trackLeft, double trackRight) {
        // Finish line near top
        this.finishLineY = trackTop + 30;
        this.finishLineXStart = trackLeft;
        this.finishLineXEnd = trackLeft + 120;

        // Checkpoint at bottom half
        this.checkpointY = trackBottom - 100;
        this.checkpointXStart = trackLeft;
        this.checkpointXEnd = trackLeft + 120;
    }

    // ─── Lap Event Enum ─────────────────────────────────────────────────────────

    /**
     * Enum representing lap tracking events.
     */
    public enum LapEvent {
        NONE,              // No event this tick
        CHECKPOINT_PASSED, // Player passed the checkpoint
        LAP_COMPLETED,     // Player completed a lap (but race continues)
        RACE_FINISHED      // Player finished the race (completed all laps)
    }

    // ─── Getters ────────────────────────────────────────────────────────────────

    public double getFinishLineY() { return finishLineY; }
    public double getFinishLineXStart() { return finishLineXStart; }
    public double getFinishLineXEnd() { return finishLineXEnd; }
    public double getCheckpointY() { return checkpointY; }
    public double getCheckpointXStart() { return checkpointXStart; }
    public double getCheckpointXEnd() { return checkpointXEnd; }
}
