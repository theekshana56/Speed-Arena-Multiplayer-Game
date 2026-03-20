import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/authService";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      await loginUser(username, password); // ✅ token saved in service

      setMsg("Login success ✅");

      setTimeout(() => {
        navigate("/loading");
      }, 1000);
    } catch (err) {
      setMsg(err.message || "Login failed ❌");
    }
  };

  return (
    <div className="sa-bg">
      <header className="sa-topbar">
        <div className="sa-brand">Speed Arena</div>
      </header>

      <div className="sa-card">
        <div className="sa-left">
          <h1 className="sa-title">
            CHASE THE HORIZON<br />CONQUER THE ARENA
          </h1>

          <p className="sa-sub">
            Join real-time 2D multiplayer races. Create rooms, compete with players,
            and prove your speed on the track.
          </p>
        </div>

        <div className="sa-right">
          <div className="sa-tabs">
            <button className="sa-tab sa-tab-active">Login</button>
            <Link className="sa-tab" to="/register">
              Register
            </Link>
          </div>

          <h2 className="sa-form-title">WELCOME BACK</h2>

          <form onSubmit={submit}>
            <label className="sa-label">USERNAME</label>
            <input
              className="sa-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="driver01"
            />

            <label className="sa-label">PASSWORD</label>
            <input
              className="sa-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            <button className="sa-btn" type="submit">
              Authorize Session
            </button>

            {msg && <div className="sa-msg">{msg}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}