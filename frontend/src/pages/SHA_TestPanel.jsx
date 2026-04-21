import { useState, useRef, useEffect } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const WS_URL = "http://127.0.0.1:8080/ws-racing";

const CAR_COLORS = {
  player_1: { primary: "#ff3333", glow: "rgba(255, 51, 51, 0.4)", name: "VIPER" },
  player_2: { primary: "#00a2ff", glow: "rgba(0, 162, 255, 0.4)", name: "PHANTOM" },
  player_3: { primary: "#00e87a", glow: "rgba(0, 232, 122, 0.4)", name: "RAPTOR" },
  player_4: { primary: "#ffd520", glow: "rgba(255, 213, 32, 0.4)", name: "BLAZE" },
};

// Professional Race Track Waypoints
const TRACK_WAYPOINTS = [
  { x: 340, y: 70 },
  { x: 440, y: 72 },
  { x: 520, y: 90 },
  { x: 570, y: 130 },
  { x: 585, y: 190 },
  { x: 570, y: 250 },
  { x: 530, y: 300 },
  { x: 470, y: 340 },
  { x: 400, y: 368 },
  { x: 330, y: 378 },
  { x: 250, y: 368 },
  { x: 185, y: 345 },
  { x: 140, y: 300 },
  { x: 115, y: 245 },
  { x: 115, y: 185 },
  { x: 140, y: 130 },
  { x: 185, y: 95 },
  { x: 255, y: 74 },
];

function drawTrack(ctx, W, H) {
  // Atmosphere
  const sky = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, Math.max(W, H));
  sky.addColorStop(0, "#0a0a20");
  sky.addColorStop(1, "#03030e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Subtle Grid
  ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  const wps = TRACK_WAYPOINTS;
  const N = wps.length;

  const buildPath = () => {
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

  // Tarmac
  buildPath();
  ctx.lineWidth = 50;
  ctx.strokeStyle = "#151520";
  ctx.stroke();

  buildPath();
  ctx.lineWidth = 44;
  ctx.strokeStyle = "#1a1a2a";
  ctx.stroke();

  // Edge lines
  ctx.save();
  ctx.setLineDash([8, 12]);
  buildPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Start line
  const sfX = (wps[0].x + wps[N - 1].x) / 2;
  const sfY = (wps[0].y + wps[N - 1].y) / 2 + 2;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#fff" : "#000";
    ctx.fillRect(sfX - 18 + i * 6, sfY - 6, 6, 12);
  }
}

