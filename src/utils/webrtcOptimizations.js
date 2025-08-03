// WebRTC Performance Optimizations

export const optimizedPeerConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  sdpSemantics: 'unified-plan'
};

// Adaptive bitrate control
export class AdaptiveBitrateController {
  constructor(peer) {
    this.peer = peer;
    this.targetBitrate = 1000000; // 1 Mbps default
    this.minBitrate = 100000; // 100 Kbps
    this.maxBitrate = 2000000; // 2 Mbps
    this.lastStats = null;
    this.statsInterval = null;
  }
  
  startMonitoring() {
    this.statsInterval = setInterval(() => {
      this.checkConnectionQuality();
    }, 2000);
  }
  
  stopMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }
  
  async checkConnectionQuality() {
    if (!this.peer || this.peer.destroyed) return;
    
    try {
      const stats = await this.peer.getStats();
      if (!stats) return;
      
      let packetsLost = 0;
      let totalPackets = 0;
      let bandwidth = 0;
      
      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          if (this.lastStats) {
            const lastReport = this.lastStats.get(report.id);
            if (lastReport) {
              const timeDiff = report.timestamp - lastReport.timestamp;
              const bytesReceived = report.bytesReceived - lastReport.bytesReceived;
              bandwidth = (bytesReceived * 8) / (timeDiff / 1000); // bps
            }
          }
          packetsLost += report.packetsLost || 0;
          totalPackets += (report.packetsReceived || 0) + (report.packetsLost || 0);
        }
      });
      
      const packetLossRate = totalPackets > 0 ? packetsLost / totalPackets : 0;
      
      // Adjust bitrate based on quality
      if (packetLossRate > 0.05) { // 5% packet loss
        this.targetBitrate = Math.max(this.minBitrate, this.targetBitrate * 0.8);
        this.adjustBitrate();
      } else if (packetLossRate < 0.01 && bandwidth > this.targetBitrate * 1.2) {
        this.targetBitrate = Math.min(this.maxBitrate, this.targetBitrate * 1.1);
        this.adjustBitrate();
      }
      
      this.lastStats = stats;
    } catch (error) {
      console.warn('Stats monitoring error:', error);
    }
  }
  
  async adjustBitrate() {
    if (!this.peer || this.peer.destroyed) return;
    
    try {
      const sender = this.peer.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      
      if (sender && sender.getParameters) {
        const params = sender.getParameters();
        if (params.encodings && params.encodings.length > 0) {
          params.encodings[0].maxBitrate = this.targetBitrate;
          await sender.setParameters(params);
        }
      }
    } catch (error) {
      console.warn('Bitrate adjustment error:', error);
    }
  }
}

// Connection quality monitor
export class ConnectionQualityMonitor {
  constructor() {
    this.peers = new Map();
    this.qualityCallbacks = new Set();
  }
  
  addPeer(peerId, peer) {
    const controller = new AdaptiveBitrateController(peer);
    controller.startMonitoring();
    this.peers.set(peerId, {
      peer,
      controller,
      quality: 'unknown',
      lastUpdate: Date.now()
    });
  }
  
  removePeer(peerId) {
    const peerData = this.peers.get(peerId);
    if (peerData) {
      peerData.controller.stopMonitoring();
      this.peers.delete(peerId);
    }
  }
  
  onQualityChange(callback) {
    this.qualityCallbacks.add(callback);
    return () => this.qualityCallbacks.delete(callback);
  }
  
  async checkAllConnections() {
    const qualityUpdates = {};
    
    for (const [peerId, peerData] of this.peers) {
      try {
        const stats = await peerData.peer.getStats();
        const quality = this.calculateQuality(stats);
        
        if (quality !== peerData.quality) {
          peerData.quality = quality;
          qualityUpdates[peerId] = quality;
        }
        
        peerData.lastUpdate = Date.now();
      } catch (error) {
        console.warn(`Quality check failed for peer ${peerId}:`, error);
        qualityUpdates[peerId] = 'poor';
      }
    }
    
    if (Object.keys(qualityUpdates).length > 0) {
      this.qualityCallbacks.forEach(callback => callback(qualityUpdates));
    }
  }
  
  calculateQuality(stats) {
    let score = 0;
    let factors = 0;
    
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp') {
        factors++;
        
        // Packet loss rate
        const packetsLost = report.packetsLost || 0;
        const packetsReceived = report.packetsReceived || 0;
        const totalPackets = packetsLost + packetsReceived;
        const lossRate = totalPackets > 0 ? packetsLost / totalPackets : 0;
        
        if (lossRate < 0.01) score += 40; // Excellent
        else if (lossRate < 0.03) score += 30; // Good
        else if (lossRate < 0.05) score += 20; // Fair
        else score += 10; // Poor
        
        // Jitter
        const jitter = report.jitter || 0;
        if (jitter < 0.020) score += 30; // < 20ms
        else if (jitter < 0.050) score += 20; // < 50ms
        else if (jitter < 0.100) score += 10; // < 100ms
        
        // Round trip time
        const rtt = report.roundTripTime;
        if (rtt && rtt < 0.100) score += 30; // < 100ms
        else if (rtt && rtt < 0.200) score += 20; // < 200ms
        else if (rtt && rtt < 0.500) score += 10; // < 500ms
      }
    });
    
    if (factors === 0) return 'unknown';
    
    const avgScore = score / factors;
    if (avgScore >= 80) return 'excellent';
    if (avgScore >= 60) return 'good';
    if (avgScore >= 40) return 'fair';
    return 'poor';
  }
  
  cleanup() {
    this.peers.forEach((_, peerId) => this.removePeer(peerId));
    this.qualityCallbacks.clear();
  }
}

// Enhanced media constraints
export const getOptimizedMediaConstraints = (quality = 'high') => {
  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1
    },
    video: {
      facingMode: 'user'
    }
  };
  
  switch (quality) {
    case 'high':
      constraints.video = {
        ...constraints.video,
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 }
      };
      break;
    case 'medium':
      constraints.video = {
        ...constraints.video,
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 24, max: 30 }
      };
      break;
    case 'low':
      constraints.video = {
        ...constraints.video,
        width: { ideal: 320, max: 640 },
        height: { ideal: 240, max: 480 },
        frameRate: { ideal: 15, max: 24 }
      };
      break;
  }
  
  return constraints;
};

// Screen sharing optimization
export const getOptimizedScreenConstraints = () => ({
  video: {
    cursor: 'always',
    frameRate: { ideal: 15, max: 30 },
    width: { max: 1920 },
    height: { max: 1080 }
  },
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  }
});

export default {
  optimizedPeerConfig,
  AdaptiveBitrateController,
  ConnectionQualityMonitor,
  getOptimizedMediaConstraints,
  getOptimizedScreenConstraints
};