package com.speedarena.dto;

public class RoomCreateRequest {
    private String username;

    public RoomCreateRequest() {}

    public RoomCreateRequest(String username) {
        this.username = username;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
}
