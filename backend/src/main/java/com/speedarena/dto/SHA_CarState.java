package com.speedarena.dto;

/**
 * SHA_CarState - Data Transfer Object for real-time car position updates.
 * Sent by each player, broadcast to all players via WebSocket.
 *
 * WebSocket flow:
 *   Player sends  → /app/car.move  (carries this object)
 *   Server sends  → /topic/game-state (broadcasts this object to all)
 */
public class SHA_CarState {

    // ─── Player Identity ──────────────────────────────────────────────────────

    /** Unique player ID (e.g. "player_1", "player_2") */
    private String playerId;

    /** Room the player is in (matches Room entity from Member 1) */
    private String roomId;

    /** Car display color chosen by the player (e.g. "red", "blue") */
    private String carColor;

    // ─── Position & Movement ─────────────────────────────────────────────────

    /** Current X position on the 2D canvas */
    private double x;

    /** Current Y position on the 2D canvas */
    private double y;

    /**
     * Angle in degrees (0 = right, 90 = down).
     * Used by frontend to render car rotation.
     */
    private double angle;

    /** Current speed (pixels per frame, roughly) */
    private double speed;

    // ─── Game Progress ────────────────────────────────────────────────────────

    /** Number of laps completed (win condition = 3 laps) */
    private int lapsCompleted;

    /**
     * Current game status for this player.
     * Values: "WAITING", "RACING", "FINISHED"
     */
    private String status;

    /**
     * Server timestamp (epoch ms) of this update.
     * Useful for the frontend to order/discard stale packets.
     */
    private long timestamp;

    /**
     * Server timestamp of when the player finished the race.
     * Used for ranking players correctly according to finish time.
     */
    private long finishTime;

    /**
     * Total race duration in seconds (e.g. 32.25)
     */
    private double totalTime;

    // ─── Constructors ─────────────────────────────────────────────────────────

    /** Default constructor (required for JSON deserialization by Spring) */
    public SHA_CarState() {
        this.timestamp = System.currentTimeMillis();
        this.finishTime = 0;
        this.totalTime = 0;
        this.status = "WAITING";
        this.lapsCompleted = 0;
    }



    /**
     * Convenience constructor for quick test data.
     * Used in SHA_TestPanel and unit tests.
     */
    public SHA_CarState(String playerId, String roomId, double x, double y, double angle, double speed) {
        this();
        this.playerId = playerId;
        this.roomId = roomId;
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.status = "RACING";
    }

    // ─── Getters & Setters ────────────────────────────────────────────────────

    public String getPlayerId() { return playerId; }
    public void setPlayerId(String playerId) { this.playerId = playerId; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getCarColor() { return carColor; }
    public void setCarColor(String carColor) { this.carColor = carColor; }

    public double getX() { return x; }
    public void setX(double x) { this.x = x; }

    public double getY() { return y; }
    public void setY(double y) { this.y = y; }

    public double getAngle() { return angle; }
    public void setAngle(double angle) { this.angle = angle; }

    public double getSpeed() { return speed; }
    public void setSpeed(double speed) { this.speed = speed; }

    public int getLapsCompleted() { return lapsCompleted; }
    public void setLapsCompleted(int lapsCompleted) { this.lapsCompleted = lapsCompleted; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public long getFinishTime() { return finishTime; }
    public void setFinishTime(long finishTime) { this.finishTime = finishTime; }

    public double getTotalTime() { return totalTime; }
    public void setTotalTime(double totalTime) { this.totalTime = totalTime; }

    @Override
    public String toString() {
        return "SHA_CarState{" +
                "playerId='" + playerId + '\'' +
                ", roomId='" + roomId + '\'' +
                ", x=" + x + ", y=" + y +
                ", angle=" + angle + ", speed=" + speed +
                ", laps=" + lapsCompleted +
                ", status='" + status + '\'' +
                ", finishTime=" + finishTime +
                ", totalTime=" + totalTime +
                '}';
    }


}