package com.speedarena.model;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * GameState - Thread-safe wrapper for all game state within a single race/room.
 *
 * Thread Safety Strategy:
 * - ConcurrentHashMap for player states (lock-free reads, fine-grained write locks)
 * - Atomic primitives for race-wide flags and counters
 * - Copy-on-read for external state access to prevent mutation
 *
 * This class is designed to handle concurrent access from:
 * 1. Multiple WebSocket threads processing player inputs
 * 2. The game tick/simulation thread
 * 3. Broadcast threads sending state updates
 */
public class GameState {

    // ─── Constants ──────────────────────────────────────────────────────────────

    /** Maximum number of laps to complete the race */
    public static final int MAX_LAPS = 3;

    /** Default countdown duration in seconds */
    public static final int COUNTDOWN_SECONDS = 3;

    // ─── Room Identity ──────────────────────────────────────────────────────────

    /** Unique identifier for this game room */
    private final String roomId;

    /** Timestamp when this game state was created */
    private final long createdAt;

    // ─── Player States ──────────────────────────────────────────────────────────

    /**
     * Thread-safe map of player ID to their current state.
     * Key: Player ID (String)
     * Value: PlayerState (mutable, but operations on map are thread-safe)
     */
    private final ConcurrentHashMap<String, PlayerState> players;

    // ─── Race Status ────────────────────────────────────────────────────────────

    /**
     * Race phase enum for cleaner state management
     */
    public enum RacePhase {
        WAITING,      // Lobby, waiting for players
        COUNTDOWN,    // Race about to start (3, 2, 1...)
        RACING,       // Race in progress
        FINISHED      // Race complete, showing results
    }

    /** Current race phase (volatile for visibility across threads) */
    private volatile RacePhase racePhase;

    /** Legacy flag for backwards compatibility with existing code */
    private final AtomicBoolean isRaceStarted;

    /** Countdown remaining (seconds) */
    private final AtomicInteger countdownRemaining;

    /** Race start timestamp (epoch ms, 0 if not started) */
    private final AtomicLong raceStartTime;

    /** Tracks how many players have finished (for finish positions) */
    private final AtomicInteger finishedCount;

    /** Whether a winner has been declared */
    private final AtomicBoolean hasWinner;

    /** ID of the winning player (null if no winner yet) */
    private volatile String winnerId;

    // ─── Track Configuration ────────────────────────────────────────────────────

    /** Track width in pixels */
    private int trackWidth = 1200;

    /** Track height in pixels */
    private int trackHeight = 800;

    // ─── Constructors ───────────────────────────────────────────────────────────

    /**
     * Creates a new game state for a room.
     *
     * @param roomId Unique room identifier
     */
    public GameState(String roomId) {
        this.roomId = roomId;
        this.createdAt = System.currentTimeMillis();
        this.players = new ConcurrentHashMap<>();
        this.racePhase = RacePhase.WAITING;
        this.isRaceStarted = new AtomicBoolean(false);
        this.countdownRemaining = new AtomicInteger(COUNTDOWN_SECONDS);
        this.raceStartTime = new AtomicLong(0);
        this.finishedCount = new AtomicInteger(0);
        this.hasWinner = new AtomicBoolean(false);
    }

    // ─── Player Management ──────────────────────────────────────────────────────

    /**
     * Adds or updates a player in the game.
     * Thread-safe: uses ConcurrentHashMap.put
     *
     * @param player The player state to add/update
     */
    public void addPlayer(PlayerState player) {
        if (player != null && player.getId() != null) {
            players.put(player.getId(), player);
        }
    }

    /**
     * Gets a player by ID.
     * Thread-safe: returns the live reference (be careful with mutations)
     *
     * @param playerId Player's unique ID
     * @return PlayerState or null if not found
     */
    public PlayerState getPlayer(String playerId) {
        return players.get(playerId);
    }

    /**
     * Gets a thread-safe copy of a player state.
     * Use this when you need to read state without risking concurrent modification.
     *
     * @param playerId Player's unique ID
     * @return Copy of PlayerState or null if not found
     */
    public PlayerState getPlayerCopy(String playerId) {
        PlayerState player = players.get(playerId);
        return player != null ? player.copy() : null;
    }

