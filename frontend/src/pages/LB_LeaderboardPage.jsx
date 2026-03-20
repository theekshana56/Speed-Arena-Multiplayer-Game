import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/apiClient';
import { tokenService } from '../services/tokenService';
import './LB_Leaderboard.css';

const LB_LeaderboardPage = () => {
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

    const getRankIcon = (index) => {
        switch (index) {
            case 0: return <span className="rank-gold">🥇</span>;
            case 1: return <span className="rank-silver">🥈</span>;
            case 2: return <span className="rank-bronze">🥉</span>;
            default: return index + 1;
        }
    };

    return (
        <div className="leaderboard-container">
            <header className="leaderboard-header">
                <h1>🏆 Speed Arena Leaderboard</h1>
            </header>

            {error && <div className="error-message">{error}</div>}

            {loading ? (
                <div className="loading-spinner">Loading stats...</div>
            ) : leaderboard.length > 0 ? (
                <table className="leaderboard-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Player ID</th>
                            <th>Time (s)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboard.map((result, index) => (
                            <tr key={result.id || index} className="leaderboard-row">
                                <td className="rank-text">
                                    {getRankIcon(index)}
                                </td>
                                <td>Player #{result.playerId}</td>
                                <td>{result.totalTime.toFixed(2)}s</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="no-data">No data available yet. Start racing!</div>
            )}
        </div>
    );
};

export default LB_LeaderboardPage;
