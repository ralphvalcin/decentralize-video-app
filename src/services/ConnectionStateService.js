import toast from 'react-hot-toast';

class ConnectionStateService {
  constructor() {
    this.state = {
      status: 'disconnected', // 'disconnected', 'connecting', 'connected', 'error'
      quality: 'unknown', // 'poor', 'fair', 'good', 'excellent'
      lastConnectedTime: null,
      connectionAttempts: 0,
      errors: []
    };
    
    this.listeners = [];
    this.monitorInterval = null;
    this.connectionHistory = [];
    this.maxHistorySize = 100;
  }

  // Subscribe to state changes
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all subscribers
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.state);
      } catch (err) {
        console.error('Error in connection state listener:', err);
      }
    });
  }

  // Update connection status
  setStatus(status, reason = null) {
    const previousStatus = this.state.status;
    this.state.status = status;
    this.state.lastUpdated = new Date();

    // Track connection history
    this.addToHistory({
      timestamp: new Date(),
      status,
      reason,
      previousStatus
    });

    // Handle specific status changes
    switch (status) {
      case 'connecting':
        this.state.connectionAttempts++;
        toast.loading('Connecting...', { id: 'connection-status' });
        break;
        
      case 'connected':
        this.state.lastConnectedTime = new Date();
        this.state.connectionAttempts = 0;
        this.startQualityMonitoring();
        toast.success('Connected successfully!', { id: 'connection-status' });
        break;
        
      case 'disconnected':
        this.stopQualityMonitoring();
        if (previousStatus === 'connected') {
          toast.error('Connection lost', { id: 'connection-status' });
        }
        break;
        
      case 'error':
        this.stopQualityMonitoring();
        this.addError(reason || 'Unknown connection error');
        toast.error(reason || 'Connection error', { id: 'connection-status' });
        break;
    }

    this.notifyListeners();
  }

  // Set connection quality
  setQuality(quality, metrics = {}) {
    this.state.quality = quality;
    this.state.qualityMetrics = metrics;
    this.state.lastQualityUpdate = new Date();

    // Only show quality warnings for significant changes
    if (quality === 'poor' && this.state.quality !== 'poor') {
      toast.warning('Poor connection detected');
    }

    this.notifyListeners();
  }

  // Add error to history
  addError(error) {
    const errorEntry = {
      timestamp: new Date(),
      error: typeof error === 'string' ? error : error.message,
      details: typeof error === 'object' ? error : null
    };

    this.state.errors.unshift(errorEntry);
    
    // Limit error history
    if (this.state.errors.length > 20) {
      this.state.errors = this.state.errors.slice(0, 20);
    }

    this.notifyListeners();
  }

  // Add entry to connection history
  addToHistory(entry) {
    this.connectionHistory.unshift(entry);
    
    if (this.connectionHistory.length > this.maxHistorySize) {
      this.connectionHistory = this.connectionHistory.slice(0, this.maxHistorySize);
    }
  }

  // Start monitoring connection quality
  startQualityMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorInterval = setInterval(() => {
      this.updateQualityMetrics();
    }, 5000);
  }

  // Stop monitoring connection quality
  stopQualityMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  // Update quality metrics (to be called with actual peer stats)
  updateQualityMetrics(peerConnections = []) {
    const metrics = {
      timestamp: new Date(),
      totalPeers: peerConnections.length,
      activePeers: 0,
      avgBandwidth: 0,
      avgLatency: 0,
      packetLoss: 0
    };

    let totalBandwidth = 0;
    let totalLatency = 0;
    let totalPacketLoss = 0;
    let validConnections = 0;

    peerConnections.forEach(({ peer }) => {
      if (peer && !peer.destroyed) {
        try {
          const stats = peer.getStats();
          if (stats) {
            metrics.activePeers++;
            validConnections++;
            
            if (stats.bandwidth) totalBandwidth += stats.bandwidth;
            if (stats.latency) totalLatency += stats.latency;
            if (stats.packetLoss) totalPacketLoss += stats.packetLoss;
          }
        } catch (err) {
          // Ignore stats errors
        }
      }
    });

    if (validConnections > 0) {
      metrics.avgBandwidth = totalBandwidth / validConnections;
      metrics.avgLatency = totalLatency / validConnections;
      metrics.packetLoss = totalPacketLoss / validConnections;
    }

    // Determine quality based on metrics
    let quality = 'excellent';
    if (metrics.avgBandwidth < 100000 || metrics.avgLatency > 300 || metrics.packetLoss > 0.05) {
      quality = 'poor';
    } else if (metrics.avgBandwidth < 500000 || metrics.avgLatency > 150 || metrics.packetLoss > 0.02) {
      quality = 'fair';
    } else if (metrics.avgBandwidth < 1000000 || metrics.avgLatency > 100) {
      quality = 'good';
    }

    this.setQuality(quality, metrics);
  }

  // Get current connection state
  getState() {
    return { ...this.state };
  }

  // Get connection history
  getHistory() {
    return [...this.connectionHistory];
  }

  // Get connection uptime
  getUptime() {
    if (this.state.status !== 'connected' || !this.state.lastConnectedTime) {
      return 0;
    }
    return Date.now() - this.state.lastConnectedTime.getTime();
  }

  // Get connection statistics
  getStatistics() {
    const totalConnections = this.connectionHistory.length;
    const successfulConnections = this.connectionHistory.filter(h => h.status === 'connected').length;
    const errorCount = this.state.errors.length;
    
    return {
      totalConnections,
      successfulConnections,
      successRate: totalConnections > 0 ? (successfulConnections / totalConnections) * 100 : 0,
      errorCount,
      currentStatus: this.state.status,
      uptime: this.getUptime(),
      quality: this.state.quality,
      connectionAttempts: this.state.connectionAttempts
    };
  }

  // Reset connection state
  reset() {
    this.stopQualityMonitoring();
    this.state = {
      status: 'disconnected',
      quality: 'unknown',
      lastConnectedTime: null,
      connectionAttempts: 0,
      errors: []
    };
    this.connectionHistory = [];
    this.notifyListeners();
  }

  // Check if reconnection should be attempted
  shouldAttemptReconnection() {
    return this.state.connectionAttempts < 10 && 
           this.state.status === 'disconnected' &&
           this.state.errors.length < 5;
  }

  // Cleanup
  destroy() {
    this.stopQualityMonitoring();
    this.listeners = [];
    this.connectionHistory = [];
  }
}

export default ConnectionStateService;