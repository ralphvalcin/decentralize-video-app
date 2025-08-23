/**
 * Security Utilities for WebRTC Video Chat Application
 * Implements end-to-end encryption, authentication, and security validation
 */

import CryptoJS from 'crypto-js';

// Generate cryptographically secure random values
export function generateSecureRandom(length = 32) {
  if (window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  } else {
    // Fallback for older browsers
    return CryptoJS.lib.WordArray.random(length).toString(CryptoJS.enc.Hex);
  }
}

// Generate room-specific encryption key
export function generateRoomKey(roomId, userSecret) {
  const combinedSecret = roomId + userSecret + Date.now();
  return CryptoJS.SHA256(combinedSecret).toString(CryptoJS.enc.Hex);
}

// Encrypt signaling message
export function encryptSignalingMessage(message, roomKey) {
  try {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    const encrypted = CryptoJS.AES.encrypt(messageStr, roomKey).toString();
    
    // Add integrity check
    const hmac = CryptoJS.HmacSHA256(encrypted, roomKey).toString();
    
    return {
      encrypted: encrypted,
      hmac: hmac,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt message');
  }
}

// Decrypt signaling message
export function decryptSignalingMessage(encryptedData, roomKey) {
  try {
    // Verify integrity first
    const expectedHmac = CryptoJS.HmacSHA256(encryptedData.encrypted, roomKey).toString();
    if (expectedHmac !== encryptedData.hmac) {
      throw new Error('Message integrity check failed');
    }
    
    // Check timestamp to prevent replay attacks (5 minute window)
    const now = Date.now();
    if (now - encryptedData.timestamp > 300000) {
      throw new Error('Message timestamp expired');
    }
    
    const decrypted = CryptoJS.AES.decrypt(encryptedData.encrypted, roomKey).toString(CryptoJS.enc.Utf8);
    
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt message');
  }
}

// Generate peer authentication token
export function generatePeerToken(peerId, roomId, userSecret) {
  const payload = {
    peerId: peerId,
    roomId: roomId,
    timestamp: Date.now(),
    nonce: generateSecureRandom(16)
  };
  
  const payloadStr = JSON.stringify(payload);
  const signature = CryptoJS.HmacSHA256(payloadStr, userSecret).toString();
  
  return {
    payload: payloadStr,
    signature: signature
  };
}

// Verify peer authentication token
export function verifyPeerToken(token, expectedPeerId, roomId, userSecret) {
  try {
    const payload = JSON.parse(token.payload);
    
    // Verify signature
    const expectedSignature = CryptoJS.HmacSHA256(token.payload, userSecret).toString();
    if (expectedSignature !== token.signature) {
      return false;
    }
    
    // Verify payload data
    if (payload.peerId !== expectedPeerId || payload.roomId !== roomId) {
      return false;
    }
    
    // Check timestamp (5 minute window)
    const now = Date.now();
    if (now - payload.timestamp > 300000) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
}

// Sanitize and validate user input
export function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove potential XSS vectors
  const sanitized = input
    .replace(/[<>\"']/g, '') // Remove HTML/script tags
    .replace(/javascript:/gi, '') // Remove javascript URLs
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
    
  // Length validation
  return sanitized.substring(0, maxLength);
}

// Validate room ID format
export function validateRoomId(roomId) {
  if (!roomId || typeof roomId !== 'string') {
    return false;
  }
  
  // Room ID should be alphanumeric, 6-50 characters
  const roomIdRegex = /^[a-zA-Z0-9-_]{6,50}$/;
  return roomIdRegex.test(roomId);
}

// Validate user name
export function validateUserName(userName) {
  if (!userName || typeof userName !== 'string') {
    return false;
  }
  
  // Username should be 2-30 characters, letters, numbers, spaces, hyphens
  const userNameRegex = /^[a-zA-Z0-9\s-_]{2,30}$/;
  return userNameRegex.test(userName.trim());
}

// Generate secure room ID
export function generateRoomId() {
  const randomPart = generateSecureRandom(8);
  const timestampPart = Date.now().toString(36);
  return `room-${timestampPart}-${randomPart}`;
}

// Rate limiting utility
export class RateLimiter {
  constructor(maxRequests = 10, timeWindow = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = new Map();
  }
  
  isAllowed(identifier) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Remove old requests outside time window
    const recentRequests = userRequests.filter(time => now - time < this.timeWindow);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    return true;
  }
  
  getRemainingRequests(identifier) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    const recentRequests = userRequests.filter(time => now - time < this.timeWindow);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
}

// Security event logger
export class SecurityLogger {
  static logSecurityEvent(event, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: event,
      details: details,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.warn('[SECURITY]', logEntry);
    
    // In production, send to security monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Implementation would send to security monitoring endpoint
      console.log('Security event logged:', logEntry);
    }
  }
}

// CSP violation handler
export function setupCSPViolationReporting() {
  window.addEventListener('securitypolicyviolation', (event) => {
    SecurityLogger.logSecurityEvent('CSP_VIOLATION', {
      violatedDirective: event.violatedDirective,
      blockedURI: event.blockedURI,
      documentURI: event.documentURI,
      effectiveDirective: event.effectiveDirective
    });
  });
}

// Secure WebRTC configuration
export function getSecureWebRTCConfig() {
  return {
    iceServers: [
      // Use TURN servers with authentication in production
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ],
    iceCandidatePoolSize: 10,
    // Enhanced security settings
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  };
}

// Check for security vulnerabilities in WebRTC connection
export function validateWebRTCConnection(peerConnection) {
  const stats = {
    isSecure: true,
    issues: []
  };
  
  // Check connection state
  if (peerConnection.connectionState === 'failed') {
    stats.isSecure = false;
    stats.issues.push('Connection failed - potential security issue');
  }
  
  // Check ICE connection state
  if (peerConnection.iceConnectionState === 'disconnected') {
    stats.isSecure = false;
    stats.issues.push('ICE connection disconnected - potential attack');
  }
  
  return stats;
}

// Content Security Policy headers
export const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};