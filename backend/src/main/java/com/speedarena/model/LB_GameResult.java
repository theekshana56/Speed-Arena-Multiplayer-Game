package com.speedarena.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "game_results")
public class LB_GameResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "player_id")
    private Integer playerId;

    @Column(name = "room_id")
    private Integer roomId;

    @Column(name = "position")
    private Integer position;

    @Column(name = "total_time")
    private Double totalTime;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public LB_GameResult() {}

    public LB_GameResult(Long id, Integer playerId, Integer roomId, Integer position, Double totalTime, LocalDateTime createdAt) {
        this.id = id;
        this.playerId = playerId;
        this.roomId = roomId;
        this.position = position;
        this.totalTime = totalTime;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Integer getPlayerId() { return playerId; }
    public void setPlayerId(Integer playerId) { this.playerId = playerId; }

    public Integer getRoomId() { return roomId; }
    public void setRoomId(Integer roomId) { this.roomId = roomId; }

    public Integer getPosition() { return position; }
    public void setPosition(Integer position) { this.position = position; }

    public Double getTotalTime() { return totalTime; }
    public void setTotalTime(Double totalTime) { this.totalTime = totalTime; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
