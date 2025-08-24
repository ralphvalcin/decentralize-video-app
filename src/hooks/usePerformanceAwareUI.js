// usePerformanceAwareUI.js - Performance-conscious UI optimization hooks
import { useState, useEffect, useCallback, useRef } from 'react';

// Main hook for performance-aware UI optimizations
export const usePerformanceAwareUI = (options = {}) => {
  const {
    enableAdaptiveQuality = true,
    enableBatteryOptimization = true,
    enableNetworkAdaptation = true,
    enableMemoryOptimization = true,
    performanceThreshold = 'medium' // 'low', 'medium', 'high'
  } = options;

  const [performanceState, setPerformanceState] = useState({
    level: 'high', // 'low', 'medium', 'high'
    batteryLevel: null,
    isCharging: false,
    networkType: 'unknown',
    memoryPressure: false,
    cpuPressure: false,
    thermalState: 'nominal',
    recommendations: []
  });

  const performanceMetrics = useRef({
    frameDrops: 0,
    lastFrameTime: performance.now(),
    renderTimes: [],
    memoryUsage: [],
    networkLatency: []
  });

  // Initialize performance monitoring
  useEffect(() => {
    const updatePerformanceState = async () => {
      const newState = { ...performanceState };

      // Battery API
      if (enableBatteryOptimization && 'getBattery' in navigator) {
        try {
          const battery = await navigator.getBattery();
          newState.batteryLevel = battery.level;
          newState.isCharging = battery.charging;
        } catch (error) {
          console.warn('Battery API not available:', error);
        }
      }

      // Network Information API
      if (enableNetworkAdaptation && 'connection' in navigator) {
        const connection = navigator.connection;
        newState.networkType = connection.effectiveType;
        newState.downlink = connection.downlink;
        newState.rtt = connection.rtt;
      }

      // Memory API (Chrome)
      if (enableMemoryOptimization && 'memory' in performance) {
        const memInfo = performance.memory;
        const memoryUsageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
        newState.memoryPressure = memoryUsageRatio > 0.8;
        
        performanceMetrics.current.memoryUsage.push({
          timestamp: Date.now(),
          ratio: memoryUsageRatio,
          used: memInfo.usedJSHeapSize,
          limit: memInfo.jsHeapSizeLimit
        });
      }

      // Calculate overall performance level
      newState.level = calculatePerformanceLevel(newState);
      newState.recommendations = generateRecommendations(newState);

      setPerformanceState(newState);
    };

    updatePerformanceState();

    // Monitor performance changes
    const interval = setInterval(updatePerformanceState, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [enableAdaptiveQuality, enableBatteryOptimization, enableNetworkAdaptation, enableMemoryOptimization]);

  // Frame rate monitoring
  useEffect(() => {
    if (!enableAdaptiveQuality) return;

    const monitorFrameRate = () => {
      const now = performance.now();
      const frameTime = now - performanceMetrics.current.lastFrameTime;
      performanceMetrics.current.lastFrameTime = now;

      // Track render times
      performanceMetrics.current.renderTimes.push(frameTime);
      if (performanceMetrics.current.renderTimes.length > 60) {
        performanceMetrics.current.renderTimes.shift();
      }

      // Detect frame drops (>16.67ms for 60fps)
      if (frameTime > 16.67) {
        performanceMetrics.current.frameDrops++;
      }

      // Continue monitoring
      requestAnimationFrame(monitorFrameRate);
    };

    const animationId = requestAnimationFrame(monitorFrameRate);
    return () => cancelAnimationFrame(animationId);
  }, [enableAdaptiveQuality]);

  // Calculate performance level based on various factors
  const calculatePerformanceLevel = (state) => {
    let score = 100; // Start with perfect score

    // Battery impact
    if (state.batteryLevel !== null) {
      if (state.batteryLevel < 0.2 && !state.isCharging) score -= 30;
      else if (state.batteryLevel < 0.5 && !state.isCharging) score -= 15;
    }

    // Network impact
    switch (state.networkType) {
      case 'slow-2g':
      case '2g':
        score -= 40;
        break;
      case '3g':
        score -= 20;
        break;
      case '4g':
      default:
        // No penalty for good connections
        break;
    }

    // Memory pressure impact
    if (state.memoryPressure) score -= 25;

    // Frame rate impact
    const avgFrameTime = performanceMetrics.current.renderTimes.length > 0
      ? performanceMetrics.current.renderTimes.reduce((a, b) => a + b, 0) / performanceMetrics.current.renderTimes.length
      : 16.67;
    
    if (avgFrameTime > 33.33) score -= 30; // Below 30fps
    else if (avgFrameTime > 16.67) score -= 15; // Below 60fps

    // Determine level
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  };

  // Generate performance recommendations
  const generateRecommendations = (state) => {
    const recommendations = [];

    if (state.batteryLevel !== null && state.batteryLevel < 0.3 && !state.isCharging) {
      recommendations.push({
        type: 'battery',
        priority: 'high',
        message: 'Battery level is low. Consider reducing video quality or frame rate.',
        action: 'reduce_quality'
      });
    }

    if (state.networkType === 'slow-2g' || state.networkType === '2g') {
      recommendations.push({
        type: 'network',
        priority: 'high',
        message: 'Slow network detected. Consider audio-only mode or reduced quality.',
        action: 'reduce_bandwidth'
      });
    }

    if (state.memoryPressure) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: 'High memory usage detected. Consider closing other applications.',
        action: 'optimize_memory'
      });
    }

    const avgFrameTime = performanceMetrics.current.renderTimes.length > 0
      ? performanceMetrics.current.renderTimes.reduce((a, b) => a + b, 0) / performanceMetrics.current.renderTimes.length
      : 16.67;

    if (avgFrameTime > 33.33) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Low frame rate detected. Consider reducing UI complexity.',
        action: 'simplify_ui'
      });
    }

    return recommendations;
  };

  // Get adaptive UI settings based on performance
  const getAdaptiveUISettings = useCallback(() => {
    const { level, batteryLevel, isCharging, networkType, memoryPressure } = performanceState;

    const settings = {
      // Animation settings
      enableAnimations: level === 'high',
      reducedAnimations: level === 'medium',
      disableAnimations: level === 'low',
      
      // Video quality settings
      maxVideoQuality: level === 'high' ? '720p' : level === 'medium' ? '480p' : '360p',
      maxFrameRate: level === 'high' ? 30 : level === 'medium' ? 20 : 15,
      
      // UI complexity settings
      showAdvancedUI: level === 'high',
      simplifyUI: level === 'low',
      
      // Feature availability
      enableAutoRefresh: level === 'high',
      reducePollingFrequency: level === 'medium' || level === 'low',
      
      // Battery-specific optimizations
      darkModeRecommended: batteryLevel < 0.3 && !isCharging,
      reduceBackgroundActivity: batteryLevel < 0.2 && !isCharging,
      
      // Network-specific optimizations
      preloadContent: networkType === '4g' || networkType === 'wifi',
      compressData: networkType === '3g' || networkType === '2g' || networkType === 'slow-2g',
      
      // Memory-specific optimizations
      limitConcurrentConnections: memoryPressure,
      clearCaches: memoryPressure
    };

    return settings;
  }, [performanceState]);

  // Apply performance optimizations
  const applyOptimizations = useCallback((element, optimizations = {}) => {
    if (!element) return;

    const settings = getAdaptiveUISettings();
    
    // Animation optimizations
    if (settings.disableAnimations) {
      element.style.setProperty('animation', 'none', 'important');
      element.style.setProperty('transition', 'none', 'important');
    } else if (settings.reducedAnimations) {
      element.style.setProperty('animation-duration', '0.1s', 'important');
      element.style.setProperty('transition-duration', '0.1s', 'important');
    }

    // Memory optimizations
    if (settings.clearCaches && element.querySelector) {
      // Remove unnecessary DOM elements
      const hiddenElements = element.querySelectorAll('[style*="display: none"]');
      hiddenElements.forEach(el => {
        if (el.dataset.performanceOptimized !== 'true') {
          el.remove();
        }
      });
    }

    // Apply custom optimizations
    if (optimizations.simplifyContent && settings.simplifyUI) {
      element.classList.add('simplified-ui');
    }

    if (optimizations.reduceVisualEffects && (settings.reducedAnimations || settings.disableAnimations)) {
      element.classList.add('reduced-effects');
    }

  }, [getAdaptiveUISettings]);

  // Performance-aware component renderer
  const PerformanceAwareComponent = useCallback(({ 
    children, 
    highPerformanceRender, 
    mediumPerformanceRender, 
    lowPerformanceRender,
    fallbackRender
  }) => {
    const { level } = performanceState;
    
    switch (level) {
      case 'high':
        return highPerformanceRender || children;
      case 'medium':
        return mediumPerformanceRender || children;
      case 'low':
        return lowPerformanceRender || fallbackRender || children;
      default:
        return fallbackRender || children;
    }
  }, [performanceState]);

  // Get performance-aware CSS classes
  const getPerformanceClasses = useCallback(() => {
    const settings = getAdaptiveUISettings();
    const classes = [];

    if (settings.disableAnimations) classes.push('no-animations');
    if (settings.reducedAnimations) classes.push('reduced-animations');
    if (settings.simplifyUI) classes.push('simplified-ui');
    if (settings.darkModeRecommended) classes.push('battery-save-mode');
    if (settings.reduceBackgroundActivity) classes.push('minimal-activity');

    return classes.join(' ');
  }, [getAdaptiveUISettings]);

  // Memory cleanup utilities
  const cleanupMemory = useCallback(() => {
    // Clear render time history
    performanceMetrics.current.renderTimes = performanceMetrics.current.renderTimes.slice(-30);
    performanceMetrics.current.memoryUsage = performanceMetrics.current.memoryUsage.slice(-30);
    performanceMetrics.current.networkLatency = performanceMetrics.current.networkLatency.slice(-30);

    // Force garbage collection if available (Chrome DevTools)
    if (window.gc && typeof window.gc === 'function') {
      window.gc();
    }

    // Clear unused images
    const images = document.querySelectorAll('img[data-performance-cleanup="true"]');
    images.forEach(img => {
      if (!img.getBoundingClientRect().width) {
        img.removeAttribute('src');
      }
    });

  }, []);

  // Network optimization utilities
  const optimizeForNetwork = useCallback((requests = []) => {
    const settings = getAdaptiveUISettings();
    
    if (settings.compressData) {
      return requests.map(request => ({
        ...request,
        headers: {
          ...request.headers,
          'Accept-Encoding': 'gzip, deflate, br'
        },
        compress: true
      }));
    }

    if (settings.limitConcurrentConnections) {
      // Batch requests to reduce concurrent connections
      const batchSize = 3;
      const batches = [];
      for (let i = 0; i < requests.length; i += batchSize) {
        batches.push(requests.slice(i, i + batchSize));
      }
      return batches;
    }

    return requests;
  }, [getAdaptiveUISettings]);

  return {
    performanceState,
    performanceLevel: performanceState.level,
    recommendations: performanceState.recommendations,
    getAdaptiveUISettings,
    applyOptimizations,
    PerformanceAwareComponent,
    getPerformanceClasses,
    cleanupMemory,
    optimizeForNetwork,
    metrics: performanceMetrics.current
  };
};