    /**
     * Removes a player from the game.
     * Thread-safe: uses ConcurrentHashMap.remove
     *
     * @param playerId Player's unique ID
     * @return The removed PlayerState, or null if not found
     */
    public PlayerState removePlayer(String playerId) {
        return players.remove(playerId);
    }

    /**
     * Checks if a player exists in this game.
     *
     * @param playerId Player's unique ID
     * @return true if player exists
     */
    public boolean hasPlayer(String playerId) {
        return players.containsKey(playerId);
    }

    /**
     * Gets an unmodifiable view of all players.
     * Thread-safe for iteration, but individual PlayerState objects are mutable.
     *
     * @return Collection of all player states
     */
    public Collection<PlayerState> getAllPlayers() {
        return Collections.unmodifiableCollection(players.values());
    }

    /**
     * Gets an unmodifiable view of the player map.
     *
     * @return Map of player ID to PlayerState
     */
    public Map<String, PlayerState> getPlayersMap() {
        return Collections.unmodifiableMap(players);
    }

    /**
     * Gets the number of players in the game.
     *
     * @return Player count
     */
    public int getPlayerCount() {
        return players.size();
    }

    // ─── Race Control ───────────────────────────────────────────────────────────

    /**
     * Starts the race countdown.
     */
    public void startCountdown() {
        this.racePhase = RacePhase.COUNTDOWN;
        this.countdownRemaining.set(COUNTDOWN_SECONDS);
    }

    /**
     * Decrements the countdown and returns true if countdown is complete.
     *
     * @return true if countdown has reached zero
     */
    public boolean tickCountdown() {
        int remaining = countdownRemaining.decrementAndGet();
        if (remaining <= 0) {
            startRace();
            return true;
        }
        return false;
    }

    /**
     * Starts the race. Thread-safe using atomic operations.
     */
    public void startRace() {
        if (isRaceStarted.compareAndSet(false, true)) {
            this.racePhase = RacePhase.RACING;
            this.raceStartTime.set(System.currentTimeMillis());
        }
    }

    /**
     * Ends the race.
     */
    public void endRace() {
        this.racePhase = RacePhase.FINISHED;
    }

    /**
     * Records a player finishing and returns their position.
     *
     * @return The finish position (1st, 2nd, 3rd, etc.)
     */
    public int recordFinish() {
        return finishedCount.incrementAndGet();
    }

    /**
     * Sets the winner of the race.
     * Only succeeds for the first player to finish.
     *
     * @param playerId The winning player's ID
     * @return true if this player is the winner, false if someone else already won
     */
    public boolean setWinner(String playerId) {
        if (hasWinner.compareAndSet(false, true)) {
            this.winnerId = playerId;
            return true;
        }
        return false;
    }

    // ─── Getters ────────────────────────────────────────────────────────────────

    public String getRoomId() { return roomId; }

    public long getCreatedAt() { return createdAt; }

    public RacePhase getRacePhase() { return racePhase; }

    public boolean isRaceStarted() { return isRaceStarted.get(); }

    public int getCountdownRemaining() { return countdownRemaining.get(); }

    public long getRaceStartTime() { return raceStartTime.get(); }

    public int getFinishedCount() { return finishedCount.get(); }

    public boolean hasWinner() { return hasWinner.get(); }

    public String getWinnerId() { return winnerId; }

    public int getTrackWidth() { return trackWidth; }

    public void setTrackWidth(int trackWidth) { this.trackWidth = trackWidth; }

    public int getTrackHeight() { return trackHeight; }

    public void setTrackHeight(int trackHeight) { this.trackHeight = trackHeight; }

    /**
     * Gets the elapsed race time in milliseconds.
     *
     * @return Elapsed time, or 0 if race hasn't started
     */
    public long getElapsedTime() {
        long start = raceStartTime.get();
        if (start == 0) return 0;
        return System.currentTimeMillis() - start;
    }

    @Override
    public String toString() {
        return "GameState{" +
                "roomId='" + roomId + '\'' +
                ", players=" + players.size() +
                ", phase=" + racePhase +
                ", winner=" + winnerId +
                '}';
    }
}
