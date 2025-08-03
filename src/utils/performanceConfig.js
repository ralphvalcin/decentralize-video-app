// Production Performance Monitoring Configuration
// This file configures external monitoring services and advanced analytics

const PERFORMANCE_CONFIG = {
  // Enable/disable monitoring features
  monitoring: {
    enabled: true,
    webRTCStats: true,
    socketIOTracking: true,
    userAnalytics: true,
    performanceAlerts: true,
    coreWebVitals: true,
    errorTracking: true
  },

  // Sampling rates to reduce overhead
  sampling: {
    webRTCStatsInterval: 2000, // 2 seconds
    systemMetricsInterval: 5000, // 5 seconds
    userInteractionSampling: 1.0, // 100% of interactions
    errorSampling: 1.0, // 100% of errors
    performanceSampling: 0.1 // 10% of performance events
  },

  // Performance budgets and thresholds
  budgets: {
    // Core Web Vitals
    largestContentfulPaint: 2500, // ms
    firstInputDelay: 100, // ms
    cumulativeLayoutShift: 0.1,
    
    // Custom metrics
    connectionTime: 3000, // ms
    renderTime: 16, // ms (60 FPS)
    memoryUsage: 150, // MB
    packetLoss: 5, // %
    latency: 200, // ms
    videoFrameRate: 24, // fps minimum
    audioLevel: -20, // dB
    bandwidthUsage: 2000, // Kbps
    
    // User experience
    interactionLatency: 100, // ms
    errorRate: 0.01, // 1%
    sessionDuration: 1800000 // 30 minutes maximum
  },

  // Alert configurations
  alerts: {
    enabled: true,
    levels: {
      warning: {
        memoryUsage: 100, // MB
        latency: 300, // ms
        packetLoss: 3, // %
        frameRate: 20 // fps
      },
      critical: {
        memoryUsage: 200, // MB
        latency: 500, // ms
        packetLoss: 10, // %
        frameRate: 15 // fps
      }
    },
    maxAlerts: 20,
    alertCooldown: 30000 // 30 seconds
  },

  // External monitoring service configurations
  externalServices: {
    // Google Analytics 4
    googleAnalytics: {
      enabled: false,
      measurementId: process.env.REACT_APP_GA_MEASUREMENT_ID,
      trackPerformance: true,
      trackErrors: true,
      trackUserFlow: true
    },

    // Sentry for error tracking
    sentry: {
      enabled: false,
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.1
    },

    // DataDog Real User Monitoring
    datadog: {
      enabled: false,
      clientToken: process.env.REACT_APP_DATADOG_CLIENT_TOKEN,
      applicationId: process.env.REACT_APP_DATADOG_APP_ID,
      site: 'datadoghq.com',
      service: 'video-chat-app',
      version: process.env.REACT_APP_VERSION || '1.0.0',
      sampleRate: 100,
      trackInteractions: true,
      trackResources: true,
      trackLongTasks: true
    },

    // New Relic Browser
    newRelic: {
      enabled: false,
      licenseKey: process.env.REACT_APP_NEWRELIC_LICENSE_KEY,
      applicationId: process.env.REACT_APP_NEWRELIC_APP_ID,
      beacon: 'bam.nr-data.net'
    },

    // Custom webhook for alerts
    webhook: {
      enabled: false,
      url: process.env.REACT_APP_PERFORMANCE_WEBHOOK_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REACT_APP_WEBHOOK_TOKEN}`
      }
    }
  },

  // Data retention and export
  dataManagement: {
    maxEvents: 1000,
    maxMetrics: 500,
    retentionDays: 7,
    exportEnabled: true,
    exportFormat: 'json',
    compressionEnabled: true
  },

  // Privacy and compliance
  privacy: {
    anonymizeUserData: true,
    excludePII: true,
    cookieConsent: true,
    dataProcessingLocation: 'EU' // or 'US'
  }
};

// Performance monitoring initialization
export const initializePerformanceMonitoring = () => {
  if (!PERFORMANCE_CONFIG.monitoring.enabled) {
    console.log('Performance monitoring is disabled');
    return;
  }

  // Initialize Google Analytics 4
  if (PERFORMANCE_CONFIG.externalServices.googleAnalytics.enabled) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${PERFORMANCE_CONFIG.externalServices.googleAnalytics.measurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', PERFORMANCE_CONFIG.externalServices.googleAnalytics.measurementId, {
      send_page_view: false,
      custom_map: {
        'custom_parameter_1': 'video_call_duration',
        'custom_parameter_2': 'connection_quality'
      }
    });
    window.gtag = gtag;
  }

  // Initialize Sentry
  if (PERFORMANCE_CONFIG.externalServices.sentry.enabled) {
    import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: PERFORMANCE_CONFIG.externalServices.sentry.dsn,
        environment: PERFORMANCE_CONFIG.externalServices.sentry.environment,
        tracesSampleRate: PERFORMANCE_CONFIG.externalServices.sentry.tracesSampleRate,
        profilesSampleRate: PERFORMANCE_CONFIG.externalServices.sentry.profilesSampleRate,
        beforeSend(event, hint) {
          // Filter out noise and PII
          if (event.exception) {
            const error = hint.originalException;
            if (error && error.message && error.message.includes('Non-Error promise rejection')) {
              return null;
            }
          }
          return event;
        }
      });
    });
  }

  // Initialize DataDog RUM
  if (PERFORMANCE_CONFIG.externalServices.datadog.enabled) {
    const script = document.createElement('script');
    script.src = 'https://www.datadoghq-browser-agent.com/datadog-rum.js';
    script.onload = () => {
      window.DD_RUM.init({
        clientToken: PERFORMANCE_CONFIG.externalServices.datadog.clientToken,
        applicationId: PERFORMANCE_CONFIG.externalServices.datadog.applicationId,
        site: PERFORMANCE_CONFIG.externalServices.datadog.site,
        service: PERFORMANCE_CONFIG.externalServices.datadog.service,
        version: PERFORMANCE_CONFIG.externalServices.datadog.version,
        sampleRate: PERFORMANCE_CONFIG.externalServices.datadog.sampleRate,
        trackInteractions: PERFORMANCE_CONFIG.externalServices.datadog.trackInteractions,
        trackResources: PERFORMANCE_CONFIG.externalServices.datadog.trackResources,
        trackLongTasks: PERFORMANCE_CONFIG.externalServices.datadog.trackLongTasks
      });
    };
    document.head.appendChild(script);
  }

  console.log('Performance monitoring initialized');
};

// Custom event tracking for external services
export const trackCustomEvent = (eventName, properties = {}) => {
  // Google Analytics
  if (window.gtag && PERFORMANCE_CONFIG.externalServices.googleAnalytics.enabled) {
    window.gtag('event', eventName, properties);
  }

  // DataDog
  if (window.DD_RUM && PERFORMANCE_CONFIG.externalServices.datadog.enabled) {
    window.DD_RUM.addAction(eventName, properties);
  }

  // Webhook
  if (PERFORMANCE_CONFIG.externalServices.webhook.enabled) {
    fetch(PERFORMANCE_CONFIG.externalServices.webhook.url, {
      method: 'POST',
      headers: PERFORMANCE_CONFIG.externalServices.webhook.headers,
      body: JSON.stringify({
        event: eventName,
        properties,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      })
    }).catch(error => console.warn('Failed to send webhook event:', error));
  }
};

// Performance data export
export const exportPerformanceData = () => {
  if (!PERFORMANCE_CONFIG.dataManagement.exportEnabled) {
    return null;
  }

  const data = {
    metrics: window.PerformanceTracker?.getMetrics() || {},
    events: window.PerformanceTracker?.getEvents() || [],
    budgetViolations: window.PerformanceTracker?.getBudgetViolations() || [],
    sessionInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      timestamp: Date.now(),
      sessionDuration: Date.now() - (window.PerformanceTracker?.sessionStartTime || Date.now())
    }
  };

  const filename = `performance-data-${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
  return data;
};

// Performance summary for debugging
export const getPerformanceSummary = () => {
  const metrics = window.PerformanceTracker?.getMetrics() || {};
  const events = window.PerformanceTracker?.getEvents() || [];
  const violations = window.PerformanceTracker?.getBudgetViolations() || [];

  return {
    sessionDuration: Date.now() - (window.PerformanceTracker?.sessionStartTime || Date.now()),
    totalEvents: events.length,
    totalViolations: violations.length,
    criticalViolations: violations.filter(v => v.severity === 'critical').length,
    keyMetrics: {
      memoryUsage: metrics.memoryUsage?.value || 0,
      averageLatency: metrics.latency?.value || 0,
      frameRate: metrics.videoFrameRate?.value || 0,
      packetLoss: metrics.packetLoss?.value || 0
    },
    performanceScore: calculatePerformanceScore(metrics, violations)
  };
};

// Calculate overall performance score (0-100)
const calculatePerformanceScore = (metrics, violations) => {
  let score = 100;

  // Deduct points for budget violations
  violations.forEach(violation => {
    switch (violation.severity) {
      case 'critical':
        score -= 10;
        break;
      case 'high':
        score -= 5;
        break;
      case 'medium':
        score -= 2;
        break;
    }
  });

  // Deduct points for poor metrics
  const memoryUsage = metrics.memoryUsage?.value || 0;
  if (memoryUsage > PERFORMANCE_CONFIG.budgets.memoryUsage) {
    score -= Math.min(20, (memoryUsage - PERFORMANCE_CONFIG.budgets.memoryUsage) / 10);
  }

  const latency = metrics.latency?.value || 0;
  if (latency > PERFORMANCE_CONFIG.budgets.latency) {
    score -= Math.min(15, (latency - PERFORMANCE_CONFIG.budgets.latency) / 20);
  }

  return Math.max(0, Math.round(score));
};

export default PERFORMANCE_CONFIG;