// Hook for component-level performance monitoring
export const useComponentPerformance = (componentName) => {
  const renderCount = useRef(0);
  const renderTimes = useRef([]);
  const mountTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current++;
    const renderTime = performance.now() - mountTime.current;
    renderTimes.current.push(renderTime);

    // Keep only last 50 render times
    if (renderTimes.current.length > 50) {
      renderTimes.current.shift();
    }

    // Log performance warnings
    if (renderTime > 100) { // 100ms threshold
      console.warn(`${componentName} took ${renderTime.toFixed(2)}ms to render`);
    }
  });

  const getPerformanceData = useCallback(() => {
    const avgRenderTime = renderTimes.current.length > 0
      ? renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length
      : 0;

    return {
      componentName,
      renderCount: renderCount.current,
      averageRenderTime: avgRenderTime,
      lastRenderTime: renderTimes.current[renderTimes.current.length - 1] || 0,
      totalLifetime: performance.now() - mountTime.current
    };
  }, [componentName]);

  return {
    getPerformanceData,
    renderCount: renderCount.current
  };
};

// Hook for adaptive loading strategies
export const useAdaptiveLoading = () => {
  const [loadingStrategy, setLoadingStrategy] = useState('progressive');
  
  const { performanceLevel, getAdaptiveUISettings } = usePerformanceAwareUI();

  useEffect(() => {
    const settings = getAdaptiveUISettings();
    
    if (performanceLevel === 'low' || settings.compressData) {
      setLoadingStrategy('minimal');
    } else if (performanceLevel === 'medium') {
      setLoadingStrategy('progressive');
    } else {
      setLoadingStrategy('preload');
    }
  }, [performanceLevel, getAdaptiveUISettings]);

  const getLoadingConfig = useCallback((resourceType) => {
    switch (loadingStrategy) {
      case 'minimal':
        return {
          lazy: true,
          quality: 'low',
          batch: true,
          preload: false,
          concurrent: 1
        };
      case 'progressive':
        return {
          lazy: resourceType !== 'critical',
          quality: 'medium',
          batch: resourceType === 'image',
          preload: resourceType === 'critical',
          concurrent: 3
        };
      case 'preload':
        return {
          lazy: false,
          quality: 'high',
          batch: false,
          preload: true,
          concurrent: 6
        };
      default:
        return {
          lazy: true,
          quality: 'medium',
          batch: true,
          preload: false,
          concurrent: 2
        };
    }
  }, [loadingStrategy]);

  return {
    loadingStrategy,
    getLoadingConfig
  };
};