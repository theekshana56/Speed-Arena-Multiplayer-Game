import { useState, useEffect, useRef } from "react";
import "./ChatBox.css";

export default function ChatBox({ 
  messages = [], 
  onSendMessage, 
  playerId, 
  playerName, 
  connected 
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!input.trim() || !connected) {
      console.log("[CHATBOX_SEND] Blocked:", { 
        hasInput: !!input.trim(), 
        connected,
        inputLength: input.length 
      });
      return;
    }

    console.log("[CHATBOX_SEND] Calling onSendMessage with:", input);
    onSendMessage(input.trim());
    setInput("");
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Group messages by day
  const groupedMessages = messages.reduce((acc, msg) => {
    const dateStr = formatDate(msg.timestamp);
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(msg);
    return acc;
  }, {});

  return (
    <div className="chat-box">
      <div className="chat-header">
        <span className="chat-title">💬 LOBBY CHAT</span>
        {!connected && <span className="chat-status">CONNECTING...</span>}
        {connected && <span className="chat-status-active">🟢 LIVE</span>}
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">No messages yet. Start chatting!</div>
        ) : (
          Object.entries(groupedMessages).map(([dateStr, dayMessages]) => (
            <div key={dateStr}>
              <div className="chat-date-divider">{dateStr}</div>
              {dayMessages.map((msg, idx) => {
                const isOwn = msg.playerId === playerId;
                return (
                  <div key={idx} className={`chat-message-wrapper ${isOwn ? "own" : "other"}`}>
                    <div className={`chat-message ${isOwn ? "own-message" : "other-message"}`}>
                      {!isOwn && (
                        <div className="message-sender">{msg.playerName || msg.playerId}</div>
                      )}
                      <div className="message-content">
                        <div className="message-text">{msg.message}</div>
                        <div className="message-time">{formatTime(msg.timestamp)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={200}
          disabled={!connected}
        />
        <button type="submit" className="chat-send-btn" disabled={!input.trim() || !connected}>
          📤
        </button>
      </form>
    </div>
  );
}
