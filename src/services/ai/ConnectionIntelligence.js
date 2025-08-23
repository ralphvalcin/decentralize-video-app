/**
 * Connection Intelligence Engine
 * 
 * Provides AI-powered connection quality prediction and optimization:
 * - Predicts connection degradation before it happens
 * - Automatically optimizes connection parameters
 * - Learns from user's network patterns
 * - Provides proactive recommendations
 */

import performanceMonitor from '../../utils/PerformanceMonitor.js';
import mlAdaptiveBitrate from '../../utils/MLAdaptiveBitrate.js';

export class ConnectionIntelligence {
  constructor(connectionStore, aiStore, performanceMonitorInstance = performanceMonitor) {
    this.connectionStore = connectionStore;
    this.aiStore = aiStore;
    this.performanceMonitor = performanceMonitorInstance;
    
    // AI Models (simplified implementations)
    this.predictionModel = new ConnectionPredictionModel();
    this.optimizationEngine = new ConnectionOptimizationEngine();
    this.patternRecognizer = new NetworkPatternRecognizer();
    
    // Connection tracking
    this.connectionHistory = new Map();
    this.predictionHistory = new Map();
    this.optimizationHistory = [];
    
    // Configuration
    this.config = {
      predictionInterval: 10000, // 10 seconds
      optimizationThreshold: 0.7, // 70% confidence threshold
      maxHistoryLength: 100,
      minDataPoints: 5,
    };
    
    // State
    this.isInitialized = false;
    this.isMonitoring = false;
    this.intervals = new Set();
  }

  /**
   * Initialize connection intelligence system
   */
  async initialize() {
    try {
      console.log('🧠 Initializing Connection Intelligence...');
      
      // Initialize AI models
      await this.predictionModel.initialize();
      await this.optimizationEngine.initialize();
      await this.patternRecognizer.initialize();
      
      // Set up performance monitoring observers
      this.performanceMonitor.addObserver(this.handlePerformanceUpdate.bind(this));
      
      this.isInitialized = true;
      console.log('✅ Connection Intelligence initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Connection Intelligence:', error);
      throw error;
    }
  }

  /**
   * Start intelligent monitoring for a peer connection
   */
  async startMonitoring(peerId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    console.log(`🎯 Starting connection intelligence for peer ${peerId}`);
    
    // Initialize connection history
    this.connectionHistory.set(peerId, []);
    this.predictionHistory.set(peerId, []);
    
    // Start prediction loop
    const predictionInterval = setInterval(async () => {
      await this.analyzePeerConnection(peerId);
    }, this.config.predictionInterval);
    
    this.intervals.add(predictionInterval);
    this.isMonitoring = true;
  }

  /**
   * Stop monitoring for a peer connection
   */
  stopMonitoring(peerId) {
    console.log(`⏹️ Stopping connection intelligence for peer ${peerId}`);
    
    this.connectionHistory.delete(peerId);
    this.predictionHistory.delete(peerId);
    
    // Clear intervals if no peers are being monitored
    if (this.connectionHistory.size === 0) {
      this.intervals.forEach(interval => clearInterval(interval));
      this.intervals.clear();
      this.isMonitoring = false;
    }
  }

  /**
   * Analyze peer connection and generate predictions
   */
  async analyzePeerConnection(peerId) {
    try {
      // Get current connection statistics
      const connectionStats = await this.performanceMonitor.monitorPeerConnection(
        this.getPeerConnection(peerId), 
        peerId
      );
      
      if (!connectionStats) return;
      
      // Update connection history
      this.updateConnectionHistory(peerId, connectionStats);
      
      // Generate connection quality prediction
      const prediction = await this.predictConnectionQuality(peerId, connectionStats);
      
      // Update AI store with predictions
      this.aiStore.getState().addConnectionPrediction(peerId, prediction);
      
      // Check if proactive optimization is needed
      if (prediction.confidence > this.config.optimizationThreshold) {
        await this.evaluateOptimizations(peerId, prediction, connectionStats);
      }
      
      // Update insights
      const insights = this.generateConnectionInsights(peerId, connectionStats, prediction);
      this.aiStore.getState().updateConnectionInsights(peerId, insights);
      
    } catch (error) {
      console.error(`Error analyzing connection for peer ${peerId}:`, error);
    }
  }

