package com.speedarena.engine;

import com.speedarena.model.GameState;
import com.speedarena.model.PlayerState;
import com.speedarena.track.FinishStrip;
import com.speedarena.track.TrackGeometry;
import com.speedarena.track.TrackLayoutService;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Forest track laps: sequential sectors 1..16 then directed finish crossing (primary finish strip).
 */
@Component
public class LapTracker {

    private static final int ARMED_SECTOR = TrackGeometry.MAX_SECTOR_ID + 1;

    private final TrackLayoutService track;

    private final Map<String, Double> prevX = new ConcurrentHashMap<>();
    private final Map<String, Double> prevY = new ConcurrentHashMap<>();
    private final Map<String, Boolean> finishCooldown = new ConcurrentHashMap<>();

    public LapTracker(TrackLayoutService track) {
        this.track = track;
    }

    public LapEvent update(PlayerState player, GameState gameState) {
        String playerId = player.getId();
        double x = player.getX();
        double y = player.getY();
        double vx = player.getVelocityX();
        double vy = player.getVelocityY();

        Double px = prevX.get(playerId);
        Double py = prevY.get(playerId);
        prevX.put(playerId, x);
        prevY.put(playerId, y);

        if (px == null || py == null) {
            return LapEvent.NONE;
        }

        if (!gameState.isRaceStarted() || player.isFinished()) {
            return LapEvent.NONE;
        }

        if (Boolean.TRUE.equals(finishCooldown.get(playerId))) {
            FinishStrip primary = track.getPrimaryFinish();
            boolean stillInside = primary != null && primary.containsSlab(x, y);
            if (!stillInside) {
                finishCooldown.put(playerId, false);
            }
            return LapEvent.NONE;
        }

        int next = player.getLapNextSectorId();
        if (next < 1) {
            next = 1;
            player.setLapNextSectorId(1);
        }

        // Sequential sectors 1 .. MAX_SECTOR_ID
        if (next >= 1 && next <= TrackGeometry.MAX_SECTOR_ID) {
            if (track.isNearSector(x, y, next)) {
                int n = next + 1;
                player.setLapNextSectorId(n);
                if (n == ARMED_SECTOR) {
                    player.setPassedCheckpoint(true);
                    return LapEvent.CHECKPOINT_PASSED;
                }
            }
        }

        // Armed: all sectors cleared
        if (player.getLapNextSectorId() == ARMED_SECTOR) {
            LapEvent cross = tryFinishCrossing(player, gameState, px, py, x, y, vx, vy);
            if (cross != LapEvent.NONE) {
                return cross;
            }
        }

        return LapEvent.NONE;
    }

    private LapEvent tryFinishCrossing(PlayerState player, GameState gameState,
                                       double prevx, double prevy, double x, double y,
                                       double vx, double vy) {
        FinishStrip strip = track.getPrimaryFinish();
        if (strip == null) {
            return LapEvent.NONE;
        }

        double rot = strip.rotRad();
        double cx = strip.cx();
        double cy = strip.cy();

        double sdPrev = TrackGeometry.signedDistanceAlongNormal(prevx, prevy, cx, cy, rot);
        double sdCurr = TrackGeometry.signedDistanceAlongNormal(x, y, cx, cy, rot);
        double tCurr = TrackGeometry.distanceAlongTangent(x, y, cx, cy, rot);
        double tPrev = TrackGeometry.distanceAlongTangent(prevx, prevy, cx, cy, rot);

        boolean inSlab = strip.containsSlab(x, y);
        boolean wasInSlab = strip.containsSlab(prevx, prevy);

        boolean crossedPlane = sdPrev * sdCurr < 0;
        boolean alongOk = Math.abs(tCurr) <= TrackGeometry.FINISH_HALF_LENGTH
                && Math.abs(tPrev) <= TrackGeometry.FINISH_HALF_LENGTH;
        double vDot = TrackGeometry.velocityDotNormal(vx, vy, rot);

        if (!crossedPlane || !alongOk) {
            return LapEvent.NONE;
        }
        if (vDot < TrackGeometry.FINISH_CROSS_VEL_DOT_MIN) {
            return LapEvent.NONE;
        }
        if (!inSlab && !wasInSlab) {
            return LapEvent.NONE;
        }

        int newLap = player.getCurrentLap() + 1;
        player.setCurrentLap(newLap);
        player.setLapNextSectorId(1);
        player.setPassedCheckpoint(false);
        finishCooldown.put(player.getId(), true);

        if (newLap >= GameState.MAX_LAPS) {
            player.setFinished(true);
            player.setFinishTime(System.currentTimeMillis());
            int position = gameState.recordFinish();
            player.setFinishPosition(position);
            return LapEvent.RACE_FINISHED;
        }

        return LapEvent.LAP_COMPLETED;
    }

    public void resetPlayer(String playerId) {
        prevX.remove(playerId);
        prevY.remove(playerId);
        finishCooldown.remove(playerId);
    }

    public void resetAll() {
        prevX.clear();
        prevY.clear();
        finishCooldown.clear();
    }

    public enum LapEvent {
        NONE,
        CHECKPOINT_PASSED,
        LAP_COMPLETED,
        RACE_FINISHED
    }
}

























































