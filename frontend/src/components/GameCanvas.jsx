import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import { useInput } from '../game/inputHandler';
import {
  updateCarPhysics,
  handleCollision,
  applyDamage,
  respawnCar,
  createCarState,
  interpolateCarState,
  getDisplaySpeed,
  getSpeedPercentage,
  updateLapTracking,
  TRACK_CONFIG,
  MAX_HEALTH,
  TOP_SPEED,
  STARTING_POSITIONS,
  LAP_CONFIG,
} from '../game/carPhysics';

const CAR_COLORS = { 
  red: "#ff3333", 
  blue: "#00a2ff", 
  green: "#00e87a", 
  yellow: "#ffd520" 
};

/**
 * GameCanvas - High-performance HTML5 Canvas racing game component.
 *
 * Features:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. 60 FPS rendering with requestAnimationFrame
 * 2. Client-side prediction for local player
 * 3. Entity interpolation for other players (smooth movement)
 * 4. Oval track with ellipse collision detection
 * 5. Damage system with health bar
 * 6. Respawn when health reaches zero
 * 7. Handbrake/drift mechanics (Spacebar)
 *
 * Props:
 * @param {string} playerId - Current player's ID
 * @param {string} roomId - Current room ID
 * @param {Object} serverState - Latest state from server (other players)
 * @param {Function} onSendInput - Callback to send input to server
 * @param {boolean} raceStarted - Whether the race has started
 * @param {number} countdown - Countdown value (3, 2, 1, 0)
 * @param {number} width - Canvas width (default 1200)
 * @param {number} height - Canvas height (default 800)
 */
