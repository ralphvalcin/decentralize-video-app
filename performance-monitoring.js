// PRIORITY 4: Performance Monitoring and Analytics
// Enhanced comprehensive performance monitoring system

import { useEffect, useRef, useState, useCallback } from 'react';

// Global performance tracking
const GlobalPerformanceTracker = {
  sessionStartTime: Date.now(),
  metrics: new Map(),
  events: [],
  budgetViolations: [],
  
  track(metric, value, context = {}) {
    const timestamp = Date.now();
    this.metrics.set(metric, {
      value,
      timestamp,
      context,
      sessionDuration: timestamp - this.sessionStartTime
    });
    
    // Real-time budget checking
    this.checkBudgets(metric, value);
  },
  
  trackEvent(eventType, details = {}) {
    this.events.push({
      type: eventType,
      timestamp: Date.now(),
      sessionDuration: Date.now() - this.sessionStartTime,
      details
    });
    
    // Keep only last 1000 events to prevent memory issues
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  },
  
  checkBudgets(metric, value) {
    const budgets = {
      renderTime: 16,
      memoryUsage: 150, // MB
      connectionTime: 3000,
      packetLoss: 5, // %
      latency: 200, // ms
      videoFrameRate: 30, // fps
      audioLevel: -20, // dB
      bandwidthUsage: 2000 // Kbps
    };
    
    if (budgets[metric] && value > budgets[metric]) {
      const violation = {
        metric,
        value,
        budget: budgets[metric],
        timestamp: Date.now(),
        severity: value > budgets[metric] * 2 ? 'critical' : value > budgets[metric] * 1.5 ? 'high' : 'medium'
      };
      
      this.budgetViolations.push(violation);
      console.warn(`🚨 Performance Budget Violation: ${metric} = ${value} (budget: ${budgets[metric]})`);
      
      // Keep only last 100 violations
      if (this.budgetViolations.length > 100) {
        this.budgetViolations = this.budgetViolations.slice(-100);
      }
    }
  },
  
  getMetrics() {
    return Object.fromEntries(this.metrics);
  },
  
  getEvents() {
    return this.events;
  },
  
  getBudgetViolations() {
    return this.budgetViolations;
  }
};

// Export global tracker
window.PerformanceTracker = GlobalPerformanceTracker;

// 1. React performance monitoring
const useRenderPerformanceMonitor = (componentName) => {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());
  const renderTimesRef = useRef([]);
  const [performanceStats, setPerformanceStats] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    slowRenders: 0,
    lastRenderDuration: 0
  });

  useEffect(() => {
    renderCountRef.current++;
    const now = Date.now();
    const renderDuration = now - lastRenderTimeRef.current;
    lastRenderTimeRef.current = now;

    renderTimesRef.current.push(renderDuration);
    
    // Keep only last 100 render times
    if (renderTimesRef.current.length > 100) {
      renderTimesRef.current = renderTimesRef.current.slice(-100);
    }

    const averageRenderTime = renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length;
    const slowRenders = renderTimesRef.current.filter(time => time > 16).length; // > 16ms is slow

    setPerformanceStats({
      renderCount: renderCountRef.current,
      averageRenderTime: Math.round(averageRenderTime * 100) / 100,
      slowRenders,
      lastRenderDuration: renderDuration
    });

    // Log performance warnings
    if (renderDuration > 50) {
      console.warn(`🐌 Slow render detected in ${componentName}: ${renderDuration}ms`);
    }

    if (renderCountRef.current % 50 === 0) {
      console.log(`📊 ${componentName} Performance Stats:`, {
        renders: renderCountRef.current,
        avgTime: averageRenderTime,
        slowRenders
      });
    }
  });

  return performanceStats;
};

