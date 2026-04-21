import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearNetworkPlayerId } from "../session/playerIdentity.js";
import car1 from "../assets/game/car-1.png";
import car2 from "../assets/game/car-2.png";
import { PALETTE } from "../theme/midnightSpark.js";

const CARS = [
  {
    id: "red",
    label: "VIPER",
    speed: 95,
    handling: 60,
    boost: 80,
    image: car1,
    imgFilter: "none",
  },
  {
    id: "blue",
    label: "PHANTOM",
    speed: 75,
    handling: 90,
    boost: 70,
    image: car2,
    imgFilter: "none",
  },
  {
    id: "green",
    label: "RAPTOR",
    speed: 80,
    handling: 75,
    boost: 90,
    image: car1,
    imgFilter: "hue-rotate(88deg) saturate(1.12) brightness(1.02)",
  },
  {
    id: "yellow",
    label: "BLAZE",
    speed: 70,
    handling: 85,
    boost: 95,
    image: car2,
    imgFilter: "hue-rotate(28deg) saturate(1.18) brightness(1.06)",
  },
];

function StatBar({ label, value, variant }) {
  const isBoost = variant === "boost";
  const fillStyle = isBoost
    ? { background: PALETTE.orange, boxShadow: `0 0 12px ${PALETTE.orange}aa` }
    : {
        background: `linear-gradient(90deg, ${PALETTE.slateBlue}, ${PALETTE.neonMint})`,
        boxShadow: `0 0 10px ${PALETTE.neonMint}77`,
      };
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span
          style={{
            fontSize: "10px",
            color: `${PALETTE.oxygen}99`,
            letterSpacing: "2px",
            fontFamily: "'Orbitron', sans-serif",
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: "10px", color: `${PALETTE.oxygen}cc`, fontFamily: "'Orbitron', sans-serif" }}>{value}</span>
      </div>
      <div style={{ height: "6px", background: `${PALETTE.navy}cc`, borderRadius: "3px" }}>
        <div
          style={{
            height: "100%",
            width: `${value}%`,
            borderRadius: "3px",
            transition: "width 0.4s ease",
            ...fillStyle,
          }}
        />
      </div>
    </div>
  );
}

