import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const WS_URL = "http://localhost:8080/ws-racing";
const CAR_COLORS = { red: "#ef4444", blue: "#3b82f6", green: "#22c55e", yellow: "#facc15" };
const CAR_LABELS  = { red: "VIPER", blue: "PHANTOM", green: "RAPTOR", yellow: "BLAZE" };

export default function RoomLobbyPage() {
  const navigate = useNavigate();

  // Pull session data set by GameHomePage
  const playerName = sessionStorage.getItem("playerName") || "PLAYER";
  const carColor   = sessionStorage.getItem("carColor")   || "red";
  const roomId     = sessionStorage.getItem("roomId")     || "ROOM01";
  const isHost     = sessionStorage.getItem("isHost")     === "true";

  const playerId = playerName.toLowerCase().replace(/\s+/g, "_");

  const [players, setPlayers]     = useState([]);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [dots, setDots]           = useState(".");
  const clientRef = useRef(null);

  // Waiting dots animation
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);

  // ── Connect to WebSocket & sync players ──────────────────────────────────
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),

      onConnect: () => {
        setConnected(true);

        // Subscribe to room-specific player list updates
        client.subscribe(`/topic/room/${roomId}/players`, (msg) => {
          const list = JSON.parse(msg.body);
          setPlayers(list);
        });

        // Subscribe to room join events
        client.subscribe(`/topic/room/${roomId}`, (msg) => {
          const car = JSON.parse(msg.body);
          setPlayers(prev => {
            const exists = prev.find(p => p.playerId === car.playerId);
            if (exists) return prev;
            return [...prev, car];
          });
        });

        // Subscribe to game-start signal from host
        client.subscribe(`/topic/room/${roomId}/start`, () => {
          setCountdown(3);
        });

        // Announce this player joining the room
        client.publish({
          destination: "/app/player.join",
          body: JSON.stringify({
            playerId,
            roomId,
            carColor,
            x: 340, y: 75,
            angle: 0, speed: 0,
            status: "WAITING",
          }),
        });
      },

      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    });

    client.activate();
    clientRef.current = client;

    return () => client.deactivate();
  }, []);

  // ── Countdown → navigate to race ─────────────────────────────────────────
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { navigate("/race"); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, navigate]);

  // ── Host starts the race ─────────────────────────────────────────────────
  const startRace = () => {
    // Broadcast start signal to all players in this room
    clientRef.current?.publish({
      destination: `/app/game.start`,
      body: JSON.stringify({ roomId }),
    });
    // Also start locally (host sees countdown too)
    setCountdown(3);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const myColor = CAR_COLORS[carColor] || "#ef4444";
  const canStart = players.length >= 2;

  return (
    <div style={s.screen}>
      <div style={s.grid} />

      {/* ── Countdown overlay ── */}
      {countdown !== null && (
        <div style={s.overlay}>
          <div style={{ ...s.countNum, color: countdown === 0 ? "#22c55e" : "#facc15" }}>
            {countdown === 0 ? "GO!" : countdown}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={s.header}>
        <button onClick={() => { clientRef.current?.deactivate(); navigate("/home"); }} style={s.backBtn}>
          ← BACK
        </button>
        <span style={s.logo}>⚡ SPEED ARENA</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444", display: "inline-block" }} />
          <span style={{ fontSize: "10px", color: connected ? "#22c55e" : "#6b7280", letterSpacing: "1px" }}>
            {connected ? "CONNECTED" : "CONNECTING..."}
          </span>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={s.main}>

        {/* LEFT col */}
        <div style={s.leftCol}>

          {/* Room code card */}
          <div style={{ ...s.card, borderColor: `${myColor}50`, boxShadow: `0 0 30px ${myColor}12` }}>
            <div style={s.cardLabel}>ROOM CODE</div>
            <div style={{ ...s.roomCode, color: myColor }}>{roomId}</div>
            <button onClick={copyCode} style={{ ...s.copyBtn, borderColor: myColor, color: copied ? "#22c55e" : myColor }}>
              {copied ? "✓ COPIED!" : "📋 COPY & SHARE"}
            </button>
            <p style={s.hint}>
              Send this code to friends → they open a new tab → enter code on Game Home → Join Room
            </p>
          </div>

          {/* Status */}
          <div style={s.card}>
            <div style={s.cardLabel}>STATUS</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
              <span style={{ fontSize: "11px", color: "#6b7280", letterSpacing: "1px" }}>
                {players.length < 4 ? `WAITING FOR PLAYERS${dots}` : "LOBBY FULL"}
              </span>
            </div>

            {/* Player slots bar */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: "6px", borderRadius: "3px",
                  background: i < players.length
                    ? (CAR_COLORS[players[i]?.carColor] || myColor)
                    : "#1f2937",
                  transition: "background 0.4s ease",
                }} />
              ))}
            </div>
            <div style={{ fontSize: "11px", color: "#4b5563" }}>
              <span style={{ color: myColor, fontSize: "22px", fontWeight: "900" }}>{players.length}</span>
              <span style={{ color: "#374151" }}>/4 players joined</span>
            </div>
          </div>

          {/* Race details */}
          <div style={s.card}>
            <div style={s.cardLabel}>RACE DETAILS</div>
            {[["ROOM", roomId], ["TRACK", "SPEED OVAL"], ["LAPS", "3"], ["SYNC", "WEBSOCKET"]].map(([k, v]) => (
              <div key={k} style={s.detailRow}>
                <span style={{ color: "#4b5563" }}>{k}</span>
                <span style={{ color: k === "SYNC" ? "#22c55e" : "#9ca3af" }}>{v}{k === "SYNC" ? " ●" : ""}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT col — player list */}
        <div style={s.rightCol}>
          <div style={s.sectionLabel}>
            PLAYERS IN LOBBY
            <span style={{ color: "#374151", marginLeft: "8px" }}>({players.length}/4)</span>
          </div>

          {/* 4 player slots */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[...Array(4)].map((_, i) => {
              const p = players[i];
              const isMe = p?.playerId === playerId;
              const pColor = CAR_COLORS[p?.carColor] || "#374151";

              return (
                <div key={i} style={{
                  ...s.slot,
                  borderColor: p ? `${pColor}40` : "#0f172a",
                  background: p ? "#0a0a1a" : "#060610",
                  opacity: p ? 1 : 0.4,
                }}>
                  {p ? (
                    <>
                      {/* Car color bar */}
                      <div style={{ width: "4px", alignSelf: "stretch", background: pColor, borderRadius: "2px", flexShrink: 0 }} />

                      {/* Car mini */}
                      <div style={{ width: "36px", height: "18px", background: pColor, borderRadius: "4px", boxShadow: `0 0 10px ${pColor}60`, flexShrink: 0 }} />

                      {/* Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "bold", color: isMe ? pColor : "#e5e7eb" }}>
                            {p.playerId.toUpperCase()}
                          </span>
                          {isMe && (
                            <span style={{ fontSize: "8px", border: `1px solid ${pColor}`, color: pColor, borderRadius: "3px", padding: "1px 5px", letterSpacing: "1px" }}>
                              YOU
                            </span>
                          )}
                          {i === 0 && (
                            <span style={{ fontSize: "8px", background: "#facc1520", border: "1px solid #facc1440", color: "#facc14", borderRadius: "3px", padding: "1px 5px", letterSpacing: "1px" }}>
                              HOST
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "10px", color: "#4b5563", letterSpacing: "1px" }}>
                          {CAR_LABELS[p.carColor] || "—"}
                        </span>
                      </div>

                      {/* Ready badge */}
                      <div style={{ fontSize: "9px", color: "#22c55e", background: "#052e16", border: "1px solid #22c55e30", borderRadius: "4px", padding: "4px 8px", letterSpacing: "1px" }}>
                        ✓ READY
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ width: "4px", alignSelf: "stretch", background: "#1f2937", borderRadius: "2px" }} />
                      <div style={{ width: "36px", height: "18px", border: "1px dashed #1f2937", borderRadius: "4px" }} />
                      <span style={{ fontSize: "11px", color: "#1f2937", letterSpacing: "2px" }}>
                        WAITING{dots}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Start button — only host sees active button */}
          {isHost ? (
            <button onClick={startRace} disabled={!canStart}
              style={{
                ...s.startBtn,
                background: canStart ? myColor : "#1f2937",
                color: canStart ? "#000" : "#374151",
                cursor: canStart ? "pointer" : "not-allowed",
                boxShadow: canStart ? `0 0 30px ${myColor}50` : "none",
                marginTop: "16px",
              }}>
              {canStart ? "🏁 START RACE" : `⏳ NEED ${2 - players.length > 0 ? 2 - players.length : 0} MORE PLAYER${players.length < 1 ? "S" : ""}...`}
            </button>
          ) : (
            <div style={{ ...s.waitingMsg, marginTop: "16px" }}>
              <span style={{ animation: "pulse 1.5s ease-in-out infinite", display: "inline-block" }}>⏳</span>
              &nbsp; WAITING FOR HOST TO START THE RACE...
            </div>
          )}

          {/* How to join instructions */}
          <div style={s.instructions}>
            <div style={{ fontSize: "10px", color: "#374151", letterSpacing: "2px", marginBottom: "8px" }}>HOW TO INVITE</div>
            {[
              "1. Copy the room code above",
              "2. Open a new browser tab",
              `3. Go to localhost:5173/home`,
              "4. Enter the code → Join Room",
              "5. Up to 4 players can join",
            ].map((step, i) => (
              <div key={i} style={{ fontSize: "10px", color: "#374151", marginBottom: "4px", letterSpacing: "1px" }}>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes countIn { 0%{transform:scale(2.5);opacity:0} 100%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  );
}

const s = {
  screen: { background: "#050510", minHeight: "100vh", color: "#fff", fontFamily: "'Courier New', monospace", position: "relative", overflow: "hidden" },
  grid: { position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(239,68,68,0.03) 1px, transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.03) 1px,transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" },
  countNum: { fontSize: "180px", fontWeight: "900", animation: "countIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 40px", borderBottom: "1px solid #0f172a" },
  backBtn: { background: "transparent", border: "1px solid #1f2937", color: "#6b7280", padding: "8px 14px", borderRadius: "4px", cursor: "pointer", fontSize: "10px", letterSpacing: "2px", fontFamily: "'Courier New', monospace" },
  logo: { color: "#ef4444", fontSize: "16px", fontWeight: "bold", letterSpacing: "3px" },
  main: { display: "flex", gap: "30px", padding: "28px 40px", maxWidth: "1000px", margin: "0 auto", flexWrap: "wrap" },
  leftCol: { flex: "1", minWidth: "260px", display: "flex", flexDirection: "column", gap: "14px" },
  rightCol: { flex: "1.3", minWidth: "300px", display: "flex", flexDirection: "column", gap: "12px" },
  card: { background: "#0a0a1a", border: "1px solid #0f172a", borderRadius: "10px", padding: "18px" },
  cardLabel: { fontSize: "9px", color: "#374151", letterSpacing: "3px", marginBottom: "12px" },
  roomCode: { fontSize: "44px", fontWeight: "900", letterSpacing: "10px", textAlign: "center", marginBottom: "14px" },
  copyBtn: { width: "100%", background: "transparent", border: "1px solid", borderRadius: "6px", padding: "10px", cursor: "pointer", fontSize: "11px", letterSpacing: "2px", fontFamily: "'Courier New', monospace", fontWeight: "bold", transition: "all 0.2s", marginBottom: "10px" },
  hint: { fontSize: "10px", color: "#374151", letterSpacing: "0.5px", lineHeight: "1.6", margin: 0 },
  detailRow: { display: "flex", justifyContent: "space-between", fontSize: "11px", letterSpacing: "1px", marginBottom: "8px" },
  sectionLabel: { fontSize: "10px", color: "#4b5563", letterSpacing: "3px" },
  slot: { display: "flex", alignItems: "center", gap: "12px", border: "1px solid", borderRadius: "8px", padding: "14px 16px", minHeight: "58px", transition: "all 0.3s ease" },
  startBtn: { width: "100%", padding: "16px", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "900", letterSpacing: "3px", fontFamily: "'Courier New', monospace", transition: "all 0.2s" },
  waitingMsg: { textAlign: "center", fontSize: "10px", color: "#374151", letterSpacing: "2px", padding: "16px", border: "1px solid #0f172a", borderRadius: "8px" },
  instructions: { background: "#070710", border: "1px solid #0f172a", borderRadius: "8px", padding: "14px", marginTop: "4px" },
};
