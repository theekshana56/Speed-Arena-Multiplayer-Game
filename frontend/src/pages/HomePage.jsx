import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./home.css";
import carImage from "../assets/car.jpeg";

export default function HomePage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="home-container">

      {/* Corner HUD accents */}
      <div className="corner-accent tl" />
      <div className="corner-accent tr" />
      <div className="corner-accent bl" />
      <div className="corner-accent br" />

      {/* Live indicator */}
      <div className="live-indicator">
        <div className="live-dot" />
        LIVE
      </div>

      {/* Hero */}
      <header className="hero-section">
        <h1 className="game-logo">
          Speed&nbsp;<span className="word-arena">Arena</span>
        </h1>
        <div className="logo-underline" />
        <p className="hero-subtitle">Battle for the Asphalt</p>
        <span className="hero-tag">⚡ Season 7 · Live Now</span>
      </header>

      {/* Stats strip */}
      <div className="stats-strip">
        <div className="stat-item">
          <span className="stat-value">2,841</span>
          <span className="stat-label">Online</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">147</span>
          <span className="stat-label">Rooms</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">4</span>
          <span className="stat-label">Max Players</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">3</span>
          <span className="stat-label">Laps</span>
        </div>
      </div>

      {/* Car */}
      <div className="car-preview">
        <img src={carImage} alt="Neon Race Car" className="car-image" />
      </div>

      {/* Speed bar decoration */}
      <div className="speed-bar">
        <span>BOOST</span>
        <div className="speed-bar-track">
          <div className="speed-bar-fill" />
        </div>
        <span>MAX</span>
      </div>

      {/* Nav menu */}
      <nav className="menu-options">
        <Link to="/lobby" className="menu-btn play-btn">
          <span className="btn-icon">🏎️</span>
          <span className="btn-label">Play Now</span>
          <span className="btn-badge">LIVE</span>
          <span className="btn-arrow">▶▶</span>
        </Link>

        <Link to="/leaderboard" className="menu-btn lb-btn">
          <span className="btn-icon">🏆</span>
          <span className="btn-label">Leaderboard</span>
          <span className="btn-arrow">▶</span>
        </Link>

        <button className="menu-btn">
          <span className="btn-icon">🛡️</span>
          <span className="btn-label">My Garage</span>
          <span className="btn-arrow">▶</span>
        </button>

        <button className="menu-btn">
          <span className="btn-icon">⚙️</span>
          <span className="btn-label">Settings</span>
          <span className="btn-arrow">▶</span>
        </button>

        <button onClick={handleLogout} className="menu-btn danger-btn">
          <span className="btn-icon">🚪</span>
          <span className="btn-label">Logout</span>
          <span className="btn-arrow">▶</span>
        </button>
      </nav>

      {/* Quick-action icons */}
      <footer className="secondary-actions">
        <button className="icon-btn" title="Profile">👤</button>
        <button className="icon-btn notif-btn" title="Notifications">
          🔔
          <span className="notif-badge" />
        </button>
        <button className="icon-btn" title="Help">❓</button>
        <button className="icon-btn" title="Store">🛒</button>
      </footer>

      {/* Bottom HUD */}
      <span className="version-tag">v7.2.1 · SPEED ARENA</span>
      <div className="hud-online">
        <div className="hud-online-dot" />
        2,841 RACERS ONLINE
      </div>

    </div>
  );
}