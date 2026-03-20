import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LobbyPage from "./pages/LobbyPage";
import LoadingPage from "./pages/LoadingPage";
import SHA_TestPanel from "./pages/SHA_TestPanel";
import LB_LeaderboardPage from "./pages/LB_LeaderboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/ws-test" element={<SHA_TestPanel />} />
        <Route path="/leaderboard" element={<LB_LeaderboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}