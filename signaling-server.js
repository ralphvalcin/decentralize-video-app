import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import http from 'http';
import crypto from 'crypto';
// import bcrypt from 'bcryptjs'; // Currently unused
import { EventEmitter } from 'events';
import cron from 'node-cron';
import { TURNCredentialService } from './src/services/TURNCredentialService.js';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Configuration Management
const config = {
  JWT_SECRET: process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable must be set in production');
    }
    console.warn('WARNING: Using generated JWT secret for development. Set JWT_SECRET env variable for production.');
    return crypto.randomBytes(64).toString('hex');
  })(),
  SIGNALING_ENCRYPTION_KEY: process.env.SIGNALING_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
  PORT: parseInt(process.env.PORT) || 5001,
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Performance Limits
  MAX_CONNECTIONS_PER_ROOM: parseInt(process.env.MAX_CONNECTIONS_PER_ROOM) || 100,
  MAX_MESSAGE_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH) || 1000,
  MESSAGE_HISTORY_LIMIT: parseInt(process.env.MESSAGE_HISTORY_LIMIT) || 100,
  
  // Cleanup Intervals (in milliseconds)
  ROOM_CLEANUP_INTERVAL: parseInt(process.env.ROOM_CLEANUP_INTERVAL) || 300000, // 5 minutes
  CONNECTION_HEALTH_CHECK_INTERVAL: parseInt(process.env.CONNECTION_HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
  INACTIVE_ROOM_TTL: parseInt(process.env.INACTIVE_ROOM_TTL) || 3600000, // 1 hour
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute
  DEFAULT_RATE_LIMIT: parseInt(process.env.DEFAULT_RATE_LIMIT) || 10
};

// Performance Monitoring
class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      connections: {
        total: 0,
        peak: 0,
        connectionRate: [],
        disconnectionRate: [],
        byRoom: new Map()
      },
      messages: {
        totalSent: 0,
        totalReceived: 0,
        errorCount: 0,
        responseTime: []
      },
      rooms: {
        active: 0,
        totalCreated: 0,
        cleanupCount: 0
      },
      system: {
        startTime: Date.now(),
        lastHealthCheck: Date.now()
      }
    };
    
    this.startPerformanceCollection();
  }
  
  startPerformanceCollection() {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
      this.emit('metrics-updated', this.getMetrics());
    }, 30000);
  }
  
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.system.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    };
    this.metrics.system.uptime = process.uptime();
    this.metrics.system.lastHealthCheck = Date.now();
  }
  
  recordConnection() {
    this.metrics.connections.total++;
    this.metrics.connections.peak = Math.max(this.metrics.connections.peak, this.metrics.connections.total);
    this.addToCircularBuffer(this.metrics.connections.connectionRate, Date.now(), 100);
  }
  
  recordDisconnection() {
    this.metrics.connections.total = Math.max(0, this.metrics.connections.total - 1);
    this.addToCircularBuffer(this.metrics.connections.disconnectionRate, Date.now(), 100);
  }
  
  recordMessage(responseTime = 0) {
    this.metrics.messages.totalSent++;
    if (responseTime > 0) {
      this.addToCircularBuffer(this.metrics.messages.responseTime, responseTime, 1000);
    }
  }
  
  recordError() {
    this.metrics.messages.errorCount++;
  }
  
  recordRoomActivity(roomId, action) {
    switch (action) {
      case 'created':
        this.metrics.rooms.totalCreated++;
        this.metrics.rooms.active++;
        break;
      case 'cleaned':
        this.metrics.rooms.cleanupCount++;
        this.metrics.rooms.active = Math.max(0, this.metrics.rooms.active - 1);
        break;
    }
  }
  
  addToCircularBuffer(buffer, value, maxSize) {
    buffer.push(value);
    if (buffer.length > maxSize) {
      buffer.shift();
    }
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      computed: {
        avgConnectionRate: this.calculateRate(this.metrics.connections.connectionRate),
        avgDisconnectionRate: this.calculateRate(this.metrics.connections.disconnectionRate),
        avgResponseTime: this.calculateAverage(this.metrics.messages.responseTime),
        errorRate: this.metrics.messages.totalSent > 0 ? 
          (this.metrics.messages.errorCount / this.metrics.messages.totalSent) * 100 : 0
      }
    };
  }
  
  calculateRate(timestamps, windowMs = 60000) {
    const now = Date.now();
    const recentTimestamps = timestamps.filter(t => now - t < windowMs);
    return (recentTimestamps.length / windowMs) * 1000; // per second
  }
  
  calculateAverage(values) {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }
}

// Connection Pool Manager
class ConnectionPoolManager extends EventEmitter {
  constructor(performanceMonitor) {
    super();
    this.connections = new Map(); // socketId -> connection metadata
    this.roomConnections = new Map(); // roomId -> Set<socketId>
    this.healthMetrics = new Map(); // socketId -> health data
    this.performanceMonitor = performanceMonitor;
    
    this.startHealthMonitoring();
  }
  
