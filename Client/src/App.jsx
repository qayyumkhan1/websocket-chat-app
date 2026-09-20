import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const App = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [room, setRoom] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isJoined, setIsJoined] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const isSendingRef = useRef(false); // Add ref to prevent double sending

  // Connect to server
  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket'],
      autoConnect: true
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for incoming messages
    socket.on('receive message', (data) => {
      // Only add message if it's not from current user (to avoid duplicates)
      // or if it's from another user
      if (data.author !== username) {
        setMessages((prev) => [...prev, data]);
      }
    });

    // Listen for typing status
    socket.on('user typing', (data) => {
      if (data.username !== username) {
        setTypingUsers((prev) => {
          if (!prev.includes(data.username)) {
            return [...prev, data.username];
          }
          return prev;
        });

        // Remove typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((user) => user !== data.username));
        }, 3000);
      }
    });

    // Listen for user joined
    socket.on('user joined', (data) => {
      if (data.username !== username) {
        setMessages((prev) => [
          ...prev,
          {
            system: true,
            message: `${data.username} joined the room`,
            time: new Date().toLocaleTimeString()
          }
        ]);
      }
    });

    // Listen for user left
    socket.on('user left', (data) => {
      if (data.username !== username) {
        setMessages((prev) => [
          ...prev,
          {
            system: true,
            message: `${data.username} left the room`,
            time: new Date().toLocaleTimeString()
          }
        ]);
      }
    });

    // Listen for online users count
    socket.on('online users', (count) => {
      setOnlineUsers(count);
    });

    return () => {
      socket.off('receive message');
      socket.off('user typing');
      socket.off('user joined');
      socket.off('user left');
      socket.off('online users');
    };
  }, [socket, username]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when joining room
  useEffect(() => {
    if (isJoined) {
      messageInputRef.current?.focus();
    }
  }, [isJoined]);

  // Join room
  const joinRoom = () => {
    if (username.trim() && room.trim()) {
      socket.emit('join_room', { room, username });
      setIsJoined(true);
      setMessages([]);
      setTypingUsers([]);
    } else {
      alert('Please enter both username and room name');
    }
  };

  // Send message - FIXED to prevent double sending
  const sendMessage = () => {
    // Prevent sending if already sending or message is empty
    if (isSendingRef.current || !message.trim() || !socket) {
      return;
    }

    isSendingRef.current = true;

    const messageData = {
      room: room,
      author: username,
      message: message.trim(),
      time: new Date().toLocaleTimeString(),
      id: Date.now()
    };
    
    // Emit to server
    socket.emit('send-message', messageData);
    
    // Add to local messages
    setMessages((prev) => [...prev, messageData]);
    setMessage('');
    
    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      socket.emit('stop typing', { room, username });
    }

    // Reset sending flag after a short delay
    setTimeout(() => {
      isSendingRef.current = false;
    }, 100);
  };

  // Handle typing
  const handleTyping = (e) => {
    setMessage(e.target.value);

    if (!isTyping && e.target.value.length > 0) {
      setIsTyping(true);
      socket.emit('typing', { room, username });
    }

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        socket.emit('stop typing', { room, username });
      }
    }, 2000);
  };

  // Handle Enter key - FIXED
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Leave room
  const leaveRoom = () => {
    if (socket) {
      socket.emit('leave_room', { room, username });
      setIsJoined(false);
      setRoom('');
      setMessages([]);
      setTypingUsers([]);
      setOnlineUsers(0);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      isSendingRef.current = false;
    }
  };

  // Format message time
  const formatTime = (time) => {
    return time || new Date().toLocaleTimeString();
  };

  // If not joined, show join screen
  if (!isJoined) {
    return (
      <div className="join-container">
        <div className="join-card">
          <div className="join-header">
            <h1>💬 Chat Room</h1>
            <p className="subtitle">Connect with people in real-time</p>
          </div>
          
          <div className="join-form">
            <div className="input-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter your username..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="join-input"
                maxLength={20}
              />
            </div>
            
            <div className="input-group">
              <label>Room Name</label>
              <input
                type="text"
                placeholder="Enter room name..."
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="join-input"
                onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
              />
            </div>

            <button 
              onClick={joinRoom} 
              className="join-btn"
              disabled={!username.trim() || !room.trim()}
            >
              Join Room
            </button>

            <div className="connection-status">
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
              {isConnected ? 'Connected to server' : 'Connecting to server...'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main chat interface
  return (
    <div className="chat-container">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="header-left">
          <h2>💬 {room}</h2>
          <div className="room-info">
            <span className="online-count">
              <span className="online-dot"></span>
              {onlineUsers} online
            </span>
          </div>
        </div>
        <div className="header-right">
          <span className="username-badge">👤 {username}</span>
          <button onClick={leaveRoom} className="leave-btn">
            Leave Room
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💭</div>
            <h3>No messages yet</h3>
            <p>Start the conversation by sending a message!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id || index}
              className={`message-wrapper ${msg.system ? 'system-message' : ''} ${
                !msg.system && msg.author === username ? 'message-own' : 'message-other'
              }`}
            >
              {msg.system ? (
                <div className="system-message-content">
                  <span>{msg.message}</span>
                  <span className="system-time">{formatTime(msg.time)}</span>
                </div>
              ) : (
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-author">{msg.author}</span>
                    <span className="message-time">{formatTime(msg.time)}</span>
                  </div>
                  <p className="message-text">{msg.message}</p>
                </div>
              )}
            </div>
          ))
        )}
        
        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            {typingUsers.map((user, index) => (
              <span key={index}>
                {user}
                {index < typingUsers.length - 1 ? ', ' : ''}
              </span>
            ))}
            {typingUsers.length === 1 ? ' is' : ' are'} typing
            <span className="typing-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}
      <div className="input-container">
        <div className="input-wrapper">
          <textarea
            ref={messageInputRef}
            placeholder="Type a message..."
            value={message}
            onChange={handleTyping}
            onKeyDown={handleKeyPress}
            className="message-input"
            rows="1"
            maxLength={500}
          />
          <button 
            onClick={sendMessage} 
            className="send-btn"
            disabled={!message.trim() || isSendingRef.current}
          >
            Send
          </button>
        </div>
        <div className="input-footer">
          <span className="char-count">{message.length}/500</span>
          <span className="input-hint">Press Enter to send</span>
        </div>
      </div>
    </div>
  );
};

export default App;