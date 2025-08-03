# Security Fixes Implementation Guide

This document provides specific code implementations to address the critical security vulnerabilities identified in the security audit.

## Priority 1: Critical Security Fixes

### 1. Authentication System Implementation

#### A. Install Required Dependencies
```bash
npm install jsonwebtoken bcryptjs cors helmet express-rate-limit dompurify
```

#### B. Updated Signaling Server with Authentication
Create a new `secure-signaling-server.js`:

```javascript
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : ['http://localhost:5173'],
  credentials: true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

const io = new Server(5001, {
  cors: corsOptions
});

// Authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication token required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.userName = decoded.userName;
    next();
  } catch (err) {
    next(new Error('Invalid authentication token'));
  }
});

// Secure data storage with validation
const users = new Map();
const roomMessages = new Map();
const MAX_MESSAGE_LENGTH = 500;
const MAX_MESSAGES_PER_ROOM = 100;

// Input validation functions
function validateRoomId(roomId) {
  return typeof roomId === 'string' && 
         /^[a-zA-Z0-9-_]{3,50}$/.test(roomId);
}

function validateUserName(userName) {
  return typeof userName === 'string' && 
         /^[a-zA-Z0-9\s]{1,30}$/.test(userName) &&
         userName.trim().length > 0;
}

function sanitizeMessage(text) {
  if (typeof text !== 'string') return '';
  return text
    .slice(0, MAX_MESSAGE_LENGTH)
    .replace(/[<>\"'&]/g, (match) => {
      const escapes = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return escapes[match];
    });
}

io.on('connection', (socket) => {
  console.log(`Authenticated user connected: ${socket.userId}`);
  
  socket.on('join-room', (data) => {
    const { roomId, ...userData } = data;
    
    // Validate input
    if (!validateRoomId(roomId)) {
      socket.emit('error', { message: 'Invalid room ID format' });
      return;
    }
    
    if (!validateUserName(userData.name)) {
      socket.emit('error', { message: 'Invalid user name format' });
      return;
    }

    // Check if user is already in a room
    if (users.has(socket.id)) {
      socket.emit('error', { message: 'User already in a room' });
      return;
    }

    const userInfo = {
      id: socket.id,
      userId: socket.userId,
      roomId: roomId,
      name: sanitizeMessage(userData.name),
      role: userData.role || 'Participant',
      joinedAt: Date.now()
    };

    users.set(socket.id, userInfo);
    
    // Initialize room messages if not exists
    if (!roomMessages.has(roomId)) {
      roomMessages.set(roomId, []);
    }
    
    // Get other users in the same room
    const otherUsers = Array.from(users.values()).filter(user => 
      user.id !== socket.id && user.roomId === roomId
    );
    
    socket.emit('all-users', otherUsers);
    socket.emit('chat-history', roomMessages.get(roomId) || []);
    
    // Notify others in the same room
    socket.broadcast.to(roomId).emit('user-joined', {
      signal: null,
      callerID: socket.id,
      name: userInfo.name,
      role: userInfo.role
    });
    
    socket.join(roomId);
    console.log(`User ${userInfo.name} joined room ${roomId}`);
  });

  socket.on('send-message', (messageData) => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) {
      socket.emit('error', { message: 'User not in a room' });
      return;
    }

    const sanitizedText = sanitizeMessage(messageData.text);
    if (!sanitizedText.trim()) {
      socket.emit('error', { message: 'Empty message not allowed' });
      return;
    }

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: sanitizedText,
      userId: socket.id,
      userName: user.name,
      timestamp: Date.now()
    };
    
    // Store message in room history
    const messages = roomMessages.get(user.roomId) || [];
    messages.push(message);
    
    // Keep only last MAX_MESSAGES_PER_ROOM messages
    if (messages.length > MAX_MESSAGES_PER_ROOM) {
      messages.splice(0, messages.length - MAX_MESSAGES_PER_ROOM);
    }
    
    roomMessages.set(user.roomId, messages);
    
    // Broadcast message to all users in the room
    io.to(user.roomId).emit('new-message', message);
  });

  socket.on('sending-signal', (payload) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const targetUser = users.get(payload.userToSignal);
    if (!targetUser || targetUser.roomId !== user.roomId) {
      socket.emit('error', { message: 'Target user not in same room' });
      return;
    }

    io.to(payload.userToSignal).emit('user-joined', {
      signal: payload.signal,
      callerID: payload.callerID,
      name: user.name,
      role: user.role
    });
  });

  socket.on('returning-signal', (payload) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const targetUser = users.get(payload.callerID);
    if (!targetUser || targetUser.roomId !== user.roomId) {
      socket.emit('error', { message: 'Target user not in same room' });
      return;
    }

    io.to(payload.callerID).emit('receiving-returned-signal', {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on('raise-hand', (data) => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    
    user.handRaised = Boolean(data.handRaised);
    
    io.to(user.roomId).emit('hand-raised', {
      userId: socket.id,
      userName: user.name,
      handRaised: user.handRaised
    });
  });

  socket.on('user-leaving', () => {
    handleUserDisconnect(socket);
  });

  socket.on('disconnect', () => {
    handleUserDisconnect(socket);
  });
});

function handleUserDisconnect(socket) {
  const user = users.get(socket.id);
  if (user && user.roomId) {
    socket.broadcast.to(user.roomId).emit('user-left', socket.id);
    console.log(`User ${user.name} left room ${user.roomId}`);
  }
  users.delete(socket.id);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  io.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

console.log('Secure signaling server is running on port 5001');
```

