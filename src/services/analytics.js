// Analytics and Performance Monitoring Service
class AnalyticsService {
  constructor() {
    this.isEnabled = false;
    this.sessionId = this.generateSessionId();
    this.events = [];
    this.performanceMetrics = new Map();
    this.userAgent = this.parseUserAgent();
    
    // Initialize if analytics is enabled
    this.initialize();
  }

  initialize() {
    // Enable analytics in production or if explicitly enabled
    this.isEnabled = import.meta.env.PROD || localStorage.getItem('analytics-enabled') === 'true';
    
    if (this.isEnabled) {
      console.log('[Analytics] Service initialized');
      this.startPerformanceMonitoring();
      this.trackPageLoad();
      this.setupEventListeners();
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  parseUserAgent() {
    const ua = navigator.userAgent;
    return {
      browser: this.getBrowser(ua),
      os: this.getOS(ua),
      device: this.getDevice(ua),
      isMobile: /Mobile|Android|iPhone|iPad/.test(ua),
      isTablet: /Tablet|iPad/.test(ua)
    };
  }

  getBrowser(ua) {
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  getOS(ua) {
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Unknown';
  }

  getDevice(ua) {
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) {
      if (ua.includes('Mobile')) return 'Android Phone';
      return 'Android Tablet';
    }
    if (ua.includes('Mac')) return 'Mac';
    if (ua.includes('Windows')) return 'PC';
    return 'Unknown';
  }

  // Event tracking
  track(eventName, properties = {}) {
    if (!this.isEnabled) return;

    const event = {
      id: this.generateEventId(),
      sessionId: this.sessionId,
      eventName,
      properties: {
        ...properties,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: this.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        connection: this.getConnectionInfo()
      }
    };

    this.events.push(event);
    console.log('[Analytics] Event tracked:', eventName, properties);

    // Send events in batches to avoid overwhelming the network
    if (this.events.length >= 10) {
      this.flush();
    }
  }

  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Mobile-specific tracking
  trackMobileEvent(eventName, properties = {}) {
    this.track(eventName, {
      ...properties,
      platform: 'mobile',
      deviceOrientation: screen.orientation?.angle || 0,
      touchSupport: 'ontouchstart' in window,
      devicePixelRatio: window.devicePixelRatio || 1
    });
  }

  // Performance monitoring
  startPerformanceMonitoring() {
    // Core Web Vitals
    this.observeWebVitals();
    
    // Custom performance metrics
    this.trackResourceLoading();
    this.trackNetworkConditions();
    
    // Mobile-specific metrics
    if (this.userAgent.isMobile) {
      this.trackMobilePerformance();
    }
  }

  observeWebVitals() {
    // Largest Contentful Paint (LCP)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      this.performanceMetrics.set('LCP', {
        value: lastEntry.startTime,
        timestamp: Date.now(),
        url: lastEntry.url
      });
      
      console.log('[Analytics] LCP:', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        this.performanceMetrics.set('FID', {
          value: entry.processingStart - entry.startTime,
          timestamp: Date.now()
        });
        
        console.log('[Analytics] FID:', entry.processingStart - entry.startTime);
      });
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      
      this.performanceMetrics.set('CLS', {
        value: clsValue,
        timestamp: Date.now()
      });
      
