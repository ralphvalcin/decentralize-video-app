/**
 * Real-time Performance Metrics Dashboard
 * 
 * This component provides:
 * - Live connection quality indicators
 * - Network performance metrics
 * - WebRTC statistics visualization
 * - Performance alerts and recommendations
 */

import { useState, useEffect, useRef, memo } from 'react';
import performanceMonitor from '../utils/PerformanceMonitor';
import adaptiveBitrate from '../utils/AdaptiveBitrate';
import peerOptimizer from '../utils/PeerOptimizer';

const PerformanceDashboard = memo(({ 
  peers: _peers = [], 
  isOpen = false, 
  onToggle = () => {},
  position = 'bottom-right' 
}) => {
  const [metrics, setMetrics] = useState({});
  const [networkInfo, setNetworkInfo] = useState(null);
  const [qualityInfo, setQualityInfo] = useState({});
  const [peerStats, setPeerStats] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedTab, setSelectedTab] = useState('overview');
  const updateInterval = useRef(null);

  useEffect(() => {
    if (isOpen) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => stopMonitoring();
  }, [isOpen]);

  const startMonitoring = () => {
    // Initial data load
    updateMetrics();
    
    // Set up regular updates
    updateInterval.current = setInterval(updateMetrics, 2000);
    
    // Add performance observers
    performanceMonitor.addObserver(handlePerformanceUpdate);
    adaptiveBitrate.addObserver(handleQualityUpdate);
    peerOptimizer.addObserver(handlePeerUpdate);
  };

  const stopMonitoring = () => {
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
      updateInterval.current = null;
    }
    
    // Remove observers
    performanceMonitor.removeObserver(handlePerformanceUpdate);
    adaptiveBitrate.removeObserver(handleQualityUpdate);
    peerOptimizer.removeObserver(handlePeerUpdate);
  };

  const updateMetrics = () => {
    // Get current metrics
    const currentMetrics = performanceMonitor.getAllMetrics();
    const network = performanceMonitor.getNetworkInfo();
    const quality = adaptiveBitrate.getCurrentQuality();
    const peerRanking = peerOptimizer.getPeerRanking();
    
    setMetrics(currentMetrics);
    setNetworkInfo(network);
    setQualityInfo(quality);
    setPeerStats(peerRanking);
    
    // Check for alerts
    checkPerformanceAlerts(currentMetrics, peerRanking);
  };

  const handlePerformanceUpdate = (data) => {
    if (data.type === 'performance_issues') {
      setAlerts(prev => [...prev, {
        id: Date.now(),
        type: 'warning',
        message: `Performance issue detected for peer ${data.peerId}`,
        timestamp: data.timestamp,
        details: data.issues
      }]);
    }
  };

  const handleQualityUpdate = (data) => {
    if (data.type === 'quality_adapted') {
      setAlerts(prev => [...prev, {
        id: Date.now(),
        type: 'info',
        message: `Video quality adapted: ${data.from} → ${data.to}`,
        timestamp: data.timestamp,
        reason: data.reason
      }]);
    }
  };

  const handlePeerUpdate = (data) => {
    if (data.type === 'peer_selection') {
      setAlerts(prev => [...prev, {
        id: Date.now(),
        type: 'info',
        message: `Peer selection optimized: ${data.selected} of ${data.available} peers`,
        timestamp: data.timestamp,
        strategy: data.strategy
      }]);
    }
  };

  const checkPerformanceAlerts = (currentMetrics, peerRanking) => {
    const newAlerts = [];
    
    // Check memory usage
    const memoryMetric = currentMetrics.memory?.value;
    if (memoryMetric && memoryMetric.usagePercentage > 80) {
      newAlerts.push({
        id: `memory_${Date.now()}`,
        type: 'warning',
        message: `High memory usage: ${memoryMetric.usagePercentage}%`,
        timestamp: Date.now()
      });
    }
    
    // Check poor quality connections
    const poorPeers = peerRanking.filter(peer => peer.qualityScore < 40);
    if (poorPeers.length > 0) {
      newAlerts.push({
        id: `quality_${Date.now()}`,
        type: 'warning',
        message: `${poorPeers.length} peer(s) with poor connection quality`,
        timestamp: Date.now(),
        peers: poorPeers.map(p => p.peerId)
      });
    }
    
    if (newAlerts.length > 0) {
      setAlerts(prev => [...prev, ...newAlerts].slice(-20)); // Keep last 20 alerts
    }
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const dismissAlert = (alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const getConnectionQualityColor = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getConnectionQualityText = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!isOpen) {
    return (
      <div className={`fixed ${position === 'bottom-right' ? 'bottom-4 right-4' : 'bottom-4 left-4'} z-50`}>
        <button
          onClick={onToggle}
          className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 border border-gray-600"
          title="Open Performance Dashboard"
        >
          <span className="text-lg">📊</span>
        </button>
        
        {/* Mini indicators */}
        <div className="absolute -top-2 -left-2 flex gap-1">
          {alerts.length > 0 && (
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          )}
          {networkInfo?.effectiveType === 'slow-2g' && (
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed ${position === 'bottom-right' ? 'bottom-4 right-4' : 'bottom-4 left-4'} z-50 w-96 max-h-[600px] bg-gray-800 rounded-lg shadow-2xl border border-gray-600 overflow-hidden`}>
      {/* Header */}
      <div className="bg-gray-900 p-4 flex items-center justify-between border-b border-gray-600">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="text-white font-semibold">Performance Monitor</h3>
        </div>
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {alerts.length}
            </div>
          )}
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <span>✕</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-600">
        {['overview', 'peers', 'network', 'alerts'].map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`flex-1 p-2 text-sm font-medium capitalize transition-colors ${
              selectedTab === tab
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {tab}
            {tab === 'alerts' && alerts.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 inline-flex items-center justify-center">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {selectedTab === 'overview' && (
          <div className="space-y-4">
            {/* Current Quality */}
            <div className="bg-gray-700 p-3 rounded">
              <h4 className="text-white font-medium mb-2">Video Quality</h4>
              <div className="text-sm text-gray-300">
                <div>Profile: <span className="text-blue-400">{qualityInfo.profile || 'Loading...'}</span></div>
                <div>Resolution: <span className="text-blue-400">
                  {qualityInfo.constraints?.video?.width}x{qualityInfo.constraints?.video?.height}
                </span></div>
                <div>Adaptive: <span className={qualityInfo.isAdaptive ? 'text-green-400' : 'text-red-400'}>
                  {qualityInfo.isAdaptive ? 'Enabled' : 'Disabled'}
                </span></div>
              </div>
            </div>

            {/* Connection Summary */}
            <div className="bg-gray-700 p-3 rounded">
              <h4 className="text-white font-medium mb-2">Connections</h4>
              <div className="text-sm text-gray-300">
                <div>Active Peers: <span className="text-blue-400">{peerStats.length}</span></div>
                <div>Avg Quality: <span className={getConnectionQualityColor(
                  Math.round(peerStats.reduce((sum, peer) => sum + peer.qualityScore, 0) / peerStats.length || 0)
                )}>
                  {Math.round(peerStats.reduce((sum, peer) => sum + peer.qualityScore, 0) / peerStats.length || 0)}%
                </span></div>
                <div>Stable: <span className="text-green-400">
                  {peerStats.filter(p => p.isStable).length}/{peerStats.length}
                </span></div>
              </div>
            </div>

            {/* Memory Usage */}
            {metrics.memory && (
              <div className="bg-gray-700 p-3 rounded">
                <h4 className="text-white font-medium mb-2">Memory Usage</h4>
                <div className="text-sm text-gray-300">
                  <div>Used: <span className="text-blue-400">
                    {formatBytes(metrics.memory.value.usedJSHeapSize)}
                  </span></div>
                  <div>Total: <span className="text-blue-400">
                    {formatBytes(metrics.memory.value.totalJSHeapSize)}
                  </span></div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          metrics.memory.value.usagePercentage > 80 ? 'bg-red-500' :
                          metrics.memory.value.usagePercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${metrics.memory.value.usagePercentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 mt-1">
                      {metrics.memory.value.usagePercentage}% used
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'peers' && (
          <div className="space-y-3">
            {peerStats.length === 0 ? (
              <div className="text-gray-400 text-center py-4">No peer connections</div>
            ) : (
              peerStats.map(peer => (
                <div key={peer.peerId} className="bg-gray-700 p-3 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">
                      Peer {peer.peerId.substring(0, 8)}...
                    </span>
                    <div className="flex items-center gap-2">
                      {peer.isStable && (
                        <span className="text-green-400 text-xs">Stable</span>
                      )}
                      <span className={`text-sm font-medium ${getConnectionQualityColor(peer.qualityScore)}`}>
                        {peer.qualityScore}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-300 space-y-1">
                    <div>Quality: <span className={getConnectionQualityColor(peer.qualityScore)}>
                      {getConnectionQualityText(peer.qualityScore)}
                    </span></div>
                    {peer.averages.latency && (
                      <div>Latency: <span className="text-blue-400">{peer.averages.latency.toFixed(0)}ms</span></div>
                    )}
                    {peer.averages.bandwidth && (
                      <div>Bandwidth: <span className="text-blue-400">
                        {Math.round(peer.averages.bandwidth / 1000)}kbps
                      </span></div>
                    )}
                    <div>Connected: <span className="text-blue-400">
                      {Math.round((Date.now() - peer.connectionAge) / 1000)}s ago
                    </span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {selectedTab === 'network' && (
          <div className="space-y-4">
            {networkInfo && (
              <div className="bg-gray-700 p-3 rounded">
                <h4 className="text-white font-medium mb-2">Network Information</h4>
                <div className="text-sm text-gray-300 space-y-1">
                  <div>Type: <span className="text-blue-400">{networkInfo.effectiveType}</span></div>
                  <div>Downlink: <span className="text-blue-400">{networkInfo.downlink} Mbps</span></div>
                  <div>RTT: <span className="text-blue-400">{networkInfo.rtt}ms</span></div>
                  <div>Data Saver: <span className={networkInfo.saveData ? 'text-red-400' : 'text-green-400'}>
                    {networkInfo.saveData ? 'On' : 'Off'}
                  </span></div>
                </div>
              </div>
            )}

            {/* Web Vitals */}
            <div className="bg-gray-700 p-3 rounded">
              <h4 className="text-white font-medium mb-2">Web Vitals</h4>
              <div className="text-sm text-gray-300 space-y-1">
                {metrics.lcp && (
                  <div>LCP: <span className={`${metrics.lcp.value < 2500 ? 'text-green-400' : 'text-red-400'}`}>
                    {Math.round(metrics.lcp.value)}ms
                  </span></div>
                )}
                {metrics.fid && (
                  <div>FID: <span className={`${metrics.fid.value < 100 ? 'text-green-400' : 'text-red-400'}`}>
                    {Math.round(metrics.fid.value)}ms
                  </span></div>
                )}
                {metrics.cls && (
                  <div>CLS: <span className={`${metrics.cls.value < 0.1 ? 'text-green-400' : 'text-red-400'}`}>
                    {metrics.cls.value.toFixed(3)}
                  </span></div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'alerts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">Recent Alerts</span>
              {alerts.length > 0 && (
                <button
                  onClick={clearAlerts}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Clear All
                </button>
              )}
            </div>
            
            {alerts.length === 0 ? (
              <div className="text-gray-400 text-center py-4">No alerts</div>
            ) : (
              <div className="space-y-2">
                {alerts.slice().reverse().map(alert => (
                  <div key={alert.id} className={`p-3 rounded border-l-4 ${
                    alert.type === 'warning' ? 'bg-yellow-900/20 border-yellow-500' :
                    alert.type === 'error' ? 'bg-red-900/20 border-red-500' :
                    'bg-blue-900/20 border-blue-500'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">
                          {alert.message}
                        </div>
                        <div className="text-gray-400 text-xs mt-1">
                          {formatTime(alert.timestamp)}
                        </div>
                        {alert.reason && (
                          <div className="text-gray-300 text-xs mt-1">
                            Reason: {alert.reason}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-gray-400 hover:text-white ml-2"
                      >
                        <span className="text-xs">✕</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

PerformanceDashboard.displayName = 'PerformanceDashboard';

export default PerformanceDashboard;