/**package com.speedarena.engine;

import com.speedarena.model.GameState;
import com.speedarena.model.PlayerState;
import com.speedarena.track.FinishStrip;
import com.speedarena.track.TrackGeometry;
import com.speedarena.track.TrackLayoutService;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Forest track laps: sequential sectors 1..16 then directed finish crossing (primary finish strip).
 
@Component
public class LapTracker {

    private static final int ARMED_SECTOR = TrackGeometry.MAX_SECTOR_ID + 1;

    private final TrackLayoutService track;

    private final Map<String, Double> prevX = new ConcurrentHashMap<>();
    private final Map<String, Double> prevY = new ConcurrentHashMap<>();
    private final Map<String, Boolean> finishCooldown = new ConcurrentHashMap<>();

    public LapTracker(TrackLayoutService track) {
        this.track = track;
    }

    public LapEvent update(PlayerState player, GameState gameState) {
        String playerId = player.getId();
        double x = player.getX();
        double y = player.getY();
        double vx = player.getVelocityX();
        double vy = player.getVelocityY();

        Double px = prevX.get(playerId);
        Double py = prevY.get(playerId);
        prevX.put(playerId, x);
        prevY.put(playerId, y);

        if (px == null || py == null) {
            return LapEvent.NONE;
        }

        if (!gameState.isRaceStarted() || player.isFinished()) {
            return LapEvent.NONE;
        }

        if (Boolean.TRUE.equals(finishCooldown.get(playerId))) {
            FinishStrip primary = track.getPrimaryFinish();
            boolean stillInside = primary != null && primary.containsSlab(x, y);
            if (!stillInside) {
                finishCooldown.put(playerId, false);
            }
            return LapEvent.NONE;
        }

        int next = player.getLapNextSectorId();
        if (next < 1) {
            next = 1;
            player.setLapNextSectorId(1);
        }

        // Sequential sectors 1 .. MAX_SECTOR_ID
        if (next >= 1 && next <= TrackGeometry.MAX_SECTOR_ID) {
            if (track.isNearSector(x, y, next)) {
                int n = next + 1;
                player.setLapNextSectorId(n);
                if (n == ARMED_SECTOR) {
                    player.setPassedCheckpoint(true);
                    return LapEvent.CHECKPOINT_PASSED;
                }
            }
        }

        // Armed: all sectors cleared
        if (player.getLapNextSectorId() == ARMED_SECTOR) {
            LapEvent cross = tryFinishCrossing(player, gameState, px, py, x, y, vx, vy);
            if (cross != LapEvent.NONE) {
                return cross;
            }
        }

        return LapEvent.NONE;
    }

    private LapEvent tryFinishCrossing(PlayerState player, GameState gameState,
                                       double prevx, double prevy, double x, double y,
                                       double vx, double vy) {
        FinishStrip strip = track.getPrimaryFinish();
        if (strip == null) {
            return LapEvent.NONE;
        }

        double rot = strip.rotRad();
        double cx = strip.cx();
        double cy = strip.cy();

        double sdPrev = TrackGeometry.signedDistanceAlongNormal(prevx, prevy, cx, cy, rot);
        double sdCurr = TrackGeometry.signedDistanceAlongNormal(x, y, cx, cy, rot);
        double tCurr = TrackGeometry.distanceAlongTangent(x, y, cx, cy, rot);
        double tPrev = TrackGeometry.distanceAlongTangent(prevx, prevy, cx, cy, rot);

        boolean inSlab = strip.containsSlab(x, y);
        boolean wasInSlab = strip.containsSlab(prevx, prevy);

        boolean crossedPlane = sdPrev * sdCurr < 0;
        boolean alongOk = Math.abs(tCurr) <= TrackGeometry.FINISH_HALF_LENGTH
                && Math.abs(tPrev) <= TrackGeometry.FINISH_HALF_LENGTH;
        double vDot = TrackGeometry.velocityDotNormal(vx, vy, rot);

        if (!crossedPlane || !alongOk) {
            return LapEvent.NONE;
        }
        if (vDot < TrackGeometry.FINISH_CROSS_VEL_DOT_MIN) {
            return LapEvent.NONE;
        }
        if (!inSlab && !wasInSlab) {
            return LapEvent.NONE;
        }

        int newLap = player.getCurrentLap() + 1;
        player.setCurrentLap(newLap);
        player.setLapNextSectorId(1);
        player.setPassedCheckpoint(false);
        finishCooldown.put(player.getId(), true);

        if (newLap >= GameState.MAX_LAPS) {
            player.setFinished(true);
            player.setFinishTime(System.currentTimeMillis());
            int position = gameState.recordFinish();
            player.setFinishPosition(position);
            return LapEvent.RACE_FINISHED;
        }

        return LapEvent.LAP_COMPLETED;
    }

    public void resetPlayer(String playerId) {
        prevX.remove(playerId);
        prevY.remove(playerId);
        finishCooldown.remove(playerId);
    }

    public void resetAll() {
        prevX.clear();
        prevY.clear();
        finishCooldown.clear();
    }

    public enum LapEvent {
        NONE,
        CHECKPOINT_PASSED,
        LAP_COMPLETED,
        RACE_FINISHED
    }
}
 */