// 2. Enhanced WebRTC performance analytics with detailed metrics
const useWebRTCAnalytics = () => {
  const metricsRef = useRef({
    connectionAttempts: 0,
    successfulConnections: 0,
    failedConnections: 0,
    connectionTimes: [],
    dataChannelMessages: 0,
    bytesTransferred: 0,
    averageLatency: 0,
    qualityDrops: 0,
    // Enhanced WebRTC metrics
    iceGatheringTime: 0,
    iceConnectionTime: 0,
    dtlsHandshakeTime: 0,
    videoFrameRate: 0,
    audioLevel: 0,
    packetsSent: 0,
    packetsReceived: 0,
    packetsLost: 0,
    jitter: 0,
    roundTripTime: 0,
    availableBandwidth: 0,
    codecsUsed: [],
    resolutionChanges: 0,
    bitrateAdaptations: 0,
    totalFreezeTime: 0,
    freezeEvents: 0
  });

  const [analytics, setAnalytics] = useState(metricsRef.current);

  const recordConnectionAttempt = useCallback(() => {
    metricsRef.current.connectionAttempts++;
    updateAnalytics();
  }, []);

  const recordConnectionSuccess = useCallback((connectionTime) => {
    metricsRef.current.successfulConnections++;
    metricsRef.current.connectionTimes.push(connectionTime);
    
    // Keep only last 50 connection times
    if (metricsRef.current.connectionTimes.length > 50) {
      metricsRef.current.connectionTimes = metricsRef.current.connectionTimes.slice(-50);
    }
    
    updateAnalytics();
  }, []);

  const recordConnectionFailure = useCallback(() => {
    metricsRef.current.failedConnections++;
    updateAnalytics();
  }, []);

  const recordDataTransfer = useCallback((bytes) => {
    metricsRef.current.bytesTransferred += bytes;
    GlobalPerformanceTracker.track('dataTransfer', bytes);
    updateAnalytics();
  }, []);
  
  const recordWebRTCStats = useCallback((stats) => {
    if (stats.video) {
      metricsRef.current.videoFrameRate = stats.video.frameRate || 0;
      GlobalPerformanceTracker.track('videoFrameRate', stats.video.frameRate);
      
      if (stats.video.packetsLost !== undefined) {
        metricsRef.current.packetsLost = stats.video.packetsLost;
        const packetLossRate = stats.video.packetsReceived > 0 
          ? (stats.video.packetsLost / (stats.video.packetsReceived + stats.video.packetsLost)) * 100 
          : 0;
        GlobalPerformanceTracker.track('packetLoss', packetLossRate);
      }
    }
    
    if (stats.audio) {
      metricsRef.current.audioLevel = stats.audio.audioLevel || 0;
      GlobalPerformanceTracker.track('audioLevel', stats.audio.audioLevel);
    }
    
    if (stats.connection) {
      metricsRef.current.roundTripTime = stats.connection.roundTripTime || 0;
      metricsRef.current.jitter = stats.connection.jitter || 0;
      metricsRef.current.availableBandwidth = stats.connection.availableBandwidth || 0;
      
      GlobalPerformanceTracker.track('latency', stats.connection.roundTripTime);
      GlobalPerformanceTracker.track('jitter', stats.connection.jitter);
      GlobalPerformanceTracker.track('bandwidthUsage', stats.connection.availableBandwidth);
    }
    
    updateAnalytics();
  }, []);
  
  const recordQualityEvent = useCallback((eventType, data) => {
    switch (eventType) {
      case 'resolution_change':
        metricsRef.current.resolutionChanges++;
        GlobalPerformanceTracker.trackEvent('resolutionChange', data);
        break;
      case 'bitrate_adaptation':
        metricsRef.current.bitrateAdaptations++;
        GlobalPerformanceTracker.trackEvent('bitrateAdaptation', data);
        break;
      case 'freeze_event':
        metricsRef.current.freezeEvents++;
        metricsRef.current.totalFreezeTime += data.duration || 0;
        GlobalPerformanceTracker.trackEvent('videoFreeze', data);
        break;
      case 'codec_change':
        if (!metricsRef.current.codecsUsed.includes(data.codec)) {
          metricsRef.current.codecsUsed.push(data.codec);
        }
        GlobalPerformanceTracker.trackEvent('codecChange', data);
        break;
    }
    updateAnalytics();
  }, []);

  const recordQualityDrop = useCallback(() => {
    metricsRef.current.qualityDrops++;
    updateAnalytics();
  }, []);

  const updateAnalytics = useCallback(() => {
    const current = metricsRef.current;
    const averageConnectionTime = current.connectionTimes.length > 0
      ? current.connectionTimes.reduce((a, b) => a + b, 0) / current.connectionTimes.length
      : 0;

    setAnalytics({
      ...current,
      averageConnectionTime: Math.round(averageConnectionTime * 100) / 100,
      connectionSuccessRate: current.connectionAttempts > 0
        ? (current.successfulConnections / current.connectionAttempts) * 100
        : 0
    });
  }, []);

  const exportAnalytics = useCallback(() => {
    return {
      timestamp: Date.now(),
      session: {
        duration: Date.now() - (window.sessionStartTime || Date.now()),
        ...analytics
      },
      browser: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        webrtcSupport: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      }
    };
  }, [analytics]);

  return {
    analytics,
    recordConnectionAttempt,
    recordConnectionSuccess,
    recordConnectionFailure,
    recordDataTransfer,
    recordQualityDrop,
    recordWebRTCStats,
    recordQualityEvent,
    exportAnalytics
  };
};

