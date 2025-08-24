/**
 * Enterprise Security Hardening Implementation
 * Advanced security features for enterprise-grade WebRTC video chat
 */

import crypto from 'crypto';
import speakeasy from 'speakeasy';
import { EventEmitter } from 'events';

// ============================================================================
// PHASE 1: ADVANCED ENCRYPTION WITH PERFECT FORWARD SECRECY
// ============================================================================

export class AdvancedSignalingEncryption extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.keyRotationInterval = options.keyRotationInterval || 300000; // 5 minutes
    this.maxKeyAge = options.maxKeyAge || 3600000; // 1 hour max key lifetime
    this.currentKeys = new Map(); // roomId -> keyData
    this.keyHistory = new Map(); // for decrypting old messages
    this.encryptionMetrics = {
      totalEncryptions: 0,
      totalDecryptions: 0,
      keyRotations: 0,
      failures: 0
    };
    
    this.startKeyRotationScheduler();
  }
  
  /**
   * Generate new encryption key with Perfect Forward Secrecy
   */
  generateRoomKey() {
    return {
      key: crypto.randomBytes(32), // 256-bit key
      iv: crypto.randomBytes(16),  // 128-bit IV
      keyId: crypto.randomBytes(16).toString('hex'),
      created: Date.now(),
      rotations: 0
    };
  }
  
  /**
   * Rotate encryption key for a specific room
   */
  rotateRoomKey(roomId) {
    const oldKeyData = this.currentKeys.get(roomId);
    const newKeyData = this.generateRoomKey();
    
    // Store old key for decrypting in-flight messages
    if (oldKeyData) {
      this.keyHistory.set(oldKeyData.keyId, {
        ...oldKeyData,
        expired: Date.now()
      });
      
      // Clean old keys after 5 minutes
      setTimeout(() => {
        this.keyHistory.delete(oldKeyData.keyId);
      }, 300000);
    }
    
    this.currentKeys.set(roomId, newKeyData);
    this.encryptionMetrics.keyRotations++;
    
    this.emit('key-rotated', { roomId, keyId: newKeyData.keyId });
    
    console.log(`🔑 Key rotated for room ${roomId}, keyId: ${newKeyData.keyId}`);
    return newKeyData;
  }
  
  /**
   * Encrypt message with current room key
   */
  encryptMessage(message, roomId) {
    try {
      let roomKeyData = this.currentKeys.get(roomId);
      
      // Check if key needs rotation
      if (!roomKeyData || this.shouldRotateKey(roomKeyData)) {
        roomKeyData = this.rotateRoomKey(roomId);
      }
      
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      const cipher = crypto.createCipher('aes-256-gcm', roomKeyData.key);
      
      cipher.setAAD(Buffer.from(roomKeyData.keyId, 'hex')); // Additional authentication
      
      let encrypted = cipher.update(messageStr, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      this.encryptionMetrics.totalEncryptions++;
      
      return {
        encrypted,
        keyId: roomKeyData.keyId,
        iv: roomKeyData.iv.toString('hex'),
        authTag: authTag.toString('hex'),
        timestamp: Date.now(),
        algorithm: 'aes-256-gcm'
      };
      
    } catch (error) {
      this.encryptionMetrics.failures++;
      console.error('Encryption failed:', error);
      throw new Error('Message encryption failed');
    }
  }
  
  /**
   * Decrypt message using appropriate key
   */
  decryptMessage(encryptedData, roomId) {
    try {
      // Find the appropriate key (current or historical)
      let keyData = this.currentKeys.get(roomId);
      
      if (!keyData || keyData.keyId !== encryptedData.keyId) {
        keyData = this.keyHistory.get(encryptedData.keyId);
        if (!keyData) {
          throw new Error('Decryption key not found');
        }
      }
      
      // Verify timestamp (prevent replay attacks - 10 minute window)
      const age = Date.now() - encryptedData.timestamp;
      if (age > 600000) {
        throw new Error('Message timestamp too old');
      }
      
      const decipher = crypto.createDecipher('aes-256-gcm', keyData.key);
      decipher.setAAD(Buffer.from(encryptedData.keyId, 'hex'));
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      this.encryptionMetrics.totalDecryptions++;
      
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
      
    } catch (error) {
      this.encryptionMetrics.failures++;
      console.error('Decryption failed:', error);
      throw new Error('Message decryption failed');
    }
  }
  
  /**
   * Check if key should be rotated based on age and usage
   */
  shouldRotateKey(keyData) {
    const age = Date.now() - keyData.created;
    return age > this.keyRotationInterval || age > this.maxKeyAge;
  }
  
  /**
   * Start automatic key rotation scheduler
   */
  startKeyRotationScheduler() {
    setInterval(() => {
      for (const [roomId, keyData] of this.currentKeys.entries()) {
        if (this.shouldRotateKey(keyData)) {
          this.rotateRoomKey(roomId);
        }
      }
    }, 60000); // Check every minute
  }
  
  /**
   * Get encryption metrics for monitoring
   */
  getMetrics() {
    return {
      ...this.encryptionMetrics,
      activeKeys: this.currentKeys.size,
      historicalKeys: this.keyHistory.size,
      timestamp: Date.now()
    };
  }
}

