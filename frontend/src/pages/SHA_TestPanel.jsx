import { useState, useRef, useEffect } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const WS_URL = "http://localhost:8080/ws-racing";

const CAR_COLORS = {
  player_1: "#ef4444",
  player_2: "#3b82f6",
  player_3: "#22c55e",
  player_4: "#f59e0b",
};

const TRACK_WAYPOINTS = [
  { x: 340, y: 80 },
  { x: 480, y: 100 },
  { x: 560, y: 160 },
  { x: 580, y: 240 },
  { x: 560, y: 320 },
  { x: 480, y: 370 },
  { x: 340, y: 390 },
  { x: 200, y: 370 },
  { x: 120, y: 320 },
  { x: 100, y: 240 },
  { x: 120, y: 160 },
  { x: 200, y: 100 },
];

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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grass background
    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer track
    ctx.beginPath();
    ctx.ellipse(340, 235, 260, 175, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#374151";
    ctx.fill();

    // Inner grass
    ctx.beginPath();
    ctx.ellipse(340, 235, 180, 105, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#166534";
    ctx.fill();

    // Center dashed line
    ctx.beginPath();
    ctx.ellipse(340, 235, 220, 140, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Start/finish line
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#fff" : "#000";
      ctx.fillRect(325 + i * 5, 58, 5, 14);
    }
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("START", 340, 52);

    // Draw cars
    Object.values(cars).forEach((car) => {
      const color = CAR_COLORS[car.playerId] || "#ffffff";
      const x = car.x;
      const y = car.y;
      const angle = (car.angle * Math.PI) / 180;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(2, 2, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Car body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-11, -6, 22, 12, 3);
      ctx.fill();

      // Windshield
      ctx.fillStyle = "rgba(200,230,255,0.5)";
      ctx.fillRect(-1, -4, 7, 8);

      // Wheels
      ctx.fillStyle = "#111827";
      [[-13, -7], [8, -7], [-13, 3], [8, 3]].forEach(([wx, wy]) => {
        ctx.fillRect(wx, wy, 5, 4);
      });

      ctx.restore();

      // Player label above car
      ctx.fillStyle = color;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(car.playerId.replace("player_", "P"), x, y - 16);
    });

  }, [cars]);

  const connect = () => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      onConnect: () => {
        setConnected(true);
        addLog(`✅ ${playerId} connected`);
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
      onStompError: () => addLog("❌ Connection error — is backend running?"),
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
    addLog(`🏁 ${playerId} is racing!`);
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

  return (
    <div style={{ background: "#0f0f1a", minHeight: "100vh", color: "#fff", fontFamily: "monospace", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center" }}>

      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "22px", color: "#facc15", letterSpacing: "2px" }}>🏎️ SPEED ARENA</h2>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "11px" }}>Real-Time Multiplayer · WebSocket · Member 2</p>
      </div>

      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>

        {/* Track */}
        <canvas ref={canvasRef} width={680} height={470}
          style={{ borderRadius: "12px", border: "2px solid #1f2937", display: "block" }} />

        {/* Side Panel */}
        <div style={{ width: "200px", display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Status */}
          <div style={panel}>
            <div style={label}>Status</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444", display: "inline-block", boxShadow: connected ? "0 0 6px #22c55e" : "none" }} />
              <span style={{ fontSize: "12px", color: connected ? "#22c55e" : "#ef4444" }}>{connected ? "CONNECTED" : "OFFLINE"}</span>
            </div>
          </div>

          {/* Car Select */}
          <div style={panel}>
            <div style={label}>Your Car</div>
            <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} disabled={connected}
              style={{ width: "100%", padding: "7px", background: "#2d2d3d", color: "#fff", border: "1px solid #374151", borderRadius: "6px", fontSize: "12px" }}>
              <option value="player_1">🔴 Player 1</option>
              <option value="player_2">🔵 Player 2</option>
              <option value="player_3">🟢 Player 3</option>
              <option value="player_4">🟡 Player 4</option>
            </select>
            <div style={{ marginTop: "8px" }}>
              {!connected
                ? <button onClick={connect} style={btnStyle("#2563eb")}>🔌 Connect</button>
                : <button onClick={disconnect} style={btnStyle("#7f1d1d")}>Disconnect</button>
              }
            </div>
          </div>

          {/* Race */}
          <div style={panel}>
            <div style={label}>Race</div>
            {!isMoving
              ? <button onClick={startMoving} disabled={!connected} style={btnStyle(connected ? "#16a34a" : "#1f2937")}>🏁 Start Racing</button>
              : <button onClick={stopMoving} style={btnStyle("#b45309")}>⏹ Stop</button>
            }
            <button onClick={sendPing} disabled={!connected} style={{ ...btnStyle(connected ? "#6d28d9" : "#1f2937"), marginTop: "8px" }}>
              📡 Ping
            </button>
          </div>

          {/* Players on track */}
          <div style={panel}>
            <div style={label}>On Track ({Object.keys(cars).length})</div>
            {Object.keys(cars).length === 0
              ? <div style={{ color: "#4b5563", fontSize: "11px" }}>No players yet</div>
              : Object.values(cars).map((car) => (
                <div key={car.playerId} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: CAR_COLORS[car.playerId] || "#fff", display: "inline-block" }} />
                  <span style={{ fontSize: "11px", color: "#d1d5db" }}>{car.playerId}</span>
                </div>
              ))
            }
          </div>

          {/* Log */}
          <div style={panel}>
            <div style={label}>Log</div>
            <div style={{ fontSize: "10px", color: "#6b7280", lineHeight: "1.7", maxHeight: "130px", overflowY: "auto" }}>
              {log.length === 0
                ? <span style={{ color: "#374151" }}>Waiting…</span>
                : log.map((l, i) => <div key={i}>{l}</div>)
              }
            </div>
          </div>

          <div style={{ fontSize: "10px", color: "#374151", lineHeight: "1.6" }}>
            💡 Open 2 tabs → pick different players → connect both → start racing
          </div>
        </div>
      </div>
    </div>
  );
}

const panel = { background: "#1a1a2e", borderRadius: "10px", padding: "12px", border: "1px solid #1f2937" };
const label = { fontSize: "10px", color: "#4b5563", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" };
const btnStyle = (bg) => ({
  width: "100%", padding: "8px", background: bg, color: "#fff",
  border: "none", borderRadius: "6px", cursor: "pointer",
  fontSize: "12px", fontFamily: "monospace", fontWeight: "bold"
});
