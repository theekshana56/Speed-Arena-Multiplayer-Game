import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  updateLapTracking,
  isOnRoad,
  MAX_HEALTH,
  TOP_SPEED,
  LAP_CONFIG,
} from '../game/carPhysics';
import {
  buildPolylineGameLayoutForMap,
  getMapTrackPreset,
  toWorldVerts,
  getBoundingBox,
} from '../game/track/polylineTrack.js';

const CAR_COLORS = {
  red: '#ff3333',
  blue: '#00a2ff',
  green: '#00e87a',
  yellow: '#ffd520',
};

/** World px: hide far start-grid decals while racing */
const START_POS_CULL_DIST_SQ = 4500 * 4500;

function trackPieceDepth(type) {
  if (type === 'road-1' || type === 'road-2' || type === 'finish-line-1' || type === 'start-pos') return 1;
  if (type === 'bush-1') return 2;
  if (type === 'tree-1') return 3;
  return 1;
}

export default function GameCanvas({
  playerId = 'player_1',
  roomId = 'room_1',
  mapId = 'forest',
  serverState = {},
  onSendInput,
  raceStarted = false,
  countdown = 0,
  width = 1200,
  height = 800,
  onLapChange,
  onRaceFinish,
}) {
  const canvasRef = useRef(null);
  const localPlayerRef = useRef(createCarState(playerId));

  const trackPreset = useMemo(() => getMapTrackPreset(mapId), [mapId]);
  const trackLayout = useMemo(() => buildPolylineGameLayoutForMap(mapId), [mapId]);
  const worldCenterline = useMemo(() => toWorldVerts(trackPreset.verts), [trackPreset]);
  const worldBbox = useMemo(() => getBoundingBox(worldCenterline), [worldCenterline]);

  const mapTheme = useMemo(() => {
    const m = (mapId || 'forest').toString().toLowerCase();
    if (m === 'desert') return { bg: '#141008', ground: '#6b5420' };
    if (m === 'snow') return { bg: '#0a0e14', ground: '#2a3540' };
    return { bg: '#0a0f0a', ground: '#143214' };
  }, [mapId]);

  const [assets, setAssets] = useState({
    loaded: false,
    sprites: {},
  });

  useEffect(() => {
    const spriteNames = [
      'car-1',
      'car-2',
      'car-shadow-1',
      'road-1',
      'road-bend-1',
      'finish-line-1',
      'ground',
      'start-position-mark-1',
    ];
    let loadedCount = 0;
    const totalCount = spriteNames.length;
    const loadedSprites = {};

    spriteNames.forEach((name) => {
      const img = new Image();
      img.src = `/src/assets/game/${name}.png`;
      img.onload = () => {
        loadedSprites[name] = img;
        loadedCount++;
        if (loadedCount === totalCount) {
          setAssets({ loaded: true, sprites: loadedSprites });
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load sprite: ${name}`);
        loadedCount++;
        if (loadedCount === totalCount) {
          setAssets({ loaded: true, sprites: loadedSprites });
        }
      };
    });
  }, []);

  const [respawnMessage, setRespawnMessage] = useState(null);
  const [raceFinished, setRaceFinished] = useState(false);
  const [finishData, setFinishData] = useState(null);
  const raceStartTimeRef = useRef(0);
  const otherPlayersRef = useRef({});
  const lastInputSentRef = useRef(0);
  const INPUT_SEND_RATE = 1000 / 30;

  const FOREST_SCALE = 20;

  const resetLocalPlayer = useCallback(() => {
    if (trackLayout.length === 0) return;

    const startItems = trackLayout.filter((i) => i.type === 'start-pos');
    const pos = startItems.length > 0 ? startItems[0] : { x: 0, y: 0, rot: 0 };

    const player = localPlayerRef.current;
    player.x = pos.x * FOREST_SCALE;
    player.y = pos.y * FOREST_SCALE;
    player.angle = (pos.rot || 0) * (Math.PI / 180);
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
    player.health = MAX_HEALTH;

    setRaceFinished(false);
    setFinishData(null);
  }, [trackLayout]);

  useEffect(() => {
    if (!raceStarted && countdown === 0 && trackLayout.length > 0) {
      resetLocalPlayer();
    }
  }, [raceStarted, countdown, resetLocalPlayer, trackLayout]);

  useEffect(() => {
    if (raceStarted && raceStartTimeRef.current === 0) {
      raceStartTimeRef.current = Date.now();
    } else if (!raceStarted) {
      raceStartTimeRef.current = 0;
    }
  }, [raceStarted]);

  const { input } = useInput({
    enabled: raceStarted && !raceFinished,
    onInputChange: (newInput, seq) => {
      if (onSendInput) sendInput(newInput, seq);
    },
  });

  const sendInput = useCallback(
    (inputState, seq) => {
      const now = Date.now();
      if (now - lastInputSentRef.current < INPUT_SEND_RATE && !inputState.accelerate) return;
      lastInputSentRef.current = now;

      const localPlayer = localPlayerRef.current;
      onSendInput({
        playerId,
        roomId,
        ...inputState,
        timestamp: now,
        inputSequence: seq,
        deltaTimeMs: 16,
        clientX: localPlayer.x,
        clientY: localPlayer.y,
        clientAngle: localPlayer.angle,
        clientSpeed: localPlayer.speed,
      });
    },
    [playerId, roomId, onSendInput],
  );

  useEffect(() => {
    if (!serverState) return;
    const now = Date.now();
    Object.entries(serverState).forEach(([id, state]) => {
      if (!state || id === playerId) return;
      const prevData = otherPlayersRef.current[id];
      if (!prevData) {
        otherPlayersRef.current[id] = {
          current: { ...state },
          target: { ...state },
          interpolationStart: now,
        };
      } else {
        otherPlayersRef.current[id] = {
          current: { ...prevData.current },
          target: { ...state },
          interpolationStart: now,
        };
      }
    });
    Object.keys(otherPlayersRef.current).forEach((id) => {
      if (!serverState[id]) delete otherPlayersRef.current[id];
    });
  }, [serverState, playerId]);

  useGameLoop(
    (deltaTime) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      if (raceStarted) {
        const localPlayer = localPlayerRef.current;
        updateCarPhysics(localPlayer, input, deltaTime);

        const collision = handleCollision(localPlayer, trackLayout);
        if (collision.collided) {
          if (applyDamage(localPlayer, collision.damage)) {
            respawnCar(localPlayer, trackLayout);
          }
        }

        if (!localPlayer.isFinished) {
          const lapEvent = updateLapTracking(localPlayer, LAP_CONFIG.totalLaps, trackLayout);
          if (lapEvent === 'lap_complete' && onLapChange) onLapChange(localPlayer.currentLap);
          if (lapEvent === 'race_finish') {
            const raceTime = Date.now() - raceStartTimeRef.current;
            const position = calculateFinalPosition();
            setRaceFinished(true);
            setFinishData({ position, raceTime, laps: localPlayer.currentLap, playerId });
            if (onRaceFinish)
              onRaceFinish({ position, raceTime, laps: localPlayer.currentLap });
          }
        }

        const now = Date.now();
        Object.values(otherPlayersRef.current).forEach((p) => {
          const t = Math.min(1, (now - p.interpolationStart) / 100);
          const interp = interpolateCarState(p.current, p.target, t);
          Object.assign(p.current, interp);
        });
      }

      render(ctx, canvas.width, canvas.height);
    },
    { paused: false },
  );

  const render = (ctx, w, h) => {
    const localPlayer = localPlayerRef.current;

    ctx.fillStyle = mapTheme.bg;
    ctx.fillRect(0, 0, w, h);

    if (!assets.loaded) {
      ctx.fillStyle = '#fff';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('LOADING...', w / 2, h / 2);
      return;
    }

    const hasRoads = trackLayout.some((i) => i.type === 'road-1' || i.type === 'road-2');
    if (!hasRoads) {
      ctx.fillStyle = '#fff';
      ctx.fillText('NO TRACK', w / 2, h / 2);
      return;
    }

    const margin = 100;
    const bw = worldBbox.width + margin * 2;
    const bh = worldBbox.height + margin * 2;
    const scale = Math.min(w / bw, h / bh, 1);
    const cx = (worldBbox.minX + worldBbox.maxX) / 2;
    const cy = (worldBbox.minY + worldBbox.maxY) / 2;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    const pad = 2000;
    if (assets.sprites.ground) {
      const pattern = ctx.createPattern(assets.sprites.ground, 'repeat');
      ctx.fillStyle = pattern;
      ctx.fillRect(
        worldBbox.minX - pad,
        worldBbox.minY - pad,
        worldBbox.width + pad * 2,
        worldBbox.height + pad * 2,
      );
    } else {
      ctx.fillStyle = mapTheme.ground;
      ctx.fillRect(
        worldBbox.minX - pad,
        worldBbox.minY - pad,
        worldBbox.width + pad * 2,
        worldBbox.height + pad * 2,
      );
    }

    const wx = (it) => (it.x || 0) * FOREST_SCALE;
    const wy = (it) => (it.y || 0) * FOREST_SCALE;

    const drawOrder = trackLayout
      .filter((item) => {
        const t = item.type;
        if (t === 'checkpoint') return false;
        if (t === 'start-pos' && raceStarted) {
          const xw = wx(item);
          const yw = wy(item);
          const dx = xw - localPlayer.x;
          const dy = yw - localPlayer.y;
          if (dx * dx + dy * dy > START_POS_CULL_DIST_SQ) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = trackPieceDepth(a.type);
        const db = trackPieceDepth(b.type);
        if (da !== db) return da - db;
        const ay = wy(a);
        const by = wy(b);
        if (Math.abs(ay - by) > 1) return ay - by;
        return wx(a) - wx(b);
      });

    const SPRITE_SCALE = 2.0;

    drawOrder.forEach((item) => {
      let assetName = item.type;
      if (item.type === 'road-2') assetName = 'road-bend-1';
      if (item.type === 'start-pos') assetName = 'start-position-mark-1';

      const sprite = assets.sprites[assetName];
      if (!sprite) return;
      const rot = item.rot ?? item.rotation ?? 0;
      ctx.save();
      ctx.translate(item.x * FOREST_SCALE, item.y * FOREST_SCALE);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(SPRITE_SCALE, SPRITE_SCALE);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();
    });

    const sl = trackPreset.startLine;
    const sx1 = sl.p1.x * FOREST_SCALE;
    const sy1 = sl.p1.y * FOREST_SCALE;
    const sx2 = sl.p2.x * FOREST_SCALE;
    const sy2 = sl.p2.y * FOREST_SCALE;
    const dx = sx2 - sx1;
    const dy = sy2 - sy1;
    const segLen = Math.hypot(dx, dy) || 1;
    const ux = dx / segLen;
    const uy = dy / segLen;
    const px = -uy;
    const py = ux;
    const stripe = 14;
    const n = Math.max(1, Math.floor(segLen / stripe));
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * segLen;
      const t1 = ((i + 1) / n) * segLen;
      const mid = (i + 0.5) / n;
      const ox = sx1 + ux * t0;
      const oy = sy1 + uy * t0;
      const ox2 = sx1 + ux * t1;
      const oy2 = sy1 + uy * t1;
      ctx.fillStyle = i % 2 === 0 ? '#f0f0f0' : '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(ox + px * 4, oy + py * 4);
      ctx.lineTo(ox2 + px * 4, oy2 + py * 4);
      ctx.lineTo(ox2 - px * 4, oy2 - py * 4);
      ctx.lineTo(ox - px * 4, oy - py * 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();

    Object.entries(otherPlayersRef.current).forEach(([id, p]) => {
      drawCar(ctx, p.current, id.toUpperCase(), assets.sprites['car-2']);
    });
    drawCar(ctx, localPlayer, playerId.toUpperCase(), assets.sprites['car-1']);

    ctx.restore();

    drawHUD(ctx, w, h);
    if (respawnMessage) drawOverlay(ctx, w, h, respawnMessage);
    if (raceFinished && finishData) drawRaceFinish(ctx, w, h, finishData);
    if (countdown > 0) drawCountdown(ctx, w, h, countdown);
    else if (!raceStarted) drawStartPrompt(ctx, w, h);
  };

  const drawCar = (ctx, car, label, sprite) => {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const carW = 96;
    const carH = 48;
    if (assets.sprites['car-shadow-1'])
      ctx.drawImage(assets.sprites['car-shadow-1'], -carW / 2 + 6, -carH / 2 + 8, carW, carH);
    if (sprite) ctx.drawImage(sprite, -carW / 2, -carH / 2, carW, carH);
    else {
      ctx.fillStyle = 'red';
      ctx.fillRect(-carW / 2, -carH / 2, carW, carH);
    }
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, car.x, car.y - 44);
  };

  const drawHUD = (ctx, w, h) => {
    const p = localPlayerRef.current;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(w - 180, h - 80, 160, 60);
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.fillText(`${getDisplaySpeed(p.speed)} km/h`, w - 170, h - 45);
  };

  const drawOverlay = (ctx, w, h, msg) => {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(msg, w / 2, h / 2);
  };

  const drawCountdown = (ctx, w, h, count) => {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(count, w / 2, h / 2);
  };

  const drawStartPrompt = (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(w / 2 - 150, h / 2 - 30, 300, 60);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('READY TO RACE', w / 2, h / 2);
  };

  const drawRaceFinish = (ctx, w, h, data) => {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`FINISH: ${data.position}${getOrdinalSuffix(data.position)}`, w / 2, h / 2);
  };

  const calculateFinalPosition = () => {
    let pos = 1;
    Object.values(otherPlayersRef.current).forEach((p) => {
      if (p.current.isFinished) pos++;
    });
    return pos;
  };

  const getOrdinalSuffix = (i) => {
    const j = i % 10;
    const k = i % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black rounded-xl shadow-2xl border-4 border-slate-800">
      <canvas ref={canvasRef} width={width} height={height} className="max-w-full max-h-full object-contain" />
    </div>
  );
}
