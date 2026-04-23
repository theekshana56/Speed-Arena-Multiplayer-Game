import { useState, useRef, useEffect } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import groundImg from "../assets/racing/ground.png";
import roadImg from "../assets/racing/road-1.png";
import roadBendImg from "../assets/racing/road-bend-1.png";
import car1Img from "../assets/racing/car-1.png";
import car2Img from "../assets/racing/car-2.png";
import treeImg from "../assets/racing/tree-1.png";
import finishLineImg from "../assets/racing/finish-line-1.png";

const WS_URL = "http://localhost:8086/ws-racing";

const CAR_CONFIGS = {
  player_1: { name: "VIPER", image: car1Img, color: "#ff3b3b" },
  player_2: { name: "STORM", image: car2Img, color: "#00b4ff" },
  player_3: { name: "GHOST", image: car1Img, color: "#00ff88" },
  player_4: { name: "BLAZE", image: car2Img, color: "#ffa500" },
};

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

const DECORATIONS = [
  { x: 100, y: 100 }, { x: 600, y: 50 }, { x: 300, y: 250 },
  { x: 50, y: 400 }, { x: 650, y: 420 }, { x: 500, y: 150 }
];

export default function RacingTrack() {
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState("player_1");
  const [roomId] = useState("room_001");
  const [cars, setCars] = useState({});
  const [isMoving, setIsMoving] = useState(false);
  const clientRef = useRef(null);
  const moveIntervalRef = useRef(null);
  const waypointRef = useRef(0);
  const canvasRef = useRef(null);
  const imagesRef = useRef({});

  const startTimeRef = useRef(Date.now());
  const [laps, setLaps] = useState(0);

  // Load images
  useEffect(() => {
    const images = {
      ground: new Image(),
      road: new Image(),
      roadBend: new Image(),
      car1: new Image(),
      car2: new Image(),
      tree: new Image(),
      finishLine: new Image(),
    };
    images.ground.src = groundImg;
    images.road.src = roadImg;
    images.roadBend.src = roadBendImg;
    images.car1.src = car1Img;
    images.car2.src = car2Img;
    images.tree.src = treeImg;
    images.finishLine.src = finishLineImg;
    imagesRef.current = images;
  }, []);

  const drawMinimap = (ctx, canvasWidth, canvasHeight) => {
    const mapW = 120;
    const mapH = 80;
    const mapX = canvasWidth - mapW - 10;
    const mapY = canvasHeight - mapH - 10;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // Scale track waypoints to minimap
    const scale = 0.15;
    const offsetX = mapX + 10;
    const offsetY = mapY + 10;

    ctx.beginPath();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    TRACK_WAYPOINTS.forEach((wp, i) => {
      const x = wp.x * scale + offsetX;
      const y = wp.y * scale + offsetY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();

    // Draw players on minimap
    Object.values(cars).forEach(car => {
      const cfg = CAR_CONFIGS[car.playerId] || { color: "#fff" };
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.arc(car.x * scale + offsetX, car.y * scale + offsetY, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };

  const drawHUD = (ctx, canvasWidth) => {
    ctx.save();
    ctx.font = "bold 16px 'Courier New'";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;

    // Lap Counter
    ctx.fillText(`LAP ${laps}/3`, 20, 30);

    // Timer
    const elapsed = Date.now() - startTimeRef.current;
    const mins = Math.floor(elapsed / 60000).toString().padStart(2, '0');
    const secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
    const ms = Math.floor((elapsed % 1000) / 10).toString().padStart(2, '0');
    ctx.textAlign = "right";
    ctx.fillText(`${mins}:${secs}.${ms}`, canvasWidth - 20, 30);

    // Position
    ctx.textAlign = "left";
    ctx.fillText("POS 1/4", 20, canvasRef.current.height - 20);
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const imgs = imagesRef.current;

    // 1. Draw Ground (Solid with noise)
    ctx.fillStyle = "#7CB044";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Simple noise effect
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    for(let i=0; i<100; i++) {
        ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 2, 2);
    }

    // 2. Draw Track Curves (Curbs)
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    const drawPath = (width, color, dash = []) => {
        ctx.beginPath();
        ctx.setLineDash(dash);
        TRACK_WAYPOINTS.forEach((wp, i) => {
            const next = TRACK_WAYPOINTS[(i + 1) % TRACK_WAYPOINTS.length];
            const mx = (wp.x + next.x) / 2;
            const my = (wp.y + next.y) / 2;
            if (i === 0) ctx.moveTo(mx, my);
            else ctx.quadraticCurveTo(wp.x, wp.y, mx, my);
        });
        ctx.closePath();
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    // Curbs (Red/White stripes)
    drawPath(54, "#fff"); // Base white
    drawPath(54, "#ff0000", [20, 20]); // Red stripes

    // Main Tarmac
    drawPath(46, "#4A4A4A");

    // Center Line
    drawPath(2, "rgba(255,255,255,0.5)", [10, 15]);
    
    ctx.restore();

    // 3. Draw Finish Line
    const sf = TRACK_WAYPOINTS[0];
    if (imgs.finishLine.complete) {
        ctx.drawImage(imgs.finishLine, sf.x - 30, sf.y - 25, 60, 50);
    }

    // 4. Draw Decorations
    DECORATIONS.forEach(dec => {
        if (imgs.tree.complete) {
            ctx.drawImage(imgs.tree, dec.x, dec.y, 40, 40);
        }
    });

    // 5. Draw Cars
    Object.values(cars).forEach((car) => {
      const config = CAR_CONFIGS[car.playerId] || { name: "?", image: imgs.car1, color: "#fff" };
      const { x, y, angle } = car;
      const rad = (angle * Math.PI) / 180;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rad + Math.PI / 2);

      // Car shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(3, 3, 12, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      if (imgs.car1.complete && imgs.car2.complete) {
          const carImg = car.playerId === 'player_1' || car.playerId === 'player_3' ? imgs.car1 : imgs.car2;
          ctx.drawImage(carImg, -15, -20, 30, 40);
      } else {
          ctx.fillStyle = config.color;
          ctx.fillRect(-10, -15, 20, 30);
      }
      ctx.restore();

      // Label above car
      ctx.fillStyle = config.color;
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeText(config.name, x, y - 30);
      ctx.fillText(config.name, x, y - 30);
    });

    // 6. HUD & Minimap
    drawHUD(ctx, canvas.width);
    drawMinimap(ctx, canvas.width, canvas.height);
  };

  useEffect(() => {
    const interval = setInterval(draw, 1000/60);
    return () => clearInterval(interval);
  }, [cars]);

  const connect = () => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/room/${roomId}/game-state`, (msg) => {
          const car = JSON.parse(msg.body);
          setCars((prev) => ({ ...prev, [car.playerId]: car }));
        });
        const start = TRACK_WAYPOINTS[0];
        client.publish({
          destination: "/app/player.join",
          body: JSON.stringify({ playerId, roomId, x: start.x, y: start.y, angle: 0, speed: 0, status: "WAITING" }),
        });
      },
      onDisconnect: () => setConnected(false),
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
    startTimeRef.current = Date.now();
    setLaps(1);
    moveIntervalRef.current = setInterval(() => {
      const prevWP = waypointRef.current;
      waypointRef.current = (waypointRef.current + 1) % TRACK_WAYPOINTS.length;
      
      // Lap detection
      if (prevWP > waypointRef.current) {
          setLaps(l => Math.min(3, l + 1));
      }

      const wp = TRACK_WAYPOINTS[waypointRef.current];
      const prev = TRACK_WAYPOINTS[(waypointRef.current - 1 + TRACK_WAYPOINTS.length) % TRACK_WAYPOINTS.length];
      const angle = Math.atan2(wp.y - prev.y, wp.x - prev.x) * (180 / Math.PI);
      clientRef.current?.publish({
        destination: "/app/car.move",
        body: JSON.stringify({ playerId, roomId, x: wp.x, y: wp.y, angle, speed: 8, status: "RACING", lapsCompleted: 0 }),
      });
    }, 200);
  };

  const stopMoving = () => {
    setIsMoving(false);
    if (moveIntervalRef.current) { clearInterval(moveIntervalRef.current); moveIntervalRef.current = null; }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>SPEED ARENA - SPRITE TRACK</h1>
        <div style={styles.controls}>
          <select value={playerId} onChange={e => setPlayerId(e.target.value)} disabled={connected}>
            <option value="player_1">VIPER (Red)</option>
            <option value="player_2">STORM (Blue)</option>
            <option value="player_3">GHOST (Green)</option>
            <option value="player_4">BLAZE (Orange)</option>
          </select>
          <button onClick={connected ? disconnect : connect} style={connected ? styles.btnOff : styles.btnOn}>
            {connected ? "Disconnect" : "Connect"}
          </button>
          <button onClick={isMoving ? stopMoving : startMoving} disabled={!connected} style={styles.btnRace}>
            {isMoving ? "Stop" : "Race!"}
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} width={800} height={500} style={styles.canvas} />
      <div style={styles.footer}>
          {connected ? "● Connected" : "○ Disconnected"} | Players: {Object.keys(cars).length}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex", flexDirection: "column", alignItems: "center",
    background: "#0a0a0a", minHeight: "100vh", color: "#eee", padding: "20px"
  },
  header: { marginBottom: "20px", textAlign: "center" },
  controls: { display: "flex", gap: "10px", marginTop: "10px" },
  canvas: { border: "4px solid #333", borderRadius: "10px", boxShadow: "0 0 30px rgba(0,0,0,0.5)" },
  btnOn: { background: "#2563eb", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "5px", cursor: "pointer" },
  btnOff: { background: "#dc2626", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "5px", cursor: "pointer" },
  btnRace: { background: "#16a34a", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "5px", cursor: "pointer" },
  footer: { marginTop: "15px", fontSize: "12px", opacity: 0.6 }
};
