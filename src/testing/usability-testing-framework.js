// usability-testing-framework.js - Comprehensive UX testing and analytics
import { useEffect, useRef, useState, useCallback } from 'react';

// Core usability testing framework
export class UsabilityTestingFramework {
  constructor(options = {}) {
    this.isEnabled = options.enabled !== false;
    this.userId = options.userId || this.generateUserId();
    this.sessionId = this.generateSessionId();
    this.testingEndpoint = options.endpoint || '/api/usability-data';
    this.debugMode = options.debug || false;
    
    this.events = [];
    this.interactions = [];
    this.errors = [];
    this.performanceMetrics = {};
    
    // Task completion tracking
    this.currentTasks = new Map();
    this.completedTasks = new Map();
    
    // Accessibility tracking
    this.accessibilityEvents = [];
    this.keyboardInteractions = [];
    
    // Device and context information
    this.deviceInfo = this.getDeviceInfo();
    this.contextInfo = this.getContextInfo();
    
    this.initializeTracking();
  }

  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      touchSupport: 'ontouchstart' in window,
      connectionType: navigator.connection?.effectiveType || 'unknown',
      deviceMemory: navigator.deviceMemory || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
    };
  }

  getContextInfo() {
    return {
      url: window.location.href,
      referrer: document.referrer,
      timestamp: Date.now(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      highContrast: window.matchMedia('(prefers-contrast: high)').matches
    };
  }

  initializeTracking() {
    if (!this.isEnabled) return;

    // Track page interactions
    this.trackPageEvents();
    
    // Track form interactions
    this.trackFormEvents();
    
    // Track navigation patterns
    this.trackNavigationEvents();
    
    // Track accessibility interactions
    this.trackAccessibilityEvents();
    
    // Track performance metrics
    this.trackPerformanceMetrics();
    
    // Track errors
    this.trackErrorEvents();

    // Start session
    this.trackEvent('session_start', {
      userId: this.userId,
      sessionId: this.sessionId,
      deviceInfo: this.deviceInfo,
      contextInfo: this.contextInfo
    });
  }

  // Core event tracking
  trackEvent(eventType, data = {}) {
    if (!this.isEnabled) return;

    const event = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      url: window.location.href,
      data: {
        ...data,
        performanceNow: performance.now()
      }
    };

    this.events.push(event);

    if (this.debugMode) {
      console.log('Usability Event:', event);
    }

    // Send to analytics if configured
    this.sendEventToAnalytics(event);
  }

  // Task completion tracking
  startTask(taskId, taskName, taskDescription = '') {
    const task = {
      id: taskId,
      name: taskName,
      description: taskDescription,
      startTime: Date.now(),
      startPerformance: performance.now(),
      steps: [],
      completed: false,
      abandoned: false,
      errors: []
    };

    this.currentTasks.set(taskId, task);
    
    this.trackEvent('task_started', {
      taskId,
      taskName,
      taskDescription
    });

    return task;
  }

  addTaskStep(taskId, stepName, stepData = {}) {
    const task = this.currentTasks.get(taskId);
    if (!task) return;

    const step = {
      name: stepName,
      timestamp: Date.now(),
      performanceNow: performance.now(),
      data: stepData
    };

    task.steps.push(step);

    this.trackEvent('task_step', {
      taskId,
      stepName,
      stepIndex: task.steps.length - 1,
      ...stepData
    });
  }

  completeTask(taskId, success = true, completionData = {}) {
    const task = this.currentTasks.get(taskId);
    if (!task) return;

    const endTime = Date.now();
    const endPerformance = performance.now();

    task.completed = success;
    task.endTime = endTime;
    task.endPerformance = endPerformance;
    task.duration = endTime - task.startTime;
    task.performanceDuration = endPerformance - task.startPerformance;
    task.completionData = completionData;

    this.completedTasks.set(taskId, task);
    this.currentTasks.delete(taskId);

    this.trackEvent('task_completed', {
      taskId,
      taskName: task.name,
      success,
      duration: task.duration,
      performanceDuration: task.performanceDuration,
      stepCount: task.steps.length,
      errorCount: task.errors.length,
      ...completionData
    });

    return task;
  }

  abandonTask(taskId, reason = '') {
    const task = this.currentTasks.get(taskId);
    if (!task) return;

    task.abandoned = true;
    task.abandonReason = reason;
    task.abandonTime = Date.now();

    this.trackEvent('task_abandoned', {
      taskId,
      taskName: task.name,
      reason,
      duration: task.abandonTime - task.startTime,
      stepCount: task.steps.length,
      errorCount: task.errors.length
    });

    this.currentTasks.delete(taskId);
    return task;
  }

  // Page interaction tracking
  trackPageEvents() {
    // Click tracking
    document.addEventListener('click', (event) => {
      this.trackEvent('click', {
        element: this.getElementInfo(event.target),
        coordinates: { x: event.clientX, y: event.clientY },
        modifiers: {
          ctrl: event.ctrlKey,
          alt: event.altKey,
          shift: event.shiftKey,
          meta: event.metaKey
        }
      });
    });

    // Scroll tracking
    let scrollTimeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.trackEvent('scroll', {
          scrollY: window.scrollY,
          scrollX: window.scrollX,
          documentHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
          scrollPercentage: (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        });
      }, 100);
    });

    // Focus tracking
    document.addEventListener('focusin', (event) => {
      this.trackEvent('focus_in', {
        element: this.getElementInfo(event.target),
        focusMethod: event.target.matches(':focus-visible') ? 'keyboard' : 'mouse'
      });
    });

    // Resize tracking
    window.addEventListener('resize', () => {
      this.trackEvent('viewport_resize', {
        newSize: `${window.innerWidth}x${window.innerHeight}`,
        devicePixelRatio: window.devicePixelRatio
      });
    });

    // Visibility change tracking
    document.addEventListener('visibilitychange', () => {
      this.trackEvent('visibility_change', {
        hidden: document.hidden,
        visibilityState: document.visibilityState
      });
    });
  }

  // Form interaction tracking
  trackFormEvents() {
    // Form submission tracking
    document.addEventListener('submit', (event) => {
      const form = event.target;
      const formData = new FormData(form);
      const formFields = {};
      
      for (let [key, value] of formData.entries()) {
        // Don't log sensitive data
        if (this.isSensitiveField(key)) {
          formFields[key] = '[REDACTED]';
        } else {
          formFields[key] = value;
        }
      }

      this.trackEvent('form_submit', {
        formId: form.id,
        formAction: form.action,
        formMethod: form.method,
        fieldCount: Object.keys(formFields).length,
        fields: formFields
      });
    });

    // Input tracking
    let inputTimeout;
    document.addEventListener('input', (event) => {
      clearTimeout(inputTimeout);
      inputTimeout = setTimeout(() => {
        if (this.isSensitiveField(event.target.name)) return;

        this.trackEvent('input_interaction', {
          element: this.getElementInfo(event.target),
          valueLength: event.target.value.length,
          inputType: event.target.type
        });
      }, 500);
    });
  }

  // Navigation pattern tracking
  trackNavigationEvents() {
    // Page navigation
    window.addEventListener('beforeunload', () => {
      this.trackEvent('page_unload', {
        timeOnPage: Date.now() - this.contextInfo.timestamp,
        scrollDepth: this.getMaxScrollDepth()
      });
    });

    // Hash change tracking
    window.addEventListener('hashchange', (event) => {
      this.trackEvent('hash_change', {
        oldURL: event.oldURL,
        newURL: event.newURL
      });
    });

    // Back/forward navigation
    window.addEventListener('popstate', (event) => {
      this.trackEvent('navigation_popstate', {
        state: event.state,
        url: window.location.href
      });
    });
  }

  // Accessibility interaction tracking
  trackAccessibilityEvents() {
    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
      // Track important accessibility keys
      const accessibilityKeys = ['Tab', 'Shift', 'Enter', 'Space', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
      
      if (accessibilityKeys.includes(event.key)) {
        this.keyboardInteractions.push({
          key: event.key,
          timestamp: Date.now(),
          element: this.getElementInfo(event.target),
          modifiers: {
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey,
            meta: event.metaKey
          }
        });

        this.trackEvent('keyboard_navigation', {
          key: event.key,
          element: this.getElementInfo(event.target),
          modifiers: {
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey,
            meta: event.metaKey
          }
        });
      }
    });

    // Screen reader detection
    if (this.detectScreenReader()) {
      this.trackEvent('screen_reader_detected', {
        userAgent: navigator.userAgent
      });
    }
  }

  // Performance metrics tracking
  trackPerformanceMetrics() {
    // Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          this.trackEvent('performance_lcp', {
            value: entry.startTime,
            element: entry.element?.tagName || 'unknown'
          });
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // First Input Delay (FID)
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          this.trackEvent('performance_fid', {
            value: entry.processingStart - entry.startTime,
            name: entry.name
          });
        }
      }).observe({ type: 'first-input', buffered: true });

      // Cumulative Layout Shift (CLS)
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            this.trackEvent('performance_cls', {
              value: entry.value,
              sources: entry.sources?.map(source => ({
                element: source.node?.tagName || 'unknown'
              })) || []
            });
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    }

    // Custom performance tracking
    const observer = new MutationObserver(() => {
      this.performanceMetrics.domNodes = document.querySelectorAll('*').length;
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  // Error tracking
  trackErrorEvents() {
    window.addEventListener('error', (event) => {
      this.errors.push({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: Date.now()
      });

      this.trackEvent('error_javascript', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.errors.push({
        type: 'promise_rejection',
        reason: event.reason?.toString(),
        timestamp: Date.now()
      });

      this.trackEvent('error_promise_rejection', {
        reason: event.reason?.toString()
      });
    });
  }

  // Utility methods
  getElementInfo(element) {
    return {
      tagName: element.tagName?.toLowerCase(),
      id: element.id,
      className: element.className,
      textContent: element.textContent?.substring(0, 100),
      role: element.getAttribute('role'),
      ariaLabel: element.getAttribute('aria-label'),
      ariaDescribedby: element.getAttribute('aria-describedby'),
      type: element.type,
      name: element.name
    };
  }

  isSensitiveField(fieldName) {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /ssn/i,
      /credit/i,
      /card/i,
      /cvv/i,
      /pin/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(fieldName));
  }

  detectScreenReader() {
    return Boolean(
      navigator.userAgent.includes('NVDA') ||
      navigator.userAgent.includes('JAWS') ||
      window.speechSynthesis ||
      document.body.getAttribute('role') === 'application'
    );
  }

  getMaxScrollDepth() {
    const documentHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = documentHeight - viewportHeight;
    
    if (maxScroll <= 0) return 100;
    
    return (window.scrollY / maxScroll) * 100;
  }

  // Analytics integration
  sendEventToAnalytics(event) {
    if (!this.testingEndpoint) return;

    // Batch events to reduce network requests
    if (!this.eventBatch) {
      this.eventBatch = [];
    }
    
    this.eventBatch.push(event);

    // Send batch every 10 events or 30 seconds
    if (this.eventBatch.length >= 10) {
      this.flushEventBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushEventBatch();
      }, 30000);
    }
  }

  flushEventBatch() {
    if (!this.eventBatch || this.eventBatch.length === 0) return;

    fetch(this.testingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: this.sessionId,
        userId: this.userId,
        events: this.eventBatch,
        timestamp: Date.now()
      })
    }).catch(error => {
      if (this.debugMode) {
        console.error('Failed to send usability data:', error);
      }
    });

    this.eventBatch = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  // Data export and reporting
  exportData() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      deviceInfo: this.deviceInfo,
      contextInfo: this.contextInfo,
      events: this.events,
      interactions: this.interactions,
      errors: this.errors,
      performanceMetrics: this.performanceMetrics,
      completedTasks: Array.from(this.completedTasks.values()),
      keyboardInteractions: this.keyboardInteractions,
      accessibilityEvents: this.accessibilityEvents
    };
  }

  generateReport() {
    const data = this.exportData();
    const report = {
      summary: {
        sessionDuration: Date.now() - this.contextInfo.timestamp,
        totalEvents: this.events.length,
        totalErrors: this.errors.length,
        tasksCompleted: data.completedTasks.filter(task => task.completed).length,
        tasksAbandoned: data.completedTasks.filter(task => task.abandoned).length,
        keyboardInteractionCount: this.keyboardInteractions.length,
        screenReaderDetected: this.detectScreenReader()
      },
      recommendations: this.generateRecommendations(data)
    };

    return report;
  }

  generateRecommendations(data) {
    const recommendations = [];

    // Task completion analysis
    const completedTasks = data.completedTasks;
    const averageTaskTime = completedTasks.reduce((sum, task) => sum + (task.duration || 0), 0) / completedTasks.length;
    
    if (averageTaskTime > 30000) { // 30 seconds
      recommendations.push({
        type: 'task_efficiency',
        priority: 'high',
        message: 'Tasks are taking longer than expected to complete. Consider simplifying user flows.',
        data: { averageTaskTime }
      });
    }

    // Error rate analysis
    if (this.errors.length > 0) {
      recommendations.push({
        type: 'error_handling',
        priority: 'high',
        message: 'JavaScript errors detected. These may impact user experience.',
        data: { errorCount: this.errors.length }
      });
    }

    // Accessibility analysis
    if (this.keyboardInteractions.length > 0) {
      recommendations.push({
        type: 'accessibility',
        priority: 'medium',
        message: 'Keyboard navigation detected. Ensure all interactive elements are accessible.',
        data: { keyboardInteractionCount: this.keyboardInteractions.length }
      });
    }

    return recommendations;
  }
}

