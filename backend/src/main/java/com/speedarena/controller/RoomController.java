package com.speedarena.controller;

import com.speedarena.dto.RoomCreateRequest;
import com.speedarena.dto.RoomJoinRequest;
import com.speedarena.dto.RoomResponse;
import com.speedarena.model.Room;
import com.speedarena.service.RoomService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class RoomController {

    private final RoomService roomService;

    @Autowired
    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @PostMapping("/create")
    public ResponseEntity<RoomResponse> createRoom(@RequestBody RoomCreateRequest request) {
        Room room = roomService.createRoom(request);
        return ResponseEntity.ok(new RoomResponse(room));
    }

    @PostMapping("/join/{roomCode}")
    public ResponseEntity<RoomResponse> joinRoom(@PathVariable String roomCode, @RequestBody RoomJoinRequest request) {
        return roomService.joinRoom(roomCode, request)
                .map(room -> ResponseEntity.ok(new RoomResponse(room)))
                .orElse(ResponseEntity.badRequest().build());
    }

    @GetMapping("/{roomCode}")
    public ResponseEntity<RoomResponse> getRoom(@PathVariable String roomCode) {
        return roomService.getRoomByCode(roomCode)
                .map(room -> ResponseEntity.ok(new RoomResponse(room)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/list")
    public ResponseEntity<List<RoomResponse>> listRooms() {
        List<RoomResponse> rooms = roomService.getAllActiveRooms().stream()
                .map(RoomResponse::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(rooms);
    }
}
