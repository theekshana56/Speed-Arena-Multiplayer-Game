import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { canonicalMapId } from "../game/track/polylineTrack.js";
import { getOrCreateNetworkPlayerId } from "../session/playerIdentity.js";
import { clampGridSlot } from "../utils/gridSlot.js";
import { PALETTE } from "../theme/midnightSpark.js";

const WS_URL = "http://127.0.0.1:8080/ws-racing";
const CAR_COLORS = { 
  red: "#ff3333", 
  blue: "#00a2ff", 
  green: "#00e87a", 
  yellow: "#ffd520" 
};
const CAR_LABELS  = { 
  red: "VIPER", 
  blue: "PHANTOM", 
  green: "RAPTOR", 
  yellow: "BLAZE" 
};

export default function RoomLobbyPage() {
  const navigate = useNavigate();

  // Pull session data set by GameHomePage
  const carColor   = sessionStorage.getItem("carColor")   || "red";
  const roomId     = sessionStorage.getItem("roomId")     || "ROOM01";
  const isHost     = sessionStorage.getItem("isHost")     === "true";

  const playerId = useMemo(() => getOrCreateNetworkPlayerId(), []);

  const [players, setPlayers]     = useState([]);
  const [connected, setConnected] = useState(false);
  const [mapId, setMapId] = useState(() => canonicalMapId(sessionStorage.getItem("mapId")));
  const [slots, setSlots] = useState({});
  const [copied, setCopied]       = useState(false);
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
        client.subscribe(`/topic/room/${roomId}/start`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            if (data?.startAtEpochMs) sessionStorage.setItem("startAtEpochMs", String(data.startAtEpochMs));
            if (data?.mapId) sessionStorage.setItem("mapId", canonicalMapId(data.mapId));
          } catch {
            // ignore
          }
          navigate("/race");
        });

        // Subscribe to host-selected map for the room
        client.subscribe(`/topic/room/${roomId}/map`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            const newMap = canonicalMapId(data?.mapId);
            if (!newMap) return;
            setMapId(newMap);
            sessionStorage.setItem("mapId", newMap);
          } catch {
            // ignore
          }
        });

        // Subscribe to slot assignments (join order -> start grid index)
        client.subscribe(`/topic/room/${roomId}/slots`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            setSlots(data || {});
            const mySlot = data?.[playerId];
            if (typeof mySlot === "number") {
              sessionStorage.setItem("startIndex", String(mySlot));
            }
          } catch {
            // ignore
          }
        });
      },

      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    });

    client.activate();
    clientRef.current = client;

    return () => client.deactivate();
  }, []);

  useEffect(() => {
    if (!connected || !clientRef.current) return;
    const raw = typeof slots[playerId] === "number"
      ? slots[playerId]
      : Number(sessionStorage.getItem("startIndex"));
    clientRef.current.publish({
      destination: "/app/player.join",
      body: JSON.stringify({
        playerId,
        roomId,
        carColor,
        x: 340,
        y: 75,
        angle: 0,
        speed: 0,
        status: "WAITING",
        gridSlot: clampGridSlot(raw),
      }),
    });
  }, [connected, slots, playerId, roomId, carColor]);

  // Countdown removed

  // ── Host starts the race ─────────────────────────────────────────────────
  const startRace = () => {
    // Broadcast start signal to all players in this room
    clientRef.current?.publish({
      destination: `/app/game.start`,
      body: JSON.stringify({ roomId }),
    });
  };

  const selectMap = (newMapId) => {
    if (!connected) return;
    const id = canonicalMapId(newMapId);
    if (!id) return;
    setMapId(id);
    sessionStorage.setItem("mapId", id);
    clientRef.current?.publish({
      destination: "/app/room.map.select",
      body: JSON.stringify({ roomId, hostPlayerId: playerId, mapId: id }),
    });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const myColor = CAR_COLORS[carColor] || "#ff3333";
  const canStart = players.length >= 2 && !!mapId;

  return (
    <div style={s.screen}>
      <div style={s.grid} />

      {/* Countdown overlay removed */}

      {/* ── Header ── */}
      <div style={s.header}>
        <button onClick={() => { clientRef.current?.deactivate(); navigate("/home"); }} style={s.backBtn}>
          ← BACK
        </button>
        <div style={{ textAlign: "center" }}>
            <span style={s.logo}>⚡ SPEED ARENA</span>
            <div style={{ fontSize: "8px", letterSpacing: "4px", color: `${PALETTE.oxygen}44`, marginTop: "2px", fontFamily: "'Orbitron', sans-serif" }}>MULTIPLAYER LOBBY</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: connected ? PALETTE.neonMint : PALETTE.orange, display: "inline-block", boxShadow: `0 0 10px ${connected ? PALETTE.neonMint : PALETTE.orange}` }} />
          <span style={{ fontSize: "10px", color: connected ? PALETTE.neonMint : `${PALETTE.oxygen}44`, letterSpacing: "1px", fontWeight: "bold", fontFamily: "'Orbitron', sans-serif" }}>
            {connected ? "CONNECTED" : "CONNECTING..."}
          </span>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={s.main}>

        {/* LEFT col */}
        <div style={s.leftCol}>

          {/* Room code card */}
          <div style={{ ...s.card, borderColor: `${myColor}40`, boxShadow: `0 0 40px ${myColor}15`, background: "rgba(255,255,255,0.03)" }}>
            <div style={s.cardLabel}>MISSION CODE</div>
            <div style={{ ...s.roomCode, color: myColor, textShadow: `0 0 20px ${myColor}40` }}>{roomId}</div>
            <button onClick={copyCode} style={{ ...s.copyBtn, borderColor: `${myColor}60`, color: copied ? PALETTE.neonMint : myColor, background: copied ? `${PALETTE.neonMint}18` : "transparent" }}>
              {copied ? "✓ CODE COPIED!" : "📋 COPY MISSION CODE"}
            </button>
            <p style={s.hint}>
              Share this code with other drivers to initialize a synchronized racing session. 
            </p>
          </div>

          {/* Status */}
          <div style={{ ...s.card, background: "rgba(255,255,255,0.03)" }}>
            <div style={s.cardLabel}>OPERATIONAL STATUS</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: PALETTE.neonMint, display: "inline-block", animation: "pulse 1.5s ease-in-out infinite", boxShadow: `0 0 8px ${PALETTE.neonMint}` }} />
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "2px", fontWeight: "bold", fontFamily: "'Orbitron', sans-serif" }}>
                {players.length < 4 ? `WAITING FOR DRIVERS${dots}` : "LOBBY CAPACITY REACHED"}
              </span>
            </div>

            {/* Player slots bar */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: "6px", borderRadius: "3px",
                  background: i < players.length
                    ? (CAR_COLORS[players[i]?.carColor] || myColor)
                    : "rgba(255,255,255,0.05)",
                  transition: "all 0.4s ease",
                  boxShadow: i < players.length ? `0 0 8px ${CAR_COLORS[players[i]?.carColor] || myColor}60` : "none"
                }} />
              ))}
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontFamily: "'Orbitron', sans-serif" }}>
              <span style={{ color: myColor, fontSize: "24px", fontWeight: "900" }}>{players.length}</span>
              <span style={{ color: "rgba(255,255,255,0.2)", marginLeft: "8px", letterSpacing: "2px" }}>/ 4 DRIVERS DEPLOYED</span>
            </div>
          </div>

          {/* Race details */}
          <div style={{ ...s.card, background: "rgba(255,255,255,0.03)" }}>
            <div style={s.cardLabel}>SESSION SPECIFICATIONS</div>
            {[
              ["PROTOCOL", "WEBSOCKET-SECURE"],
              ["MAP", mapId ? mapId.toUpperCase() : (isHost ? "SELECT MAP" : "WAITING MAP")],
              ["OBJECTIVE", "3 LAPS"],
              ["SYNC", "REAL-TIME"],
            ].map(([k, v]) => (
              <div key={k} style={s.detailRow}>
                <span style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "2px" }}>{k}</span>
                <span style={{ color: k === "SYNC" ? PALETTE.orange : `${PALETTE.oxygen}99`, fontWeight: "bold" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Host map selection */}
          {isHost && (
            <div style={{ ...s.card, background: "rgba(255,255,255,0.03)" }}>
              <div style={s.cardLabel}>HOST MAP CONTROL</div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {[
                  { id: "forest", label: "FOREST" },
                  { id: "desert", label: "DESERT" },
                  { id: "snow", label: "SNOW" },
                ].map((m) => {
                  const active = mapId === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => selectMap(m.id)}
                      style={{
                        width: "auto",
                        padding: "12px 14px",
                        borderRadius: "10px",
                        fontSize: "11px",
                        fontWeight: "900",
                        letterSpacing: "3px",
                        fontFamily: "'Orbitron', sans-serif",
                        transition: "all 0.25s",
                        background: active ? myColor : "rgba(255,255,255,0.03)",
                        color: active ? "#000" : "rgba(255,255,255,0.7)",
                        border: `1px solid ${active ? myColor : "rgba(255,255,255,0.08)"}`,
                        cursor: "pointer",
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: "10px", fontSize: "10px", color: "rgba(255,255,255,0.25)", letterSpacing: "2px", fontFamily: "'Orbitron', sans-serif" }}>
                {mapId ? `SELECTED: ${mapId.toUpperCase()}` : "SELECT A MAP TO ENABLE START"}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT col — player list */}
        <div style={s.rightCol}>
          <div style={s.sectionLabel}>
            ACTIVE PERSONNEL
            <span style={{ color: "rgba(255,255,255,0.2)", marginLeft: "12px" }}>({players.length} / 4)</span>
          </div>

          {/* 4 player slots */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[...Array(4)].map((_, i) => {
              const p = players[i];
              const isMe = p?.playerId === playerId;
              const pColor = CAR_COLORS[p?.carColor] || "rgba(255,255,255,0.05)";

              return (
                <div key={i} style={{
                  ...s.slot,
                  borderColor: p ? `${pColor}40` : "rgba(255,255,255,0.05)",
                  background: p ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.01)",
                  backdropFilter: p ? "blur(10px)" : "none",
                  opacity: p ? 1 : 0.5,
                  transform: p ? "translateX(0)" : "scale(0.98)",
                }}>
                  {p ? (
                    <>
                      {/* Car color bar */}
                      <div style={{ width: "4px", alignSelf: "stretch", background: pColor, borderRadius: "2px", flexShrink: 0, boxShadow: `0 0 10px ${pColor}` }} />

                      {/* Car mini */}
                      <div style={{ width: "42px", height: "20px", background: pColor, borderRadius: "4px", boxShadow: `0 0 15px ${pColor}80`, flexShrink: 0 }} />

                      {/* Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "900", color: isMe ? pColor : "#fff", letterSpacing: "2px", fontFamily: "'Orbitron', sans-serif" }}>
                            {p.playerId.toUpperCase()}
                          </span>
                          {isMe && (
                            <span style={{ fontSize: "8px", border: `1px solid ${pColor}`, color: pColor, borderRadius: "4px", padding: "2px 6px", letterSpacing: "2px", fontWeight: "bold" }}>
                              YOU
                            </span>
                          )}
                          {i === 0 && (
                            <span style={{ fontSize: "8px", background: `${PALETTE.orange}18`, border: `1px solid ${PALETTE.orange}55`, color: PALETTE.orange, borderRadius: "4px", padding: "2px 6px", letterSpacing: "2px", fontWeight: "bold" }}>
                              HOST
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", fontFamily: "'Orbitron', sans-serif", marginTop: "2px", display: "block" }}>
                          UNIT: {CAR_LABELS[p.carColor] || "—"}
                        </span>
                      </div>

                      {/* Ready badge */}
                      <div style={{ fontSize: "9px", color: PALETTE.neonMint, background: `${PALETTE.neonMint}14`, border: `1px solid ${PALETTE.neonMint}33`, borderRadius: "6px", padding: "6px 10px", letterSpacing: "2px", fontWeight: "bold", fontFamily: "'Orbitron', sans-serif" }}>
                        ✓ READY
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ width: "4px", alignSelf: "stretch", background: "rgba(255,255,255,0.05)", borderRadius: "2px" }} />
                      <div style={{ width: "42px", height: "20px", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "4px" }} />
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.1)", letterSpacing: "3px", fontFamily: "'Orbitron', sans-serif" }}>
                        WAITING FOR SIGNAL{dots}
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
                background: canStart ? myColor : "rgba(255,255,255,0.05)",
                color: canStart ? "#000" : "rgba(255,255,255,0.2)",
                cursor: canStart ? "pointer" : "not-allowed",
                boxShadow: canStart ? `0 0 40px ${myColor}40` : "none",
                marginTop: "20px",
              }}>
              {canStart
                ? "🏁 INITIALIZE RACE"
                : players.length < 2
                  ? `⏳ AWAITING ${2 - players.length > 0 ? 2 - players.length : 0} MORE DRIVER${players.length < 1 ? "S" : ""}...`
                  : "🗺️ SELECT MAP..."}
            </button>
          ) : (
            <div style={{ ...s.waitingMsg, marginTop: "20px" }}>
              <span style={{ animation: "pulse 1.5s ease-in-out infinite", display: "inline-block" }}>⏳</span>
              &nbsp; AWAITING HOST COMMAND TO START...
            </div>
          )}

          {/* How to join instructions */}
          <div style={s.instructions}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "3px", marginBottom: "12px", fontFamily: "'Orbitron', sans-serif" }}>SYNCHRONIZATION GUIDE</div>
            {[
              "1. REPLICATE THE MISSION CODE ABOVE",
              "2. INVITE OTHER DRIVERS TO THE TERMINAL",
              `3. NAVIGATE TO: SPEED-ARENA.GAME/HOME`,
              "4. INPUT CODE → INITIALIZE JOIN",
              "5. LOBBY SUPPORTS UP TO 4 SIMULTANEOUS LINKS",
            ].map((step, i) => (
              <div key={i} style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "6px", letterSpacing: "1px", fontFamily: "'Inter', sans-serif" }}>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes countIn { 0%{transform:scale(3);opacity:0;filter:blur(20px)} 100%{transform:scale(1);opacity:1;filter:blur(0)} }
      `}</style>
    </div>
  );
}

const s = {
  screen: {
    background: `linear-gradient(165deg, ${PALETTE.navy} 0%, ${PALETTE.slateBlue} 42%, ${PALETTE.navy} 100%)`,
    minHeight: "100vh",
    color: PALETTE.oxygen,
    fontFamily: "'Inter', sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    position: "fixed",
    inset: 0,
    backgroundImage: `linear-gradient(${PALETTE.oxygen}0f 1px, transparent 1px), linear-gradient(90deg, ${PALETTE.slateBlue}55 1px, transparent 1px)`,
    backgroundSize: "60px 60px",
    pointerEvents: "none",
    opacity: 0.5,
  },
  overlay: { position: "fixed", inset: 0, background: `${PALETTE.navy}f2`, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(20px)" },
  countNum: { fontSize: "200px", fontWeight: "900", animation: "countIn 0.5s cubic-bezier(0.34,1.56,0.64,1)", fontFamily: "'Orbitron', sans-serif" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "24px 48px",
    borderBottom: `1px solid ${PALETTE.slateBlue}99`,
    background: `linear-gradient(180deg, ${PALETTE.slateBlue}55, ${PALETTE.navy}99)`,
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
    fontFamily: "'Orbitron', sans-serif",
    transition: "all 0.3s",
  },
  logo: {
    color: PALETTE.oxygen,
    textShadow: `0 0 20px ${PALETTE.oxygen}44, 0 0 28px ${PALETTE.orange}33`,
    fontSize: "18px",
    fontWeight: "900",
    letterSpacing: "5px",
    fontFamily: "'Orbitron', sans-serif",
  },
  main: { display: "flex", gap: "40px", padding: "40px 48px", maxWidth: "1100px", margin: "0 auto", flexWrap: "wrap" },
  leftCol: { flex: "1", minWidth: "300px", display: "flex", flexDirection: "column", gap: "20px" },
  rightCol: { flex: "1.3", minWidth: "340px", display: "flex", flexDirection: "column", gap: "16px" },
  card: {
    background: `${PALETTE.slateBlue}33`,
    backdropFilter: "blur(12px)",
    border: `1px solid ${PALETTE.slateBlue}88`,
    borderRadius: "16px",
    padding: "24px",
  },
  cardLabel: { fontSize: "10px", color: `${PALETTE.oxygen}88`, letterSpacing: "4px", marginBottom: "16px", fontFamily: "'Orbitron', sans-serif" },
  roomCode: { fontSize: "52px", fontWeight: "900", letterSpacing: "12px", textAlign: "center", marginBottom: "20px", fontFamily: "'Orbitron', sans-serif" },
  copyBtn: { width: "100%", border: "1px solid", borderRadius: "10px", padding: "14px", cursor: "pointer", fontSize: "11px", letterSpacing: "3px", fontFamily: "'Orbitron', sans-serif", fontWeight: "bold", transition: "all 0.3s", marginBottom: "12px" },
  hint: { fontSize: "11px", color: `${PALETTE.oxygen}66`, letterSpacing: "1px", lineHeight: "1.6", margin: 0, fontFamily: "'Inter', sans-serif" },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    letterSpacing: "1px",
    marginBottom: "10px",
    fontFamily: "'Orbitron', sans-serif",
    borderBottom: `1px solid ${PALETTE.oxygen}0f`,
    paddingBottom: "8px",
  },
  sectionLabel: { fontSize: "11px", color: `${PALETTE.oxygen}88`, letterSpacing: "4px", fontFamily: "'Orbitron', sans-serif" },
  slot: { display: "flex", alignItems: "center", gap: "16px", border: "1px solid", borderRadius: "16px", padding: "18px 24px", minHeight: "70px", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)" },
  startBtn: { width: "100%", padding: "20px", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "900", letterSpacing: "4px", fontFamily: "'Orbitron', sans-serif", transition: "all 0.3s", cursor: "pointer" },
  waitingMsg: {
    textAlign: "center",
    fontSize: "11px",
    color: `${PALETTE.oxygen}88`,
    letterSpacing: "3px",
    padding: "20px",
    border: `1px solid ${PALETTE.slateBlue}88`,
    borderRadius: "16px",
    background: `${PALETTE.navy}99`,
    fontFamily: "'Orbitron', sans-serif",
  },
  instructions: {
    background: `${PALETTE.slateBlue}22`,
    border: `1px solid ${PALETTE.slateBlue}88`,
    borderRadius: "16px",
    padding: "24px",
    marginTop: "8px",
  },
};
