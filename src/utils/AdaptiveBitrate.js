/**
 * Adaptive Bitrate Streaming Controller
 * 
 * This module provides intelligent bitrate adjustment based on:
 * - Network conditions
 * - Device capabilities
 * - Connection quality
 * - User preferences
 */

class AdaptiveBitrate {
  constructor() {
    this.currentConstraints = {
      video: {
        width: 1280,
        height: 720,
        frameRate: 30,
        bitrate: 1500000 // 1.5 Mbps default
      },
      audio: {
        sampleRate: 48000,
        channelCount: 2,
        bitrate: 128000 // 128 kbps
      }
    };

    // Quality profiles
    this.qualityProfiles = {
      ultra: {
        video: { width: 1920, height: 1080, frameRate: 30, bitrate: 3000000 },
        audio: { sampleRate: 48000, channelCount: 2, bitrate: 256000 }
      },
      high: {
        video: { width: 1280, height: 720, frameRate: 30, bitrate: 1500000 },
        audio: { sampleRate: 48000, channelCount: 2, bitrate: 128000 }
      },
      medium: {
        video: { width: 854, height: 480, frameRate: 25, bitrate: 800000 },
        audio: { sampleRate: 44100, channelCount: 2, bitrate: 96000 }
      },
      low: {
        video: { width: 640, height: 360, frameRate: 20, bitrate: 400000 },
        audio: { sampleRate: 44100, channelCount: 1, bitrate: 64000 }
      },
      minimal: {
        video: { width: 320, height: 240, frameRate: 15, bitrate: 200000 },
        audio: { sampleRate: 22050, channelCount: 1, bitrate: 32000 }
      }
    };

    this.currentProfile = 'high';
    this.isAdaptationEnabled = true;
    this.adaptationHistory = [];
    this.lastAdaptation = Date.now();
    this.adaptationCooldown = 10000; // 10 seconds

    // Network condition thresholds
    this.thresholds = {
      excellent: { bandwidth: 5000000, rtt: 50, packetLoss: 0.001 },
      good: { bandwidth: 2000000, rtt: 100, packetLoss: 0.01 },
      fair: { bandwidth: 1000000, rtt: 200, packetLoss: 0.03 },
      poor: { bandwidth: 500000, rtt: 500, packetLoss: 0.05 },
      critical: { bandwidth: 200000, rtt: 1000, packetLoss: 0.1 }
    };

    this.observers = new Set();
  }

  /**
   * Add observer for adaptation events
   */
  addObserver(callback) {
    this.observers.add(callback);
  }

  /**
   * Remove observer
   */
  removeObserver(callback) {
    this.observers.delete(callback);
  }

