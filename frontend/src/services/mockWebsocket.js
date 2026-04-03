/**
 * mockWebsocket.js - Mock WebSocket Service for Testing
 *
 * Simulates WebSocket communication for testing the game engine
 * without needing the actual Spring Boot backend running.
 *
 * Features:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Simulates server-side physics (mirrors GameEngineService)
 * 2. Simulates network latency
 * 3. Generates AI opponent movement
 * 4. Provides subscription-based state updates
 *
 * Usage:
 * ─────────────────────────────────────────────────────────────────────────────
 * import { MockWebSocketService } from './services/mockWebsocket';
 *
 * const ws = new MockWebSocketService({
 *   playerId: 'player_1',
 *   roomId: 'room_1',
 *   latencyMs: 50,
 * });
 *
 * ws.connect();
 * ws.subscribe('/topic/game-state', (state) => {
 *   // Handle state update
 * });
 * ws.send('/app/car.move', inputMessage);
 */

import trackForest from '../game/levels/track_forest.json';
import {
  updateCarPhysics,
  handleCollision,
  createCarState,
  updateLapTracking,
  getStartPositionsFromLayout,
  STARTING_POSITIONS,
  LAP_CONFIG,
} from '../game/carPhysics';
import {
  getSectorTargetWorld,
  toWorldX,
  toWorldY,
} from '../game/track/trackGeometry.js';

// ─── Mock Server State ──────────────────────────────────────────────────────

/**
 * Simulated server game state.
 * In production, this would be managed by Spring Boot.
 */
class MockServerState {
  constructor(roomId, trackLayout = []) {
    this.roomId = roomId;
    this.trackLayout = trackLayout;
    this.players = {};
    this.aiPlayers = {};
    this.raceStarted = false;
    this.racePhase = 'WAITING'; // WAITING, COUNTDOWN, RACING, FINISHED
    this.countdown = 3;
    this.startTime = 0;
    this.maxLaps = LAP_CONFIG.totalLaps;
    this.winnerId = null;
    this.finishedPlayers = []; // Track finished players in order
  }

  addPlayer(playerId, isAI = false) {
    const index = Object.keys(this.players).length;
    const slots = getStartPositionsFromLayout(this.trackLayout);
    let spawn;
    if (slots.length > 0) {
      spawn = slots[Math.min(index, slots.length - 1)];
    } else {
      const p = STARTING_POSITIONS[Math.min(index, STARTING_POSITIONS.length - 1)];
      spawn = { x: p.x, y: p.y, angle: p.angle };
    }

    const player = createCarState(playerId, spawn);
    player.isAI = isAI;
    player.carColor = isAI ? '#ff6b6b' : '#00ff00';
    player.passedCheckpoint = false;
    player.currentLap = 0;
    player.isFinished = false;
    player.finishTime = null;
    player.finishPosition = null;
    player.raceTime = null;

    this.players[playerId] = player;

    if (isAI) {
      this.aiPlayers[playerId] = {
        targetAngle: spawn.angle,
        updateTimer: 0,
      };
    }

    return player;
  }

  removePlayer(playerId) {
    delete this.players[playerId];
    delete this.aiPlayers[playerId];
  }

  getPlayersCopy() {
    const copy = {};
    Object.entries(this.players).forEach(([id, player]) => {
      copy[id] = { ...player };
    });
    return copy;
  }
}

// ─── Mock WebSocket Service ─────────────────────────────────────────────────

/**
 * MockWebSocketService - Simulates STOMP over WebSocket for testing.
 */
export class MockWebSocketService {
  constructor(options = {}) {
    const {
      playerId = 'player_1',
      roomId = 'room_1',
      latencyMs = 50,
      addAIOpponents = true,
      aiCount = 1,
      broadcastRateMs = 50,
    } = options;

    this.playerId = playerId;
    this.roomId = roomId;
    this.latencyMs = latencyMs;
    this.addAIOpponents = addAIOpponents;
    this.aiCount = aiCount;
    this.broadcastRateMs = broadcastRateMs;

    // Internal state
    this.connected = false;
    this.subscriptions = {};
    this.serverState = null;
    this.broadcastInterval = null;
    this.aiUpdateInterval = null;
    this.lastUpdateTime = Date.now();

    // Event callbacks
    this.onConnect = null;
    this.onDisconnect = null;
    this.onError = null;
  }

