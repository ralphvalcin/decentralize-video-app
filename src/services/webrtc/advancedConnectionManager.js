/**
 * Advanced WebRTC Connection Manager
 * Handles simulcast, SVC, enhanced ICE, and quality adaptation
 */

import Peer from 'simple-peer';
import { getStats } from 'webrtc-stats';

class AdvancedConnectionManager {
  constructor(options = {}) {
    this.options = {
      enableSimulcast: true,
      enableSVC: true,
      maxConnections: 8,
      qualityLevels: ['low', 'medium', 'high'],
      bandwidthLimits: {
        low: 300000,    // 300 kbps
        medium: 1000000, // 1 Mbps
        high: 2500000   // 2.5 Mbps
      },
      ...options
    };

    this.peers = new Map();
    this.connectionStats = new Map();
    this.qualityManager = new QualityManager();
    this.bandwidthMonitor = new BandwidthMonitor();
    this.networkAnalyzer = new NetworkAnalyzer();
    
    // Enhanced ICE configuration
    this.iceConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // TURN servers (configure in production)
        // { 
        //   urls: 'turn:your-turn-server.com:3478',
        //   username: 'user',
        //   credential: 'pass',
        //   credentialType: 'password'
        // }
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      sdpSemantics: 'unified-plan'
    };

    // Performance monitoring
    this.statsInterval = null;
    this.statsCollectionInterval = 1000;
    this.performanceMetrics = {
      totalConnections: 0,
      activeConnections: 0,
      averageRTT: 0,
      totalBandwidth: 0,
      packetLoss: 0,
      jitter: 0
    };

    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('Initializing Advanced Connection Manager...');
      
      await this.qualityManager.initialize();
      await this.bandwidthMonitor.initialize();
      await this.networkAnalyzer.initialize();
      
      this.startStatsCollection();
      
