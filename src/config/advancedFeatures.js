/**
 * Advanced WebRTC Features Configuration
 * Controls enterprise-grade features with progressive enhancement
 */

// Feature flags for advanced capabilities
export const ADVANCED_FEATURES = {
  // AI-Powered Features
  AI_BACKGROUND_BLUR: {
    enabled: true,
    requiresGPU: true,
    fallbackToCSS: true,
    minPerformanceScore: 70
  },
  AI_BACKGROUND_REPLACEMENT: {
    enabled: true,
    requiresGPU: true,
    memoryThreshold: 4096, // MB
    minPerformanceScore: 80
  },
  AI_NOISE_CANCELLATION: {
    enabled: true,
    requiresWebAudio: true,
    adaptiveThreshold: true,
    minProcessingPower: 60
  },
  AI_GESTURE_RECOGNITION: {
    enabled: true,
    requiresMediaPipe: true,
    confidence: 0.8,
    minPerformanceScore: 75
  },
  AI_AUTO_FRAMING: {
    enabled: true,
    requiresGPU: true,
    trackingSmoothing: 0.3,
    minPerformanceScore: 70
  },

  // Enhanced Media Features
  VIRTUAL_BACKGROUNDS: {
    enabled: true,
    maxResolution: '1920x1080',
    compressionQuality: 0.8,
    preloadCommon: true
  },
  BEAUTY_FILTERS: {
    enabled: true,
    realTimeProcessing: true,
    intensityRange: [0, 100],
    defaultIntensity: 30
  },
  AUDIO_EFFECTS: {
    enabled: true,
    voiceModulation: true,
    echoEffects: true,
    customFilters: true
  },
  CLOUD_RECORDING: {
    enabled: true,
    maxDuration: 7200, // 2 hours
    autoUpload: true,
    transcriptionEnabled: true
  },

  // Advanced Connection Management
  SIMULCAST: {
    enabled: true,
    layers: ['low', 'medium', 'high'],
    adaptiveQuality: true,
    temporalLayers: 3
  },
  SVC_SUPPORT: {
    enabled: true,
    spatialLayers: 3,
    temporalLayers: 3,
    qualityLayers: 3
  },
  ENHANCED_ICE: {
    enabled: true,
    multipleServers: true,
    tcpFallback: true,
    aggressiveNomination: true
  },
  BANDWIDTH_ADAPTATION: {
    enabled: true,
    realTimeMonitoring: true,
    predictiveAdjustment: true,
    userPreferences: true
  },

  // Collaboration Features
  WHITEBOARD: {
    enabled: true,
    realTimeSync: true,
    vectorGraphics: true,
    multiUserCursors: true
  },
  FILE_SHARING: {
    enabled: true,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    chunkedTransfer: true,
    resumeSupport: true
  },
  SYNCHRONIZED_PLAYBACK: {
    enabled: true,
    videoSync: true,
    audioSync: true,
    buffering: 500 // ms
  },
  BREAKOUT_ROOMS: {
    enabled: true,
    maxRooms: 10,
    seamlessTransition: true,
    statePreservation: true
  },

  // Network Optimization
  P2P_MESH: {
    enabled: true,
    maxConnections: 8,
    intelligentSelection: true,
    sfuFallback: true
  },
  QOS_MANAGEMENT: {
    enabled: true,
    dscpMarking: true,
    trafficShaping: true,
    congestionControl: true
  },
  PREDICTIVE_ANALYTICS: {
    enabled: true,
    mlPrediction: true,
    historicalAnalysis: true,
    proactiveAdjustment: true
  },

  // Advanced Analytics
  REAL_TIME_ANALYTICS: {
    enabled: true,
    qualityMetrics: true,
    performanceDashboard: true,
    alerting: true
  },
  CONNECTION_HEALTH: {
    enabled: true,
    rttTracking: true,
    packetLossDetection: true,
    jitterMeasurement: true
  }
};