  addConnection(socket, userData) {
    const connectionInfo = {
      socket,
      userData,
      joinedAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      errorCount: 0
    };
    
    this.connections.set(socket.id, connectionInfo);
    this.healthMetrics.set(socket.id, {
      lastPing: Date.now(),
      responseTime: 0,
      errorCount: 0,
      isHealthy: true
    });
    
    if (userData.roomId) {
      if (!this.roomConnections.has(userData.roomId)) {
        this.roomConnections.set(userData.roomId, new Set());
      }
      this.roomConnections.get(userData.roomId).add(socket.id);
    }
    
    this.performanceMonitor.recordConnection();
    this.emit('connection-added', socket.id, userData);
  }
  
  removeConnection(socketId) {
    const connection = this.connections.get(socketId);
    if (connection && connection.userData.roomId) {
      const roomConnections = this.roomConnections.get(connection.userData.roomId);
      if (roomConnections) {
        roomConnections.delete(socketId);
        if (roomConnections.size === 0) {
          this.roomConnections.delete(connection.userData.roomId);
        }
      }
    }
    
    this.connections.delete(socketId);
    this.healthMetrics.delete(socketId);
    this.performanceMonitor.recordDisconnection();
    this.emit('connection-removed', socketId);
  }
  
  getConnectionsByRoom(roomId) {
    return this.roomConnections.get(roomId) || new Set();
  }
  
  getRoomCount() {
    return this.roomConnections.size;
  }
  
  getTotalConnections() {
    return this.connections.size;
  }
  
  updateActivity(socketId) {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }
  
  startHealthMonitoring() {
    setInterval(() => {
      this.performHealthCheck();
    }, config.CONNECTION_HEALTH_CHECK_INTERVAL);
  }
  
  performHealthCheck() {
    const now = Date.now();
    const staleConnections = [];
    
    for (const [socketId, health] of this.healthMetrics) {
      if (now - health.lastPing > config.CONNECTION_HEALTH_CHECK_INTERVAL * 2) {
        health.isHealthy = false;
        staleConnections.push(socketId);
      }
    }
    
    // Clean up stale connections
    for (const socketId of staleConnections) {
      const connection = this.connections.get(socketId);
      if (connection) {
        console.warn(`Cleaning up stale connection: ${socketId}`);
        connection.socket.disconnect(true);
        this.removeConnection(socketId);
      }
    }
    
    this.emit('health-check-completed', {
      totalConnections: this.connections.size,
      staleConnectionsRemoved: staleConnections.length
    });
  }
  
  recordPing(socketId, responseTime) {
    const health = this.healthMetrics.get(socketId);
    if (health) {
      health.lastPing = Date.now();
      health.responseTime = responseTime;
      health.isHealthy = true;
    }
  }
}

// Enhanced Room Manager
class RoomManager extends EventEmitter {
  constructor(performanceMonitor) {
    super();
    this.performanceMonitor = performanceMonitor;
    
    // Room data with TTL tracking
    this.roomMessages = new Map();
    this.roomPolls = new Map();
    this.roomQuestions = new Map();
    this.roomReactions = new Map();
    this.roomRaisedHands = new Map();
    this.roomMetadata = new Map(); // lastActivity, createdAt, participantCount
    
    this.startCleanupScheduler();
  }
  
  initializeRoom(roomId) {
    if (!this.roomMessages.has(roomId)) {
      this.roomMessages.set(roomId, []);
      this.roomPolls.set(roomId, []);
      this.roomQuestions.set(roomId, []);
      this.roomReactions.set(roomId, []);
      this.roomRaisedHands.set(roomId, []);
      this.roomMetadata.set(roomId, {
        createdAt: Date.now(),
        lastActivity: Date.now(),
        participantCount: 0
      });
      
      this.performanceMonitor.recordRoomActivity(roomId, 'created');
      this.emit('room-created', roomId);
    }
    
    this.updateRoomActivity(roomId);
  }
  
  updateRoomActivity(roomId) {
    const metadata = this.roomMetadata.get(roomId);
    if (metadata) {
      metadata.lastActivity = Date.now();
    }
  }
  
  addMessage(roomId, message) {
    this.initializeRoom(roomId);
    const messages = this.roomMessages.get(roomId);
    messages.push(message);
    
    // Keep only last N messages
    if (messages.length > config.MESSAGE_HISTORY_LIMIT) {
      messages.splice(0, messages.length - config.MESSAGE_HISTORY_LIMIT);
    }
    
    this.updateRoomActivity(roomId);
  }
  
  getRoomData(roomId) {
    return {
      messages: this.roomMessages.get(roomId) || [],
      polls: this.roomPolls.get(roomId) || [],
      questions: this.roomQuestions.get(roomId) || [],
      reactions: this.roomReactions.get(roomId) || [],
      raisedHands: this.roomRaisedHands.get(roomId) || []
    };
  }
  
  cleanupInactiveRooms() {
    const now = Date.now();
    const roomsToCleanup = [];
    
    for (const [roomId, metadata] of this.roomMetadata) {
      if (now - metadata.lastActivity > config.INACTIVE_ROOM_TTL) {
        roomsToCleanup.push(roomId);
      }
    }
    
    for (const roomId of roomsToCleanup) {
      this.cleanupRoom(roomId);
    }
    
    if (roomsToCleanup.length > 0) {
      console.log(`Cleaned up ${roomsToCleanup.length} inactive rooms`);
      this.emit('rooms-cleaned', roomsToCleanup);
    }
    
    return roomsToCleanup.length;
  }
  
