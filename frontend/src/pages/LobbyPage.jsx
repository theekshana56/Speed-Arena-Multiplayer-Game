import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../index.css";

export default function LobbyPage() {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const getToken = () => localStorage.getItem("token");

  const handleCreateRoom = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("http://localhost:8086/api/rooms/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create room");
      }

      // Store room info and navigate to game
      localStorage.setItem("roomCode", data.roomCode);
      localStorage.setItem("isHost", "true");
      navigate(`/game?room=${data.roomCode}`);
    } catch (err) {
      setError(err.message);
      console.error("Create room error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (roomCode.length < 4) {
      setError("Room code must be at least 4 characters");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("http://localhost:8086/api/rooms/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ roomCode: roomCode.toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join room");
      }

      // Store room info and navigate to game
      localStorage.setItem("roomCode", data.roomCode);
      localStorage.setItem("isHost", "false");
      navigate(`/game?room=${data.roomCode}`);
    } catch (err) {
      setError(err.message);
      console.error("Join room error:", err);
    } finally {
      setLoading(false);
    }
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

          {error && (
            <div style={{
              background: "#fee2e2",
              color: "#dc2626",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "14px"
            }}>
              {error}
            </div>
          )}

          <button
            className="sa-btn"
            onClick={handleCreateRoom}
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Creating..." : "Create New Room"}
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
              disabled={loading}
            />
            <button
              className="sa-btn"
              type="submit"
              disabled={loading}
              style={{ background: "#0f172a", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Joining..." : "Join Room"}
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