// React hook for usability testing
export const useUsabilityTesting = (options = {}) => {
  const frameworkRef = useRef(null);
  const [isEnabled, setIsEnabled] = useState(options.enabled !== false);

  useEffect(() => {
    if (isEnabled && !frameworkRef.current) {
      frameworkRef.current = new UsabilityTestingFramework(options);
    }

    return () => {
      if (frameworkRef.current) {
        frameworkRef.current.flushEventBatch();
      }
    };
  }, [isEnabled, options]);

  const trackEvent = useCallback((eventType, data) => {
    if (frameworkRef.current) {
      frameworkRef.current.trackEvent(eventType, data);
    }
  }, []);

  const startTask = useCallback((taskId, taskName, taskDescription) => {
    if (frameworkRef.current) {
      return frameworkRef.current.startTask(taskId, taskName, taskDescription);
    }
  }, []);

  const completeTask = useCallback((taskId, success, completionData) => {
    if (frameworkRef.current) {
      return frameworkRef.current.completeTask(taskId, success, completionData);
    }
  }, []);

  const abandonTask = useCallback((taskId, reason) => {
    if (frameworkRef.current) {
      return frameworkRef.current.abandonTask(taskId, reason);
    }
  }, []);

  const addTaskStep = useCallback((taskId, stepName, stepData) => {
    if (frameworkRef.current) {
      return frameworkRef.current.addTaskStep(taskId, stepName, stepData);
    }
  }, []);

  const generateReport = useCallback(() => {
    if (frameworkRef.current) {
      return frameworkRef.current.generateReport();
    }
    return null;
  }, []);

  return {
    trackEvent,
    startTask,
    completeTask,
    abandonTask,
    addTaskStep,
    generateReport,
    isEnabled,
    setIsEnabled
  };
};