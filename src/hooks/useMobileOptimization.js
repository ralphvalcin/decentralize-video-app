// useMobileOptimization.js - Mobile performance optimization hooks
import { useEffect, useCallback, useState, useRef } from 'react';

// Hook for mobile-specific performance optimizations
export const useMobileOptimization = () => {
  const [deviceCapabilities, setDeviceCapabilities] = useState({
    isLowEndDevice: false,
    supportsBatteryAPI: 'getBattery' in navigator,
    supportsNetworkAPI: 'connection' in navigator,
    memoryInfo: null,
    batteryLevel: null,
    connectionType: null
  });

  useEffect(() => {
    const assessDeviceCapabilities = async () => {
      const capabilities = { ...deviceCapabilities };

      // Check device memory
      if ('deviceMemory' in navigator) {
        capabilities.memoryInfo = navigator.deviceMemory;
        capabilities.isLowEndDevice = navigator.deviceMemory <= 4;
      }

      // Check hardware concurrency (CPU cores)
      if ('hardwareConcurrency' in navigator) {
        capabilities.cpuCores = navigator.hardwareConcurrency;
        capabilities.isLowEndDevice = capabilities.isLowEndDevice || navigator.hardwareConcurrency <= 2;
      }

      // Battery API
      if (capabilities.supportsBatteryAPI) {
        try {
          const battery = await navigator.getBattery();
          capabilities.batteryLevel = battery.level;
          capabilities.isCharging = battery.charging;
          
          // Monitor battery level changes
          battery.addEventListener('levelchange', () => {
            setDeviceCapabilities(prev => ({
              ...prev,
              batteryLevel: battery.level
            }));
          });
        } catch (error) {
          console.warn('Battery API access denied:', error);
        }
      }

      // Network API
      if (capabilities.supportsNetworkAPI) {
        const connection = navigator.connection;
        capabilities.connectionType = connection.effectiveType;
        capabilities.downlink = connection.downlink;
        
        // Monitor connection changes
        connection.addEventListener('change', () => {
          setDeviceCapabilities(prev => ({
            ...prev,
            connectionType: connection.effectiveType,
            downlink: connection.downlink
          }));
        });
      }

      setDeviceCapabilities(capabilities);
    };

    assessDeviceCapabilities();
  }, []);

  return deviceCapabilities;
};

// Hook for adaptive quality based on device performance
export const useAdaptiveQuality = ({ stream, peers, deviceCapabilities }) => {
  const [qualitySettings, setQualitySettings] = useState({
    video: { width: 640, height: 480, frameRate: 30 },
    audio: { sampleRate: 48000, channelCount: 2 }
  });

  const adaptQuality = useCallback(() => {
    if (!deviceCapabilities) return;

    let newSettings = { ...qualitySettings };

    // Adapt based on device capabilities
    if (deviceCapabilities.isLowEndDevice) {
      newSettings.video = { width: 480, height: 360, frameRate: 15 };
      newSettings.audio = { sampleRate: 44100, channelCount: 1 };
    }

    // Adapt based on battery level
    if (deviceCapabilities.batteryLevel && deviceCapabilities.batteryLevel < 0.2) {
      newSettings.video.frameRate = Math.min(newSettings.video.frameRate, 15);
      newSettings.video.width = Math.min(newSettings.video.width, 480);
    }

    // Adapt based on connection type
    if (deviceCapabilities.connectionType) {
      switch (deviceCapabilities.connectionType) {
        case 'slow-2g':
        case '2g':
          newSettings.video = { width: 320, height: 240, frameRate: 10 };
          break;
        case '3g':
          newSettings.video = { width: 480, height: 360, frameRate: 20 };
          break;
        case '4g':
        default:
          // Keep current settings or improve them
          break;
      }
    }

    // Adapt based on number of participants
    if (peers.length > 4) {
      newSettings.video.frameRate = Math.min(newSettings.video.frameRate, 20);
    }
    if (peers.length > 8) {
      newSettings.video = { width: 320, height: 240, frameRate: 15 };
    }

    setQualitySettings(newSettings);
  }, [deviceCapabilities, peers.length, qualitySettings]);

  useEffect(() => {
    adaptQuality();
  }, [deviceCapabilities, peers.length]);

  return {
    qualitySettings,
    adaptQuality
  };
};

// Hook for mobile-specific memory management
export const useMemoryManagement = () => {
  const cacheRef = useRef(new Map());
  const [memoryPressure, setMemoryPressure] = useState(false);

  const cleanupCache = useCallback(() => {
    cacheRef.current.clear();
    
    // Force garbage collection if available (Chrome DevTools)
    if (window.gc) {
      window.gc();
    }
  }, []);

  const addToCache = useCallback((key, value, maxSize = 50) => {
    const cache = cacheRef.current;
    
    // Remove oldest entries if cache is full
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }, []);

  const getFromCache = useCallback((key, maxAge = 300000) => { // 5 minutes
    const cache = cacheRef.current;
    const item = cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() - item.timestamp > maxAge) {
      cache.delete(key);
      return null;
    }
    
    return item.value;
  }, []);

  // Monitor memory pressure
  useEffect(() => {
    const checkMemoryPressure = () => {
      if ('memory' in performance) {
        const memInfo = performance.memory;
        const memoryUsageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
        setMemoryPressure(memoryUsageRatio > 0.8);
        
        if (memoryUsageRatio > 0.9) {
          cleanupCache();
        }
      }
    };

    const interval = setInterval(checkMemoryPressure, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [cleanupCache]);

  return {
    memoryPressure,
    cleanupCache,
    addToCache,
    getFromCache
  };
};

// Hook for mobile-specific UI optimizations
export const useMobileUI = () => {
  const [uiState, setUIState] = useState({
    isKeyboardOpen: false,
    safeAreaInsets: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    },
    orientation: 'portrait'
  });

  useEffect(() => {
    // Detect keyboard open/close on mobile
    const handleResize = () => {
      const heightDiff = window.screen.height - window.visualViewport?.height || 0;
      setUIState(prev => ({
        ...prev,
        isKeyboardOpen: heightDiff > 150
      }));
    };

    // Detect orientation changes
    const handleOrientationChange = () => {
      setUIState(prev => ({
        ...prev,
        orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
      }));
    };

    // Get safe area insets from CSS environment variables
    const getSafeAreaInsets = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      return {
        top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)')) || 0,
        bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) || 0,
        left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)')) || 0,
        right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)')) || 0
      };
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    // Initial setup
    handleOrientationChange();
    setUIState(prev => ({
      ...prev,
      safeAreaInsets: getSafeAreaInsets()
    }));

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  return uiState;
};