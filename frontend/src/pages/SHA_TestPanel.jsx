import { useState, useRef, useEffect } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const WS_URL = "http://localhost:8086/ws-racing";

const CAR_COLORS = {
  player_1: { primary: "#ff3b3b", glow: "#ff000088", name: "VIPER" },
  player_2: { primary: "#00b4ff", glow: "#00aaff88", name: "STORM" },
  player_3: { primary: "#00ff88", glow: "#00ff6688", name: "GHOST" },
  player_4: { primary: "#ffa500", glow: "#ff990088", name: "BLAZE" },
};

// F1-style circuit: Monaco-inspired tight corners + long straight
const TRACK_WAYPOINTS = [
  { x: 340, y: 70 },   // Start/Finish straight
  { x: 440, y: 72 },
  { x: 520, y: 90 },
  { x: 570, y: 130 },  // Turn 1 - hairpin entry
  { x: 585, y: 190 },
  { x: 570, y: 250 },  // Sector 2
  { x: 530, y: 300 },
  { x: 470, y: 340 },
  { x: 400, y: 368 },
  { x: 330, y: 378 },  // Back straight
  { x: 250, y: 368 },
  { x: 185, y: 345 },
  { x: 140, y: 300 },  // Turn 6 - chicane
  { x: 115, y: 245 },
  { x: 115, y: 185 },
  { x: 140, y: 130 },
  { x: 185, y: 95 },   // Return to start
  { x: 255, y: 74 },
];

function drawTrack(ctx, W, H) {
  // ── Sky/atmosphere
  const sky = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, Math.max(W, H));
  sky.addColorStop(0, "#0c1a2e");
  sky.addColorStop(0.5, "#070d1a");
  sky.addColorStop(1, "#030810");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // ── Grid lines (subtle)
  ctx.save();
  ctx.strokeStyle = "rgba(0,200,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();

  const wps = TRACK_WAYPOINTS;
  const N = wps.length;

  // Helper: build a smooth closed path
  const buildPath = (offset) => {
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const curr = wps[i];
      const next = wps[(i + 1) % N];
      const mx = (curr.x + next.x) / 2;
      const my = (curr.y + next.y) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
    }
    ctx.closePath();
  };

  // ── Tarmac outer shadow/halo
  ctx.save();
  ctx.shadowColor = "rgba(0,160,255,0.12)";
  ctx.shadowBlur = 28;
  buildPath(0);
  ctx.lineWidth = 58;
  ctx.strokeStyle = "rgba(0,160,255,0.08)";
  ctx.stroke();
  ctx.restore();

  // ── Tarmac surface (main road)
  buildPath(0);
  ctx.lineWidth = 46;
  ctx.strokeStyle = "#1c2230";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // ── Tarmac texture layer (slightly lighter)
  buildPath(0);
  ctx.lineWidth = 44;
  ctx.strokeStyle = "#222b3a";
  ctx.stroke();

  // ── Track edge lines (outer — white)
  buildPath(0);
  ctx.lineWidth = 46;
  ctx.strokeStyle = "rgba(255,255,255,0.0)";
  ctx.stroke();

  buildPath(0);
  ctx.lineWidth = 48;
  ctx.strokeStyle = "#ffffff";
  ctx.setLineDash([6, 0]);
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.25;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // ── Racing line (inner ideal line — neon blue dash)
  ctx.save();
  ctx.setLineDash([8, 14]);
  buildPath(0);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(0,220,255,0.35)";
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── Curb stripes at key corners
  const curbCorners = [
    { idx: 3, color1: "#ff2222", color2: "#ffffff" },
    { idx: 8, color1: "#ff2222", color2: "#ffffff" },
    { idx: 13, color1: "#ff2222", color2: "#ffffff" },
  ];
  curbCorners.forEach(({ idx, color1, color2 }) => {
    const p = wps[idx];
    for (let s = 0; s < 6; s++) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 - s * 4, 0, Math.PI * 2);
      ctx.fillStyle = s % 2 === 0 ? color1 : color2;
      ctx.globalAlpha = 0.18;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  // ── Sector indicators (S1, S2, S3 colored lines across track)
  const sectors = [
    { p: wps[0], color: "#ff3b3b", label: "S1" },
    { p: wps[6], color: "#ffa500", label: "S2" },
    { p: wps[12], color: "#00ff88", label: "S3" },
  ];
  sectors.forEach(({ p, color, label }) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(p.x - 18, p.y - 4);
    ctx.lineTo(p.x + 18, p.y + 4);
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    ctx.font = "bold 9px 'Courier New'";
    ctx.fillText(label, p.x + 20, p.y + 3);
    ctx.restore();
  });

  // ── DRS zone (long straight, top)
  ctx.save();
  ctx.strokeStyle = "#00ffcc";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(260, 64); ctx.lineTo(430, 64);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = "#00ffcc";
  ctx.font = "bold 8px 'Courier New'";
  ctx.textAlign = "center";
  ctx.fillText("DRS ZONE", 345, 58);
  ctx.restore();

  // ── Start/Finish line (chequered pattern)
  ctx.save();
  const sfX = (wps[0].x + wps[N - 1].x) / 2;
  const sfY = (wps[0].y + wps[N - 1].y) / 2 + 2;
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 2; row++) {
      ctx.fillStyle = (col + row) % 2 === 0 ? "#ffffff" : "#000000";
      ctx.fillRect(sfX - 12 + col * 5, sfY - 10 + row * 5, 5, 5);
    }
  }
  // Glow on start line
  ctx.shadowColor = "#ffee00";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "rgba(255,238,0,0.5)";
  ctx.fillRect(sfX - 13, sfY - 11, 27, 12);
  ctx.shadowBlur = 0;

  // Re-draw chequered on top
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 2; row++) {
      ctx.fillStyle = (col + row) % 2 === 0 ? "#ffffff" : "#111111";
      ctx.fillRect(sfX - 12 + col * 5, sfY - 10 + row * 5, 5, 5);
    }
  }
  ctx.restore();

  // ── Start/Finish label
  ctx.save();
  ctx.fillStyle = "#facc15";
  ctx.font = "bold 9px 'Courier New'";
  ctx.textAlign = "center";
  ctx.shadowColor = "#facc15";
  ctx.shadowBlur = 8;
  ctx.fillText("START / FINISH", sfX, sfY - 16);
  ctx.restore();

  // ── Track name badge
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.roundRect(200, 185, 200, 42, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,200,255,0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#00c8ff";
  ctx.font = "bold 13px 'Courier New'";
  ctx.textAlign = "center";
  ctx.shadowColor = "#00c8ff";
  ctx.shadowBlur = 10;
  ctx.fillText("SPEED ARENA CIRCUIT", 300, 202);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "9px 'Courier New'";
  ctx.fillText("LAP RECORD: 00:43.218", 300, 218);
  ctx.restore();
}