      console.log('[Analytics] CLS:', clsValue);
    }).observe({ entryTypes: ['layout-shift'] });
  }

  trackResourceLoading() {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name.includes('.js') || entry.name.includes('.css')) {
          this.track('resource_loaded', {
            resource: entry.name,
            loadTime: entry.duration,
            size: entry.transferSize || entry.encodedBodySize,
            type: entry.name.includes('.js') ? 'javascript' : 'stylesheet'
          });
        }
      });
    }).observe({ entryTypes: ['resource'] });
  }

  trackNetworkConditions() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      this.track('network_conditions', {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      });

      // Monitor changes
      connection.addEventListener('change', () => {
        this.track('network_change', {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        });
      });
    }
  }

  trackMobilePerformance() {
    // Memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        this.track('mobile_memory_usage', {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          memoryPressure: memory.usedJSHeapSize / memory.jsHeapSizeLimit
        });
      }, 30000); // Every 30 seconds
    }

    // Battery status
    if ('getBattery' in navigator) {
      navigator.getBattery().then((battery) => {
        this.track('battery_status', {
          level: battery.level,
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime
        });

        // Monitor battery changes
        battery.addEventListener('levelchange', () => {
          this.track('battery_level_change', {
            level: battery.level,
            charging: battery.charging
          });
        });
      });
    }

    // Touch events tracking
    let touchStartTime = 0;
    document.addEventListener('touchstart', () => {
      touchStartTime = performance.now();
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (touchStartTime > 0) {
        const touchDuration = performance.now() - touchStartTime;
        this.track('touch_interaction', {
          duration: touchDuration
        });
      }
    }, { passive: true });
  }

  trackPageLoad() {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      
      this.track('page_load', {
        domContentLoadedTime: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        totalTime: navigation.loadEventEnd - navigation.navigationStart,
        transferSize: navigation.transferSize,
        type: navigation.type
      });
    });
  }

  getConnectionInfo() {
    if ('connection' in navigator) {
      const conn = navigator.connection;
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData
      };
    }
    return null;
  }

  setupEventListeners() {
    // Visibility change tracking
    document.addEventListener('visibilitychange', () => {
      this.track('visibility_change', {
        hidden: document.hidden
      });
    });

    // Error tracking
    window.addEventListener('error', (event) => {
      this.track('javascript_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.track('promise_rejection', {
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      });
    });

    // Orientation change (mobile)
    if (this.userAgent.isMobile) {
      window.addEventListener('orientationchange', () => {
        setTimeout(() => {
          this.trackMobileEvent('orientation_change', {
            orientation: screen.orientation?.angle || window.orientation || 0,
            width: window.innerWidth,
            height: window.innerHeight
          });
        }, 100); // Small delay to get accurate dimensions
      });
    }
  }

  // WebRTC specific tracking
  trackWebRTCEvent(eventName, properties = {}) {
    this.track(`webrtc_${eventName}`, {
      ...properties,
      webrtcSupport: this.checkWebRTCSupport()
    });
  }

  checkWebRTCSupport() {
    return {
      rtcPeerConnection: 'RTCPeerConnection' in window,
      getUserMedia: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
      webRTC: 'webkitRTCPeerConnection' in window || 'mozRTCPeerConnection' in window || 'RTCPeerConnection' in window
    };
  }

  trackCallMetrics(metrics) {
    this.track('call_metrics', {
      ...metrics,
      timestamp: Date.now()
    });
  }

  // Batch event sending
  flush() {
    if (!this.isEnabled || this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    // In a real implementation, you would send this to your analytics endpoint
    console.log('[Analytics] Flushing events:', eventsToSend);
    
    // Mock analytics endpoint
    this.sendToAnalytics(eventsToSend);
  }

  async sendToAnalytics(events) {
    try {
      // Mock implementation - replace with your analytics service
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events: events,
          metadata: {
            userAgent: this.userAgent,
            timestamp: Date.now()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`);
      }

      console.log('[Analytics] Events sent successfully');
    } catch (error) {
      console.error('[Analytics] Failed to send events:', error);
      // Re-queue events for retry
      this.events.unshift(...events);
    }
  }

  // Utility methods
  getPerformanceMetric(metric) {
    return this.performanceMetrics.get(metric);
  }

  getAllMetrics() {
    return Object.fromEntries(this.performanceMetrics);
  }

  // Enable/disable analytics
  enable() {
    this.isEnabled = true;
    localStorage.setItem('analytics-enabled', 'true');
    this.initialize();
  }

  disable() {
    this.isEnabled = false;
    localStorage.setItem('analytics-enabled', 'false');
    this.events = [];
    this.performanceMetrics.clear();
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

export default analyticsService;