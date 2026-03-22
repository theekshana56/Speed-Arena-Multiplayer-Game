package com.speedarena.dto;

public class RoomJoinRequest {
    private String username;

    public RoomJoinRequest() {}

    public RoomJoinRequest(String username) {
        this.username = username;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
}