function drawCars(ctx, cars) {
  Object.values(cars).forEach((car) => {
    const config = CAR_COLORS[car.playerId] || { primary: "#ffffff", glow: "#ffffff44", name: "?" };
    const { x, y, angle } = car;
    const rad = (angle * Math.PI) / 180;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rad);

    // Ground glow
    ctx.shadowColor = config.primary;
    ctx.shadowBlur = 18;
    ctx.fillStyle = config.glow;
    ctx.beginPath();
    ctx.ellipse(0, 3, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Body
    ctx.fillStyle = config.primary;
    ctx.shadowColor = config.primary;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(-13, -5, 26, 10, 3);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Cockpit
    ctx.fillStyle = "rgba(180,230,255,0.55)";
    ctx.beginPath();
    ctx.roundRect(0, -3.5, 7, 7, 2);
    ctx.fill();

    // Front wing
    ctx.fillStyle = config.primary;
    ctx.fillRect(10, -7, 4, 3);
    ctx.fillRect(10, 4, 4, 3);

    // Rear wing
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(-15, -8, 3, 3);
    ctx.fillRect(-15, 5, 3, 3);

    // Wheels
    ctx.fillStyle = "#0a0a14";
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 0.8;
    [[-14, -6], [7, -6], [-14, 2], [7, 2]].forEach(([wx, wy]) => {
      ctx.beginPath();
      ctx.roundRect(wx, wy, 6, 4, 1);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();

    // Player tag above car
    ctx.save();
    ctx.shadowColor = config.primary;
    ctx.shadowBlur = 10;
    ctx.fillStyle = config.primary;
    ctx.font = "bold 10px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText(config.name, x, y - 18);
    ctx.restore();
  });
}

export default function SHA_TestPanel() {
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState("player_1");
  const [roomId] = useState("room_001");
  const [cars, setCars] = useState({});
  const [log, setLog] = useState([]);
  const [isMoving, setIsMoving] = useState(false);
  const clientRef = useRef(null);
  const moveIntervalRef = useRef(null);
  const waypointRef = useRef(0);
  const canvasRef = useRef(null);

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLog((prev) => [...prev.slice(-8), `[${time}] ${msg}`]);
  };

  // Redraw canvas whenever cars change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawTrack(ctx, canvas.width, canvas.height);
    drawCars(ctx, cars);
  }, [cars]);

  // Initial track draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawTrack(ctx, canvas.width, canvas.height);
  }, []);

  const connect = () => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      onConnect: () => {
        setConnected(true);
        addLog(`⚡ ${playerId} connected`);
        client.subscribe("/topic/game-state", (msg) => {
          const car = JSON.parse(msg.body);
          setCars((prev) => ({ ...prev, [car.playerId]: car }));
        });
        client.subscribe("/topic/pong", (msg) => {
          addLog("🏓 Pong: " + msg.body.slice(0, 30));
        });
        const start = TRACK_WAYPOINTS[0];
        client.publish({
          destination: "/app/player.join",
          body: JSON.stringify({ playerId, roomId, x: start.x, y: start.y, angle: 0, speed: 0, status: "WAITING" }),
        });
        addLog(`🚗 Joined room ${roomId}`);
      },
      onDisconnect: () => { setConnected(false); addLog("🔌 Disconnected"); },
      onStompError: () => addLog("❌ Error — is backend running?"),
    });
    client.activate();
    clientRef.current = client;
  };

  const disconnect = () => {
    stopMoving();
    clientRef.current?.deactivate();
    setConnected(false);
    setCars((prev) => { const n = { ...prev }; delete n[playerId]; return n; });
  };

  const startMoving = () => {
    if (!connected || isMoving) return;
    setIsMoving(true);
    addLog(`🏁 ${CAR_COLORS[playerId]?.name || playerId} is racing!`);
    moveIntervalRef.current = setInterval(() => {
      waypointRef.current = (waypointRef.current + 1) % TRACK_WAYPOINTS.length;
      const wp = TRACK_WAYPOINTS[waypointRef.current];
      const prev = TRACK_WAYPOINTS[(waypointRef.current - 1 + TRACK_WAYPOINTS.length) % TRACK_WAYPOINTS.length];
      const angle = Math.atan2(wp.y - prev.y, wp.x - prev.x) * (180 / Math.PI);
      clientRef.current?.publish({
        destination: "/app/car.move",
        body: JSON.stringify({ playerId, roomId, x: wp.x, y: wp.y, angle, speed: 8, status: "RACING", lapsCompleted: 0 }),
      });
    }, 280);
  };

  const stopMoving = () => {
    setIsMoving(false);
    if (moveIntervalRef.current) { clearInterval(moveIntervalRef.current); moveIntervalRef.current = null; }
  };

  const sendPing = () => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({ destination: "/app/game.ping", body: JSON.stringify("PING") });
    addLog("📡 Ping sent…");
  };

  useEffect(() => () => stopMoving(), []);

  const selectedColor = CAR_COLORS[playerId]?.primary || "#fff";

  return (
    <div style={styles.wrapper}>
      {/* Scanlines overlay */}
      <div style={styles.scanlines} />

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerAccentLeft} />
        <div>
          <div style={styles.titleRow}>
            <span style={{ ...styles.titleBadge, color: selectedColor, borderColor: selectedColor, boxShadow: `0 0 12px ${selectedColor}55` }}>
              F1
            </span>
            <h1 style={styles.title}>SPEED ARENA</h1>
            <span style={{ ...styles.liveTag, boxShadow: connected ? "0 0 8px #00ff8866" : "none" }}>
              {connected ? "● LIVE" : "○ OFFLINE"}
            </span>
          </div>
          <p style={styles.subtitle}>REAL-TIME MULTIPLAYER · WEBSOCKET RACING · MEMBER 2</p>
        </div>
        <div style={styles.headerAccentRight} />
      </div>

      {/* Main layout */}
      <div style={styles.mainLayout}>

        {/* Track canvas */}
        <div style={styles.canvasWrap}>
          {/* Corner brackets */}
          <div style={{ ...styles.corner, top: 0, left: 0, borderTop: `2px solid ${selectedColor}`, borderLeft: `2px solid ${selectedColor}` }} />
          <div style={{ ...styles.corner, top: 0, right: 0, borderTop: `2px solid ${selectedColor}`, borderRight: `2px solid ${selectedColor}` }} />
          <div style={{ ...styles.corner, bottom: 0, left: 0, borderBottom: `2px solid ${selectedColor}`, borderLeft: `2px solid ${selectedColor}` }} />
          <div style={{ ...styles.corner, bottom: 0, right: 0, borderBottom: `2px solid ${selectedColor}`, borderRight: `2px solid ${selectedColor}` }} />
          <canvas ref={canvasRef} width={700} height={460} style={styles.canvas} />
        </div>

        {/* Side panel */}
        <div style={styles.sidePanel}>

          {/* Connection */}
          <PanelCard accentColor={connected ? "#00ff88" : "#ff3b3b"} label="CONNECTION">
            <div style={styles.statusRow}>
              <span style={{ ...styles.statusDot, background: connected ? "#00ff88" : "#ff3b3b", boxShadow: connected ? "0 0 8px #00ff88" : "0 0 8px #ff3b3b" }} />
              <span style={{ color: connected ? "#00ff88" : "#ff3b3b", fontSize: 11, fontFamily: "Courier New", fontWeight: "bold", letterSpacing: 2 }}>
                {connected ? "CONNECTED" : "OFFLINE"}
              </span>
            </div>
            <div style={styles.roomLabel}>ROOM: <span style={{ color: "#facc15" }}>ROOM_001</span></div>
          </PanelCard>

          {/* Car select */}
          <PanelCard accentColor={selectedColor} label="SELECT DRIVER">
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              disabled={connected}
              style={{ ...styles.select, borderColor: `${selectedColor}44`, color: selectedColor }}
            >
              {Object.entries(CAR_COLORS).map(([id, c]) => (
                <option key={id} value={id}>{c.name} — {id.replace("player_", "P")}</option>
              ))}
            </select>
            {/* Color swatch */}
            <div style={styles.swatchRow}>
              {Object.entries(CAR_COLORS).map(([id, c]) => (
                <div key={id} style={{
                  ...styles.swatch,
                  background: c.primary,
                  boxShadow: playerId === id ? `0 0 10px ${c.primary}` : "none",
                  transform: playerId === id ? "scale(1.35)" : "scale(1)",
                  opacity: connected && playerId !== id ? 0.3 : 1,
                }} />
              ))}
            </div>
            <button
              onClick={connected ? disconnect : connect}
              style={{ ...styles.btn, background: connected ? "rgba(127,29,29,0.4)" : "rgba(37,99,235,0.4)", borderColor: connected ? "#ef4444" : "#3b82f6", color: connected ? "#ef4444" : "#60a5fa" }}
            >
              {connected ? "⏏  DISCONNECT" : "⚡ CONNECT"}
            </button>
          </PanelCard>

          {/* Race controls */}
          <PanelCard accentColor={isMoving ? "#ffa500" : "#00ff88"} label="RACE CONTROL">
            {!isMoving
              ? <button onClick={startMoving} disabled={!connected} style={{ ...styles.btn, background: connected ? "rgba(22,163,74,0.35)" : "rgba(17,24,39,0.5)", borderColor: connected ? "#00ff88" : "#1f2937", color: connected ? "#00ff88" : "#374151", boxShadow: connected ? "inset 0 0 20px rgba(0,255,136,0.08)" : "none" }}>
                🏁 START RACE
              </button>
              : <button onClick={stopMoving} style={{ ...styles.btn, background: "rgba(180,83,9,0.35)", borderColor: "#ffa500", color: "#ffa500", boxShadow: "inset 0 0 20px rgba(255,165,0,0.1)", animation: "pulse 1s ease-in-out infinite" }}>
                ⏹ PIT STOP
              </button>
            }
            <button onClick={sendPing} disabled={!connected} style={{ ...styles.btn, background: connected ? "rgba(109,40,217,0.3)" : "rgba(17,24,39,0.5)", borderColor: connected ? "#8b5cf6" : "#1f2937", color: connected ? "#a78bfa" : "#374151", marginTop: 8 }}>
              📡 PING
            </button>
          </PanelCard>

          {/* On track */}
          <PanelCard accentColor="#00c8ff" label={`ON TRACK · ${Object.keys(cars).length}/4`}>
            {Object.keys(cars).length === 0
              ? <div style={{ color: "#2d4a6a", fontSize: 11, fontFamily: "Courier New", textAlign: "center", padding: "8px 0" }}>GRID EMPTY</div>
              : Object.values(cars).map((car) => {
                const cfg = CAR_COLORS[car.playerId] || { primary: "#fff", name: "?" };
                return (
                  <div key={car.playerId} style={styles.driverRow}>
                    <span style={{ ...styles.driverDot, background: cfg.primary, boxShadow: `0 0 6px ${cfg.primary}` }} />
                    <span style={{ color: cfg.primary, fontSize: 11, fontFamily: "Courier New", fontWeight: "bold" }}>{cfg.name}</span>
                    <span style={{ color: "#4b6a8a", fontSize: 10, fontFamily: "Courier New", marginLeft: "auto" }}>{car.playerId}</span>
                  </div>
                );
              })
            }
          </PanelCard>

          {/* Log */}
          <PanelCard accentColor="#4b5563" label="TELEMETRY LOG">
            <div style={styles.logBox}>
              {log.length === 0
                ? <span style={{ color: "#1e3a5f" }}>WAITING FOR INPUT…</span>
                : log.map((l, i) => <div key={i} style={{ color: i === log.length - 1 ? "#a0c8e8" : "#3a5a7a" }}>{l}</div>)
              }
            </div>
          </PanelCard>

          <div style={styles.hint}>
            ◈ Open 2 tabs → pick different drivers → connect both → race
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.75} }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

