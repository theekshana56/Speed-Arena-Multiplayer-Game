import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./loading.css";

export default function LoadingPage() {
  const navigate = useNavigate();
  const [showTitle, setShowTitle] = useState(false);

  useEffect(() => {
    const titleTimer = setTimeout(() => {
      setShowTitle(true);
    }, 2200);

    const navTimer = setTimeout(() => {
      navigate("/home");
    }, 5200);

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(navTimer);
    };
  }, [navigate]);

  const title = "SPEED ARENA";

  return (
    <div className="loading-screen">
      <div className="bg-grid"></div>
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      {!showTitle ? (
        <div className="loading-stage">
          <div className="loading-label">INITIALIZING TRACK...</div>

          <div className="race-lane">
            <div className="lane-line lane-line-1"></div>
            <div className="lane-line lane-line-2"></div>
            <div className="lane-line lane-line-3"></div>

            <div className="car-wrapper">
              <div className="car-body">
                <div className="car-top"></div>
                <div className="wheel wheel-front"></div>
                <div className="wheel wheel-back"></div>
                <div className="car-light"></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="title-stage">
          <div className="title-glow-ring"></div>
          <h1 className="game-title">
            {title.split("").map((char, index) => (
              <span
                key={index}
                className="title-letter"
                style={{ animationDelay: `${index * 0.14}s` }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))}
          </h1>
          <p className="sub-title">ENTER THE MULTIPLAYER CIRCUIT</p>
        </div>
      )}
    </div>
  );
}