// Device capability detection
export const DEVICE_CAPABILITIES = {
  detectGPU: () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return false;
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      return !renderer.includes('SwiftShader') && !renderer.includes('ANGLE');
    }
    return true;
  },

  detectWebAudio: () => {
    return !!(window.AudioContext || window.webkitAudioContext);
  },

  detectMediaPipe: () => {
    return typeof Worker !== 'undefined' && 'OffscreenCanvas' in window;
  },

  getMemoryInfo: () => {
    if ('memory' in performance) {
      return performance.memory.jsHeapSizeLimit / (1024 * 1024); // MB
    }
    return 2048; // Default fallback
  },

  getPerformanceScore: () => {
    // Simple performance scoring based on various factors
    const factors = {
      gpu: DEVICE_CAPABILITIES.detectGPU() ? 30 : 0,
      webAudio: DEVICE_CAPABILITIES.detectWebAudio() ? 20 : 0,
      mediaPipe: DEVICE_CAPABILITIES.detectMediaPipe() ? 25 : 0,
      memory: Math.min((DEVICE_CAPABILITIES.getMemoryInfo() / 4096) * 25, 25)
    };
    
    return Object.values(factors).reduce((sum, score) => sum + score, 0);
  }
};

// Dynamic feature enablement based on device capabilities
export const getEnabledFeatures = () => {
  const capabilities = {
    hasGPU: DEVICE_CAPABILITIES.detectGPU(),
    hasWebAudio: DEVICE_CAPABILITIES.detectWebAudio(),
    hasMediaPipe: DEVICE_CAPABILITIES.detectMediaPipe(),
    memoryMB: DEVICE_CAPABILITIES.getMemoryInfo(),
    performanceScore: DEVICE_CAPABILITIES.getPerformanceScore()
  };

  const enabledFeatures = {};

  Object.entries(ADVANCED_FEATURES).forEach(([category, features]) => {
    enabledFeatures[category] = {};
    
    Object.entries(features).forEach(([feature, config]) => {
      let enabled = config.enabled;

      // Check GPU requirement
      if (config.requiresGPU && !capabilities.hasGPU) {
        enabled = false;
      }

      // Check WebAudio requirement
      if (config.requiresWebAudio && !capabilities.hasWebAudio) {
        enabled = false;
      }

      // Check MediaPipe requirement
      if (config.requiresMediaPipe && !capabilities.hasMediaPipe) {
        enabled = false;
      }

      // Check memory threshold
      if (config.memoryThreshold && capabilities.memoryMB < config.memoryThreshold) {
        enabled = false;
      }

      // Check performance score
      if (config.minPerformanceScore && capabilities.performanceScore < config.minPerformanceScore) {
        enabled = false;
      }

      enabledFeatures[category][feature] = {
        ...config,
        enabled,
        reason: enabled ? 'Device compatible' : 'Device capability insufficient'
      };
    });
  });

  return {
    features: enabledFeatures,
    capabilities,
    summary: {
      totalFeatures: Object.values(ADVANCED_FEATURES).reduce((sum, cat) => sum + Object.keys(cat).length, 0),
      enabledCount: Object.values(enabledFeatures).reduce((sum, cat) => 
        sum + Object.values(cat).filter(f => f.enabled).length, 0
      )
    }
  };
};

// Quality presets for different use cases
export const QUALITY_PRESETS = {
  BATTERY_SAVER: {
    ai: { backgroundBlur: false, gestureRecognition: false },
    video: { maxResolution: '640x480', frameRate: 15, bitrate: 300000 },
    audio: { bitrate: 64000, noiseReduction: false }
  },
  BALANCED: {
    ai: { backgroundBlur: true, gestureRecognition: true },
    video: { maxResolution: '1280x720', frameRate: 24, bitrate: 1000000 },
    audio: { bitrate: 128000, noiseReduction: true }
  },
  HIGH_QUALITY: {
    ai: { backgroundBlur: true, gestureRecognition: true, autoFraming: true },
    video: { maxResolution: '1920x1080', frameRate: 30, bitrate: 2500000 },
    audio: { bitrate: 256000, noiseReduction: true, effects: true }
  },
  ENTERPRISE: {
    ai: { all: true },
    video: { maxResolution: '1920x1080', frameRate: 30, bitrate: 3000000, recording: true },
    audio: { bitrate: 320000, noiseReduction: true, effects: true, recording: true },
    collaboration: { whiteboard: true, fileSharing: true, breakoutRooms: true }
  }
};

export default {
  ADVANCED_FEATURES,
  DEVICE_CAPABILITIES,
  getEnabledFeatures,
  QUALITY_PRESETS
};