function PanelCard({ children, accentColor, label }) {
  return (
    <div style={{
      background: "rgba(8,14,26,0.85)",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.06)",
      borderLeft: `2px solid ${accentColor}`,
      padding: "12px 14px",
      position: "relative",
    }}>
      <div style={{
        fontFamily: "'Courier New', monospace",
        fontSize: 9,
        color: accentColor,
        letterSpacing: "0.25em",
        textTransform: "uppercase",
        marginBottom: 10,
        opacity: 0.8,
      }}>{label}</div>
      {children}
    </div>
  );
}

const styles = {
  wrapper: {
    background: "#020810",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "'Courier New', monospace",
    padding: "20px",
    position: "relative",
    overflow: "hidden",
  },
  scanlines: {
    position: "fixed",
    inset: 0,
    background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
    pointerEvents: "none",
    zIndex: 100,
  },
  header: {
    textAlign: "center",
    marginBottom: 20,
    position: "relative",
  },
  headerAccentLeft: {
    position: "absolute", left: 0, top: "50%",
    width: "18%", height: 1,
    background: "linear-gradient(90deg, transparent, rgba(0,200,255,0.4))",
  },
  headerAccentRight: {
    position: "absolute", right: 0, top: "50%",
    width: "18%", height: 1,
    background: "linear-gradient(270deg, transparent, rgba(0,200,255,0.4))",
  },
  titleRow: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
  },
  titleBadge: {
    fontFamily: "'Courier New', monospace",
    fontSize: 11,
    fontWeight: "bold",
    border: "1px solid",
    padding: "2px 8px",
    borderRadius: 3,
    letterSpacing: 3,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontFamily: "'Courier New', monospace",
    fontWeight: "bold",
    color: "#ffffff",
    letterSpacing: "0.18em",
    textShadow: "0 0 20px rgba(0,200,255,0.5), 0 0 40px rgba(0,200,255,0.2)",
  },
  liveTag: {
    fontFamily: "'Courier New', monospace",
    fontSize: 10,
    color: "#00ff88",
    letterSpacing: 2,
    padding: "3px 8px",
    border: "1px solid rgba(0,255,136,0.3)",
    borderRadius: 3,
    background: "rgba(0,255,136,0.06)",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "rgba(0,200,255,0.35)",
    fontSize: 9,
    letterSpacing: "0.3em",
    textTransform: "uppercase",
  },
  mainLayout: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  canvasWrap: {
    position: "relative",
    padding: 3,
    background: "rgba(0,0,0,0.3)",
    borderRadius: 6,
  },
  corner: {
    position: "absolute",
    width: 16,
    height: 16,
    zIndex: 2,
  },
  canvas: {
    borderRadius: 4,
    display: "block",
  },
  sidePanel: {
    width: 210,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  statusRow: {
    display: "flex", alignItems: "center", gap: 8,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: "50%", display: "inline-block",
  },
  roomLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 2,
    marginTop: 6,
  },
  select: {
    width: "100%",
    padding: "8px 10px",
    background: "rgba(0,10,25,0.8)",
    border: "1px solid",
    borderRadius: 4,
    fontSize: 11,
    fontFamily: "'Courier New', monospace",
    fontWeight: "bold",
    letterSpacing: 1,
    cursor: "pointer",
    outline: "none",
  },
  swatchRow: {
    display: "flex",
    gap: 8,
    margin: "10px 0 10px",
    justifyContent: "center",
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 3,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  btn: {
    width: "100%",
    padding: "9px",
    border: "1px solid",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "'Courier New', monospace",
    fontWeight: "bold",
    letterSpacing: "0.1em",
    transition: "all 0.15s ease",
  },
  driverRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  driverDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
    display: "inline-block",
    flexShrink: 0,
  },
  logBox: {
    fontSize: 10,
    lineHeight: 1.8,
    maxHeight: 120,
    overflowY: "auto",
    fontFamily: "'Courier New', monospace",
  },
  hint: {
    fontSize: 9,
    color: "#1e3a5f",
    lineHeight: 1.7,
    letterSpacing: "0.05em",
    textAlign: "center",
    padding: "4px 0",
  },
};