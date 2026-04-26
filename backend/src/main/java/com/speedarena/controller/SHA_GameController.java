package com.speedarena.controller;

import com.speedarena.dto.SHA_CarState;
import com.speedarena.dto.ChatMessage;
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
 *   Frontend sends  →  /app/car.move         → handleCarMove()   → /topic/room/{roomId}/game-state
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
        int lapCount = 3;
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
     * Room clients get:   /topic/room/{roomId}/game-state
     */
    @MessageMapping("/car.move")
    public void handleCarMove(SHA_CarState carState) {
        if (carState == null || carState.getPlayerId() == null || carState.getPlayerId().isBlank()) {
            return;
        }
        // Stamp the server time so clients can detect stale packets
        carState.setTimestamp(System.currentTimeMillis());

        // Store in in-memory map
        String roomId = carState.getRoomId();
        if (roomId == null) roomId = "default";

        gameRooms
            .computeIfAbsent(roomId, k -> new ConcurrentHashMap<>())
            .put(carState.getPlayerId(), carState);

        // Check if this player just finished a lap
        int lapTarget = getLapTarget(roomId);
        if (carState.getLapsCompleted() >= lapTarget && !"FINISHED".equals(carState.getStatus())) {
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
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/game-state", carState);
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
        if (carState == null || carState.getPlayerId() == null || carState.getPlayerId().isBlank()) {
            return;
        }

        String roomId = carState.getRoomId() != null ? carState.getRoomId() : "default";
        carState.setStatus("WAITING");
        carState.setTimestamp(System.currentTimeMillis());

        // Track join order and assign start slot index (0..3)
        List<String> order = roomPlayersOrder.computeIfAbsent(roomId, k -> Collections.synchronizedList(new ArrayList<>()));
        if (!order.contains(carState.getPlayerId())) {
            order.add(carState.getPlayerId());
        }

        // Register player and make joins idempotent (same player can re-publish join safely)
        Map<String, SHA_CarState> room = gameRooms.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());
        SHA_CarState previous = room.put(carState.getPlayerId(), carState);
        boolean isFirstJoin = previous == null;

        if (isFirstJoin) {
            System.out.println("[PLAYER_JOIN] " + carState.getPlayerId() + " joined room: " + roomId);
            // Broadcast join event only on first join to avoid event storms.
            messagingTemplate.convertAndSend("/topic/room/" + roomId, carState);
        }

        // Also send the current list of players in the room to the new joiner
        List<SHA_CarState> currentPlayers = new ArrayList<>(
            room.values()
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
        if (meta != null) {
            Map<String, Object> lapsMsg = new HashMap<>();
            lapsMsg.put("lapCount", meta.lapCount > 0 ? meta.lapCount : 3);
            lapsMsg.put("hostPlayerId", meta.hostPlayerId != null ? meta.hostPlayerId : "");
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/laps", lapsMsg);
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
     * Player leaves room explicitly (e.g., presses TERMINAL/HOME).
     * Keeps remaining players in room without forcing global reset.
     */
    @MessageMapping("/player.leave")
    public void handlePlayerLeave(Map<String, String> payload) {
        if (payload == null) return;
        String roomId = payload.get("roomId");
        String playerId = payload.get("playerId");
        if (roomId == null || roomId.isBlank() || playerId == null || playerId.isBlank()) return;

        Map<String, SHA_CarState> room = gameRooms.get(roomId);
        if (room != null) {
            room.remove(playerId);
            if (room.isEmpty()) {
                gameRooms.remove(roomId);
            }
        }

        List<String> order = roomPlayersOrder.get(roomId);
        if (order != null) {
            order.remove(playerId);
            if (order.isEmpty()) {
                roomPlayersOrder.remove(roomId);
            }
        }

        RoomMeta meta = roomMeta.get(roomId);
        if (meta != null) {
            // If host leaves, promote first remaining player in join order.
            if (meta.hostPlayerId != null && meta.hostPlayerId.equals(playerId)) {
                List<String> remaining = roomPlayersOrder.get(roomId);
                if (remaining != null && !remaining.isEmpty()) {
                    meta.hostPlayerId = remaining.get(0);
                } else {
                    roomMeta.remove(roomId);
                    meta = null;
                }
            }
        }

        publishRoomState(roomId);
        System.out.println("[PLAYER_LEAVE] " + playerId + " left room: " + roomId);
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

    /**
     * Host selects lap count for this room.
     * Payload: { roomId, hostPlayerId | playerId, lapCount }
     */
    @MessageMapping("/room.laps.select")
    public void handleRoomLapsSelect(Map<String, Object> payload) {
        if (payload == null) return;
        Object roomRaw = payload.get("roomId");
        Object hostRaw = payload.get("hostPlayerId") != null ? payload.get("hostPlayerId") : payload.get("playerId");
        Object lapsRaw = payload.get("lapCount");
        if (!(roomRaw instanceof String roomId) || roomId.isBlank()) return;
        if (lapsRaw == null) return;

        int lapCount;
        try {
            lapCount = Integer.parseInt(String.valueOf(lapsRaw));
        } catch (NumberFormatException ex) {
            return;
        }
        if (lapCount != 1 && lapCount != 3 && lapCount != 5) return;

        String hostPlayerId = hostRaw == null ? null : String.valueOf(hostRaw);
        RoomMeta meta = roomMeta.computeIfAbsent(roomId, k -> new RoomMeta());

        if (meta.hostPlayerId == null || meta.hostPlayerId.isBlank()) {
            meta.hostPlayerId = hostPlayerId;
        } else if (hostPlayerId == null || !meta.hostPlayerId.equals(hostPlayerId)) {
            System.out.println("[ROOM_LAPS_SELECT] rejected non-host: " + hostPlayerId + " room=" + roomId);
            return;
        }

        meta.lapCount = lapCount;
        Map<String, Object> msg = new HashMap<>();
        msg.put("lapCount", lapCount);
        msg.put("hostPlayerId", meta.hostPlayerId != null ? meta.hostPlayerId : "");
        System.out.println("[ROOM_LAPS_SELECT] room=" + roomId + " lapCount=" + lapCount + " host=" + meta.hostPlayerId);
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/laps", msg);
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
        if (payload == null) return;
        String roomId = payload.get("roomId");
        String playerId = payload.get("playerId");
        if (roomId != null) {
            RoomMeta meta = roomMeta.get(roomId);
            if (meta == null || meta.mapId == null || meta.mapId.isBlank()) {
                System.out.println("[GAME_START] rejected (no map selected) roomId: " + roomId);
                return;
            }
            if (meta.hostPlayerId != null && !meta.hostPlayerId.isBlank()) {
                if (playerId == null || !meta.hostPlayerId.equals(playerId)) {
                    System.out.println("[GAME_START] rejected non-host: " + playerId + " roomId: " + roomId);
                    return;
                }
            } else if (playerId != null && !playerId.isBlank()) {
                meta.hostPlayerId = playerId;
            }
            long startAt = System.currentTimeMillis() + 3000; // 3 second synchronized countdown
            meta.startAtEpochMs = startAt;

            Map<String, Object> startMsg = new HashMap<>();
            startMsg.put("startAtEpochMs", startAt);
            startMsg.put("mapId", meta.mapId);
            startMsg.put("lapCount", meta.lapCount > 0 ? meta.lapCount : 3);

            System.out.println("[GAME_START] roomId: " + roomId + " startAt=" + startAt + " mapId=" + meta.mapId);
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/start", startMsg);
        }
    }

    /**
     * Resets race state for all players in a room and notifies clients.
     * Frontend can use this to redeploy everyone back to lobby in sync.
     */
    @MessageMapping("/game.reset")
    public void handleGameReset(Map<String, String> payload) {
        if (payload == null) return;
        String roomId = payload.get("roomId");
        if (roomId == null || roomId.isBlank()) return;

        Map<String, SHA_CarState> room = gameRooms.get(roomId);
        long now = System.currentTimeMillis();

        if (room != null) {
            for (SHA_CarState state : room.values()) {
                state.setStatus("WAITING");
                state.setLapsCompleted(0);
                state.setFinishTime(0);
                state.setTotalTime(0);
                state.setTimestamp(now);
            }
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/players", new ArrayList<>(room.values()));
        }

        RoomMeta meta = roomMeta.get(roomId);
        if (meta != null) {
            meta.startAtEpochMs = null;
        }

        Map<String, Object> resetMsg = new HashMap<>();
        resetMsg.put("roomId", roomId);
        resetMsg.put("resetAtEpochMs", now);
        if (meta != null && meta.mapId != null) {
            resetMsg.put("mapId", meta.mapId);
        }
        if (meta != null && meta.lapCount > 0) {
            resetMsg.put("lapCount", meta.lapCount);
        }

        System.out.println("[GAME_RESET] roomId: " + roomId);
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/reset", resetMsg);
    }

    private void publishRoomState(String roomId) {
        Map<String, SHA_CarState> room = gameRooms.get(roomId);
        List<SHA_CarState> currentPlayers = room == null
            ? new ArrayList<>()
            : new ArrayList<>(room.values());
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/players", currentPlayers);

        List<String> order = roomPlayersOrder.get(roomId);
        Map<String, Integer> slots = new HashMap<>();
        if (order != null) {
            for (int i = 0; i < order.size(); i++) {
                slots.put(order.get(i), i);
            }
        }
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/slots", slots);

        RoomMeta meta = roomMeta.get(roomId);
        if (meta != null && meta.mapId != null && !meta.mapId.isBlank()) {
            Map<String, String> msg = new HashMap<>();
            msg.put("mapId", meta.mapId);
            msg.put("hostPlayerId", meta.hostPlayerId != null ? meta.hostPlayerId : "");
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/map", msg);
        }

        if (meta != null) {
            Map<String, Object> lapsMsg = new HashMap<>();
            lapsMsg.put("lapCount", meta.lapCount > 0 ? meta.lapCount : 3);
            lapsMsg.put("hostPlayerId", meta.hostPlayerId != null ? meta.hostPlayerId : "");
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/laps", lapsMsg);
        }
    }

    private int getLapTarget(String roomId) {
        RoomMeta meta = roomMeta.get(roomId);
        if (meta == null) return 3;
        if (meta.lapCount == 1 || meta.lapCount == 3 || meta.lapCount == 5) return meta.lapCount;
        return 3;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Chat — lobby chat before race starts
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Handles chat messages from players in the lobby.
     * Broadcasts to all players in the same room.
     *
     * Frontend sends to:  /app/chat.send
     * Room clients get:   /topic/room/{roomId}/chat
     */
    @MessageMapping("/chat.send")
    public void handleChatMessage(ChatMessage chatMessage) {
        try {
            System.out.println("[CHAT_HANDLER_ENTRY] Method called with: " + (chatMessage == null ? "null" : chatMessage.getClass().getSimpleName()));
            
            if (chatMessage == null) {
                System.err.println("[CHAT_ERROR] Received null chat message");
                return;
            }
            
            String roomId = chatMessage.getRoomId();
            String message = chatMessage.getMessage();
            
            System.out.println("[CHAT_DEBUG] Received: playerId=" + chatMessage.getPlayerId() 
                + ", playerName=" + chatMessage.getPlayerName()
                + ", roomId=" + roomId + ", message=" + message);
            
            if (roomId == null || roomId.isBlank()) {
                System.err.println("[CHAT_ERROR] Missing roomId");
                return;
            }
            
            if (message == null || message.isBlank()) {
                System.err.println("[CHAT_ERROR] Missing message text");
                return;
            }

            chatMessage.setTimestamp(System.currentTimeMillis());
            
            String topicDestination = "/topic/room/" + roomId + "/chat";
            System.out.println("[CHAT_BROADCAST] Sending to " + topicDestination);
            System.out.println("[CHAT_MESSAGE] " + chatMessage);
            
            messagingTemplate.convertAndSend(topicDestination, chatMessage);
            System.out.println("[CHAT_OK] Message broadcasted successfully");
        } catch (Exception e) {
            System.err.println("[CHAT_EXCEPTION] Error in handleChatMessage:");
            e.printStackTrace();
        }
    }


    // ─────────────────────────────────────────────────────────────────────────
    // 6. Helper — get all players in a room (REST-accessible for debugging)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns in-memory game room state.
     * Called internally, but you can expose via a @RestController if needed for debugging.
     */
    public Map<String, SHA_CarState> getPlayersInRoom(String roomId) {
        return gameRooms.getOrDefault(roomId, new ConcurrentHashMap<>());
    }
}