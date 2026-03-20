package com.speedarena.controller;

import com.speedarena.model.Player;
import com.speedarena.model.Room;
import com.speedarena.service.RoomService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    // ✅ CREATE ROOM
    @PostMapping("/create")
    public Map<String, Object> createRoom() {
        return roomService.createRoom();
    }

    // ✅ JOIN ROOM
    @PostMapping("/join")
    public Map<String, Object> joinRoom(@RequestBody Map<String, String> request) {

        String roomCode = request.get("roomCode");

        if (roomCode == null || roomCode.trim().isEmpty()) {
            throw new RuntimeException("Room code missing ❌");
        }

        roomCode = roomCode.trim().toUpperCase();

        return roomService.joinRoom(roomCode);
    }

    // ✅ GET ROOM (FOR WAITING ROOM)
    @GetMapping("/{roomCode}")
    public Map<String, Object> getRoom(@PathVariable String roomCode) {

        Room room = roomService.getRoom(roomCode);

        if (room == null) {
            throw new RuntimeException("Room not found ❌");
        }

        List<Player> players = room.getPlayers();

        Map<String, Object> response = new HashMap<>();
        response.put("roomCode", room.getRoomCode());
        response.put("players", players);

        return response;
    }
}