import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/apiClient';

import { tokenService } from '../services/tokenService';
import './LB_Leaderboard.css';

const LB_LeaderboardPage = () => {
    const navigate = useNavigate();
    const [leaderboard, setLeaderboard] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            setLoading(true);
            const token = tokenService.get();
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const data = await apiFetch('/api/results/leaderboard', { headers });
            setLeaderboard(data);
            setError(null);
        } catch (err) {
            console.error('Leaderboard Fetch Error:', err);
            setError('Error loading leaderboard. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const renderPodium = () => {
        const top3 = leaderboard.slice(0, 3);
        const order = [1, 0, 2]; // 2nd, 1st, 3rd for visual podium
        
        return (
            <div className="podium-section">
                {order.map(i => {
                    const p = top3[i];
                    if (!p) return <div key={i} className={`podium-card podium-${i === 0 ? "2nd" : i === 1 ? "1st" : "3rd"}`} style={{ opacity: 0.2 }}></div>;
                    const rankClass = i === 1 ? "1st" : i === 0 ? "2nd" : "3rd";
                    const rankLabel = i === 1 ? "1ST" : i === 0 ? "2ND" : "3RD";
                    return (
                        <div key={p.id || i} className={`podium-card podium-${rankClass}`}>
                            <div className="podium-rank">{rankLabel}</div>
                            <div className="podium-name">{p.playerName || `Player #${p.playerId}`}</div>
                            <div className="podium-stats">
                                <span className="speed-text">{p.topSpeed?.toFixed(1)} KM/H</span>
                                <span className="time-text">{p.totalTime?.toFixed(2)}S</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="leaderboard-container">
            <header className="leaderboard-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <button onClick={() => navigate('/loading')} className="back-btn">← EXIT ARENA</button>
                   <h1>LEADERBOARD</h1>
                   <div style={{ width: '120px' }}></div>
                </div>
                <div style={{ textAlign:'center', marginTop: '10px', color: 'rgba(224, 251, 252, 0.45)', fontSize: '0.7rem', letterSpacing: '4px' }}>SEASON 1 · LIVE RESULTS</div>
            </header>

            {error && <div className="error-message">{error}</div>}

            {loading ? (
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p style={{ marginTop: '20px', fontFamily: 'Orbitron', fontSize: '0.8rem', letterSpacing: '2px' }}>INITIALIZING DATA...</p>
                </div>
            ) : (
                <>
                    {leaderboard.length > 0 && renderPodium()}
                    
                    {leaderboard.length > 0 ? (
                        <div className="table-wrapper">
                            <table className="leaderboard-table">
                                <thead>
                                    <tr>
                                        <th>RANK</th>
                                        <th>DRIVER</th>
                                        <th>TOP SPEED</th>
                                        <th>TIME</th>
                                        <th>ACHIEVEMENTS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboard.map((result, index) => (
                                        <tr key={result.id || index} className="leaderboard-row">
                                            <td className="rank-text">#{index + 1}</td>
                                            <td className="driver-name">{result.playerName || `Player #${result.playerId}`}</td>
                                            <td className="speed-text">{result.topSpeed ? result.topSpeed.toFixed(1) : '0.0'} KM/H</td>
                                            <td className="time-text">{result.totalTime.toFixed(2)}S</td>
                                            <td className="achievements-cell">
                                                {result.achievements && result.achievements.split(',').map(a => (
                                                    <span key={a} className="mini-badge">{a}</span>
                                                ))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="no-data">
                            <p>NO DATA AVAILABLE YET</p>
                            <span style={{ fontSize: '0.7rem' }}>START RACING TO SEE YOUR NAME HERE</span>
                        </div>
                    )}
                </>
            )}
            
            <style>{`
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 2px solid rgba(0, 255, 234, 0.1);
                    border-top: 2px solid #08f8e4;
                    border-radius: 50%;
                    margin: 0 auto;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default LB_LeaderboardPage;
