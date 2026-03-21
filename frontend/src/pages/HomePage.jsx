import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./home.css";
import carImage from "../assets/car.jpeg";

export default function HomePage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="home-container">

      {/* Corner HUD accents */}
      <div className="corner-accent tl" />
      <div className="corner-accent tr" />
      <div className="corner-accent bl" />
      <div className="corner-accent br" />

      {/* Hero */}
      <header className="hero-section">
        <h1 className="game-logo">
          Speed&nbsp;<span className="word-arena">Arena</span>
        </h1>
        <div className="logo-underline" />
        <p className="hero-subtitle">Battle for the Asphalt</p>
        <span className="hero-tag">⚡ Season 7 · Live Now</span>
      </header>

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
          <span className="btn-arrow">▶▶</span>
        </Link>

        <Link to="/leaderboard" className="menu-btn">
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

        <button onClick={handleLogout} className="menu-btn">
          <span className="btn-icon">🚪</span>
          <span className="btn-label">Logout</span>
          <span className="btn-arrow">▶</span>
        </button>
      </nav>

      {/* Quick-action icons */}
      <footer className="secondary-actions">
        <button className="icon-btn" title="Profile">👤</button>
        <button className="icon-btn" title="Notifications">🔔</button>
        <button className="icon-btn" title="Help">❓</button>
        <button className="icon-btn" title="Store">🛒</button>
      </footer>

      {/* Version tag */}
      <span className="version-tag">v7.2.1 · SPEED ARENA</span>

    </div>
  );
}