  /**
   * Notify observers of adaptation changes
   */
  notifyObservers(data) {
    this.observers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Adaptive bitrate observer error:', error);
      }
    });
  }

  /**
   * Analyze network conditions and suggest quality profile
   */
  analyzeNetworkConditions(networkStats) {
    const {
      bandwidth = 0,
      rtt = 0,
      packetLoss = 0,
      connectionType = 'unknown'
    } = networkStats;

    // Determine network quality level
    let networkQuality = 'critical';
    
    if (bandwidth >= this.thresholds.excellent.bandwidth && 
        rtt <= this.thresholds.excellent.rtt && 
        packetLoss <= this.thresholds.excellent.packetLoss) {
      networkQuality = 'excellent';
    } else if (bandwidth >= this.thresholds.good.bandwidth && 
               rtt <= this.thresholds.good.rtt && 
               packetLoss <= this.thresholds.good.packetLoss) {
      networkQuality = 'good';
    } else if (bandwidth >= this.thresholds.fair.bandwidth && 
               rtt <= this.thresholds.fair.rtt && 
               packetLoss <= this.thresholds.fair.packetLoss) {
      networkQuality = 'fair';
    } else if (bandwidth >= this.thresholds.poor.bandwidth && 
               rtt <= this.thresholds.poor.rtt && 
               packetLoss <= this.thresholds.poor.packetLoss) {
      networkQuality = 'poor';
    }

    // Map network quality to video quality profile
    const qualityMapping = {
      excellent: 'ultra',
      good: 'high',
      fair: 'medium',
      poor: 'low',
      critical: 'minimal'
    };

    // Consider connection type
    if (connectionType === 'cellular' && networkQuality === 'excellent') {
      networkQuality = 'good'; // Conservative on cellular
    }

    const suggestedProfile = qualityMapping[networkQuality];
    
    return {
      networkQuality,
      suggestedProfile,
      confidence: this.calculateConfidence(networkStats),
      reasons: this.getAdaptationReasons(networkStats, networkQuality)
    };
  }

  /**
   * Calculate confidence level for adaptation decision
   */
  calculateConfidence(networkStats) {
    const { bandwidth, rtt, packetLoss } = networkStats;
    let confidence = 100;

    // Reduce confidence for edge cases
    if (bandwidth > 0 && bandwidth < 500000) confidence -= 20;
    if (rtt > 300) confidence -= 15;
    if (packetLoss > 0.02) confidence -= 25;

    // Increase confidence for stable conditions
    if (bandwidth > 2000000 && rtt < 100 && packetLoss < 0.01) {
      confidence = Math.min(100, confidence + 10);
    }

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Get reasons for adaptation decision
   */
  getAdaptationReasons(networkStats) {
    const reasons = [];
    const { bandwidth, rtt, packetLoss } = networkStats;

    if (bandwidth < this.thresholds.good.bandwidth) {
      reasons.push('Low bandwidth detected');
    }
    if (rtt > this.thresholds.good.rtt) {
      reasons.push('High latency detected');
    }
    if (packetLoss > this.thresholds.good.packetLoss) {
      reasons.push('Packet loss detected');
    }

    if (reasons.length === 0) {
      reasons.push('Network conditions are optimal');
    }

    return reasons;
  }

  /**
   * Adapt quality based on performance metrics
   */
  async adaptQuality(performanceMetrics) {
    if (!this.isAdaptationEnabled) return null;

    // Check cooldown period
    if (Date.now() - this.lastAdaptation < this.adaptationCooldown) {
      return null;
    }

    const analysis = this.analyzeNetworkConditions(performanceMetrics);
    
    // Only adapt if suggestion is different from current profile
    if (analysis.suggestedProfile === this.currentProfile) {
      return null;
    }

    // Require minimum confidence for adaptation
    if (analysis.confidence < 70) {
      console.log('Skipping adaptation due to low confidence:', analysis.confidence);
      return null;
    }

    const previousProfile = this.currentProfile;
    this.currentProfile = analysis.suggestedProfile;
    this.currentConstraints = { ...this.qualityProfiles[this.currentProfile] };
    this.lastAdaptation = Date.now();

    // Log adaptation
    const adaptationEvent = {
      timestamp: Date.now(),
      from: previousProfile,
      to: this.currentProfile,
      reason: analysis.reasons.join(', '),
      confidence: analysis.confidence,
      networkQuality: analysis.networkQuality,
      metrics: performanceMetrics
    };

    this.adaptationHistory.push(adaptationEvent);
    
    // Keep only last 50 adaptations
    if (this.adaptationHistory.length > 50) {
      this.adaptationHistory.shift();
    }

    console.log(`🎚️ Adapted quality: ${previousProfile} → ${this.currentProfile}`, adaptationEvent);

    // Notify observers
    this.notifyObservers({
      type: 'quality_adapted',
      ...adaptationEvent
    });

    return adaptationEvent;
  }

  /**
   * Apply constraints to media stream
   */
  async applyConstraints(stream, profile = this.currentProfile) {
    if (!stream) return false;

    const constraints = this.qualityProfiles[profile];
    let success = true;

    // Apply video constraints
    const videoTracks = stream.getVideoTracks();
    for (const track of videoTracks) {
      try {
        await track.applyConstraints({
          width: { ideal: constraints.video.width },
          height: { ideal: constraints.video.height },
          frameRate: { ideal: constraints.video.frameRate }
        });
      } catch (error) {
        console.error('Failed to apply video constraints:', error);
        success = false;
      }
    }

    // Apply audio constraints
    const audioTracks = stream.getAudioTracks();
    for (const track of audioTracks) {
      try {
        await track.applyConstraints({
          sampleRate: { ideal: constraints.audio.sampleRate },
          channelCount: { ideal: constraints.audio.channelCount }
        });
      } catch (error) {
        console.error('Failed to apply audio constraints:', error);
        success = false;
      }
    }

    return success;
  }

  /**
   * Get optimal constraints for peer connection
   */
  getPeerConstraints(networkCondition = 'good') {
    const profile = this.getProfileForNetworkCondition(networkCondition);
    return this.qualityProfiles[profile];
  }

  /**
   * Get profile based on network condition
   */
  getProfileForNetworkCondition(condition) {
    const mapping = {
      excellent: 'ultra',
      good: 'high',
      fair: 'medium',
      poor: 'low',
      critical: 'minimal'
    };
    return mapping[condition] || 'medium';
  }

  /**
   * Manual quality override
   */
  setQualityProfile(profile) {
    if (!this.qualityProfiles[profile]) {
      console.error('Invalid quality profile:', profile);
      return false;
    }

    const previousProfile = this.currentProfile;
    this.currentProfile = profile;
    this.currentConstraints = { ...this.qualityProfiles[profile] };

    console.log(`🎯 Manual quality set: ${previousProfile} → ${profile}`);

    // Notify observers
    this.notifyObservers({
      type: 'quality_manual_set',
      from: previousProfile,
      to: profile,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Enable/disable adaptive quality
   */
  setAdaptiveMode(enabled) {
    this.isAdaptationEnabled = enabled;
    console.log(`🎛️ Adaptive quality ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current quality info
   */
  getCurrentQuality() {
    return {
      profile: this.currentProfile,
      constraints: { ...this.currentConstraints },
      isAdaptive: this.isAdaptationEnabled,
      lastAdaptation: this.lastAdaptation
    };
  }

  /**
   * Get quality profiles
   */
  getAvailableProfiles() {
    return Object.keys(this.qualityProfiles).map(key => ({
      id: key,
      name: this.getProfileDisplayName(key),
      ...this.qualityProfiles[key]
    }));
  }

  /**
   * Get display name for profile
   */
  getProfileDisplayName(profile) {
    const names = {
      ultra: 'Ultra (1080p)',
      high: 'High (720p)',
      medium: 'Medium (480p)',
      low: 'Low (360p)',
      minimal: 'Minimal (240p)'
    };
    return names[profile] || profile;
  }

  /**
   * Get adaptation statistics
   */
  getAdaptationStats() {
    if (this.adaptationHistory.length === 0) {
      return {
        totalAdaptations: 0,
        averageConfidence: 0,
        mostCommonProfile: this.currentProfile,
        recentAdaptations: []
      };
    }

    const totalAdaptations = this.adaptationHistory.length;
    const averageConfidence = this.adaptationHistory.reduce((sum, event) => 
      sum + event.confidence, 0) / totalAdaptations;

    // Find most common profile
    const profileCounts = {};
    this.adaptationHistory.forEach(event => {
      profileCounts[event.to] = (profileCounts[event.to] || 0) + 1;
    });
    
    const mostCommonProfile = Object.keys(profileCounts).reduce((a, b) =>
      profileCounts[a] > profileCounts[b] ? a : b);

    return {
      totalAdaptations,
      averageConfidence: Math.round(averageConfidence),
      mostCommonProfile,
      recentAdaptations: this.adaptationHistory.slice(-10)
    };
  }

  /**
   * Reset adaptation history
   */
  resetStats() {
    this.adaptationHistory = [];
    console.log('🔄 Adaptation statistics reset');
  }
}

// Create singleton instance
const adaptiveBitrate = new AdaptiveBitrate();

export default adaptiveBitrate;