### 2. Client-Side Authentication Implementation

#### A. Create Authentication Service
Create `src/services/auth.js`:

```javascript
import jwt from 'jsonwebtoken';

const API_BASE = process.env.VITE_API_URL || 'http://localhost:3000';

class AuthService {
  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  async login(username, roomId) {
    try {
      // In production, this would call your auth API
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, roomId }),
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const { token } = await response.json();
      this.token = token;
      localStorage.setItem('auth_token', token);
      return token;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Temporary method for demo - generates JWT client-side
  generateDemoToken(username, roomId) {
    const payload = {
      userId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userName: username,
      roomId: roomId,
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };
    
    // In production, this should be done server-side with a secure secret
    const token = jwt.sign(payload, 'your-super-secret-key-change-in-production');
    this.token = token;
    localStorage.setItem('auth_token', token);
    return token;
  }

  getToken() {
    return this.token;
  }

  isAuthenticated() {
    if (!this.token) return false;
    
    try {
      const decoded = jwt.decode(this.token);
      return decoded && decoded.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  getUserInfo() {
    if (!this.token) return null;
    
    try {
      return jwt.decode(this.token);
    } catch {
      return null;
    }
  }
}

export default new AuthService();
```

#### B. Updated Room Component with Security
Update `src/components/Room.jsx` with security enhancements:

```javascript
// Add these imports at the top
import DOMPurify from 'dompurify';
import authService from '../services/auth';

// Replace the socket connection (line 13-17):
const connectToSignalingServer = () => {
  const token = authService.getToken();
  
  if (!token) {
    toast.error('Authentication required');
    navigate('/');
    return null;
  }

  return io(process.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:5001', {
    auth: { token },
    reconnectionDelayMax: 10000,
    reconnection: true,
    reconnectionAttempts: 5,
    transports: ['websocket'] // Prefer websocket over polling
  });
};

// Update the userInfo initialization (line 63-70):
const [userInfo] = useState(() => {
  const authInfo = authService.getUserInfo();
  
  if (!authInfo) {
    toast.error('Authentication required');
    navigate('/');
    return null;
  }

  return {
    id: authInfo.userId,
    name: authInfo.userName,
    role: 'Participant'
  };
});

// Add enhanced WebRTC configuration (replace line 401-407):
const createSecurePeerConfig = () => ({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { 
      urls: process.env.VITE_TURN_SERVER_URL || 'stun:stun.l.google.com:19302',
      username: process.env.VITE_TURN_USERNAME,
      credential: process.env.VITE_TURN_CREDENTIAL
    }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
});

// Add message sanitization function:
const sanitizeMessage = (text) => {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};

// Update handleSendMessage function (line 176-178):
const handleSendMessage = (text) => {
  const sanitizedText = sanitizeMessage(text);
  if (sanitizedText.trim().length === 0) {
    toast.error('Empty message not allowed');
    return;
  }
  socket.emit('send-message', { text: sanitizedText });
};
```

