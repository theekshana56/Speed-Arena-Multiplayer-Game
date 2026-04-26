package com.speedarena.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * ChatMessage - Data Transfer Object for lobby chat messages.
 * Sent by players in the lobby, broadcast to all players in the same room.
 *
 * WebSocket flow:
 *   Player sends  → /app/chat.send    (carries this object)
 *   Server sends  → /topic/room/{roomId}/chat (broadcasts this object to all in room)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatMessage {

    @JsonProperty("playerId")
    private String playerId;

    @JsonProperty("playerName")
    private String playerName;

    @JsonProperty("roomId")
    private String roomId;

    @JsonProperty("message")
    private String message;

    @JsonProperty("timestamp")
    private long timestamp;

    // ─── Constructors ──────────────────────────────────────────────────────

    public ChatMessage() {
    }

    public ChatMessage(String playerId, String playerName, String roomId, String message) {
        this.playerId = playerId;
        this.playerName = playerName;
        this.roomId = roomId;
        this.message = message;
        this.timestamp = System.currentTimeMillis();
    }

    // ─── Getters & Setters ──────────────────────────────────────────────────

    public String getPlayerId() {
        return playerId;
    }

    public void setPlayerId(String playerId) {
        this.playerId = playerId;
    }

    public String getPlayerName() {
        return playerName;
    }

    public void setPlayerName(String playerName) {
        this.playerName = playerName;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    @Override
    public String toString() {
        return "ChatMessage{" +
                "playerId='" + playerId + '\'' +
                ", playerName='" + playerName + '\'' +
                ", roomId='" + roomId + '\'' +
                ", message='" + message + '\'' +
                ", timestamp=" + timestamp +
                '}';
    }
}
