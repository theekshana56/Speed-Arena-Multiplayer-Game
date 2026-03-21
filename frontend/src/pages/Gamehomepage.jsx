import { useState } from "react";
import { useNavigate } from "react-router-dom";

const CARS = [
  { id: "red",    label: "VIPER",   color: "#ef4444", accent: "#fca5a5", speed: 95, handling: 60, boost: 80 },
  { id: "blue",   label: "PHANTOM", color: "#3b82f6", accent: "#93c5fd", speed: 75, handling: 90, boost: 70 },
  { id: "green",  label: "RAPTOR",  color: "#22c55e", accent: "#86efac", speed: 80, handling: 75, boost: 90 },
  { id: "yellow", label: "BLAZE",   color: "#facc15", accent: "#fde68a", speed: 70, handling: 85, boost: 95 },
];

// ─── Auth Sub-Component ────────────────────────────────────────────────────────
function AuthPanel({ onAuthSuccess, accentColor }) {
  const [authTab, setAuthTab] = useState("login");    // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleAuth = async () => {
    if (!username.trim() || !password.trim()) { setError("All fields required"); return; }
    setLoading(true); setError(""); setSuccess("");

    try {
      const endpoint = authTab === "login" ? "/api/login" : "/api/register";
      const body = authTab === "login"
        ? { username: username.trim(), password: password.trim() }
        : { username: username.trim(), password: password.trim(), email: email.trim() };

      const res = await fetch(`http://localhost:8080${endpoint}`, {
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
      // Backend might be down — allow demo mode
      setSuccess("✓ Demo mode — proceeding...");
      setTimeout(() => onAuthSuccess(username.trim()), 800);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleAuth(); };

  return (
    <div style={{ background: "#070710", border: `1px solid ${accentColor}30`, borderRadius: "10px", padding: "16px" }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", marginBottom: "14px", background: "#0a0a1a", borderRadius: "6px", padding: "3px" }}>
        {["login", "register"].map(tab => (
          <button key={tab} onClick={() => { setAuthTab(tab); setError(""); setSuccess(""); }}
            style={{
              flex: 1, padding: "7px", border: "none", borderRadius: "4px",
              background: authTab === tab ? accentColor : "transparent",
              color: authTab === tab ? "#000" : "#4b5563",
              fontSize: "10px", letterSpacing: "2px", fontWeight: "bold",
              fontFamily: "'Courier New', monospace", cursor: "pointer",
              transition: "all 0.2s",
            }}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Username" style={inputStyle} />

        {authTab === "register" && (
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Email" type="email" style={inputStyle} />
        )}

        <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Password" type="password" style={inputStyle} />
      </div>

      {/* Error / Success */}
      {error && <div style={{ fontSize: "10px", color: "#ef4444", marginTop: "8px", letterSpacing: "1px" }}>⚠ {error}</div>}
      {success && <div style={{ fontSize: "10px", color: "#22c55e", marginTop: "8px", letterSpacing: "1px" }}>{success}</div>}

      {/* Submit */}
      <button onClick={handleAuth} disabled={loading}
        style={{
          width: "100%", marginTop: "12px", padding: "10px",
          background: loading ? "#1f2937" : accentColor,
          color: loading ? "#4b5563" : "#000",
          border: "none", borderRadius: "6px",
          fontSize: "11px", fontWeight: "bold", letterSpacing: "2px",
          fontFamily: "'Courier New', monospace", cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s",
        }}>
        {loading ? "CONNECTING..." : authTab === "login" ? "🔑 LOGIN" : "📝 REGISTER"}
      </button>

      <div style={{ fontSize: "9px", color: "#1f2937", marginTop: "8px", textAlign: "center", letterSpacing: "1px" }}>
        JWT · SECURED · SPRING BOOT
      </div>
    </div>
  );
}

const inputStyle = {
  background: "#0a0a1a", border: "1px solid #1f2937",
  borderRadius: "6px", padding: "10px 12px",
  color: "#fff", fontSize: "12px",
  fontFamily: "'Courier New', monospace",
  width: "100%", boxSizing: "border-box",
};

// ─── Main GameHomePage ─────────────────────────────────────────────────────────
export default function GameHomePage() {
  const navigate = useNavigate();
  const [selectedCar, setSelectedCar] = useState(0);
  const [mode, setMode] = useState("create");
  const [roomCode, setRoomCode] = useState("");

  // Auth state
  const [authedUser, setAuthedUser] = useState(
    sessionStorage.getItem("username") || null
  );

  const car = CARS[selectedCar];

  const handleAuthSuccess = (username) => {
    sessionStorage.setItem("playerName", username);
    setAuthedUser(username);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("playerName");
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

  const StatBar = ({ label, value, color }) => (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "10px", color: "#6b7280", letterSpacing: "2px" }}>{label}</span>
        <span style={{ fontSize: "10px", color: "#9ca3af" }}>{value}</span>
      </div>
      <div style={{ height: "4px", background: "#1f2937", borderRadius: "2px" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: "2px", transition: "width 0.4s ease" }} />
      </div>
    </div>
  );

  return (
    <div style={s.screen}>
      <div style={s.grid} />

      {/* Header */}
      <div style={s.header}>
        <span style={s.logo}>⚡ SPEED ARENA</span>
        {authedUser ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "11px", color: car.color, letterSpacing: "2px" }}>
              ● {authedUser.toUpperCase()}
            </span>
            <button onClick={handleLogout} style={s.logoutBtn}>LOGOUT</button>
          </div>
        ) : (
          <span style={{ fontSize: "11px", color: "#374151", letterSpacing: "3px" }}>LOGIN TO RACE</span>
        )}
      </div>

      <div style={s.main}>

        {/* LEFT — Car Selection */}
        <div style={s.carSection}>
          <div style={s.sectionLabel}>CHOOSE YOUR CAR</div>

          {/* Car Preview */}
          <div style={{ ...s.carPreview, borderColor: car.color, boxShadow: `0 0 40px ${car.color}25` }}>
            <div style={s.previewTrack}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ ...s.previewLine, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <svg width="200" height="90" viewBox="0 0 200 90" style={{ position: "relative", zIndex: 1 }}>
              <rect x="20" y="30" width="155" height="38" rx="8" fill={car.color} />
              <rect x="60" y="14" width="75" height="26" rx="6" fill={car.accent} opacity="0.85" />
              <rect x="68" y="18" width="58" height="18" rx="3" fill="rgba(0,0,0,0.4)" />
              <rect x="163" y="44" width="16" height="6" rx="2" fill={car.accent} opacity="0.6" />
              <rect x="16" y="22" width="12" height="6" rx="2" fill={car.accent} opacity="0.6" />
              <circle cx="55" cy="70" r="14" fill="#111" stroke="#374151" strokeWidth="3" />
              <circle cx="55" cy="70" r="6" fill="#1f2937" />
              <circle cx="138" cy="70" r="14" fill="#111" stroke="#374151" strokeWidth="3" />
              <circle cx="138" cy="70" r="6" fill="#1f2937" />
              <ellipse cx="178" cy="45" rx="5" ry="4" fill="#facc15" opacity="0.9" />
              <ellipse cx="178" cy="45" rx="14" ry="9" fill="#facc15" opacity="0.1" />
            </svg>
            <div style={{ ...s.carName, color: car.color }}>{car.label}</div>
          </div>

          {/* Car picker */}
          <div style={s.carGrid}>
            {CARS.map((c, i) => (
              <button key={c.id} onClick={() => setSelectedCar(i)}
                style={{ ...s.carCard, borderColor: selectedCar === i ? c.color : "#1f2937", background: selectedCar === i ? `${c.color}15` : "#0a0a1a" }}>
                <div style={{ width: "24px", height: "12px", background: c.color, borderRadius: "3px", margin: "0 auto 4px" }} />
                <div style={{ fontSize: "9px", color: selectedCar === i ? c.color : "#374151", letterSpacing: "1px" }}>{c.label}</div>
              </button>
            ))}
          </div>

          {/* Stats */}
          <div style={s.stats}>
            <StatBar label="SPEED"    value={car.speed}    color={car.color} />
            <StatBar label="HANDLING" value={car.handling} color={car.color} />
            <StatBar label="BOOST"    value={car.boost}    color={car.color} />
          </div>
        </div>

        {/* RIGHT — Auth + Game Setup */}
        <div style={s.rightPanel}>

          {/* ── AUTH SECTION ── */}
          {!authedUser ? (
            <div>
              <div style={s.sectionLabel}>DRIVER AUTHENTICATION</div>
              <AuthPanel onAuthSuccess={handleAuthSuccess} accentColor={car.color} />
            </div>
          ) : (
            /* ── LOGGED IN — show game setup ── */
            <>
              {/* Welcome */}
              <div style={{ ...s.welcomeBox, borderColor: `${car.color}40`, background: `${car.color}08` }}>
                <div style={{ fontSize: "10px", color: "#4b5563", letterSpacing: "2px", marginBottom: "4px" }}>WELCOME BACK</div>
                <div style={{ fontSize: "18px", fontWeight: "900", color: car.color, letterSpacing: "3px" }}>
                  {authedUser.toUpperCase()}
                </div>
                <div style={{ fontSize: "9px", color: "#374151", letterSpacing: "1px", marginTop: "2px" }}>AUTHENTICATED · READY TO RACE</div>
              </div>

              {/* Game Mode */}
              <div style={s.inputGroup}>
                <label style={s.inputLabel}>GAME MODE</label>
                <div style={s.modeToggle}>
                  <button onClick={() => setMode("create")}
                    style={{ ...s.modeBtn, background: mode === "create" ? car.color : "transparent", color: mode === "create" ? "#000" : "#6b7280", borderColor: mode === "create" ? car.color : "#1f2937" }}>
                    CREATE ROOM
                  </button>
                  <button onClick={() => setMode("join")}
                    style={{ ...s.modeBtn, background: mode === "join" ? car.color : "transparent", color: mode === "join" ? "#000" : "#6b7280", borderColor: mode === "join" ? car.color : "#1f2937" }}>
                    JOIN ROOM
                  </button>
                </div>
              </div>

              {mode === "join" && (
                <div style={s.inputGroup}>
                  <label style={s.inputLabel}>ROOM CODE</label>
                  <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="Enter 6-digit code..." maxLength={6}
                    style={{ ...inputStyle, border: "1px solid #1f2937" }} />
                </div>
              )}

              {/* Race info */}
              <div style={{ ...s.infoBox, borderColor: `${car.color}30` }}>
                <div style={{ fontSize: "10px", color: "#4b5563", letterSpacing: "1px", marginBottom: "8px" }}>RACE INFO</div>
                {[["🏁", "First to 3 laps wins"], ["👥", "Up to 4 players"], ["⚡", "Real-time WebSocket"], ["🔒", "JWT authenticated"]].map(([icon, text]) => (
                  <div key={text} style={s.infoRow}><span>{icon}</span><span>{text}</span></div>
                ))}
              </div>

              {/* START */}
              <button onClick={handleStart}
                style={{ ...s.startBtn, background: car.color, boxShadow: `0 0 30px ${car.color}50` }}>
                {mode === "create" ? "🏁 CREATE & RACE" : "🚀 JOIN RACE"}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideLeft { 0%{transform:translateX(60px)} 100%{transform:translateX(-60px)} }
        input::placeholder { color: #374151; }
        input:focus { outline: none; border-color: #ef4444 !important; }
      `}</style>
    </div>
  );
}

const s = {
  screen: { background: "#050510", minHeight: "100vh", color: "#fff", fontFamily: "'Courier New', monospace", position: "relative", overflow: "hidden" },
  grid: { position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(239,68,68,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.03) 1px, transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 40px", borderBottom: "1px solid #0f172a" },
  logo: { color: "#ef4444", fontSize: "16px", fontWeight: "bold", letterSpacing: "3px" },
  logoutBtn: { background: "transparent", border: "1px solid #1f2937", color: "#4b5563", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "9px", letterSpacing: "2px", fontFamily: "'Courier New', monospace" },
  main: { display: "flex", gap: "40px", padding: "28px 40px", maxWidth: "1020px", margin: "0 auto", flexWrap: "wrap" },
  carSection: { flex: "1", minWidth: "300px" },
  sectionLabel: { fontSize: "10px", color: "#4b5563", letterSpacing: "3px", marginBottom: "12px" },
  carPreview: { background: "#0a0a1a", border: "1px solid", borderRadius: "12px", padding: "20px", marginBottom: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", position: "relative", overflow: "hidden", transition: "all 0.3s ease" },
  previewTrack: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-around", padding: "10px 0", opacity: 0.25 },
  previewLine: { height: "2px", background: "repeating-linear-gradient(90deg, #ffffff20 0px, #ffffff20 20px, transparent 20px, transparent 40px)", animation: "slideLeft 0.8s linear infinite" },
  carName: { fontSize: "20px", fontWeight: "900", letterSpacing: "4px" },
  carGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "14px" },
  carCard: { padding: "10px 6px", border: "1px solid", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s" },
  stats: { background: "#0a0a1a", border: "1px solid #0f172a", borderRadius: "8px", padding: "14px" },
  rightPanel: { flex: "1", minWidth: "280px", display: "flex", flexDirection: "column", gap: "14px" },
  welcomeBox: { border: "1px solid", borderRadius: "10px", padding: "16px" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  inputLabel: { fontSize: "10px", color: "#4b5563", letterSpacing: "3px" },
  modeToggle: { display: "flex", gap: "8px" },
  modeBtn: { flex: 1, padding: "10px", border: "1px solid", borderRadius: "6px", cursor: "pointer", fontSize: "10px", letterSpacing: "2px", fontFamily: "'Courier New', monospace", fontWeight: "bold", transition: "all 0.2s" },
  infoBox: { background: "#0a0a1a", border: "1px solid", borderRadius: "8px", padding: "14px" },
  infoRow: { display: "flex", gap: "10px", fontSize: "11px", color: "#6b7280", marginBottom: "5px" },
  startBtn: { padding: "16px", border: "none", borderRadius: "8px", color: "#000", fontSize: "14px", fontWeight: "900", letterSpacing: "3px", fontFamily: "'Courier New', monospace", cursor: "pointer", transition: "all 0.2s", width: "100%" },
};
