import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import http from 'http';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    const healthCheck = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: Date.now(),
      connections: Object.keys(users).length,
      rooms: Object.keys(roomMessages).length,
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthCheck, null, 2));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

const io = new Server(server, {
  cors: { 
    origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

server.listen(5001, () => {
  console.log('Signaling server is running on port 5001');
  console.log('Health check available at http://localhost:5001/health');
});

const users = {};
const roomMessages = {}; // Store messages for each room
const roomTokens = {}; // Store valid tokens for each room

// Generate JWT token for room access
function generateRoomToken(roomId, userName) {
  return jwt.sign({ roomId, userName, timestamp: Date.now() }, JWT_SECRET, { expiresIn: '24h' });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Sanitize user input
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return purify.sanitize(input.trim());
}

// Rate limiting
const rateLimits = new Map();
function checkRateLimit(socketId, action, limit = 10, window = 60000) {
  const key = `${socketId}:${action}`;
  const now = Date.now();
  const userActions = rateLimits.get(key) || [];
  
  // Remove old actions outside the time window
  const recentActions = userActions.filter(time => now - time < window);
  
  if (recentActions.length >= limit) {
    return false;
  }
  
  recentActions.push(now);
  rateLimits.set(key, recentActions);
  return true;
}

// Authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      socket.userData = decoded;
      return next();
    }
  }
  // Allow connection but require authentication for room joining
  next();
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Generate room token endpoint
  socket.on('request-room-token', (data) => {
    if (!checkRateLimit(socket.id, 'token-request', 5)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }
    
    const { roomId, userName } = data;
    const sanitizedRoomId = sanitizeInput(roomId);
    const sanitizedUserName = sanitizeInput(userName);
    
    if (!sanitizedRoomId || !sanitizedUserName) {
      socket.emit('error', { message: 'Invalid room ID or username' });
      return;
    }
    
    const token = generateRoomToken(sanitizedRoomId, sanitizedUserName);
    socket.emit('room-token', { token, roomId: sanitizedRoomId, userName: sanitizedUserName });
  });
  
  socket.on('join-room', (userInfo) => {
    if (!checkRateLimit(socket.id, 'join-room', 3)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }
    
    const { roomId, token, ...userData } = userInfo;
    
    // Verify token
    const decoded = verifyToken(token);
    if (!decoded || decoded.roomId !== roomId) {
      socket.emit('error', { message: 'Invalid or expired token' });
      return;
    }
    
    // Sanitize user data
    const sanitizedUserData = {
      name: sanitizeInput(userData.name),
      role: sanitizeInput(userData.role)
    };
    
    users[socket.id] = {
      id: socket.id,
      roomId: sanitizeInput(roomId),
      ...sanitizedUserData
    };
    
    // Initialize room messages if not exists
    if (!roomMessages[roomId]) {
      roomMessages[roomId] = [];
    }
    
    // Send only users in the same room
    const otherUsers = Object.values(users).filter(user => 
      user.id !== socket.id && user.roomId === roomId
    );
    socket.emit('all-users', otherUsers);
    
    // Send existing messages for this room
    socket.emit('chat-history', roomMessages[roomId]);
    
    // Notify others in the same room
    socket.broadcast.to(roomId).emit('user-joined', {
      signal: null,
      callerID: socket.id,
      name: userData.name,
      role: userData.role
    });
    
    socket.join(roomId);
  });

  socket.on('sending-signal', (payload) => {
    io.to(payload.userToSignal).emit('user-joined', {
      signal: payload.signal,
      callerID: payload.callerID,
      name: users[payload.callerID]?.name,
      role: users[payload.callerID]?.role
    });
  });

  socket.on('returning-signal', (payload) => {
    io.to(payload.callerID).emit('receiving-returned-signal', {
      signal: payload.signal,
      id: socket.id,
    });
  });

  // Handle chat messages
  socket.on('send-message', (messageData) => {
    if (!checkRateLimit(socket.id, 'send-message', 20)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }
    
    const user = users[socket.id];
    if (user && user.roomId) {
      const sanitizedText = sanitizeInput(messageData.text);
      if (!sanitizedText || sanitizedText.length > 1000) {
        socket.emit('error', { message: 'Invalid message content' });
        return;
      }
      
      const message = {
        id: Date.now() + Math.random(),
        text: sanitizedText,
        userId: socket.id,
        userName: user.name,
        timestamp: Date.now()
      };
      
      // Store message in room history
      roomMessages[user.roomId].push(message);
      
      // Keep only last 100 messages per room
      if (roomMessages[user.roomId].length > 100) {
        roomMessages[user.roomId] = roomMessages[user.roomId].slice(-100);
      }
      
      // Broadcast message to all users in the room
      io.to(user.roomId).emit('new-message', message);
    }
  });

  // Handle raise hand event
  socket.on('raise-hand', (data) => {
    const user = users[socket.id];
    if (user && user.roomId) {
      // Update user hand state
      user.handRaised = data.handRaised;
      // Broadcast to all users in the room
      io.to(user.roomId).emit('hand-raised', {
        userId: socket.id,
        userName: user.name,
        handRaised: data.handRaised
      });
    }
  });

  socket.on('user-leaving', (data) => {
    const user = users[socket.id];
    if (user && user.roomId) {
      // Notify other users in the room
      socket.broadcast.to(user.roomId).emit('user-left', socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const user = users[socket.id];
    if (user && user.roomId) {
      // Notify other users in the room
      socket.broadcast.to(user.roomId).emit('user-left', socket.id);
    }
    delete users[socket.id];
  });
});