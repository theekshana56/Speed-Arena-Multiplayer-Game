import { useState } from "react";
import "./lobby.css";
import { apiFetch } from "../services/apiClient";
import { useNavigate } from "react-router-dom";

export default function LobbyPage() {
  const [roomCode, setRoomCode] = useState("");
  const [createdRoom, setCreatedRoom] = useState("");
  const [msg, setMsg] = useState("");

  const navigate = useNavigate();

  // ✅ CREATE ROOM → ONLY SHOW CODE
  const handleCreateRoom = async () => {
    try {
      setMsg("");

      const res = await apiFetch("/api/rooms/create", {
        method: "POST",
      });

      // ✅ SHOW CODE (NO NAVIGATION)
      setCreatedRoom(res.roomCode);
      setMsg("Room created ✅ Share this code");

    } catch (err) {
      setMsg(err.message || "Failed to create room ❌");
    }
  };

  // ✅ JOIN ROOM → GO TO WAITING ROOM
  const handleJoinRoom = async (e) => {
    e.preventDefault();

    if (roomCode.length < 4) {
      setMsg("Room code must be at least 4 characters ❌");
      return;
    }

    try {
      setMsg("");

      const res = await apiFetch("/api/rooms/join", {
        method: "POST",
        body: JSON.stringify({ roomCode }),
      });

      // ✅ GO TO WAITING ROOM ONLY HERE
      navigate(`/waiting/${res.roomCode}`);

    } catch (err) {
      setMsg(err.message || "Room not found ❌");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>🎮 Game Lobby</h2>

        <button onClick={handleCreateRoom} style={{ marginTop: "15px" }}>
          Create Room
        </button>

        {/* ✅ SHOW CREATED ROOM CODE */}
        {createdRoom && (
          <h3 style={{ marginTop: "15px" }}>
            Room Code: {createdRoom}
          </h3>
        )}

        <hr style={{ margin: "20px 0", opacity: 0.2 }} />

        <form onSubmit={handleJoinRoom}>
          <input
            type="text"
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            required
          />

          <button type="submit" style={{ marginTop: "10px" }}>
            Join Room
          </button>
        </form>

        {msg && (
          <p style={{ marginTop: "10px", color: "red" }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}