/**
 * Intelligent Peer Selection and Connection Optimizer
 * 
 * This module provides:
 * - Optimal peer selection algorithms
 * - Connection quality scoring
 * - Network topology optimization
 * - Connection redundancy management
 */

class PeerOptimizer {
  constructor() {
    this.peerConnections = new Map();
    this.connectionMetrics = new Map();
    this.selectionStrategies = new Map();
    this.topology = {
      maxConnections: 8,
      optimalConnections: 4,
      redundancyLevel: 2
    };

    // Initialize selection strategies
    this.initializeStrategies();

    // Connection quality weights
    this.qualityWeights = {
      latency: 0.3,        // 30% weight for RTT
      bandwidth: 0.25,     // 25% weight for available bandwidth
      packetLoss: 0.2,     // 20% weight for packet loss
      stability: 0.15,     // 15% weight for connection stability
      cpu: 0.1            // 10% weight for CPU usage
    };

    this.observers = new Set();
  }

  /**
   * Initialize peer selection strategies
   */
  initializeStrategies() {
    // Strategy 1: Quality-based selection
    this.selectionStrategies.set('quality', {
      name: 'Quality-based',
      description: 'Select peers with highest connection quality',
      selector: this.selectByQuality.bind(this)
    });

    // Strategy 2: Geographic proximity
    this.selectionStrategies.set('proximity', {
      name: 'Geographic proximity',
      description: 'Select peers with lowest latency',
      selector: this.selectByProximity.bind(this)
    });

    // Strategy 3: Hybrid approach
    this.selectionStrategies.set('hybrid', {
      name: 'Hybrid optimization',
      description: 'Balance quality, proximity, and load distribution',
      selector: this.selectByHybrid.bind(this)
    });

    // Strategy 4: Load balancing
    this.selectionStrategies.set('loadbalance', {
      name: 'Load balancing',
      description: 'Distribute connections evenly across peers',
      selector: this.selectByLoadBalance.bind(this)
    });
  }

