package com.speedarena.engine;

import com.speedarena.model.PlayerState;
import org.springframework.stereotype.Component;

/**
 * Car physics aligned with frontend {@code carPhysics.js} (forest / Unity-style arcade).
 */
@Component
public class CarPhysics {

    public static final double TOP_SPEED = 720.0;
    public static final double MAX_REVERSE_SPEED = 250.0;
    public static final double ACCELERATION = 300.0;
    public static final double BRAKE_DECELERATION = 500.0;
    public static final double TURN_SPEED = 5.2;
    public static final double MIN_TURN_SPEED = 10.0;
    public static final double GRIP = 4.5;
    public static final double DRIFT_THRESHOLD = 350.0;
    public static final double HANDBRAKE_GRIP = 0.6;
    public static final double HANDBRAKE_TURN_BOOST = 2.5;

    public void update(PlayerState player, boolean accelerate, boolean brake,
                       boolean turnLeft, boolean turnRight, boolean handbrake, double deltaTime) {

        deltaTime = Math.min(deltaTime, 0.1);

        double speed = player.getSpeed();
        double angle = player.getAngle();
        double vx = player.getVelocityX();
        double vy = player.getVelocityY();

        if (handbrake) {
            speed *= Math.pow(0.93, deltaTime * 60);
        } else if (accelerate) {
            speed += ACCELERATION * deltaTime;
            speed = Math.min(speed, TOP_SPEED);
        } else if (brake) {
            if (speed > 0) {
                speed = Math.max(0, speed - BRAKE_DECELERATION * deltaTime);
            } else {
                speed = Math.max(-MAX_REVERSE_SPEED, speed - ACCELERATION * 0.5 * deltaTime);
            }
        } else {
            speed *= Math.pow(0.96, deltaTime * 10);
        }

        if (Math.abs(speed) > MIN_TURN_SPEED) {
            double sFactor = Math.min(1.0, Math.abs(speed) / 128.0);
            double tSpeed = TURN_SPEED * sFactor * (handbrake ? HANDBRAKE_TURN_BOOST : 1.0);
            double dir = speed >= 0 ? 1.0 : -1.0;
            if (turnLeft) {
                angle -= tSpeed * dir * deltaTime;
            } else if (turnRight) {
                angle += tSpeed * dir * deltaTime;
            }
            angle = normalizeAngle(angle);
        }
        // car angle
        double intendedVx = Math.cos(angle) * speed;
        double intendedVy = Math.sin(angle) * speed;
        double grip = handbrake ? HANDBRAKE_GRIP : GRIP;
        double blend = 1.0 - Math.exp(-grip * deltaTime);
        vx = vx + (intendedVx - vx) * blend;
        vy = vy + (intendedVy - vy) * blend;

        player.setX(player.getX() + vx * deltaTime);
        player.setY(player.getY() + vy * deltaTime);
        player.setAngle(angle);
        player.setSpeed(speed);
        player.setVelocityX(vx);
        player.setVelocityY(vy);
        player.setServerTimestamp(System.currentTimeMillis());
    }

    public void update(PlayerState player, boolean accelerate, boolean brake,
                       boolean turnLeft, boolean turnRight, double deltaTime) {
        update(player, accelerate, brake, turnLeft, turnRight, false, deltaTime);
    }

    public void update(PlayerState player, boolean accelerate, boolean brake,
                       boolean turnLeft, boolean turnRight) {
        update(player, accelerate, brake, turnLeft, turnRight, false, 1.0 / 60.0);
    }

    public static double normalizeAngle(double angle) {
        angle = angle % (2 * Math.PI);
        if (angle < 0) {
            angle += 2 * Math.PI;
        }
        return angle;
    }

    public static double angleDifference(double from, double to) {
        double diff = normalizeAngle(to - from);
        if (diff > Math.PI) {
            diff -= 2 * Math.PI;
        }
        return diff;
    }

    public static double getSpeedPercentage(double speed) {
        return Math.min(100, Math.abs(speed) / TOP_SPEED * 100);
    }

    /** Matches JS getDisplaySpeed: km/h scale */
    public static int getDisplaySpeed(double speed) {
        return (int) Math.round(Math.abs(speed) * 0.4);
    }
}





























































