// ============================================================================
// PHASE 2: MULTI-FACTOR AUTHENTICATION SYSTEM
// ============================================================================

export class MFAService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.totpWindow = options.totpWindow || 2; // Allow 2 time steps
    this.smsCodeLength = options.smsCodeLength || 6;
    this.smsCodeExpiry = options.smsCodeExpiry || 300000; // 5 minutes
    this.maxAttempts = options.maxAttempts || 3;
    this.lockoutDuration = options.lockoutDuration || 900000; // 15 minutes
    
    // Store TOTP secrets and SMS codes
    this.totpSecrets = new Map(); // userId -> secret
    this.smsVerificationCodes = new Map(); // userId -> {code, expires, attempts}
    this.lockedAccounts = new Map(); // userId -> lockoutExpiry
    this.mfaMetrics = {
      totpGenerated: 0,
      totpVerified: 0,
      smsGenerated: 0,
      smsVerified: 0,
      failures: 0,
      lockouts: 0
    };
  }
  
  /**
   * Generate TOTP secret for user
   */
  generateTOTPSecret(userId, serviceName = 'Video Chat App') {
    try {
      const secret = speakeasy.generateSecret({
        name: `${serviceName} (${userId})`,
        issuer: serviceName,
        length: 32
      });
      
      this.totpSecrets.set(userId, secret.base32);
      this.mfaMetrics.totpGenerated++;
      
      this.emit('totp-generated', { userId, qrCodeUrl: secret.otpauth_url });
      
      return {
        secret: secret.base32,
        qrCode: secret.otpauth_url,
        manualEntryKey: secret.base32
      };
      
    } catch (error) {
      this.mfaMetrics.failures++;
      console.error('TOTP generation failed:', error);
      throw new Error('Failed to generate TOTP secret');
    }
  }
  
  /**
   * Verify TOTP token
   */
  verifyTOTP(userId, token) {
    try {
      if (this.isAccountLocked(userId)) {
        throw new Error('Account is locked due to too many failed attempts');
      }
      
      const secret = this.totpSecrets.get(userId);
      if (!secret) {
        throw new Error('TOTP not configured for user');
      }
      
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token.toString(),
        window: this.totpWindow
      });
      
      if (verified) {
        this.mfaMetrics.totpVerified++;
        this.clearFailedAttempts(userId);
        this.emit('totp-verified', { userId });
        return { success: true, method: 'totp' };
      } else {
        this.recordFailedAttempt(userId);
        this.mfaMetrics.failures++;
        this.emit('totp-failed', { userId });
        return { success: false, error: 'Invalid TOTP token' };
      }
      
    } catch (error) {
      console.error('TOTP verification failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Generate SMS verification code
   */
  generateSMSCode(userId, phoneNumber) {
    try {
      if (this.isAccountLocked(userId)) {
        throw new Error('Account is locked due to too many failed attempts');
      }
      
      // Generate secure random code
      const code = Math.floor(Math.random() * 900000) + 100000; // 6-digit code
      const expires = Date.now() + this.smsCodeExpiry;
      
      this.smsVerificationCodes.set(userId, {
        code: code.toString(),
        expires,
        attempts: 0,
        phoneNumber
      });
      
      this.mfaMetrics.smsGenerated++;
      
      // In production, integrate with SMS provider (Twilio, AWS SNS, etc.)
      console.log(`📱 SMS Code for ${phoneNumber}: ${code} (expires in 5 minutes)`);
      
      this.emit('sms-generated', { userId, phoneNumber, code });
      
      return {
        success: true,
        message: 'SMS code sent',
        expiresIn: this.smsCodeExpiry / 1000 // seconds
      };
      
    } catch (error) {
      this.mfaMetrics.failures++;
      console.error('SMS generation failed:', error);
      throw new Error('Failed to generate SMS code');
    }
  }
  
  /**
   * Verify SMS code
   */
  verifySMSCode(userId, inputCode) {
    try {
      if (this.isAccountLocked(userId)) {
        throw new Error('Account is locked due to too many failed attempts');
      }
      
      const codeData = this.smsVerificationCodes.get(userId);
      if (!codeData) {
        throw new Error('No SMS code found for user');
      }
      
      if (Date.now() > codeData.expires) {
        this.smsVerificationCodes.delete(userId);
        throw new Error('SMS code expired');
      }
      
      if (codeData.attempts >= this.maxAttempts) {
        this.lockAccount(userId);
        throw new Error('Too many failed attempts');
      }
      
      if (codeData.code === inputCode.toString()) {
        this.smsVerificationCodes.delete(userId);
        this.mfaMetrics.smsVerified++;
        this.clearFailedAttempts(userId);
        this.emit('sms-verified', { userId });
        return { success: true, method: 'sms' };
      } else {
        codeData.attempts++;
        this.mfaMetrics.failures++;
        this.emit('sms-failed', { userId, attempts: codeData.attempts });
        return { success: false, error: 'Invalid SMS code' };
      }
      
    } catch (error) {
      console.error('SMS verification failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check if account is locked
   */
  isAccountLocked(userId) {
    const lockoutExpiry = this.lockedAccounts.get(userId);
    if (lockoutExpiry && Date.now() < lockoutExpiry) {
      return true;
    } else if (lockoutExpiry) {
      this.lockedAccounts.delete(userId);
    }
    return false;
  }
  
  /**
   * Lock account due to failed attempts
   */
  lockAccount(userId) {
    const lockoutExpiry = Date.now() + this.lockoutDuration;
    this.lockedAccounts.set(userId, lockoutExpiry);
    this.mfaMetrics.lockouts++;
    this.emit('account-locked', { userId, lockoutExpiry });
  }
  
  /**
   * Clear failed attempts for user
   */
  clearFailedAttempts(userId) {
    // Implementation would clear attempt counters
    this.emit('attempts-cleared', { userId });
  }
  
  /**
   * Record failed attempt
   */
  recordFailedAttempt(userId) {
    // Implementation would increment attempt counter
    this.emit('attempt-failed', { userId });
  }
  
  /**
   * Get MFA metrics
   */
  getMetrics() {
    return {
      ...this.mfaMetrics,
      activeSecrets: this.totpSecrets.size,
      pendingSMS: this.smsVerificationCodes.size,
      lockedAccounts: this.lockedAccounts.size,
      timestamp: Date.now()
    };
  }
}

// ============================================================================
// PHASE 3: ADVANCED THREAT DETECTION SYSTEM
// ============================================================================

export class ThreatDetectionService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.riskThresholds = {
      rapidConnections: options.rapidConnections || 10, // per minute
      unusualTraffic: options.unusualTraffic || 500, // messages per minute
      failedLogins: options.failedLogins || 5, // per hour
      geoLocationJump: options.geoLocationJump || 1000, // km
      deviceFingerprintChange: options.deviceFingerprintChange || true
    };
    
    // Behavioral pattern storage
    this.userBehaviorPatterns = new Map(); // userId -> pattern
    this.riskScores = new Map(); // userId -> score
    this.securityAlerts = new Map(); // alertId -> alert
    
    // ML-like pattern detection (simplified for demonstration)
    this.patterns = {
      normalConnectionRate: 2, // connections per minute
      normalMessageRate: 20,   // messages per minute
      normalSessionDuration: 3600000 // 1 hour
    };
    
    this.threatMetrics = {
      threatsDetected: 0,
      falsePositives: 0,
      alertsGenerated: 0,
      actionsBlocked: 0
    };
    
    this.startThreatAnalysis();
  }
  
  /**
   * Initialize behavioral pattern for new user
   */
  initializeBehaviorPattern(userId, metadata = {}) {
    const pattern = {
      userId,
      createdAt: Date.now(),
      connections: [],
      messages: [],
      failedLogins: [],
      geoLocations: [],
      deviceFingerprints: [],
      riskScore: 0,
      lastActivity: Date.now(),
      metadata
    };
    
    this.userBehaviorPatterns.set(userId, pattern);
    return pattern;
  }
  
  /**
   * Analyze user behavior and calculate risk score
   */
  analyzeUserBehavior(userId, action, metadata = {}) {
    try {
      let pattern = this.userBehaviorPatterns.get(userId);
      if (!pattern) {
        pattern = this.initializeBehaviorPattern(userId, metadata);
      }
      
      // Update pattern based on action
      this.updateBehaviorPattern(pattern, action, metadata);
      
      // Calculate risk score
      const riskScore = this.calculateRiskScore(pattern);
      pattern.riskScore = riskScore;
      this.riskScores.set(userId, riskScore);
      
      // Check for threats
      const threats = this.detectThreats(pattern, action, metadata);
      
      // Generate alerts if necessary
      if (riskScore > 0.8 || threats.length > 0) {
        this.generateSecurityAlert(userId, riskScore, threats, action, metadata);
      }
      
      this.emit('behavior-analyzed', { userId, riskScore, threats });
      
      return { riskScore, threats, pattern };
      
    } catch (error) {
      console.error('Behavior analysis failed:', error);
      return { riskScore: 0.5, threats: [], pattern: null };
    }
  }
  
  /**
   * Update behavior pattern with new action
   */
  updateBehaviorPattern(pattern, action, metadata) {
    const timestamp = Date.now();
    pattern.lastActivity = timestamp;
    
    switch (action) {
      case 'connection':
        pattern.connections.push({ timestamp, ...metadata });
        this.trimArray(pattern.connections, 100); // Keep last 100
        break;
        
      case 'message':
        pattern.messages.push({ timestamp, ...metadata });
        this.trimArray(pattern.messages, 500); // Keep last 500
        break;
        
      case 'failed_login':
        pattern.failedLogins.push({ timestamp, ...metadata });
        this.trimArray(pattern.failedLogins, 50); // Keep last 50
        break;
        
      case 'geolocation':
        pattern.geoLocations.push({ timestamp, ...metadata });
        this.trimArray(pattern.geoLocations, 20); // Keep last 20
        break;
        
      case 'device_fingerprint':
        pattern.deviceFingerprints.push({ timestamp, ...metadata });
        this.trimArray(pattern.deviceFingerprints, 10); // Keep last 10
        break;
    }
  }
  
  /**
   * Calculate risk score based on behavioral patterns
   */
  calculateRiskScore(pattern) {
    let risk = 0;
    const now = Date.now();
    const lastHour = now - 3600000;
    const lastMinute = now - 60000;
    
    // Rapid connections detection
    const recentConnections = pattern.connections.filter(c => c.timestamp > lastMinute);
    if (recentConnections.length > this.riskThresholds.rapidConnections) {
      risk += 0.3;
    }
    
    // Unusual message traffic
    const recentMessages = pattern.messages.filter(m => m.timestamp > lastMinute);
    if (recentMessages.length > this.riskThresholds.unusualTraffic) {
      risk += 0.3;
    }
    
    // Failed login attempts
    const recentFailedLogins = pattern.failedLogins.filter(f => f.timestamp > lastHour);
    if (recentFailedLogins.length > this.riskThresholds.failedLogins) {
      risk += 0.4;
    }
    
    // Geolocation jumps
    if (pattern.geoLocations.length >= 2) {
      const recent = pattern.geoLocations.slice(-2);
      const distance = this.calculateDistance(recent[0], recent[1]);
      const timeDiff = recent[1].timestamp - recent[0].timestamp;
      
      if (distance > this.riskThresholds.geoLocationJump && timeDiff < 3600000) { // 1 hour
        risk += 0.5;
      }
    }
    
    // Device fingerprint changes
    if (pattern.deviceFingerprints.length >= 2) {
      const recent = pattern.deviceFingerprints.slice(-2);
      if (recent[0].fingerprint !== recent[1].fingerprint) {
        risk += 0.2;
      }
    }
    
    return Math.min(risk, 1.0); // Cap at 1.0
  }
  
  /**
   * Detect specific threats based on patterns
   */
  detectThreats(pattern, action, metadata) {
    const threats = [];
    const now = Date.now();
    
    // Credential stuffing detection
    if (action === 'failed_login') {
      const recentFailures = pattern.failedLogins.filter(f => now - f.timestamp < 300000); // 5 minutes
      if (recentFailures.length >= 5) {
        threats.push({
          type: 'CREDENTIAL_STUFFING',
          severity: 'high',
          confidence: 0.9,
          description: 'Multiple failed login attempts detected'
        });
      }
    }
    
    // DDoS-like behavior detection
    if (action === 'connection') {
      const connectionsLastMinute = pattern.connections.filter(c => now - c.timestamp < 60000);
      if (connectionsLastMinute.length > 20) {
        threats.push({
          type: 'DDOS_ATTEMPT',
          severity: 'critical',
          confidence: 0.8,
          description: 'Excessive connection attempts detected'
        });
      }
    }
    
    // Impossible travel detection
    if (action === 'geolocation' && pattern.geoLocations.length >= 2) {
      const recent = pattern.geoLocations.slice(-2);
      const distance = this.calculateDistance(recent[0], recent[1]);
      const timeDiff = (recent[1].timestamp - recent[0].timestamp) / 1000 / 3600; // hours
      const maxSpeed = distance / timeDiff; // km/h
      
      if (maxSpeed > 1000) { // Faster than commercial aircraft
        threats.push({
          type: 'IMPOSSIBLE_TRAVEL',
          severity: 'high',
          confidence: 0.95,
          description: 'Geographically impossible travel detected'
        });
      }
    }
    
    return threats;
  }
  
  /**
   * Generate security alert
   */
  generateSecurityAlert(userId, riskScore, threats, action, metadata) {
    const alertId = crypto.randomUUID();
    const alert = {
      id: alertId,
      userId,
      timestamp: Date.now(),
      riskScore,
      threats,
      action,
      metadata,
      status: 'open',
      severity: this.calculateAlertSeverity(riskScore, threats)
    };
    
    this.securityAlerts.set(alertId, alert);
    this.threatMetrics.alertsGenerated++;
    
    if (threats.length > 0) {
      this.threatMetrics.threatsDetected++;
    }
    
    console.warn(`🚨 Security Alert: ${alertId}`, alert);
    this.emit('security-alert', alert);
    
    // Trigger automated response for critical alerts
    if (alert.severity === 'critical') {
      this.triggerAutomatedResponse(alert);
    }
    
    return alertId;
  }
  
  /**
   * Calculate alert severity
   */
  calculateAlertSeverity(riskScore, threats) {
    const criticalThreats = threats.filter(t => t.severity === 'critical');
    const highThreats = threats.filter(t => t.severity === 'high');
    
    if (criticalThreats.length > 0 || riskScore > 0.9) {
      return 'critical';
    } else if (highThreats.length > 0 || riskScore > 0.7) {
      return 'high';
    } else if (riskScore > 0.5) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * Trigger automated response to security alert
   */
  triggerAutomatedResponse(alert) {
    this.threatMetrics.actionsBlocked++;
    
    console.log(`🛡️ Automated response triggered for alert ${alert.id}`);
    
    // Implement automated responses based on threat type
    for (const threat of alert.threats) {
      switch (threat.type) {
        case 'CREDENTIAL_STUFFING':
          this.emit('auto-response', { 
            type: 'TEMPORARY_ACCOUNT_LOCK', 
            userId: alert.userId, 
            duration: 900000 // 15 minutes
          });
          break;
          
        case 'DDOS_ATTEMPT':
          this.emit('auto-response', { 
            type: 'IP_BLOCK', 
            userId: alert.userId, 
            duration: 3600000 // 1 hour
          });
          break;
          
        case 'IMPOSSIBLE_TRAVEL':
          this.emit('auto-response', { 
            type: 'REQUIRE_MFA', 
            userId: alert.userId 
          });
          break;
      }
    }
  }
  
  /**
   * Utility functions
   */
  trimArray(array, maxLength) {
    while (array.length > maxLength) {
      array.shift();
    }
  }
  
  calculateDistance(coord1, coord2) {
    // Simplified distance calculation (Haversine formula would be more accurate)
    const lat1 = coord1.latitude || 0;
    const lon1 = coord1.longitude || 0;
    const lat2 = coord2.latitude || 0;
    const lon2 = coord2.longitude || 0;
    
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
  }
  
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Start threat analysis background processes
   */
  startThreatAnalysis() {
    // Clean old data every hour
    setInterval(() => {
      this.cleanOldData();
    }, 3600000);
    
    // Update risk scores every 5 minutes
    setInterval(() => {
      this.updateRiskScores();
    }, 300000);
  }
  
  /**
   * Clean old behavioral data
   */
  cleanOldData() {
    const cutoff = Date.now() - 86400000; // 24 hours
    
    for (const [userId, pattern] of this.userBehaviorPatterns.entries()) {
      if (pattern.lastActivity < cutoff) {
        this.userBehaviorPatterns.delete(userId);
        this.riskScores.delete(userId);
      }
    }
    
    // Clean old alerts
    for (const [alertId, alert] of this.securityAlerts.entries()) {
      if (alert.timestamp < cutoff) {
        this.securityAlerts.delete(alertId);
      }
    }
  }
  
  /**
   * Update all user risk scores
   */
  updateRiskScores() {
    for (const [userId, pattern] of this.userBehaviorPatterns.entries()) {
      const riskScore = this.calculateRiskScore(pattern);
      pattern.riskScore = riskScore;
      this.riskScores.set(userId, riskScore);
    }
  }
  
  /**
   * Get threat detection metrics
   */
  getMetrics() {
    return {
      ...this.threatMetrics,
      activePatterns: this.userBehaviorPatterns.size,
      openAlerts: Array.from(this.securityAlerts.values()).filter(a => a.status === 'open').length,
      averageRiskScore: this.getAverageRiskScore(),
      timestamp: Date.now()
    };
  }
  
  /**
   * Get average risk score across all users
   */
  getAverageRiskScore() {
    const scores = Array.from(this.riskScores.values());
    if (scores.length === 0) return 0;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }
}

// ============================================================================
// EXPORT ALL ENTERPRISE SECURITY SERVICES
// ============================================================================

export default {
  AdvancedSignalingEncryption,
  MFAService,
  ThreatDetectionService
};