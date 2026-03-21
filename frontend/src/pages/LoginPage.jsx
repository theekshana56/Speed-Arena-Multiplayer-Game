import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoadingPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);
  // phase 0 = car racing across, phase 1 = title reveal, phase 2 = enter button

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2000);
    const t2 = setTimeout(() => setPhase(2), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div style={styles.screen}>
      {/* Grid background */}
      <div style={styles.grid} />

      {/* Glow orbs */}
      <div style={{ ...styles.orb, left: "20%", top: "30%", background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)" }} />
      <div style={{ ...styles.orb, right: "15%", bottom: "25%", background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)" }} />

      {/* Phase 0 — car animation */}
      {phase === 0 && (
        <div style={styles.carPhase}>
          <div style={styles.trackLabel}>INITIALIZING TRACK...</div>
          <div style={styles.track}>
            <div style={styles.trackLine} />
            <div style={styles.trackLine} />
            <div style={styles.trackLine} />
            <div style={styles.carWrap}>
              <div style={styles.car}>
                <div style={styles.carTop} />
                <div style={{ ...styles.wheel, left: "10px" }} />
                <div style={{ ...styles.wheel, right: "10px" }} />
                <div style={styles.headlight} />
                <div style={styles.exhaust} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 1 & 2 — title */}
      {phase >= 1 && (
        <div style={styles.titlePhase}>
          <div style={{ ...styles.ring, animation: "spin 8s linear infinite" }} />
          <div style={styles.titleWrap}>
            {"SPEED ARENA".split("").map((c, i) => (
              <span key={i} style={{
                ...styles.letter,
                animationDelay: `${i * 0.08}s`,
                color: c === " " ? "transparent" : i < 5 ? "#ef4444" : "#facc15",
              }}>{c === " " ? "\u00A0" : c}</span>
            ))}
          </div>
          <p style={styles.sub}>MULTIPLAYER RACING · REAL-TIME · 2D</p>

          {phase === 2 && (
            <button onClick={() => navigate("/home")} style={styles.enterBtn}>
              <span style={styles.enterText}>ENTER ARENA</span>
              <span style={styles.enterArrow}>▶</span>
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes carRace {
          0% { transform: translateX(-120px); }
          100% { transform: translateX(calc(100vw + 120px)); }
        }
        @keyframes letterDrop {
          0% { opacity: 0; transform: translateY(-40px) scale(1.4); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @keyframes btnGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(239,68,68,0.4), 0 0 40px rgba(239,68,68,0.1); }
          50% { box-shadow: 0 0 30px rgba(239,68,68,0.7), 0 0 60px rgba(239,68,68,0.2); }
        }
        @keyframes dash {
          0% { transform: translateX(0); }
          100% { transform: translateX(-60px); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  screen: {
    background: "#050510",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    fontFamily: "'Courier New', monospace",
  },
  grid: {
    position: "absolute", inset: 0,
    backgroundImage: "linear-gradient(rgba(239,68,68,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.05) 1px, transparent 1px)",
    backgroundSize: "60px 60px",
    pointerEvents: "none",
  },
  orb: {
    position: "absolute",
    width: "600px", height: "600px",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  carPhase: {
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: "20px",
  },
  trackLabel: {
    color: "#ef4444", fontSize: "13px",
    letterSpacing: "4px", opacity: 0.7,
  },
  track: {
    width: "80vw", height: "80px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    position: "relative", overflow: "hidden",
    display: "flex", flexDirection: "column",
    justifyContent: "space-around", padding: "10px 0",
  },
  trackLine: {
    height: "3px",
    background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 30px, transparent 30px, transparent 60px)",
    animation: "dash 0.4s linear infinite",
  },
  carWrap: {
    position: "absolute", top: "50%",
    transform: "translateY(-50%)",
    animation: "carRace 2s ease-in-out forwards",
  },
  car: {
    width: "80px", height: "36px",
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    borderRadius: "8px 14px 6px 8px",
    position: "relative",
    boxShadow: "0 0 20px rgba(59,130,246,0.6)",
  },
  carTop: {
    position: "absolute", top: "-14px", left: "18px",
    width: "38px", height: "18px",
    background: "linear-gradient(135deg, #60a5fa, #3b82f6)",
    borderRadius: "6px 10px 0 0",
  },
  wheel: {
    position: "absolute", bottom: "-8px",
    width: "18px", height: "18px",
    background: "#111", borderRadius: "50%",
    border: "3px solid #374151",
  },
  headlight: {
    position: "absolute", right: "-4px", top: "10px",
    width: "8px", height: "8px",
    background: "#facc15", borderRadius: "50%",
    boxShadow: "0 0 10px #facc15",
  },
  exhaust: {
    position: "absolute", left: "-10px", top: "14px",
    width: "10px", height: "4px",
    background: "rgba(200,200,255,0.3)",
    borderRadius: "2px",
  },
  titlePhase: {
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: "20px",
    position: "relative",
  },
  ring: {
    position: "absolute",
    width: "300px", height: "300px",
    border: "1px solid rgba(239,68,68,0.15)",
    borderRadius: "50%",
    top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
  },
  titleWrap: {
    display: "flex", gap: "2px",
  },
  letter: {
    fontSize: "clamp(36px, 7vw, 72px)",
    fontWeight: "900",
    letterSpacing: "4px",
    display: "inline-block",
    animation: "letterDrop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
  },
  sub: {
    color: "#4b5563", fontSize: "11px",
    letterSpacing: "4px", margin: 0,
    animation: "pulse 3s ease-in-out infinite",
  },
  enterBtn: {
    marginTop: "16px",
    background: "transparent",
    border: "2px solid #ef4444",
    color: "#ef4444",
    padding: "14px 40px",
    fontSize: "14px",
    letterSpacing: "3px",
    fontFamily: "'Courier New', monospace",
    fontWeight: "bold",
    cursor: "pointer",
    borderRadius: "4px",
    display: "flex", alignItems: "center", gap: "10px",
    animation: "btnGlow 2s ease-in-out infinite",
    transition: "background 0.2s, color 0.2s",
  },
  enterText: { letterSpacing: "3px" },
  enterArrow: { fontSize: "16px" },
};