  /**
   * Simulates connecting to the WebSocket server.
   */
  connect() {
    console.log('[MockWS] Connecting...');

    // Simulate connection delay
    setTimeout(() => {
      this.connected = true;
      this.serverState = new MockServerState(this.roomId, trackForest);

      // Add local player
      this.serverState.addPlayer(this.playerId, false);

      // Add AI opponents
      if (this.addAIOpponents) {
        for (let i = 0; i < this.aiCount; i++) {
          this.serverState.addPlayer(`ai_player_${i + 1}`, true);
        }
      }

      console.log('[MockWS] Connected!');
      console.log('[MockWS] Players:', Object.keys(this.serverState.players));

      // Start broadcast loop
      this.startBroadcast();

      // Start AI update loop
      this.startAILoop();

      // Trigger connect callback
      if (this.onConnect) {
        this.onConnect();
      }
    }, 100);
  }

  /**
   * Simulates disconnecting from the server.
   */
  disconnect() {
    console.log('[MockWS] Disconnecting...');

    this.connected = false;
    this.stopBroadcast();
    this.stopAILoop();

    if (this.onDisconnect) {
      this.onDisconnect();
    }
  }

  /**
   * Subscribes to a topic.
   * Mimics STOMP subscribe behavior.
   *
   * @param {string} destination - Topic to subscribe to (e.g., '/topic/game-state')
   * @param {Function} callback - Function called when message received
   * @returns {string} Subscription ID (for unsubscribe)
   */
  subscribe(destination, callback) {
    const subId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!this.subscriptions[destination]) {
      this.subscriptions[destination] = {};
    }

    this.subscriptions[destination][subId] = callback;

    console.log(`[MockWS] Subscribed to ${destination} (${subId})`);

