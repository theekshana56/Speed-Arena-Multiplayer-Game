package com.speedarena.controller;

import com.speedarena.dto.SHA_CarState;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SHA_GameController — Handles all real-time WebSocket events for Speed Arena.
 *
 * ─── Message Flow (35% scope) ────────────────────────────────────────────────
 *
 *   Frontend sends  →  /app/car.move         → handleCarMove()   → /topic/game-state
 *   Frontend sends  →  /app/player.join      → handlePlayerJoin()→ /topic/room/{roomId}
 *   Frontend sends  →  /app/game.ping        → handlePing()      → /topic/pong
 *
 * ─── What this covers for presentation ──────────────────────────────────────
 *   ✅ Real-time car position broadcast
 *   ✅ Player join notification
 *   ✅ In-memory game state tracking
 *   ✅ Connection health check (ping/pong)
 *   ✅ Basic lap completion detection
 */
@Controller
public class SHA_GameController {

    /**
     * In-memory store: roomId → Map<playerId, SHA_CarState>
     * Tracks all connected players and their last known state.
     * For the 35% demo, this is enough. No DB persistence yet.
     */
    private final Map<String, Map<String, SHA_CarState>> gameRooms = new ConcurrentHashMap<>();

    /**
     * Used to push messages to specific topics manually (outside @SendTo).
     * Injected by Spring automatically.
     */
    private final SimpMessagingTemplate messagingTemplate;

    public SHA_GameController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Car Movement — the core event
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Receives a car position update from one player.
     * Updates in-memory state, then broadcasts to ALL players in that room.
     *
     * Frontend sends to:  /app/car.move
     * All clients get:    /topic/game-state
     *
     * The @SendTo broadcasts the RETURN VALUE to the topic.
     */
    @MessageMapping("/car.move")
    @SendTo("/topic/game-state")
    public SHA_CarState handleCarMove(SHA_CarState carState) {
        // Stamp the server time so clients can detect stale packets
        carState.setTimestamp(System.currentTimeMillis());

        // Store in in-memory map
        String roomId = carState.getRoomId();
        if (roomId == null) roomId = "default";

        gameRooms
            .computeIfAbsent(roomId, k -> new ConcurrentHashMap<>())
            .put(carState.getPlayerId(), carState);

        // Check if this player just finished a lap
        if (carState.getLapsCompleted() >= 3 && !"FINISHED".equals(carState.getStatus())) {
            carState.setStatus("FINISHED");
            
            // Set first-time finish timestamp if not already set in memory
            Map<String, SHA_CarState> room = gameRooms.get(roomId);
            SHA_CarState existing = room != null ? room.get(carState.getPlayerId()) : null;
            if (existing != null && existing.getFinishTime() > 0) {
                carState.setFinishTime(existing.getFinishTime());
            } else {
                carState.setFinishTime(System.currentTimeMillis());
            }

            // Notify room that a winner exists (just send the ID)
            messagingTemplate.convertAndSend(
                "/topic/room/" + roomId + "/winner",
                carState.getPlayerId()
            );
        }


        System.out.println("[CAR_MOVE] " + carState);
        return carState;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Player Join — announces a player to their room
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Called when a player joins a room.
     * Broadcasts to /topic/room/{roomId} so all room members know someone joined.
     *
     * Frontend sends to:  /app/player.join
     * Room clients get:   /topic/room/{roomId}
     */
    @MessageMapping("/player.join")
    public void handlePlayerJoin(SHA_CarState carState) {
        String roomId = carState.getRoomId() != null ? carState.getRoomId() : "default";
        carState.setStatus("WAITING");
        carState.setTimestamp(System.currentTimeMillis());

        // Register the player
        gameRooms
            .computeIfAbsent(roomId, k -> new ConcurrentHashMap<>())
            .put(carState.getPlayerId(), carState);

        System.out.println("[PLAYER_JOIN] " + carState.getPlayerId() + " joined room: " + roomId);

        // Broadcast join event to the room's topic
        messagingTemplate.convertAndSend(
            "/topic/room/" + roomId,
            carState
        );

        // Also send the current list of players in the room to the new joiner
        List<SHA_CarState> currentPlayers = new ArrayList<>(
            gameRooms.get(roomId).values()
        );
        messagingTemplate.convertAndSend(
            "/topic/room/" + roomId + "/players",
            currentPlayers
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Ping / Pong — health check for the presentation demo
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Simple ping handler. Frontend sends a ping, server replies with pong.
     * Used in SHA_TestPanel to confirm WebSocket connection is live.
     *
     * Frontend sends to:  /app/game.ping
     * Client gets:        /topic/pong
     */
    @MessageMapping("/game.ping")
    @SendTo("/topic/pong")
    public String handlePing(String message) {
        System.out.println("[PING] received: " + message);
        return "PONG from server at " + System.currentTimeMillis();
    }

    /**
     * Broadcasts a start signal to all players in a room.
     * Triggered by host.
     */
    @MessageMapping("/game.start")
    public void handleGameStart(Map<String, String> payload) {
        String roomId = payload.get("roomId");
        if (roomId != null) {
            System.out.println("[GAME_START] roomId: " + roomId);
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/start", "START");
        }
    }


    // ─────────────────────────────────────────────────────────────────────────
    // 4. Helper — get all players in a room (REST-accessible for debugging)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns in-memory game room state.
     * Called internally, but you can expose via a @RestController if needed for debugging.
     */
    public Map<String, SHA_CarState> getPlayersInRoom(String roomId) {
        return gameRooms.getOrDefault(roomId, new ConcurrentHashMap<>());
    }
}