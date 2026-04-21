package com.speedarena.dto;

import com.speedarena.model.Room;

import java.util.List;

public class RoomResponse {
    private Long id;
    private String roomCode;
    private String hostUsername;
    private String status;
    private Integer maxPlayers;
    private Integer currentPlayers;
    private List<PlayerInfo> players;

    public RoomResponse() {}

    public RoomResponse(Room room) {
        this.id = room.getId();
        this.roomCode = room.getRoomCode();
        this.hostUsername = room.getHostUsername();
        this.status = room.getStatus();
        this.maxPlayers = room.getMaxPlayers();
        this.currentPlayers = room.getCurrentPlayers();
    }

    // Player info inner class
    public static class PlayerInfo {
        private Long userId;
        private String username;
        private String carColor;
        private Boolean isReady;
        private Boolean isHost;

        public PlayerInfo() {}

        public PlayerInfo(Long userId, String username, String carColor, Boolean isReady, Boolean isHost) {
            this.userId = userId;
            this.username = username;
            this.carColor = carColor;
            this.isReady = isReady;
            this.isHost = isHost;
        }

        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getCarColor() { return carColor; }
        public void setCarColor(String carColor) { this.carColor = carColor; }
        public Boolean getIsReady() { return isReady; }
        public void setIsReady(Boolean isReady) { this.isReady = isReady; }
        public Boolean getIsHost() { return isHost; }
        public void setIsHost(Boolean isHost) { this.isHost = isHost; }
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRoomCode() { return roomCode; }
    public void setRoomCode(String roomCode) { this.roomCode = roomCode; }

    public String getHostUsername() { return hostUsername; }
    public void setHostUsername(String hostUsername) { this.hostUsername = hostUsername; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getMaxPlayers() { return maxPlayers; }
    public void setMaxPlayers(Integer maxPlayers) { this.maxPlayers = maxPlayers; }

    public Integer getCurrentPlayers() { return currentPlayers; }
    public void setCurrentPlayers(Integer currentPlayers) { this.currentPlayers = currentPlayers; }

    public List<PlayerInfo> getPlayers() { return players; }
    public void setPlayers(List<PlayerInfo> players) { this.players = players; }
}
