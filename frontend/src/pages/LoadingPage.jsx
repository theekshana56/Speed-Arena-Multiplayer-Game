import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser } from "../services/authService";
import { clearNetworkPlayerId } from "../session/playerIdentity.js";

const CAR_COLORS = {
  red: { hex: "#ff3333", glow: "rgba(255,51,51,0.4)", name: "VIPER" },
  blue: { hex: "#00a2ff", glow: "rgba(0,162,255,0.4)", name: "PHANTOM" },
  green: { hex: "#00e87a", glow: "rgba(0,232,122,0.4)", name: "RAPTOR" },
  yellow: { hex: "#ffd520", glow: "rgba(255,213,32,0.4)", name: "BLAZE" },
  cyan: { hex: "#00ffea", glow: "rgba(0,255,234,0.4)", name: "NEON" },
};



const ov = {
  bg: {
    position: "fixed", inset: 0, background: "rgba(3,3,14,0.85)", zIndex: 9999,
    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(12px)"
  },
  box: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px",
    padding: "26px 22px", width: "92vw", fontFamily: "'Inter', sans-serif",
    position: "relative", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
  },
  x: {
    position: "absolute", top: "12px", right: "14px", background: "transparent",
    border: "none", color: "rgba(255,255,255,0.2)", fontSize: "15px", cursor: "pointer",
    padding: "4px 7px", transition: "color 0.2s"
  },
};

// ─── Settings overlay ─────────────────────────────────────────────────────────
function SettingsPanel({ onClose }) {
  const [sfx, setSfx] = useState(80);
  const [music, setMusic] = useState(55);
  const [qual, setQual] = useState("ultra");
  const [fps, setFps] = useState("60");
  const [notif, setNotif] = useState(true);
  const [ghost, setGhost] = useState(true);

  const Toggle = ({ on, set, color = "#3b8fff" }) => (
    <div onClick={() => set(!on)} style={{
      width: "40px", height: "20px", borderRadius: "10px",
      background: on ? color : "rgba(255,255,255,0.05)", border: `1px solid ${on ? color : "rgba(255,255,255,0.1)"}`,
      position: "relative", cursor: "pointer", transition: "all 0.2s"
    }}>
      <div style={{
        position: "absolute", top: "2px", left: on ? "20px" : "2px", width: "14px", height: "14px",
        background: on ? "#000" : "rgba(255,255,255,0.2)", borderRadius: "50%", transition: "left 0.2s",
        boxShadow: on ? `0 0 5px ${color}` : "none"
      }} />
    </div>
  );

  return (
    <div style={ov.bg}>
      <div style={{ ...ov.box, borderColor: "#3b8fff25", maxWidth: "430px" }}>
        <button onClick={onClose} style={ov.x}>✕</button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
          <span style={{ fontSize: "22px", color: "#00ffea" }}>⚙</span>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 900, color: "#fff", letterSpacing: "4px", fontFamily: "'Orbitron', sans-serif" }}>SETTINGS</div>
            <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "3px" }}>GAME PREFERENCES</div>
          </div>
        </div>

        {["AUDIO", "GRAPHICS", "GAMEPLAY"].map(sec => (
          <div key={sec} style={{ marginBottom: "16px" }}>
            <div style={{
              fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "4px",
              paddingBottom: "6px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: "10px", fontFamily: "'Orbitron', sans-serif"
            }}>{sec}</div>
            {sec === "AUDIO" && [["SFX VOLUME", sfx, setSfx, "#ff3333"], ["MUSIC", music, setMusic, "#3b8fff"]].map(([l, v, s, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "9px" }}>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", letterSpacing: "2px", minWidth: "110px", fontFamily: "'Orbitron', sans-serif" }}>{l}</span>
                <input type="range" min={0} max={100} value={v} onChange={e => s(+e.target.value)} style={{ flex: 1, accentColor: c }} />
                <span style={{ fontSize: "10px", color: c, minWidth: "30px", fontWeight: "bold" }}>{v}%</span>
              </div>
            ))}
            {sec === "GRAPHICS" && <>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "9px" }}>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", letterSpacing: "2px", minWidth: "110px", fontFamily: "'Orbitron', sans-serif" }}>QUALITY</span>
                <div style={{ display: "flex", gap: "5px" }}>
                  {["low", "med", "high", "ultra"].map(q => (
                    <button key={q} onClick={() => setQual(q)} style={{
                      padding: "4px 9px",
                      border: `1px solid ${qual === q ? "#00ffea" : "rgba(255,255,255,0.1)"}`, borderRadius: "4px",
                      background: qual === q ? "rgba(0,255,234,0.1)" : "transparent",
                      color: qual === q ? "#00ffea" : "rgba(255,255,255,0.4)", fontSize: "8px", letterSpacing: "1px",
                      fontFamily: "'Orbitron', sans-serif", cursor: "pointer", transition: "all 0.2s"
                    }}>{q.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", letterSpacing: "2px", minWidth: "110px", fontFamily: "'Orbitron', sans-serif" }}>TARGET FPS</span>
                <div style={{ display: "flex", gap: "5px" }}>
                  {["30", "60", "120"].map(f => (
                    <button key={f} onClick={() => setFps(f)} style={{
                      padding: "4px 9px",
                      border: `1px solid ${fps === f ? "#00e87a" : "rgba(255,255,255,0.1)"}`, borderRadius: "4px",
                      background: fps === f ? "rgba(0,232,122,0.1)" : "transparent",
                      color: fps === f ? "#00e87a" : "rgba(255,255,255,0.4)", fontSize: "8px", letterSpacing: "1px",
                      fontFamily: "'Orbitron', sans-serif", cursor: "pointer", transition: "all 0.2s"
                    }}>{f}</button>
                  ))}
                </div>
              </div>
            </>}
            {sec === "GAMEPLAY" && [["NOTIFICATIONS", notif, setNotif, "#ffd520"], ["GHOST CARS", ghost, setGhost, "#00e87a"]].map(([l, v, s, c]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "9px" }}>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", letterSpacing: "2px", fontFamily: "'Orbitron', sans-serif" }}>{l}</span>
                <Toggle on={v} set={s} color={c} />
              </div>
            ))}
          </div>
        ))}

        <button onClick={onClose} style={{
          width: "100%", padding: "11px", background: "#00a2ff",
          color: "#000", border: "none", borderRadius: "7px", fontSize: "10px", fontWeight: "bold",
          letterSpacing: "3px", fontFamily: "'Orbitron', sans-serif", cursor: "pointer",
          boxShadow: "0 0 18px rgba(0,162,255,0.35)", transition: "all 0.3s"
        }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
          SAVE SETTINGS
        </button>
      </div>
    </div>
  );
}


