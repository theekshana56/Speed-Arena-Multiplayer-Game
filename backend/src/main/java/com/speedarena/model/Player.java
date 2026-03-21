package com.speedarena.model;

import jakarta.persistence.*;

@Entity
@Table(name = "players")
public class Player {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "username", length = 60)
    private String username;

    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Column(name = "room_code", length = 6)
    private String roomCode;

    @Column(name = "car_color", length = 20)
    private String carColor = "#00ff00";

    @Column(name = "is_ready")
    private Boolean isReady = false;

    @Column(name = "is_host")
    private Boolean isHost = false;

    public Player() {}

    public Player(Long userId, String username, Long roomId, String roomCode, boolean isHost) {
        this.userId = userId;
        this.username = username;
        this.roomId = roomId;
        this.roomCode = roomCode;
        this.isHost = isHost;
        this.isReady = false;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public Long getRoomId() { return roomId; }
    public void setRoomId(Long roomId) { this.roomId = roomId; }

    public String getRoomCode() { return roomCode; }
    public void setRoomCode(String roomCode) { this.roomCode = roomCode; }

    public String getCarColor() { return carColor; }
    public void setCarColor(String carColor) { this.carColor = carColor; }

    public Boolean getIsReady() { return isReady; }
    public void setIsReady(Boolean isReady) { this.isReady = isReady; }

    public Boolean getIsHost() { return isHost; }
    public void setIsHost(Boolean isHost) { this.isHost = isHost; }
}
