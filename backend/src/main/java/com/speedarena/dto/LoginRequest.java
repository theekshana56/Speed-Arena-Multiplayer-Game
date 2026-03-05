package com.speedarena.dto;

public class LoginRequest {
    private String username; // you can log using username
    private String password;

    public String getUsername() { return username; }
    public String getPassword() { return password; }

    public void setUsername(String username) { this.username = username; }
    public void setPassword(String password) { this.password = password; }
}