package com.speedarena.model;

/**
 * PlayerState - Represents the real-time state of a single player's car.
 *
 * This is the authoritative server-side state that is:
 * 1. Updated by GameEngineService when processing inputs
 * 2. Stored in the thread-safe GameState map
 * 3. Broadcast to all clients via WebSocket
 *
 * Coordinate System:
 * - Origin (0,0) is top-left of the canvas
 * - X increases to the right
 * - Y increases downward
 * - Angle 0 = facing right, 90 = facing down (clockwise positive)
 */
public class PlayerState {

    // ─── Player Identity ────────────────────────────────────────────────────────

    /** Unique identifier for this player session */
    private String id;

    /** Room ID this player belongs to */
    private String roomId;

    /** Display name for leaderboard/HUD */
    private String playerName;

    /** Car color for rendering (e.g., "#FF0000", "red") */
    private String carColor;

    // ─── Position & Movement ────────────────────────────────────────────────────

    /** Current X position on the 2D canvas (in pixels) */
    private double x;

    /** Current Y position on the 2D canvas (in pixels) */
    private double y;

    /**
     * Current facing angle in RADIANS.
     * 0 = facing right (positive X direction)
     * PI/2 = facing down (positive Y direction)
     * PI = facing left
     * 3*PI/2 = facing up
     */
    private double angle;

    /**
     * Current speed in pixels per second.
     * Positive = forward movement, Negative = reverse
     */
    private double speed;

    /**
     * Velocity components for drift physics.
     * These track the actual movement direction which may differ from
     * the car's facing angle during drifts.
     */
    private double velocityX;
    private double velocityY;

    // ─── Race Progress ──────────────────────────────────────────────────────────

    /** Number of complete laps (0 to MAX_LAPS) */
    private int currentLap;

    /** Whether this player has crossed the finish line for the final lap */
    private boolean isFinished;

    /** Finishing position (1st, 2nd, 3rd...) - 0 if not finished */
    private int finishPosition;

    /** Time when player finished (epoch ms) - 0 if not finished */
    private long finishTime;

    /** Tracks if player has crossed the mid-checkpoint (prevents lap cheating) */
    private boolean passedCheckpoint;

    /**
     * Next forest sector id required (1..16), or 17 when all sectors cleared and finish may count.
     */
    private int lapNextSectorId;

    // ─── Input & Timing ─────────────────────────────────────────────────────────

    /**
     * Timestamp of the last input processed from this player.
     * Used for:
     * 1. Ordering inputs to prevent out-of-sequence processing
     * 2. Detecting AFK/disconnected players
     * 3. Client-side reconciliation
     */
    private long lastInputTimestamp;

    /** Server timestamp of last state update (for interpolation) */
    private long serverTimestamp;

    /** Sequence number of last processed input (for reconciliation) */
    private long inputSequence;

    // ─── Constructors ───────────────────────────────────────────────────────────

    /** Default constructor for JSON deserialization */
    public PlayerState() {
        this.currentLap = 0;
        this.isFinished = false;
        this.finishPosition = 0;
        this.passedCheckpoint = false;
        this.lapNextSectorId = 1;
        this.speed = 0;
        this.velocityX = 0;
        this.velocityY = 0;
        this.serverTimestamp = System.currentTimeMillis();
    }

    /**
     * Full constructor for initializing a new player at a starting position.
     *
     * @param id         Unique player identifier
     * @param roomId     Room identifier
     * @param x          Starting X position
     * @param y          Starting Y position
     * @param angle      Starting angle (radians, 0 = facing right)
     */
    public PlayerState(String id, String roomId, double x, double y, double angle) {
        this();
        this.id = id;
        this.roomId = roomId;
        this.x = x;
        this.y = y;
        this.angle = angle;
    }

    /**
     * Creates a deep copy of the player state.
     * Used for thread-safe operations and state history.
     */
    public PlayerState copy() {
        PlayerState copy = new PlayerState();
        copy.id = this.id;
        copy.roomId = this.roomId;
        copy.playerName = this.playerName;
        copy.carColor = this.carColor;
        copy.x = this.x;
        copy.y = this.y;
        copy.angle = this.angle;
        copy.speed = this.speed;
        copy.velocityX = this.velocityX;
        copy.velocityY = this.velocityY;
        copy.currentLap = this.currentLap;
        copy.isFinished = this.isFinished;
        copy.finishPosition = this.finishPosition;
        copy.finishTime = this.finishTime;
        copy.passedCheckpoint = this.passedCheckpoint;
        copy.lapNextSectorId = this.lapNextSectorId;
        copy.lastInputTimestamp = this.lastInputTimestamp;
        copy.serverTimestamp = this.serverTimestamp;
        copy.inputSequence = this.inputSequence;
        return copy;
    }

    // ─── Getters & Setters ──────────────────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getPlayerName() { return playerName; }
    public void setPlayerName(String playerName) { this.playerName = playerName; }

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

    public double getVelocityX() { return velocityX; }
    public void setVelocityX(double velocityX) { this.velocityX = velocityX; }

    public double getVelocityY() { return velocityY; }
    public void setVelocityY(double velocityY) { this.velocityY = velocityY; }

    public int getCurrentLap() { return currentLap; }
    public void setCurrentLap(int currentLap) { this.currentLap = currentLap; }

    public boolean isFinished() { return isFinished; }
    public void setFinished(boolean finished) { isFinished = finished; }

    public int getFinishPosition() { return finishPosition; }
    public void setFinishPosition(int finishPosition) { this.finishPosition = finishPosition; }

    public long getFinishTime() { return finishTime; }
    public void setFinishTime(long finishTime) { this.finishTime = finishTime; }

    public boolean isPassedCheckpoint() { return passedCheckpoint; }
    public void setPassedCheckpoint(boolean passedCheckpoint) { this.passedCheckpoint = passedCheckpoint; }

    public int getLapNextSectorId() { return lapNextSectorId; }
    public void setLapNextSectorId(int lapNextSectorId) { this.lapNextSectorId = lapNextSectorId; }

    public long getLastInputTimestamp() { return lastInputTimestamp; }
    public void setLastInputTimestamp(long lastInputTimestamp) { this.lastInputTimestamp = lastInputTimestamp; }

    public long getServerTimestamp() { return serverTimestamp; }
    public void setServerTimestamp(long serverTimestamp) { this.serverTimestamp = serverTimestamp; }

    public long getInputSequence() { return inputSequence; }
    public void setInputSequence(long inputSequence) { this.inputSequence = inputSequence; }

    @Override
    public String toString() {
        return "PlayerState{" +
                "id='" + id + '\'' +
                ", pos=(" + String.format("%.1f", x) + "," + String.format("%.1f", y) + ")" +
                ", angle=" + String.format("%.2f", Math.toDegrees(angle)) + "deg" +
                ", speed=" + String.format("%.1f", speed) +
                ", lap=" + currentLap +
                ", finished=" + isFinished +
                '}';
    }
}