    return subId;
  }

  /**
   * Unsubscribes from a topic.
   *
   * @param {string} destination - Topic to unsubscribe from
   * @param {string} subscriptionId - Subscription ID from subscribe()
   */
  unsubscribe(destination, subscriptionId) {
    if (this.subscriptions[destination]) {
      delete this.subscriptions[destination][subscriptionId];
      console.log(`[MockWS] Unsubscribed from ${destination} (${subscriptionId})`);
    }
  }

  /**
   * Sends a message to the server.
   * Mimics STOMP send behavior.
   *
   * @param {string} destination - Endpoint to send to (e.g., '/app/car.move')
   * @param {Object} message - Message body
   */
  send(destination, message) {
    if (!this.connected) {
      console.warn('[MockWS] Not connected, cannot send');
      return;
    }

    // Simulate network latency
    setTimeout(() => {
      this.handleMessage(destination, message);
    }, this.latencyMs);
  }

  /**
   * Handles incoming messages (simulates server processing).
   */
  handleMessage(destination, message) {
    switch (destination) {
      case '/app/car.move':
        this.handleCarMove(message);
        break;
      case '/app/start-race':
        this.handleStartRace(message);
        break;
      case '/app/reset-race':
        this.handleResetRace(message);
        break;
      default:
        console.warn(`[MockWS] Unknown destination: ${destination}`);
    }
  }

  /**
   * Handles car movement input.
   * Mimics GameEngineService.processInput()
   */
  handleCarMove(message) {
    const player = this.serverState.players[message.playerId];
    if (!player) return;

    // Calculate delta time
    const now = Date.now();
    const deltaTimeMs = message.deltaTimeMs || 16;
    const deltaTime = deltaTimeMs / 1000;

    // Apply physics (mirrors backend logic)
    const input = {
      accelerate: message.accelerate,
      brake: message.brake,
      turnLeft: message.turnLeft,
      turnRight: message.turnRight,
      handbrake: !!message.handbrake,
    };

    if (this.serverState.raceStarted) {
      updateCarPhysics(player, input, deltaTime);
      handleCollision(player, this.serverState.trackLayout);
    }

    // Update server state timestamp
    player.serverTimestamp = now;
    player.inputSequence = message.inputSequence;
  }

  /**
   * Handles race start request.
   */
  handleStartRace() {
    console.log('[MockWS] Starting race countdown...');

    this.serverState.racePhase = 'COUNTDOWN';
    this.serverState.countdown = 3;

    // Broadcast initial countdown
    this.broadcast('/topic/countdown', {
      count: this.serverState.countdown,
    });

    // Countdown
    const countdownInterval = setInterval(() => {
      this.serverState.countdown--;

      // Broadcast countdown
      this.broadcast('/topic/countdown', {
        count: this.serverState.countdown,
      });

      console.log('[MockWS] Countdown:', this.serverState.countdown);

      if (this.serverState.countdown <= 0) {
        clearInterval(countdownInterval);
        this.serverState.raceStarted = true;
        this.serverState.racePhase = 'RACING';
        this.serverState.startTime = Date.now();
        console.log('[MockWS] Race started!');

        // Broadcast race started event
        this.broadcast('/topic/race-started', { started: true });
      }
    }, 1000);
  }

  /**
   * Handles race reset request.
   */
  handleResetRace() {
    console.log('[MockWS] Resetting race...');

    // Reset all players to starting positions
    const slots = getStartPositionsFromLayout(this.serverState.trackLayout);
    let index = 0;
    Object.values(this.serverState.players).forEach((player) => {
      let spawn;
      if (slots.length > 0) {
        spawn = slots[Math.min(index, slots.length - 1)];
      } else {
        const p = STARTING_POSITIONS[Math.min(index, STARTING_POSITIONS.length - 1)];
        spawn = { x: p.x, y: p.y, angle: p.angle };
      }
      player.x = spawn.x;
      player.y = spawn.y;
      player.angle = spawn.angle;
      player.speed = 0;
      player.velocityX = 0;
      player.velocityY = 0;
      player.currentLap = 0;
      player.passedCheckpoint = false;
      player.lapNextSectorId = 1;
      player.lapFinishCooldown = false;
      player._lapPrevX = undefined;
      player._lapPrevY = undefined;
      player.isFinished = false;
      player.finishTime = null;
      player.finishPosition = null;
      player.raceTime = null;
      player.health = 100;
      index++;
    });

    // Reset AI waypoint tracking
    Object.values(this.serverState.aiPlayers).forEach((ai) => {
      ai.currentWaypointIndex = 0;
    });

    this.serverState.raceStarted = false;
    this.serverState.racePhase = 'WAITING';
    this.serverState.countdown = 0;
    this.serverState.winnerId = null;
    this.serverState.startTime = 0;
    this.serverState.finishedPlayers = [];

    // Broadcast race reset event with player starting positions
    const resetState = {};
    Object.entries(this.serverState.players).forEach(([id, player]) => {
      resetState[id] = { ...player };
    });

    this.broadcast('/topic/race-reset', { 
      reset: true,
      players: resetState 
    });
  }

  /**
   * Starts the broadcast loop.
   * Simulates server broadcasting game state to all clients.
   */
  startBroadcast() {
    this.broadcastInterval = setInterval(() => {
      if (!this.connected) return;

      // Get current state
      const state = this.serverState.getPlayersCopy();

      // Broadcast to subscribers
      this.broadcast('/topic/game-state', state);
    }, this.broadcastRateMs);
  }

  /**
   * Stops the broadcast loop.
   */
  stopBroadcast() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
  }

  /**
   * Starts the AI update loop.
   */
  startAILoop() {
    this.lastUpdateTime = Date.now();

    this.aiUpdateInterval = setInterval(() => {
      if (!this.connected || !this.serverState.raceStarted) return;

      const now = Date.now();
      const deltaTime = (now - this.lastUpdateTime) / 1000;
      this.lastUpdateTime = now;

      // Update each AI player
      Object.entries(this.serverState.aiPlayers).forEach(([playerId, ai]) => {
        const player = this.serverState.players[playerId];
        if (!player || player.isFinished) return;

        // Simple AI: follow a basic path around the track
        this.updateAI(player, ai, deltaTime);

        // Update lap tracking for AI
        const lapEvent = updateLapTracking(player, this.serverState.maxLaps, this.serverState.trackLayout);
        if (lapEvent === 'race_finish') {
          player.raceTime = Date.now() - this.serverState.startTime;
          this.serverState.finishedPlayers.push(playerId);
          player.finishPosition = this.serverState.finishedPlayers.length;
          
          // Broadcast AI finish
          this.broadcast('/topic/player-finished', {
            playerId,
            position: player.finishPosition,
            raceTime: player.raceTime,
            currentLap: player.currentLap,
          });
        }
      });
    }, 16); // ~60 FPS
  }

  /**
   * Stops the AI update loop.
   */
  stopAILoop() {
    if (this.aiUpdateInterval) {
      clearInterval(this.aiUpdateInterval);
      this.aiUpdateInterval = null;
    }
  }

  /**
   * Updates AI player behavior.
   * Follows oval track using waypoints.
   */
  updateAI(player, ai, deltaTime) {
    const { x, y, angle } = player;
    const tl = this.serverState.trackLayout;

    let targetWaypoint = null;
    if (player.lapNextSectorId >= 17) {
      const fin = tl.find((i) => i.type === 'finish-line-1');
      if (fin) {
        targetWaypoint = { x: toWorldX(fin.x), y: toWorldY(fin.y) };
      }
    }
    if (!targetWaypoint) {
      const sid = Math.min(Math.max(1, player.lapNextSectorId || 1), 16);
      targetWaypoint = getSectorTargetWorld(tl, sid);
    }
    if (!targetWaypoint) {
      targetWaypoint = { x: x + 100, y: y };
    }

    const targetAngle = Math.atan2(targetWaypoint.y - y, targetWaypoint.x - x);
    let angleDiff = targetAngle - angle;

    // Normalize angle difference to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // AI input with some variation
    const turnThreshold = 0.08;
    const shouldBrake = Math.abs(angleDiff) > 0.5 && Math.abs(player.speed) > 200;

    const input = {
      accelerate: !shouldBrake,
      brake: shouldBrake,
      turnLeft: angleDiff < -turnThreshold,
      turnRight: angleDiff > turnThreshold,
      handbrake: false,
    };

    updateCarPhysics(player, input, deltaTime);

    const collision = handleCollision(player, tl);
    if (collision.collided && collision.damage > 0) {
      if (!player.health) player.health = 100;
      player.health -= collision.damage;

      if (player.health <= 0) {
        player.health = 100;
        const slots = getStartPositionsFromLayout(tl);
        const rp = slots[0] || { ...targetWaypoint, angle: targetAngle };
        player.x = rp.x;
        player.y = rp.y;
        player.speed = 0;
        player.velocityX = 0;
        player.velocityY = 0;
        player.angle = typeof rp.angle === 'number' ? rp.angle : targetAngle;
      }
    }
  }

  /**
   * Broadcasts a message to all subscribers of a topic.
   */
  broadcast(destination, data) {
    const subs = this.subscriptions[destination];
    if (!subs) return;

    Object.values(subs).forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[MockWS] Error in subscriber callback:`, error);
      }
    });
  }

  /**
   * Gets the current race state.
   */
  getRaceState() {
    if (!this.serverState) return null;

    return {
      raceStarted: this.serverState.raceStarted,
      racePhase: this.serverState.racePhase,
      countdown: this.serverState.countdown,
      winnerId: this.serverState.winnerId,
    };
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────

let mockWSInstance = null;

/**
 * Gets the global mock WebSocket instance.
 */
export function getMockWebSocket() {
  return mockWSInstance;
}

/**
 * Creates and connects a mock WebSocket instance.
 */
export function createMockWebSocket(options = {}) {
  if (mockWSInstance) {
    mockWSInstance.disconnect();
  }

  mockWSInstance = new MockWebSocketService(options);
  return mockWSInstance;
}

// ─── React Hook ─────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * useMockWebSocket - React hook for using the mock WebSocket service.
 *
 * @param {Object} options - MockWebSocketService options
 * @returns {Object} { connected, serverState, send, startRace, resetRace }
 */
export function useMockWebSocket(options = {}) {
  const [connected, setConnected] = useState(false);
  const [serverState, setServerState] = useState({});
  const [raceState, setRaceState] = useState({
    raceStarted: false,
    countdown: 0,
  });

  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new MockWebSocketService(options);
    wsRef.current = ws;

    ws.onConnect = () => {
      setConnected(true);

      // Subscribe to game state
      ws.subscribe('/topic/game-state', (state) => {
        setServerState(state);
      });

      // Subscribe to countdown
      ws.subscribe('/topic/countdown', (data) => {
        console.log('[useMockWebSocket] Countdown received:', data.count);
        setRaceState((prev) => ({ ...prev, countdown: data.count }));
      });

      // Subscribe to race started
      ws.subscribe('/topic/race-started', (data) => {
        console.log('[useMockWebSocket] Race started!');
        setRaceState((prev) => ({ ...prev, raceStarted: true, countdown: 0 }));
      });

      // Subscribe to race reset
      ws.subscribe('/topic/race-reset', (data) => {
        console.log('[useMockWebSocket] Race reset!');
        setRaceState({ raceStarted: false, countdown: 0 });
        // Update server state with reset positions
        if (data.players) {
          setServerState(data.players);
        }
      });

      // Subscribe to player finished event
      ws.subscribe('/topic/player-finished', (data) => {
        console.log('[useMockWebSocket] Player finished:', data);
      });
    };

    ws.onDisconnect = () => {
      setConnected(false);
    };

    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, []);

  // Update race state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.serverState) {
        setRaceState({
          raceStarted: wsRef.current.serverState.raceStarted,
          countdown: wsRef.current.serverState.countdown,
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const send = useCallback((destination, message) => {
    if (wsRef.current) {
      wsRef.current.send(destination, message);
    }
  }, []);

  const startRace = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send('/app/start-race', {});
    }
  }, []);

  const resetRace = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send('/app/reset-race', {});
    }
  }, []);

  return {
    connected,
    serverState,
    raceStarted: raceState.raceStarted,
    countdown: raceState.countdown,
    send,
    startRace,
    resetRace,
    ws: wsRef.current,
  };
}

export default MockWebSocketService;
