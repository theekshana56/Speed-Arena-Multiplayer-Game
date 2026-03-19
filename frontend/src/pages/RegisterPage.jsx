import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/authService";

export default function RegisterPage() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!username || !email || !password) {
      setMsg("Please fill all fields");
      return;
    }
    if (password !== confirm) {
      setMsg("Passwords do not match");
      return;
    }

    try {
      await registerUser(username, email, password);
      setMsg("Registered ✅ Redirecting to login...");
      setTimeout(() => nav("/login"), 700);
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
            Create your driver profile. Join rooms, race with friends, and compete in real-time.
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
            <Link className="sa-tab" to="/login">
              Login
            </Link>
            <button className="sa-tab sa-tab-active">Register</button>
          </div>

          <h2 className="sa-form-title">CREATE ACCOUNT</h2>
          <p className="sa-form-sub">Register to enter the arena.</p>

          <form onSubmit={submit}>
            <label className="sa-label">USERNAME</label>
            <input
              className="sa-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="TurboRacer99"
            />

            <label className="sa-label">EMAIL</label>
            <input
              className="sa-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="driver@speedarena.io"
              type="email"
            />

            <label className="sa-label">PASSWORD</label>
            <input
              className="sa-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            <label className="sa-label">CONFIRM PASSWORD</label>
            <input
              className="sa-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
            />

            <button className="sa-btn" type="submit">
              Register
            </button>

            {msg && <div className="sa-msg">{msg}</div>}
          </form>

          <div className="sa-bottom">
            <span className="sa-mini">Already have an account?</span>
            <Link className="sa-link" to="/login">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}