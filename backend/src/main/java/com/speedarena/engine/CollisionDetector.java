package com.speedarena.engine;

import com.speedarena.model.PlayerState;
import com.speedarena.track.TrackLayoutService;
import org.springframework.stereotype.Component;

/**
 * Off-road slowdown uses forest road OBB union; car-to-car unchanged.
 */
@Component
public class CollisionDetector {

    private final TrackLayoutService trackLayoutService;

    public static final double CAR_WIDTH = 40;
    public static final double CAR_HEIGHT = 20;
    public static final double WALL_BOUNCE_FACTOR = 0.3;
    public static final double COLLISION_PUSHBACK = 5.0;

    public CollisionDetector(TrackLayoutService trackLayoutService) {
        this.trackLayoutService = trackLayoutService;
    }

    public boolean isWithinBounds(PlayerState player) {
        return trackLayoutService.isOnRoad(player.getX(), player.getY());
    }

    public boolean isWithinBounds(double x, double y) {
        return trackLayoutService.isOnRoad(x, y);
    }

    public static class CollisionResult {
        public boolean hasCollision;
        public CollisionType type;
        public double correctionX;
        public double correctionY;
        public double newSpeed;

        public enum CollisionType {
            NONE,
            OFF_ROAD
        }

        public CollisionResult() {
            this.hasCollision = false;
            this.type = CollisionType.NONE;
            this.correctionX = 0;
            this.correctionY = 0;
            this.newSpeed = 0;
        }
    }

    public CollisionResult checkBoundaryCollision(PlayerState player) {
        CollisionResult result = new CollisionResult();
        double x = player.getX();
        double y = player.getY();
        double speed = player.getSpeed();

        if (!trackLayoutService.isOnRoad(x, y)) {
            result.hasCollision = true;
            result.type = CollisionResult.CollisionType.OFF_ROAD;
            result.newSpeed = speed * 0.9;
        }

        return result;
    }

    public void applyCollisionCorrection(PlayerState player, CollisionResult result) {
        if (!result.hasCollision) {
            return;
        }
        if (result.type == CollisionResult.CollisionType.OFF_ROAD) {
            player.setSpeed(result.newSpeed);
            return;
        }
    }

    public boolean areColliding(PlayerState player1, PlayerState player2) {
        double dx = player1.getX() - player2.getX();
        double dy = player1.getY() - player2.getY();
        double distance = Math.sqrt(dx * dx + dy * dy);
        double collisionRadius = (CAR_WIDTH + CAR_HEIGHT) / 2;
        return distance < collisionRadius;
    }

    public void handleCarCollision(PlayerState player1, PlayerState player2) {
        if (!areColliding(player1, player2)) {
            return;
        }

        double dx = player2.getX() - player1.getX();
        double dy = player2.getY() - player1.getY();
        double distance = Math.sqrt(dx * dx + dy * dy);

        if (distance == 0) {
            dx = 1;
            dy = 0;
            distance = 1;
        }

        dx /= distance;
        dy /= distance;

        double pushDistance = COLLISION_PUSHBACK;
        player1.setX(player1.getX() - dx * pushDistance);
        player1.setY(player1.getY() - dy * pushDistance);
        player2.setX(player2.getX() + dx * pushDistance);
        player2.setY(player2.getY() + dy * pushDistance);

        player1.setSpeed(player1.getSpeed() * 0.7);
        player2.setSpeed(player2.getSpeed() * 0.7);
    }
}

















































/**
 package com.speedarena.engine;

import com.speedarena.model.PlayerState;
import com.speedarena.track.TrackLayoutService;
import org.springframework.stereotype.Component;

/**
 * Off-road slowdown uses forest road OBB union; car-to-car unchanged.
 
@Component
public class CollisionDetector {

    private final TrackLayoutService trackLayoutService;

    public static final double CAR_WIDTH = 40;
    public static final double CAR_HEIGHT = 20;
    public static final double WALL_BOUNCE_FACTOR = 0.3;
    public static final double COLLISION_PUSHBACK = 5.0;

    public CollisionDetector(TrackLayoutService trackLayoutService) {
        this.trackLayoutService = trackLayoutService;
    }

    public boolean isWithinBounds(PlayerState player) {
        return trackLayoutService.isOnRoad(player.getX(), player.getY());
    }

    public boolean isWithinBounds(double x, double y) {
        return trackLayoutService.isOnRoad(x, y);
    }

    public static class CollisionResult {
        public boolean hasCollision;
        public CollisionType type;
        public double correctionX;
        public double correctionY;
        public double newSpeed;

        public enum CollisionType {
            NONE,
            OFF_ROAD
        }

        public CollisionResult() {
            this.hasCollision = false;
            this.type = CollisionType.NONE;
            this.correctionX = 0;
            this.correctionY = 0;
            this.newSpeed = 0;
        }
    }

    public CollisionResult checkBoundaryCollision(PlayerState player) {
        CollisionResult result = new CollisionResult();
        double x = player.getX();
        double y = player.getY();
        double speed = player.getSpeed();

        if (!trackLayoutService.isOnRoad(x, y)) {
            result.hasCollision = true;
            result.type = CollisionResult.CollisionType.OFF_ROAD;
            result.newSpeed = speed * 0.9;
        }

        return result;
    }

    public void applyCollisionCorrection(PlayerState player, CollisionResult result) {
        if (!result.hasCollision) {
            return;
        }
        if (result.type == CollisionResult.CollisionType.OFF_ROAD) {
            player.setSpeed(result.newSpeed);
            return;
        }
    }

    public boolean areColliding(PlayerState player1, PlayerState player2) {
        double dx = player1.getX() - player2.getX();
        double dy = player1.getY() - player2.getY();
        double distance = Math.sqrt(dx * dx + dy * dy);
        double collisionRadius = (CAR_WIDTH + CAR_HEIGHT) / 2;
        return distance < collisionRadius;
    }

    public void handleCarCollision(PlayerState player1, PlayerState player2) {
        if (!areColliding(player1, player2)) {
            return;
        }

        double dx = player2.getX() - player1.getX();
        double dy = player2.getY() - player1.getY();
        double distance = Math.sqrt(dx * dx + dy * dy);

        if (distance == 0) {
            dx = 1;
            dy = 0;
            distance = 1;
        }

        dx /= distance;
        dy /= distance;

        double pushDistance = COLLISION_PUSHBACK;
        player1.setX(player1.getX() - dx * pushDistance);
        player1.setY(player1.getY() - dy * pushDistance);
        player2.setX(player2.getX() + dx * pushDistance);
        player2.setY(player2.getY() + dy * pushDistance);

        player1.setSpeed(player1.getSpeed() * 0.7);
        player2.setSpeed(player2.getSpeed() * 0.7);
    }
}

 
 */