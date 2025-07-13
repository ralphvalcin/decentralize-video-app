import { Server } from 'socket.io';

const io = new Server(5001, {
  cors: { 
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const users = {};
const roomMessages = {}; // Store messages for each room

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('join-room', (userInfo) => {
    const { roomId, ...userData } = userInfo;
    users[socket.id] = {
      id: socket.id,
      roomId,
      ...userData
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
    const user = users[socket.id];
    if (user && user.roomId) {
      const message = {
        id: Date.now() + Math.random(),
        text: messageData.text,
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

console.log('Signaling server is running on port 5001');