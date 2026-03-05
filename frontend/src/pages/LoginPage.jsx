import React, { useState } from "react";
import { Link } from "react-router-dom";
import { loginUser } from "../services/authService";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await loginUser(username, password);
      setMsg("Login success ✅");
      // later: redirect to lobby
      // window.location.href = "/lobby";
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div className="sa-bg">
      <header className="sa-topbar">
        <div className="sa-brand">Speed Arena</div>
        <div className="sa-top-actions">
          <span className="sa-help">Help</span>
          <button className="sa-doc-btn">Documentation</button>
        </div>
      </header>

      <div className="sa-card">
        <div className="sa-left">
          <div className="sa-tag">v2.0.4 Stable</div>
          <h1 className="sa-title">
            DRIVE TO<br />DOMINATE
          </h1>
          <p className="sa-sub">
            The world's most intense top-down multiplayer racing engine. Sync your garage, join a circuit,
            and leave your mark.
          </p>

          <div className="sa-secure">
            <span className="sa-shield">🛡</span>
            <div>
              <div className="sa-secure-title">SECURE ENTRY</div>
              <div className="sa-secure-sub">JWT-BASED AUTHENTICATION ACTIVE</div>
            </div>
          </div>
        </div>

        <div className="sa-right">
          <div className="sa-tabs">
            <button className="sa-tab sa-tab-active">Login</button>
            <Link className="sa-tab" to="/register">
              Register
            </Link>
          </div>

          <h2 className="sa-form-title">WELCOME BACK</h2>
          <p className="sa-form-sub">Resume your race and access your garage.</p>

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

          <div className="sa-bottom">
            <span className="sa-mini">DEMO: DIRECT DATABASE ACCESS</span>
            <span className="sa-link">View Records</span>
          </div>
        </div>
      </div>
    </div>
  );
}