package com.speedarena.dto;

public class RoomCreateRequest {
    private String hostUsername;
    private Integer maxPlayers;

    public RoomCreateRequest() {}

    public RoomCreateRequest(String hostUsername, Integer maxPlayers) {
        this.hostUsername = hostUsername;
        this.maxPlayers = maxPlayers;
    }

    public String getHostUsername() { return hostUsername; }
    public void setHostUsername(String hostUsername) { this.hostUsername = hostUsername; }

    public Integer getMaxPlayers() { return maxPlayers; }
    public void setMaxPlayers(Integer maxPlayers) { this.maxPlayers = maxPlayers; }
}