function drawCars(ctx, cars) {
  Object.values(cars).forEach((car) => {
    const config = CAR_COLORS[car.playerId] || { primary: "#fff", glow: "rgba(255,255,255,0.2)", name: "?" };
    const { x, y, angle } = car;
    const rad = (angle * Math.PI) / 180;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rad);

    // Glow
    ctx.shadowColor = config.primary;
    ctx.shadowBlur = 15;
    ctx.fillStyle = config.glow;
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Car Body
    ctx.fillStyle = config.primary;
    ctx.beginPath();
    ctx.roundRect(-13, -5, 26, 10, 3);
    ctx.fill();

    // Secondary Detail
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(2, -3, 6, 6);

    ctx.restore();

    // Name tag
    ctx.fillStyle = config.primary;
    ctx.font = "bold 10px 'Orbitron'";
    ctx.textAlign = "center";
    ctx.fillText(config.name, x, y - 18);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    drawTrack(ctx, canvas.width, canvas.height);
    drawCars(ctx, cars);
  }, [cars]);

  const connect = () => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      onConnect: () => {
        setConnected(true);
        addLog(`⚡ ${playerId} LINK ESTABLISHED`);
        client.subscribe("/topic/game-state", (msg) => {
          const car = JSON.parse(msg.body);
          setCars((prev) => ({ ...prev, [car.playerId]: car }));
        });
        const start = TRACK_WAYPOINTS[0];
        client.publish({
          destination: "/app/player.join",
          body: JSON.stringify({ playerId, roomId, x: start.x, y: start.y, angle: 0, speed: 0, status: "WAITING" }),
        });
      },
      onDisconnect: () => { setConnected(false); addLog("🔌 DISCONNECTED"); },
    });
    client.activate();
    clientRef.current = client;
  };

  const disconnect = () => {
    stopMoving();
    clientRef.current?.deactivate();
    setConnected(false);
  };

  const startMoving = () => {
    if (!connected || isMoving) return;
    setIsMoving(true);
    addLog(`🏁 MISSION START: ${CAR_COLORS[playerId]?.name}`);
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

  const selectedColor = CAR_COLORS[playerId]?.primary || "#fff";

  return (
    <div style={s.screen}>
      <header style={s.header}>
        <div style={{ textAlign: "center" }}>
          <h1 style={s.title}>⚡ NETWORK DIAGNOSTICS</h1>
          <p style={s.subtitle}>WEBSOCKET TERMINAL · {connected ? "LINK STABLE" : "NO LINK"}</p>
        </div>
      </header>

      <div style={s.main}>
        <div style={s.canvasContainer}>
          <canvas ref={canvasRef} width={700} height={460} style={s.canvas} />
          <div style={{ ...s.corner, top: 0, left: 0, borderTop: `2px solid ${selectedColor}`, borderLeft: `2px solid ${selectedColor}` }} />
          <div style={{ ...s.corner, bottom: 0, right: 0, borderBottom: `2px solid ${selectedColor}`, borderRight: `2px solid ${selectedColor}` }} />
        </div>

        <aside style={s.sidebar}>
          <div style={{ ...s.card, borderLeftColor: selectedColor }}>
            <div style={s.cardLabel}>CONNECTION CONTROL</div>
            <select value={playerId} onChange={e => setPlayerId(e.target.value)} disabled={connected} style={s.select}>
              {Object.entries(CAR_COLORS).map(([id, c]) => (
                <option key={id} value={id}>{c.name}</option>
              ))}
            </select>
            <button onClick={connected ? disconnect : connect} style={{ ...s.btn, background: connected ? "rgba(255, 51, 51, 0.1)" : "rgba(0, 162, 255, 0.1)", color: connected ? "#ff3333" : "#00a2ff" }}>
              {connected ? "DISCONNECT" : "CONNECT LINK"}
            </button>
          </div>

          <div style={{ ...s.card, borderLeftColor: isMoving ? "#ffd520" : "#00e87a" }}>
            <div style={s.cardLabel}>RACE OPERATIONS</div>
            <button onClick={isMoving ? stopMoving : startMoving} disabled={!connected} style={{ ...s.btn, background: isMoving ? "rgba(255, 213, 32, 0.1)" : "rgba(0, 232, 122, 0.1)", color: isMoving ? "#ffd520" : "#00e87a" }}>
              {isMoving ? "ABORT MISSION" : "INITIALIZE RACE"}
            </button>
          </div>

          <div style={{ ...s.card, borderLeftColor: "rgba(255,255,255,0.2)" }}>
            <div style={s.cardLabel}>LIVE FEED</div>
            <div style={s.logBox}>
              {log.length === 0 ? "AWAITING TELEMETRY..." : log.map((l, i) => <div key={i} style={{ color: i === log.length - 1 ? "#fff" : "rgba(255,255,255,0.4)" }}>{l}</div>)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

const s = {
  screen: { background: "#03030e", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif", padding: "40px" },
  header: { marginBottom: "40px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "20px" },
  title: { fontSize: "24px", fontWeight: "900", letterSpacing: "6px", fontFamily: "'Orbitron'", margin: 0, color: "#fff" },
  subtitle: { fontSize: "10px", letterSpacing: "4px", color: "rgba(255,255,255,0.3)", margin: "8px 0 0" },
  main: { display: "flex", gap: "30px", justifyContent: "center", flexWrap: "wrap" },
  canvasContainer: { position: "relative", background: "rgba(255,255,255,0.02)", borderRadius: "20px", padding: "10px" },
  canvas: { borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" },
  corner: { position: "absolute", width: "20px", height: "20px", zIndex: 10 },
  sidebar: { width: "240px", display: "flex", flexDirection: "column", gap: "20px" },
  card: { background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.05)", borderLeftWidth: "4px", borderRadius: "12px", padding: "20px" },
  cardLabel: { fontSize: "9px", letterSpacing: "2px", color: "rgba(255,255,255,0.4)", marginBottom: "15px", fontFamily: "'Orbitron'" },
  select: { width: "100%", background: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "10px", color: "#fff", marginBottom: "10px", fontFamily: "'Orbitron'", fontSize: "12px" },
  btn: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid transparent", cursor: "pointer", fontFamily: "'Orbitron'", fontWeight: "bold", transition: "all 0.3s", fontSize: "11px" },
  logBox: { fontSize: "10px", lineHeight: "1.6", maxHeight: "150px", overflowY: "auto", fontFamily: "'monospace'" },
};