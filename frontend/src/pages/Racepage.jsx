import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { apiFetch } from "../services/apiClient";
import { tokenService } from "../services/tokenService";
import GameCanvas from "../components/GameCanvas";
import UnityRaceCanvas from "../components/UnityRaceCanvas";
import { getStartPositionsFromLayout } from "../game/carPhysics";
import { buildPolylineGameLayoutForMap, canonicalMapId, normalizeMapId } from "../game/track/polylineTrack.js";
import { getOrCreateNetworkPlayerId } from "../session/playerIdentity.js";
import { clampGridSlot } from "../utils/gridSlot.js";
import { PALETTE } from "../theme/midnightSpark.js";

const PREFER_UNITY_RACE = import.meta.env.VITE_USE_UNITY_RACE !== "false";


const WS_URL = "http://127.0.0.1:8080/ws-racing";
const CAR_COLORS = { 
  red: "#ff3333", 
  blue: "#00a2ff", 
  green: "#00e87a", 
  yellow: "#ffd520" 
};

// Legacy waitpoints removed

export default function RacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const playerName = sessionStorage.getItem("playerName") || "PLAYER";
  const carColorKey = sessionStorage.getItem("carColor") || "red";
  const roomId = sessionStorage.getItem("roomId") || "room_001";
  const playerId = useMemo(() => getOrCreateNetworkPlayerId(), []);
  const [mapId, setMapId] = useState(() => canonicalMapId(sessionStorage.getItem("mapId")));
  const [startAtEpochMs, setStartAtEpochMs] = useState(() => {
    const v = Number(sessionStorage.getItem("startAtEpochMs"));
    return Number.isFinite(v) && v > 0 ? v : null;
  });
  const [nowMs, setNowMs] = useState(Date.now());
  const [startIndex, setStartIndex] = useState(() => {
    // Do not trust previous sessionStorage values for multiplayer start grid.
    // The server will push `/topic/room/${roomId}/slots` shortly after join.
    return 0;
  });

  const [connected, setConnected] = useState(false);
  const [isRacing, setIsRacing] = useState(false);
  const [cars, setCars] = useState({});
  const [laps, setLaps] = useState(0);
  const [winner, setWinner] = useState(null);
  const [log, setLog] = useState([]);
  const [resultsSent, setResultsSent] = useState(false);
  const [raceStats, setRaceStats] = useState(null);
  /** idle | saving | saved | error — controls leaderboard CTA (bug 2: no auto-nav). */
  const [resultSaveState, setResultSaveState] = useState("idle");

  const startTimeRef = useRef(null);
  const topSpeedRef = useRef(0);

  const clientRef = useRef(null);
  const lapRef = useRef(0);
  const isRacingRef = useRef(false);
  const playerIdRef = useRef(playerId);
  const winnerRef = useRef(null);
  const unityInstanceRef = useRef(null);
  // Debug helper: avoid console spam. We log each remote playerId at most once/sec.
  const lastForwardAtByPlayerRef = useRef({});
  const gridSlotRef = useRef(clampGridSlot(startIndex));
  const raceIdentityRef = useRef({
    playerId,
    roomId,
    carColor: carColorKey,
    isRacing,
    gridSlot: clampGridSlot(startIndex),
  });

  const [unityLoadFailed, setUnityLoadFailed] = useState(false);

  const gridStartPositions = useMemo(() => {
    const layout = buildPolylineGameLayoutForMap(normalizeMapId(mapId));
    const pts = getStartPositionsFromLayout(layout);
    return pts.length ? pts : [{ x: 1310, y: 400, angle: Math.PI / 2 }];
  }, [mapId]);

  useEffect(() => { isRacingRef.current = isRacing; }, [isRacing]);
  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { winnerRef.current = winner; }, [winner]);
  useEffect(() => {
    const gs = clampGridSlot(startIndex);
    gridSlotRef.current = gs;
    raceIdentityRef.current = { playerId, roomId, carColor: carColorKey, isRacing, gridSlot: gs };
  }, [playerId, roomId, carColorKey, isRacing, startIndex]);

  const showUnityClient = PREFER_UNITY_RACE && !unityLoadFailed;

  /** Optional deep-link: /race?map=desert — only if room has not already stored a map (lobby/server wins). */
  useEffect(() => {
    const q = canonicalMapId(searchParams.get("map"));
    if (!q) return;
    if (canonicalMapId(sessionStorage.getItem("mapId"))) return;
    setMapId(q);
    sessionStorage.setItem("mapId", q);
  }, [searchParams]);

  const addLog = (msg) => setLog(prev => [...prev.slice(-6), msg]);

  const stopRacing = () => {
    setIsRacing(false);
  };

  // Legacy draw loop removed as it is now handled by GameCanvas

  // WebSocket connect on mount (session identity fixed for this page visit)
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      onConnect: () => {
        setConnected(true);
        addLog(`✅ Link established as ${playerId}`);
        client.subscribe("/topic/game-state", msg => {
          const car = JSON.parse(msg.body);
          if (car.roomId && car.roomId !== roomId) return;

          setCars(prev => ({ ...prev, [car.playerId]: car }));

          const inst = unityInstanceRef.current;
          // Forward all car states into Unity.
          // Unity decides whether a DTO is "local" (filtered by its own SetLocalIdentity playerId)
          // or a remote opponent. This avoids React/Unity playerId desync issues between tabs.
          if (inst) {
            try {
              const pid = car?.playerId;
              const now = Date.now();
              const last = lastForwardAtByPlayerRef.current[pid] || 0;
              if (pid && now - last > 1000) {
                lastForwardAtByPlayerRef.current[pid] = now;
                console.log(
                  `[UnityForward] my=${playerIdRef.current} forwarding=${pid} roomId=${car?.roomId} gridSlot=${car?.gridSlot}`
                );
              }
              inst.SendMessage("SpeedArenaNetBridge", "ApplyRemoteState", msg.body);
            } catch (err) {
              console.warn("[Unity] ApplyRemoteState", err);
            }
          }

          // Only the *local* player's finish should open results — remote finishes are in `cars` only.
          if (
            car.lapsCompleted >= 3 &&
            !winnerRef.current &&
            isRacingRef.current &&
            String(car.playerId) === String(playerIdRef.current)
          ) {
            setWinner(car.playerId);
          }
        });

        // Sync host-selected map
        client.subscribe(`/topic/room/${roomId}/map`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            const newMap = canonicalMapId(data?.mapId);
            if (!newMap) return;
            setMapId(newMap);
            sessionStorage.setItem("mapId", newMap);

            const inst = unityInstanceRef.current;
            if (inst) {
              try {
                inst.SendMessage("SpeedArenaNetBridge", "LoadMap", newMap);
              } catch { /* ignore */ }
            }
          } catch {
            // ignore
          }
        });

        // Sync slot assignments (join order -> start grid index)
        client.subscribe(`/topic/room/${roomId}/slots`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            const rawSlot = data?.[playerId];
            const n = Number(rawSlot);
            if (Number.isFinite(n) && n >= 0) {
              const gs = clampGridSlot(n);
              setStartIndex(gs);
              sessionStorage.setItem("startIndex", String(gs));
            }
          } catch {
            // ignore
          }
        });

        // Shared start countdown timestamp
        client.subscribe(`/topic/room/${roomId}/start`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            if (data?.startAtEpochMs) {
              const t = Number(data.startAtEpochMs);
              if (Number.isFinite(t) && t > 0) {
                setStartAtEpochMs(t);
                sessionStorage.setItem("startAtEpochMs", String(t));
              }
            }
            if (data?.mapId) {
              const m = canonicalMapId(data.mapId);
              if (m) {
                setMapId(m);
                sessionStorage.setItem("mapId", m);
              }
            }
          } catch {
            // ignore
          }
        });

        const start = gridStartPositions[startIndex] || gridStartPositions[0];
        client.publish({
          destination: "/app/player.join",
          body: JSON.stringify({
            playerId,
            roomId,
            carColor: carColorKey,
            x: start.x,
            y: start.y,
            angle: start.angle,
            speed: 0,
            status: "WAITING",
            gridSlot: clampGridSlot(startIndex),
          }),
        });
      },
      onDisconnect: () => { setConnected(false); addLog("🔌 Link severed"); },
      onStompError: () => addLog("❌ Sync failure — backend unreachable"),
    });
    client.activate();
    clientRef.current = client;
    return () => { stopRacing(); client.deactivate(); };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const startRacing = () => {
    if (isRacing) return;
    setIsRacing(true);
    startTimeRef.current = Date.now();
    setResultsSent(false);
    setRaceStats(null);
    setResultSaveState("idle");
    addLog("🏁 Mission initialized!");
  };

  // Tick for countdown rendering + start trigger (nowMs must drive the start effect below)
  useEffect(() => {
    if (!startAtEpochMs) return undefined;
    const t = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(t);
  }, [startAtEpochMs]);

  // Solo / direct /race: no host start in session → local practice countdown so Unity gets SetRacing("1")
  useEffect(() => {
    const id = setTimeout(() => {
      let scheduledPractice = false;
      setStartAtEpochMs((prev) => {
        if (prev != null) return prev;
        const s = sessionStorage.getItem("startAtEpochMs");
        const n = Number(s);
        if (Number.isFinite(n) && n > 0) return n;
        scheduledPractice = true;
        const at = Date.now() + 3000;
        sessionStorage.setItem("startAtEpochMs", String(at));
        return at;
      });
      if (scheduledPractice) {
        addLog("Practice mode — start the backend for multiplayer sync.");
      }
    }, 1200);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (winner) return;
    if (!startAtEpochMs) return;
    if (Date.now() < startAtEpochMs) return;
    if (!isRacing) startRacing();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nowMs drives re-check; startRacing intentionally omitted
  }, [winner, startAtEpochMs, isRacing, nowMs]);

  useEffect(() => {
    const inst = unityInstanceRef.current;
    if (!inst || !showUnityClient) return;
    try {
      inst.SendMessage("SpeedArenaNetBridge", "SetRacing", isRacing ? "1" : "0");
    } catch { /* no-op */ }
  }, [isRacing, showUnityClient]);

  useEffect(() => {
    const inst = unityInstanceRef.current;
    if (!inst || !showUnityClient) return;
    try {
      inst.SendMessage(
        "SpeedArenaNetBridge",
        "SetLocalIdentity",
        JSON.stringify({ playerId, roomId, carColor: carColorKey, gridSlot: clampGridSlot(startIndex) }),
      );
    } catch { /* no-op */ }
  }, [playerId, roomId, carColorKey, startIndex, showUnityClient]);

  useEffect(() => {
    const inst = unityInstanceRef.current;
    if (!inst || !showUnityClient) return;
    try {
      inst.SendMessage("SpeedArenaNetBridge", "LoadMap", normalizeMapId(mapId));
    } catch { /* no-op */ }
  }, [mapId, showUnityClient]);

  // Re-send join position once we know our start grid index
  useEffect(() => {
    if (!connected) return;
    const start = gridStartPositions[startIndex] || gridStartPositions[0];
    clientRef.current?.publish({
      destination: "/app/player.join",
      body: JSON.stringify({
        playerId,
        roomId,
        carColor: carColorKey,
        x: start.x,
        y: start.y,
        angle: start.angle,
        speed: 0,
        status: "WAITING",
        gridSlot: clampGridSlot(startIndex),
      }),
    });
  }, [connected, startIndex, playerId, roomId, carColorKey, gridStartPositions]);

  const handleUnityReady = (instance) => {
    unityInstanceRef.current = instance;
    setUnityLoadFailed(false);
    const id = raceIdentityRef.current;
    const roomMap =
      canonicalMapId(sessionStorage.getItem("mapId")) || canonicalMapId(mapId) || "forest";
    try {
      // Order matches SpeedArenaNetBridge: identity → racing state → scene from room map id
      instance.SendMessage(
        "SpeedArenaNetBridge",
        "SetLocalIdentity",
        JSON.stringify({
          playerId: id.playerId,
          roomId: id.roomId,
          carColor: id.carColor,
          gridSlot: clampGridSlot(id.gridSlot ?? gridSlotRef.current),
        }),
      );
      instance.SendMessage("SpeedArenaNetBridge", "SetRacing", id.isRacing ? "1" : "0");
      instance.SendMessage("SpeedArenaNetBridge", "LoadMap", roomMap);
    } catch (err) {
      console.warn("[Unity] init bridge", err);
    }

    // Unity may load slightly after the first /topic/game-state frames arrive.
    // Replay the latest known car states so every tab shows all cars immediately.
    setTimeout(() => {
      const inst = unityInstanceRef.current;
      if (!inst) return;
      Object.values(cars).forEach((car) => {
        if (!car) return;
        if (car.roomId && car.roomId !== roomId) return;
        try {
          inst.SendMessage("SpeedArenaNetBridge", "ApplyRemoteState", JSON.stringify(car));
        } catch (e) {
          // ignore per car
        }
      });
    }, 1000);
  };

  const countdownLeft = startAtEpochMs ? Math.max(0, Math.ceil((startAtEpochMs - nowMs) / 1000)) : null;

  const handleUnityLocalCarState = (jsonStr) => {
    let o;
    try {
      o = JSON.parse(jsonStr);
    } catch {
      return;
    }
    const currentSpeed = (o.speed || 0) * 0.5;
    if (currentSpeed > topSpeedRef.current) {
      topSpeedRef.current = currentSpeed;
    }

    if (typeof o.lapsCompleted === "number") {
      setLaps(o.lapsCompleted);
      if (o.lapsCompleted > lapRef.current) {
        addLog(`🏆 Lap ${o.lapsCompleted} confirmed!`);
        lapRef.current = o.lapsCompleted;
      }
    }

    if (
      o.lapsCompleted >= 3 &&
      isRacingRef.current &&
      !winnerRef.current &&
      o.playerId === playerIdRef.current
    ) {
      setWinner(playerIdRef.current);
      addLog("🏁 MISSION COMPLETE!");
      stopRacing();
    }

    if (typeof o.gridSlot !== "number" || !Number.isFinite(o.gridSlot)) {
      o.gridSlot = gridSlotRef.current;
    } else {
      o.gridSlot = clampGridSlot(o.gridSlot);
    }

    clientRef.current?.publish({
      destination: "/app/car.move",
      body: JSON.stringify(o),
    });
  };

  // ── Results & Achievements ──
  useEffect(() => {
    if (winner && !resultsSent) {
      if (String(winner) !== String(playerId)) return;
      const finishTime = Date.now();
      const currentStartTime = startTimeRef.current || finishTime;
      const totalTime = (finishTime - currentStartTime) / 1000;
      const finalTopSpeed = topSpeedRef.current;
      const currentName = sessionStorage.getItem("playerName") || sessionStorage.getItem("username") || "PLAYER";

      const numericPlayerId = (() => {
        // Backend expects an Integer `playerId`. Our websocket `playerId` is a string.
        // Hash it deterministically so leaderboard shows stable identities.
        const s = String(playerId || "");
        let h = 0;
        for (let i = 0; i < s.length; i++) {
          h = (h * 31 + s.charCodeAt(i)) >>> 0;
        }
        return h % 1000000000;
      })();

      const numericRoomId = (() => {
        const s = String(roomId || "");
        const m = s.match(/\d+/);
        return m ? Number(m[0]) : 1;
      })();
      
      // Backend does not reliably fill `totalTime` in realtime updates.
      // Prefer finishTime (epoch ms) if present; otherwise fall back to timestamp.
      const finishersSorted = Object.values(cars)
          .filter(c => c?.status === "FINISHED")
          .sort((a, b) => {
            const af = (a.finishTime ?? a.timestamp ?? 0);
            const bf = (b.finishTime ?? b.timestamp ?? 0);
            // Both may be 0 early; keep deterministic order by playerId.
            if (!af && !bf) return String(a.playerId).localeCompare(String(b.playerId));
            return af - bf;
          });

      let rank = finishersSorted.findIndex(c => c.playerId === playerId) + 1;
      
      if (rank <= 0) {
          rank = (winner === playerId) ? 1 : finishersSorted.length + 1;
      }

      const stats = {
        name: currentName,
        time: totalTime,
        topSpeed: finalTopSpeed,
        rank: rank,
        achievements: []
      };

      if (rank === 1) stats.achievements.push("GOLD CHAMPION");
      else if (rank <= 3) stats.achievements.push("PODIUM FINISHER");
      if (finalTopSpeed > 195) stats.achievements.push("SPEED DEMON");
      if (totalTime < 24) stats.achievements.push("LIGHTNING FAST");
      if (rank > 0) stats.achievements.push("DEVOYED");

      setResultSaveState("saving");
      setRaceStats(stats);
      setResultsSent(true);

      const saveResult = async () => {
        const payload = {
          playerId: numericPlayerId,
          playerName: currentName,
          roomId: numericRoomId,
          position: rank,
          totalTime: totalTime,
          topSpeed: finalTopSpeed,
          achievements: stats.achievements.join(",")
        };
        
        try {
          const token = tokenService.get();
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          await apiFetch('/api/results/save', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
          setResultSaveState("saved");
        } catch (err) {
          console.error(">>> ERROR SAVING RESULT:", err);
          setResultSaveState("error");
        }
      };
      
      saveResult();
    }
  }, [winner, resultsSent, cars, playerId]);


  const [dimensions, setDimensions] = useState({ 
    width: Math.max(window.innerWidth - 380, 1020), 
    height: Math.max(window.innerHeight - 200, 705) 
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: Math.max(window.innerWidth - 380, 1020),
        height: Math.max(window.innerHeight - 200, 705)
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  const color = CAR_COLORS[carColorKey] || "#ff3333";

  return (
    <div style={s.screen}>
      <div style={s.grid} />

      {/* Winner overlay */}
      {winner && raceStats && (
        <div style={s.winnerOverlay}>
          <div style={{ ...s.winnerCard, borderColor: `${color}40`, boxShadow: `0 0 80px ${color}20` }}>
            <div style={s.winnerTrophy}>🏆</div>
            <div style={s.winnerTitle}>MISSION COMPLETE</div>
            <div style={{ ...s.winnerName, color, textShadow: `0 0 30px ${color}60` }}>
              {raceStats.rank === 1 ? "ELITE RANK #1" : 
               raceStats.rank === 2 ? "SECURE RANK #2" : 
               raceStats.rank === 3 ? "PODIUM RANK #3" : `RANK #${raceStats.rank}`}
            </div>

            <div style={s.statsGrid}>
               <div style={s.statItem}>
                 <span style={s.statLabel}>DRIVER</span>
                 <span style={s.statValue}>{playerName.toUpperCase()}</span>
               </div>
               <div style={s.statItem}>
                 <span style={s.statLabel}>TOTAL TIME</span>
                 <span style={s.statValue}>{raceStats.time.toFixed(2)}s</span>
               </div>
               <div style={s.statItem}>
                 <span style={s.statLabel}>PEAK SPEED</span>
                 <span style={s.statValue}>{raceStats.topSpeed.toFixed(1)} km/h</span>
               </div>
            </div>

            <div style={s.achievementsBox}>
              <div style={{ fontSize:"10px", color: PALETTE.orange, letterSpacing:"4px", marginBottom:"12px", fontFamily: "'Orbitron'" }}>AWARDS OBTAINED</div>
              <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", justifyContent:"center" }}>
                {raceStats.achievements.map(a => (
                  <span key={a} style={s.badge}>{a}</span>
                ))}
              </div>
            </div>

            <div style={s.winnerBtnStack}>
              <button
                type="button"
                disabled={resultSaveState === "saving"}
                onClick={() => {
                  if (resultSaveState === "saving") return;
                  navigate("/leaderboard");
                }}
                style={{
                  ...s.lbBtn,
                  opacity: resultSaveState === "saving" ? 0.45 : 1,
                  cursor: resultSaveState === "saving" ? "not-allowed" : "pointer",
                }}
              >
                {resultSaveState === "saving"
                  ? "SAVING RESULT…"
                  : resultSaveState === "error"
                    ? "VIEW LEADERBOARD (SAVE FAILED)"
                    : "VIEW LEADERBOARD"}
              </button>
              <div style={s.winnerBtns}>
              <button onClick={() => { 
                setWinner(null); 
                setLaps(0); 
                lapRef.current = 0; 
                setResultsSent(false); 
                setRaceStats(null);
                setResultSaveState("idle");
                setCars({});
                setStartAtEpochMs(null);
                sessionStorage.removeItem("startAtEpochMs");
                setIsRacing(false);
              }} style={{ ...s.playAgainBtn, background: color, boxShadow: `0 0 20px ${color}40` }}>RE-DEPLOY</button>
              <button onClick={() => navigate("/home")} style={s.homeBtn}>← TERMINAL</button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Top HUD */}
      <div style={s.hud}>
        <button onClick={() => { stopRacing(); navigate("/lobby"); }} style={s.backBtn}>← LOBBY</button>

        <div style={s.hudCenter}>
          <div style={{ ...s.lapDisplay, color, textShadow: `0 0 10px ${color}60` }}>
            LAP <span style={{ fontSize: "28px" }}>{laps}</span> <span style={{ color: "rgba(255,255,255,0.2)" }}>/ 3</span>
          </div>
        </div>

        <div style={s.hudRight}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: connected ? PALETTE.neonMint : PALETTE.orange, display: "inline-block", boxShadow: `0 0 10px ${connected ? PALETTE.neonMint : PALETTE.orange}` }} />
            <span style={{ fontSize: "10px", color: connected ? PALETTE.neonMint : PALETTE.orange, letterSpacing: "2px", fontWeight: "bold" }}>{connected ? "SYNC LIVE" : "LINK OFFLINE"}</span>
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", fontFamily: "'Orbitron'" }}>
            {Object.keys(cars).length} ACTIVE LINKS
          </div>
        </div>
      </div>

      {/* Main area */}
      <div style={s.main}>
        <div style={{ position: "relative", flex: 1, display: "flex", justifyContent: "center" }}>
            {showUnityClient ? (
              <UnityRaceCanvas
                width={dimensions.width}
                height={dimensions.height}
                onReady={handleUnityReady}
                onLoadError={() => {
                  setUnityLoadFailed(true);
                  unityInstanceRef.current = null;
                  addLog("⚠️ Unity WebGL unavailable — using canvas client");
                }}
                onLocalCarState={handleUnityLocalCarState}
              />
            ) : (
              <GameCanvas
                playerId={playerId}
                roomId={roomId}
                mapId={normalizeMapId(mapId)}
                serverState={cars}
                onSendInput={(inputMsg) => {
                  const currentSpeed = (inputMsg.clientSpeed || 0) * 0.5;
                  if (currentSpeed > topSpeedRef.current) {
                    topSpeedRef.current = currentSpeed;
                  }

                  clientRef.current?.publish({
                    destination: "/app/car.move",
                    body: JSON.stringify({
                      playerId: inputMsg.playerId,
                      roomId: inputMsg.roomId,
                      carColor: carColorKey,
                      gridSlot: clampGridSlot(startIndex),
                      x: inputMsg.clientX,
                      y: inputMsg.clientY,
                      angle: (inputMsg.clientAngle * 180) / Math.PI,
                      speed: inputMsg.clientSpeed,
                      status: isRacing ? "RACING" : "WAITING",
                      lapsCompleted: laps,
                    }),
                  });
                }}
                raceStarted={isRacing}
                countdown={countdownLeft ?? 0}
                width={dimensions.width}
                height={dimensions.height}
                onLapChange={(newLap) => {
                  setLaps(newLap);
                  addLog(`🏆 Lap ${newLap} confirmed!`);
                }}
                onRaceFinish={(data) => {
                  setWinner(playerId);
                  addLog(`🏁 MISSION COMPLETE! Finished at rank #${data.position}`);
                  stopRacing();
                }}
              />
            )}

            {countdownLeft != null && countdownLeft > 0 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(26, 42, 58, 0.82)",
                  backdropFilter: "blur(10px)",
                  zIndex: 5,
                  pointerEvents: "none",
                  fontFamily: "'Orbitron', sans-serif",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "11px", letterSpacing: "6px", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>
                    RACE STARTS IN
                  </div>
                  <div style={{ fontSize: "120px", fontWeight: "900", color: PALETTE.orange, textShadow: `0 0 40px ${PALETTE.orange}55` }}>
                    {countdownLeft}
                  </div>
                </div>
              </div>
            )}
            <div style={{ position: "absolute", bottom: "20px", left: "20px", fontSize: "10px", color: "rgba(255,255,255,0.1)", letterSpacing: "2px", fontFamily: "'Orbitron'" }}>
                SESSION: {roomId}
            </div>
        </div>

        {/* Side panel */}
        <div style={s.sidePanel}>
          {/* Your car info */}
          <div style={{ ...s.card, borderColor: `${color}30`, background: `${color}05` }}>
            <div style={s.cardLabel}>ACTIVE SYSTEM</div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "32px", height: "16px", background: color, borderRadius: "4px", boxShadow: `0 0 15px ${color}` }} />
              <div>
                <div style={{ fontSize: "14px", fontWeight: "900", color }}>{playerName.toUpperCase()}</div>
                <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginTop: "2px" }}>UNIT: {sessionStorage.getItem("carLabel") || "VIPER"}</div>
              </div>
            </div>
          </div>

          {/* Operations card removed as race starts automatically */}

          {/* Leaderboard */}
          <div style={s.card}>
            <div style={s.cardLabel}>SYNC LEADERBOARD</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {Object.keys(cars).length === 0
                ? <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "1px" }}>Searching for signals...</div>
                : [...Object.values(cars)]
                    .sort((a, b) => b.lapsCompleted - a.lapsCompleted)
                    .map((car, i) => (
                        <div key={car.playerId} style={{ ...s.leaderRow, background: car.playerId === playerId ? `${color}10` : "transparent", padding: "4px", borderRadius: "4px" }}>
                        <span style={{ color: i === 0 ? PALETTE.orange : `${PALETTE.oxygen}33`, fontSize: "11px", fontWeight: "bold", width: "18px" }}>#{i + 1}</span>
                        <div style={{ width: "12px", height: "8px", borderRadius: "2px", background: CAR_COLORS[car.carColor] || "#fff" }} />
                        <span style={{ flex: 1, fontSize: "10px", color: car.playerId === playerId ? "#fff" : "rgba(255,255,255,0.4)", fontWeight: car.playerId === playerId ? "bold" : "normal" }}>
                            {car.playerId.substring(0, 10).toUpperCase()}
                        </span>
                        <span style={{ fontSize: "10px", color: PALETTE.orange, fontWeight: "bold" }}>L{car.lapsCompleted}</span>
                        </div>
                    ))
                }
            </div>
          </div>

          {/* Log */}
          <div style={s.card}>
            <div style={s.cardLabel}>SYSTEM FEED</div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", lineHeight: "1.8", fontFamily: "'Inter'" }}>
              {log.length === 0
                ? <span style={{ color: "rgba(255,255,255,0.1)" }}>Awaiting session start...</span>
                : log.map((l, i) => <div key={i}>{l}</div>)
              }
            </div>
          </div>

          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", letterSpacing: "2px", lineHeight: "1.6", textAlign: "center", marginTop: "10px", fontFamily: "'Orbitron'" }}>
            NODE-LINK ESTABLISHED
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  screen: {
    background: `linear-gradient(165deg, ${PALETTE.navy} 0%, ${PALETTE.slateBlue} 42%, ${PALETTE.navy} 100%)`,
    minHeight: "100vh",
    color: PALETTE.oxygen,
    fontFamily: "'Orbitron', sans-serif",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  grid: {
    position: "fixed",
    inset: 0,
    backgroundImage: `linear-gradient(${PALETTE.oxygen}0f 1px, transparent 1px), linear-gradient(90deg, ${PALETTE.slateBlue}55 1px, transparent 1px)`,
    backgroundSize: "60px 60px",
    pointerEvents: "none",
    opacity: 0.45,
  },
  winnerOverlay: { position: "fixed", inset: 0, background: `${PALETTE.navy}f5`, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(20px)" },
  winnerCard: {
    background: `${PALETTE.slateBlue}44`,
    border: `1px solid ${PALETTE.slateBlue}aa`,
    borderRadius: "24px",
    padding: "50px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    alignItems: "center",
  },
  winnerTrophy: { fontSize: "80px", filter: `drop-shadow(0 0 20px ${PALETTE.orange}55)` },
  winnerTitle: { fontSize: "12px", color: `${PALETTE.oxygen}88`, letterSpacing: "6px" },
  winnerName: { fontSize: "48px", fontWeight: "900", letterSpacing: "6px" },
  winnerBtnStack: { display: "flex", flexDirection: "column", gap: "12px", width: "100%", marginTop: "20px", alignItems: "stretch" },
  winnerBtns: { display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" },
  lbBtn: {
    width: "100%",
    background: `linear-gradient(180deg, ${PALETTE.orange}, #e8890a)`,
    color: PALETTE.navy,
    border: `1px solid ${PALETTE.orange}`,
    borderRadius: "10px",
    padding: "16px 24px",
    fontSize: "12px",
    letterSpacing: "4px",
    fontFamily: "'Orbitron'",
    fontWeight: "900",
    transition: "all 0.3s",
  },
  playAgainBtn: { color: PALETTE.navy, border: "none", borderRadius: "10px", padding: "14px 32px", fontSize: "13px", letterSpacing: "3px", fontFamily: "'Orbitron'", fontWeight: "900", cursor: "pointer", transition: "all 0.3s" },
  homeBtn: {
    background: `${PALETTE.oxygen}08`,
    color: `${PALETTE.oxygen}99`,
    border: `1px solid ${PALETTE.slateBlue}aa`,
    borderRadius: "10px",
    padding: "14px 32px",
    fontSize: "13px",
    letterSpacing: "3px",
    fontFamily: "'Orbitron'",
    cursor: "pointer",
    transition: "all 0.3s",
  },
  hud: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 48px",
    borderBottom: `1px solid ${PALETTE.slateBlue}99`,
    background: `linear-gradient(180deg, ${PALETTE.slateBlue}55, ${PALETTE.navy}cc)`,
    backdropFilter: "blur(10px)",
  },
  backBtn: {
    background: `${PALETTE.oxygen}08`,
    border: `1px solid ${PALETTE.slateBlue}aa`,
    color: `${PALETTE.oxygen}99`,
    padding: "10px 18px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "10px",
    letterSpacing: "2px",
    fontFamily: "'Orbitron'",
    transition: "all 0.3s",
  },
  hudCenter: { display: "flex", alignItems: "center", gap: "24px" },
  lapDisplay: { fontSize: "14px", fontWeight: "bold", letterSpacing: "4px" },
  hudRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" },
  main: { display: "flex", gap: "32px", padding: "32px 48px", flex: 1, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" },
  sidePanel: { width: "240px", display: "flex", flexDirection: "column", gap: "16px" },
  card: {
    background: `${PALETTE.slateBlue}33`,
    backdropFilter: "blur(12px)",
    border: `1px solid ${PALETTE.slateBlue}88`,
    borderRadius: "16px",
    padding: "20px",
  },
  cardLabel: { fontSize: "9px", color: `${PALETTE.oxygen}88`, letterSpacing: "4px", marginBottom: "12px" },
  raceBtn: { width: "100%", padding: "14px", border: "none", borderRadius: "10px", fontSize: "12px", fontWeight: "900", letterSpacing: "3px", fontFamily: "'Orbitron'", cursor: "pointer", transition: "all 0.3s" },
  leaderRow: { display: "flex", alignItems: "center", gap: "10px" },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "30px",
    width: "100%",
    margin: "24px 0",
    borderTop: `1px solid ${PALETTE.slateBlue}88`,
    borderBottom: `1px solid ${PALETTE.slateBlue}88`,
    padding: "24px 0",
  },
  statItem: { display: "flex", flexDirection: "column", gap: "6px" },
  statLabel: { fontSize: "9px", color: `${PALETTE.oxygen}88`, letterSpacing: "2px" },
  statValue: { fontSize: "18px", fontWeight: "bold", color: PALETTE.oxygen },
  achievementsBox: { marginBottom: "20px" },
  badge: {
    background: `${PALETTE.orange}18`,
    color: PALETTE.orange,
    border: `1px solid ${PALETTE.orange}44`,
    borderRadius: "100px",
    padding: "6px 16px",
    fontSize: "10px",
    fontWeight: "bold",
    letterSpacing: "1px",
  },
};