      this.isInitialized = true;
      console.log('Advanced Connection Manager initialized');
      
    } catch (error) {
      console.error('Failed to initialize connection manager:', error);
      throw error;
    }
  }

  async createPeerConnection(peerId, localStream, options = {}) {
    if (this.peers.has(peerId)) {
      console.warn(`Peer ${peerId} already exists`);
      return this.peers.get(peerId);
    }

    try {
      const peerConfig = {
        initiator: options.initiator || false,
        trickle: false,
        stream: localStream,
        config: this.iceConfig,
        ...options
      };

      // Enable simulcast if supported
      if (this.options.enableSimulcast && this.isSimulcastSupported()) {
        peerConfig.offerOptions = {
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        };
      }

      const peer = new Peer(peerConfig);
      
      // Setup peer event handlers
      this.setupPeerHandlers(peer, peerId);
      
      // Setup simulcast if enabled
      if (this.options.enableSimulcast) {
        await this.setupSimulcast(peer, localStream);
      }

      // Initialize connection stats tracking
      this.connectionStats.set(peerId, {
        connectionTime: Date.now(),
        bytesReceived: 0,
        bytesSent: 0,
        packetsLost: 0,
        rtt: 0,
        jitter: 0,
        qualityLevel: 'medium',
        bandwidth: { upload: 0, download: 0 }
      });

      this.peers.set(peerId, {
        peer,
        stats: this.connectionStats.get(peerId),
        qualityLayers: new Map(),
        isConnected: false,
        lastStatsUpdate: Date.now()
      });

      return peer;

    } catch (error) {
      console.error(`Failed to create peer connection for ${peerId}:`, error);
      throw error;
    }
  }

  setupPeerHandlers(peer, peerId) {
    peer.on('signal', (signal) => {
      // Handle signaling with enhanced negotiation
      this.handleSignal(peerId, signal);
    });

    peer.on('connect', () => {
      console.log(`Peer ${peerId} connected`);
      const peerData = this.peers.get(peerId);
      if (peerData) {
        peerData.isConnected = true;
        this.performanceMetrics.activeConnections++;
      }
    });

    peer.on('data', (data) => {
      this.handleDataChannelMessage(peerId, data);
    });

    peer.on('stream', (stream) => {
      this.handleRemoteStream(peerId, stream);
    });

    peer.on('error', (error) => {
      console.error(`Peer ${peerId} error:`, error);
      this.handlePeerError(peerId, error);
    });

    peer.on('close', () => {
      console.log(`Peer ${peerId} disconnected`);
      this.handlePeerDisconnection(peerId);
    });
  }

  async setupSimulcast(peer, stream) {
    if (!stream || !this.isSimulcastSupported()) return;

    try {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) return;

      // Get peer connection for advanced configuration
      const pc = peer._pc;
      if (!pc) return;

      // Find video sender
      const sender = pc.getSenders().find(s => s.track === videoTrack);
      if (!sender) return;

      // Configure simulcast encoding parameters
      const encodingParams = [
        {
          rid: 'high',
          maxBitrate: this.options.bandwidthLimits.high,
          maxFramerate: 30,
          scaleResolutionDownBy: 1
        },
        {
          rid: 'medium', 
          maxBitrate: this.options.bandwidthLimits.medium,
          maxFramerate: 24,
          scaleResolutionDownBy: 2
        },
        {
          rid: 'low',
          maxBitrate: this.options.bandwidthLimits.low,
          maxFramerate: 15,
          scaleResolutionDownBy: 4
        }
      ];

      // Apply encoding parameters
      const params = sender.getParameters();
      params.encodings = encodingParams;
      
      await sender.setParameters(params);
      
      console.log('Simulcast configured successfully');

    } catch (error) {
      console.warn('Failed to setup simulcast:', error);
    }
  }

  async adaptQuality(peerId, targetQuality) {
    const peerData = this.peers.get(peerId);
    if (!peerData || !peerData.isConnected) return;

    try {
      const peer = peerData.peer;
      const pc = peer._pc;
      
      if (!pc) return;

      // Update receiver preferences for quality adaptation
      const receivers = pc.getReceivers();
      
      for (const receiver of receivers) {
        if (receiver.track && receiver.track.kind === 'video') {
          // Request specific spatial/temporal layer
          const params = this.getQualityParameters(targetQuality);
          
          if (receiver.getParameters) {
            try {
              await receiver.setParameters(params);
            } catch (error) {
              console.warn('Failed to set receiver parameters:', error);
            }
          }
        }
      }

      // Update stats
      const stats = this.connectionStats.get(peerId);
      if (stats) {
        stats.qualityLevel = targetQuality;
      }

      console.log(`Quality adapted to ${targetQuality} for peer ${peerId}`);

    } catch (error) {
      console.error(`Failed to adapt quality for peer ${peerId}:`, error);
    }
  }

  getQualityParameters(quality) {
    const qualityMap = {
      low: { preferredLayers: { spatial: 0, temporal: 0 } },
      medium: { preferredLayers: { spatial: 1, temporal: 1 } },
      high: { preferredLayers: { spatial: 2, temporal: 2 } }
    };

    return qualityMap[quality] || qualityMap.medium;
  }

  startStatsCollection() {
    this.statsInterval = setInterval(async () => {
      await this.collectConnectionStats();
      await this.analyzeNetworkConditions();
      await this.performQualityAdaptation();
    }, this.statsCollectionInterval);
  }

  async collectConnectionStats() {
    for (const [peerId, peerData] of this.peers) {
      if (!peerData.isConnected) continue;

      try {
        const peer = peerData.peer;
        const pc = peer._pc;
        
        if (!pc) continue;

        const stats = await getStats(pc);
        this.updateConnectionStats(peerId, stats);

      } catch (error) {
        console.warn(`Failed to collect stats for peer ${peerId}:`, error);
      }
    }

    this.updatePerformanceMetrics();
  }

  updateConnectionStats(peerId, rawStats) {
    const stats = this.connectionStats.get(peerId);
    if (!stats) return;

    // Extract relevant statistics
    const videoStats = rawStats.video;
    const audioStats = rawStats.audio;
    const connectionStats = rawStats.connection;

    if (connectionStats) {
      stats.rtt = connectionStats.rtt || 0;
      stats.bandwidth.download = connectionStats.availableIncomingBitrate || 0;
      stats.bandwidth.upload = connectionStats.availableOutgoingBitrate || 0;
    }

    if (videoStats && videoStats.remote) {
      stats.bytesReceived += videoStats.remote.bytesReceived || 0;
      stats.packetsLost += videoStats.remote.packetsLost || 0;
      stats.jitter = videoStats.remote.jitter || 0;
    }

    if (videoStats && videoStats.local) {
      stats.bytesSent += videoStats.local.bytesSent || 0;
    }

    stats.lastUpdate = Date.now();
  }

  async analyzeNetworkConditions() {
    const networkHealth = await this.networkAnalyzer.analyze(this.connectionStats);
    
    // Update bandwidth monitor
    this.bandwidthMonitor.update(networkHealth);
    
    // Store network analysis results
    this.networkConditions = {
      ...networkHealth,
      timestamp: Date.now()
    };
  }

  async performQualityAdaptation() {
    if (!this.options.enableSimulcast) return;

    for (const [peerId, peerData] of this.peers) {
      if (!peerData.isConnected) continue;

      const stats = this.connectionStats.get(peerId);
      const recommendedQuality = this.qualityManager.getRecommendedQuality(
        stats,
        this.networkConditions,
        this.performanceMetrics
      );

      if (recommendedQuality !== stats.qualityLevel) {
        await this.adaptQuality(peerId, recommendedQuality);
      }
    }
  }

  updatePerformanceMetrics() {
    const allStats = Array.from(this.connectionStats.values());
    
    this.performanceMetrics = {
      totalConnections: this.peers.size,
      activeConnections: Array.from(this.peers.values()).filter(p => p.isConnected).length,
      averageRTT: this.calculateAverage(allStats.map(s => s.rtt)),
      totalBandwidth: allStats.reduce((sum, s) => sum + s.bandwidth.download + s.bandwidth.upload, 0),
      packetLoss: this.calculateAverage(allStats.map(s => s.packetsLost)),
      jitter: this.calculateAverage(allStats.map(s => s.jitter))
    };
  }

  calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  handleSignal(peerId, signal) {
    // Emit signal to signaling server or handle locally
    console.log(`Signal for peer ${peerId}:`, signal.type);
  }

  handleDataChannelMessage(peerId, data) {
    try {
      const message = JSON.parse(data);
      console.log(`Data from peer ${peerId}:`, message);
      
      // Handle different message types
      switch (message.type) {
        case 'quality_request':
          this.handleQualityRequest(peerId, message.quality);
          break;
        case 'network_info':
          this.handleNetworkInfo(peerId, message.data);
          break;
        default:
          console.log('Unknown data channel message type:', message.type);
      }
    } catch (error) {
      console.warn('Failed to parse data channel message:', error);
    }
  }

  handleRemoteStream(peerId, stream) {
    console.log(`Remote stream received from peer ${peerId}`);
    // Handle remote stream
  }

  handlePeerError(peerId, error) {
    console.error(`Peer ${peerId} error:`, error);
    
    // Attempt reconnection for recoverable errors
    if (this.isRecoverableError(error)) {
      setTimeout(() => {
        this.attemptReconnection(peerId);
      }, 2000);
    }
  }

  handlePeerDisconnection(peerId) {
    const peerData = this.peers.get(peerId);
    if (peerData && peerData.isConnected) {
      this.performanceMetrics.activeConnections--;
    }
    
    this.peers.delete(peerId);
    this.connectionStats.delete(peerId);
  }

  isRecoverableError(error) {
    const recoverableErrors = [
      'ICE connection failed',
      'Connection timeout',
      'Network error'
    ];
    
    return recoverableErrors.some(pattern => 
      error.message && error.message.includes(pattern)
    );
  }

  async attemptReconnection(peerId) {
    console.log(`Attempting to reconnect to peer ${peerId}`);
    // Implement reconnection logic
  }

  isSimulcastSupported() {
    // Check if browser supports simulcast
    const pc = new RTCPeerConnection();
    const sender = pc.addTransceiver('video', { direction: 'sendonly' }).sender;
    
    try {
      const params = sender.getParameters();
      pc.close();
      return 'encodings' in params;
    } catch (error) {
      pc.close();
      return false;
    }
  }

  // Public API methods
  async addPeer(peerId, localStream, options = {}) {
    return await this.createPeerConnection(peerId, localStream, options);
  }

  removePeer(peerId) {
    const peerData = this.peers.get(peerId);
    if (peerData) {
      try {
        peerData.peer.destroy();
      } catch (error) {
        console.warn(`Error destroying peer ${peerId}:`, error);
      }
      this.handlePeerDisconnection(peerId);
    }
  }

  getPeerStats(peerId) {
    return this.connectionStats.get(peerId);
  }

  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  getNetworkConditions() {
    return { ...this.networkConditions };
  }

  setQualityPreference(peerId, quality) {
    this.adaptQuality(peerId, quality);
  }

  dispose() {
    this.isInitialized = false;
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    
    // Cleanup all peer connections
    for (const peerId of this.peers.keys()) {
      this.removePeer(peerId);
    }
    
    this.peers.clear();
    this.connectionStats.clear();
    
    this.qualityManager.dispose();
    this.bandwidthMonitor.dispose();
    this.networkAnalyzer.dispose();
  }
}

