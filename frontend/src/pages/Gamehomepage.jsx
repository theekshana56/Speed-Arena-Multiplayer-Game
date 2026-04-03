import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearNetworkPlayerId } from "../session/playerIdentity.js";

const CARS = [
  { id: "red",    label: "VIPER",   color: "#ff3333", accent: "#ff6666", speed: 95, handling: 60, boost: 80 },
  { id: "blue",   label: "PHANTOM", color: "#00a2ff", accent: "#33b5ff", speed: 75, handling: 90, boost: 70 },
  { id: "green",  label: "RAPTOR",  color: "#00e87a", accent: "#33f095", speed: 80, handling: 75, boost: 90 },
  { id: "yellow", label: "BLAZE",   color: "#ffd520", accent: "#ffde4d", speed: 70, handling: 85, boost: 95 },
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
      // Backend might be down — allow demo mode
      setSuccess("✓ Demo mode — proceeding...");
      setTimeout(() => onAuthSuccess(username.trim()), 800);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleAuth(); };

  return (
    <div style={{ background: "rgba(255, 255, 255, 0.03)", backdropFilter: "blur(12px)", border: `1px solid ${accentColor}30`, borderRadius: "12px", padding: "20px" }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", marginBottom: "16px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "4px" }}>
        {["login", "register"].map(tab => (
          <button key={tab} onClick={() => { setAuthTab(tab); setError(""); setSuccess(""); }}
            style={{
              flex: 1, padding: "8px", border: "none", borderRadius: "6px",
              background: authTab === tab ? accentColor : "transparent",
              color: authTab === tab ? "#000" : "rgba(255,255,255,0.4)",
              fontSize: "11px", letterSpacing: "2px", fontWeight: "bold",
              fontFamily: "'Orbitron', sans-serif", cursor: "pointer",
              transition: "all 0.2s",
            }}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
      {error && <div style={{ fontSize: "11px", color: "#ff3333", marginTop: "10px", letterSpacing: "1px", fontFamily: "'Inter', sans-serif" }}>⚠ {error}</div>}
      {success && <div style={{ fontSize: "11px", color: "#00e87a", marginTop: "10px", letterSpacing: "1px", fontFamily: "'Inter', sans-serif" }}>{success}</div>}

      {/* Submit */}
      <button onClick={handleAuth} disabled={loading}
        style={{
          width: "100%", marginTop: "16px", padding: "12px",
          background: loading ? "rgba(255,255,255,0.05)" : accentColor,
          color: loading ? "rgba(255,255,255,0.2)" : "#000",
          border: "none", borderRadius: "8px",
          fontSize: "12px", fontWeight: "bold", letterSpacing: "2px",
          fontFamily: "'Orbitron', sans-serif", cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          boxShadow: loading ? "none" : `0 0 20px ${accentColor}40`,
        }}>
        {loading ? "CONNECTING..." : authTab === "login" ? "🔑 LOGIN" : "📝 REGISTER"}
      </button>

      <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginTop: "12px", textAlign: "center", letterSpacing: "2px", fontFamily: "'Orbitron', sans-serif" }}>
        JWT · SECURED · SPRING BOOT
      </div>
    </div>
  );
}