  cleanupRoom(roomId) {
    this.roomMessages.delete(roomId);
    this.roomPolls.delete(roomId);
    this.roomQuestions.delete(roomId);
    this.roomReactions.delete(roomId);
    this.roomRaisedHands.delete(roomId);
    this.roomMetadata.delete(roomId);
    
    this.performanceMonitor.recordRoomActivity(roomId, 'cleaned');
  }
  
  startCleanupScheduler() {
    // Run cleanup every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      const cleanedCount = this.cleanupInactiveRooms();
      console.log(`Room cleanup completed. Cleaned ${cleanedCount} inactive rooms.`);
    });
  }
  
  getRoomStats() {
    return {
      totalRooms: this.roomMetadata.size,
      roomsWithActivity: Array.from(this.roomMetadata.values())
        .filter(meta => Date.now() - meta.lastActivity < 3600000).length // active in last hour
    };
  }
}

const performanceMonitor = new PerformanceMonitor();
const connectionPool = new ConnectionPoolManager(performanceMonitor);
const roomManager = new RoomManager(performanceMonitor);

// Initialize TURN Credential Service
const turnCredentialService = new TURNCredentialService({
  twilio: config.NODE_ENV === 'production' && process.env.TWILIO_ACCOUNT_SID ? {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN
  } : null
});

// Create HTTP server for health checks and metrics
const server = http.createServer((req, res) => {
  // Enable CORS for metrics endpoints
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/health' && req.method === 'GET') {
    const roomStats = roomManager.getRoomStats();
    const metrics = performanceMonitor.getMetrics();
    
    const healthCheck = {
      status: 'OK',
      uptime: process.uptime(),
      timestamp: Date.now(),
      connections: {
        total: connectionPool.getTotalConnections(),
        peak: metrics.connections.peak,
        byRoom: Object.fromEntries(connectionPool.roomConnections)
      },
      rooms: {
        active: roomStats.totalRooms,
        withActivity: roomStats.roomsWithActivity,
        totalCreated: metrics.rooms.totalCreated
      },
      performance: {
        avgResponseTime: metrics.computed.avgResponseTime,
        messagesPerSecond: metrics.computed.avgConnectionRate,
        errorRate: metrics.computed.errorRate
      },
      memory: process.memoryUsage(),
      environment: config.NODE_ENV,
      config: {
        maxConnectionsPerRoom: config.MAX_CONNECTIONS_PER_ROOM,
        messageHistoryLimit: config.MESSAGE_HISTORY_LIMIT,
        inactiveRoomTTL: config.INACTIVE_ROOM_TTL
      }
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthCheck, null, 2));
  } else if (req.url === '/metrics' && req.method === 'GET') {
    const metrics = performanceMonitor.getMetrics();
    const roomStats = roomManager.getRoomStats();
    
    const metricsResponse = {
      timestamp: Date.now(),
      connections: {
        total: connectionPool.getTotalConnections(),
        peak: metrics.connections.peak,
        byRoom: Array.from(connectionPool.roomConnections.entries()).reduce((acc, [roomId, sockets]) => {
          acc[roomId] = sockets.size;
          return acc;
        }, {}),
        connectionRate: metrics.computed.avgConnectionRate,
        disconnectionRate: metrics.computed.avgDisconnectionRate
      },
      messages: {
        totalSent: metrics.messages.totalSent,
        totalReceived: metrics.messages.totalReceived,
        messagesPerSecond: metrics.computed.avgConnectionRate,
        errorCount: metrics.messages.errorCount,
        errorRate: metrics.computed.errorRate,
        avgResponseTime: metrics.computed.avgResponseTime
      },
      rooms: {
        active: roomStats.totalRooms,
        totalCreated: metrics.rooms.totalCreated,
        cleanupCount: metrics.rooms.cleanupCount,
        withRecentActivity: roomStats.roomsWithActivity,
        averageParticipants: connectionPool.getTotalConnections() / Math.max(1, roomStats.totalRooms)
      },
      system: {
        uptime: process.uptime(),
        memory: metrics.system.memoryUsage || process.memoryUsage(),
        nodeVersion: process.version,
        startTime: metrics.system.startTime,
        lastHealthCheck: metrics.system.lastHealthCheck
      }
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metricsResponse, null, 2));
  } else if (req.url === '/status' && req.method === 'GET') {
    // Simple status endpoint for load balancers
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', availableEndpoints: ['/health', '/metrics', '/status'] }));
  }
});

const io = new Server(server, {
  cors: { 
    origin: config.NODE_ENV === 'production' ? config.FRONTEND_URL : "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  },
  // Enhanced Socket.io configuration for better performance
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  allowUpgrades: true,
  cookie: false,
  serveClient: false,
  // Connection state recovery for better reliability
  connectionStateRecovery: {
    // the backup duration of the sessions and the packets
    maxDisconnectionDuration: 2 * 60 * 1000,
    // whether to skip middlewares upon successful recovery
    skipMiddlewares: true,
  }
});

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed.');
    
    // Disconnect all socket connections gracefully
    io.close(() => {
      console.log('Socket.IO server closed.');
      process.exit(0);
    });
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    console.log('Forcing shutdown...');
    process.exit(1);
  }, 30000);
}