const inputStyle = {
  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
  padding: "12px 14px", color: "#fff", fontSize: "13px",
  fontFamily: "'Inter', sans-serif", width: "100%", outline: "none",
  transition: "all 0.2s"
};

const Field = ({ label, value, set, placeholder, type = "text", onSubmit, ...props }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "2px", fontFamily: "'Orbitron', sans-serif" }}>{label}</span>
    <input value={value} type={type} style={inputStyle}
      onChange={e => set(e.target.value)} placeholder={placeholder}
      onKeyDown={e => e.key === "Enter" && onSubmit && onSubmit()}
      onFocus={e => e.target.style.borderColor = "#00ffea"}
      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
      {...props} />
  </div>
);

// ─── Auth popup modal ──────────────────────────────────────────────────────────
function AuthModal({ onSuccess, onClose }) {
  const [tab, setTab] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [carKey, setCarKey] = useState("red");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  const car = CAR_COLORS[carKey];

  const submit = async () => {
    setMsg({ text: "", type: "" });

    // 1. Basic empty check
    if (!username.trim() || !password.trim()) {
      setMsg({ text: "Username and password required", type: "err" });
      return;
    }

    // 2. Register specific checks
    if (tab === "register") {
      if (!email.trim()) {
        setMsg({ text: "Email is required for registration", type: "err" });
        return;
      }
      if (!email.includes("@")) {
        setMsg({ text: "Please enter a valid email", type: "err" });
        return;
      }
      if (password !== confirm) {
        setMsg({ text: "Passwords do not match", type: "err" });
        return;
      }
      if (password.length < 4) {
        setMsg({ text: "Password must be at least 4 chars", type: "err" });
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === "login") {
        await loginUser(username.trim(), password.trim());
        setMsg({ text: "✓ Welcome back, driver!", type: "ok" });
      } else {
        await registerUser(username.trim(), email.trim(), password.trim());
        setMsg({ text: "✓ Pit crew ready — let's race!", type: "ok" });
      }
      setTimeout(() => onSuccess(username.trim()), 700);
    } catch (err) {
      console.error("[AUTH MODAL ERROR]:", err);
      // Map common errors or show provided one
      const errorMsg = err.message || "Connection to arena failed";
      setMsg({ text: errorMsg, type: "err" });
    } finally {
      setLoading(false);
    }
  };



  return (
    <div style={ov.bg}>
      <div style={{ ...ov.box, borderColor: car.hex + "30", maxWidth: "380px" }}>
        <button onClick={onClose} style={ov.x}>✕</button>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "22px" }}>
          <span style={{ fontSize: "16px", color: car.hex, letterSpacing: "10px", fontWeight: 900, fontFamily: "'Orbitron', sans-serif", textShadow: `0 0 15px ${car.hex}50` }}>
            SPEED ARENA
          </span>
          <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", letterSpacing: "4px", marginTop: "6px", fontFamily: "'Orbitron', sans-serif" }}>DRIVER ACCESS SYSTEMS</div>
        </div>

        {/* Tab row */}
        <div style={{
          display: "flex", gap: "8px", background: "rgba(255,255,255,0.03)", padding: "4px",
          borderRadius: "10px", marginBottom: "20px", border: "1px solid rgba(255,255,255,0.05)"
        }}>
          {["login", "register"].map(t => (
            <button key={t} onClick={() => { setTab(t); setMsg({ text: "", type: "" }); }}
              style={{
                flex: 1, padding: "12px", border: `1px solid ${tab === t ? car.hex : "transparent"}`,
                borderRadius: "7px", background: tab === t ? car.hex : "transparent",
                color: tab === t ? "#000" : "rgba(255,255,255,0.3)", fontSize: "10px", letterSpacing: "3px",
                fontWeight: "bold", fontFamily: "'Orbitron', sans-serif", cursor: "pointer", transition: "all 0.3s"
              }}>
              {t === "login" ? "LOGIN" : "REGISTER"}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "15px" }}>
          <Field label="USERNAME" value={username} set={setUsername} placeholder="TurboRacer99" autoFocus onSubmit={submit} />
          {tab === "register" && <Field label="EMAIL" value={email} set={setEmail} placeholder="driver@speedarena.io" type="email" onSubmit={submit} />}
          <Field label="PASSWORD" value={password} set={setPassword} placeholder="••••••••" type="password" onSubmit={submit} />
          {tab === "register" && <Field label="CONFIRM PASSWORD" value={confirm} set={setConfirm} placeholder="••••••••" type="password" onSubmit={submit} />}
        </div>

        {/* Car picker (register) */}
        {tab === "register" && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "3px", marginBottom: "10px", fontFamily: "'Orbitron', sans-serif" }}>SELECT TEAM COLOR</div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", justifyContent: "center" }}>
              {Object.entries(CAR_COLORS).map(([k, v]) => (
                <button key={k} onClick={() => setCarKey(k)}
                  style={{
                    width: "30px", height: "30px", borderRadius: "6px", border: "none",
                    background: v.hex, cursor: "pointer", transition: "all 0.18s",
                    transform: carKey === k ? "scale(1.2)" : "scale(1)",
                    boxShadow: carKey === k ? `0 0 15px ${v.hex}` : "none",
                    outline: carKey === k ? `2px solid ${v.hex}` : "none", outlineOffset: "2px"
                  }} />
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: "12px" }}>
              <span style={{ fontSize: "11px", color: car.hex, letterSpacing: "4px", fontWeight: "bold", fontFamily: "'Orbitron', sans-serif" }}>{car.name}</span>
            </div>
          </div>
        )}

        {/* Message */}
        {msg.text && (
          <div style={{
            fontSize: "10px", letterSpacing: "1px", padding: "10px", borderRadius: "5px",
            border: "1px solid", marginBottom: "15px", textAlign: "center",
            color: msg.type === "err" ? "#ff4444" : "#00e87a",
            borderColor: msg.type === "err" ? "#ff444420" : "#00e87a20",
            background: msg.type === "err" ? "#ff44440a" : "#00e87a0a"
          }}>
            {msg.type === "err" ? "⚠ " : ""} {msg.text}
          </div>
        )}

        {/* Submit */}
        <button onClick={submit} disabled={loading}
          style={{
            width: "100%", padding: "16px", border: "none", borderRadius: "8px",
            background: loading ? "rgba(255,255,255,0.05)" : car.hex,
            color: loading ? "rgba(255,255,255,0.2)" : "#000",
            fontSize: "12px", fontWeight: "bold", letterSpacing: "4px",
            fontFamily: "'Orbitron', sans-serif", cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : `0 0 25px ${car.glow}`, transition: "all 0.3s"
          }}
          onMouseEnter={e => !loading && (e.currentTarget.style.transform = "scale(1.02)")}
          onMouseLeave={e => !loading && (e.currentTarget.style.transform = "scale(1)")}>
          {loading ? "CONNECTING..." : tab === "login" ? "▶ ENTER COCKPIT" : "▶ JOIN ARENA"}
        </button>

        <div style={{ textAlign: "center", fontSize: "9px", color: "rgba(255,255,255,0.1)", marginTop: "16px", letterSpacing: "2px", fontFamily: "'Orbitron', sans-serif" }}>
          🔒 JWT SECURED · STABLE v2.1.0
        </div>
      </div>
    </div>
  );
}

