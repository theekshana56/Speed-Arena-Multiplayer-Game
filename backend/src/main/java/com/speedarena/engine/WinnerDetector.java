package com.speedarena.engine;

import com.speedarena.model.GameState;
import com.speedarena.model.PlayerState;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * WinnerDetector - Handles race completion, winner declaration, and results.
 *
 * Responsibilities:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Detect when first player finishes 3 laps (WINNER)
 * 2. Track finish positions for all players
 * 3. Handle race end conditions (all finished, time limit, etc.)
 * 4. Generate final race results/standings
 *
 * Events triggered:
 * - WINNER_DECLARED: First player crosses finish line on lap 3
 * - RACE_COMPLETE: All players have finished
 * - RACE_ENDED: Time limit reached (optional)
 */
@Component
public class WinnerDetector {

    // ─── Configuration ──────────────────────────────────────────────────────────

    /**
     * Callback interface for race events.
     */
    public interface RaceEventListener {
        void onWinnerDeclared(String roomId, PlayerState winner);
        void onPlayerFinished(String roomId, PlayerState player, int position);
        void onRaceComplete(String roomId, List<RaceResult> results);
    }

    /** Optional event listener */
    private RaceEventListener eventListener;

    /** Grace period after winner (ms) - how long to wait for others to finish */
    public static final long GRACE_PERIOD_MS = 30_000; // 30 seconds

    // ─── Winner Detection ───────────────────────────────────────────────────────

    /**
     * Checks if a player has won the race.
     * Called after a lap is completed.
     *
     * @param player The player who just completed a lap
     * @param gameState The current game state
     * @return true if this player has won (first to complete all laps)
     */
    public boolean checkWinner(PlayerState player, GameState gameState) {
        if (!player.isFinished()) {
            return false;
        }

        // Try to set this player as the winner
        boolean isWinner = gameState.setWinner(player.getId());

        if (isWinner && eventListener != null) {
            eventListener.onWinnerDeclared(gameState.getRoomId(), player);
        }

        // Notify of player finish regardless
        if (eventListener != null) {
            eventListener.onPlayerFinished(
                gameState.getRoomId(),
                player,
                player.getFinishPosition()
            );
        }

        return isWinner;
    }

    /**
     * Checks if the race is complete (all players finished or time expired).
     *
     * @param gameState The current game state
     * @return true if race should end
     */
    public boolean isRaceComplete(GameState gameState) {
        // Check if all players are finished
        long activeCount = gameState.getAllPlayers().stream()
                .filter(p -> !p.isFinished())
                .count();

        if (activeCount == 0) {
            return true;
        }

        // Check grace period after winner
        if (gameState.hasWinner()) {
            PlayerState winner = gameState.getPlayer(gameState.getWinnerId());
            if (winner != null && winner.getFinishTime() > 0) {
                long elapsed = System.currentTimeMillis() - winner.getFinishTime();
                if (elapsed > GRACE_PERIOD_MS) {
                    return true; // Grace period expired
                }
            }
        }

        return false;
    }

    /**
     * Generates final race results, sorted by finish position.
     *
     * @param gameState The completed game state
     * @return List of race results
     */
    public List<RaceResult> generateResults(GameState gameState) {
        List<RaceResult> results = new ArrayList<>();

        for (PlayerState player : gameState.getAllPlayers()) {
            RaceResult result = new RaceResult();
            result.playerId = player.getId();
            result.playerName = player.getPlayerName();
            result.finished = player.isFinished();
            result.finishPosition = player.getFinishPosition();
            result.lapsCompleted = player.getCurrentLap();

            if (player.isFinished() && player.getFinishTime() > 0) {
                result.finishTimeMs = player.getFinishTime() - gameState.getRaceStartTime();
            } else {
                result.finishTimeMs = -1; // DNF
            }

            result.isWinner = player.getId().equals(gameState.getWinnerId());

            results.add(result);
        }

        // Sort: Finished players first (by position), then by laps completed
        results.sort((a, b) -> {
            if (a.finished && !b.finished) return -1;
            if (!a.finished && b.finished) return 1;
            if (a.finished && b.finished) {
                return Integer.compare(a.finishPosition, b.finishPosition);
            }
            // Both DNF - sort by laps completed
            return Integer.compare(b.lapsCompleted, a.lapsCompleted);
        });

        // Assign positions to DNF players
        int position = results.stream()
                .filter(r -> r.finished)
                .mapToInt(r -> r.finishPosition)
                .max()
                .orElse(0);

        for (RaceResult result : results) {
            if (!result.finished && result.finishPosition == 0) {
                result.finishPosition = ++position;
            }
        }

        return results;
    }

    /**
     * Ends the race and finalizes all states.
     *
     * @param gameState The game state to finalize
     */
    public void endRace(GameState gameState) {
        gameState.endRace();

        // Mark all unfinished players as DNF
        for (PlayerState player : gameState.getAllPlayers()) {
            if (!player.isFinished()) {
                player.setFinished(true);
                int position = gameState.recordFinish();
                player.setFinishPosition(position);
                player.setFinishTime(System.currentTimeMillis());
            }
        }

        // Generate and broadcast results
        if (eventListener != null) {
            List<RaceResult> results = generateResults(gameState);
            eventListener.onRaceComplete(gameState.getRoomId(), results);
        }
    }

    // ─── Result Data Class ──────────────────────────────────────────────────────

    /**
     * Holds final race result for one player.
     */
    public static class RaceResult {
        public String playerId;
        public String playerName;
        public boolean finished;        // false = DNF
        public int finishPosition;      // 1st, 2nd, 3rd...
        public int lapsCompleted;       // 0-3
        public long finishTimeMs;       // Race time in ms (-1 for DNF)
        public boolean isWinner;

        /**
         * Formats the finish time as "MM:SS.mmm"
         */
        public String getFormattedTime() {
            if (finishTimeMs < 0) return "DNF";

            long minutes = finishTimeMs / 60000;
            long seconds = (finishTimeMs % 60000) / 1000;
            long millis = finishTimeMs % 1000;

            return String.format("%02d:%02d.%03d", minutes, seconds, millis);
        }

        /**
         * Gets ordinal suffix (1st, 2nd, 3rd, etc.)
         */
        public String getPositionString() {
            if (finishPosition <= 0) return "—";

            switch (finishPosition) {
                case 1: return "1st";
                case 2: return "2nd";
                case 3: return "3rd";
                default: return finishPosition + "th";
            }
        }

        @Override
        public String toString() {
            return getPositionString() + " - " + playerName +
                   " (" + lapsCompleted + " laps, " + getFormattedTime() + ")";
        }
    }

    // ─── Leaderboard Integration ────────────────────────────────────────────────

    /**
     * Converts race results to a format suitable for leaderboard storage.
     *
     * @param result The race result
     * @param roomId The room ID
     * @return Map of leaderboard data
     */
    public java.util.Map<String, Object> toLeaderboardEntry(RaceResult result, String roomId) {
        java.util.Map<String, Object> entry = new java.util.HashMap<>();
        entry.put("playerId", result.playerId);
        entry.put("playerName", result.playerName);
        entry.put("roomId", roomId);
        entry.put("position", result.finishPosition);
        entry.put("isWinner", result.isWinner);
        entry.put("lapsCompleted", result.lapsCompleted);
        entry.put("finishTimeMs", result.finishTimeMs);
        entry.put("timestamp", System.currentTimeMillis());
        return entry;
    }

    // ─── Setters ────────────────────────────────────────────────────────────────

    public void setEventListener(RaceEventListener listener) {
        this.eventListener = listener;
    }
}