  /**
   * Add observer for optimization events
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
   * Notify observers
   */
  notifyObservers(data) {
    this.observers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Peer optimizer observer error:', error);
      }
    });
  }

  /**
   * Register a peer connection for monitoring
   */
  registerPeer(peerId, peerConnection, metadata = {}) {
    this.peerConnections.set(peerId, {
      connection: peerConnection,
      metadata: {
        joinedAt: Date.now(),
        userAgent: metadata.userAgent || '',
        location: metadata.location || null,
        capabilities: metadata.capabilities || {},
        ...metadata
      },
      stats: {
        connectionTime: null,
        lastUpdate: Date.now(),
        isStable: false,
        qualityScore: 0
      }
    });

    this.connectionMetrics.set(peerId, {
      history: [],
      averages: {},
      trends: {}
    });

    console.log(`📊 Registered peer ${peerId} for optimization`);
  }

  /**
   * Unregister a peer connection
   */
  unregisterPeer(peerId) {
    this.peerConnections.delete(peerId);
    this.connectionMetrics.delete(peerId);
    console.log(`📊 Unregistered peer ${peerId}`);
  }

  /**
   * Update peer connection metrics
   */
  updatePeerMetrics(peerId, metrics) {
    const peerData = this.peerConnections.get(peerId);
    const metricsData = this.connectionMetrics.get(peerId);
    
    if (!peerData || !metricsData) return;

    // Add to history
    const timestamp = Date.now();
    const entry = {
      timestamp,
      ...metrics
    };

    metricsData.history.push(entry);
    
    // Keep only last 100 entries
    if (metricsData.history.length > 100) {
      metricsData.history.shift();
    }

    // Calculate averages and trends
    this.calculateMetricTrends(peerId);
    
    // Update quality score
    const qualityScore = this.calculatePeerQualityScore(peerId);
    peerData.stats.qualityScore = qualityScore;
    peerData.stats.lastUpdate = timestamp;

    // Check connection stability
    this.assessConnectionStability(peerId);
  }

  /**
   * Calculate metric trends for a peer
   */
  calculateMetricTrends(peerId) {
    const metricsData = this.connectionMetrics.get(peerId);
    if (!metricsData || metricsData.history.length < 2) return;

    const recent = metricsData.history.slice(-10); // Last 10 entries
    const older = metricsData.history.slice(-20, -10); // Previous 10 entries

    // Calculate averages
    metricsData.averages = {
      latency: this.average(recent.map(e => e.rtt || 0)),
      bandwidth: this.average(recent.map(e => e.bandwidth || 0)),
      packetLoss: this.average(recent.map(e => e.packetLoss || 0)),
      frameRate: this.average(recent.map(e => e.frameRate || 0))
    };

    // Calculate trends (improving/degrading)
    if (older.length >= 5) {
      const olderAvg = {
        latency: this.average(older.map(e => e.rtt || 0)),
        bandwidth: this.average(older.map(e => e.bandwidth || 0)),
        packetLoss: this.average(older.map(e => e.packetLoss || 0))
      };

      metricsData.trends = {
        latency: this.getTrend(olderAvg.latency, metricsData.averages.latency, false),
        bandwidth: this.getTrend(olderAvg.bandwidth, metricsData.averages.bandwidth, true),
        packetLoss: this.getTrend(olderAvg.packetLoss, metricsData.averages.packetLoss, false)
      };
    }
  }

  /**
   * Calculate average of array
   */
  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  /**
   * Get trend direction (improving/stable/degrading)
   */
  getTrend(oldValue, newValue, higherIsBetter) {
    if (oldValue === 0) return 'stable';
    
    const change = ((newValue - oldValue) / oldValue) * 100;
    const threshold = 10; // 10% change threshold

    if (Math.abs(change) < threshold) return 'stable';
    
    if (higherIsBetter) {
      return change > 0 ? 'improving' : 'degrading';
    } else {
      return change < 0 ? 'improving' : 'degrading';
    }
  }

  /**
   * Calculate quality score for a peer
   */
  calculatePeerQualityScore(peerId) {
    const metricsData = this.connectionMetrics.get(peerId);
    if (!metricsData || metricsData.averages.length === 0) return 0;

    const { averages } = metricsData;
    let score = 100;

    // Latency score (lower is better)
    if (averages.latency > 0) {
      const latencyScore = Math.max(0, 100 - (averages.latency / 10)); // 10ms = 1 point deduction
      score = score * (this.qualityWeights.latency) + latencyScore * (1 - this.qualityWeights.latency);
    }

    // Bandwidth score (higher is better)
    if (averages.bandwidth > 0) {
      const bandwidthScore = Math.min(100, (averages.bandwidth / 1000000) * 20); // 1Mbps = 20 points
      score = score * (1 - this.qualityWeights.bandwidth) + bandwidthScore * this.qualityWeights.bandwidth;
    }

    // Packet loss score (lower is better)
    if (averages.packetLoss !== undefined) {
      const packetLossScore = Math.max(0, 100 - (averages.packetLoss * 1000)); // 0.1% = 100 points deduction
      score = score * (1 - this.qualityWeights.packetLoss) + packetLossScore * this.qualityWeights.packetLoss;
    }

    // Stability bonus
    const peerData = this.peerConnections.get(peerId);
    if (peerData?.stats.isStable) {
      score += 10; // 10 point stability bonus
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Assess connection stability
   */
  assessConnectionStability(peerId) {
    const peerData = this.peerConnections.get(peerId);
    const metricsData = this.connectionMetrics.get(peerId);
    
    if (!peerData || !metricsData) return;

    // Consider stable if:
    // 1. Connection exists for > 30 seconds
    // 2. Has consistent metrics for last 10 measurements
    // 3. No recent disconnections

    const connectionAge = Date.now() - peerData.metadata.joinedAt;
    const hasEnoughHistory = metricsData.history.length >= 10;
    
    if (connectionAge > 30000 && hasEnoughHistory) {
      const recent = metricsData.history.slice(-10);
      const latencyVariance = this.calculateVariance(recent.map(e => e.rtt || 0));
      const isStable = latencyVariance < 50; // Less than 50ms variance
      
      peerData.stats.isStable = isStable;
    }
  }

  /**
   * Calculate variance
   */
  calculateVariance(arr) {
    const avg = this.average(arr);
    const squaredDiffs = arr.map(value => Math.pow(value - avg, 2));
    return this.average(squaredDiffs);
  }

  /**
   * Select optimal peers using quality-based strategy
   */
  selectByQuality(availablePeers, maxConnections) {
    return availablePeers
      .map(peerId => ({
        peerId,
        score: this.calculatePeerQualityScore(peerId)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxConnections)
      .map(peer => peer.peerId);
  }

  /**
   * Select optimal peers using proximity-based strategy
   */
  selectByProximity(availablePeers, maxConnections) {
    return availablePeers
      .map(peerId => {
        const metricsData = this.connectionMetrics.get(peerId);
        const latency = metricsData?.averages?.latency || Infinity;
        return { peerId, latency };
      })
      .sort((a, b) => a.latency - b.latency)
      .slice(0, maxConnections)
      .map(peer => peer.peerId);
  }

  /**
   * Select optimal peers using hybrid strategy
   */
  selectByHybrid(availablePeers, maxConnections) {
    return availablePeers
      .map(peerId => {
        const qualityScore = this.calculatePeerQualityScore(peerId);
        const metricsData = this.connectionMetrics.get(peerId);
        const latency = metricsData?.averages?.latency || 1000;
        
        // Hybrid score: 70% quality, 30% proximity
        const proximityScore = Math.max(0, 100 - (latency / 10));
        const hybridScore = (qualityScore * 0.7) + (proximityScore * 0.3);
        
        return { peerId, score: hybridScore };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxConnections)
      .map(peer => peer.peerId);
  }

  /**
   * Select optimal peers using load balancing strategy
   */
  selectByLoadBalance(availablePeers, maxConnections) {
    // Evenly distribute connections
    const shuffled = [...availablePeers].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, maxConnections);
  }

  /**
   * Get optimal peer selection
   */
  getOptimalPeers(availablePeers, strategy = 'hybrid', maxConnections = null) {
    const connectionLimit = maxConnections || this.topology.optimalConnections;
    
    if (availablePeers.length <= connectionLimit) {
      return availablePeers;
    }

    const strategyConfig = this.selectionStrategies.get(strategy);
    if (!strategyConfig) {
      console.warn(`Unknown strategy: ${strategy}, falling back to hybrid`);
      return this.selectByHybrid(availablePeers, connectionLimit);
    }

    const selectedPeers = strategyConfig.selector(availablePeers, connectionLimit);
    
    // Notify observers
    this.notifyObservers({
      type: 'peer_selection',
      strategy,
      available: availablePeers.length,
      selected: selectedPeers.length,
      peers: selectedPeers,
      timestamp: Date.now()
    });

    return selectedPeers;
  }

  /**
   * Optimize existing connections
   */
  optimizeConnections() {
    const connectedPeers = Array.from(this.peerConnections.keys());
    const poorConnections = [];
    const goodConnections = [];

    connectedPeers.forEach(peerId => {
      const peer = this.peerConnections.get(peerId);
      if (peer.stats.qualityScore < 40) {
        poorConnections.push(peerId);
      } else {
        goodConnections.push(peerId);
      }
    });

    const optimizations = [];

    // Suggest dropping poor connections if we have enough good ones
    if (poorConnections.length > 0 && goodConnections.length >= 2) {
      optimizations.push({
        type: 'drop_connection',
        peers: poorConnections,
        reason: 'Poor connection quality'
      });
    }

    // Suggest adding more connections if below optimal
    if (connectedPeers.length < this.topology.optimalConnections) {
      optimizations.push({
        type: 'add_connections',
        needed: this.topology.optimalConnections - connectedPeers.length,
        reason: 'Below optimal connection count'
      });
    }

    return optimizations;
  }

  /**
   * Get peer ranking report
   */
  getPeerRanking() {
    const peers = Array.from(this.peerConnections.keys());
    
    return peers
      .map(peerId => {
        const peer = this.peerConnections.get(peerId);
        const metrics = this.connectionMetrics.get(peerId);
        
        return {
          peerId,
          qualityScore: peer.stats.qualityScore,
          isStable: peer.stats.isStable,
          connectionAge: Date.now() - peer.metadata.joinedAt,
          averages: metrics?.averages || {},
          trends: metrics?.trends || {}
        };
      })
      .sort((a, b) => b.qualityScore - a.qualityScore);
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    const peers = Array.from(this.peerConnections.keys());
    const totalPeers = peers.length;
    
    if (totalPeers === 0) {
      return {
        totalConnections: 0,
        averageQuality: 0,
        stableConnections: 0,
        recommendations: []
      };
    }

    const qualityScores = peers.map(peerId => 
      this.peerConnections.get(peerId).stats.qualityScore);
    
    const stableCount = peers.filter(peerId => 
      this.peerConnections.get(peerId).stats.isStable).length;

    const averageQuality = this.average(qualityScores);
    const recommendations = this.optimizeConnections();

    return {
      totalConnections: totalPeers,
      averageQuality: Math.round(averageQuality),
      stableConnections: stableCount,
      stabilityPercentage: Math.round((stableCount / totalPeers) * 100),
      recommendations,
      optimalRange: this.topology.optimalConnections,
      maxConnections: this.topology.maxConnections
    };
  }

  /**
   * Configure topology settings
   */
  configureTopology(settings) {
    this.topology = {
      ...this.topology,
      ...settings
    };
    
    console.log('🌐 Peer topology configured:', this.topology);
  }

  /**
   * Get available selection strategies
   */
  getAvailableStrategies() {
    return Array.from(this.selectionStrategies.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      description: config.description
    }));
  }
}

// Create singleton instance
const peerOptimizer = new PeerOptimizer();

export default peerOptimizer;