export default function GameCanvas({
  playerId = 'player_1',
  roomId = 'room_1',
  serverState = {},
  onSendInput,
  raceStarted = false,
  countdown = 0,
  width = 1200,
  height = 800,
  onRaceReset,
  onLapChange,
  onRaceFinish,
}) {
  // Canvas ref
  const canvasRef = useRef(null);

  // Local player state (client-side prediction)
  const startPos = STARTING_POSITIONS[0];
  const localPlayerRef = useRef(createCarState(playerId, startPos.x, startPos.y, startPos.angle));

  // Respawn message state
  const [respawnMessage, setRespawnMessage] = useState(null);

  // Race finish state
  const [raceFinished, setRaceFinished] = useState(false);
  const [finishData, setFinishData] = useState(null);

  // Track race start time
  const raceStartTimeRef = useRef(0);

  // Other players' states with interpolation data
  const otherPlayersRef = useRef({});

  // Last input sent timestamp (for rate limiting)
  const lastInputSentRef = useRef(0);
  const INPUT_SEND_RATE = 1000 / 30; // 30 Hz input rate

  // Track last server state timestamp for interpolation
  const serverTimestampRef = useRef(Date.now());

  // Reset local player when race resets
  const resetLocalPlayer = useCallback(() => {
    const pos = STARTING_POSITIONS[0];
    const player = localPlayerRef.current;
    player.x = pos.x;
    player.y = pos.y;
    player.angle = pos.angle;
    player.speed = 0;
    player.velocityX = 0;
    player.velocityY = 0;
    player.currentLap = 0;
    player.passedCheckpoint = false;
    player.isFinished = false;
    player.finishTime = null;
    player.finishPosition = null;
    player.raceTime = null;
    player.health = MAX_HEALTH;
    setRaceFinished(false);
    setFinishData(null);
  }, []);

  // Listen for race reset
  useEffect(() => {
    if (!raceStarted && countdown === 0) {
      resetLocalPlayer();
    }
  }, [raceStarted, countdown, resetLocalPlayer]);

  // Track race start time
  useEffect(() => {
    if (raceStarted && raceStartTimeRef.current === 0) {
      raceStartTimeRef.current = Date.now();
    }
    if (!raceStarted) {
      raceStartTimeRef.current = 0;
    }
  }, [raceStarted]);

  // Input handling (with handbrake support)
  const { input, sequence, hasInput } = useInput({
    enabled: raceStarted && !raceFinished,
    onInputChange: (newInput, seq) => {
      // Send input to server when it changes
      if (onSendInput) {
        sendInput(newInput, seq);
      }
    },
  });

  // Send input to server (rate limited)
  const sendInput = useCallback(
    (inputState, seq) => {
      const now = Date.now();
      if (now - lastInputSentRef.current < INPUT_SEND_RATE && !inputState.accelerate) {
        return; // Rate limit non-critical inputs
      }
      lastInputSentRef.current = now;

      const localPlayer = localPlayerRef.current;
      const message = {
        playerId,
        roomId,
        accelerate: inputState.accelerate,
        brake: inputState.brake,
        turnLeft: inputState.turnLeft,
        turnRight: inputState.turnRight,
        handbrake: inputState.handbrake,
        timestamp: now,
        inputSequence: seq,
        deltaTimeMs: 16,
        clientX: localPlayer.x,
        clientY: localPlayer.y,
        clientAngle: localPlayer.angle,
        clientSpeed: localPlayer.speed,
      };

      onSendInput(message);
    },
    [playerId, roomId, onSendInput]
  );

  // Update other players' interpolation targets when server state changes
  useEffect(() => {
    if (!serverState) return;

    const now = Date.now();
    serverTimestampRef.current = now;

    Object.entries(serverState).forEach(([id, state]) => {
      // Defensive check: ignore null or invalid states
      if (!state || id === playerId) {
        return;
      }

      const prevData = otherPlayersRef.current[id];

      if (!prevData) {
        // New player - initialize
        otherPlayersRef.current[id] = {
          current: { ...state },
          target: { ...state },
          lastUpdate: now,
          interpolationStart: now,
        };
      } else {
        // Existing player - set new interpolation target
        otherPlayersRef.current[id] = {
          current: { ...prevData.current },
          target: { ...state },
          lastUpdate: now,
          interpolationStart: now,
        };
      }
    });

    // Remove disconnected players
    Object.keys(otherPlayersRef.current).forEach((id) => {
      if (!serverState[id]) {
        delete otherPlayersRef.current[id];
      }
    });
  }, [serverState, playerId]);

  // Main game loop
  useGameLoop(
    (deltaTime) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      // ─── Update Physics ─────────────────────────────────────────────────

      if (raceStarted) {
        const localPlayer = localPlayerRef.current;

        // Update local player with client-side prediction
        updateCarPhysics(localPlayer, input, deltaTime);

        // Handle collision and damage
        const collisionResult = handleCollision(localPlayer);
        if (collisionResult.collided && collisionResult.damage > 0) {
          const needsRespawn = applyDamage(localPlayer, collisionResult.damage);

          if (needsRespawn) {
            // Respawn the car
            const respawnPoint = respawnCar(localPlayer);
            setRespawnMessage('RESPAWNING...');
            setTimeout(() => setRespawnMessage(null), 1500);
          }
        }

        // Update lap tracking for local player (only if not finished)
        if (!localPlayer.isFinished) {
          const lapEvent = updateLapTracking(localPlayer, LAP_CONFIG.totalLaps);
          
          if (lapEvent === 'lap_complete') {
            if (onLapChange) onLapChange(localPlayer.currentLap);
          }
          
          if (lapEvent === 'race_finish') {
            const raceTime = Date.now() - raceStartTimeRef.current;
            localPlayer.raceTime = raceTime;
            
            // Calculate position based on finished players
            const position = calculateFinalPosition();
            localPlayer.finishPosition = position;
            
            setRaceFinished(true);
            setFinishData({
              position,
              raceTime,
              laps: localPlayer.currentLap,
              playerId: localPlayer.id,
            });

            if (onRaceFinish) {
              onRaceFinish({
                position,
                raceTime,
                laps: localPlayer.currentLap,
              });
            }
          }
        }

        // Interpolate other players toward their target positions
        const now = Date.now();
        const INTERPOLATION_DURATION = 100; // ms to reach target

        Object.values(otherPlayersRef.current).forEach((playerData) => {
          const elapsed = now - playerData.interpolationStart;
          const t = Math.min(1, elapsed / INTERPOLATION_DURATION);

          const interpolated = interpolateCarState(playerData.current, playerData.target, t);

          playerData.current.x = interpolated.x;
          playerData.current.y = interpolated.y;
          playerData.current.angle = interpolated.angle;
          playerData.current.speed = interpolated.speed;
          playerData.current.health = interpolated.health;
        });
      }

      // ─── Render ─────────────────────────────────────────────────────────

      render(ctx, canvas.width, canvas.height);
    },
    { paused: false }
  );

  // Render function
  const render = useCallback(
    (ctx, w, h) => {
      // Base dimensions for the coordinate system (matched to 1.5x track size)
      const BASE_WIDTH = 1020;
      const BASE_HEIGHT = 705;

      // Calculate scale to fit the base dimensions into actual canvas
      // We use Math.min to maintain aspect ratio and center the content
      const scale = Math.min(w / BASE_WIDTH, h / BASE_HEIGHT);
      const offsetX = (w - BASE_WIDTH * scale) / 2;
      const offsetY = (h - BASE_HEIGHT * scale) / 2;

      // Clear canvas with dark background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      
      // Apply transformation for game world
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // Draw oval track
      drawOvalTrack(ctx);

      // Draw other players first (so local player renders on top)
      Object.entries(otherPlayersRef.current).forEach(([id, playerData]) => {
        // Use car color from server state or default
        const carColor = CAR_COLORS[playerData.target?.carColor] || '#ff6b6b';
        drawCar(ctx, playerData.current, carColor, id.toUpperCase());
      });

      // Draw local player
      const myColor = CAR_COLORS[sessionStorage.getItem('carColor')] || '#00ff00';
      drawCar(ctx, localPlayerRef.current, myColor, playerId.toUpperCase());

      ctx.restore();

      // Draw HUD (unscaled, anchored to canvas corners)
      drawHUD(ctx, w, h);

      // Draw respawn message if active
      if (respawnMessage) {
        drawRespawnMessage(ctx, w, h, respawnMessage);
      }

      // Draw race finish overlay if player finished
      if (raceFinished && finishData) {
        drawRaceFinish(ctx, w, h, finishData);
      }

      // Draw countdown if active
      if (countdown > 0) {
        drawCountdown(ctx, w, h, countdown);
      } else if (!raceStarted) {
        drawStartPrompt(ctx, w, h);
      }
    },
    [playerId, countdown, raceStarted, respawnMessage, raceFinished, finishData]
  );

  // Draw oval track
  const drawOvalTrack = (ctx) => {
    const { centerX, centerY, outerRadiusX, outerRadiusY, innerRadiusX, innerRadiusY } = TRACK_CONFIG;

    // Background (grass)
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, 0, 2000, 2000); // Large enough to cover any canvas

    // Outer boundary (outside grass)
    ctx.fillStyle = '#1a3d1a';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, outerRadiusX + 30, outerRadiusY + 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Track surface (asphalt)
    ctx.fillStyle = '#151520';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, outerRadiusX, outerRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner infield (grass)
    ctx.fillStyle = '#050a10';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, innerRadiusX, innerRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Track boundaries (neon lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;

    // Outer boundary line
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, outerRadiusX, outerRadiusY, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner boundary line
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, innerRadiusX, innerRadiusY, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Center line (dashed neon line)
    ctx.strokeStyle = 'rgba(255, 213, 32, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);
    const centerRadiusX = (outerRadiusX + innerRadiusX) / 2;
    const centerRadiusY = (outerRadiusY + innerRadiusY) / 2;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, centerRadiusX, centerRadiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Start/Finish line (left side of track)
    const finishX = centerX - outerRadiusX + 10;
    const finishY = centerY - 60;
    const finishWidth = outerRadiusX - innerRadiusX - 20;
    const finishHeight = 120;

    // Checkered pattern
    const squareSize = 15;
    for (let row = 0; row < finishHeight / squareSize; row++) {
      for (let col = 0; col < finishWidth / squareSize; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#000000';
        ctx.fillRect(finishX + col * squareSize, finishY + row * squareSize, squareSize, squareSize);
      }
    }

    // Start/Finish text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('START/FINISH', finishX + finishWidth / 2, finishY - 10);
    ctx.textAlign = 'left';

    // Infield decorations
    ctx.fillStyle = '#1a4d1a';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, innerRadiusX - 40, innerRadiusY - 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // "SPEED ARENA" text in center
    ctx.fillStyle = '#3a6a3a';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SPEED ARENA', centerX, centerY);
    ctx.font = '18px Arial';
    ctx.fillText('OVAL SPEEDWAY', centerX, centerY + 30);
    ctx.textAlign = 'left';
  };

  // Draw a car with health indicator
  const drawCar = (ctx, carState, color, label) => {
    const { x, y, angle, health = MAX_HEALTH } = carState;

    ctx.save();

    // Move to car position and rotate
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Car body dimensions
    const carWidth = 60;
    const carHeight = 30;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(-carWidth / 2 + 3, -carHeight / 2 + 3, carWidth, carHeight);

    // Main body (color based on health)
    const healthPercent = health / MAX_HEALTH;
    let carColor = color;
    if (healthPercent < 0.3) {
      carColor = '#ff0000'; // Critical - red
    } else if (healthPercent < 0.6) {
      carColor = '#ff8800'; // Low - orange
    }
    ctx.fillStyle = carColor;
    ctx.fillRect(-carWidth / 2, -carHeight / 2, carWidth, carHeight);

    // Damage marks (scratches when damaged)
    if (healthPercent < 0.7) {
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-carWidth / 4, -carHeight / 4);
      ctx.lineTo(carWidth / 4, carHeight / 4);
      ctx.stroke();
    }
    if (healthPercent < 0.4) {
      ctx.beginPath();
      ctx.moveTo(carWidth / 4, -carHeight / 4);
      ctx.lineTo(-carWidth / 4, carHeight / 4);
      ctx.stroke();
    }

    // Windshield
    ctx.fillStyle = '#333';
    ctx.fillRect(carWidth / 4, -carHeight / 2 + 2, carWidth / 4, carHeight - 4);

    // Tires
    ctx.fillStyle = '#222';
    ctx.fillRect(-carWidth / 2, -carHeight / 2 - 2, 8, 4); // Front left
    ctx.fillRect(-carWidth / 2, carHeight / 2 - 2, 8, 4); // Rear left
    ctx.fillRect(carWidth / 2 - 8, -carHeight / 2 - 2, 8, 4); // Front right
    ctx.fillRect(carWidth / 2 - 8, carHeight / 2 - 2, 8, 4); // Rear right

    ctx.restore();

    // Player name label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 25);

    // Mini health bar above car
    const barWidth = 30;
    const barHeight = 4;
    const barX = x - barWidth / 2;
    const barY = y - 35;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health fill
    ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffaa00' : '#ff0000';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    ctx.textAlign = 'left';
  };

  // Draw HUD (speedometer, lap counter, health bar)
  const drawHUD = (ctx, canvasWidth, canvasHeight) => {
    const localPlayer = localPlayerRef.current;
    const speed = Math.abs(localPlayer.speed);
    const displaySpeed = getDisplaySpeed(speed);
    const speedPercent = getSpeedPercentage(speed);
    const health = localPlayer.health || MAX_HEALTH;
    const healthPercent = (health / MAX_HEALTH) * 100;

    // ─── Speedometer (bottom right) ───────────────────────────────────────

    const speedoX = canvasWidth - 160;
    const speedoY = canvasHeight - 120;
    const speedoRadius = 60;

    // Background circle
    ctx.beginPath();
    ctx.arc(speedoX, speedoY, speedoRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Speed arc (animated based on speed)
    const startAngle = Math.PI * 0.75;
    const endAngle = startAngle + (Math.PI * 1.5 * speedPercent) / 100;

    ctx.beginPath();
    ctx.arc(speedoX, speedoY, speedoRadius - 8, startAngle, endAngle);
    ctx.strokeStyle = speedPercent > 80 ? '#ff4444' : speedPercent > 50 ? '#ffaa00' : '#00ff00';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Speed value
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${displaySpeed}`, speedoX, speedoY + 8);

    // "km/h" label
    ctx.font = '12px Arial';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('km/h', speedoX, speedoY + 25);

    // ─── Health Bar (bottom center) ───────────────────────────────────────

    const healthBarWidth = 200;
    const healthBarHeight = 20;
    const healthBarX = (canvasWidth - healthBarWidth) / 2;
    const healthBarY = canvasHeight - 50;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(healthBarX - 10, healthBarY - 25, healthBarWidth + 20, healthBarHeight + 35);

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('HEALTH', canvasWidth / 2, healthBarY - 8);

    // Health bar background
    ctx.fillStyle = '#333333';
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

    // Health bar fill
    ctx.fillStyle = healthPercent > 50 ? '#00ff00' : healthPercent > 25 ? '#ffaa00' : '#ff0000';
    ctx.fillRect(healthBarX, healthBarY, (healthBarWidth * healthPercent) / 100, healthBarHeight);

    // Health percentage text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`${Math.round(healthPercent)}%`, canvasWidth / 2, healthBarY + 15);

    // ─── Lap Counter (top right) ──────────────────────────────────────────

    const lapX = canvasWidth - 150;
    const lapY = 30;
    const totalLaps = LAP_CONFIG.totalLaps;
    const currentLap = Math.min(localPlayer.currentLap || 0, totalLaps);
    const displayLap = localPlayer.isFinished ? totalLaps : currentLap;
    const remainingLaps = totalLaps - currentLap;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(lapX - 10, lapY - 20, 150, 70);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('LAP', lapX, lapY - 5);

    // Current lap display
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = localPlayer.isFinished ? '#ffd700' : '#00ff00';
    ctx.fillText(`${displayLap}/${totalLaps}`, lapX + 50, lapY + 5);

    // Remaining laps
    ctx.font = '12px Arial';
    ctx.fillStyle = '#94a3b8';
    if (localPlayer.isFinished) {
      ctx.fillText('FINISHED!', lapX, lapY + 30);
    } else if (remainingLaps > 0) {
      ctx.fillText(`${remainingLaps} lap${remainingLaps > 1 ? 's' : ''} remaining`, lapX, lapY + 30);
    } else {
      ctx.fillText('Final lap!', lapX, lapY + 30);
    }

    // ─── Position Indicator (top left) ────────────────────────────────────

    const posX = 20;
    const posY = 30;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(posX - 10, posY - 20, 100, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText('POSITION', posX, posY - 5);

    const position = calculatePosition();
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = position === 1 ? '#ffd700' : '#ffffff';
    ctx.fillText(`${position}${getOrdinalSuffix(position)}`, posX, posY + 22);

    // ─── Input Display (bottom left) ──────────────────────────────────────

    const inputX = 20;
    const inputY = canvasHeight - 100;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(inputX, inputY, 100, 80);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('CONTROLS', inputX + 5, inputY + 12);

    // W
    ctx.fillStyle = input.accelerate ? '#00ff00' : '#444';
    ctx.fillRect(inputX + 40, inputY + 18, 20, 15);
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.fillText('W', inputX + 46, inputY + 29);

    // A
    ctx.fillStyle = input.turnLeft ? '#00ff00' : '#444';
    ctx.fillRect(inputX + 15, inputY + 38, 20, 15);
    ctx.fillStyle = '#fff';
    ctx.fillText('A', inputX + 21, inputY + 49);

    // S
    ctx.fillStyle = input.brake ? '#00ff00' : '#444';
    ctx.fillRect(inputX + 40, inputY + 38, 20, 15);
    ctx.fillStyle = '#fff';
    ctx.fillText('S', inputX + 46, inputY + 49);

    // D
    ctx.fillStyle = input.turnRight ? '#00ff00' : '#444';
    ctx.fillRect(inputX + 65, inputY + 38, 20, 15);
    ctx.fillStyle = '#fff';
    ctx.fillText('D', inputX + 71, inputY + 49);

    // Spacebar (Handbrake)
    ctx.fillStyle = input.handbrake ? '#ff6600' : '#444';
    ctx.fillRect(inputX + 15, inputY + 58, 70, 15);
    ctx.fillStyle = '#fff';
    ctx.font = '9px Arial';
    ctx.fillText('SPACE (DRIFT)', inputX + 18, inputY + 69);

    ctx.textAlign = 'left';
  };

  // Draw respawn message
  const drawRespawnMessage = (ctx, w, h, message) => {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, w / 2, h / 2);

    ctx.font = '24px Arial';
    ctx.fillText('Car destroyed! Respawning...', w / 2, h / 2 + 50);

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  };

  // Draw countdown
  const drawCountdown = (ctx, w, h, count) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(count.toString(), w / 2, h / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  };

  // Draw start prompt
  const drawStartPrompt = (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(w / 2 - 200, h / 2 - 40, 400, 80);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for race to start...', w / 2, h / 2);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('Press "Start Race" button to begin', w / 2, h / 2 + 25);
    ctx.textAlign = 'left';
  };

  // Calculate player position
  const calculatePosition = () => {
    const localPlayer = localPlayerRef.current;
    let position = 1;

    Object.values(otherPlayersRef.current).forEach((playerData) => {
      const other = playerData.current;

      // Compare by laps first, then by progress around track
      if (other.currentLap > localPlayer.currentLap) {
        position++;
      } else if (other.currentLap === localPlayer.currentLap) {
        // Same lap - compare angle around track center for oval
        const { centerX, centerY } = TRACK_CONFIG;
        const localAngle = Math.atan2(localPlayer.y - centerY, localPlayer.x - centerX);
        const otherAngle = Math.atan2(other.y - centerY, other.x - centerX);

        // Racing counter-clockwise, so larger angle = ahead
        if (otherAngle > localAngle) {
          position++;
        }
      }
    });

    return position;
  };

  // Calculate final position when player finishes
  const calculateFinalPosition = () => {
    let position = 1;

    // Count how many other players have already finished
    Object.values(otherPlayersRef.current).forEach((playerData) => {
      const other = playerData.current;
      if (other.isFinished) {
        position++;
      }
    });

    return position;
  };

  // Format race time as mm:ss.ms
  const formatRaceTime = (timeMs) => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((timeMs % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Draw race finish overlay
  const drawRaceFinish = (ctx, w, h, data) => {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, w, h);

    // Main finish box
    const boxWidth = 500;
    const boxHeight = 350;
    const boxX = (w - boxWidth) / 2;
    const boxY = (h - boxHeight) / 2;

    // Box background with gradient
    const gradient = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
    gradient.addColorStop(0, '#1e3a5f');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    // Box border
    ctx.strokeStyle = data.position === 1 ? '#ffd700' : '#3b82f6';
    ctx.lineWidth = 4;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // "RACE FINISHED" header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏁 RACE FINISHED 🏁', w / 2, boxY + 50);

    // Position display (large)
    const posColor = data.position === 1 ? '#ffd700' : data.position === 2 ? '#c0c0c0' : data.position === 3 ? '#cd7f32' : '#ffffff';
    ctx.fillStyle = posColor;
    ctx.font = 'bold 72px Arial';
    ctx.fillText(`${data.position}${getOrdinalSuffix(data.position)}`, w / 2, boxY + 140);

    // Position label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px Arial';
    ctx.fillText('PLACE', w / 2, boxY + 165);

    // Stats section
    const statsY = boxY + 200;
    
    // Race Time
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`⏱️ ${formatRaceTime(data.raceTime)}`, w / 2, statsY);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Arial';
    ctx.fillText('RACE TIME', w / 2, statsY + 22);

    // Laps completed
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`${data.laps}/${LAP_CONFIG.totalLaps} Laps`, w / 2, statsY + 60);

    // Player ID
    ctx.fillStyle = '#64748b';
    ctx.font = '16px Arial';
    ctx.fillText(`Player: ${data.playerId}`, w / 2, statsY + 95);

    // Instruction
    ctx.fillStyle = '#3b82f6';
    ctx.font = '16px Arial';
    ctx.fillText('Press "Reset Race" to play again', w / 2, boxY + boxHeight - 30);

    ctx.textAlign = 'left';
  };

  // Get ordinal suffix
  const getOrdinalSuffix = (n) => {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        display: 'block',
        margin: '0 auto',
        border: '3px solid #3b82f6',
        borderRadius: '12px',
        backgroundColor: '#1a1a2e',
        boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)',
      }}
    />
  );
}
