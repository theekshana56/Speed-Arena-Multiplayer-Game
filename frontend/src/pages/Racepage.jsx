import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const WS_URL = "http://localhost:8080/ws-racing";
const CAR_COLORS = { red: "#ef4444", blue: "#3b82f6", green: "#22c55e", yellow: "#facc15" };

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
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = "rgba(239,68,68,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    // Outer track
    ctx.beginPath();
    ctx.ellipse(340, 235, 255, 170, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#0f1117";
    ctx.fill();
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner grass
    ctx.beginPath();
    ctx.ellipse(340, 235, 175, 100, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#0a1a0a";
    ctx.fill();
    ctx.strokeStyle = "#14532d";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner text
    ctx.fillStyle = "#14532d";
    ctx.font = "bold 11px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText("SPEED ARENA", 340, 231);
    ctx.fillText("OVAL", 340, 246);

    // Center dashed line
    ctx.beginPath();
    ctx.ellipse(340, 235, 215, 135, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#facc1540";
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Start/finish line
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#fff" : "#000";
      ctx.fillRect(322 + i * 6, 62, 6, 18);
    }
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 9px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText("START / FINISH", 340, 55);

    // Draw all cars
    Object.values(cars).forEach(car => {
      const color = CAR_COLORS[car.carColor] || "#ffffff";
      const angle = (car.angle * Math.PI) / 180;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(angle);

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(2, 3, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-13, -7, 26, 14, 4);
      ctx.fill();

      // Cockpit
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(-2, -5, 9, 10);

      // Wheels
      ctx.fillStyle = "#111827";
      [[-15, -8], [9, -8], [-15, 4], [9, 4]].forEach(([wx, wy]) => {
        ctx.fillRect(wx, wy, 6, 4);
      });

      // Headlight glow
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(14, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Name tag
      ctx.fillStyle = color;
      ctx.font = `bold 10px 'Courier New'`;
      ctx.textAlign = "center";
      ctx.fillText(car.playerId.substring(0, 8).toUpperCase(), car.x, car.y - 18);

      // Lap indicator
      if (car.lapsCompleted > 0) {
        ctx.fillStyle = "#facc15";
        ctx.font = "9px 'Courier New'";
        ctx.fillText(`L${car.lapsCompleted}`, car.x, car.y - 28);
      }
    });

  }, [cars]);

  // WebSocket connect on mount
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      onConnect: () => {
        setConnected(true);
        addLog(`✅ Connected as ${playerId}`);
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
      onDisconnect: () => { setConnected(false); addLog("🔌 Disconnected"); },
      onStompError: () => addLog("❌ Backend not running — demo mode"),
    });
    client.activate();
    clientRef.current = client;
    return () => { stopRacing(); client.deactivate(); };
  }, []);

  const startRacing = () => {
    if (isRacing) return;
    setIsRacing(true);
    addLog("🏁 Race started!");
    moveIntervalRef.current = setInterval(() => {
      waypointRef.current = (waypointRef.current + 1) % TRACK_WAYPOINTS.length;
      const wp = TRACK_WAYPOINTS[waypointRef.current];
      const prev = TRACK_WAYPOINTS[(waypointRef.current - 1 + TRACK_WAYPOINTS.length) % TRACK_WAYPOINTS.length];
      const angle = Math.atan2(wp.y - prev.y, wp.x - prev.x) * (180 / Math.PI);

      // Count laps
      if (waypointRef.current === 0) {
        lapRef.current += 1;
        setLaps(lapRef.current);
        addLog(`🏆 Lap ${lapRef.current} complete!`);
        if (lapRef.current >= 3) { stopRacing(); setWinner(playerId); return; }
      }

      clientRef.current?.publish({
        destination: "/app/car.move",
        body: JSON.stringify({ playerId, roomId, carColor: carColorKey, x: wp.x, y: wp.y, angle, speed: 8, status: "RACING", lapsCompleted: lapRef.current }),
      });
    }, 260);
  };

  const stopRacing = () => {
    setIsRacing(false);
    if (moveIntervalRef.current) { clearInterval(moveIntervalRef.current); moveIntervalRef.current = null; }
  };

  const color = CAR_COLORS[carColorKey] || "#ef4444";

  return (
    <div style={s.screen}>
      {/* Winner overlay */}
      {winner && (
        <div style={s.winnerOverlay}>
          <div style={s.winnerCard}>
            <div style={s.winnerTrophy}>🏆</div>
            <div style={s.winnerTitle}>RACE COMPLETE!</div>
            <div style={{ ...s.winnerName, color }}>
              {winner === playerId ? "YOU WIN!" : `${winner.toUpperCase()} WINS!`}
            </div>
            <div style={s.winnerBtns}>
              <button onClick={() => { setWinner(null); setLaps(0); lapRef.current = 0; }} style={s.playAgainBtn}>PLAY AGAIN</button>
              <button onClick={() => navigate("/home")} style={s.homeBtn}>← HOME</button>
            </div>
          </div>
        </div>
      )}

      {/* Top HUD */}
      <div style={s.hud}>
        <button onClick={() => { stopRacing(); navigate("/lobby"); }} style={s.backBtn}>← LOBBY</button>

        <div style={s.hudCenter}>
          <div style={{ ...s.lapDisplay, color }}>
            LAP <span style={{ fontSize: "24px" }}>{laps}</span>/3
          </div>
        </div>

        <div style={s.hudRight}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444", display: "inline-block", boxShadow: connected ? "0 0 6px #22c55e" : "none" }} />
            <span style={{ fontSize: "10px", color: connected ? "#22c55e" : "#ef4444", letterSpacing: "1px" }}>{connected ? "LIVE" : "OFFLINE"}</span>
          </div>
          <div style={{ fontSize: "10px", color: "#4b5563", letterSpacing: "1px" }}>
            {Object.keys(cars).length} PLAYERS
          </div>
        </div>
      </div>

      {/* Main area */}
      <div style={s.main}>
        {/* Canvas */}
        <canvas ref={canvasRef} width={680} height={470}
          style={{ borderRadius: "12px", border: `1px solid ${color}30`, display: "block" }} />

        {/* Side panel */}
        <div style={s.sidePanel}>
          {/* Your car info */}
          <div style={{ ...s.card, borderColor: `${color}40` }}>
            <div style={s.cardLabel}>YOUR CAR</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "28px", height: "14px", background: color, borderRadius: "3px", boxShadow: `0 0 8px ${color}` }} />
              <div>
                <div style={{ fontSize: "12px", fontWeight: "bold", color }}>{playerName.toUpperCase()}</div>
                <div style={{ fontSize: "9px", color: "#4b5563", letterSpacing: "1px" }}>{sessionStorage.getItem("carLabel") || "VIPER"}</div>
              </div>
            </div>
          </div>

          {/* Race controls */}
          <div style={s.card}>
            <div style={s.cardLabel}>CONTROLS</div>
            {!isRacing
              ? <button onClick={startRacing} disabled={!connected}
                  style={{ ...s.raceBtn, background: connected ? color : "#1f2937", color: connected ? "#000" : "#374151", boxShadow: connected ? `0 0 20px ${color}50` : "none" }}>
                  🏁 START RACING
                </button>
              : <button onClick={stopRacing} style={{ ...s.raceBtn, background: "#78350f", color: "#fcd34d" }}>
                  ⏹ STOP
                </button>
            }
          </div>

          {/* Leaderboard */}
          <div style={s.card}>
            <div style={s.cardLabel}>LEADERBOARD</div>
            {Object.keys(cars).length === 0
              ? <div style={{ fontSize: "10px", color: "#374151" }}>No players yet...</div>
              : [...Object.values(cars)]
                  .sort((a, b) => b.lapsCompleted - a.lapsCompleted)
                  .map((car, i) => (
                    <div key={car.playerId} style={s.leaderRow}>
                      <span style={{ color: i === 0 ? "#facc15" : "#4b5563", fontSize: "11px" }}>#{i + 1}</span>
                      <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: CAR_COLORS[car.carColor] || "#fff" }} />
                      <span style={{ flex: 1, fontSize: "10px", color: car.playerId === playerId ? color : "#9ca3af" }}>
                        {car.playerId.substring(0, 10).toUpperCase()}
                      </span>
                      <span style={{ fontSize: "10px", color: "#facc15" }}>L{car.lapsCompleted}</span>
                    </div>
                  ))
            }
          </div>

          {/* Log */}
          <div style={s.card}>
            <div style={s.cardLabel}>RACE LOG</div>
            <div style={{ fontSize: "10px", color: "#4b5563", lineHeight: "1.8" }}>
              {log.length === 0
                ? <span style={{ color: "#1f2937" }}>Waiting to start...</span>
                : log.map((l, i) => <div key={i}>{l}</div>)
              }
            </div>
          </div>

          <div style={{ fontSize: "9px", color: "#1f2937", letterSpacing: "1px", lineHeight: "1.6", textAlign: "center" }}>
            💡 Open 2 tabs → connect → start racing to see real-time sync
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  screen: { background: "#050510", minHeight: "100vh", color: "#fff", fontFamily: "'Courier New', monospace", display: "flex", flexDirection: "column" },
  winnerOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" },
  winnerCard: { background: "#0a0a1a", border: "1px solid #facc1540", borderRadius: "16px", padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" },
  winnerTrophy: { fontSize: "64px" },
  winnerTitle: { fontSize: "14px", color: "#4b5563", letterSpacing: "4px" },
  winnerName: { fontSize: "40px", fontWeight: "900", letterSpacing: "4px" },
  winnerBtns: { display: "flex", gap: "12px", marginTop: "8px" },
  playAgainBtn: { background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", padding: "12px 24px", fontSize: "12px", letterSpacing: "2px", fontFamily: "'Courier New', monospace", fontWeight: "bold", cursor: "pointer" },
  homeBtn: { background: "transparent", color: "#6b7280", border: "1px solid #1f2937", borderRadius: "6px", padding: "12px 24px", fontSize: "12px", letterSpacing: "2px", fontFamily: "'Courier New', monospace", cursor: "pointer" },
  hud: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", borderBottom: "1px solid #0f172a", background: "#07070f" },
  backBtn: { background: "transparent", border: "1px solid #1f2937", color: "#6b7280", padding: "8px 14px", borderRadius: "4px", cursor: "pointer", fontSize: "10px", letterSpacing: "2px", fontFamily: "'Courier New', monospace" },
  hudCenter: { display: "flex", alignItems: "center", gap: "24px" },
  lapDisplay: { fontSize: "13px", fontWeight: "bold", letterSpacing: "2px" },
  hudRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" },
  main: { display: "flex", gap: "16px", padding: "16px 24px", flex: 1, alignItems: "flex-start", flexWrap: "wrap" },
  sidePanel: { width: "200px", display: "flex", flexDirection: "column", gap: "10px" },
  card: { background: "#0a0a1a", border: "1px solid #0f172a", borderRadius: "8px", padding: "12px" },
  cardLabel: { fontSize: "9px", color: "#374151", letterSpacing: "3px", marginBottom: "8px" },
  raceBtn: { width: "100%", padding: "10px", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", letterSpacing: "2px", fontFamily: "'Courier New', monospace", cursor: "pointer", transition: "all 0.2s" },
  leaderRow: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" },
};
