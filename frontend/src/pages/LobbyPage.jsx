import { useState } from "react";
import { Link } from "react-router-dom";
import "../index.css";

export default function LobbyPage() {
  const [roomCode, setRoomCode] = useState("");

  const handleCreateRoom = () => {
    // Logic for creating room
    console.log("Creating room...");
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomCode.length < 4) return;
    console.log("Joining room:", roomCode);
  };

  return (
    <div className="sa-bg">
      <header className="sa-topbar">
        <div className="sa-brand">Speed Arena</div>
        <div className="sa-top-actions">
          <span className="sa-help">Lobby Active</span>
          <button className="sa-doc-btn">Account</button>
        </div>
      </header>

      <div className="sa-card">
        <div className="sa-left">
          <div className="sa-tag">Race Control</div>
          <h1 className="sa-title">
            READY TO<br />RACE?
          </h1>
          <p className="sa-sub">
            Create a private track for your friends or join an existing circuit by entering a room code.
          </p>
          <div className="sa-secure">
            <span className="sa-shield">🏎️</span>
            <div>
              <div className="sa-secure-title">LIVE LOBBY</div>
              <div className="sa-secure-sub">MULTIPLAYER ENGINE SYNCHRONIZED</div>
            </div>
          </div>
        </div>

        <div className="sa-right">
          <h2 className="sa-form-title">COMMAND CENTER</h2>
          <p className="sa-form-sub">Select your entry point to the track.</p>

          <button className="sa-btn" onClick={handleCreateRoom}>
            Create New Room
          </button>

          <div style={{ margin: "24px 0", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }}></div>
            <span style={{ fontSize: "10px", fontWeight: "800", color: "#64748b" }}>OR JOIN CODE</span>
            <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }}></div>
          </div>

          <form onSubmit={handleJoinRoom}>
            <label className="sa-label">ROOM CODE</label>
            <input
              className="sa-input"
              placeholder="XJ49"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
            <button className="sa-btn" type="submit" style={{ background: "#0f172a" }}>
              Join Room
            </button>
          </form>

          <div className="sa-bottom">
            <span className="sa-mini">Need help with codes?</span>
            <Link className="sa-link" to="/login">Logout</Link>
          </div>
        </div>
      </div>
    </div>
  );
}