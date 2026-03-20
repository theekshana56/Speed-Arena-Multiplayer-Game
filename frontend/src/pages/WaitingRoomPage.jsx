import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../services/apiClient";

export default function WaitingRoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);

  // ✅ FETCH ROOM DATA (MAKE SURE THIS IS INSIDE COMPONENT)
  const fetchRoom = async () => {
    try {
      const res = await apiFetch(`/api/rooms/${roomCode}`);

      setPlayers(res.players || []);

      // ✅ AUTO START GAME WHEN 4 PLAYERS
      if (res.players?.length === 4) {
  navigate(`/game/${roomCode}`);
}

    } catch (err) {
      console.error(err);
    }
  };

  // ✅ AUTO REFRESH EVERY 2 SECONDS
  useEffect(() => {
    fetchRoom();

    const interval = setInterval(fetchRoom, 2000);
    return () => clearInterval(interval);
  }, [roomCode]);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>⏳ Waiting Room</h2>

      <h3>Room Code: {roomCode}</h3>

      <p>{players.length}/4 Players Joined</p>

      <ul>
        {players.map((p, i) => (
          <li key={i}>{p.username}</li>
        ))}
      </ul>

      <p>Waiting for players...</p>
    </div>
  );
}