// Quality Management Helper Class
class QualityManager {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    this.isInitialized = true;
  }

  getRecommendedQuality(stats, networkConditions, performanceMetrics) {
    if (!stats || !networkConditions) return 'medium';

    // Quality decision based on multiple factors
    const factors = {
      bandwidth: this.evaluateBandwidth(stats.bandwidth),
      rtt: this.evaluateRTT(stats.rtt),
      packetLoss: this.evaluatePacketLoss(stats.packetsLost),
      connections: this.evaluateConnectionCount(performanceMetrics.activeConnections)
    };

    const score = Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.keys(factors).length;

    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  evaluateBandwidth(bandwidth) {
    const totalBandwidth = bandwidth.download + bandwidth.upload;
    if (totalBandwidth >= 2000000) return 1.0; // 2 Mbps+
    if (totalBandwidth >= 1000000) return 0.7; // 1 Mbps+
    if (totalBandwidth >= 500000) return 0.4;  // 500 kbps+
    return 0.1;
  }

  evaluateRTT(rtt) {
    if (rtt <= 50) return 1.0;   // Excellent
    if (rtt <= 100) return 0.8;  // Good
    if (rtt <= 200) return 0.5;  // Fair
    return 0.2;                  // Poor
  }

  evaluatePacketLoss(packetLoss) {
    if (packetLoss <= 0.1) return 1.0;  // < 0.1%
    if (packetLoss <= 1.0) return 0.7;  // < 1%
    if (packetLoss <= 3.0) return 0.4;  // < 3%
    return 0.1;                         // > 3%
  }

  evaluateConnectionCount(connections) {
    if (connections <= 2) return 1.0;
    if (connections <= 4) return 0.8;
    if (connections <= 6) return 0.6;
    return 0.4;
  }

  dispose() {
    this.isInitialized = false;
  }
}