// ─── Auth Sub-Component ────────────────────────────────────────────────────────
function AuthPanel({ onAuthSuccess, accentColor }) {
  const [authTab, setAuthTab] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleAuth = async () => {
    if (!username.trim() || !password.trim()) {
      setError("All fields required");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = authTab === "login" ? "/api/login" : "/api/register";
      const body =
        authTab === "login"
          ? { username: username.trim(), password: password.trim() }
          : { username: username.trim(), password: password.trim(), email: email.trim() };

      const res = await fetch(`http://127.0.0.1:8080${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          sessionStorage.setItem("token", data.token);
          sessionStorage.setItem("username", username.trim());
        }
        setSuccess(authTab === "login" ? "✓ Logged in!" : "✓ Registered!");
        setTimeout(() => onAuthSuccess(username.trim()), 800);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || (authTab === "login" ? "Invalid credentials" : "Registration failed"));
      }
    } catch {
      setSuccess("✓ Demo mode — proceeding...");
      setTimeout(() => onAuthSuccess(username.trim()), 800);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleAuth();
  };

  return (
    <div
      style={{
        background: `${PALETTE.oxygen}08`,
        backdropFilter: "blur(12px)",
        border: `1px solid ${accentColor}40`,
        borderRadius: "12px",
        padding: "20px",
      }}
    >
      <div style={{ display: "flex", marginBottom: "16px", background: `${PALETTE.slateBlue}66`, borderRadius: "8px", padding: "4px" }}>
        {["login", "register"].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setAuthTab(tab);
              setError("");
              setSuccess("");
            }}
            style={{
              flex: 1,
              padding: "8px",
              border: "none",
              borderRadius: "6px",
              background: authTab === tab ? accentColor : "transparent",
              color: authTab === tab ? `${PALETTE.navy}ee` : `${PALETTE.oxygen}66`,
              fontSize: "11px",
              letterSpacing: "2px",
              fontWeight: "bold",
              fontFamily: "'Orbitron', sans-serif",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Username"
          style={inputStyle}
        />

        {authTab === "register" && (
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Email"
            type="email"
            style={inputStyle}
          />
        )}

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Password"
          type="password"
          style={inputStyle}
        />
      </div>

      {error && (
        <div style={{ fontSize: "11px", color: "#c45c5c", marginTop: "10px", letterSpacing: "1px", fontFamily: "'Inter', sans-serif" }}>
          ⚠ {error}
        </div>
      )}
      {success && (
        <div style={{ fontSize: "11px", color: PALETTE.neonMint, marginTop: "10px", letterSpacing: "1px", fontFamily: "'Inter', sans-serif" }}>
          {success}
        </div>
      )}

      <button
        onClick={handleAuth}
        disabled={loading}
        style={{
          width: "100%",
          marginTop: "16px",
          padding: "12px",
          background: loading ? `${PALETTE.oxygen}10` : PALETTE.orange,
          color: loading ? `${PALETTE.oxygen}44` : `${PALETTE.navy}ee`,
          border: "none",
          borderRadius: "8px",
          fontSize: "12px",
          fontWeight: "bold",
          letterSpacing: "2px",
          fontFamily: "'Orbitron', sans-serif",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          boxShadow: loading ? "none" : `0 0 20px ${PALETTE.orange}66`,
        }}
      >
        {loading ? "CONNECTING..." : authTab === "login" ? "🔑 LOGIN" : "📝 REGISTER"}
      </button>

      <div
        style={{
          fontSize: "9px",
          color: `${PALETTE.oxygen}40`,
          marginTop: "12px",
          textAlign: "center",
          letterSpacing: "2px",
          fontFamily: "'Orbitron', sans-serif",
        }}
      >
        JWT · SECURED · SPRING BOOT
      </div>
    </div>
  );
}

const inputStyle = {
  background: `${PALETTE.oxygen}0d`,
  border: `1px solid ${PALETTE.slateBlue}88`,
  borderRadius: "8px",
  padding: "12px 14px",
  color: PALETTE.oxygen,
  fontSize: "13px",
  fontFamily: "'Inter', sans-serif",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "all 0.3s",
};

// ─── Main GameHomePage ─────────────────────────────────────────────────────────
export default function GameHomePage() {
  const navigate = useNavigate();
  const [selectedCar, setSelectedCar] = useState(0);
  const [mode, setMode] = useState("create");
  const [roomCode, setRoomCode] = useState("");

  const [authedUser, setAuthedUser] = useState(sessionStorage.getItem("username") || null);

  useEffect(() => {
    if (!authedUser) {
      navigate("/loading");
    }
  }, [authedUser, navigate]);

  const car = CARS[selectedCar];

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("playerName");
    clearNetworkPlayerId();
    setAuthedUser(null);
  };

  const handleStart = () => {
    if (!authedUser) return;
    sessionStorage.setItem("playerName", authedUser);
    sessionStorage.setItem("carColor", car.id);
    sessionStorage.setItem("carLabel", car.label);
    if (mode === "join" && roomCode.trim()) {
      sessionStorage.setItem("roomId", roomCode.trim().toUpperCase());
      sessionStorage.setItem("isHost", "false");
    } else {
      const id = Math.random().toString(36).substring(2, 8).toUpperCase();
      sessionStorage.setItem("roomId", id);
      sessionStorage.setItem("isHost", "true");
    }
    navigate("/lobby");
  };

  if (!authedUser) return null;

  const panelBorder = `${PALETTE.slateBlue}aa`;
  const accentGlow = `${PALETTE.orange}44`;

  return (
    <div style={s.screen}>
      <div style={s.grid} />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: `linear-gradient(90deg, transparent, ${PALETTE.neonMint}44, ${PALETTE.orange}cc, ${PALETTE.oxygen}88, transparent)`,
        }}
      />

      <div style={s.header}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              ...s.logo,
              color: PALETTE.oxygen,
              textShadow: `0 0 20px ${PALETTE.oxygen}55, 0 0 32px ${PALETTE.orange}33`,
            }}
          >
            ⚡ SPEED ARENA
          </span>
          <span
            style={{
              fontSize: "8px",
              letterSpacing: "4px",
              color: `${PALETTE.oxygen}55`,
              marginTop: "4px",
              fontFamily: "'Orbitron', sans-serif",
            }}
          >
            RACING CONTROL CENTER
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right", marginRight: "12px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "900",
                color: PALETTE.oxygen,
                letterSpacing: "2px",
                fontFamily: "'Orbitron', sans-serif",
              }}
            >
              {authedUser.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: "8px",
                color: PALETTE.orange,
                letterSpacing: "1px",
                fontFamily: "'Orbitron', sans-serif",
                opacity: 0.95,
              }}
            >
              ONLINE · DRIVER
            </div>
          </div>
          <button onClick={handleLogout} style={{ ...s.logoutBtn, borderColor: panelBorder }}>
            LOGOUT
          </button>
        </div>
      </div>

      <div style={s.main}>
        <div style={s.carSection}>
          <div style={s.sectionLabel}>CHOOSE YOUR CAR</div>

          <div
            style={{
              ...s.carPreview,
              borderColor: panelBorder,
              boxShadow: `0 0 40px ${PALETTE.orange}18, 0 12px 40px ${PALETTE.navy}ee`,
              background: `linear-gradient(165deg, ${PALETTE.oxygen}0f, ${PALETTE.slateBlue}55, ${PALETTE.navy}99)`,
            }}
          >
            <div style={s.previewTrack}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ ...s.previewLine, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                maxWidth: "240px",
                minHeight: "120px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `radial-gradient(ellipse at center, ${PALETTE.slateBlue}66 0%, transparent 65%)`,
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              <img
                src={car.image}
                alt=""
                style={{
                  maxWidth: "220px",
                  width: "100%",
                  height: "auto",
                  maxHeight: "140px",
                  objectFit: "contain",
                  filter:
                    car.imgFilter === "none"
                      ? `drop-shadow(0 0 14px ${PALETTE.oxygen}77)`
                      : `${car.imgFilter} drop-shadow(0 0 14px ${PALETTE.neonMint}55)`,
                }}
              />
            </div>
            <div
              style={{
                ...s.carName,
                color: PALETTE.oxygen,
                textShadow: `0 0 28px ${PALETTE.oxygen}66, 0 0 12px ${accentGlow}`,
              }}
            >
              {car.label}
            </div>
          </div>

          <div style={s.carGrid}>
            {CARS.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCar(i)}
                style={{
                  ...s.carCard,
                  borderColor: selectedCar === i ? PALETTE.orange : `${PALETTE.oxygen}22`,
                  background: selectedCar === i ? `${PALETTE.orange}22` : `${PALETTE.oxygen}06`,
                  boxShadow: selectedCar === i ? `inset 0 0 16px ${PALETTE.orange}35, 0 0 12px ${PALETTE.orange}28` : "none",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "40px",
                    margin: "0 auto 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "8px",
                    overflow: "hidden",
                    background: `${PALETTE.slateBlue}77`,
                  }}
                >
                  <img
                    src={c.image}
                    alt=""
                    style={{
                      maxWidth: "100%",
                      maxHeight: "40px",
                      objectFit: "contain",
                      filter: c.imgFilter,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    color: selectedCar === i ? PALETTE.oxygen : `${PALETTE.oxygen}66`,
                    letterSpacing: "1px",
                    fontWeight: "bold",
                  }}
                >
                  {c.label}
                </div>
              </button>
            ))}
          </div>

          <div style={s.stats}>
            <StatBar label="SPEED" value={car.speed} variant="stat" />
            <StatBar label="HANDLING" value={car.handling} variant="stat" />
            <StatBar label="BOOST" value={car.boost} variant="boost" />
          </div>
        </div>

        <div style={s.rightPanel}>
          <div
            style={{
              ...s.welcomeBox,
              borderColor: panelBorder,
              background: `linear-gradient(135deg, ${PALETTE.slateBlue}66, ${PALETTE.navy}cc)`,
            }}
          >
            <div
              style={{
                fontSize: "10px",
                color: `${PALETTE.oxygen}88`,
                letterSpacing: "3px",
                marginBottom: "6px",
              }}
            >
              OPERATIONAL STATUS
            </div>
            <div style={{ fontSize: "22px", fontWeight: "900", color: PALETTE.oxygen, letterSpacing: "3px" }}>ACTIVE</div>
            <div
              style={{
                fontSize: "9px",
                color: PALETTE.neonMint,
                letterSpacing: "1px",
                marginTop: "4px",
                opacity: 0.95,
              }}
            >
              SYSTEMS ARMED · ENGINE READY
            </div>
          </div>

          <div style={s.inputGroup}>
            <label style={s.inputLabel}>SELECT MISSION</label>
            <div style={s.modeToggle}>
              <button
                type="button"
                onClick={() => setMode("create")}
                style={{
                  ...s.modeBtn,
                  background: mode === "create" ? PALETTE.orange : "transparent",
                  color: mode === "create" ? `${PALETTE.navy}ee` : `${PALETTE.oxygen}55`,
                  borderColor: mode === "create" ? PALETTE.orange : `${PALETTE.slateBlue}aa`,
                  boxShadow: mode === "create" ? `0 0 24px ${PALETTE.orange}66` : "none",
                }}
              >
                NEW SESSION
              </button>
              <button
                type="button"
                onClick={() => setMode("join")}
                style={{
                  ...s.modeBtn,
                  background: mode === "join" ? PALETTE.orange : "transparent",
                  color: mode === "join" ? `${PALETTE.navy}ee` : `${PALETTE.oxygen}55`,
                  borderColor: mode === "join" ? PALETTE.orange : `${PALETTE.slateBlue}aa`,
                  boxShadow: mode === "join" ? `0 0 24px ${PALETTE.orange}66` : "none",
                }}
              >
                JOIN MISSION
              </button>
            </div>
          </div>

          {mode === "join" && (
            <div style={s.inputGroup}>
              <label style={s.inputLabel}>MISSION CODE</label>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ENTER 6-DIGIT CODE..."
                maxLength={6}
                style={{
                  ...inputStyle,
                  border: `1px solid ${PALETTE.slateBlue}aa`,
                  textAlign: "center",
                  fontSize: "16px",
                  fontWeight: "bold",
                  letterSpacing: "4px",
                }}
              />
            </div>
          )}

          <div style={{ ...s.infoBox, borderColor: `${PALETTE.slateBlue}88` }}>
            <div
              style={{
                fontSize: "10px",
                color: `${PALETTE.oxygen}88`,
                letterSpacing: "2px",
                marginBottom: "12px",
              }}
            >
              SESSION PARAMETERS
            </div>
            {[
              ["🏁", "Victory: First to 3 Laps"],
              ["👥", "Capacity: 4 Racers Max"],
              ["⚡", "Logic: RT-WebSocket Sync"],
              ["🔒", "Security: JWT Encryption"],
            ].map(([icon, text]) => (
              <div key={text} style={s.infoRow}>
                <span style={{ opacity: 0.85 }}>{icon}</span>
                <span style={{ fontSize: "11px", color: `${PALETTE.oxygen}aa`, letterSpacing: "1px" }}>{text}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleStart}
            style={{
              ...s.startBtn,
              background: PALETTE.orange,
              boxShadow: `0 0 36px ${PALETTE.orange}77`,
              color: `${PALETTE.navy}ee`,
            }}
          >
            {mode === "create" ? "🏁 INITIALIZE SESSION" : "🚀 DEPLOY TO MISSION"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideLeft { 0%{transform:translateX(60px)} 100%{transform:translateX(-60px)} }
        input::placeholder { color: ${PALETTE.oxygen}44; }
        input:focus {
          border-color: ${PALETTE.orange}cc !important;
          background: ${PALETTE.oxygen}12 !important;
          box-shadow: 0 0 0 3px ${PALETTE.orange}44;
        }
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "24px 48px",
    borderBottom: `1px solid ${PALETTE.slateBlue}99`,
    background: `linear-gradient(180deg, ${PALETTE.slateBlue}55, ${PALETTE.navy}99)`,
    backdropFilter: "blur(12px)",
    zIndex: 10,
  },
  logo: { fontSize: "18px", fontWeight: "900", letterSpacing: "4px", fontFamily: "'Orbitron', sans-serif" },
  logoutBtn: {
    background: `${PALETTE.oxygen}08`,
    border: "1px solid",
    color: `${PALETTE.oxygen}cc`,
    padding: "8px 16px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "10px",
    letterSpacing: "2px",
    fontFamily: "'Orbitron', sans-serif",
    transition: "all 0.3s",
  },
  main: {
    display: "flex",
    gap: "48px",
    padding: "40px 48px",
    maxWidth: "1100px",
    margin: "0 auto",
    flexWrap: "wrap",
    position: "relative",
    zIndex: 5,
  },
  carSection: { flex: "1.2", minWidth: "340px" },
  sectionLabel: {
    fontSize: "11px",
    color: `${PALETTE.oxygen}aa`,
    letterSpacing: "4px",
    marginBottom: "16px",
    fontFamily: "'Orbitron', sans-serif",
  },
  carPreview: {
    backdropFilter: "blur(12px)",
    border: "1px solid",
    borderRadius: "20px",
    padding: "30px",
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "15px",
    position: "relative",
    overflow: "hidden",
    transition: "all 0.3s ease",
  },
  previewTrack: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-around",
    padding: "20px 0",
    opacity: 0.2,
  },
  previewLine: {
    height: "1px",
    background: PALETTE.oxygen,
    width: "100%",
    animation: "slideLeft 1s linear infinite",
  },
  carName: { fontSize: "28px", fontWeight: "900", letterSpacing: "6px", fontFamily: "'Orbitron', sans-serif", marginTop: "10px" },
  carGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" },
  carCard: {
    padding: "12px 8px",
    border: "1px solid",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.3s",
    fontFamily: "'Orbitron', sans-serif",
  },
  stats: {
    background: `${PALETTE.slateBlue}44`,
    backdropFilter: "blur(12px)",
    border: `1px solid ${PALETTE.slateBlue}aa`,
    borderRadius: "16px",
    padding: "24px",
  },
  rightPanel: { flex: "1", minWidth: "320px", display: "flex", flexDirection: "column", gap: "20px" },
  welcomeBox: { border: "1px solid", borderRadius: "16px", padding: "24px", fontFamily: "'Orbitron', sans-serif" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "10px" },
  inputLabel: {
    fontSize: "11px",
    color: `${PALETTE.oxygen}99`,
    letterSpacing: "4px",
    fontFamily: "'Orbitron', sans-serif",
  },
  modeToggle: { display: "flex", gap: "12px" },
  modeBtn: {
    flex: 1,
    padding: "14px",
    border: "1px solid",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "11px",
    letterSpacing: "2px",
    fontFamily: "'Orbitron', sans-serif",
    fontWeight: "bold",
    transition: "all 0.3s",
  },
  infoBox: {
    background: `${PALETTE.slateBlue}33`,
    backdropFilter: "blur(12px)",
    border: "1px solid",
    borderRadius: "16px",
    padding: "24px",
  },
  infoRow: {
    display: "flex",
    gap: "14px",
    color: `${PALETTE.oxygen}aa`,
    marginBottom: "12px",
    alignItems: "center",
  },
  startBtn: {
    padding: "18px",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: "900",
    letterSpacing: "3px",
    fontFamily: "'Orbitron', sans-serif",
    cursor: "pointer",
    transition: "all 0.3s",
    width: "100%",
  },
};
