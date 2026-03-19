import { useState } from "react";
import "../index.css";

export default function LobbyPage() {
  const [roomCode, setRoomCode] = useState("");

  const handleCreateRoom = () => {
    console.log("Create room");
    // later call backend: /api/rooms/create
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    console.log("Join room with code:", roomCode);
    // later call backend: /api/rooms/join
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Lobby</h2>

        <button onClick={handleCreateRoom}>Create Room</button>

        <hr style={{ margin: "20px 0", opacity: 0.2 }} />

        <form onSubmit={handleJoinRoom}>
          <input
            type="text"
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            required
          />
          <button type="submit">Join Room</button>
        </form>
      </div>
    </div>
  );
}