// Bandwidth Monitoring Helper Class
class BandwidthMonitor {
  constructor() {
    this.history = [];
    this.isInitialized = false;
  }

  async initialize() {
    this.isInitialized = true;
  }

  update(networkHealth) {
    this.history.push({
      timestamp: Date.now(),
      ...networkHealth
    });

    // Keep last 60 measurements (1 minute at 1s intervals)
    if (this.history.length > 60) {
      this.history.shift();
    }
  }

  getTrend() {
    if (this.history.length < 2) return 'stable';
    
    const recent = this.history.slice(-10);
    const older = this.history.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, h) => sum + h.bandwidth, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.bandwidth, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'degrading';
    return 'stable';
  }

  dispose() {
    this.isInitialized = false;
    this.history = [];
  }
}

// Network Analysis Helper Class
class NetworkAnalyzer {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    this.isInitialized = true;
  }

  async analyze(connectionStats) {
    const allStats = Array.from(connectionStats.values());
    
    return {
      averageRTT: this.calculateAverage(allStats.map(s => s.rtt)),
      totalBandwidth: allStats.reduce((sum, s) => sum + s.bandwidth.download + s.bandwidth.upload, 0),
      packetLossRate: this.calculateAverage(allStats.map(s => s.packetsLost)),
      jitter: this.calculateAverage(allStats.map(s => s.jitter)),
      connectionStability: this.assessStability(allStats),
      recommendation: this.getRecommendation(allStats)
    };
  }

  calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  assessStability(stats) {
    // Simple stability assessment based on RTT variance
    const rtts = stats.map(s => s.rtt).filter(rtt => rtt > 0);
    if (rtts.length === 0) return 'unknown';
    
    const avg = this.calculateAverage(rtts);
    const variance = rtts.reduce((sum, rtt) => sum + Math.pow(rtt - avg, 2), 0) / rtts.length;
    const stdDev = Math.sqrt(variance);
    
    const coefficient = stdDev / avg;
    
    if (coefficient < 0.1) return 'excellent';
    if (coefficient < 0.2) return 'good';
    if (coefficient < 0.3) return 'fair';
    return 'poor';
  }

  getRecommendation(stats) {
    const recommendations = [];
    
    const avgRTT = this.calculateAverage(stats.map(s => s.rtt));
    if (avgRTT > 200) {
      recommendations.push('Consider reducing video quality due to high latency');
    }
    
    const totalLoss = this.calculateAverage(stats.map(s => s.packetsLost));
    if (totalLoss > 2) {
      recommendations.push('High packet loss detected, consider switching to audio only');
    }
    
    if (stats.length > 6) {
      recommendations.push('Many connections detected, consider using SFU mode');
    }
    
    return recommendations.length > 0 ? recommendations : ['Network conditions are good'];
  }

  dispose() {
    this.isInitialized = false;
  }
}

export default AdvancedConnectionManager;