const inputStyle = {
  background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "8px", padding: "12px 14px",
  color: "#fff", fontSize: "13px",
  fontFamily: "'Inter', sans-serif",
  width: "100%", boxSizing: "border-box",
  outline: "none",
  transition: "all 0.3s",
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

  const StatBar = ({ label, value, color }) => (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
        <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.4)", letterSpacing:"2px", fontFamily: "'Orbitron', sans-serif" }}>{label}</span>
        <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.6)", fontFamily: "'Orbitron', sans-serif" }}>{value}</span>
      </div>
      <div style={{ height:"6px", background:"rgba(255,255,255,0.05)", borderRadius:"3px" }}>
        <div style={{ height:"100%", width:`${value}%`, background:color, borderRadius:"3px", transition:"width 0.4s ease", boxShadow: `0 0 10px ${color}60` }} />
      </div>
    </div>
  );

  if (!authedUser) return null;

  return (
    <div style={s.screen}>
      <div style={s.grid} />
      
      {/* HUD style backgrounds */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${car.color}40, transparent)` }} />

      {/* Header */}
      <div style={s.header}>
        <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ ...s.logo, color: car.color }}>⚡ SPEED ARENA</span>
            <span style={{ fontSize: "8px", letterSpacing: "4px", color: "rgba(255,255,255,0.2)", marginTop: "4px", fontFamily: "'Orbitron', sans-serif" }}>RACING CONTROL CENTER</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right", marginRight: "12px" }}>
            <div style={{ fontSize: "12px", fontWeight: "900", color: "#fff", letterSpacing: "2px", fontFamily: "'Orbitron', sans-serif" }}>
                {authedUser.toUpperCase()}
            </div>
            <div style={{ fontSize: "8px", color: car.color, letterSpacing: "1px", fontFamily: "'Orbitron', sans-serif", opacity: 0.8 }}>
                ONLINE · DRIVER
            </div>
          </div>
          <button onClick={handleLogout} style={{ ...s.logoutBtn, borderColor: `${car.color}40` }}>LOGOUT</button>
        </div>
      </div>

      <div style={s.main}>

        {/* LEFT — Car Selection */}
        <div style={s.carSection}>
          <div style={s.sectionLabel}>CHOOSE YOUR CAR</div>

          {/* Car Preview */}
          <div style={{ ...s.carPreview, borderColor: `${car.color}30`, boxShadow: `0 0 60px ${car.color}15` }}>
            <div style={s.previewTrack}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ ...s.previewLine, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <svg width="220" height="100" viewBox="0 0 200 90" style={{ position: "relative", zIndex: 1, filter: `drop-shadow(0 0 15px ${car.color}40)` }}>
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
            <div style={{ ...s.carName, color: car.color, textShadow: `0 0 20px ${car.color}60` }}>{car.label}</div>
          </div>

          {/* Car picker */}
          <div style={s.carGrid}>
            {CARS.map((c, i) => (
              <button key={c.id} onClick={() => setSelectedCar(i)}
                style={{ 
                    ...s.carCard, 
                    borderColor: selectedCar === i ? c.color : "rgba(255,255,255,0.05)", 
                    background: selectedCar === i ? `${c.color}15` : "rgba(255,255,255,0.02)",
                    boxShadow: selectedCar === i ? `inset 0 0 15px ${c.color}20` : "none"
                }}>
                <div style={{ width: "24px", height: "12px", background: c.color, borderRadius: "3px", margin: "0 auto 6px", boxShadow: `0 0 8px ${c.color}60` }} />
                <div style={{ fontSize: "9px", color: selectedCar === i ? "#fff" : "rgba(255,255,255,0.3)", letterSpacing: "1px", fontWeight: "bold" }}>{c.label}</div>
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

        {/* RIGHT — Game Setup */}
        <div style={s.rightPanel}>
          {/* Welcome */}
          <div style={{ ...s.welcomeBox, borderColor: `${car.color}30`, background: `${car.color}05` }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "3px", marginBottom: "6px" }}>OPERATIONAL STATUS</div>
            <div style={{ fontSize: "22px", fontWeight: "900", color: "#fff", letterSpacing: "3px" }}>
              ACTIVE
            </div>
            <div style={{ fontSize: "9px", color: car.color, letterSpacing: "1px", marginTop: "4px", opacity: 0.8 }}>SYSTEMS ARMED · ENGINE READY</div>
          </div>

          {/* Game Mode */}
          <div style={s.inputGroup}>
            <label style={s.inputLabel}>SELECT MISSION</label>
            <div style={s.modeToggle}>
              <button onClick={() => setMode("create")}
                style={{ ...s.modeBtn, background: mode === "create" ? car.color : "transparent", color: mode === "create" ? "#000" : "rgba(255,255,255,0.4)", borderColor: mode === "create" ? car.color : "rgba(255,255,255,0.1)" }}>
                NEW SESSION
              </button>
              <button onClick={() => setMode("join")}
                style={{ ...s.modeBtn, background: mode === "join" ? car.color : "transparent", color: mode === "join" ? "#000" : "rgba(255,255,255,0.4)", borderColor: mode === "join" ? car.color : "rgba(255,255,255,0.1)" }}>
                JOIN MISSION
              </button>
            </div>
          </div>

          {mode === "join" && (
            <div style={s.inputGroup}>
              <label style={s.inputLabel}>MISSION CODE</label>
              <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ENTER 6-DIGIT CODE..." maxLength={6}
                style={{ ...inputStyle, border: "1px solid rgba(255,255,255,0.1)", textAlign: "center", fontSize: "16px", fontWeight: "bold", letterSpacing: "4px" }} />
            </div>
          )}

          {/* Race info */}
          <div style={{ ...s.infoBox, borderColor: "rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", marginBottom: "12px" }}>SESSION PARAMETERS</div>
            {[["🏁", "Victory: First to 3 Laps"], ["👥", "Capacity: 4 Racers Max"], ["⚡", "Logic: RT-WebSocket Sync"], ["🔒", "Security: JWT Encryption"]].map(([icon, text]) => (
              <div key={text} style={s.infoRow}>
                  <span style={{ opacity: 0.8 }}>{icon}</span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", letterSpacing: "1px" }}>{text}</span>
              </div>
            ))}
          </div>

          {/* START */}
          <button onClick={handleStart}
            style={{ ...s.startBtn, background: car.color, boxShadow: `0 0 40px ${car.color}40`, color: "#000" }}>
            {mode === "create" ? "🏁 INITIALIZE SESSION" : "🚀 DEPLOY TO MISSION"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideLeft { 0%{transform:translateX(60px)} 100%{transform:translateX(-60px)} }
        input::placeholder { color: rgba(255,255,255,0.1); }
        input:focus { border-color: ${car.color}80 !important; background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

const s = {
  screen: { background: "#03030e", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif", position: "relative", overflow: "hidden" },
  grid: { position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 48px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)", backdropFilter: "blur(10px)", zIndex: 10 },
  logo: { fontSize: "18px", fontWeight: "900", letterSpacing: "4px", fontFamily: "'Orbitron', sans-serif" },
  logoutBtn: { background: "rgba(255,255,255,0.03)", border: "1px solid", color: "rgba(255,255,255,0.4)", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "10px", letterSpacing: "2px", fontFamily: "'Orbitron', sans-serif", transition: "all 0.3s" },
  main: { display: "flex", gap: "48px", padding: "40px 48px", maxWidth: "1100px", margin: "0 auto", flexWrap: "wrap", position: "relative", zIndex: 5 },
  carSection: { flex: "1.2", minWidth: "340px" },
  sectionLabel: { fontSize: "11px", color: "rgba(255,255,255,0.3)", letterSpacing: "4px", marginBottom: "16px", fontFamily: "'Orbitron', sans-serif" },
  carPreview: { background: "rgba(255, 255, 255, 0.03)", backdropFilter: "blur(12px)", border: "1px solid", borderRadius: "20px", padding: "30px", marginBottom: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "15px", position: "relative", overflow: "hidden", transition: "all 0.3s ease" },
  previewTrack: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-around", padding: "20px 0", opacity: 0.15 },
  previewLine: { height: "1px", background: "rgba(255,255,255,0.5)", width: "100%", animation: "slideLeft 1s linear infinite" },
  carName: { fontSize: "28px", fontWeight: "900", letterSpacing: "6px", fontFamily: "'Orbitron', sans-serif", marginTop: "10px" },
  carGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" },
  carCard: { padding: "14px 10px", border: "1px solid", borderRadius: "12px", cursor: "pointer", transition: "all 0.3s", fontFamily: "'Orbitron', sans-serif" },
  stats: { background: "rgba(255, 255, 255, 0.03)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "24px" },
  rightPanel: { flex: "1", minWidth: "320px", display: "flex", flexDirection: "column", gap: "20px" },
  welcomeBox: { border: "1px solid", borderRadius: "16px", padding: "24px", fontFamily: "'Orbitron', sans-serif" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "10px" },
  inputLabel: { fontSize: "11px", color: "rgba(255,255,255,0.3)", letterSpacing: "4px", fontFamily: "'Orbitron', sans-serif" },
  modeToggle: { display: "flex", gap: "12px" },
  modeBtn: { flex: 1, padding: "14px", border: "1px solid", borderRadius: "10px", cursor: "pointer", fontSize: "11px", letterSpacing: "2px", fontFamily: "'Orbitron', sans-serif", fontWeight: "bold", transition: "all 0.3s" },
  infoBox: { background: "rgba(255, 255, 255, 0.03)", backdropFilter: "blur(12px)", border: "1px solid", borderRadius: "16px", padding: "24px" },
  infoRow: { display: "flex", gap: "14px", color: "rgba(255,255,255,0.5)", marginBottom: "12px", alignItems: "center" },
  startBtn: { padding: "18px", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "900", letterSpacing: "3px", fontFamily: "'Orbitron', sans-serif", cursor: "pointer", transition: "all 0.3s", width: "100%" },
};
