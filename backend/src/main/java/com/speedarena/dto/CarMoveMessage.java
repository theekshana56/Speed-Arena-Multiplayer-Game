package com.speedarena.dto;

/**
 * CarMoveMessage - Input DTO received from players via WebSocket.
 *
 * WebSocket Flow:
 *   Client → /app/car.move → GameEngineService → Physics Update → Broadcast
 *
 * This message contains:
 * 1. Player identification (who sent this input)
 * 2. Input state (which keys are pressed)
 * 3. Timing data (for lag compensation and sequencing)
 * 4. Optional client state (for reconciliation)
 */
public class CarMoveMessage {

    // ─── Player Identity ────────────────────────────────────────────────────────

    //player id
    private String playerId;

    /** Room this player is in */
    private String roomId;

    // ─── Input State ────────────────────────────────────────────────────────────

    /**
     * Accelerate input (W or Up arrow).
     * true = key is currently pressed
     */
    private boolean accelerate;

    /**
     * Brake/Reverse input (S or Down arrow).
     * true = key is currently pressed
     */
    private boolean brake;

    /**
     * Turn left input (A or Left arrow).
     * true = key is currently pressed
     */
    private boolean turnLeft;

    /**
     * Turn right input (D or Right arrow).
     * true = key is currently pressed
     */
    private boolean turnRight;

    /** Handbrake (Space) — low grip / tighter turns */
    private boolean handbrake;

    // ─── Timing & Sequencing ────────────────────────────────────────────────────

    /**
     * Client-side timestamp when this input was generated (epoch ms).
     * Used for lag compensation.
     */
    private long timestamp;

    /**
     * Sequential input number.
     * Client increments this for each input packet sent.
     * Used for:
     * 1. Detecting out-of-order packets
     * 2. Client-side reconciliation
     */
    private long inputSequence;

    /**
     * Delta time on client (ms since last input).
     * Useful for server-side smoothing.
     */
    private long deltaTimeMs;

    // ─── Optional Client State (for reconciliation) ─────────────────────────────

    /**
     * Client's predicted X position.
     * Server can compare against authoritative state.
     */
    private double clientX;

    /**
     * Client's predicted Y position.
     */
    private double clientY;

    /**
     * Client's predicted angle.
     */
    private double clientAngle;

    /**
     * Client's predicted speed.
     */
    private double clientSpeed;

    // ─── Constructors ───────────────────────────────────────────────────────────

    /** Default constructor for JSON deserialization */
    public CarMoveMessage() {
        this.timestamp = System.currentTimeMillis();
    }

    /**
     * Convenience constructor for testing.
     */
    public CarMoveMessage(String playerId, String roomId,
                         boolean accelerate, boolean brake,
                         boolean turnLeft, boolean turnRight) {
        this();
        this.playerId = playerId;
        this.roomId = roomId;
        this.accelerate = accelerate;
        this.brake = brake;
        this.turnLeft = turnLeft;
        this.turnRight = turnRight;
    }

    // ─── Utility Methods ────────────────────────────────────────────────────────

    /**
     * Checks if any input is being pressed.
     */
    public boolean hasInput() {
        return accelerate || brake || turnLeft || turnRight || handbrake;
    }

    /**
     * Gets a compact string representation of the input state.
     * Example: "W+A" for accelerate + turn left
     */
    public String getInputString() {
        StringBuilder sb = new StringBuilder();
        if (accelerate) sb.append("W");
        if (brake) sb.append("S");
        if (turnLeft) sb.append("A");
        if (turnRight) sb.append("D");
        return sb.length() > 0 ? sb.toString() : "none";
    }

    // ─── Getters & Setters ──────────────────────────────────────────────────────

    public String getPlayerId() { return playerId; }
    public void setPlayerId(String playerId) { this.playerId = playerId; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public boolean isAccelerate() { return accelerate; }
    public void setAccelerate(boolean accelerate) { this.accelerate = accelerate; }

    public boolean isBrake() { return brake; }
    public void setBrake(boolean brake) { this.brake = brake; }

    public boolean isTurnLeft() { return turnLeft; }
    public void setTurnLeft(boolean turnLeft) { this.turnLeft = turnLeft; }

    public boolean isTurnRight() { return turnRight; }
    public void setTurnRight(boolean turnRight) { this.turnRight = turnRight; }

    public boolean isHandbrake() { return handbrake; }
    public void setHandbrake(boolean handbrake) { this.handbrake = handbrake; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public long getInputSequence() { return inputSequence; }
    public void setInputSequence(long inputSequence) { this.inputSequence = inputSequence; }

    public long getDeltaTimeMs() { return deltaTimeMs; }
    public void setDeltaTimeMs(long deltaTimeMs) { this.deltaTimeMs = deltaTimeMs; }

    public double getClientX() { return clientX; }
    public void setClientX(double clientX) { this.clientX = clientX; }

    public double getClientY() { return clientY; }
    public void setClientY(double clientY) { this.clientY = clientY; }

    public double getClientAngle() { return clientAngle; }
    public void setClientAngle(double clientAngle) { this.clientAngle = clientAngle; }

    public double getClientSpeed() { return clientSpeed; }
    public void setClientSpeed(double clientSpeed) { this.clientSpeed = clientSpeed; }

    @Override
    public String toString() {
        return "CarMoveMessage{" +
                "playerId='" + playerId + '\'' +
                ", input=" + getInputString() +
                ", seq=" + inputSequence +
                '}';
    }
}
