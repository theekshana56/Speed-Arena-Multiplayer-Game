package com.speedarena.service;

import com.speedarena.dto.CarMoveMessage;
import com.speedarena.engine.CarPhysics;
import com.speedarena.engine.CollisionDetector;
import com.speedarena.engine.LapTracker;
import com.speedarena.engine.WinnerDetector;
import com.speedarena.model.GameState;
import com.speedarena.model.PlayerState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * GameEngineService - The core orchestrator for game logic.
 *
 * Responsibilities:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Manage game rooms and their states
 * 2. Process player inputs (CarMoveMessage)
 * 3. Apply physics updates (CarPhysics)
 * 4. Handle collisions (CollisionDetector)
 * 5. Track laps and detect winners (LapTracker, WinnerDetector)
 * 6. Provide state snapshots for WebSocket broadcast
 *
 * Thread Safety:
 * - Uses ConcurrentHashMap for room storage
 * - GameState internally uses thread-safe structures
 * - Individual player updates should be serialized per-player
 *
 * Flow:
 *   WebSocket Input → processInput() → Physics → Collision → Lap Check → State Update
 */
@Service
public class GameEngineService {

    private static final Logger logger = LoggerFactory.getLogger(GameEngineService.class);

    // ─── Dependencies ───────────────────────────────────────────────────────────

    private final CarPhysics carPhysics;
    private final CollisionDetector collisionDetector;
    private final LapTracker lapTracker;
    private final WinnerDetector winnerDetector;

    // ─── State ──────────────────────────────────────────────────────────────────

    /**
     * Active game rooms.
     * Key: Room ID, Value: GameState
     */
    private final ConcurrentHashMap<String, GameState> rooms = new ConcurrentHashMap<>();

    /**
     * Timestamp of last tick per room (for delta time calculation).
     */
    private final ConcurrentHashMap<String, Long> lastTickTime = new ConcurrentHashMap<>();

    // ─── Starting Positions ─────────────────────────────────────────────────────

    /** Starting grid positions (x, y, angle) for up to 4 players */
    private static final double[][] STARTING_POSITIONS = {
        { 100, 150, Math.PI / 2 },  // Player 1: Left front
        { 100, 200, Math.PI / 2 },  // Player 2: Left back
        { 150, 150, Math.PI / 2 },  // Player 3: Right front
        { 150, 200, Math.PI / 2 }   // Player 4: Right back
    };

    // ─── Constructor ────────────────────────────────────────────────────────────

    public GameEngineService(CarPhysics carPhysics,
                            CollisionDetector collisionDetector,
                            LapTracker lapTracker,
                            WinnerDetector winnerDetector) {
        this.carPhysics = carPhysics;
        this.collisionDetector = collisionDetector;
        this.lapTracker = lapTracker;
        this.winnerDetector = winnerDetector;

        logger.info("GameEngineService initialized");
    }

    // ─── Room Management ────────────────────────────────────────────────────────

    /**
     * Creates a new game room.
     *
     * @param roomId Unique room identifier
     * @return The created GameState
     */
    public GameState createRoom(String roomId) {
        GameState gameState = new GameState(roomId);
        rooms.put(roomId, gameState);
        lastTickTime.put(roomId, System.currentTimeMillis());
        logger.info("Created game room: {}", roomId);
        return gameState;
    }

    /**
     * Gets a game room by ID.
     *
     * @param roomId Room identifier
     * @return GameState or null if not found
     */
    public GameState getRoom(String roomId) {
        return rooms.get(roomId);
    }

    /**
     * Gets or creates a game room.
     *
     * @param roomId Room identifier
     * @return Existing or new GameState
     */
    public GameState getOrCreateRoom(String roomId) {
        return rooms.computeIfAbsent(roomId, this::createRoom);
    }

    /**
     * Removes a game room.
     *
     * @param roomId Room identifier
     */
    public void removeRoom(String roomId) {
        rooms.remove(roomId);
        lastTickTime.remove(roomId);
        lapTracker.resetAll();
        logger.info("Removed game room: {}", roomId);
    }

    /**
     * Gets all active room IDs.
     *
     * @return Set of room IDs
     */
    public Set<String> getActiveRooms() {
        return new HashSet<>(rooms.keySet());
    }

    // ─── Player Management ──────────────────────────────────────────────────────

