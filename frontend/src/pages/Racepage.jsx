import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { apiFetch } from "../services/apiClient";
import { tokenService } from "../services/tokenService";


const WS_URL = "http://127.0.0.1:8080/ws-racing";
const CAR_COLORS = { 
  red: "#ff3333", 
  blue: "#00a2ff", 
  green: "#00e87a", 
  yellow: "#ffd520" 
};

const TRACK_WAYPOINTS = [
  { x: 340, y: 75 }, { x: 430, y: 85 }, { x: 510, y: 115 },
  { x: 560, y: 165 }, { x: 575, y: 235 }, { x: 560, y: 305 },
  { x: 510, y: 355 }, { x: 430, y: 385 }, { x: 340, y: 395 },
  { x: 250, y: 385 }, { x: 170, y: 355 }, { x: 120, y: 305 },
  { x: 105, y: 235 }, { x: 120, y: 165 }, { x: 170, y: 115 },
  { x: 250, y: 85 },
];

export default function RacePage() {
  const navigate = useNavigate();
  const playerName = sessionStorage.getItem("playerName") || "PLAYER";
  const carColorKey = sessionStorage.getItem("carColor") || "red";
  const roomId = sessionStorage.getItem("roomId") || "room_001";
  const playerId = playerName.toLowerCase().replace(/\s/g, "_");

  const [connected, setConnected] = useState(false);
  const [isRacing, setIsRacing] = useState(false);
  const [cars, setCars] = useState({});
  const [laps, setLaps] = useState(0);
  const [winner, setWinner] = useState(null);
  const [log, setLog] = useState([]);
  const [resultsSent, setResultsSent] = useState(false);
  const [raceStats, setRaceStats] = useState(null);

  const startTimeRef = useRef(null);
  const topSpeedRef = useRef(0);

  const clientRef = useRef(null);
  const moveIntervalRef = useRef(null);
  const waypointRef = useRef(0);
  const lapRef = useRef(0);
  const canvasRef = useRef(null);

  const addLog = (msg) => setLog(prev => [...prev.slice(-6), msg]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#03030e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    // Outer track
    ctx.beginPath();
    ctx.ellipse(340, 235, 255, 170, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#151520";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner grass
    ctx.beginPath();
    ctx.ellipse(340, 235, 175, 100, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#050a10";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 255, 234, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner text
    ctx.fillStyle = "rgba(0, 255, 234, 0.2)";
    ctx.font = "bold 12px 'Orbitron'";
    ctx.textAlign = "center";
    ctx.fillText("SPEED ARENA", 340, 231);
    ctx.font = "8px 'Orbitron'";
    ctx.fillText("MISSION CONTROL SYNC", 340, 246);

    // Center dashed line
    ctx.beginPath();
    ctx.ellipse(340, 235, 215, 135, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 213, 32, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Start/finish line
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#fff" : "#000";
      ctx.fillRect(322 + i * 6, 62, 6, 18);
    }
    ctx.fillStyle = "#ffd520";
    ctx.font = "bold 10px 'Orbitron'";
    ctx.textAlign = "center";
    ctx.fillText("CHECKPOINT 0", 340, 52);

    // Draw all cars
    Object.values(cars).forEach(car => {
      const color = CAR_COLORS[car.carColor] || "#ffffff";
      const angle = (car.angle * Math.PI) / 180;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(angle);

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(3, 4, 15, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-14, -8, 28, 16, 5);
      ctx.fill();

      // Cockpit
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(-3, -6, 10, 12);

      // Wheels
      ctx.fillStyle = "#0a0a0a";
      [[-16, -9], [10, -9], [-16, 5], [10, 5]].forEach(([wx, wy]) => {
        ctx.fillRect(wx, wy, 7, 5);
      });

      // Headlight glow
      ctx.fillStyle = "#fff";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ffd520";
      ctx.beginPath();
      ctx.arc(15, -4, 2, 0, Math.PI * 2);
      ctx.arc(15, 4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();

      // Name tag
      ctx.fillStyle = color;
      ctx.font = `bold 11px 'Orbitron'`;
      ctx.textAlign = "center";
      ctx.fillText(car.playerId.substring(0, 10).toUpperCase(), car.x, car.y - 20);

      // Lap indicator
      if (car.lapsCompleted > 0) {
        ctx.fillStyle = "#ffd520";
        ctx.font = "bold 9px 'Orbitron'";
        ctx.fillText(`L${car.lapsCompleted}`, car.x, car.y - 32);
      }
    });

  }, [cars]);

  // WebSocket connect on mount
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      onConnect: () => {
        setConnected(true);
        addLog(`✅ Link established as ${playerId}`);
        client.subscribe("/topic/game-state", msg => {
          const car = JSON.parse(msg.body);
          setCars(prev => ({ ...prev, [car.playerId]: car }));
          if (car.lapsCompleted >= 3 && !winner) setWinner(car.playerId);
        });
        const start = TRACK_WAYPOINTS[0];
        client.publish({
          destination: "/app/player.join",
          body: JSON.stringify({ playerId, roomId, carColor: carColorKey, x: start.x, y: start.y, angle: 0, speed: 0, status: "WAITING" }),
        });
      },
      onDisconnect: () => { setConnected(false); addLog("🔌 Link severed"); },
      onStompError: () => addLog("❌ Sync failure — backend unreachable"),
    });
    client.activate();
    clientRef.current = client;
    return () => { stopRacing(); client.deactivate(); };
  }, []);

  const startRacing = () => {
    if (isRacing) return;
    setIsRacing(true);
    startTimeRef.current = Date.now();
    topSpeedRef.current = 0;
    setResultsSent(false);
    setRaceStats(null);
    addLog("🏁 Mission initialized!");


    moveIntervalRef.current = setInterval(() => {
      waypointRef.current = (waypointRef.current + 1) % TRACK_WAYPOINTS.length;
      const wp = TRACK_WAYPOINTS[waypointRef.current];
      const prev = TRACK_WAYPOINTS[(waypointRef.current - 1 + TRACK_WAYPOINTS.length) % TRACK_WAYPOINTS.length];
      const angle = Math.atan2(wp.y - prev.y, wp.x - prev.x) * (180 / Math.PI);

      // Count laps
        if (waypointRef.current === 0) {
        lapRef.current += 1;
        setLaps(lapRef.current);
        addLog(`🏆 Lap ${lapRef.current} confirmed!`);
        if (lapRef.current >= 3) {
            stopRacing();
            setWinner(playerId);
            return;
        }
      }

      // Update Top Speed (simulate minor variation)
      const currentSpeed = 190 + Math.random() * 25; // Simulated km/h
      if (currentSpeed > topSpeedRef.current) {
          topSpeedRef.current = currentSpeed;
      }

      // Calculate total time if finishing
      let finalTimeForState = 0;
      if (waypointRef.current === 0 && lapRef.current >= 3) {
          finalTimeForState = (Date.now() - (startTimeRef.current || Date.now())) / 1000;
      }

      clientRef.current?.publish({
        destination: "/app/car.move",
        body: JSON.stringify({ 
          playerId, roomId, carColor: carColorKey, x: wp.x, y: wp.y, angle, speed: 9, 
          status: lapRef.current >= 3 ? "FINISHED" : "RACING", 
          lapsCompleted: lapRef.current,
          totalTime: finalTimeForState
        }),
      });
    }, 240); // Slightly faster interval for more speed

  };

  const stopRacing = () => {
    setIsRacing(false);
    if (moveIntervalRef.current) { clearInterval(moveIntervalRef.current); moveIntervalRef.current = null; }
  };

  // ── Results & Achievements ──
  useEffect(() => {
    if (winner && !resultsSent) {
      const finishTime = Date.now();
      const currentStartTime = startTimeRef.current || finishTime;
      const totalTime = (finishTime - currentStartTime) / 1000;
      const finalTopSpeed = topSpeedRef.current;
      const currentName = sessionStorage.getItem("playerName") || sessionStorage.getItem("username") || "PLAYER";
      
      const allFinishers = Object.values(cars)
          .filter(c => c.status === "FINISHED" && c.totalTime > 0)
          .sort((a,b) => (a.totalTime || Infinity) - (b.totalTime || Infinity));
      
      let rank = allFinishers.findIndex(c => c.playerId === playerId) + 1;
      
      if (rank <= 0) {
          rank = (winner === playerId) ? 1 : allFinishers.length + 1;
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

      setRaceStats(stats);
      setResultsSent(true);

      const saveResult = async () => {
        const payload = {
          playerId: Math.floor(Math.random() * 10000),
          playerName: currentName,
          roomId: 1,
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
        } catch (err) {
          console.error(">>> ERROR SAVING RESULT:", err);
        }
      };
      
      saveResult();
    }
  }, [winner, resultsSent, cars, playerId]);


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
              <div style={{ fontSize:"10px", color:"#ffd520", letterSpacing:"4px", marginBottom:"12px", fontFamily: "'Orbitron'" }}>AWARDS OBTAINED</div>
              <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", justifyContent:"center" }}>
                {raceStats.achievements.map(a => (
                  <span key={a} style={s.badge}>{a}</span>
                ))}
              </div>
            </div>

            <div style={s.winnerBtns}>
              <button onClick={() => { setWinner(null); setLaps(0); lapRef.current = 0; setResultsSent(false); }} style={{ ...s.playAgainBtn, background: color, boxShadow: `0 0 20px ${color}40` }}>RE-DEPLOY</button>
              <button onClick={() => navigate("/home")} style={s.homeBtn}>← TERMINAL</button>
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
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: connected ? "#00e87a" : "#ff3333", display: "inline-block", boxShadow: `0 0 10px ${connected ? "#00e87a" : "#ff3333"}` }} />
            <span style={{ fontSize: "10px", color: connected ? "#00e87a" : "#ff3333", letterSpacing: "2px", fontWeight: "bold" }}>{connected ? "SYNC LIVE" : "LINK OFFLINE"}</span>
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", fontFamily: "'Orbitron'" }}>
            {Object.keys(cars).length} ACTIVE LINKS
          </div>
        </div>
      </div>

      {/* Main area */}
      <div style={s.main}>
        {/* Canvas */}
        <div style={{ position: "relative" }}>
            <canvas ref={canvasRef} width={680} height={470}
                style={{ borderRadius: "20px", border: `1px solid rgba(255,255,255,0.05)`, display: "block", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }} />
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

          {/* Race controls */}
          <div style={s.card}>
            <div style={s.cardLabel}>OPERATIONS</div>
            {!isRacing
              ? <button onClick={startRacing} disabled={!connected}
                  style={{ ...s.raceBtn, background: connected ? color : "rgba(255,255,255,0.05)", color: connected ? "#000" : "rgba(255,255,255,0.2)", boxShadow: connected ? `0 0 30px ${color}40` : "none" }}>
                  🏁 INITIALIZE
                </button>
              : <button onClick={stopRacing} style={{ ...s.raceBtn, background: "rgba(255, 51, 51, 0.1)", border: "1px solid #ff3333", color: "#ff3333" }}>
                  ⏹ ABORT
                </button>
            }
          </div>

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
                        <span style={{ color: i === 0 ? "#ffd520" : "rgba(255,255,255,0.2)", fontSize: "11px", fontWeight: "bold", width: "18px" }}>#{i + 1}</span>
                        <div style={{ width: "12px", height: "8px", borderRadius: "2px", background: CAR_COLORS[car.carColor] || "#fff" }} />
                        <span style={{ flex: 1, fontSize: "10px", color: car.playerId === playerId ? "#fff" : "rgba(255,255,255,0.4)", fontWeight: car.playerId === playerId ? "bold" : "normal" }}>
                            {car.playerId.substring(0, 10).toUpperCase()}
                        </span>
                        <span style={{ fontSize: "10px", color: "#ffd520", fontWeight: "bold" }}>L{car.lapsCompleted}</span>
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
  screen: { background: "#03030e", minHeight: "100vh", color: "#fff", fontFamily: "'Orbitron', sans-serif", display: "flex", flexDirection: "column", position: "relative" },
  grid: { position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" },
  winnerOverlay: { position: "fixed", inset: 0, background: "rgba(3,3,14,0.96)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(20px)" },
  winnerCard: { background: "rgba(255, 255, 255, 0.03)", border: "1px solid", borderRadius: "24px", padding: "50px", textAlign: "center", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" },
  winnerTrophy: { fontSize: "80px", filter: "drop-shadow(0 0 20px rgba(255,213,32,0.4))" },
  winnerTitle: { fontSize: "12px", color: "rgba(255,255,255,0.3)", letterSpacing: "6px" },
  winnerName: { fontSize: "48px", fontWeight: "900", letterSpacing: "6px" },
  winnerBtns: { display: "flex", gap: "16px", marginTop: "20px" },
  playAgainBtn: { color: "#000", border: "none", borderRadius: "10px", padding: "14px 32px", fontSize: "13px", letterSpacing: "3px", fontFamily: "'Orbitron'", fontWeight: "900", cursor: "pointer", transition: "all 0.3s" },
  homeBtn: { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "14px 32px", fontSize: "13px", letterSpacing: "3px", fontFamily: "'Orbitron'", cursor: "pointer", transition: "all 0.3s" },
  hud: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 48px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(10px)" },
  backBtn: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontSize: "10px", letterSpacing: "2px", fontFamily: "'Orbitron'", transition: "all 0.3s" },
  hudCenter: { display: "flex", alignItems: "center", gap: "24px" },
  lapDisplay: { fontSize: "14px", fontWeight: "bold", letterSpacing: "4px" },
  hudRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" },
  main: { display: "flex", gap: "32px", padding: "32px 48px", flex: 1, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" },
  sidePanel: { width: "240px", display: "flex", flexDirection: "column", gap: "16px" },
  card: { background: "rgba(255, 255, 255, 0.03)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "20px" },
  cardLabel: { fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "4px", marginBottom: "12px" },
  raceBtn: { width: "100%", padding: "14px", border: "none", borderRadius: "10px", fontSize: "12px", fontWeight: "900", letterSpacing: "3px", fontFamily: "'Orbitron'", cursor: "pointer", transition: "all 0.3s" },
  leaderRow: { display: "flex", alignItems: "center", gap: "10px" },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "30px", width: "100%", margin: "24px 0", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "24px 0" },
  statItem: { display: "flex", flexDirection: "column", gap: "6px" },
  statLabel: { fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px" },
  statValue: { fontSize: "18px", fontWeight: "bold", color: "#fff" },
  achievementsBox: { marginBottom: "20px" },
  badge: { background: "rgba(255, 213, 32, 0.1)", color: "#ffd520", border: "1px solid rgba(255, 213, 32, 0.2)", borderRadius: "100px", padding: "6px 16px", fontSize: "10px", fontWeight: "bold", letterSpacing: "1px" },
};
