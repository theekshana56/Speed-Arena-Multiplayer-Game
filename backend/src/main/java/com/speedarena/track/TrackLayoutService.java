package com.speedarena.track;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Loads forest track from classpath and exposes roads, sector checkpoints, finish strips, and grid slots.
 */
@Service
public class TrackLayoutService {

    private static final Logger log = LoggerFactory.getLogger(TrackLayoutService.class);

    private final ObjectMapper objectMapper;
    private final List<RoadObb> roads = new ArrayList<>();
    private final Map<Integer, List<double[]>> checkpointCentersBySector = new TreeMap<>();
    private final List<FinishStrip> finishStrips = new ArrayList<>();
    private final List<double[]> startSlotsWorld = new ArrayList<>();

    private FinishStrip primaryFinish;

    public TrackLayoutService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void loadTrack() {
        roads.clear();
        checkpointCentersBySector.clear();
        finishStrips.clear();
        startSlotsWorld.clear();
        primaryFinish = null;

        try {
            ClassPathResource res = new ClassPathResource("track/track_forest.json");
            if (!res.exists()) {
                log.warn("track/track_forest.json not found — collision/lap use fail-open road");
                return;
            }
            try (InputStream is = res.getInputStream()) {
                JsonNode root = objectMapper.readTree(is);
                if (!root.isArray()) {
                    log.warn("Track JSON root is not an array");
                    return;
                }
                for (JsonNode n : root) {
                    String type = n.path("type").asText("");
                    double x = n.path("x").asDouble(0);
                    double y = n.path("y").asDouble(0);
                    double rot = n.path("rot").asDouble(0);
                    double rotRad = TrackGeometry.degreesToRadians(rot);

                    switch (type) {
                        case "road-1", "road-2" -> roads.add(new RoadObb(
                                TrackGeometry.toWorldX(x),
                                TrackGeometry.toWorldY(y),
                                rotRad,
                                TrackGeometry.ROAD_HALF_LENGTH,
                                TrackGeometry.ROAD_HALF_WIDTH));
                        case "checkpoint" -> {
                            int sid = n.path("id").asInt(-1);
                            if (sid >= 1 && sid <= TrackGeometry.MAX_SECTOR_ID) {
                                checkpointCentersBySector
                                        .computeIfAbsent(sid, k -> new ArrayList<>())
                                        .add(new double[]{
                                                TrackGeometry.toWorldX(x),
                                                TrackGeometry.toWorldY(y)});
                            }
                        }
                        case "finish-line-1" -> finishStrips.add(new FinishStrip(
                                TrackGeometry.toWorldX(x),
                                TrackGeometry.toWorldY(y),
                                rotRad));
                        case "start-pos" -> {
                            double angleRad = rotRad;
                            startSlotsWorld.add(new double[]{
                                    TrackGeometry.toWorldX(x),
                                    TrackGeometry.toWorldY(y),
                                    angleRad});
                        }
                        default -> { /* props, side-ground, etc. */ }
                    }
                }
            }
            if (!finishStrips.isEmpty()) {
                primaryFinish = finishStrips.get(0);
            }
            log.info("Loaded forest track: {} roads, {} sector keys, {} finish strips, {} start slots",
                    roads.size(), checkpointCentersBySector.size(), finishStrips.size(), startSlotsWorld.size());
        } catch (Exception e) {
            log.error("Failed to load track_forest.json", e);
        }
    }

    public boolean isOnRoad(double px, double py) {
        if (roads.isEmpty()) {
            return true;
        }
        for (RoadObb r : roads) {
            if (r.contains(px, py)) {
                return true;
            }
        }
        return false;
    }

    public boolean isNearSector(double px, double py, int sectorId) {
        List<double[]> centers = checkpointCentersBySector.get(sectorId);
        if (centers == null) {
            return false;
        }
        double r = TrackGeometry.CHECKPOINT_TRIGGER_RADIUS;
        double r2 = r * r;
        for (double[] c : centers) {
            double dx = px - c[0];
            double dy = py - c[1];
            if (dx * dx + dy * dy <= r2) {
                return true;
            }
        }
        return false;
    }

    public FinishStrip getPrimaryFinish() {
        return primaryFinish;
    }

    public List<FinishStrip> getFinishStrips() {
        return Collections.unmodifiableList(finishStrips);
    }

    /**
     * Starting grid in world pixels + angle (radians), in JSON order.
     */
    public List<double[]> getStartSlotsWorld() {
        return Collections.unmodifiableList(startSlotsWorld);
    }

    public double[] getStartSlotOrDefault(int playerIndex, double[] fallback) {
        if (startSlotsWorld.isEmpty()) {
            return fallback.clone();
        }
        int i = Math.min(playerIndex, startSlotsWorld.size() - 1);
        return startSlotsWorld.get(i).clone();
    }

    public List<RoadObb> getRoads() {
        return Collections.unmodifiableList(roads);
    }

    public Map<Integer, List<double[]>> getCheckpointCentersBySector() {
        return Collections.unmodifiableMap(checkpointCentersBySector);
    }

    /** Centroid of all checkpoints for a sector (for AI hints). */
    public double[] getSectorCentroid(int sectorId) {
        List<double[]> list = checkpointCentersBySector.get(sectorId);
        if (list == null || list.isEmpty()) {
            return null;
        }
        double sx = 0, sy = 0;
        for (double[] p : list) {
            sx += p[0];
            sy += p[1];
        }
        int n = list.size();
        return new double[]{sx / n, sy / n};
    }
}