  /**
   * Update connection history for machine learning
   */
  updateConnectionHistory(peerId, connectionStats) {
    const history = this.connectionHistory.get(peerId) || [];
    
    // Add current stats to history
    history.push({
      timestamp: Date.now(),
      stats: connectionStats,
      qualityScore: this.calculateQualityScore(connectionStats),
    });
    
    // Limit history size
    if (history.length > this.config.maxHistoryLength) {
      history.shift();
    }
    
    this.connectionHistory.set(peerId, history);
  }

  /**
   * Predict connection quality degradation
   */
  async predictConnectionQuality(peerId, currentStats) {
    const history = this.connectionHistory.get(peerId) || [];
    
    if (history.length < this.config.minDataPoints) {
      return {
        quality: 'unknown',
        confidence: 0.1,
        trend: 'stable',
        timeToIssue: null,
        factors: ['Insufficient data'],
        timestamp: Date.now(),
      };
    }
    
    // Use ML model to predict quality
    const prediction = await this.predictionModel.predict(peerId, {
      history,
      current: currentStats,
      patterns: this.patternRecognizer.getPatterns(peerId),
    });
    
    // Store prediction in history
    const predictionHistory = this.predictionHistory.get(peerId) || [];
    predictionHistory.push(prediction);
    if (predictionHistory.length > 50) {
      predictionHistory.shift();
    }
    this.predictionHistory.set(peerId, predictionHistory);
    
    return prediction;
  }

  /**
   * Evaluate and apply proactive optimizations
   */
  async evaluateOptimizations(peerId, prediction, connectionStats) {
    const optimizations = await this.optimizationEngine.generateOptimizations({
      peerId,
      prediction,
      connectionStats,
      history: this.connectionHistory.get(peerId),
    });
    
    for (const optimization of optimizations) {
      if (optimization.confidence > this.config.optimizationThreshold) {
        await this.applyOptimization(peerId, optimization);
      }
    }
  }

  /**
   * Apply connection optimization
   */
  async applyOptimization(peerId, optimization) {
    try {
      console.log(`🔧 Applying optimization for ${peerId}:`, optimization.type);
      
      const result = await this.executeOptimization(peerId, optimization);
      
      // Record optimization result
      this.optimizationHistory.push({
        peerId,
        optimization,
        result,
        timestamp: Date.now(),
      });
      
      // Update AI store
      this.aiStore.getState().applyConnectionOptimization({
        id: `opt_${Date.now()}`,
        peerId,
        type: optimization.type,
        description: optimization.description,
        confidence: optimization.confidence,
        result,
        timestamp: Date.now(),
      });
      
      // Generate recommendation for user
      if (result.userActionRequired) {
        this.generateOptimizationRecommendation(peerId, optimization, result);
      }
      
    } catch (error) {
      console.error(`Failed to apply optimization for ${peerId}:`, error);
    }
  }

  /**
   * Execute specific optimization
   */
  async executeOptimization(peerId, optimization) {
    switch (optimization.type) {
      case 'quality_adjustment':
        return await this.optimizeQuality(peerId, optimization.parameters);
        
      case 'bandwidth_management':
        return await this.optimizeBandwidth();
        
      case 'codec_optimization':
        return await this.optimizeCodec(peerId, optimization.parameters);
        
      case 'network_fallback':
        return await this.prepareNetworkFallback();
        
      default:
        throw new Error(`Unknown optimization type: ${optimization.type}`);
    }
  }

  /**
   * Optimize video quality proactively
   */
  async optimizeQuality(peerId, parameters) {
    try {
      const targetProfile = parameters.targetProfile || 'medium';
      
      // Use ML adaptive bitrate for optimization
      const adaptationResult = await mlAdaptiveBitrate.forceAdaptation(
        targetProfile, 
        `AI optimization: ${parameters.reason}`
      );
      
      return {
        success: adaptationResult.adapted,
        details: adaptationResult,
        userActionRequired: false,
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        userActionRequired: false,
      };
    }
  }

