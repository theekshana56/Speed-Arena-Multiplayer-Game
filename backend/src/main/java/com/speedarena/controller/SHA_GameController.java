package com.speedarena.controller;

import com.speedarena.dto.SHA_CarState;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
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
     * In-memory room meta: roomId -> {hostPlayerId, mapId}
     * Keeps host-selected map stable for all clients in the room.
     */
    private final Map<String, RoomMeta> roomMeta = new ConcurrentHashMap<>();

    /**
     * Room join order: roomId -> [playerId0, playerId1, ...]
     * Used to assign start grid slots deterministically for real multiplayer players.
     */
    private final Map<String, List<String>> roomPlayersOrder = new ConcurrentHashMap<>();

    /**
     * Used to push messages to specific topics manually (outside @SendTo).
     * Injected by Spring automatically.
     */
    private final SimpMessagingTemplate messagingTemplate;

    private static class RoomMeta {
        String hostPlayerId;
        String mapId;
        Long startAtEpochMs;
    }

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

        // Track join order and assign start slot index (0..3)
        List<String> order = roomPlayersOrder.computeIfAbsent(roomId, k -> Collections.synchronizedList(new ArrayList<>()));
        if (!order.contains(carState.getPlayerId())) {
            order.add(carState.getPlayerId());
        }

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

        // Broadcast slot assignments to the room
        Map<String, Integer> slots = new HashMap<>();
        for (int i = 0; i < order.size(); i++) {
            slots.put(order.get(i), i);
        }
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/slots", slots);

        // If the room already has a selected map, broadcast it (so late joiners sync).
        RoomMeta meta = roomMeta.get(roomId);
        if (meta != null && meta.mapId != null && !meta.mapId.isBlank()) {
            Map<String, String> msg = new HashMap<>();
            msg.put("mapId", meta.mapId);
            msg.put("hostPlayerId", meta.hostPlayerId != null ? meta.hostPlayerId : "");
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/map", msg);
        }

        // If a race has already been started and countdown is in progress, sync start time to late joiners.
        if (meta != null && meta.startAtEpochMs != null && meta.startAtEpochMs > System.currentTimeMillis()) {
            Map<String, Object> startMsg = new HashMap<>();
            startMsg.put("startAtEpochMs", meta.startAtEpochMs);
            startMsg.put("mapId", meta.mapId != null ? meta.mapId : "");
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/start", startMsg);
        }
    }

    /**
     * Host selects the map/scene for this room.
     *
     * Frontend sends to:  /app/room.map.select
     * Room clients get:   /topic/room/{roomId}/map
     *
     * Payload: { roomId, hostPlayerId, mapId }
     */
    @MessageMapping("/room.map.select")
    public void handleRoomMapSelect(Map<String, String> payload) {
        if (payload == null) return;
        String roomId = payload.get("roomId");
        String hostPlayerId = payload.get("hostPlayerId");
        String mapId = payload.get("mapId");
        if (roomId == null || roomId.isBlank() || mapId == null || mapId.isBlank()) return;

        RoomMeta meta = roomMeta.computeIfAbsent(roomId, k -> new RoomMeta());

        // Establish host on first select; enforce thereafter.
        if (meta.hostPlayerId == null || meta.hostPlayerId.isBlank()) {
            meta.hostPlayerId = hostPlayerId;
        } else if (hostPlayerId == null || !meta.hostPlayerId.equals(hostPlayerId)) {
            System.out.println("[ROOM_MAP_SELECT] rejected non-host: " + hostPlayerId + " room=" + roomId);
            return;
        }

        meta.mapId = mapId;

        Map<String, String> msg = new HashMap<>();
        msg.put("mapId", mapId);
        msg.put("hostPlayerId", meta.hostPlayerId != null ? meta.hostPlayerId : "");
        System.out.println("[ROOM_MAP_SELECT] room=" + roomId + " mapId=" + mapId + " host=" + meta.hostPlayerId);
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/map", msg);
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
            RoomMeta meta = roomMeta.get(roomId);
            if (meta == null || meta.mapId == null || meta.mapId.isBlank()) {
                System.out.println("[GAME_START] rejected (no map selected) roomId: " + roomId);
                return;
            }
            long startAt = System.currentTimeMillis() + 3000; // 3 second synchronized countdown
            meta.startAtEpochMs = startAt;

            Map<String, Object> startMsg = new HashMap<>();
            startMsg.put("startAtEpochMs", startAt);
            startMsg.put("mapId", meta.mapId);

            System.out.println("[GAME_START] roomId: " + roomId + " startAt=" + startAt + " mapId=" + meta.mapId);
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/start", startMsg);
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