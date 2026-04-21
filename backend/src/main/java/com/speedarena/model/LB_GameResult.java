package com.speedarena.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonProperty;


@Entity
@Table(name = "game_results")
public class LB_GameResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "player_id")
    @JsonProperty("playerId")
    private Integer playerId;

    @Column(name = "room_id")
    @JsonProperty("roomId")
    private Integer roomId;

    @Column(name = "position")
    @JsonProperty("position")
    private Integer position;

    @Column(name = "total_time")
    @JsonProperty("totalTime")
    private Double totalTime;


    @Column(name = "top_speed")
    @JsonProperty("topSpeed")
    private Double topSpeed;

    @Column(name = "player_name")
    @JsonProperty("playerName")
    private String playerName;


    @Column(name = "achievements")
    @JsonProperty("achievements")
    private String achievements;




    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public LB_GameResult() {}
    
    //for creating new result
    public LB_GameResult(Long id, Integer playerId, String playerName, Integer roomId, Integer position, Double totalTime, Double topSpeed, String achievements, LocalDateTime createdAt) {
        this.id = id;
        this.playerId = playerId;
        this.playerName = playerName;
        this.roomId = roomId;
        this.position = position;
        this.totalTime = totalTime;
        this.topSpeed = topSpeed;
        this.achievements = achievements;
        this.createdAt = createdAt;
    }


    //getters and setters
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

    public Double getTopSpeed() { return topSpeed; }
    public void setTopSpeed(Double topSpeed) { this.topSpeed = topSpeed; }

    public String getPlayerName() { return playerName; }
    public void setPlayerName(String playerName) { this.playerName = playerName; }

    public String getAchievements() { return achievements; }
    public void setAchievements(String achievements) { this.achievements = achievements; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }


}