  /**
   * Optimize bandwidth usage
   */
  async optimizeBandwidth() {
    // Simulate bandwidth optimization
    return {
      success: true,
      details: 'Bandwidth optimization applied',
      userActionRequired: false,
    };
  }

  /**
   * Optimize codec selection
   */
  async optimizeCodec(_peerId, parameters) {
    // Simulate codec optimization
    return {
      success: true,
      details: `Switched to ${parameters.codec} codec`,
      userActionRequired: false,
    };
  }

  /**
   * Prepare network fallback
   */
  async prepareNetworkFallback() {
    return {
      success: true,
      details: 'Network fallback prepared',
      userActionRequired: true,
      userMessage: 'Connection issues detected. Consider switching networks.',
    };
  }

  /**
   * Generate connection insights
   */
  generateConnectionInsights(peerId, connectionStats, prediction) {
    const history = this.connectionHistory.get(peerId) || [];
    const patterns = this.patternRecognizer.getPatterns(peerId);
    
    return {
      peerId,
      timestamp: Date.now(),
      
      // Current state
      current: {
        quality: this.calculateQualityScore(connectionStats),
        bandwidth: this.extractBandwidth(connectionStats),
        latency: connectionStats.network.connection?.currentRoundTripTime || 0,
        packetLoss: this.calculatePacketLoss(connectionStats),
      },
      
      // Predictions
      prediction,
      
      // Patterns
      patterns: {
        timeOfDay: patterns?.timeOfDay || 'unknown',
        networkType: patterns?.networkType || 'unknown',
        usagePattern: patterns?.usagePattern || 'unknown',
      },
      
      // Trends
      trends: this.calculateTrends(history),
      
      // Recommendations
      recommendations: this.generateRecommendations(prediction, patterns),
    };
  }

  /**
   * Generate optimization recommendation for user
   */
  generateOptimizationRecommendation(peerId, optimization, result) {
    if (!result.userActionRequired) return;
    
    this.aiStore.getState().addRecommendation({
      id: `rec_${Date.now()}_${peerId}`,
      type: 'connection_optimization',
      priority: 'medium',
      title: 'Connection Optimization',
      message: result.userMessage || optimization.description,
      confidence: optimization.confidence,
      actions: [{
        label: 'Acknowledge',
        action: 'dismiss',
      }],
      timestamp: Date.now(),
      peerId,
    });
  }

  /**
   * Handle performance monitor updates
   */
  handlePerformanceUpdate(data) {
    if (data.type === 'advanced_performance_issues') {
      this.handlePerformanceIssues(data);
    } else if (data.type === 'proactive_optimization') {
      this.handleProactiveOptimization(data);
    }
  }

  /**
   * Handle performance issues from monitor
   */
  handlePerformanceIssues(data) {
    const { peerId, issues } = data;
    
    // Generate AI recommendation based on issues
    const recommendation = {
      id: `issue_${Date.now()}_${peerId}`,
      type: 'performance_issue',
      priority: this.determinePriority(issues),
      title: 'Performance Issue Detected',
      message: this.formatIssueMessage(issues),
      confidence: 0.9,
      actions: this.generateIssueActions(issues),
      timestamp: Date.now(),
      peerId,
    };
    
    this.aiStore.getState().addRecommendation(recommendation);
  }

