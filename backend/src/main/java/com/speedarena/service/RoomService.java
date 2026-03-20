package com.speedarena.service;

import com.speedarena.model.Player;
import com.speedarena.model.Room;
import com.speedarena.repository.PlayerRepository;
import com.speedarena.repository.RoomRepository;
import com.speedarena.util.RoomCodeGenerator;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final PlayerRepository playerRepository;

    public RoomService(RoomRepository roomRepository, PlayerRepository playerRepository) {
        this.roomRepository = roomRepository;
        this.playerRepository = playerRepository;
    }

    // ✅ CREATE ROOM + ADD CREATOR
    public Map<String, Object> createRoom() {

        String code = RoomCodeGenerator.generateCode();

        Room room = new Room();
        room.setRoomCode(code);
        roomRepository.save(room);

        // ✅ ADD CREATOR AS PLAYER 1
        Player player = new Player();
        player.setUsername("Player1");
        player.setRoom(room);
        playerRepository.save(player);

        // ✅ RELOAD ROOM WITH PLAYERS
        Room updatedRoom = roomRepository.findWithPlayers(code);

        Map<String, Object> response = new HashMap<>();
        response.put("roomCode", updatedRoom.getRoomCode());
        response.put("players", updatedRoom.getPlayers());

        return response;
    }

    // ✅ JOIN ROOM
    public Map<String, Object> joinRoom(String code) {

        code = code.trim().toUpperCase();

        Room room = roomRepository.findWithPlayers(code);

        if (room == null) {
            throw new RuntimeException("Room not found ❌");
        }

        List<Player> players = room.getPlayers();

        if (players.size() >= 4) {
            throw new RuntimeException("Room is full ❌");
        }

        Player player = new Player();
        player.setUsername("Player" + (players.size() + 1));
        player.setRoom(room);
        playerRepository.save(player);

        // ✅ RELOAD ROOM AGAIN WITH PLAYERS
        Room updatedRoom = roomRepository.findWithPlayers(code);

        Map<String, Object> response = new HashMap<>();
        response.put("roomCode", updatedRoom.getRoomCode());
        response.put("players", updatedRoom.getPlayers());

        return response;
    }

    // ✅ GET ROOM
    public Room getRoom(String code) {
        return roomRepository.findWithPlayers(code.trim().toUpperCase());
    }
}