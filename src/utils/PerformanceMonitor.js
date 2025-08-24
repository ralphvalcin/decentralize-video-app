/**
 * Advanced Performance Monitor for WebRTC Video Chat Application
 * 
 * This module provides comprehensive performance monitoring including:
 * - WebRTC connection statistics
 * - Network quality metrics
 * - React component performance
 * - Real-time performance analytics
 * - Connection quality scoring
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.isMonitoring = false;
    this.observers = new Set();
    this.performanceBuffer = [];
    this.maxBufferSize = 1000;
    
    // Enhanced performance thresholds for enterprise targets
    this.thresholds = {
      connectionTime: 500,  // Target: <500ms connection establishment
      videoFrameRate: 25,   // Min acceptable frame rate (fps)
      audioLevel: -50,      // Min acceptable audio level (dB)
      packetLoss: 0.02,     // Max acceptable packet loss (2%)
      jitter: 50,           // Max acceptable jitter (ms)
      rtt: 200,             // Max acceptable round trip time (ms)
      bandwidth: 500000,    // Min acceptable bandwidth (bps)
      memoryPerConnection: 50 * 1024 * 1024, // Target: <50MB per peer
      cpuPerStream: 5       // Target: <5% CPU per video stream
    };
    
    // Advanced WebRTC statistics collection
    this.webrtcStats = new Map();
    this.connectionEstablishmentTimes = [];
    this.qualityAdaptationHistory = [];
    this.memoryLeakDetection = {
      baseline: 0,
      measurements: [],
      alertThreshold: 100 * 1024 * 1024 // 100MB increase threshold
    };
    
    // ML-powered prediction models
    this.predictionModels = {
      bandwidth: new BandwidthPredictor(),
      quality: new QualityPredictor(),
      connection: new ConnectionPredictor()
    };
    
    // Performance regression detection
    this.regressionDetector = new PerformanceRegressionDetector();
    
    // Initialize Web Vitals monitoring
    this.initWebVitals();
    this.initAdvancedMonitoring();
  }

  /**
   * Start performance monitoring
   */
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🔍 Performance monitoring started');
    
    // Start regular performance collection
    this.startPerformanceCollection();
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    this.isMonitoring = false;
    this.clearIntervals();
    console.log('⏹️ Performance monitoring stopped');
  }

  /**
   * Add performance observer
   */
  addObserver(callback) {
    this.observers.add(callback);
  }

  /**
   * Remove performance observer
   */
  removeObserver(callback) {
    this.observers.delete(callback);
  }

  /**
   * Notify all observers of performance changes
   */
  notifyObservers(data) {
    this.observers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Performance observer error:', error);
      }
    });
  }

  /**
   * Monitor WebRTC peer connection statistics with advanced analytics
   */
  async monitorPeerConnection(peer, peerId) {
    if (!peer || peer.destroyed) return null;

    try {
      const startTime = performance.now();
      const stats = await peer.getStats();
      const connectionStats = this.parseAdvancedWebRTCStats(stats, peerId);
      
      // Store in enhanced metrics
      this.setMetric(`peer_${peerId}`, connectionStats);
      this.webrtcStats.set(peerId, {
        ...connectionStats,
        collectionTime: performance.now() - startTime,
        timestamp: Date.now()
      });
      
      // Advanced quality scoring with predictive elements
      const qualityScore = this.calculateAdvancedConnectionQuality(connectionStats, peerId);
      this.setMetric(`quality_${peerId}`, qualityScore);
      
      // Predictive analytics
      await this.performPredictiveAnalysis(peerId, connectionStats);
      
      // Enhanced performance threshold checking
      this.checkAdvancedPerformanceThresholds(connectionStats, peerId);
      
      // Memory leak detection
      this.detectMemoryLeaks(peerId, connectionStats);
      
      return connectionStats;
    } catch (error) {
      console.error(`Error monitoring peer ${peerId}:`, error);
      return null;
    }
  }

  /**
   * Parse advanced WebRTC statistics with comprehensive metrics
   */
  parseAdvancedWebRTCStats(stats, peerId) {
    const connectionStats = {
      peerId,
      timestamp: Date.now(),
      video: { inbound: {}, outbound: {}, codec: {}, quality: {} },
      audio: { inbound: {}, outbound: {}, codec: {} },
      network: { connection: {}, ice: {}, transport: {} },
      connection: { state: {}, timing: {} },
      advanced: { simulcast: {}, svc: {}, bandwidth: {} }
    };

    let _iceConnectionTime = null;
    let dtlsSetupTime = null;

    stats.forEach(report => {
      switch (report.type) {
        case 'inbound-rtp':
          if (report.mediaType === 'video') {
            connectionStats.video.inbound = {
              framesReceived: report.framesReceived || 0,
              framesPerSecond: report.framesPerSecond || 0,
              framesDropped: report.framesDropped || 0,
              bytesReceived: report.bytesReceived || 0,
              packetsReceived: report.packetsReceived || 0,
              packetsLost: report.packetsLost || 0,
              jitter: report.jitter || 0,
              frameWidth: report.frameWidth || 0,
              frameHeight: report.frameHeight || 0,
              firCount: report.firCount || 0,
              pliCount: report.pliCount || 0,
              nackCount: report.nackCount || 0,
              qpSum: report.qpSum || 0,
              totalDecodeTime: report.totalDecodeTime || 0,
              totalInterFrameDelay: report.totalInterFrameDelay || 0,
              totalSquaredInterFrameDelay: report.totalSquaredInterFrameDelay || 0
            };
          } else if (report.mediaType === 'audio') {
            connectionStats.audio.inbound = {
              bytesReceived: report.bytesReceived || 0,
              packetsReceived: report.packetsReceived || 0,
              packetsLost: report.packetsLost || 0,
              audioLevel: report.audioLevel || 0,
              jitter: report.jitter || 0,
              totalAudioEnergy: report.totalAudioEnergy || 0,
              totalSamplesDuration: report.totalSamplesDuration || 0
            };
          }
          break;
          
        case 'outbound-rtp':
          if (report.mediaType === 'video') {
            connectionStats.video.outbound = {
              framesSent: report.framesSent || 0,
              framesPerSecond: report.framesPerSecond || 0,
              bytesSent: report.bytesSent || 0,
              packetsSent: report.packetsSent || 0,
              qualityLimitationReason: report.qualityLimitationReason,
              qualityLimitationDurations: report.qualityLimitationDurations || {},
              frameWidth: report.frameWidth || 0,
              frameHeight: report.frameHeight || 0,
              framesEncoded: report.framesEncoded || 0,
              keyFramesEncoded: report.keyFramesEncoded || 0,
              totalEncodeTime: report.totalEncodeTime || 0,
              encoderImplementation: report.encoderImplementation || 'unknown',
              rid: report.rid || 'main' // For simulcast
            };
          } else if (report.mediaType === 'audio') {
            connectionStats.audio.outbound = {
              bytesSent: report.bytesSent || 0,
              packetsSent: report.packetsSent || 0,
              totalAudioEnergy: report.totalAudioEnergy || 0
            };
          }
          break;
          
        case 'candidate-pair':
          if (report.state === 'succeeded') {
            connectionStats.network.connection = {
              currentRoundTripTime: report.currentRoundTripTime * 1000 || 0,
              availableOutgoingBitrate: report.availableOutgoingBitrate || 0,
              availableIncomingBitrate: report.availableIncomingBitrate || 0,
              bytesReceived: report.bytesReceived || 0,
              bytesSent: report.bytesSent || 0,
              requestsReceived: report.requestsReceived || 0,
              requestsSent: report.requestsSent || 0,
              responsesReceived: report.responsesReceived || 0,
              responsesSent: report.responsesSent || 0,
              consentRequestsSent: report.consentRequestsSent || 0
            };
          }
          break;

        case 'local-candidate':
        case 'remote-candidate': {
          const candidateType = report.type.split('-')[0];
          if (!connectionStats.network.ice[candidateType]) {
            connectionStats.network.ice[candidateType] = [];
          }
          connectionStats.network.ice[candidateType].push({
            candidateType: report.candidateType,
            protocol: report.protocol,
            address: report.address,
            port: report.port,
            priority: report.priority,
            url: report.url
          });
          break;
        }

        case 'transport':
          connectionStats.network.transport = {
            bytesSent: report.bytesSent || 0,
            bytesReceived: report.bytesReceived || 0,
            rtcpTransportStatsId: report.rtcpTransportStatsId,
            selectedCandidatePairId: report.selectedCandidatePairId,
            localCertificateId: report.localCertificateId,
            remoteCertificateId: report.remoteCertificateId,
            tlsVersion: report.tlsVersion,
            dtlsState: report.dtlsState,
            dtlsCipher: report.dtlsCipher
          };
          if (report.dtlsState === 'connected' && !dtlsSetupTime) {
            dtlsSetupTime = report.timestamp;
          }
          break;
          
        case 'peer-connection':
          connectionStats.connection.state = {
            dataChannelsOpened: report.dataChannelsOpened || 0,
            dataChannelsClosed: report.dataChannelsClosed || 0
          };
          break;

        case 'codec': {
          const codecInfo = {
            mimeType: report.mimeType,
            clockRate: report.clockRate,
            channels: report.channels,
            sdpFmtpLine: report.sdpFmtpLine
          };
          if (report.mimeType && report.mimeType.includes('video')) {
            connectionStats.video.codec = codecInfo;
          } else if (report.mimeType && report.mimeType.includes('audio')) {
            connectionStats.audio.codec = codecInfo;
          }
          break;
        }
      }
    });

    // Calculate advanced metrics
    connectionStats.advanced = this.calculateAdvancedMetrics(connectionStats);
    
    return connectionStats;
  }

  /**
   * Calculate connection quality score (0-100)
   */
  calculateConnectionQuality(stats) {
    let score = 100;
    const factors = [];

    // Video quality factors
    if (stats.video.inbound) {
      const fps = stats.video.inbound.framesPerSecond || 0;
      const packetsLost = stats.video.inbound.packetsLost || 0;
      const packetsReceived = stats.video.inbound.packetsReceived || 1;
      const packetLossRate = packetsLost / (packetsLost + packetsReceived);

      if (fps < this.thresholds.videoFrameRate) {
        const fpsScore = Math.max(0, (fps / this.thresholds.videoFrameRate) * 30);
        score -= (30 - fpsScore);
        factors.push(`Low FPS: ${fps.toFixed(1)}`);
      }

      if (packetLossRate > this.thresholds.packetLoss) {
        const lossScore = Math.max(0, (1 - packetLossRate / 0.1) * 25);
        score -= (25 - lossScore);
        factors.push(`Packet loss: ${(packetLossRate * 100).toFixed(1)}%`);
      }
    }

    // Network quality factors
    if (stats.network.currentRoundTripTime) {
      const rtt = stats.network.currentRoundTripTime;
      if (rtt > this.thresholds.rtt) {
        const rttScore = Math.max(0, (1 - (rtt - this.thresholds.rtt) / this.thresholds.rtt) * 20);
        score -= (20 - rttScore);
        factors.push(`High RTT: ${rtt.toFixed(0)}ms`);
      }
    }

    // Bandwidth factors
    if (stats.network.availableOutgoingBitrate) {
      const bandwidth = stats.network.availableOutgoingBitrate;
      if (bandwidth < this.thresholds.bandwidth) {
        const bwScore = Math.max(0, (bandwidth / this.thresholds.bandwidth) * 25);
        score -= (25 - bwScore);
        factors.push(`Low bandwidth: ${Math.round(bandwidth / 1000)}kbps`);
      }
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      factors: factors,
      timestamp: Date.now()
    };
  }

  /**
   * Check performance thresholds and trigger alerts
   */
  checkPerformanceThresholds(stats, peerId) {
    const issues = [];

    // Check video performance
    if (stats.video.inbound?.framesPerSecond < this.thresholds.videoFrameRate) {
      issues.push({
        type: 'video_performance',
        severity: 'warning',
        message: `Low frame rate detected for peer ${peerId}: ${stats.video.inbound.framesPerSecond}fps`
      });
    }

    // Check network performance
    if (stats.network.currentRoundTripTime > this.thresholds.rtt) {
      issues.push({
        type: 'network_latency',
        severity: 'warning',
        message: `High latency detected for peer ${peerId}: ${stats.network.currentRoundTripTime}ms`
      });
    }

    // Notify observers of issues
    if (issues.length > 0) {
      this.notifyObservers({
        type: 'performance_issues',
        peerId,
        issues,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Monitor browser memory usage
   */
  getMemoryUsage() {
    if (!performance.memory) return null;

    return {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      usagePercentage: Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100)
    };
  }

  /**
   * Monitor network connection
   */
  getNetworkInfo() {
    if (!navigator.connection) return null;

    return {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt,
      saveData: navigator.connection.saveData
    };
  }

  /**
   * Initialize Web Vitals monitoring
   */
  initWebVitals() {
    // Monitor Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.setMetric('lcp', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Monitor First Input Delay (FID)
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach(entry => {
            this.setMetric('fid', entry.processingStart - entry.startTime);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Monitor Cumulative Layout Shift (CLS)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach(entry => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.setMetric('cls', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

      } catch (error) {
        console.warn('Web Vitals monitoring not available:', error);
      }
    }
  }

  /**
   * Start regular performance data collection
   */
  startPerformanceCollection() {
    this.performanceInterval = setInterval(() => {
      if (!this.isMonitoring) return;

      const performanceData = {
        timestamp: Date.now(),
        memory: this.getMemoryUsage(),
        network: this.getNetworkInfo(),
        navigation: this.getNavigationTiming(),
        fps: this.getCurrentFPS()
      };

      this.addToBuffer(performanceData);
      
      // Notify observers
      this.notifyObservers({
        type: 'performance_update',
        data: performanceData
      });
    }, 5000); // Collect every 5 seconds
  }

  /**
   * Get navigation timing information
   */
  getNavigationTiming() {
    if (!performance.timing) return null;

    const timing = performance.timing;
    return {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart,
      connectTime: timing.connectEnd - timing.connectStart,
      dnsTime: timing.domainLookupEnd - timing.domainLookupStart
    };
  }

  /**
   * Estimate current frame rate
   */
  getCurrentFPS() {
    return new Promise((resolve) => {
      let frames = 0;
      const startTime = performance.now();

      const countFrames = () => {
        frames++;
        const currentTime = performance.now();
        if (currentTime - startTime >= 1000) {
          resolve(frames);
        } else {
          requestAnimationFrame(countFrames);
        }
      };

      requestAnimationFrame(countFrames);
    });
  }

  /**
   * Add data to performance buffer
   */
  addToBuffer(data) {
    this.performanceBuffer.push(data);
    if (this.performanceBuffer.length > this.maxBufferSize) {
      this.performanceBuffer.shift();
    }
  }

  /**
   * Get performance metrics
   */
  getMetric(key) {
    return this.metrics.get(key);
  }

  /**
   * Set performance metric
   */
  setMetric(key, value) {
    this.metrics.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Get all performance data
   */
  getAllMetrics() {
    const metricsObj = {};
    this.metrics.forEach((value, key) => {
      metricsObj[key] = value;
    });
    return metricsObj;
  }

  /**
   * Get performance summary report
   */
  getPerformanceReport() {
    return {
      timestamp: Date.now(),
      isMonitoring: this.isMonitoring,
      metrics: this.getAllMetrics(),
      buffer: this.performanceBuffer.slice(-10), // Last 10 entries
      thresholds: this.thresholds
    };
  }

  /**
   * Initialize advanced monitoring systems
   */
  initAdvancedMonitoring() {
    // Initialize prediction models
    this.predictionModels.bandwidth.initialize();
    this.predictionModels.quality.initialize();
    this.predictionModels.connection.initialize();

    // Initialize regression detector
    this.regressionDetector.initialize();

    // Set baseline memory usage
    if (performance.memory) {
      this.memoryLeakDetection.baseline = performance.memory.usedJSHeapSize;
    }
  }

  /**
   * Calculate advanced WebRTC metrics
   */
  calculateAdvancedMetrics(connectionStats) {
    const advanced = {
      simulcast: {},
      svc: {},
      bandwidth: {},
      quality: {},
      efficiency: {}
    };

    // Bandwidth efficiency calculation
    const videoInbound = connectionStats.video.inbound;
    const videoOutbound = connectionStats.video.outbound;
    
    if (videoInbound.bytesReceived && videoInbound.framesReceived) {
      advanced.bandwidth.bytesPerFrame = videoInbound.bytesReceived / videoInbound.framesReceived;
    }

    // Quality metrics
    if (videoInbound.frameWidth && videoInbound.frameHeight) {
      advanced.quality.resolution = `${videoInbound.frameWidth}x${videoInbound.frameHeight}`;
      advanced.quality.pixelsPerSecond = videoInbound.frameWidth * videoInbound.frameHeight * videoInbound.framesPerSecond;
    }

    // Efficiency metrics
    if (videoOutbound.totalEncodeTime && videoOutbound.framesEncoded) {
      advanced.efficiency.averageEncodeTime = videoOutbound.totalEncodeTime / videoOutbound.framesEncoded;
    }

    if (videoInbound.totalDecodeTime && videoInbound.framesReceived) {
      advanced.efficiency.averageDecodeTime = videoInbound.totalDecodeTime / videoInbound.framesReceived;
    }

    // Simulcast detection
    if (videoOutbound.rid && videoOutbound.rid !== 'main') {
      advanced.simulcast.isActive = true;
      advanced.simulcast.layer = videoOutbound.rid;
    }

    return advanced;
  }

  /**
   * Calculate advanced connection quality with ML prediction
   */
  calculateAdvancedConnectionQuality(stats, peerId) {
    let score = 100;
    const factors = [];
    const weights = {
      latency: 0.25,
      bandwidth: 0.20,
      packetLoss: 0.20,
      jitter: 0.15,
      frameRate: 0.15,
      efficiency: 0.05
    };

    // Enhanced latency scoring
    let latencyScore = 100;
    if (stats.network.connection?.currentRoundTripTime) {
      const rtt = stats.network.connection.currentRoundTripTime;
      
      if (rtt > this.thresholds.rtt) {
        latencyScore = Math.max(0, 100 - ((rtt - this.thresholds.rtt) / this.thresholds.rtt * 50));
        factors.push(`High RTT: ${rtt.toFixed(0)}ms`);
      }
      
      score = score * (1 - weights.latency) + latencyScore * weights.latency;
    }

    // Bandwidth efficiency
    const outgoingBandwidth = stats.network.connection?.availableOutgoingBitrate || 0;
    const incomingBandwidth = stats.network.connection?.availableIncomingBitrate || 0;
    const totalBandwidth = outgoingBandwidth + incomingBandwidth;
    
    let bandwidthScore = 100;
    if (totalBandwidth < this.thresholds.bandwidth) {
      bandwidthScore = (totalBandwidth / this.thresholds.bandwidth) * 100;
      factors.push(`Low bandwidth: ${Math.round(totalBandwidth / 1000)}kbps`);
    }
    score = score * (1 - weights.bandwidth) + bandwidthScore * weights.bandwidth;

    // Packet loss with exponential penalty
    const packetsLost = stats.video.inbound?.packetsLost || 0;
    const packetsReceived = stats.video.inbound?.packetsReceived || 1;
    const packetLossRate = packetsLost / (packetsLost + packetsReceived);
    
    let packetLossScore = 100;
    if (packetLossRate > this.thresholds.packetLoss) {
      packetLossScore = Math.max(0, 100 - (packetLossRate / this.thresholds.packetLoss * 100));
      factors.push(`Packet loss: ${(packetLossRate * 100).toFixed(1)}%`);
    }
    score = score * (1 - weights.packetLoss) + packetLossScore * weights.packetLoss;

    // Frame rate consistency
    const fps = stats.video.inbound?.framesPerSecond || 0;
    let frameRateScore = 100;
    if (fps < this.thresholds.videoFrameRate) {
      frameRateScore = (fps / this.thresholds.videoFrameRate) * 100;
      factors.push(`Low FPS: ${fps.toFixed(1)}`);
    }
    score = score * (1 - weights.frameRate) + frameRateScore * weights.frameRate;

    // Jitter impact
    const jitter = stats.video.inbound?.jitter || stats.audio.inbound?.jitter || 0;
    let jitterScore = 100;
    if (jitter > this.thresholds.jitter) {
      jitterScore = Math.max(0, 100 - (jitter / this.thresholds.jitter * 50));
      factors.push(`High jitter: ${jitter.toFixed(1)}ms`);
    }
    score = score * (1 - weights.jitter) + jitterScore * weights.jitter;

    // Encoding/decoding efficiency
    let efficiencyScore = 100;
    if (stats.advanced?.efficiency?.averageEncodeTime > 33) { // >33ms is concerning for 30fps
      efficiencyScore = Math.max(0, 100 - ((stats.advanced.efficiency.averageEncodeTime - 33) * 2));
      factors.push(`Slow encoding: ${stats.advanced.efficiency.averageEncodeTime.toFixed(1)}ms`);
    }
    score = score * (1 - weights.efficiency) + efficiencyScore * weights.efficiency;

    // Get ML prediction confidence
    const predictionConfidence = this.predictionModels.quality.getPrediction(peerId, stats);

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      factors: factors,
      timestamp: Date.now(),
      prediction: predictionConfidence,
      breakdown: {
        latency: latencyScore,
        bandwidth: bandwidthScore,
        packetLoss: packetLossScore,
        frameRate: frameRateScore,
        jitter: jitterScore,
        efficiency: efficiencyScore
      }
    };
  }

  /**
   * Perform predictive analysis for connection optimization
   */
  async performPredictiveAnalysis(peerId, connectionStats) {
    // Bandwidth prediction
    const bandwidthPrediction = await this.predictionModels.bandwidth.predict(peerId, connectionStats);
    
    // Quality adaptation prediction
    const qualityPrediction = await this.predictionModels.quality.predict(peerId, connectionStats);
    
    // Connection stability prediction
    const stabilityPrediction = await this.predictionModels.connection.predict(peerId, connectionStats);

    const predictions = {
      bandwidth: bandwidthPrediction,
      quality: qualityPrediction,
      stability: stabilityPrediction,
      timestamp: Date.now()
    };

    this.setMetric(`predictions_${peerId}`, predictions);

    // Trigger proactive optimizations
    this.triggerProactiveOptimizations(peerId, predictions);
  }

  /**
   * Trigger proactive optimizations based on predictions
   */
  triggerProactiveOptimizations(peerId, predictions) {
    const optimizations = [];

    // Bandwidth-based optimizations
    if (predictions.bandwidth.trend === 'degrading' && predictions.bandwidth.confidence > 0.7) {
      optimizations.push({
        type: 'quality_reduction',
        reason: 'Predicted bandwidth degradation',
        confidence: predictions.bandwidth.confidence
      });
    }

    // Stability-based optimizations
    if (predictions.stability.risk === 'high' && predictions.stability.confidence > 0.8) {
      optimizations.push({
        type: 'connection_fallback',
        reason: 'High connection failure risk',
        confidence: predictions.stability.confidence
      });
    }

    if (optimizations.length > 0) {
      this.notifyObservers({
        type: 'proactive_optimization',
        peerId,
        optimizations,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Enhanced performance threshold checking
   */
  checkAdvancedPerformanceThresholds(stats, peerId) {
    const issues = [];

    // Connection establishment time tracking
    if (stats.connection.timing?.connectionEstablished) {
      const establishmentTime = stats.connection.timing.connectionEstablished;
      if (establishmentTime > this.thresholds.connectionTime) {
        issues.push({
          type: 'slow_connection_establishment',
          severity: 'warning',
          message: `Slow connection establishment: ${establishmentTime}ms (target: <${this.thresholds.connectionTime}ms)`,
          value: establishmentTime,
          threshold: this.thresholds.connectionTime
        });
      }
    }

    // Memory usage per connection
    const memoryUsage = this.estimateConnectionMemoryUsage(peerId);
    if (memoryUsage > this.thresholds.memoryPerConnection) {
      issues.push({
        type: 'high_memory_usage',
        severity: 'warning',
        message: `High memory usage per connection: ${(memoryUsage / 1024 / 1024).toFixed(1)}MB`,
        value: memoryUsage,
        threshold: this.thresholds.memoryPerConnection
      });
    }

    // Video encoding efficiency
    if (stats.advanced?.efficiency?.averageEncodeTime > 33) { // 30fps = 33ms budget
      issues.push({
        type: 'inefficient_encoding',
        severity: 'warning',
        message: `Inefficient video encoding: ${stats.advanced.efficiency.averageEncodeTime.toFixed(1)}ms per frame`,
        value: stats.advanced.efficiency.averageEncodeTime,
        threshold: 33
      });
    }

    // Regression detection
    const regressions = this.regressionDetector.detect(peerId, stats);
    issues.push(...regressions);

    // Notify observers of issues
    if (issues.length > 0) {
      this.notifyObservers({
        type: 'advanced_performance_issues',
        peerId,
        issues,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Estimate memory usage per connection
   */
  estimateConnectionMemoryUsage(peerId) {
    // Simplified memory estimation based on connection stats
    const stats = this.webrtcStats.get(peerId);
    if (!stats) return 0;

    let estimatedMemory = 1024 * 1024; // Base 1MB per connection

    // Add video buffer estimation
    if (stats.video.inbound) {
      const resolution = (stats.video.inbound.frameWidth || 640) * (stats.video.inbound.frameHeight || 480);
      const bufferFrames = 5; // Estimated buffer depth
      estimatedMemory += resolution * bufferFrames * 3; // RGB24 estimation
    }

    return estimatedMemory;
  }

  /**
   * Detect memory leaks in peer connections
   */
  detectMemoryLeaks(peerId) {
    if (!performance.memory) return;

    const currentMemory = performance.memory.usedJSHeapSize;
    const memoryIncrease = currentMemory - this.memoryLeakDetection.baseline;

    this.memoryLeakDetection.measurements.push({
      timestamp: Date.now(),
      peerId,
      memory: currentMemory,
      increase: memoryIncrease
    });

    // Keep only last 100 measurements
    if (this.memoryLeakDetection.measurements.length > 100) {
      this.memoryLeakDetection.measurements.shift();
    }

    // Check for memory leaks
    if (memoryIncrease > this.memoryLeakDetection.alertThreshold) {
      const recentIncrease = this.calculateRecentMemoryGrowth();
      
      if (recentIncrease > 50 * 1024 * 1024) { // 50MB growth in recent measurements
        this.notifyObservers({
          type: 'memory_leak_detected',
          peerId,
          memoryIncrease,
          recentGrowth: recentIncrease,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Calculate recent memory growth trend
   */
  calculateRecentMemoryGrowth() {
    const measurements = this.memoryLeakDetection.measurements;
    if (measurements.length < 10) return 0;

    const recent = measurements.slice(-10);
    const older = measurements.slice(-20, -10);

    if (older.length === 0) return 0;

    const recentAvg = recent.reduce((sum, m) => sum + m.memory, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.memory, 0) / older.length;

    return recentAvg - olderAvg;
  }

  /**
   * Track connection establishment times
   */
  trackConnectionEstablishment(peerId, startTime, endTime) {
    const establishmentTime = endTime - startTime;
    
    this.connectionEstablishmentTimes.push({
      peerId,
      time: establishmentTime,
      timestamp: endTime
    });

    // Keep only last 50 connection times
    if (this.connectionEstablishmentTimes.length > 50) {
      this.connectionEstablishmentTimes.shift();
    }

    // Update metrics
    this.setMetric('connection_establishment_avg', {
      value: this.connectionEstablishmentTimes.reduce((sum, c) => sum + c.time, 0) / this.connectionEstablishmentTimes.length,
      timestamp: Date.now()
    });
  }

  /**
   * Get enterprise performance report
   */
  getEnterprisePerformanceReport() {
    const report = this.getPerformanceReport();
    
    // Add enterprise-specific metrics
    report.enterprise = {
      connectionEstablishment: {
        average: this.connectionEstablishmentTimes.length > 0 ? 
          this.connectionEstablishmentTimes.reduce((sum, c) => sum + c.time, 0) / this.connectionEstablishmentTimes.length : 0,
        target: this.thresholds.connectionTime,
        compliance: this.connectionEstablishmentTimes.filter(c => c.time <= this.thresholds.connectionTime).length / 
          Math.max(1, this.connectionEstablishmentTimes.length) * 100
      },
      memoryEfficiency: {
        currentUsage: performance.memory ? performance.memory.usedJSHeapSize : 0,
        baseline: this.memoryLeakDetection.baseline,
        growth: performance.memory ? performance.memory.usedJSHeapSize - this.memoryLeakDetection.baseline : 0,
        leakDetected: this.memoryLeakDetection.measurements.some(m => m.increase > this.memoryLeakDetection.alertThreshold)
      },
      qualityAdaptations: {
        total: this.qualityAdaptationHistory.length,
        recent: this.qualityAdaptationHistory.filter(q => Date.now() - q.timestamp < 300000).length, // Last 5 minutes
        effectiveness: this.calculateAdaptationEffectiveness()
      },
      predictions: {
        bandwidth: Array.from(this.metrics.keys()).filter(k => k.includes('predictions_')).map(k => this.metrics.get(k)),
        accuracy: this.calculatePredictionAccuracy()
      }
    };

    return report;
  }

  /**
   * Calculate adaptation effectiveness
   */
  calculateAdaptationEffectiveness() {
    if (this.qualityAdaptationHistory.length === 0) return 0;

    const successful = this.qualityAdaptationHistory.filter(adaptation => {
      // Check if quality improved after adaptation
      return adaptation.success;
    }).length;

    return (successful / this.qualityAdaptationHistory.length) * 100;
  }

  /**
   * Calculate prediction accuracy
   */
  calculatePredictionAccuracy() {
    // Simplified prediction accuracy calculation
    // In a real implementation, this would compare predictions with actual outcomes
    const predictions = Array.from(this.metrics.keys())
      .filter(k => k.includes('predictions_'))
      .map(k => this.metrics.get(k).value);

    if (predictions.length === 0) return 0;

    // Placeholder accuracy calculation
    return 75; // 75% accuracy placeholder
  }

  /**
   * Clear all intervals and cleanup
   */
  clearIntervals() {
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
      this.performanceInterval = null;
    }
  }

  /**
   * Export performance data for analysis
   */
  exportData() {
    return {
      timestamp: Date.now(),
      metrics: this.getAllMetrics(),
      buffer: this.performanceBuffer,
      thresholds: this.thresholds,
      webrtcStats: Object.fromEntries(this.webrtcStats),
      connectionTimes: this.connectionEstablishmentTimes,
      qualityAdaptations: this.qualityAdaptationHistory,
      memoryLeakDetection: this.memoryLeakDetection
    };
  }
}

/**
 * ML-Powered Bandwidth Predictor
 */
class BandwidthPredictor {
  constructor() {
    this.history = new Map(); // peerId -> bandwidth history
    this.models = new Map(); // peerId -> prediction model
  }

  initialize() {
    console.log('🤖 Bandwidth Predictor initialized');
  }

  async predict(peerId, connectionStats) {
    const history = this.history.get(peerId) || [];
    
    // Add current measurement
    const bandwidth = (connectionStats.network.connection?.availableIncomingBitrate || 0) +
                     (connectionStats.network.connection?.availableOutgoingBitrate || 0);
    
    history.push({
      timestamp: Date.now(),
      bandwidth,
      rtt: connectionStats.network.connection?.currentRoundTripTime || 0
    });

    // Keep last 50 measurements
    if (history.length > 50) history.shift();
    this.history.set(peerId, history);

    // Simple trend analysis (moving average)
    if (history.length < 10) {
      return { trend: 'stable', confidence: 0.5, prediction: bandwidth };
    }

    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    
    const recentAvg = recent.reduce((sum, h) => sum + h.bandwidth, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.bandwidth, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    const confidence = Math.min(1, history.length / 50);

    let trend = 'stable';
    if (change > 0.1) trend = 'improving';
    else if (change < -0.1) trend = 'degrading';

    return {
      trend,
      confidence,
      prediction: recentAvg,
      nextBandwidth: this.extrapolateBandwidth(history)
    };
  }

  extrapolateBandwidth(history) {
    if (history.length < 5) return history[history.length - 1]?.bandwidth || 0;

    // Simple linear regression for next data point
    const recent = history.slice(-5);
    const xSum = recent.reduce((sum, _, i) => sum + i, 0);
    const ySum = recent.reduce((sum, h) => sum + h.bandwidth, 0);
    const xySum = recent.reduce((sum, h, i) => sum + (i * h.bandwidth), 0);
    const x2Sum = recent.reduce((sum, _, i) => sum + (i * i), 0);
    const n = recent.length;

    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    return recent[recent.length - 1].bandwidth + slope;
  }
}

/**
 * Quality Adaptation Predictor
 */
class QualityPredictor {
  constructor() {
    this.adaptationHistory = new Map();
  }

  initialize() {
    console.log('🎯 Quality Predictor initialized');
  }

  async predict(peerId, connectionStats) {
    // Analyze current quality indicators
    const qualityFactors = this.analyzeQualityFactors(connectionStats);
    
    // Predict optimal quality level
    const recommendedQuality = this.predictOptimalQuality(qualityFactors);
    
    return {
      recommended: recommendedQuality,
      confidence: qualityFactors.confidence,
      factors: qualityFactors
    };
  }

  getPrediction(peerId, stats) {
    // Simple prediction confidence based on data quality
    const hasGoodData = stats.network.connection && stats.video.inbound;
    return hasGoodData ? 0.8 : 0.3;
  }

  analyzeQualityFactors(stats) {
    const factors = {
      bandwidth: 0,
      latency: 0,
      packetLoss: 0,
      stability: 0,
      confidence: 0
    };

    // Bandwidth factor
    const totalBandwidth = (stats.network.connection?.availableIncomingBitrate || 0) +
                          (stats.network.connection?.availableOutgoingBitrate || 0);
    if (totalBandwidth > 2000000) factors.bandwidth = 1.0;
    else if (totalBandwidth > 1000000) factors.bandwidth = 0.7;
    else if (totalBandwidth > 500000) factors.bandwidth = 0.4;
    else factors.bandwidth = 0.1;

    // Latency factor
    const rtt = stats.network.connection?.currentRoundTripTime || 1000;
    if (rtt < 50) factors.latency = 1.0;
    else if (rtt < 100) factors.latency = 0.8;
    else if (rtt < 200) factors.latency = 0.5;
    else factors.latency = 0.2;

    // Packet loss factor
    const packetsLost = stats.video.inbound?.packetsLost || 0;
    const packetsReceived = stats.video.inbound?.packetsReceived || 1;
    const lossRate = packetsLost / (packetsLost + packetsReceived);
    
    if (lossRate < 0.01) factors.packetLoss = 1.0;
    else if (lossRate < 0.03) factors.packetLoss = 0.7;
    else if (lossRate < 0.05) factors.packetLoss = 0.4;
    else factors.packetLoss = 0.1;

    // Overall confidence
    factors.confidence = (factors.bandwidth + factors.latency + factors.packetLoss) / 3;

    return factors;
  }

  predictOptimalQuality(factors) {
    const score = factors.confidence;
    
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }
}

/**
 * Connection Stability Predictor
 */
class ConnectionPredictor {
  constructor() {
    this.connectionHistory = new Map();
  }

  initialize() {
    console.log('🔗 Connection Predictor initialized');
  }

  async predict(peerId, connectionStats) {
    const history = this.connectionHistory.get(peerId) || [];
    
    // Add current connection state
    history.push({
      timestamp: Date.now(),
      rtt: connectionStats.network.connection?.currentRoundTripTime || 0,
      packetLoss: this.calculatePacketLoss(connectionStats),
      bandwidth: (connectionStats.network.connection?.availableIncomingBitrate || 0) +
                (connectionStats.network.connection?.availableOutgoingBitrate || 0)
    });

    // Keep last 30 measurements
    if (history.length > 30) history.shift();
    this.connectionHistory.set(peerId, history);

    // Analyze stability
    const stability = this.analyzeStability(history);
    
    return {
      risk: stability.risk,
      confidence: stability.confidence,
      factors: stability.factors
    };
  }

  calculatePacketLoss(stats) {
    const packetsLost = stats.video.inbound?.packetsLost || 0;
    const packetsReceived = stats.video.inbound?.packetsReceived || 1;
    return packetsLost / (packetsLost + packetsReceived);
  }

  analyzeStability(history) {
    if (history.length < 5) {
      return { risk: 'unknown', confidence: 0.2, factors: [] };
    }

    const factors = [];
    let riskScore = 0;

    // RTT variance analysis
    const rtts = history.map(h => h.rtt);
    const rttVariance = this.calculateVariance(rtts);
    if (rttVariance > 100) { // High RTT variance
      riskScore += 30;
      factors.push('High latency variance');
    }

    // Bandwidth trend analysis
    const bandwidths = history.map(h => h.bandwidth);
    const bandwidthTrend = this.calculateTrend(bandwidths);
    if (bandwidthTrend < -0.2) { // Decreasing bandwidth
      riskScore += 25;
      factors.push('Decreasing bandwidth trend');
    }

    // Packet loss trend
    const packetLosses = history.map(h => h.packetLoss);
    const avgPacketLoss = packetLosses.reduce((sum, loss) => sum + loss, 0) / packetLosses.length;
    if (avgPacketLoss > 0.03) {
      riskScore += 20;
      factors.push('High packet loss rate');
    }

    // Connection age (newer connections are less stable)
    if (history.length < 10) {
      riskScore += 15;
      factors.push('New connection');
    }

    let risk = 'low';
    if (riskScore >= 50) risk = 'high';
    else if (riskScore >= 30) risk = 'medium';

    return {
      risk,
      confidence: Math.min(1, history.length / 30),
      factors,
      score: riskScore
    };
  }

  calculateVariance(values) {
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  calculateTrend(values) {
    if (values.length < 3) return 0;
    
    const recent = values.slice(-3);
    const older = values.slice(-6, -3);
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    return (recentAvg - olderAvg) / olderAvg;
  }
}

/**
 * Performance Regression Detector
 */
class PerformanceRegressionDetector {
  constructor() {
    this.baselines = new Map(); // peerId -> baseline metrics
    this.regressionThreshold = 0.2; // 20% performance degradation threshold
  }

  initialize() {
    console.log('📉 Regression Detector initialized');
  }

  detect(peerId, currentStats) {
    const baseline = this.baselines.get(peerId);
    const regressions = [];

    if (!baseline) {
      // Establish baseline
      this.setBaseline(peerId, currentStats);
      return regressions;
    }

    // Check for regressions
    const currentMetrics = this.extractMetrics(currentStats);
    const baselineMetrics = baseline.metrics;

    // RTT regression
    if (currentMetrics.rtt > baselineMetrics.rtt * (1 + this.regressionThreshold)) {
      regressions.push({
        type: 'latency_regression',
        severity: 'warning',
        message: `Latency increased by ${((currentMetrics.rtt / baselineMetrics.rtt - 1) * 100).toFixed(1)}%`,
        current: currentMetrics.rtt,
        baseline: baselineMetrics.rtt
      });
    }

    // Bandwidth regression
    if (currentMetrics.bandwidth < baselineMetrics.bandwidth * (1 - this.regressionThreshold)) {
      regressions.push({
        type: 'bandwidth_regression',
        severity: 'warning',
        message: `Bandwidth decreased by ${((1 - currentMetrics.bandwidth / baselineMetrics.bandwidth) * 100).toFixed(1)}%`,
        current: currentMetrics.bandwidth,
        baseline: baselineMetrics.bandwidth
      });
    }

    // Frame rate regression
    if (currentMetrics.frameRate < baselineMetrics.frameRate * (1 - this.regressionThreshold)) {
      regressions.push({
        type: 'framerate_regression',
        severity: 'warning',
        message: `Frame rate decreased by ${((1 - currentMetrics.frameRate / baselineMetrics.frameRate) * 100).toFixed(1)}%`,
        current: currentMetrics.frameRate,
        baseline: baselineMetrics.frameRate
      });
    }

    // Update baseline if connection has been stable
    if (regressions.length === 0 && Date.now() - baseline.timestamp > 60000) { // 1 minute
      this.setBaseline(peerId, currentStats);
    }

    return regressions;
  }

  setBaseline(peerId, stats) {
    this.baselines.set(peerId, {
      timestamp: Date.now(),
      metrics: this.extractMetrics(stats)
    });
  }

  extractMetrics(stats) {
    return {
      rtt: stats.network.connection?.currentRoundTripTime || 0,
      bandwidth: (stats.network.connection?.availableIncomingBitrate || 0) +
                (stats.network.connection?.availableOutgoingBitrate || 0),
      frameRate: stats.video.inbound?.framesPerSecond || 0,
      packetLoss: this.calculatePacketLoss(stats)
    };
  }

  calculatePacketLoss(stats) {
    const packetsLost = stats.video.inbound?.packetsLost || 0;
    const packetsReceived = stats.video.inbound?.packetsReceived || 1;
    return packetsLost / (packetsLost + packetsReceived);
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;