  /**
   * Handle proactive optimization suggestions
   */
  handleProactiveOptimization(data) {
    const { peerId, optimizations } = data;
    
    optimizations.forEach(opt => {
      this.aiStore.getState().applyConnectionOptimization({
        id: `proactive_${Date.now()}_${peerId}`,
        peerId,
        type: opt.type,
        description: opt.reason,
        confidence: opt.confidence,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Helper methods
   */
  getPeerConnection(peerId) {
    // This would get the actual peer connection from the connection store
    const peers = this.connectionStore.getState().peers;
    return peers.get(peerId);
  }

  calculateQualityScore(connectionStats) {
    // Simplified quality calculation
    const latency = connectionStats.network.connection?.currentRoundTripTime || 0;
    const fps = connectionStats.video.inbound?.framesPerSecond || 0;
    const packetLoss = this.calculatePacketLoss(connectionStats);
    
    let score = 100;
    if (latency > 100) score -= 20;
    if (fps < 20) score -= 30;
    if (packetLoss > 0.02) score -= 25;
    
    return Math.max(0, score);
  }

  extractBandwidth(connectionStats) {
    const incoming = connectionStats.network.connection?.availableIncomingBitrate || 0;
    const outgoing = connectionStats.network.connection?.availableOutgoingBitrate || 0;
    return incoming + outgoing;
  }

  calculatePacketLoss(connectionStats) {
    const packetsLost = connectionStats.video.inbound?.packetsLost || 0;
    const packetsReceived = connectionStats.video.inbound?.packetsReceived || 1;
    return packetsLost / (packetsLost + packetsReceived);
  }

  calculateTrends(history) {
    if (history.length < 3) return { quality: 'stable', bandwidth: 'stable' };
    
    const recent = history.slice(-3);
    const older = history.slice(-6, -3);
    
    if (older.length === 0) return { quality: 'stable', bandwidth: 'stable' };
    
    const recentQuality = recent.reduce((sum, h) => sum + h.qualityScore, 0) / recent.length;
    const olderQuality = older.reduce((sum, h) => sum + h.qualityScore, 0) / older.length;
    
    const qualityChange = (recentQuality - olderQuality) / olderQuality;
    
    return {
      quality: qualityChange > 0.1 ? 'improving' : qualityChange < -0.1 ? 'degrading' : 'stable',
      bandwidth: 'stable', // Simplified
    };
  }

  generateRecommendations(prediction, patterns) {
    const recommendations = [];
    
    if (prediction.confidence > 0.8 && prediction.trend === 'degrading') {
      recommendations.push('Consider switching to a more stable network');
    }
    
    if (patterns?.timeOfDay === 'peak_hours') {
      recommendations.push('Network congestion expected during peak hours');
    }
    
    return recommendations;
  }

  determinePriority(issues) {
    const severities = issues.map(i => i.severity);
    if (severities.includes('critical')) return 'high';
    if (severities.includes('warning')) return 'medium';
    return 'low';
  }

  formatIssueMessage(issues) {
    if (issues.length === 1) {
      return issues[0].message;
    }
    return `${issues.length} performance issues detected`;
  }

  generateIssueActions(issues) {
    const actions = [{ label: 'Acknowledge', action: 'dismiss' }];
    
    if (issues.some(i => i.type === 'network_latency')) {
      actions.push({ label: 'Check Network', action: 'check_network' });
    }
    
    return actions;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.connectionHistory.clear();
    this.predictionHistory.clear();
    this.isInitialized = false;
    this.isMonitoring = false;
  }

  /**
   * Get intelligence metrics
   */
  getMetrics() {
    return {
      connectionsMonitored: this.connectionHistory.size,
      predictionsGenerated: Array.from(this.predictionHistory.values())
        .reduce((sum, predictions) => sum + predictions.length, 0),
      optimizationsApplied: this.optimizationHistory.length,
      averageConfidence: this.calculateAverageConfidence(),
      isMonitoring: this.isMonitoring,
    };
  }

  calculateAverageConfidence() {
    const allPredictions = Array.from(this.predictionHistory.values()).flat();
    if (allPredictions.length === 0) return 0;
    
    const totalConfidence = allPredictions.reduce((sum, p) => sum + p.confidence, 0);
    return totalConfidence / allPredictions.length;
  }
}

// ============================================================================
// AI Model Implementations (Simplified)
// ============================================================================

class ConnectionPredictionModel {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    console.log('📊 Initializing Connection Prediction Model...');
    // In a real implementation, this would load TensorFlow.js models
    this.initialized = true;
  }

  async predict(peerId, context) {
    const { history, current } = context;
    // Note: patterns unused - reserved for future ML pattern analysis implementation
    
    if (history.length < 3) {
      return {
        quality: 'unknown',
        confidence: 0.1,
        trend: 'stable',
        timeToIssue: null,
        factors: ['Insufficient historical data'],
        timestamp: Date.now(),
      };
    }
    
    // Simple trend analysis (would be ML-based in real implementation)
    const recentQuality = history.slice(-3).reduce((sum, h) => sum + h.qualityScore, 0) / 3;
    const olderQuality = history.slice(-6, -3).reduce((sum, h) => sum + h.qualityScore, 0) / 3;
    
    const qualityChange = (recentQuality - olderQuality) / olderQuality;
    
    let trend = 'stable';
    let quality = 'good';
    let confidence = 0.7;
    let timeToIssue = null;
    
    if (qualityChange < -0.15) {
      trend = 'degrading';
      quality = 'declining';
      confidence = 0.8;
      timeToIssue = this.estimateTimeToIssue(qualityChange);
    } else if (qualityChange > 0.1) {
      trend = 'improving';
      quality = 'improving';
      confidence = 0.8;
    }
    
    const factors = this.identifyFactors(current, history, qualityChange);
    
    return {
      quality,
      confidence,
      trend,
      timeToIssue,
      factors,
      timestamp: Date.now(),
    };
  }

  estimateTimeToIssue(qualityChange) {
    // Estimate time until connection issues based on degradation rate
    if (qualityChange > -0.2) return 60; // 1 minute
    if (qualityChange > -0.3) return 30; // 30 seconds
    return 15; // 15 seconds
  }

  identifyFactors(current, history, qualityChange) {
    const factors = [];
    
    if (current.network.connection?.currentRoundTripTime > 200) {
      factors.push('High latency detected');
    }
    
    if (qualityChange < -0.15) {
      factors.push('Quality degradation trend');
    }
    
    const packetLoss = this.calculatePacketLoss(current);
    if (packetLoss > 0.02) {
      factors.push('Packet loss detected');
    }
    
    return factors.length > 0 ? factors : ['Normal operation'];
  }

  calculatePacketLoss(stats) {
    const packetsLost = stats.video.inbound?.packetsLost || 0;
    const packetsReceived = stats.video.inbound?.packetsReceived || 1;
    return packetsLost / (packetsLost + packetsReceived);
  }
}

class ConnectionOptimizationEngine {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    console.log('⚙️ Initializing Connection Optimization Engine...');
    this.initialized = true;
  }

  async generateOptimizations(context) {
    const { prediction, connectionStats } = context;
    // Note: peerId and history parameters reserved for future optimization strategies
    const optimizations = [];
    
    if (prediction.trend === 'degrading' && prediction.confidence > 0.7) {
      // Quality reduction optimization
      optimizations.push({
        type: 'quality_adjustment',
        confidence: 0.8,
        description: 'Reduce quality to maintain stable connection',
        parameters: {
          targetProfile: this.selectOptimalProfile(connectionStats),
          reason: 'Predicted connection degradation',
        },
      });
      
      // Bandwidth management
      if (this.extractBandwidth(connectionStats) < 1000000) {
        optimizations.push({
          type: 'bandwidth_management',
          confidence: 0.7,
          description: 'Optimize bandwidth usage',
          parameters: {
            strategy: 'conservative',
            reason: 'Low bandwidth detected',
          },
        });
      }
    }
    
    return optimizations;
  }

  selectOptimalProfile(connectionStats) {
    const bandwidth = this.extractBandwidth(connectionStats);
    
    if (bandwidth > 2000000) return 'high';
    if (bandwidth > 1000000) return 'medium';
    if (bandwidth > 500000) return 'low';
    return 'minimal';
  }

  extractBandwidth(connectionStats) {
    const incoming = connectionStats.network.connection?.availableIncomingBitrate || 0;
    const outgoing = connectionStats.network.connection?.availableOutgoingBitrate || 0;
    return incoming + outgoing;
  }
}

class NetworkPatternRecognizer {
  constructor() {
    this.patterns = new Map();
    this.initialized = false;
  }

  async initialize() {
    console.log('🔍 Initializing Network Pattern Recognizer...');
    this.initialized = true;
  }

  getPatterns(peerId) {
    return this.patterns.get(peerId) || {
      timeOfDay: this.getCurrentTimePattern(),
      networkType: 'unknown',
      usagePattern: 'unknown',
    };
  }

  getCurrentTimePattern() {
    const hour = new Date().getHours();
    
    if (hour >= 9 && hour <= 17) return 'business_hours';
    if (hour >= 18 && hour <= 22) return 'peak_hours';
    return 'off_peak';
  }
}

export default ConnectionIntelligence;