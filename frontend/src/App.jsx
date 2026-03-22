import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoadingPage from "./pages/LoadingPage";
import HomePage from "./pages/HomePage";
import GameHomePage from "./pages/Gamehomepage";
import SHA_TestPanel from "./pages/SHA_TestPanel";
import RoomLobbyPage from "./pages/Roomlobbypage";
import RacePage from "./pages/Racepage";
import LB_LeaderboardPage from "./pages/LB_LeaderboardPage";
import GamePage from "./pages/GamePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/loading" replace />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/homepage" element={<HomePage />} />
        <Route path="/leaderboard" element={<LB_LeaderboardPage />} />
        <Route path="/home" element={<GameHomePage />} />
        <Route path="/lobby" element={<RoomLobbyPage />} />
        <Route path="/race" element={<RacePage />} />
        <Route path="/ws-test" element={<SHA_TestPanel />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/loading" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
