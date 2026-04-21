import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GameCanvas from '../components/GameCanvas';
import { useMockWebSocket } from '../services/mockWebsocket';
import { PALETTE } from '../theme/midnightSpark.js';
import '../index.css';

export default function GamePage() {
  const playerId = 'player_1';
  const roomId = localStorage.getItem('roomCode') || 'demo_room';
  const navigate = useNavigate();

  // Use mock WebSocket for testing
  const {
    connected,
    serverState,
    raceStarted,
    countdown,
    send,
    startRace,
    resetRace,
  } = useMockWebSocket({
    playerId,
    roomId,
    latencyMs: 30, // Simulate 30ms network latency
    addAIOpponents: true,
    aiCount: 1, // One AI opponent
    broadcastRateMs: 50, // 20 Hz server broadcast
  });

  // Handle input from GameCanvas
  const handleSendInput = useCallback(
    (inputMessage) => {
      send('/app/car.move', inputMessage);
    },
    [send]
  );

  const handleLeaveRoom = () => {
    localStorage.removeItem('roomCode');
    localStorage.removeItem('isHost');
    navigate('/lobby');
  };

  return (
    <div className="sa-bg">
      {/* Header - matches LobbyPage */}
      <header className="sa-topbar">
        <div className="sa-brand">Speed Arena</div>
        <div className="sa-top-actions">
          <span className="sa-help" style={{
            color: connected ? PALETTE.neonMint : PALETTE.orange,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: connected ? PALETTE.neonMint : PALETTE.orange,
              display: 'inline-block'
            }}></span>
            {connected ? 'Connected' : 'Connecting...'}
          </span>
          <button className="sa-doc-btn" onClick={handleLeaveRoom}>Leave Room</button>
        </div>
      </header>

      {/* Main Game Area */}
      <div style={{
        maxWidth: '1300px',
        margin: '0 auto',
        padding: '20px',
      }}>
        {/* Room Info Card */}
        <div style={{
          background: `linear-gradient(135deg, ${PALETTE.slateBlue} 0%, ${PALETTE.navy} 100%)`,
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        }}>
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: '800',
              color: PALETTE.orange,
              letterSpacing: '2px',
              marginBottom: '4px'
            }}>
              ROOM CODE
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: PALETTE.oxygen,
              letterSpacing: '4px'
            }}>
              {roomId.toUpperCase()}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Race Status */}
            <div style={{
              background: raceStarted ? `${PALETTE.neonMint}22` : countdown > 0 ? `${PALETTE.orange}22` : `${PALETTE.slateBlue}44`,
              border: `1px solid ${raceStarted ? PALETTE.neonMint : countdown > 0 ? PALETTE.orange : PALETTE.slateBlue}`,
              borderRadius: '8px',
              padding: '10px 20px',
              textAlign: 'center',
            }}>
              {raceStarted ? (
                <span style={{ color: PALETTE.neonMint, fontWeight: 'bold', fontSize: '18px' }}>RACING!</span>
              ) : countdown > 0 ? (
                <span style={{ color: PALETTE.orange, fontWeight: 'bold', fontSize: '32px' }}>{countdown}</span>
              ) : (
                <span style={{ color: `${PALETTE.oxygen}55`, fontWeight: '600' }}>Ready to Start</span>
              )}
            </div>

            {/* Control Buttons */}
            <button
              onClick={startRace}
              disabled={raceStarted || countdown > 0 || !connected}
              className="sa-btn"
              style={{
                padding: '12px 32px',
                opacity: raceStarted || countdown > 0 || !connected ? 0.5 : 1,
                cursor: raceStarted || countdown > 0 || !connected ? 'not-allowed' : 'pointer',
              }}
            >
              Start Race
            </button>

            <button
              onClick={resetRace}
              disabled={!connected}
              style={{
                padding: '12px 32px',
                fontSize: '14px',
                fontWeight: '700',
                background: PALETTE.slateBlue,
                color: PALETTE.oxygen,
                border: 'none',
                borderRadius: '8px',
                cursor: connected ? 'pointer' : 'not-allowed',
                opacity: connected ? 1 : 0.5,
                transition: 'all 0.2s',
              }}
            >
              Reset Race
            </button>
          </div>
        </div>

        {/* Game Canvas */}
        <div style={{
          background: `linear-gradient(135deg, ${PALETTE.slateBlue} 0%, ${PALETTE.navy} 100%)`,
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        }}>
          <GameCanvas
            playerId={playerId}
            roomId={roomId}
            serverState={serverState}
            onSendInput={handleSendInput}
            raceStarted={raceStarted}
            countdown={countdown}
            width={1200}
            height={800}
          />
        </div>

        {/* Controls Info Card */}
        <div style={{
          background: `linear-gradient(135deg, ${PALETTE.slateBlue} 0%, ${PALETTE.navy} 100%)`,
          borderRadius: '16px',
          padding: '24px',
          marginTop: '20px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: '800',
            color: PALETTE.orange,
            letterSpacing: '2px',
            marginBottom: '16px'
          }}>
            CONTROLS
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: PALETTE.slateBlue,
                color: PALETTE.oxygen,
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '14px',
                minWidth: '80px',
                textAlign: 'center',
              }}>W / Up</div>
              <span style={{ color: `${PALETTE.oxygen}66` }}>Accelerate</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: PALETTE.slateBlue,
                color: PALETTE.oxygen,
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '14px',
                minWidth: '80px',
                textAlign: 'center',
              }}>S / Down</div>
              <span style={{ color: `${PALETTE.oxygen}66` }}>Brake / Reverse</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: PALETTE.slateBlue,
                color: PALETTE.oxygen,
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '14px',
                minWidth: '80px',
                textAlign: 'center',
              }}>A / Left</div>
              <span style={{ color: `${PALETTE.oxygen}66` }}>Turn Left</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: PALETTE.slateBlue,
                color: PALETTE.oxygen,
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '14px',
                minWidth: '80px',
                textAlign: 'center',
              }}>D / Right</div>
              <span style={{ color: `${PALETTE.oxygen}66` }}>Turn Right</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                background: PALETTE.orange,
                color: PALETTE.navy,
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '14px',
                minWidth: '80px',
                textAlign: 'center',
              }}>SPACE</div>
              <span style={{ color: `${PALETTE.oxygen}66` }}>Handbrake / Drift</span>
            </div>
          </div>

          {/* Game Tips */}
          <div style={{
            marginTop: '20px',
            padding: '16px',
            background: `${PALETTE.slateBlue}33`,
            borderRadius: '8px',
            border: `1px solid ${PALETTE.slateBlue}aa`,
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: '800',
              color: PALETTE.orange,
              letterSpacing: '2px',
              marginBottom: '8px'
            }}>
              TIPS
            </div>
            <ul style={{
              color: `${PALETTE.oxygen}77`,
              fontSize: '14px',
              margin: 0,
              paddingLeft: '20px',
              lineHeight: '1.8',
            }}>
              <li>Use <strong style={{ color: PALETTE.orange }}>SPACE</strong> to drift around corners for faster turns</li>
              <li>Watch your <strong style={{ color: PALETTE.neonMint }}>HEALTH BAR</strong> - hitting walls cause damage!</li>
              <li>When health reaches 0, your car will <strong style={{ color: PALETTE.orange }}>RESPAWN</strong> on the track</li>
              <li>Stay on the <strong style={{ color: PALETTE.oxygen }}>OVAL TRACK</strong> - inner and outer walls both damage your car</li>
            </ul>
          </div>
        </div>

        {/* Players Info */}
        <div style={{
          background: `linear-gradient(135deg, ${PALETTE.slateBlue} 0%, ${PALETTE.navy} 100%)`,
          borderRadius: '16px',
          padding: '24px',
          marginTop: '20px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: '800',
            color: PALETTE.orange,
            letterSpacing: '2px',
            marginBottom: '16px'
          }}>
            PLAYERS IN RACE
          </div>

          <div style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            {Object.entries(serverState).map(([id, state]) => (
              <div key={id} style={{
                background: id === playerId ? `${PALETTE.neonMint}22` : `${PALETTE.orange}18`,
                border: `1px solid ${id === playerId ? PALETTE.neonMint : PALETTE.orange}`,
                borderRadius: '8px',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: id === playerId ? PALETTE.neonMint : PALETTE.orange,
                }}></div>
                <div>
                  <div style={{
                    color: PALETTE.oxygen,
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    {id === playerId ? 'You' : id.replace('_', ' ').toUpperCase()}
                  </div>
                  <div style={{
                    color: `${PALETTE.oxygen}55`,
                    fontSize: '12px'
                  }}>
                    Health: {state.health || 100}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '20px',
          padding: '0 4px',
        }}>
          <span style={{ color: `${PALETTE.oxygen}55`, fontSize: '12px' }}>
            Room: {roomId} | Players: {Object.keys(serverState).length}
          </span>
          <Link
            to="/lobby"
            style={{
              color: PALETTE.orange,
              fontSize: '14px',
              textDecoration: 'none',
              fontWeight: '600',
            }}
          >
            Back to Lobby
          </Link>
        </div>
      </div>
    </div>
  );
}
