package com.speedarena.model;

import jakarta.persistence.*;

@Entity
public class Player {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String username;

    // ✅ MANY PLAYERS → ONE ROOM
    @ManyToOne
    @JoinColumn(name = "room_id")
    private Room room;

    // getters & setters
    public Long getId() { return id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }
}