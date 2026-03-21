package com.speedarena.controller;

import com.speedarena.config.JwtService;
import com.speedarena.dto.RoomCreateRequest;
import com.speedarena.dto.RoomJoinRequest;
import com.speedarena.dto.RoomResponse;
import com.speedarena.model.User;
import com.speedarena.repository.UserRepository;
import com.speedarena.service.RoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public RoomController(RoomService roomService, JwtService jwtService, UserRepository userRepository) {
        this.roomService = roomService;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    /**
     * Creates a new room.
     * POST /api/rooms/create
     */
    @PostMapping("/create")
    public ResponseEntity<?> createRoom(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody(required = false) RoomCreateRequest request) {
        try {
            User user = getUserFromToken(authHeader);
            String username = request != null && request.getUsername() != null
                    ? request.getUsername()
                    : user.getUsername();

            RoomResponse room = roomService.createRoom(user.getId(), username);
            return ResponseEntity.ok(room);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Joins an existing room.
     * POST /api/rooms/join
     */
    @PostMapping("/join")
    public ResponseEntity<?> joinRoom(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody RoomJoinRequest request) {
        try {
            User user = getUserFromToken(authHeader);
            String username = request.getUsername() != null
                    ? request.getUsername()
                    : user.getUsername();

            RoomResponse room = roomService.joinRoom(request.getRoomCode(), user.getId(), username);
            return ResponseEntity.ok(room);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Gets room information.
     * GET /api/rooms/{roomCode}
     */
    @GetMapping("/{roomCode}")
    public ResponseEntity<?> getRoom(@PathVariable String roomCode) {
        try {
            RoomResponse room = roomService.getRoom(roomCode);
            return ResponseEntity.ok(room);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Leaves a room.
     * POST /api/rooms/{roomCode}/leave
     */
    @PostMapping("/{roomCode}/leave")
    public ResponseEntity<?> leaveRoom(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String roomCode) {
        try {
            User user = getUserFromToken(authHeader);
            roomService.leaveRoom(roomCode, user.getId());
            return ResponseEntity.ok(Map.of("message", "Left room successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Sets player ready status.
     * POST /api/rooms/{roomCode}/ready
     */
    @PostMapping("/{roomCode}/ready")
    public ResponseEntity<?> setReady(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String roomCode,
            @RequestBody Map<String, Boolean> body) {
        try {
            User user = getUserFromToken(authHeader);
            boolean ready = body.getOrDefault("ready", true);
            roomService.setPlayerReady(roomCode, user.getId(), ready);
            return ResponseEntity.ok(Map.of("message", "Ready status updated"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Starts the game (host only).
     * POST /api/rooms/{roomCode}/start
     */
    @PostMapping("/{roomCode}/start")
    public ResponseEntity<?> startGame(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String roomCode) {
        try {
            User user = getUserFromToken(authHeader);
            roomService.startGame(roomCode, user.getId());
            return ResponseEntity.ok(Map.of("message", "Game started"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Extracts user from JWT token.
     */
    private User getUserFromToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("Invalid authorization header");
        }
        String token = authHeader.substring(7);
        String username = jwtService.extractUsername(token);
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