### 3. Environment Configuration Security

#### A. Update `.env.example`:
```env
# Authentication
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Signaling Server
VITE_SIGNALING_SERVER_URL=wss://yourdomain.com
VITE_API_URL=https://api.yourdomain.com

# WebRTC Configuration
VITE_TURN_SERVER_URL=turn:yourdomain.com:3478
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-password

# Security Settings
NODE_ENV=production
SECURE_COOKIES=true
HTTPS_ONLY=true
```

### 4. Content Security Policy Implementation

#### A. Create `public/.htaccess` for Apache:
```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:; media-src 'self' blob:; worker-src 'self' blob:;"
Header always set X-Frame-Options "DENY"
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
```

### 5. Secure Chat Component

#### A. Update `src/components/Chat.jsx`:
```javascript
import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

const Chat = ({ messages, onSendMessage, isOpen, onToggle, userInfo }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Rate limiting for messages
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const MESSAGE_COOLDOWN = 1000; // 1 second between messages

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const now = Date.now();
    if (now - lastMessageTime < MESSAGE_COOLDOWN) {
      return; // Ignore rapid messages
    }

    const trimmedMessage = newMessage.trim();
    if (trimmedMessage && trimmedMessage.length <= 500) {
      onSendMessage(trimmedMessage);
      setNewMessage('');
      setLastMessageTime(now);
    }
  };

  // Sanitize message content for display
  const sanitizeForDisplay = (text) => {
    return DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  };

  // Rest of the component remains the same, but update message display:
  // Replace line 76:
  <div className="text-sm" 
       dangerouslySetInnerHTML={{ 
         __html: sanitizeForDisplay(message.text) 
       }} 
  />
};
```

## Testing the Security Fixes

### 1. Authentication Testing
```bash
# Test without token
curl -X POST http://localhost:5001/socket.io/ 
# Should fail with authentication error

# Test with invalid token
curl -X POST http://localhost:5001/socket.io/ \
  -H "Authorization: Bearer invalid-token"
# Should fail with invalid token error
```

### 2. XSS Prevention Testing
```javascript
// Test in browser console - should be sanitized
onSendMessage('<script>alert("XSS")</script>');
onSendMessage('<img src=x onerror=alert("XSS")>');
```

### 3. Rate Limiting Testing
```javascript
// Send multiple rapid requests - should be rate limited
for (let i = 0; i < 200; i++) {
  onSendMessage(`Test message ${i}`);
}
```

## Deployment Security Checklist

- [ ] All environment variables configured
- [ ] HTTPS/WSS enabled
- [ ] Authentication tokens generated securely
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled
- [ ] Security headers implemented
- [ ] Input validation working
- [ ] XSS protection tested
- [ ] TURN servers configured with authentication
- [ ] Error handling doesn't expose sensitive information
- [ ] Logging configured for security events
- [ ] Dependencies updated to latest secure versions

## Next Steps

1. Implement the Priority 1 fixes above
2. Test thoroughly in development environment
3. Conduct penetration testing
4. Set up security monitoring
5. Plan regular security audits
6. Implement remaining Priority 2 and 3 fixes

Remember: Security is an ongoing process, not a one-time implementation. Regular audits and updates are essential.