server.listen(config.PORT, () => {
  console.log(`🚀 Signaling server is running on port ${config.PORT}`);
  console.log(`📊 Health check available at http://localhost:${config.PORT}/health`);
  console.log(`📈 Metrics available at http://localhost:${config.PORT}/metrics`);
  console.log(`🌍 Environment: ${config.NODE_ENV}`);
  
  // Log configuration summary
  console.log('📋 Configuration:');
  console.log(`   - Max connections per room: ${config.MAX_CONNECTIONS_PER_ROOM}`);
  console.log(`   - Message history limit: ${config.MESSAGE_HISTORY_LIMIT}`);
  console.log(`   - Inactive room TTL: ${config.INACTIVE_ROOM_TTL / 1000}s`);
  console.log(`   - Health check interval: ${config.CONNECTION_HEALTH_CHECK_INTERVAL / 1000}s`);
});

// Legacy data structures maintained for backward compatibility
const users = {};
const _roomTokens = {}; // Store valid tokens for each room - will be migrated to Redis in future (currently unused)

// Generate JWT token for room access
function generateRoomToken(roomId, userName) {
  return jwt.sign({ roomId, userName, timestamp: Date.now() }, config.JWT_SECRET, { expiresIn: '24h' });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch {
    performanceMonitor.recordError();
    return null;
  }
}

// Sanitize user input
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return purify.sanitize(input.trim());
}

// Enhanced Rate Limiting System
class RateLimiter {
  constructor() {
    this.limits = new Map();
    this.defaultLimits = {
      'token-request': { limit: 5, window: 60000 },
      'join-room': { limit: 3, window: 60000 },
      'send-message': { limit: 20, window: 60000 },
      'send-reaction': { limit: 30, window: 60000 },
      'create-poll': { limit: 5, window: 300000 }, // 5 per 5 minutes
      'vote-poll': { limit: 20, window: 60000 },
      'submit-question': { limit: 10, window: 300000 },
      'vote-question': { limit: 30, window: 60000 },
      'answer-question': { limit: 10, window: 300000 },
      'turn-credentials': { limit: 10, window: 60000 } // 10 per minute
    };
    
    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }
  