    /**
     * Adds a player to a room.
     *
     * @param roomId     Room identifier
     * @param playerId   Player identifier
     * @param playerName Display name
     * @param carColor   Car color
     * @return The created PlayerState
     */
    public PlayerState addPlayer(String roomId, String playerId,
                                 String playerName, String carColor) {
        GameState gameState = getOrCreateRoom(roomId);

        // Get starting position based on player count
        int playerIndex = gameState.getPlayerCount();
        double[] startPos = STARTING_POSITIONS[Math.min(playerIndex, STARTING_POSITIONS.length - 1)];

        PlayerState player = new PlayerState(playerId, roomId, startPos[0], startPos[1], startPos[2]);
        player.setPlayerName(playerName);
        player.setCarColor(carColor);

        gameState.addPlayer(player);
        logger.info("Added player {} to room {}", playerId, roomId);

        return player;
    }

    /**
     * Removes a player from a room.
     *
     * @param roomId   Room identifier
     * @param playerId Player identifier
     */
    public void removePlayer(String roomId, String playerId) {
        GameState gameState = getRoom(roomId);
        if (gameState != null) {
            gameState.removePlayer(playerId);
            lapTracker.resetPlayer(playerId);
            logger.info("Removed player {} from room {}", playerId, roomId);

            // Clean up empty rooms
            if (gameState.getPlayerCount() == 0) {
                removeRoom(roomId);
            }
        }
    }

    // ─── Input Processing ───────────────────────────────────────────────────────

    /**
     * Processes a player input message.
     * This is the main entry point called by WebSocket handlers.
     *
     * Flow:
     * 1. Validate input and find player
     * 2. Apply physics based on input
     * 3. Check collisions and correct position
     * 4. Update lap tracking
     * 5. Check for winner
     *
     * @param input The input message from the client
     * @return Updated PlayerState, or null if invalid
     */
    public PlayerState processInput(CarMoveMessage input) {
        if (input == null || input.getPlayerId() == null || input.getRoomId() == null) {
            logger.warn("Invalid input received: {}", input);
            return null;
        }

        GameState gameState = getRoom(input.getRoomId());
        if (gameState == null) {
            logger.warn("Room not found: {}", input.getRoomId());
            return null;
        }

        PlayerState player = gameState.getPlayer(input.getPlayerId());
        if (player == null) {
            logger.warn("Player not found: {} in room {}", input.getPlayerId(), input.getRoomId());
            return null;
        }

        // Don't process inputs for finished players
        if (player.isFinished()) {
            return player;
        }

        // Don't process inputs if race hasn't started
        if (!gameState.isRaceStarted()) {
            return player;
        }

        // Check input sequence (discard out-of-order packets)
        if (input.getInputSequence() <= player.getInputSequence()) {
            // Stale input, skip processing but return current state
            return player;
        }

        // Calculate delta time
        double deltaTime = calculateDeltaTime(input, player);

        // 1. Apply physics
        carPhysics.update(
            player,
            input.isAccelerate(),
            input.isBrake(),
            input.isTurnLeft(),
            input.isTurnRight(),
            deltaTime
        );

        // 2. Check and handle collisions
        CollisionDetector.CollisionResult collision = collisionDetector.checkBoundaryCollision(player);
        if (collision.hasCollision) {
            collisionDetector.applyCollisionCorrection(player, collision);
        }

        // 3. Check car-to-car collisions
        for (PlayerState otherPlayer : gameState.getAllPlayers()) {
            if (!otherPlayer.getId().equals(player.getId())) {
                collisionDetector.handleCarCollision(player, otherPlayer);
            }
        }

        // 4. Update lap tracking
        LapTracker.LapEvent lapEvent = lapTracker.update(player, gameState);
        if (lapEvent == LapTracker.LapEvent.RACE_FINISHED) {
            // 5. Check for winner
            winnerDetector.checkWinner(player, gameState);

            // Check if race is complete
            if (winnerDetector.isRaceComplete(gameState)) {
                winnerDetector.endRace(gameState);
            }
        }

        // Update timestamps
        player.setLastInputTimestamp(input.getTimestamp());
        player.setInputSequence(input.getInputSequence());
        player.setServerTimestamp(System.currentTimeMillis());

        return player;
    }

