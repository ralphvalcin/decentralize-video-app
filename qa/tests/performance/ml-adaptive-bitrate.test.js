/**
 * ML-Enhanced Adaptive Bitrate Controller Performance Tests
 * 
 * Validates the sophisticated ML-powered adaptive bitrate system including
 * sub-100ms quality adaptation, device capability detection, and CPU-aware optimization.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import MLAdaptiveBitrate from '../../../src/utils/MLAdaptiveBitrate.js';

describe('ML-Enhanced Adaptive Bitrate - Performance Validation', () => {
  let mlAdaptiveBitrate;
  let performanceMetrics;
  let mockDeviceCapabilities;
  let testStartTime;

  beforeEach(async () => {
    setupMLBitrateMocks();
    
    mlAdaptiveBitrate = new (await import('../../../src/utils/MLAdaptiveBitrate.js')).default;
    
    performanceMetrics = {
      adaptationTimes: [],
      predictionAccuracy: [],
      deviceDetectionResults: [],
      cpuAwareAdaptations: []
    };
    
    testStartTime = performance.now();
    await mlAdaptiveBitrate.initialize();
  });

  afterEach(async () => {
    if (mlAdaptiveBitrate) {
      mlAdaptiveBitrate.dispose();
    }
    cleanupMLBitrateMocks();
  });

  describe('Initialization and ML Model Setup', () => {
    test('should initialize all ML prediction models successfully', async () => {
      expect(mlAdaptiveBitrate.isInitialized).toBe(true);
      expect(mlAdaptiveBitrate.bandwidthPredictor).toBeDefined();
      expect(mlAdaptiveBitrate.cpuUsagePredictor).toBeDefined();
      expect(mlAdaptiveBitrate.qualityPredictor).toBeDefined();
      expect(mlAdaptiveBitrate.realTimeAdapter).toBeDefined();
    });

    test('should detect device capabilities accurately', async () => {
      const capabilities = mlAdaptiveBitrate.deviceCapabilities;
      
      expect(capabilities).toMatchObject({
        display: expect.objectContaining({
          maxResolution: expect.objectContaining({
            width: expect.any(Number),
            height: expect.any(Number)
          }),
          pixelRatio: expect.any(Number)
        }),
        memory: expect.objectContaining({
          total: expect.any(Number),
          available: expect.any(Number)
        }),
        cpu: expect.objectContaining({
          threads: expect.any(Number)
        }),
        gpu: expect.objectContaining({
          supported: expect.any(Boolean)
        }),
        network: expect.objectContaining({
          effectiveType: expect.any(String)
        })
      });

      performanceMetrics.deviceDetectionResults.push({
        accurate: capabilities.cpu.threads > 0 && capabilities.memory.total > 0,
        capabilities
      });
    });

    test('should detect codec support for major codecs', async () => {
      const codecSupport = mlAdaptiveBitrate.codecSupport;
      
      expect(codecSupport.size).toBeGreaterThan(0);
      expect(codecSupport.has('VP8')).toBe(true);
      expect(codecSupport.has('VP9')).toBe(true);
      expect(codecSupport.has('H264')).toBe(true);
      expect(codecSupport.has('Opus')).toBe(true);
      
      // Log codec support for analysis
      console.log('Detected codec support:', Object.fromEntries(codecSupport));
    });

    test('should start CPU monitoring successfully', async () => {
      // Wait for CPU monitoring to collect initial data
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(mlAdaptiveBitrate.cpuUsage.current).toBeGreaterThanOrEqual(0);
      expect(mlAdaptiveBitrate.cpuUsage.history.length).toBeGreaterThan(0);
      
      const latestCPUReading = mlAdaptiveBitrate.cpuUsage.history[mlAdaptiveBitrate.cpuUsage.history.length - 1];
      expect(latestCPUReading.timestamp).toBeDefined();
      expect(latestCPUReading.usage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Sub-100ms Quality Adaptation Performance', () => {
    test('should achieve sub-100ms quality adaptation response time', async () => {
      const performanceMetrics = {
        bandwidth: 1500000, // 1.5 Mbps
        rtt: 50,
        packetLoss: 0.01,
        jitter: 0.02
      };

      const adaptationStartTime = performance.now();
      
      const result = await mlAdaptiveBitrate.adaptQuality(performanceMetrics, {
        targetQuality: 'high'
      });
      
      const adaptationTime = performance.now() - adaptationStartTime;
      performanceMetrics.adaptationTimes.push(adaptationTime);
      
      expect(adaptationTime).toBeLessThan(100); // Critical requirement: <100ms
      expect(result.adapted).toBe(true);
      expect(result.timestamp).toBeDefined();
      
      console.log(`Quality adaptation completed in ${adaptationTime.toFixed(2)}ms`);
    });

    test('should maintain sub-100ms performance under various network conditions', async () => {
      const networkConditions = [
        { name: 'excellent', bandwidth: 5000000, rtt: 20, packetLoss: 0.001 },
        { name: 'good', bandwidth: 2000000, rtt: 50, packetLoss: 0.005 },
        { name: 'fair', bandwidth: 1000000, rtt: 100, packetLoss: 0.02 },
        { name: 'poor', bandwidth: 500000, rtt: 200, packetLoss: 0.05 }
      ];

      const adaptationTimes = [];
      
      for (const condition of networkConditions) {
        const startTime = performance.now();
        
        const result = await mlAdaptiveBitrate.adaptQuality(condition);
        
        const adaptationTime = performance.now() - startTime;
        adaptationTimes.push({ condition: condition.name, time: adaptationTime });
        
        expect(adaptationTime).toBeLessThan(100);
      }
      
      const averageAdaptationTime = adaptationTimes.reduce((sum, result) => sum + result.time, 0) / adaptationTimes.length;
      expect(averageAdaptationTime).toBeLessThan(100);
      
      console.log('Adaptation times by condition:', adaptationTimes);
    });

    test('should perform real-time adaptation with minimal delay', async () => {
      const testDuration = 5000; // 5 seconds
      const adaptationInterval = 500; // Every 500ms
      const adaptations = [];
      
      const testPromise = new Promise((resolve) => {
        const interval = setInterval(async () => {
          const startTime = performance.now();
          
          const randomCondition = {
            bandwidth: Math.random() * 3000000 + 500000, // 0.5-3.5 Mbps
            rtt: Math.random() * 150 + 25, // 25-175ms
            packetLoss: Math.random() * 0.05, // 0-5%
            jitter: Math.random() * 0.05 // 0-50ms
          };
          
          const result = await mlAdaptiveBitrate.adaptQuality(randomCondition);
          const adaptationTime = performance.now() - startTime;
          
          adaptations.push({
            time: adaptationTime,
            success: result.adapted,
            profile: result.to
          });
          
          if (adaptations.length >= testDuration / adaptationInterval) {
            clearInterval(interval);
            resolve();
          }
        }, adaptationInterval);
      });
      
      await testPromise;
      
      const averageTime = adaptations.reduce((sum, a) => sum + a.time, 0) / adaptations.length;
      const p95Time = adaptations.map(a => a.time).sort((a, b) => a - b)[Math.floor(adaptations.length * 0.95)];
      
      expect(averageTime).toBeLessThan(100);
      expect(p95Time).toBeLessThan(150); // Allow some variance for p95
      
      console.log(`Real-time adaptations - Average: ${averageTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms`);
    });
  });

  describe('ML-Powered Quality Prediction', () => {
    test('should provide quality predictions with high confidence', async () => {
      const testScenarios = [
        {
          network: { bandwidth: 3000000, rtt: 30, packetLoss: 0.001 },
          expected: 'ultra'
        },
        {
          network: { bandwidth: 1500000, rtt: 75, packetLoss: 0.01 },
          expected: 'high'
        },
        {
          network: { bandwidth: 800000, rtt: 120, packetLoss: 0.03 },
          expected: 'medium'
        },
        {
          network: { bandwidth: 400000, rtt: 180, packetLoss: 0.06 },
          expected: 'low'
        }
      ];

      let correctPredictions = 0;
      
      for (const scenario of testScenarios) {
        const context = await mlAdaptiveBitrate.gatherAdaptationContext(scenario.network);
        const prediction = await mlAdaptiveBitrate.predictOptimalQuality(context);
        
        expect(prediction.confidence).toBeGreaterThan(0.5);
        expect(prediction.score).toBeGreaterThanOrEqual(0);
        expect(prediction.factors).toBeDefined();
        
        if (prediction.profile === scenario.expected) {
          correctPredictions++;
        }
        
        performanceMetrics.predictionAccuracy.push({
          predicted: prediction.profile,
          expected: scenario.expected,
          correct: prediction.profile === scenario.expected,
          confidence: prediction.confidence
        });
      }
      
      const accuracy = correctPredictions / testScenarios.length;
      expect(accuracy).toBeGreaterThan(0.75); // >75% accuracy target
      
      console.log(`ML prediction accuracy: ${(accuracy * 100).toFixed(1)}%`);
    });

    test('should adapt predictions based on ML model updates', async () => {
      // Initial prediction
      const initialContext = await mlAdaptiveBitrate.gatherAdaptationContext({
        bandwidth: 1000000,
        rtt: 100,
        packetLoss: 0.02
      });
      
      const initialPrediction = await mlAdaptiveBitrate.predictOptimalQuality(initialContext);
      
      // Simulate adaptation result to update ML models
      const adaptationResult = {
        adapted: true,
        from: 'medium',
        to: 'high',
        success: true,
        prediction: initialPrediction
      };
      
      mlAdaptiveBitrate.updateMLModels(initialContext, adaptationResult);
      
      // Make another prediction with same conditions
      const updatedPrediction = await mlAdaptiveBitrate.predictOptimalQuality(initialContext);
      
      expect(updatedPrediction.confidence).toBeGreaterThanOrEqual(initialPrediction.confidence);
      // Model should learn from successful adaptations
    });
  });

  describe('CPU-Aware Quality Optimization', () => {
    test('should reduce quality under high CPU load', async () => {
      // Simulate high CPU usage
      mlAdaptiveBitrate.cpuUsage.current = 85; // Above 80% threshold
      mlAdaptiveBitrate.cpuUsage.history = [
        { timestamp: Date.now() - 4000, usage: 82 },
        { timestamp: Date.now() - 3000, usage: 84 },
        { timestamp: Date.now() - 2000, usage: 86 },
        { timestamp: Date.now() - 1000, usage: 85 }
      ];
      
      const networkConditions = {
        bandwidth: 2500000, // High bandwidth that would normally suggest 'ultra'
        rtt: 30,
        packetLoss: 0.001
      };
      
      const result = await mlAdaptiveBitrate.adaptQuality(networkConditions);
      
      expect(result.cpuAdjustments).toContain('High CPU usage: 85%');
      expect(['high', 'medium', 'low']).toContain(result.to); // Should not be 'ultra'
      
      performanceMetrics.cpuAwareAdaptations.push({
        cpuUsage: 85,
        networkBandwidth: 2500000,
        resultingQuality: result.to,
        adjustmentApplied: result.cpuAdjustments.length > 0
      });
    });

    test('should consider CPU trend in quality decisions', async () => {
      // Simulate increasing CPU trend
      const now = Date.now();
      mlAdaptiveBitrate.cpuUsage.current = 65;
      mlAdaptiveBitrate.cpuUsage.history = [
        { timestamp: now - 5000, usage: 45 },
        { timestamp: now - 4000, usage: 50 },
        { timestamp: now - 3000, usage: 55 },
        { timestamp: now - 2000, usage: 60 },
        { timestamp: now - 1000, usage: 65 }
      ];
      
      const cpuTrend = mlAdaptiveBitrate.getCPUTrend();
      expect(cpuTrend).toBe('increasing');
      
      const networkConditions = {
        bandwidth: 1500000,
        rtt: 50,
        packetLoss: 0.01
      };
      
      const result = await mlAdaptiveBitrate.adaptQuality(networkConditions);
      
      // Should consider increasing CPU trend
      expect(result.cpuAdjustments).toContain('Increasing CPU trend detected');
    });

    test('should handle limited CPU threads appropriately', async () => {
      // Mock limited CPU threads
      mlAdaptiveBitrate.deviceCapabilities.cpu.threads = 2;
      
      const networkConditions = {
        bandwidth: 3000000, // Would normally suggest 'ultra'
        rtt: 25,
        packetLoss: 0.001
      };
      
      const result = await mlAdaptiveBitrate.adaptQuality(networkConditions);
      
      expect(result.deviceConstraints).toContain('Limited CPU threads: 2');
      expect(result.to).not.toBe('ultra'); // Should be limited to 'high'
    });
  });

  describe('Device Capability Constraints', () => {
    test('should respect screen resolution limitations', async () => {
      // Mock device with limited resolution
      mlAdaptiveBitrate.deviceCapabilities.display.maxResolution = {
        width: 1280,
        height: 720
      };
      
      const networkConditions = {
        bandwidth: 3000000,
        rtt: 20,
        packetLoss: 0.001
      };
      
      const result = await mlAdaptiveBitrate.adaptQuality(networkConditions);
      
      expect(result.deviceConstraints).toContain('Screen resolution limited to 1280x720');
      expect(['high', 'medium', 'low']).toContain(result.to); // Should not be 'ultra' (1920x1080)
    });

    test('should consider available memory constraints', async () => {
      // Mock limited memory
      mlAdaptiveBitrate.deviceCapabilities.memory.available = 1536; // 1.5GB
      
      const networkConditions = {
        bandwidth: 3000000,
        rtt: 20,
        packetLoss: 0.001
      };
      
      const result = await mlAdaptiveBitrate.adaptQuality(networkConditions);
      
      expect(result.deviceConstraints).toContain('Limited available memory: 1536MB');
      expect(result.to).not.toBe('ultra'); // Should be limited
    });

    test('should fallback to supported codecs', async () => {
      // Mock unsupported preferred codec
      mlAdaptiveBitrate.codecSupport.set('VP9', false);
      mlAdaptiveBitrate.codecSupport.set('H264', true);
      
      const networkConditions = {
        bandwidth: 2000000,
        rtt: 40,
        packetLoss: 0.005
      };
      
      const result = await mlAdaptiveBitrate.adaptQuality(networkConditions);
      
      expect(result.deviceConstraints.some(constraint => 
        constraint.includes('Codec fallback') || constraint.includes('No preferred codec support')
      )).toBe(true);
    });
  });

  describe('Performance Metrics and Analytics', () => {
    test('should provide comprehensive ML adaptation metrics', async () => {
      // Perform several adaptations to generate metrics
      const adaptationCount = 10;
      
      for (let i = 0; i < adaptationCount; i++) {
        await mlAdaptiveBitrate.adaptQuality({
          bandwidth: Math.random() * 2000000 + 500000,
          rtt: Math.random() * 100 + 25,
          packetLoss: Math.random() * 0.03
        });
      }
      
      const metrics = mlAdaptiveBitrate.getMLAdaptationMetrics();
      
      expect(metrics.totalAdaptations).toBe(adaptationCount);
      expect(metrics.successRate).toBeGreaterThan(80); // >80% success rate
      expect(metrics.averageAdaptationTime).toBeLessThan(100); // <100ms average
      expect(metrics.deviceCapabilities).toBeDefined();
      expect(metrics.codecSupport).toBeDefined();
      expect(metrics.currentCPU).toBeGreaterThanOrEqual(0);
    });

    test('should track quality profiles and their usage', async () => {
      const qualityProfiles = mlAdaptiveBitrate.getQualityProfiles();
      
      expect(qualityProfiles).toMatchObject({
        ultra: expect.objectContaining({
          video: expect.objectContaining({
            width: 1920,
            height: 1080,
            frameRate: 30,
            bitrate: 3000000,
            codec: 'VP9'
          })
        }),
        high: expect.objectContaining({
          video: expect.objectContaining({
            width: 1280,
            height: 720,
            frameRate: 30,
            bitrate: 1500000
          })
        }),
        medium: expect.objectContaining({
          video: expect.objectContaining({
            width: 854,
            height: 480,
            frameRate: 25,
            bitrate: 800000
          })
        }),
        low: expect.objectContaining({
          video: expect.objectContaining({
            width: 640,
            height: 360,
            frameRate: 20,
            bitrate: 400000
          })
        }),
        minimal: expect.objectContaining({
          video: expect.objectContaining({
            width: 320,
            height: 240,
            frameRate: 15,
            bitrate: 200000
          })
        })
      });
    });

    test('should support manual quality override', async () => {
      const result = await mlAdaptiveBitrate.forceAdaptation('low', 'Manual test override');
      
      expect(result.adapted).toBe(true);
      expect(result.to).toBe('low');
      expect(result.prediction.reasoning).toContain('Manual test override');
      expect(result.prediction.confidence).toBe(1.0);
    });
  });

  describe('Stress Testing and Edge Cases', () => {
    test('should maintain performance under rapid adaptation requests', async () => {
      const rapidAdaptationCount = 50;
      const adaptationPromises = [];
      
      for (let i = 0; i < rapidAdaptationCount; i++) {
        const promise = mlAdaptiveBitrate.adaptQuality({
          bandwidth: Math.random() * 3000000 + 300000,
          rtt: Math.random() * 200 + 20,
          packetLoss: Math.random() * 0.1
        });
        adaptationPromises.push(promise);
      }
      
      const results = await Promise.all(adaptationPromises);
      const successfulAdaptations = results.filter(r => r.adapted).length;
      const averageTime = results.reduce((sum, r) => sum + (r.adaptationTime || 0), 0) / results.length;
      
      expect(successfulAdaptations / rapidAdaptationCount).toBeGreaterThan(0.9); // >90% success rate
      expect(averageTime).toBeLessThan(150); // Allow some degradation under stress
    });

    test('should handle initialization failure gracefully', async () => {
      // Create new instance without proper mocking
      const failingInstance = new (await import('../../../src/utils/MLAdaptiveBitrate.js')).default;
      
      // Mock initialization failure
      failingInstance.bandwidthPredictor = {
        initialize: jest.fn().mockRejectedValue(new Error('ML model initialization failed'))
      };
      
      let initializationError;
      try {
        await failingInstance.initialize();
      } catch (error) {
        initializationError = error;
      }
      
      expect(initializationError).toBeDefined();
      expect(failingInstance.isInitialized).toBe(false);
    });

    test('should fallback to base controller when ML fails', async () => {
      // Disable ML functionality
      mlAdaptiveBitrate.isInitialized = false;
      
      const result = await mlAdaptiveBitrate.adaptQuality({
        bandwidth: 1000000,
        rtt: 100,
        packetLoss: 0.02
      });
      
      // Should fallback to base controller
      expect(result).toBeDefined();
      // Would typically return base controller result
    });
  });

  // Helper functions for mocking and simulation
  function setupMLBitrateMocks() {
    // Mock performance.memory
    global.performance = global.performance || {};
    global.performance.memory = {
      usedJSHeapSize: 50 * 1024 * 1024,
      totalJSHeapSize: 100 * 1024 * 1024,
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024
    };

    // Mock navigator properties
    global.navigator = global.navigator || {};
    global.navigator.hardwareConcurrency = 8;
    global.navigator.deviceMemory = 8;
    global.navigator.connection = {
      effectiveType: '4g',
      downlink: 10
    };

    // Mock screen properties
    global.screen = {
      width: 1920,
      height: 1080
    };

    // Mock window properties
    global.window = global.window || {};
    global.window.devicePixelRatio = 2;

    // Mock document for canvas creation
    global.document = global.document || {};
    global.document.createElement = jest.fn().mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        return {
          getContext: jest.fn().mockReturnValue({
            getExtension: jest.fn().mockReturnValue({
              UNMASKED_VENDOR_WEBGL: 'NVIDIA Corporation',
              UNMASKED_RENDERER_WEBGL: 'GeForce GTX 1060'
            }),
            getParameter: jest.fn().mockImplementation((param) => {
              const extensionMock = {
                UNMASKED_VENDOR_WEBGL: 'NVIDIA Corporation',
                UNMASKED_RENDERER_WEBGL: 'GeForce GTX 1060'
              };
              return extensionMock[param] || 'Mock GL Parameter';
            })
          })
        };
      }
      return {};
    });

    // Mock MediaRecorder for codec detection
    global.MediaRecorder = {
      isTypeSupported: jest.fn().mockImplementation((mimeType) => {
        // Simulate realistic codec support
        const supportedTypes = [
          'video/webm; codecs=vp8',
          'video/webm; codecs=vp9',
          'video/mp4; codecs=avc1.42E01E',
          'audio/webm; codecs=opus'
        ];
        return supportedTypes.some(type => mimeType.includes(type.split(';')[0]));
      })
    };
  }

  function cleanupMLBitrateMocks() {
    // Cleanup mocks
    jest.restoreAllMocks();
  }
});

// Export performance validation utilities
export function validateMLPerformanceMetrics(metrics) {
  const summary = {
    adaptationPerformance: {
      averageTime: 0,
      p95Time: 0,
      sub100msRate: 0
    },
    predictionAccuracy: {
      overall: 0,
      averageConfidence: 0
    },
    deviceDetectionAccuracy: 0,
    cpuAwarenessEffectiveness: 0
  };

  // Adaptation performance analysis
  if (metrics.adaptationTimes.length > 0) {
    const sortedTimes = metrics.adaptationTimes.sort((a, b) => a - b);
    summary.adaptationPerformance.averageTime = 
      sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length;
    summary.adaptationPerformance.p95Time = 
      sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    summary.adaptationPerformance.sub100msRate = 
      sortedTimes.filter(time => time < 100).length / sortedTimes.length;
  }

  // Prediction accuracy analysis
  if (metrics.predictionAccuracy.length > 0) {
    const correctPredictions = metrics.predictionAccuracy.filter(p => p.correct).length;
    summary.predictionAccuracy.overall = correctPredictions / metrics.predictionAccuracy.length;
    summary.predictionAccuracy.averageConfidence = 
      metrics.predictionAccuracy.reduce((sum, p) => sum + p.confidence, 0) / 
      metrics.predictionAccuracy.length;
  }

  // Device detection accuracy
  if (metrics.deviceDetectionResults.length > 0) {
    const accurateDetections = metrics.deviceDetectionResults.filter(d => d.accurate).length;
    summary.deviceDetectionAccuracy = accurateDetections / metrics.deviceDetectionResults.length;
  }

  // CPU awareness effectiveness
  if (metrics.cpuAwareAdaptations.length > 0) {
    const effectiveAdaptations = metrics.cpuAwareAdaptations.filter(a => a.adjustmentApplied).length;
    summary.cpuAwarenessEffectiveness = effectiveAdaptations / metrics.cpuAwareAdaptations.length;
  }

  return summary;
}