  checkLimit(socketId, action, customLimit = null, customWindow = null) {
    const key = `${socketId}:${action}`;
    const now = Date.now();
    
    // Get limits - use custom if provided, otherwise use defaults
    const actionLimits = this.defaultLimits[action] || { limit: config.DEFAULT_RATE_LIMIT, window: config.RATE_LIMIT_WINDOW };
    const limit = customLimit || actionLimits.limit;
    const window = customWindow || actionLimits.window;
    
    const userActions = this.limits.get(key) || [];
    
    // Remove old actions outside the time window
    const recentActions = userActions.filter(time => now - time < window);
    
    if (recentActions.length >= limit) {
      performanceMonitor.recordError();
      return false;
    }
    
    recentActions.push(now);
    this.limits.set(key, recentActions);
    return true;
  }
  
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, actions] of this.limits.entries()) {
      const [_socketId, action] = key.split(':');
      const actionLimits = this.defaultLimits[action] || { window: config.RATE_LIMIT_WINDOW };
      
      const recentActions = actions.filter(time => now - time < actionLimits.window);
      
      if (recentActions.length === 0) {
        this.limits.delete(key);
        cleanedCount++;
      } else if (recentActions.length < actions.length) {
        this.limits.set(key, recentActions);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Rate limiter cleanup: removed ${cleanedCount} expired entries`);
    }
  }
  
  getRateLimitStats() {
    return {
      totalEntries: this.limits.size,
      actionBreakdown: Array.from(this.limits.keys()).reduce((acc, key) => {
        const action = key.split(':')[1];
        acc[action] = (acc[action] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

const rateLimiter = new RateLimiter();

// SECURITY ENHANCEMENTS - Encryption and Authentication Functions

// Encrypt signaling message with AES-256-GCM
function _encryptSignalingMessage(message, roomKey) {
  try {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(roomKey, 'salt', 32);
    
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('signaling'));
    
    let encrypted = cipher.update(messageStr, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    performanceMonitor.recordError();
    return null;
  }
}

// Decrypt signaling message
function _decryptSignalingMessage(encryptedData, roomKey) {
  try {
    // Check timestamp to prevent replay attacks (5 minute window)
    const now = Date.now();
    if (now - encryptedData.timestamp > 300000) {
      throw new Error('Message timestamp expired');
    }
    
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(roomKey, 'salt', 32);
    const _iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAAD(Buffer.from('signaling'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    console.error('Decryption failed:', error);
    performanceMonitor.recordError();
    throw new Error('Failed to decrypt message');
  }
}

// Generate secure room access key
function _generateRoomKey(roomId, userSecret) {
  const combined = roomId + userSecret + config.SIGNALING_ENCRYPTION_KEY;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

// Enhanced input validation
function validateAndSanitizeInput(input, type = 'general', maxLength = 1000) {
  if (typeof input !== 'string') {
    return { isValid: false, sanitized: '', error: 'Input must be a string' };
  }
  
  const sanitized = purify.sanitize(input.trim());
  
  if (sanitized.length === 0) {
    return { isValid: false, sanitized: '', error: 'Input cannot be empty' };
  }
  
  if (sanitized.length > maxLength) {
    return { isValid: false, sanitized: '', error: `Input exceeds maximum length of ${maxLength}` };
  }
  
  // Type-specific validation
  switch (type) {
    case 'roomId': {
      const roomIdRegex = /^[a-zA-Z0-9-_]{6,50}$/;
      if (!roomIdRegex.test(sanitized)) {
        return { isValid: false, sanitized: '', error: 'Room ID must be 6-50 alphanumeric characters' };
      }
      break;
    }
      
    case 'userName': {
      const userNameRegex = /^[a-zA-Z0-9\s-_]{2,30}$/;
      if (!userNameRegex.test(sanitized)) {
        return { isValid: false, sanitized: '', error: 'Username must be 2-30 characters, letters, numbers, spaces, hyphens' };
      }
      break;
    }
      
    case 'message': {
      // Additional check for potential XSS patterns
      const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi
      ];
      
      for (const pattern of xssPatterns) {
        if (pattern.test(sanitized)) {
          return { isValid: false, sanitized: '', error: 'Message contains potentially malicious content' };
        }
      }
      break;
    }
  }
  
  return { isValid: true, sanitized, error: null };
}

// Security event logger
function logSecurityEvent(event, socketId, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: event,
    socketId: socketId,
    details: details,
    severity: details.severity || 'medium'
  };
  
  console.warn(`[SECURITY] ${event}:`, logEntry);
  
  // In production, send to security monitoring service
  if (config.NODE_ENV === 'production') {
    // Implementation would send to security monitoring endpoint
    // e.g., sendToSecurityMonitoring(logEntry);
  }
}

// Peer authentication token generation
function _generatePeerAuthToken(peerId, roomId, socketId) {
  const payload = {
    peerId: peerId,
    roomId: roomId,
    socketId: socketId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };
  
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', config.SIGNALING_ENCRYPTION_KEY)
                          .update(payloadStr)
                          .digest('hex');
  
  return {
    payload: payloadStr,
    signature: signature
  };
}

// Verify peer authentication token
function _verifyPeerAuthToken(token, expectedPeerId, roomId, socketId) {
  try {
    const payload = JSON.parse(token.payload);
    
    // Verify signature
    const expectedSignature = crypto.createHmac('sha256', config.SIGNALING_ENCRYPTION_KEY)
                                   .update(token.payload)
                                   .digest('hex');
    
    if (expectedSignature !== token.signature) {
      logSecurityEvent('PEER_TOKEN_SIGNATURE_FAILED', socketId, { expectedPeerId, roomId });
      return false;
    }
    
    // Verify payload data
    if (payload.peerId !== expectedPeerId || payload.roomId !== roomId || payload.socketId !== socketId) {
      logSecurityEvent('PEER_TOKEN_PAYLOAD_MISMATCH', socketId, { expectedPeerId, roomId, payload });
      return false;
    }
    
    // Check timestamp (5 minute window)
    const now = Date.now();
    if (now - payload.timestamp > 300000) {
      logSecurityEvent('PEER_TOKEN_EXPIRED', socketId, { expectedPeerId, roomId, age: now - payload.timestamp });
      return false;
    }
    
    return true;
  } catch (error) {
    logSecurityEvent('PEER_TOKEN_VERIFICATION_ERROR', socketId, { expectedPeerId, roomId, error: error.message });
    return false;
  }
}

// Enhanced room access validation
function _validateRoomAccess(socketId, roomId, token, userData) {
  // Verify JWT token
  const decoded = verifyToken(token);
  if (!decoded || decoded.roomId !== roomId) {
    logSecurityEvent('INVALID_ROOM_TOKEN', socketId, { roomId, tokenValid: !!decoded });
    return { isValid: false, error: 'Invalid or expired token', code: 'AUTH_FAILED' };
  }
  
  // Validate user data
  const nameValidation = validateAndSanitizeInput(userData.name, 'userName');
  if (!nameValidation.isValid) {
    logSecurityEvent('INVALID_USERNAME', socketId, { roomId, error: nameValidation.error });
    return { isValid: false, error: nameValidation.error, code: 'INVALID_USERNAME' };
  }
  
  const roleValidation = validateAndSanitizeInput(userData.role, 'general', 50);
  if (!roleValidation.isValid) {
    logSecurityEvent('INVALID_USER_ROLE', socketId, { roomId, error: roleValidation.error });
    return { isValid: false, error: roleValidation.error, code: 'INVALID_USER_ROLE' };
  }
  
  return {
    isValid: true,
    sanitizedData: {
      name: nameValidation.sanitized,
      role: roleValidation.sanitized,
      roomId: roomId
    }
  };
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
  console.log(`🔌 User connected: ${socket.id}`);
  performanceMonitor.recordConnection();
  
  // Track connection ping for health monitoring
  socket.on('pong', () => {
    connectionPool.recordPing(socket.id, Date.now() - socket.pingStart);
  });
  
  // Send periodic pings for health monitoring
  const pingInterval = setInterval(() => {
    socket.pingStart = Date.now();
    socket.ping();
  }, 30000);
  
  // Generate room token endpoint
  socket.on('request-room-token', (data) => {
    const requestStart = Date.now();
    
    if (!rateLimiter.checkLimit(socket.id, 'token-request')) {
      socket.emit('error', { message: 'Rate limit exceeded for token requests', code: 'RATE_LIMIT_EXCEEDED' });
      performanceMonitor.recordError();
      return;
    }
    
    try {
      const { roomId, userName } = data;
      const sanitizedRoomId = sanitizeInput(roomId);
      const sanitizedUserName = sanitizeInput(userName);
      
      if (!sanitizedRoomId || !sanitizedUserName) {
        socket.emit('error', { 
          message: 'Invalid room ID or username', 
          code: 'INVALID_INPUT',
          details: { roomIdValid: !!sanitizedRoomId, userNameValid: !!sanitizedUserName }
        });
        performanceMonitor.recordError();
        return;
      }
      
      const token = generateRoomToken(sanitizedRoomId, sanitizedUserName);
      socket.emit('room-token', { token, roomId: sanitizedRoomId, userName: sanitizedUserName });
      
      performanceMonitor.recordMessage(Date.now() - requestStart);
    } catch (error) {
      console.error('Error in request-room-token:', error);
      socket.emit('error', { message: 'Server error processing token request', code: 'SERVER_ERROR' });
      performanceMonitor.recordError();
    }
  });

  // Handle TURN credentials request
  socket.on('request-turn-credentials', async () => {
    const requestStart = Date.now();
    
    if (!rateLimiter.checkLimit(socket.id, 'turn-credentials', 10)) {
      socket.emit('turn-credentials-error', { message: 'Rate limit exceeded for TURN credentials', code: 'RATE_LIMIT_EXCEEDED' });
      performanceMonitor.recordError();
      return;
    }

    try {
      const user = users[socket.id];
      const userId = user?.id || socket.id;
      
      logSecurityEvent('TURN_CREDENTIALS_REQUESTED', userId, {
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address
      });

      const turnConfig = await turnCredentialService.getTURNCredentials(userId);
      
      if (turnConfig && turnConfig.servers.length > 0) {
        socket.emit('turn-credentials', turnConfig);
        
        logSecurityEvent('TURN_CREDENTIALS_PROVIDED', userId, {
          serverCount: turnConfig.servers.length,
          hasAuthentication: turnConfig.servers.every(s => s.username && s.credential)
        });
        
        performanceMonitor.recordMessage(Date.now() - requestStart);
      } else {
        socket.emit('turn-credentials-error', { 
          message: 'No TURN servers configured', 
          code: 'NO_TURN_SERVERS' 
        });
        performanceMonitor.recordError();
      }
    } catch (error) {
      console.error('Error providing TURN credentials:', error);
      
      logSecurityEvent('TURN_CREDENTIALS_ERROR', socket.id, {
        error: error.message,
        severity: 'high'
      });
      
      socket.emit('turn-credentials-error', { 
        message: 'Failed to generate TURN credentials', 
        code: 'SERVER_ERROR' 
      });
      performanceMonitor.recordError();
    }
  });
  
  socket.on('join-room', (userInfo) => {
    const requestStart = Date.now();
    
    if (!rateLimiter.checkLimit(socket.id, 'join-room')) {
      socket.emit('error', { message: 'Rate limit exceeded for room joining', code: 'RATE_LIMIT_EXCEEDED' });
      performanceMonitor.recordError();
      return;
    }
    
    try {
      const { roomId, token, ...userData } = userInfo;
      
      // Verify token
      const decoded = verifyToken(token);
      if (!decoded || decoded.roomId !== roomId) {
        socket.emit('error', { message: 'Invalid or expired token', code: 'AUTH_FAILED' });
        performanceMonitor.recordError();
        return;
      }
      
      // Check room capacity
      const roomConnections = connectionPool.getConnectionsByRoom(roomId);
      if (roomConnections.size >= config.MAX_CONNECTIONS_PER_ROOM) {
        socket.emit('error', { 
          message: 'Room is at capacity', 
          code: 'ROOM_FULL',
          details: { maxCapacity: config.MAX_CONNECTIONS_PER_ROOM, current: roomConnections.size }
        });
        performanceMonitor.recordError();
        return;
      }
      
      // Sanitize user data
      const sanitizedUserData = {
        name: sanitizeInput(userData.name),
        role: sanitizeInput(userData.role),
        roomId: sanitizeInput(roomId)
      };
      
      // Add to legacy users structure for backward compatibility
      users[socket.id] = {
        id: socket.id,
        ...sanitizedUserData
      };
      
      // Add to new connection pool
      connectionPool.addConnection(socket, sanitizedUserData);
      
      // Initialize room data
      roomManager.initializeRoom(roomId);
      const roomData = roomManager.getRoomData(roomId);
      
      // Send only users in the same room
      const otherUsers = Object.values(users).filter(user => 
        user.id !== socket.id && user.roomId === roomId
      );
      socket.emit('all-users', otherUsers);
      
      // Send existing data for this room
      socket.emit('chat-history', roomData.messages);
      socket.emit('polls-history', roomData.polls);
      socket.emit('questions-history', roomData.questions);
      socket.emit('raised-hands-history', roomData.raisedHands);
      
      // Notify others in the same room
      socket.broadcast.to(roomId).emit('user-joined', {
        signal: null,
        callerID: socket.id,
        name: sanitizedUserData.name,
        role: sanitizedUserData.role
      });
      
      socket.join(roomId);
      
      console.log(`👤 User ${sanitizedUserData.name} joined room ${roomId} (${roomConnections.size + 1} participants)`);
      performanceMonitor.recordMessage(Date.now() - requestStart);
      
    } catch (error) {
      console.error('Error in join-room:', error);
      socket.emit('error', { message: 'Server error joining room', code: 'SERVER_ERROR' });
      performanceMonitor.recordError();
    }
  });

  socket.on('sending-signal', (payload) => {
    try {
      connectionPool.updateActivity(socket.id);
      const caller = users[payload.callerID];
      
      io.to(payload.userToSignal).emit('user-joined', {
        signal: payload.signal,
        callerID: payload.callerID,
        name: caller?.name,
        role: caller?.role
      });
      
      performanceMonitor.recordMessage();
    } catch (error) {
      console.error('Error in sending-signal:', error);
      performanceMonitor.recordError();
    }
  });

  socket.on('returning-signal', (payload) => {
    try {
      connectionPool.updateActivity(socket.id);
      
      io.to(payload.callerID).emit('receiving-returned-signal', {
        signal: payload.signal,
        id: socket.id,
      });
      
      performanceMonitor.recordMessage();
    } catch (error) {
      console.error('Error in returning-signal:', error);
      performanceMonitor.recordError();
    }
  });

  // Handle chat messages
  socket.on('send-message', (messageData) => {
    const requestStart = Date.now();
    
    if (!rateLimiter.checkLimit(socket.id, 'send-message')) {
      socket.emit('error', { message: 'Rate limit exceeded for messages', code: 'RATE_LIMIT_EXCEEDED' });
      performanceMonitor.recordError();
      return;
    }
    
    try {
      const user = users[socket.id];
      if (user && user.roomId) {
        connectionPool.updateActivity(socket.id);
        
        const sanitizedText = sanitizeInput(messageData.text);
        if (!sanitizedText || sanitizedText.length > config.MAX_MESSAGE_LENGTH) {
          socket.emit('error', { 
            message: 'Invalid message content', 
            code: 'INVALID_MESSAGE',
            details: { maxLength: config.MAX_MESSAGE_LENGTH, received: messageData.text?.length || 0 }
          });
          performanceMonitor.recordError();
          return;
        }
        
        const message = {
          id: Date.now() + Math.random(),
          text: sanitizedText,
          userId: socket.id,
          userName: user.name,
          timestamp: Date.now()
        };
        
        // Store message using the new room manager
        roomManager.addMessage(user.roomId, message);
        
        // Broadcast message to all users in the room
        io.to(user.roomId).emit('new-message', message);
        
        performanceMonitor.recordMessage(Date.now() - requestStart);
      } else {
        socket.emit('error', { message: 'User not in a room', code: 'NOT_IN_ROOM' });
        performanceMonitor.recordError();
      }
    } catch (error) {
      console.error('Error in send-message:', error);
      socket.emit('error', { message: 'Server error sending message', code: 'SERVER_ERROR' });
      performanceMonitor.recordError();
    }
  });

  // Handle emoji reactions
  socket.on('send-reaction', (reactionData) => {
    if (!rateLimiter.checkLimit(socket.id, 'send-reaction')) {
      socket.emit('error', { message: 'Rate limit exceeded for reactions', code: 'RATE_LIMIT_EXCEEDED' });
      performanceMonitor.recordError();
      return;
    }
    
    try {
      const user = users[socket.id];
      if (user && user.roomId) {
        connectionPool.updateActivity(socket.id);
        
        const reaction = {
          id: Date.now() + Math.random(),
          emoji: sanitizeInput(reactionData.emoji),
          userId: socket.id,
          userName: user.name,
          timestamp: Date.now()
        };
        
        // Store reaction temporarily in room manager (clear after 10 seconds)
        const roomReactions = roomManager.roomReactions.get(user.roomId) || [];
        roomReactions.push(reaction);
        roomManager.roomReactions.set(user.roomId, roomReactions);
        
        setTimeout(() => {
          const reactions = roomManager.roomReactions.get(user.roomId) || [];
          const filteredReactions = reactions.filter(r => r.id !== reaction.id);
          roomManager.roomReactions.set(user.roomId, filteredReactions);
        }, 10000);
        
        // Broadcast reaction to all users in the room
        io.to(user.roomId).emit('new-reaction', reaction);
        
        performanceMonitor.recordMessage();
      } else {
        socket.emit('error', { message: 'User not in a room', code: 'NOT_IN_ROOM' });
        performanceMonitor.recordError();
      }
    } catch (error) {
      console.error('Error in send-reaction:', error);
      performanceMonitor.recordError();
    }
  });

  // Handle polls
  socket.on('create-poll', (pollData) => {
    if (!rateLimiter.checkLimit(socket.id, 'create-poll', 5)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }
    
    const user = users[socket.id];
    if (user && user.roomId) {
      const poll = {
        ...pollData,
        id: Date.now() + Math.random(),
        roomId: user.roomId,
        createdBy: user.name,
        createdAt: Date.now(),
        votes: {},
        isActive: true
      };
      
      // roomPolls[user.roomId].push(poll); // TODO: Fix room data management
      io.to(user.roomId).emit('new-poll', poll);
    }
  });

  socket.on('vote-poll', () => {
    if (!rateLimiter.checkLimit(socket.id, 'vote-poll', 20)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }
    
    const user = users[socket.id];
    if (user && user.roomId) {
      // const poll = roomPolls[user.roomId].find(p => p.id === voteData.pollId); // TODO: Fix room data management
      // if (poll && poll.isActive) {
      //   poll.votes[socket.id] = voteData.optionIndex;
      //   io.to(user.roomId).emit('poll-updated', poll);
      // } // TODO: Fix room data management
    }
  });

  // Handle Q&A
  socket.on('submit-question', (questionData) => {
    if (!rateLimiter.checkLimit(socket.id, 'submit-question', 10)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }
    
    const user = users[socket.id];
    if (user && user.roomId) {
      const question = {
        ...questionData,
        id: Date.now() + Math.random(),
        roomId: user.roomId,
        author: user.name,
        authorId: socket.id,
        timestamp: Date.now(),
        votes: 0,
        votedBy: [],
        answer: null,
        answeredBy: null,
        answeredAt: null,
        isAnswered: false
      };
      
      // roomQuestions[user.roomId].push(question); // TODO: Fix room data management
      io.to(user.roomId).emit('new-question', question);
    }
  });

  socket.on('vote-question', () => {
    if (!rateLimiter.checkLimit(socket.id, 'vote-question', 30)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }
    
    const user = users[socket.id];
    if (user && user.roomId) {
      // const question = roomQuestions[user.roomId].find(q => q.id === voteData.questionId); // TODO: Fix room data management
      // if (question && !question.votedBy.includes(socket.id)) {
      //   question.votes += 1;
      //   question.votedBy.push(socket.id);
      //   io.to(user.roomId).emit('question-updated', question);
      // } // TODO: Fix room data management
    }
  });

  socket.on('answer-question', () => {
    if (!rateLimiter.checkLimit(socket.id, 'answer-question', 10)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }
    
    const user = users[socket.id];
    if (user && user.roomId) {
      // const question = roomQuestions[user.roomId].find(q => q.id === answerData.questionId); // TODO: Fix room data management
      // if (question) {
      //   question.answer = sanitizeInput(answerData.answer);
      //   question.answeredBy = user.name;
      //   question.answeredAt = Date.now();
      //   question.isAnswered = true;
      //   io.to(user.roomId).emit('question-updated', question);
      // } // TODO: Fix room data management
    }
  });

  // Handle raise hand
  socket.on('raise-hand', () => {
    const user = users[socket.id];
    if (user && user.roomId) {
      // const existingHandIndex = roomRaisedHands[user.roomId].findIndex(h => h.userId === socket.id); // TODO: Fix room data management
      
      // if (existingHandIndex === -1) { // TODO: Fix room data management
        // Add raised hand
        // const hand = {
        //   userId: socket.id,
        //   userName: user.name,
        //   timestamp: Date.now()
        // };
        // roomRaisedHands[user.roomId].push(hand); // TODO: Fix room data management
        // io.to(user.roomId).emit('hand-raised', hand);
      // } // TODO: Fix room data management
    }
  });

  socket.on('lower-hand', () => {
    const user = users[socket.id];
    if (user && user.roomId) {
      // roomRaisedHands[user.roomId] = roomRaisedHands[user.roomId].filter(h => h.userId !== handData.userId); // TODO: Fix room data management
      // io.to(user.roomId).emit('hand-lowered', { userId: handData.userId }); // TODO: Fix room data management
    }
  });

  socket.on('user-leaving', () => {
    const user = users[socket.id];
    if (user && user.roomId) {
      // Notify other users in the room
      socket.broadcast.to(user.roomId).emit('user-left', socket.id);
    }
  });

  // Enhanced disconnect handling
  socket.on('disconnect', (reason) => {
    console.log(`🔌 User disconnected: ${socket.id}, reason: ${reason}`);
    
    // Clear ping interval
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    
    try {
      const user = users[socket.id];
      if (user && user.roomId) {
        // Notify other users in the room
        socket.broadcast.to(user.roomId).emit('user-left', socket.id);
        console.log(`👤 User ${user.name} left room ${user.roomId}`);
      }
      
      // Remove from connection pool and legacy users
      connectionPool.removeConnection(socket.id);
      delete users[socket.id];
      
      performanceMonitor.recordDisconnection();
      
    } catch (error) {
      console.error('Error during disconnect cleanup:', error);
    }
  });
});