// ─── Main Loading Page ────────────────────────────────────────────────────────
export default function LoadingPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);
  const [authedUser, setAuthedUser] = useState(sessionStorage.getItem("playerName") || null);

  const [showSettings, setShowSettings] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [scan, setScan] = useState(0);

  // Phase timeline
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2200);
    const t2 = setTimeout(() => setPhase(2), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Scan line
  useEffect(() => {
    const t = setInterval(() => setScan(v => (v + 1) % 100), 38);
    return () => clearInterval(t);
  }, []);

  const handleEnterClick = () => {
    if (authedUser) { navigate("/home"); return; }
    setShowAuth(true);
  };

  const handleAuthSuccess = (username) => {
    setAuthedUser(username);
    if (typeof sessionStorage !== "undefined") {
      clearNetworkPlayerId();
      sessionStorage.setItem("playerName", username);
      sessionStorage.setItem("username", username);
    }
    setShowAuth(false);
    navigate("/home");
  };

  // ── Per-letter style ──
  const letterStyle = (idx, color) => ({
    fontSize: "clamp(40px,7.5vw,80px)", fontWeight: 900,
    letterSpacing: "4px", display: "inline-block", color,
    fontFamily: "'Orbitron', sans-serif",
    textShadow: `0 0 35px ${color}66`,
    animation: `letterDrop 0.6s cubic-bezier(0.34,1.56,0.64,1) both`,
    animationDelay: `${idx * 0.08}s`,
  });

  const showTitle = phase >= 1;

  return (
    <div style={sc.screen}>

      {/* Scan line */}
      <div style={{ ...sc.scanLine, top: `${scan}%` }} />
      <div style={sc.grid} />
      <div style={sc.vignette} />

      {/* Corner brackets */}
      {[
        { top: 16, left: 16, borderTop: "2px solid #ff333348", borderLeft: "2px solid #ff333348", borderRight: "none", borderBottom: "none" },
        { top: 16, right: 16, borderTop: "2px solid #3b8fff48", borderRight: "2px solid #3b8fff48", borderLeft: "none", borderBottom: "none" },
        { bottom: 16, left: 16, borderBottom: "2px solid #ff333448", borderLeft: "2px solid #ff333448", borderTop: "none", borderRight: "none" },
        { bottom: 16, right: 16, borderBottom: "2px solid #3b8fff48", borderRight: "2px solid #3b8fff48", borderTop: "none", borderLeft: "none" },
      ].map((s, i) => (
        <div key={i} style={{ position: "absolute", width: "28px", height: "28px", pointerEvents: "none", ...s }} />
      ))}

      {/* ── Top-left nav ── */}
      <div style={sc.topLeft}>
        <button onClick={() => navigate("/leaderboard")} style={sc.navBtn}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}>
          <span>🏆</span><span>LEADERBOARD</span>
        </button>
        <button onClick={() => setShowSettings(true)} style={{ ...sc.navBtn, color: "#00a2ff", borderColor: "rgba(0,162,255,0.2)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,162,255,0.1)"; e.currentTarget.style.color = "#00a2ff"; e.currentTarget.style.borderColor = "rgba(0,162,255,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#00a2ff"; e.currentTarget.style.borderColor = "rgba(0,162,255,0.2)"; }}>
          <span>⚙</span><span>SETTINGS</span>
        </button>
      </div>

      {/* ── Top-right ── */}
      <div style={sc.topRight}>
        {authedUser ? (
          <div style={sc.userBadge}>
            <span style={{
              width: "7px", height: "7px", borderRadius: "50%", background: "#00e87a",
              boxShadow: "0 0 6px #00e87a", display: "inline-block"
            }} />
            <span style={{ color: "#00e87a", fontSize: "9px", letterSpacing: "2px" }}>
              {authedUser.toUpperCase()}
            </span>
          </div>
        ) : (
          <button onClick={() => setShowAuth(true)} style={sc.loginTopBtn}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,162,255,0.15)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,162,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            LOGIN / REGISTER
          </button>
        )}
      </div>

      {/* ════════ PHASE 0 — Car race ════════ */}
      {phase === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ color: "#00ffea", fontSize: "11px", letterSpacing: "5px", opacity: 0.7, fontFamily: "'Orbitron', sans-serif" }}>
            INITIALIZING TRACK SYSTEMS...
          </div>
          <div style={sc.track}>
            {[0, 1, 2].map(i => <div key={i} style={sc.trackLine} />)}
            <div style={sc.carWrap}>
              <svg width="90" height="32" viewBox="0 0 90 32">
                <defs>
                  <radialGradient id="cg" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#00a2ff" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#00a2ff" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <ellipse cx="45" cy="22" rx="42" ry="9" fill="url(#cg)" opacity="0.5" />
                <rect x="4" y="11" width="74" height="12" rx="3" fill="#00a2ff" />
                <rect x="12" y="5" width="36" height="11" rx="4" fill="#60a5fa" />
                <rect x="18" y="7" width="24" height="7" rx="2" fill="rgba(0,0,0,0.45)" />
                <rect x="6" y="7" width="8" height="4" rx="1" fill="#60a5fa" opacity="0.6" />
                <rect x="76" y="8" width="8" height="4" rx="1" fill="#60a5fa" opacity="0.6" />
                <rect x="10" y="21" width="18" height="7" rx="2" fill="#0a0a1a" stroke="#1d4ed8" strokeWidth="1" />
                <rect x="55" y="21" width="18" height="7" rx="2" fill="#0a0a1a" stroke="#1d4ed8" strokeWidth="1" />
                <ellipse cx="83" cy="14" rx="4" ry="3" fill="#ffd520" opacity="0.9" />
                <ellipse cx="83" cy="14" rx="12" ry="8" fill="#ffd520" opacity="0.12" />
              </svg>
            </div>
          </div>
          <div style={sc.loadingBar}><div style={sc.loadingFill} /></div>
        </div>
      )}

      {/* ════════ PHASES 1-2 — Title ════════ */}
      {showTitle && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", position: "relative" }}>

          {/* Spinning rings */}
          <div style={{ ...sc.ring, animation: "spinRing 10s linear infinite" }} />
          <div style={{
            ...sc.ring, width: "380px", height: "380px",
            borderColor: "rgba(59,143,255,0.055)",
            animation: "spinRing 14s linear infinite reverse"
          }} />

          {/* Letters */}
          <div style={{ display: "flex", gap: "1px", position: "relative", zIndex: 2 }}>
            {"SPEED".split("").map((c, i) => (
              <span key={i} style={letterStyle(i, "#ff3333")}>{c}</span>
            ))}
            <span style={{ width: "14px", display: "inline-block" }} />
            {"ARENA".split("").map((c, i) => (
              <span key={i} style={letterStyle(i + 5, "#ffd520")}>{c}</span>
            ))}
          </div>

          {/* Tagline */}
          <div style={{
            color: "rgba(255,255,255,0.2)", fontSize: "11px", letterSpacing: "6px",
            animation: "pulse 3s ease-in-out infinite",
            position: "relative", zIndex: 2, fontFamily: "'Orbitron', sans-serif"
          }}>
            MULTIPLAYER RACING · REAL-TIME · 2D
          </div>

          {/* Stat pills — phase 2 only */}
          {phase === 2 && (
            <div style={{
              display: "flex", gap: "14px", marginTop: "6px",
              position: "relative", zIndex: 2, animation: "fadeUp 0.8s ease both 0.3s"
            }}>

            </div>
          )}
        </div>
      )}

      {/* ── ENTER ARENA button — bottom-right ── */}
      {phase === 2 && (
        <div style={{
          position: "absolute", bottom: "28px", right: "28px", zIndex: 10,
          display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px",
          animation: "fadeUp 0.6s ease both"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "40px", height: "1px",
              background: "linear-gradient(90deg,transparent,#00ffea80)"
            }} />
            <span style={{ fontSize: "8px", color: "rgba(0,255,234,0.5)", letterSpacing: "3px", fontFamily: "'Orbitron', sans-serif" }}>
              {authedUser ? `READY, ${authedUser.toUpperCase()}` : "AUTHENTICATION REQUIRED"}
            </span>
          </div>
          <button onClick={handleEnterClick}
            style={{
              background: "rgba(0,255,234,0.05)", border: "1px solid rgba(0,255,234,0.3)", color: "#00ffea",
              padding: "15px 30px", borderRadius: "12px", cursor: "pointer",
              fontFamily: "'Orbitron', sans-serif", fontWeight: "bold",
              fontSize: "13px", letterSpacing: "4px",
              animation: "enterGlow 2.5s ease-in-out infinite",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "flex", alignItems: "center", gap: "12px", backdropFilter: "blur(10px)"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#00ffea"; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = "0 0 25px rgba(0,255,234,0.6)"; e.currentTarget.style.transform = "translateX(-5px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,255,234,0.05)"; e.currentTarget.style.color = "#00ffea"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateX(0)"; }}>
            {authedUser ? "ENTER ARENA" : "LOGIN & RACE"}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 8h12M9 3l5 5-5 5" />
            </svg>
          </button>
          <div style={{ fontSize: "7px", color: "#131325", letterSpacing: "2px" }}>v2.0.4 STABLE · SEASON 1</div>
        </div>
      )}

      {/* ── Bottom bar ── */}
      {phase === 2 && (
        <div style={{
          position: "absolute", bottom: "28px", left: "50%", transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: "12px",
          fontSize: "9px", color: "rgba(255,255,255,0.15)", letterSpacing: "3px",
          animation: "fadeUp 0.6s ease both 0.4s", fontFamily: "'Orbitron', sans-serif"
        }}>
          <span>⚡ WEBSOCKET LIVE</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>🔒 JWT AUTH</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>🏎 SPRING BOOT</span>
        </div>
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showAuth && <AuthModal onSuccess={handleAuthSuccess} onClose={() => setShowAuth(false)} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;800&display=swap');
        @keyframes carRace {
          0%   { transform: translateX(-110px); }
          100% { transform: translateX(calc(100vw + 110px)); }
        }
        @keyframes letterDrop {
          0%   { opacity:0; transform:translateY(-36px) scale(1.3); }
          100% { opacity:1; transform:translateY(0)     scale(1);   }
        }
        @keyframes spinRing {
          from { transform:translate(-50%,-50%) rotate(0deg);   }
          to   { transform:translate(-50%,-50%) rotate(360deg); }
        }
        @keyframes dash {
          0%   { transform:translateX(0);     }
          100% { transform:translateX(-60px); }
        }
        @keyframes loadBar {
          0%   { width:0%;    }
          100% { width:100%;  }
        }
        @keyframes pulse {
          0%,100% { opacity:0.4; }
          50%     { opacity:1;   }
        }
        @keyframes enterGlow {
          0%,100% { box-shadow:0 0 18px rgba(0,255,234,0.2), 0 0 36px rgba(0,255,234,0.05); }
          50%     { box-shadow:0 0 30px rgba(0,255,234,0.4), 0 0 55px rgba(0,255,234,0.1); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        input::placeholder { color:#1e1e3a; }
        input:focus { border-color:#3b8fff !important; }
        * { box-sizing:border-box; }
      `}</style>
    </div>
  );
}

const sc = {
  screen: {
    background: "#03030e", minHeight: "100vh", overflow: "hidden",
    position: "relative", fontFamily: "'Inter', sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  scanLine: {
    position: "absolute", left: 0, right: 0, height: "3px",
    background: "linear-gradient(90deg,transparent,rgba(0,255,234,0.05),transparent)",
    pointerEvents: "none", zIndex: 1, transition: "top 0.038s linear",
  },
  grid: {
    position: "absolute", inset: 0,
    backgroundImage: "linear-gradient(rgba(0,255,234,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,234,0.03) 1px,transparent 1px)",
    backgroundSize: "50px 50px", pointerEvents: "none",
  },
  vignette: {
    position: "absolute", inset: 0,
    background: "radial-gradient(ellipse at center,transparent 30%,rgba(0,0,0,0.85) 100%)",
    pointerEvents: "none",
  },
  topLeft: {
    position: "absolute", top: "18px", left: "22px",
    display: "flex", gap: "9px", zIndex: 10,
  },
  navBtn: {
    display: "flex", alignItems: "center", gap: "8px",
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.6)", padding: "8px 16px", borderRadius: "8px",
    cursor: "pointer", fontSize: "10px", letterSpacing: "2px",
    fontFamily: "'Orbitron', sans-serif", fontWeight: "bold",
    backdropFilter: "blur(8px)", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  topRight: {
    position: "absolute", top: "18px", right: "22px", zIndex: 10,
  },
  userBadge: {
    display: "flex", alignItems: "center", gap: "10px",
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0,232,122,0.2)",
    padding: "8px 16px", borderRadius: "8px", backdropFilter: "blur(8px)",
  },
  loginTopBtn: {
    background: "rgba(0,162,255,0.05)", border: "1px solid rgba(0,162,255,0.2)",
    color: "#00a2ff", padding: "8px 16px", borderRadius: "8px",
    cursor: "pointer", fontSize: "10px", letterSpacing: "2px",
    fontFamily: "'Orbitron', sans-serif", fontWeight: "bold",
    backdropFilter: "blur(8px)", transition: "all 0.3s",
  },
  track: {
    width: "75vw", height: "70px",
    background: "rgba(255,255,255,0.018)",
    border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px",
    position: "relative", overflow: "hidden",
    display: "flex", flexDirection: "column", justifyContent: "space-around", padding: "10px 0",
  },
  trackLine: {
    height: "2px",
    background: "repeating-linear-gradient(90deg,rgba(255,255,255,0.09) 0,rgba(255,255,255,0.09) 24px,transparent 24px,transparent 48px)",
    animation: "dash 0.4s linear infinite",
  },
  carWrap: {
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    animation: "carRace 2.2s ease-in-out forwards",
  },
  loadingBar: {
    width: "75vw", height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden",
  },
  loadingFill: {
    height: "100%", background: "linear-gradient(90deg,#00ffea,#00a2ff)",
    borderRadius: "2px", animation: "loadBar 2.2s ease-out forwards",
  },
  ring: {
    position: "absolute", width: "460px", height: "460px",
    border: "1px solid rgba(0,255,234,0.08)", borderRadius: "50%",
    top: "50%", left: "50%", pointerEvents: "none",
  },
};