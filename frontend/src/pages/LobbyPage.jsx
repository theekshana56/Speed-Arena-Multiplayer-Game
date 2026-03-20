import { useState } from "react";
import "../index.css";

export default function LobbyPage() {
  const [roomCode, setRoomCode] = useState("");

  const handleCreateRoom = () => {
    alert("Creating room...");
    console.log("Create room");
    // later: call backend API
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();

    if (roomCode.length < 4) {
      alert("Room code must be at least 4 characters");
      return;
    }

    console.log("Join room with code:", roomCode);
    // later: call backend API
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>🎮 Game Lobby</h2>
        <p style={{ fontSize: "0.9rem", opacity: 0.7 }}>
          Create or join a room to start racing
        </p>

        <button onClick={handleCreateRoom} style={{ marginTop: "15px" }}>
          Create Room
        </button>

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
      </div>
    </div>
  );
}