    /**
     * Calculates delta time for physics simulation.
     * Uses client-provided delta if reasonable, otherwise calculates from server time.
     */
    private double calculateDeltaTime(CarMoveMessage input, PlayerState player) {
        // Try to use client delta time
        if (input.getDeltaTimeMs() > 0 && input.getDeltaTimeMs() < 100) {
            return input.getDeltaTimeMs() / 1000.0;
        }

        // Fall back to server-side calculation
        long lastTimestamp = player.getLastInputTimestamp();
        if (lastTimestamp > 0) {
            long deltaMs = input.getTimestamp() - lastTimestamp;
            // Clamp to reasonable range
            deltaMs = Math.max(8, Math.min(deltaMs, 100)); // 10-125 FPS equivalent
            return deltaMs / 1000.0;
        }

        // Default to 60 FPS
        return 1.0 / 60.0;
    }

    // ─── Race Control ───────────────────────────────────────────────────────────

    /**
     * Starts the countdown for a room.
     *
     * @param roomId Room identifier
     */
    public void startCountdown(String roomId) {
        GameState gameState = getRoom(roomId);
        if (gameState != null) {
            gameState.startCountdown();
            logger.info("Starting countdown in room: {}", roomId);
        }
    }

    /**
     * Starts the race (after countdown).
     *
     * @param roomId Room identifier
     */
    public void startRace(String roomId) {
        GameState gameState = getRoom(roomId);
        if (gameState != null) {
            gameState.startRace();
            lastTickTime.put(roomId, System.currentTimeMillis());
            logger.info("Race started in room: {}", roomId);
        }
    }

    /**
     * Resets a room to pre-race state.
     *
     * @param roomId Room identifier
     */
    public void resetRace(String roomId) {
        GameState gameState = getRoom(roomId);
        if (gameState == null) return;

        // Reset all players to starting positions
        int index = 0;
        for (PlayerState player : gameState.getAllPlayers()) {
            double[] startPos = STARTING_POSITIONS[Math.min(index, STARTING_POSITIONS.length - 1)];
            player.setX(startPos[0]);
            player.setY(startPos[1]);
            player.setAngle(startPos[2]);
            player.setSpeed(0);
            player.setVelocityX(0);
            player.setVelocityY(0);
            player.setCurrentLap(0);
            player.setFinished(false);
            player.setFinishPosition(0);
            player.setFinishTime(0);
            player.setPassedCheckpoint(false);
            index++;
        }

        // Reset tracking
        lapTracker.resetAll();

        // Create new game state (to reset atomic counters)
        GameState newState = new GameState(roomId);
        for (PlayerState player : gameState.getAllPlayers()) {
            newState.addPlayer(player);
        }
        rooms.put(roomId, newState);

        logger.info("Race reset in room: {}", roomId);
    }

    // ─── State Retrieval ────────────────────────────────────────────────────────

    /**
     * Gets a snapshot of all player states in a room.
     * Used for WebSocket broadcast.
     *
     * @param roomId Room identifier
     * @return Map of player ID to state
     */
    public Map<String, PlayerState> getRoomState(String roomId) {
        GameState gameState = getRoom(roomId);
        if (gameState == null) {
            return Collections.emptyMap();
        }
        return new HashMap<>(gameState.getPlayersMap());
    }

    /**
     * Gets a single player's state.
     *
     * @param roomId   Room identifier
     * @param playerId Player identifier
     * @return PlayerState or null
     */
    public PlayerState getPlayerState(String roomId, String playerId) {
        GameState gameState = getRoom(roomId);
        if (gameState == null) return null;
        return gameState.getPlayer(playerId);
    }

    /**
     * Gets the current race results for a room.
     *
     * @param roomId Room identifier
     * @return List of race results
     */
    public List<WinnerDetector.RaceResult> getRaceResults(String roomId) {
        GameState gameState = getRoom(roomId);
        if (gameState == null) {
            return Collections.emptyList();
        }
        return winnerDetector.generateResults(gameState);
    }

    // ─── Track Configuration ────────────────────────────────────────────────────

    /**
     * Configures the track for a specific canvas size.
     * Should be called when setting up a room.
     *
     * @param roomId Canvas/track width in pixels
     * @param width  Canvas width
     * @param height Canvas height
     */
    public void configureTrack(String roomId, int width, int height) {
        GameState gameState = getRoom(roomId);
        if (gameState != null) {
            gameState.setTrackWidth(width);
            gameState.setTrackHeight(height);
        }

        collisionDetector.configureForCanvasSize(width, height);
        lapTracker.configureForTrack(50, height - 50, 50, width - 50);

        logger.info("Configured track for room {} with size {}x{}", roomId, width, height);
    }
}