/**
 * package com.speedarena.engine;

import com.speedarena.model.PlayerState;
import org.springframework.stereotype.Component;

/**
 * Car physics aligned with frontend {@code carPhysics.js} (forest / Unity-style arcade).
 
@Component
public class CarPhysics {

    public static final double TOP_SPEED = 720.0;
    public static final double MAX_REVERSE_SPEED = 250.0;
    public static final double ACCELERATION = 300.0;
    public static final double BRAKE_DECELERATION = 500.0;
    public static final double TURN_SPEED = 5.2;
    public static final double MIN_TURN_SPEED = 10.0;
    public static final double GRIP = 4.5;
    public static final double DRIFT_THRESHOLD = 350.0;
    public static final double HANDBRAKE_GRIP = 0.6;
    public static final double HANDBRAKE_TURN_BOOST = 2.5;

    public void update(PlayerState player, boolean accelerate, boolean brake,
                       boolean turnLeft, boolean turnRight, boolean handbrake, double deltaTime) {

        deltaTime = Math.min(deltaTime, 0.1);

        double speed = player.getSpeed();
        double angle = player.getAngle();
        double vx = player.getVelocityX();
        double vy = player.getVelocityY();

        if (handbrake) {
            speed *= Math.pow(0.93, deltaTime * 60);
        } else if (accelerate) {
            speed += ACCELERATION * deltaTime;
            speed = Math.min(speed, TOP_SPEED);
        } else if (brake) {
            if (speed > 0) {
                speed = Math.max(0, speed - BRAKE_DECELERATION * deltaTime);
            } else {
                speed = Math.max(-MAX_REVERSE_SPEED, speed - ACCELERATION * 0.5 * deltaTime);
            }
        } else {
            speed *= Math.pow(0.96, deltaTime * 10);
        }

        if (Math.abs(speed) > MIN_TURN_SPEED) {
            double sFactor = Math.min(1.0, Math.abs(speed) / 128.0);
            double tSpeed = TURN_SPEED * sFactor * (handbrake ? HANDBRAKE_TURN_BOOST : 1.0);
            double dir = speed >= 0 ? 1.0 : -1.0;
            if (turnLeft) {
                angle -= tSpeed * dir * deltaTime;
            } else if (turnRight) {
                angle += tSpeed * dir * deltaTime;
            }
            angle = normalizeAngle(angle);
        }
        // car angle
        double intendedVx = Math.cos(angle) * speed;
        double intendedVy = Math.sin(angle) * speed;
        double grip = handbrake ? HANDBRAKE_GRIP : GRIP;
        double blend = 1.0 - Math.exp(-grip * deltaTime);
        vx = vx + (intendedVx - vx) * blend;
        vy = vy + (intendedVy - vy) * blend;

        player.setX(player.getX() + vx * deltaTime);
        player.setY(player.getY() + vy * deltaTime);
        player.setAngle(angle);
        player.setSpeed(speed);
        player.setVelocityX(vx);
        player.setVelocityY(vy);
        player.setServerTimestamp(System.currentTimeMillis());
    }

    public void update(PlayerState player, boolean accelerate, boolean brake,
                       boolean turnLeft, boolean turnRight, double deltaTime) {
        update(player, accelerate, brake, turnLeft, turnRight, false, deltaTime);
    }

    public void update(PlayerState player, boolean accelerate, boolean brake,
                       boolean turnLeft, boolean turnRight) {
        update(player, accelerate, brake, turnLeft, turnRight, false, 1.0 / 60.0);
    }

    public static double normalizeAngle(double angle) {
        angle = angle % (2 * Math.PI);
        if (angle < 0) {
            angle += 2 * Math.PI;
        }
        return angle;
    }

    public static double angleDifference(double from, double to) {
        double diff = normalizeAngle(to - from);
        if (diff > Math.PI) {
            diff -= 2 * Math.PI;
        }
        return diff;
    }

    public static double getSpeedPercentage(double speed) {
        return Math.min(100, Math.abs(speed) / TOP_SPEED * 100);
    }

    /** Matches JS getDisplaySpeed: km/h scale 
    public static int getDisplaySpeed(double speed) {
        return (int) Math.round(Math.abs(speed) * 0.4);
    }
}

 */