// 3. Enhanced real-time performance dashboard with comprehensive metrics
const PerformanceDashboard = ({ isVisible, onToggle }) => {
  const [systemMetrics, setSystemMetrics] = useState({
    memory: 0,
    cpu: 0,
    network: 0,
    fps: 0
  });

  const [webrtcStats, setWebrtcStats] = useState({
    activePeers: 0,
    totalBandwidth: 0,
    packetLoss: 0,
    averageLatency: 0,
    videoFrameRate: 0,
    audioLevel: 0,
    jitter: 0,
    freezeEvents: 0,
    resolutionChanges: 0
  });
  
  const [userExperienceMetrics, setUserExperienceMetrics] = useState({
    sessionDuration: 0,
    interactionLatency: 0,
    errorCount: 0,
    featureUsage: {},
    coreWebVitals: {
      lcp: 0,
      inp: 0,
      cls: 0
    }
  });

  // Monitor system performance
  useEffect(() => {
    if (!isVisible) return;

    const monitor = setInterval(async () => {
      try {
        // Memory usage
        const memory = performance.memory ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
          total: Math.round(performance.memory.totalJSHeapSize / 1048576),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
        } : null;

        // FPS monitoring
        let fps = 0;
        if (window.lastFrameTime) {
          fps = 1000 / (Date.now() - window.lastFrameTime);
        }
        window.lastFrameTime = Date.now();

        // Core Web Vitals monitoring
        const navigation = performance.getEntriesByType('navigation')[0];
        const paintEntries = performance.getEntriesByType('paint');
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        
        const coreWebVitals = {
          lcp: lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : 0,
          inp: window.lastInputDelay || 0,
          cls: window.cumulativeLayoutShift || 0
        };
        
        // Network information
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const networkInfo = connection ? {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        } : null;
        
        setSystemMetrics(prev => ({
          ...prev,
          memory: memory?.used || 0,
          memoryPercent: memory ? (memory.used / memory.limit) * 100 : 0,
          fps: Math.round(fps),
          networkType: networkInfo?.effectiveType || 'unknown',
          networkSpeed: networkInfo?.downlink || 0,
          networkLatency: networkInfo?.rtt || 0
        }));
        
        setUserExperienceMetrics(prev => ({
          ...prev,
          sessionDuration: Date.now() - GlobalPerformanceTracker.sessionStartTime,
          coreWebVitals
        }));
        
        // Track system metrics globally
        GlobalPerformanceTracker.track('memoryUsage', memory?.used || 0);
        GlobalPerformanceTracker.track('frameRate', fps);
        GlobalPerformanceTracker.track('networkLatency', networkInfo?.rtt || 0);

      } catch (error) {
        console.error('Performance monitoring error:', error);
      }
    }, 1000);

    return () => clearInterval(monitor);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg border border-gray-700 z-50 w-80">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">🔍 Performance Monitor</h3>
        <button onClick={onToggle} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      {/* System Metrics */}
      <div className="space-y-2 mb-4">
        <h4 className="text-sm font-medium text-gray-300">System</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-400">Memory:</span>
            <span className={`ml-1 ${systemMetrics.memoryPercent > 80 ? 'text-red-400' : 'text-green-400'}`}>
              {systemMetrics.memory}MB ({Math.round(systemMetrics.memoryPercent)}%)
            </span>
          </div>
          <div>
            <span className="text-gray-400">FPS:</span>
            <span className={`ml-1 ${systemMetrics.fps < 30 ? 'text-red-400' : 'text-green-400'}`}>
              {systemMetrics.fps}
            </span>
          </div>
        </div>
      </div>

      {/* WebRTC Stats */}
      <div className="space-y-2 mb-4">
        <h4 className="text-sm font-medium text-gray-300">WebRTC</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-400">Peers:</span>
            <span className="ml-1 text-blue-400">{webrtcStats.activePeers}</span>
          </div>
          <div>
            <span className="text-gray-400">Bandwidth:</span>
            <span className="ml-1 text-blue-400">
              {Math.round(webrtcStats.totalBandwidth / 1000)}KB/s
            </span>
          </div>
          <div>
            <span className="text-gray-400">Packet Loss:</span>
            <span className={`ml-1 ${webrtcStats.packetLoss > 5 ? 'text-red-400' : 'text-green-400'}`}>
              {webrtcStats.packetLoss.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-gray-400">Latency:</span>
            <span className={`ml-1 ${webrtcStats.averageLatency > 200 ? 'text-red-400' : 'text-green-400'}`}>
              {webrtcStats.averageLatency}ms
            </span>
          </div>
          <div>
            <span className="text-gray-400">Video FPS:</span>
            <span className={`ml-1 ${webrtcStats.videoFrameRate < 24 ? 'text-red-400' : 'text-green-400'}`}>
              {webrtcStats.videoFrameRate}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Jitter:</span>
            <span className={`ml-1 ${webrtcStats.jitter > 30 ? 'text-red-400' : 'text-green-400'}`}>
              {webrtcStats.jitter}ms
            </span>
          </div>
        </div>
      </div>
      
      {/* User Experience Metrics */}
      <div className="space-y-2 mb-4">
        <h4 className="text-sm font-medium text-gray-300">User Experience</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-400">Session:</span>
            <span className="ml-1 text-blue-400">
              {Math.round(userExperienceMetrics.sessionDuration / 60000)}m
            </span>
          </div>
          <div>
            <span className="text-gray-400">LCP:</span>
            <span className={`ml-1 ${userExperienceMetrics.coreWebVitals.lcp > 2500 ? 'text-red-400' : 'text-green-400'}`}>
              {Math.round(userExperienceMetrics.coreWebVitals.lcp)}ms
            </span>
          </div>
          <div>
            <span className="text-gray-400">INP:</span>
            <span className={`ml-1 ${userExperienceMetrics.coreWebVitals.inp > 200 ? 'text-red-400' : 'text-green-400'}`}>
              {Math.round(userExperienceMetrics.coreWebVitals.inp)}ms
            </span>
          </div>
          <div>
            <span className="text-gray-400">CLS:</span>
            <span className={`ml-1 ${userExperienceMetrics.coreWebVitals.cls > 0.1 ? 'text-red-400' : 'text-green-400'}`}>
              {userExperienceMetrics.coreWebVitals.cls.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Quality Events */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-300">Quality Events</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-400">Freezes:</span>
            <span className={`ml-1 ${webrtcStats.freezeEvents > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              {webrtcStats.freezeEvents}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Res Changes:</span>
            <span className="ml-1 text-blue-400">{webrtcStats.resolutionChanges}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 4. Performance budget monitoring
const usePerformanceBudget = () => {
  const budgets = {
    renderTime: 16, // 60fps
    memoryUsage: 100, // MB
    connectionTime: 3000, // 3 seconds
    packetLoss: 5, // 5%
    latency: 200 // 200ms
  };

  const [violations, setViolations] = useState([]);

  const checkBudget = useCallback((metric, value, threshold = null) => {
    const limit = threshold || budgets[metric];
    if (value > limit) {
      const violation = {
        metric,
        value,
        limit,
        timestamp: Date.now(),
        severity: value > limit * 1.5 ? 'high' : 'medium'
      };

      setViolations(prev => {
        const updated = [...prev, violation];
        // Keep only last 50 violations
        return updated.slice(-50);
      });

      console.warn(`⚠️ Performance budget violation: ${metric} = ${value} (limit: ${limit})`);
      
      return false;
    }
    return true;
  }, [budgets]);

  const getViolationSummary = useCallback(() => {
    const recent = violations.filter(v => Date.now() - v.timestamp < 300000); // Last 5 minutes
    const byMetric = recent.reduce((acc, violation) => {
      acc[violation.metric] = (acc[violation.metric] || 0) + 1;
      return acc;
    }, {});

    return {
      total: recent.length,
      byMetric,
      severe: recent.filter(v => v.severity === 'high').length
    };
  }, [violations]);

  return {
    budgets,
    violations,
    checkBudget,
    getViolationSummary
  };
};

// 5. Automated performance reporting
const usePerformanceReporting = () => {
  const reportDataRef = useRef({
    sessions: [],
    errors: [],
    metrics: []
  });

  const addSessionData = useCallback((sessionData) => {
    reportDataRef.current.sessions.push({
      ...sessionData,
      timestamp: Date.now()
    });
  }, []);

  const addError = useCallback((error, context) => {
    reportDataRef.current.errors.push({
      error: error.toString(),
      stack: error.stack,
      context,
      timestamp: Date.now()
    });
  }, []);

  const generateReport = useCallback(() => {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalSessions: reportDataRef.current.sessions.length,
        totalErrors: reportDataRef.current.errors.length,
        averageSessionDuration: calculateAverageSessionDuration(),
        commonErrors: getCommonErrors()
      },
      data: reportDataRef.current
    };

    return report;
  }, []);

  const calculateAverageSessionDuration = () => {
    if (reportDataRef.current.sessions.length === 0) return 0;
    
    const totalDuration = reportDataRef.current.sessions.reduce((sum, session) => 
      sum + (session.duration || 0), 0
    );
    
    return totalDuration / reportDataRef.current.sessions.length;
  };

  const getCommonErrors = () => {
    const errorCounts = reportDataRef.current.errors.reduce((acc, error) => {
      const key = error.error.split(':')[0]; // Get error type
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
  };

  const exportReport = useCallback(() => {
    const report = generateReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generateReport]);

  return {
    addSessionData,
    addError,
    generateReport,
    exportReport
  };
};

// 6. Socket.io performance monitoring
const useSocketPerformanceMonitor = () => {
  const metricsRef = useRef({
    messagesSent: 0,
    messagesReceived: 0,
    averageLatency: 0,
    connectionDrops: 0,
    reconnectionAttempts: 0,
    messageSizes: [],
    latencyHistory: [],
    errorCount: 0,
    totalDataTransferred: 0
  });

  const [socketMetrics, setSocketMetrics] = useState(metricsRef.current);

  const trackMessage = useCallback((direction, size, latency = null) => {
    const startTime = Date.now();
    
    if (direction === 'sent') {
      metricsRef.current.messagesSent++;
      GlobalPerformanceTracker.trackEvent('socketMessageSent', { size, timestamp: startTime });
    } else {
      metricsRef.current.messagesReceived++;
      if (latency !== null) {
        metricsRef.current.latencyHistory.push(latency);
        if (metricsRef.current.latencyHistory.length > 50) {
          metricsRef.current.latencyHistory = metricsRef.current.latencyHistory.slice(-50);
        }
        metricsRef.current.averageLatency = 
          metricsRef.current.latencyHistory.reduce((a, b) => a + b, 0) / metricsRef.current.latencyHistory.length;
      }
      GlobalPerformanceTracker.trackEvent('socketMessageReceived', { size, latency, timestamp: startTime });
    }

    metricsRef.current.messageSizes.push(size);
    metricsRef.current.totalDataTransferred += size;
    
    if (metricsRef.current.messageSizes.length > 100) {
      metricsRef.current.messageSizes = metricsRef.current.messageSizes.slice(-100);
    }

    setSocketMetrics({ ...metricsRef.current });
    GlobalPerformanceTracker.track('socketLatency', metricsRef.current.averageLatency);
  }, []);

  const trackConnectionEvent = useCallback((eventType, details = {}) => {
    switch (eventType) {
      case 'disconnect':
        metricsRef.current.connectionDrops++;
        GlobalPerformanceTracker.trackEvent('socketDisconnect', details);
        break;
      case 'reconnect_attempt':
        metricsRef.current.reconnectionAttempts++;
        GlobalPerformanceTracker.trackEvent('socketReconnectAttempt', details);
        break;
      case 'error':
        metricsRef.current.errorCount++;
        GlobalPerformanceTracker.trackEvent('socketError', details);
        break;
    }
    setSocketMetrics({ ...metricsRef.current });
  }, []);

  const getSocketStats = useCallback(() => {
    const avgMessageSize = metricsRef.current.messageSizes.length > 0
      ? metricsRef.current.messageSizes.reduce((a, b) => a + b, 0) / metricsRef.current.messageSizes.length
      : 0;

    return {
      ...metricsRef.current,
      averageMessageSize: Math.round(avgMessageSize),
      messagesPerSecond: metricsRef.current.messagesSent / ((Date.now() - GlobalPerformanceTracker.sessionStartTime) / 1000),
      connectionQuality: metricsRef.current.averageLatency < 100 ? 'excellent' : 
                        metricsRef.current.averageLatency < 200 ? 'good' : 
                        metricsRef.current.averageLatency < 500 ? 'fair' : 'poor'
    };
  }, []);

  return {
    socketMetrics,
    trackMessage,
    trackConnectionEvent,
    getSocketStats
  };
};

// 7. Advanced User Experience Analytics
const useUserExperienceAnalytics = () => {
  const [uxMetrics, setUxMetrics] = useState({
    sessionDuration: 0,
    pageLoadTime: 0,
    interactionCount: 0,
    errorEncountered: 0,
    featureUsage: new Map(),
    timeToFirstByte: 0,
    timeToInteractive: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    cumulativeLayoutShift: 0,
    inputDelay: 0,
    userFlow: []
  });

  const trackUserInteraction = useCallback((action, element, duration = null) => {
    const timestamp = Date.now();
    const interaction = {
      action,
      element,
      timestamp,
      duration,
      sessionTime: timestamp - GlobalPerformanceTracker.sessionStartTime
    };

    setUxMetrics(prev => {
      const updatedFlow = [...prev.userFlow, interaction];
      const featureUsage = new Map(prev.featureUsage);
      featureUsage.set(action, (featureUsage.get(action) || 0) + 1);

      return {
        ...prev,
        interactionCount: prev.interactionCount + 1,
        userFlow: updatedFlow.slice(-50), // Keep last 50 interactions
        featureUsage
      };
    });

    GlobalPerformanceTracker.trackEvent('userInteraction', interaction);
    
    if (duration && duration > 100) {
      GlobalPerformanceTracker.track('interactionLatency', duration);
    }
  }, []);

  const trackError = useCallback((error, context = {}) => {
    setUxMetrics(prev => ({
      ...prev,
      errorEncountered: prev.errorEncountered + 1
    }));

    GlobalPerformanceTracker.trackEvent('userError', {
      error: error.toString(),
      stack: error.stack,
      context,
      timestamp: Date.now()
    });
  }, []);

  const measurePagePerformance = useCallback(() => {
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paintEntries = performance.getEntriesByType('paint');
      
      const performanceMetrics = {
        pageLoadTime: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
        timeToFirstByte: navigation ? navigation.responseStart - navigation.requestStart : 0,
        timeToInteractive: navigation ? navigation.domInteractive - navigation.fetchStart : 0,
        firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
        largestContentfulPaint: 0, // Will be updated by observer
        cumulativeLayoutShift: window.cumulativeLayoutShift || 0,
        inputDelay: window.lastInputDelay || 0
      };

      setUxMetrics(prev => ({ ...prev, ...performanceMetrics }));
      
      // Track Core Web Vitals
      Object.entries(performanceMetrics).forEach(([metric, value]) => {
        GlobalPerformanceTracker.track(metric, value);
      });
    }
  }, []);

  useEffect(() => {
    measurePagePerformance();
    
    // Set up performance observers
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // LCP Observer
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        setUxMetrics(prev => ({ ...prev, largestContentfulPaint: lastEntry.startTime }));
        GlobalPerformanceTracker.track('largestContentfulPaint', lastEntry.startTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // CLS Observer
      const clsObserver = new PerformanceObserver((entryList) => {
        let clsValue = 0;
        entryList.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        window.cumulativeLayoutShift = (window.cumulativeLayoutShift || 0) + clsValue;
        setUxMetrics(prev => ({ ...prev, cumulativeLayoutShift: window.cumulativeLayoutShift }));
        GlobalPerformanceTracker.track('cumulativeLayoutShift', window.cumulativeLayoutShift);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });

      // Input Delay Observer
      const inputObserver = new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry) => {
          const inputDelay = entry.processingStart - entry.startTime;
          window.lastInputDelay = inputDelay;
          setUxMetrics(prev => ({ ...prev, inputDelay }));
          GlobalPerformanceTracker.track('inputDelay', inputDelay);
        });
      });
      inputObserver.observe({ entryTypes: ['first-input'] });

      return () => {
        lcpObserver.disconnect();
        clsObserver.disconnect();
        inputObserver.disconnect();
      };
    }
  }, [measurePagePerformance]);

  return {
    uxMetrics,
    trackUserInteraction,
    trackError,
    measurePagePerformance
  };
};

// 8. Performance Alerting System
const usePerformanceAlerting = () => {
  const [alerts, setAlerts] = useState([]);
  const alertThresholds = useRef({
    criticalMemory: 200, // MB
    criticalLatency: 500, // ms
    criticalPacketLoss: 10, // %
    criticalFrameRate: 15, // fps
    criticalErrorRate: 5, // errors per minute
    criticalConnectionDrops: 3 // drops per session
  });

  const checkThresholds = useCallback((metric, value) => {
    const thresholds = alertThresholds.current;
    let alertLevel = null;
    let message = '';

    switch (metric) {
      case 'memoryUsage':
        if (value > thresholds.criticalMemory) {
          alertLevel = 'critical';
          message = `High memory usage: ${value}MB`;
        }
        break;
      case 'latency':
        if (value > thresholds.criticalLatency) {
          alertLevel = 'warning';
          message = `High latency detected: ${value}ms`;
        }
        break;
      case 'packetLoss':
        if (value > thresholds.criticalPacketLoss) {
          alertLevel = 'critical';
          message = `Critical packet loss: ${value}%`;
        }
        break;
      case 'videoFrameRate':
        if (value < thresholds.criticalFrameRate) {
          alertLevel = 'warning';
          message = `Low frame rate: ${value} fps`;
        }
        break;
    }

    if (alertLevel) {
      const alert = {
        id: Date.now(),
        level: alertLevel,
        message,
        metric,
        value,
        timestamp: Date.now()
      };

      setAlerts(prev => {
        const newAlerts = [alert, ...prev.slice(0, 19)]; // Keep last 20 alerts
        return newAlerts;
      });

      // Send to external monitoring if configured
      if (window.externalMonitoring) {
        window.externalMonitoring.sendAlert(alert);
      }

      console.warn(`🚨 Performance Alert [${alertLevel.toUpperCase()}]: ${message}`);
    }
  }, []);

  const dismissAlert = useCallback((alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Monitor global performance metrics
  useEffect(() => {
    const interval = setInterval(() => {
      const metrics = GlobalPerformanceTracker.getMetrics();
      Object.entries(metrics).forEach(([metric, data]) => {
        if (data && typeof data.value === 'number') {
          checkThresholds(metric, data.value);
        }
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [checkThresholds]);

  return {
    alerts,
    dismissAlert,
    clearAllAlerts,
    checkThresholds
  };
};

export {
  useRenderPerformanceMonitor,
  useWebRTCAnalytics,
  PerformanceDashboard,
  usePerformanceBudget,
  usePerformanceReporting,
  useSocketPerformanceMonitor,
  useUserExperienceAnalytics,
  usePerformanceAlerting,
  GlobalPerformanceTracker
};