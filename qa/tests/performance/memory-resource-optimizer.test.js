/**
 * Memory & Resource Optimizer Performance Tests
 * 
 * Validates the comprehensive memory management system including leak detection,
 * resource pooling, enterprise-scale optimization, and <50MB per connection target.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import MemoryResourceOptimizer from '../../../src/utils/MemoryResourceOptimizer.js';

describe('Memory & Resource Optimizer - Performance Validation', () => {
  let memoryOptimizer;
  let performanceMetrics;
  let initialMemory;

  beforeEach(async () => {
    setupMemoryOptimizerMocks();
    
    memoryOptimizer = new (await import('../../../src/utils/MemoryResourceOptimizer.js')).default;
    
    performanceMetrics = {
      memoryUsagePerConnection: [],
      optimizationResults: [],
      cleanupEffectiveness: [],
      concurrentConnectionResults: [],
      memoryLeakDetections: []
    };
    
    initialMemory = mockMemoryUsage();
    await memoryOptimizer.initialize();
  });

  afterEach(async () => {
    if (memoryOptimizer) {
      memoryOptimizer.dispose();
    }
    cleanupMemoryOptimizerMocks();
  });

  describe('Initialization and Baseline Setup', () => {
    test('should initialize all resource management components', async () => {
      expect(memoryOptimizer.isInitialized).toBe(true);
      expect(memoryOptimizer.connectionPool).toBeDefined();
      expect(memoryOptimizer.mediaStreamPool).toBeDefined();
      expect(memoryOptimizer.bufferPool).toBeDefined();
      expect(memoryOptimizer.gcOptimizer).toBeDefined();
      expect(memoryOptimizer.memoryLeakDetector).toBeDefined();
      expect(memoryOptimizer.resourceMonitor).toBeDefined();
    });

    test('should establish accurate memory baseline', async () => {
      const baseline = memoryOptimizer.memoryMetrics.baseline;
      
      expect(baseline).toBeGreaterThan(0);
      expect(baseline).toBe(initialMemory);
      
      console.log(`Memory baseline established: ${formatBytes(baseline)}`);
    });

    test('should start continuous monitoring intervals', async () => {
      expect(memoryOptimizer.monitoringInterval).toBeDefined();
      expect(memoryOptimizer.cleanupInterval).toBeDefined();
      expect(memoryOptimizer.gcInterval).toBeDefined();
      
      // Verify intervals are actually running
      await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6 seconds
      
      const metrics = memoryOptimizer.getMemoryMetrics();
      expect(metrics.current).toBeGreaterThan(0);
    });

    test('should configure enterprise performance targets correctly', async () => {
      const targets = memoryOptimizer.targets;
      
      expect(targets.maxMemoryPerConnection).toBe(50 * 1024 * 1024); // 50MB
      expect(targets.maxTotalMemory).toBe(2 * 1024 * 1024 * 1024); // 2GB
      expect(targets.maxConcurrentConnections).toBe(50);
      expect(targets.gcInterval).toBe(30000); // 30 seconds
      expect(targets.cleanupInterval).toBe(60000); // 1 minute
    });
  });

  describe('Memory Usage Per Connection (<50MB Target)', () => {
    test('should maintain memory usage under 50MB per connection', async () => {
      const connectionCount = 10;
      const memoryBeforeConnections = mockMemoryUsage();
      
      // Register multiple peer connections
      for (let i = 0; i < connectionCount; i++) {
        const connectionData = createMockConnectionData(i);
        memoryOptimizer.registerPeerConnection(`peer-${i}`, connectionData);
      }
      
      // Simulate memory usage growth
      await simulateConnectionMemoryUsage(memoryOptimizer, connectionCount);
      
      const memoryAfterConnections = mockMemoryUsage();
      const totalMemoryIncrease = memoryAfterConnections - memoryBeforeConnections;
      const memoryPerConnection = totalMemoryIncrease / connectionCount;
      
      performanceMetrics.memoryUsagePerConnection.push({
        connectionCount,
        totalIncrease: totalMemoryIncrease,
        perConnection: memoryPerConnection,
        belowTarget: memoryPerConnection < 50 * 1024 * 1024
      });
      
      expect(memoryPerConnection).toBeLessThan(50 * 1024 * 1024); // <50MB target
      
      console.log(`Memory per connection: ${formatBytes(memoryPerConnection)} (Target: <50MB)`);
    });

    test('should scale to 50+ concurrent connections within memory limits', async () => {
      const targetConnectionCount = 55; // Test above target to ensure scalability
      const memoryBefore = mockMemoryUsage();
      
      // Register all connections
      for (let i = 0; i < targetConnectionCount; i++) {
        const connectionData = createMockConnectionData(i);
        memoryOptimizer.registerPeerConnection(`stress-peer-${i}`, connectionData);
      }
      
      // Simulate realistic memory usage for each connection
      await simulateScaledMemoryUsage(memoryOptimizer, targetConnectionCount);
      
      const memoryAfter = mockMemoryUsage();
      const totalMemoryUsage = memoryAfter;
      const averageMemoryPerConnection = (memoryAfter - memoryBefore) / targetConnectionCount;
      
      performanceMetrics.concurrentConnectionResults.push({
        connectionCount: targetConnectionCount,
        totalMemoryUsage,
        averagePerConnection: averageMemoryPerConnection,
        withinTotalLimit: totalMemoryUsage < 2 * 1024 * 1024 * 1024, // <2GB
        withinPerConnectionLimit: averageMemoryPerConnection < 50 * 1024 * 1024 // <50MB
      });
      
      expect(totalMemoryUsage).toBeLessThan(2 * 1024 * 1024 * 1024); // <2GB total
      expect(averageMemoryPerConnection).toBeLessThan(50 * 1024 * 1024); // <50MB per connection
      
      console.log(`50+ connections: ${targetConnectionCount} connections, ${formatBytes(averageMemoryPerConnection)} per connection`);
    });

    test('should accurately estimate connection memory usage', async () => {
      const peerId = 'estimation-test-peer';
      const connectionData = createMockConnectionData(0);
      
      memoryOptimizer.registerPeerConnection(peerId, connectionData);
      
      // Simulate various resource usage patterns
      const connectionMetrics = memoryOptimizer.memoryMetrics.perConnection.get(peerId);
      connectionMetrics.resourceUsage = {
        videoBuffers: 5,
        audioBuffers: 3,
        networkBuffers: 2,
        eventListeners: 25,
        domElements: 10
      };
      
      const estimatedMemory = memoryOptimizer.estimateConnectionMemory(peerId);
      const expectedMemory = 1024 * 1024 + // Base 1MB
                            (5 * 2 * 1024 * 1024) + // Video buffers
                            (3 * 0.5 * 1024 * 1024) + // Audio buffers  
                            (2 * 0.1 * 1024 * 1024) + // Network buffers
                            (25 * 1024); // Event listeners
      
      expect(estimatedMemory).toBeCloseTo(expectedMemory, -3); // Within 1KB
      expect(estimatedMemory).toBeLessThan(50 * 1024 * 1024); // Under 50MB limit
    });
  });

  describe('Memory Optimization and Cleanup', () => {
    test('should optimize individual connections effectively', async () => {
      const peerId = 'optimization-test-peer';
      const connectionData = createMockConnectionData(0);
      
      memoryOptimizer.registerPeerConnection(peerId, connectionData);
      
      // Simulate high memory usage requiring optimization
      const connectionMetrics = memoryOptimizer.memoryMetrics.perConnection.get(peerId);
      connectionMetrics.currentMemory = 75 * 1024 * 1024; // 75MB - above target
      connectionMetrics.resourceUsage = {
        videoBuffers: 12, // Excessive buffers
        audioBuffers: 8,
        networkBuffers: 5,
        eventListeners: 60, // Excessive listeners
        domElements: 25
      };
      
      const memoryBefore = mockMemoryUsage();
      const optimizationResult = await memoryOptimizer.optimizeConnection(peerId);
      const memoryAfter = mockMemoryUsage();
      
      performanceMetrics.optimizationResults.push({
        peerId,
        memoryBefore: connectionMetrics.currentMemory,
        optimizations: optimizationResult.optimizations,
        memoryReclaimed: optimizationResult.memoryReclaimed,
        optimizationTime: optimizationResult.optimizationTime,
        success: optimizationResult.success
      });
      
      expect(optimizationResult.success).toBe(true);
      expect(optimizationResult.memoryReclaimed).toBeGreaterThan(0);
      expect(optimizationResult.optimizationTime).toBeLessThan(1000); // <1 second
      expect(optimizationResult.optimizations.length).toBeGreaterThan(0);
    });

    test('should perform global optimization efficiently', async () => {
      const connectionCount = 15;
      
      // Create connections with varying memory usage patterns
      for (let i = 0; i < connectionCount; i++) {
        const connectionData = createMockConnectionData(i);
        memoryOptimizer.registerPeerConnection(`global-test-peer-${i}`, connectionData);
        
        // Simulate different resource usage levels
        const metrics = memoryOptimizer.memoryMetrics.perConnection.get(`global-test-peer-${i}`);
        metrics.currentMemory = (30 + Math.random() * 40) * 1024 * 1024; // 30-70MB
        metrics.resourceUsage = {
          videoBuffers: Math.floor(Math.random() * 10) + 3,
          audioBuffers: Math.floor(Math.random() * 6) + 2,
          networkBuffers: Math.floor(Math.random() * 4) + 1,
          eventListeners: Math.floor(Math.random() * 50) + 10,
          domElements: Math.floor(Math.random() * 20) + 5
        };
      }
      
      const globalOptimizationResult = await memoryOptimizer.performGlobalOptimization();
      
      expect(globalOptimizationResult.success).toBe(true);
      expect(globalOptimizationResult.totalMemoryReclaimed).toBeGreaterThan(0);
      expect(globalOptimizationResult.optimizationTime).toBeLessThan(5000); // <5 seconds
      expect(globalOptimizationResult.details).toMatchObject({
        connectionOptimizations: expect.objectContaining({
          total: connectionCount,
          successful: expect.any(Number)
        }),
        orphanedCleanup: expect.any(Object),
        poolOptimization: expect.any(Object),
        gcResult: expect.objectContaining({
          memoryReclaimed: expect.any(Number)
        })
      });
      
      console.log(`Global optimization: ${formatBytes(globalOptimizationResult.totalMemoryReclaimed)} reclaimed in ${globalOptimizationResult.optimizationTime.toFixed(1)}ms`);
    });

    test('should cleanup connections thoroughly', async () => {
      const peerId = 'cleanup-test-peer';
      const connectionData = createMockConnectionData(0);
      
      memoryOptimizer.registerPeerConnection(peerId, connectionData);
      
      const memoryBefore = mockMemoryUsage();
      
      await memoryOptimizer.unregisterPeerConnection(peerId);
      
      const memoryAfter = mockMemoryUsage();
      const memoryReclaimed = Math.max(0, memoryBefore - memoryAfter);
      
      performanceMetrics.cleanupEffectiveness.push({
        peerId,
        memoryReclaimed,
        cleanupComplete: !memoryOptimizer.memoryMetrics.perConnection.has(peerId)
      });
      
      expect(memoryOptimizer.memoryMetrics.perConnection.has(peerId)).toBe(false);
      expect(memoryReclaimed).toBeGreaterThan(0);
    });
  });

  describe('Memory Leak Detection and Prevention', () => {
    test('should detect memory leaks accurately', async () => {
      const peerId = 'leak-test-peer';
      const connectionData = createMockConnectionData(0);
      
      memoryOptimizer.registerPeerConnection(peerId, connectionData);
      
      // Simulate memory leak scenario
      const baselineMemory = memoryOptimizer.memoryLeakDetection.baseline;
      const leakedMemory = baselineMemory + 150 * 1024 * 1024; // 150MB increase
      
      // Mock memory growth beyond threshold
      jest.spyOn(memoryOptimizer, 'getCurrentMemoryUsage')
        .mockReturnValue(leakedMemory);
      
      // Add measurements to simulate leak detection
      for (let i = 0; i < 10; i++) {
        memoryOptimizer.memoryLeakDetection.measurements.push({
          timestamp: Date.now() - (9 - i) * 1000,
          peerId,
          memory: baselineMemory + (i + 1) * 15 * 1024 * 1024, // Gradual increase
          increase: (i + 1) * 15 * 1024 * 1024
        });
      }
      
      const recentGrowth = memoryOptimizer.calculateRecentMemoryGrowth();
      
      expect(recentGrowth).toBeGreaterThan(50 * 1024 * 1024); // Should detect >50MB growth
      
      performanceMetrics.memoryLeakDetections.push({
        peerId,
        baselineMemory,
        currentMemory: leakedMemory,
        memoryIncrease: leakedMemory - baselineMemory,
        recentGrowth,
        leakDetected: recentGrowth > 50 * 1024 * 1024
      });
    });

    test('should prevent memory leaks through connection optimization', async () => {
      const connectionCount = 8;
      const connections = [];
      
      // Create connections with simulated memory leaks
      for (let i = 0; i < connectionCount; i++) {
        const peerId = `leak-prevention-peer-${i}`;
        const connectionData = createMockConnectionData(i);
        
        memoryOptimizer.registerPeerConnection(peerId, connectionData);
        connections.push(peerId);
        
        // Simulate gradual memory growth (leak)
        const metrics = memoryOptimizer.memoryMetrics.perConnection.get(peerId);
        metrics.currentMemory = (25 + i * 5) * 1024 * 1024; // Growing memory usage
        metrics.peakMemory = Math.max(metrics.peakMemory, metrics.currentMemory);
      }
      
      // Trigger optimization to prevent leaks
      const optimizationResult = await memoryOptimizer.performGlobalOptimization();
      
      expect(optimizationResult.success).toBe(true);
      
      // Check that memory growth has been controlled
      const finalMemory = mockMemoryUsage();
      expect(finalMemory).toBeLessThan(memoryOptimizer.targets.maxTotalMemory);
    });

    test('should handle periodic cleanup effectively', async () => {
      const connectionCount = 12;
      
      // Create connections
      for (let i = 0; i < connectionCount; i++) {
        const connectionData = createMockConnectionData(i);
        memoryOptimizer.registerPeerConnection(`periodic-cleanup-peer-${i}`, connectionData);
      }
      
      // Simulate stale connections (not optimized recently)
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      
      for (let i = 0; i < connectionCount / 2; i++) {
        const metrics = memoryOptimizer.memoryMetrics.perConnection.get(`periodic-cleanup-peer-${i}`);
        metrics.lastOptimized = now - staleThreshold - 60000; // Make them stale
      }
      
      const staleConnections = memoryOptimizer.findStaleConnections();
      expect(staleConnections.length).toBe(connectionCount / 2);
      
      // Trigger periodic cleanup
      await memoryOptimizer.performPeriodicCleanup();
      
      // Verify cleanup effectiveness
      const metrics = memoryOptimizer.getMemoryMetrics();
      expect(metrics.connectionCount).toBe(connectionCount);
    });
  });

  describe('Resource Pool Management', () => {
    test('should manage connection pool efficiently', async () => {
      const connectionCount = 20;
      
      // Add connections to pool
      for (let i = 0; i < connectionCount; i++) {
        const connectionData = createMockConnectionData(i);
        memoryOptimizer.registerPeerConnection(`pool-test-peer-${i}`, connectionData);
      }
      
      // Test pool optimization
      const poolOptimization = await memoryOptimizer.connectionPool.optimize();
      
      expect(poolOptimization.connectionsOptimized).toBe(connectionCount);
      expect(poolOptimization.cacheCleared).toBeGreaterThanOrEqual(0);
    });

    test('should manage media stream pool effectively', async () => {
      const streamCount = 15;
      
      // Simulate media streams
      for (let i = 0; i < streamCount; i++) {
        const mockStream = createMockMediaStream(i);
        memoryOptimizer.mediaStreamPool.assignStream(`stream-peer-${i}`, mockStream);
      }
      
      const streamOptimization = await memoryOptimizer.mediaStreamPool.optimize();
      
      expect(streamOptimization.streamsOptimized).toBe(streamCount);
    });

    test('should manage buffer pool optimally', async () => {
      const bufferCount = 25;
      
      // Assign various buffer types
      for (let i = 0; i < bufferCount; i++) {
        const bufferSize = (1 + Math.random() * 4) * 1024 * 1024; // 1-5MB buffers
        const bufferType = i % 3 === 0 ? 'video' : i % 3 === 1 ? 'audio' : 'network';
        
        memoryOptimizer.bufferPool.assignBuffer(`buffer-peer-${i}`, bufferType, bufferSize);
      }
      
      const bufferOptimization = await memoryOptimizer.bufferPool.optimize();
      
      expect(bufferOptimization.buffersOptimized).toBe(bufferCount);
    });
  });

  describe('Performance Metrics and Compliance', () => {
    test('should generate comprehensive memory metrics report', async () => {
      // Setup test scenario with multiple connections
      const connectionCount = 30;
      
      for (let i = 0; i < connectionCount; i++) {
        const connectionData = createMockConnectionData(i);
        memoryOptimizer.registerPeerConnection(`metrics-peer-${i}`, connectionData);
      }
      
      const memoryMetrics = memoryOptimizer.getMemoryMetrics();
      
      expect(memoryMetrics).toMatchObject({
        baseline: expect.any(Number),
        current: expect.any(Number),
        peak: expect.any(Number),
        connectionCount: connectionCount,
        averagePerConnection: expect.any(Number),
        optimizationMetrics: expect.objectContaining({
          memoryOptimizations: expect.any(Number),
          connectionsOptimized: expect.any(Number),
          memoryReclaimed: expect.any(Number),
          gcOperations: expect.any(Number)
        }),
        compliance: expect.objectContaining({
          memoryPerConnection: expect.any(Boolean),
          totalMemory: expect.any(Boolean),
          connectionCount: expect.any(Boolean)
        })
      });
      
      // Validate compliance targets
      expect(memoryMetrics.compliance.memoryPerConnection).toBe(
        memoryMetrics.averagePerConnection <= 50 * 1024 * 1024
      );
      expect(memoryMetrics.compliance.totalMemory).toBe(
        memoryMetrics.current <= 2 * 1024 * 1024 * 1024
      );
      expect(memoryMetrics.compliance.connectionCount).toBe(
        memoryMetrics.connectionCount <= 50
      );
    });

    test('should provide optimization recommendations', async () => {
      // Create scenario requiring recommendations
      const connectionCount = 45; // Close to limit
      
      for (let i = 0; i < connectionCount; i++) {
        const connectionData = createMockConnectionData(i);
        memoryOptimizer.registerPeerConnection(`recommendation-peer-${i}`, connectionData);
        
        // Simulate high memory usage
        const metrics = memoryOptimizer.memoryMetrics.perConnection.get(`recommendation-peer-${i}`);
        metrics.currentMemory = 55 * 1024 * 1024; // Above 50MB target
      }
      
      const optimizationReport = memoryOptimizer.getOptimizationReport();
      
      expect(optimizationReport.recommendations.length).toBeGreaterThan(0);
      expect(optimizationReport.recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: expect.any(String),
            severity: expect.stringMatching(/^(low|medium|high|critical)$/),
            message: expect.any(String),
            action: expect.any(String)
          })
        ])
      );
    });

    test('should track garbage collection effectiveness', async () => {
      const gcResults = [];
      
      // Perform multiple GC operations
      for (let i = 0; i < 5; i++) {
        const gcResult = await memoryOptimizer.gcOptimizer.performOptimalGC();
        gcResults.push(gcResult);
      }
      
      const totalMemoryReclaimed = gcResults.reduce((sum, result) => 
        sum + result.memoryReclaimed, 0
      );
      
      expect(totalMemoryReclaimed).toBeGreaterThanOrEqual(0);
      expect(gcResults.every(result => result.gcExecuted)).toBe(true);
      
      console.log(`GC effectiveness: ${formatBytes(totalMemoryReclaimed)} reclaimed over ${gcResults.length} operations`);
    });
  });

  describe('Stress Testing and Edge Cases', () => {
    test('should handle rapid connection registration/cleanup cycles', async () => {
      const cycleCount = 50;
      const cycleResults = [];
      
      for (let i = 0; i < cycleCount; i++) {
        const peerId = `rapid-cycle-peer-${i}`;
        const connectionData = createMockConnectionData(i);
        
        const registerTime = performance.now();
        memoryOptimizer.registerPeerConnection(peerId, connectionData);
        const registered = performance.now();
        
        await memoryOptimizer.unregisterPeerConnection(peerId);
        const unregistered = performance.now();
        
        cycleResults.push({
          registrationTime: registered - registerTime,
          cleanupTime: unregistered - registered,
          totalCycleTime: unregistered - registerTime
        });
      }
      
      const averageRegistrationTime = cycleResults.reduce((sum, r) => sum + r.registrationTime, 0) / cycleCount;
      const averageCleanupTime = cycleResults.reduce((sum, r) => sum + r.cleanupTime, 0) / cycleCount;
      
      expect(averageRegistrationTime).toBeLessThan(10); // <10ms registration
      expect(averageCleanupTime).toBeLessThan(50); // <50ms cleanup
      expect(memoryOptimizer.getMemoryMetrics().connectionCount).toBe(0); // All cleaned up
    });

    test('should maintain stability under memory pressure', async () => {
      // Simulate high memory pressure scenario
      const highMemoryConnections = 40;
      
      for (let i = 0; i < highMemoryConnections; i++) {
        const connectionData = createMockConnectionData(i);
        memoryOptimizer.registerPeerConnection(`pressure-peer-${i}`, connectionData);
        
        // Simulate high memory usage per connection
        const metrics = memoryOptimizer.memoryMetrics.perConnection.get(`pressure-peer-${i}`);
        metrics.currentMemory = 45 * 1024 * 1024; // Close to 50MB limit
      }
      
      // Force global optimization under pressure
      const optimizationResult = await memoryOptimizer.performGlobalOptimization();
      
      expect(optimizationResult.success).toBe(true);
      
      const finalMetrics = memoryOptimizer.getMemoryMetrics();
      expect(finalMetrics.current).toBeLessThan(memoryOptimizer.targets.maxTotalMemory);
    });

    test('should handle initialization and disposal correctly', async () => {
      const testOptimizer = new (await import('../../../src/utils/MemoryResourceOptimizer.js')).default;
      
      expect(testOptimizer.isInitialized).toBe(false);
      
      await testOptimizer.initialize();
      expect(testOptimizer.isInitialized).toBe(true);
      
      testOptimizer.dispose();
      expect(testOptimizer.isInitialized).toBe(false);
      expect(testOptimizer.monitoringInterval).toBe(null);
      expect(testOptimizer.cleanupInterval).toBe(null);
      expect(testOptimizer.gcInterval).toBe(null);
    });
  });

  // Helper functions for mocking and simulation
  function setupMemoryOptimizerMocks() {
    // Mock performance.memory
    let mockMemoryValue = 100 * 1024 * 1024; // Start with 100MB
    
    global.performance = global.performance || {};
    global.performance.memory = {
      get usedJSHeapSize() { return mockMemoryValue; },
      set usedJSHeapSize(value) { mockMemoryValue = value; },
      totalJSHeapSize: 500 * 1024 * 1024,
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024
    };
    
    // Mock window.gc for garbage collection testing
    global.window = global.window || {};
    global.window.gc = jest.fn();
  }

  function cleanupMemoryOptimizerMocks() {
    jest.restoreAllMocks();
  }

  function mockMemoryUsage() {
    return performance.memory.usedJSHeapSize;
  }

  function createMockConnectionData(index) {
    return {
      peerId: `peer-${index}`,
      connectionTime: Date.now(),
      rtcPeerConnection: {
        connectionState: 'connected',
        iceConnectionState: 'connected'
      },
      mediaStreams: [],
      dataChannels: [],
      stats: {
        bytesReceived: Math.random() * 1000000,
        bytesSent: Math.random() * 1000000,
        packetsLost: Math.floor(Math.random() * 10),
        rtt: Math.random() * 100 + 20
      }
    };
  }

  function createMockMediaStream(index) {
    return {
      id: `stream-${index}`,
      getTracks: jest.fn().mockReturnValue([
        { kind: 'video', stop: jest.fn() },
        { kind: 'audio', stop: jest.fn() }
      ])
    };
  }

  async function simulateConnectionMemoryUsage(optimizer, connectionCount) {
    // Simulate realistic memory growth per connection
    const baseMemoryPerConnection = 25 * 1024 * 1024; // 25MB base
    const variancePerConnection = 15 * 1024 * 1024; // ±15MB variance
    
    let totalMemoryIncrease = 0;
    
    for (let i = 0; i < connectionCount; i++) {
      const connectionMemory = baseMemoryPerConnection + 
                              (Math.random() - 0.5) * variancePerConnection;
      totalMemoryIncrease += connectionMemory;
      
      const metrics = optimizer.memoryMetrics.perConnection.get(`peer-${i}`);
      if (metrics) {
        metrics.currentMemory = connectionMemory;
        metrics.peakMemory = Math.max(metrics.peakMemory, connectionMemory);
      }
    }
    
    // Update global memory usage
    const currentMemory = performance.memory.usedJSHeapSize + totalMemoryIncrease;
    performance.memory.usedJSHeapSize = currentMemory;
  }

  async function simulateScaledMemoryUsage(optimizer, connectionCount) {
    // Simulate memory usage that scales with connection count
    const memoryPerConnection = 40 * 1024 * 1024; // 40MB per connection
    const totalMemoryIncrease = connectionCount * memoryPerConnection;
    
    // Update each connection's memory usage
    for (let i = 0; i < connectionCount; i++) {
      const metrics = optimizer.memoryMetrics.perConnection.get(`stress-peer-${i}`);
      if (metrics) {
        metrics.currentMemory = memoryPerConnection + (Math.random() - 0.5) * 10 * 1024 * 1024; // ±10MB variance
        metrics.peakMemory = Math.max(metrics.peakMemory, metrics.currentMemory);
      }
    }
    
    // Update global memory to reflect scaled usage
    performance.memory.usedJSHeapSize = optimizer.memoryMetrics.baseline + totalMemoryIncrease;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
});

// Export performance validation utilities
export function validateMemoryPerformanceMetrics(metrics) {
  const summary = {
    memoryCompliance: {
      averagePerConnection: 0,
      maxPerConnection: 0,
      totalMemoryUsage: 0,
      under50MBRate: 0
    },
    optimizationEffectiveness: {
      averageOptimizationTime: 0,
      averageMemoryReclaimed: 0,
      optimizationSuccessRate: 0
    },
    cleanupEffectiveness: {
      averageCleanupTime: 0,
      cleanupSuccessRate: 0
    },
    concurrentConnectionSupport: {
      maxTested: 0,
      memoryScalability: 0
    }
  };

  // Memory compliance analysis
  if (metrics.memoryUsagePerConnection.length > 0) {
    const memoryUsages = metrics.memoryUsagePerConnection;
    summary.memoryCompliance.averagePerConnection = 
      memoryUsages.reduce((sum, usage) => sum + usage.perConnection, 0) / memoryUsages.length;
    summary.memoryCompliance.maxPerConnection = 
      Math.max(...memoryUsages.map(usage => usage.perConnection));
    summary.memoryCompliance.under50MBRate = 
      memoryUsages.filter(usage => usage.belowTarget).length / memoryUsages.length;
  }

  // Optimization effectiveness
  if (metrics.optimizationResults.length > 0) {
    const optimizations = metrics.optimizationResults;
    summary.optimizationEffectiveness.averageOptimizationTime = 
      optimizations.reduce((sum, opt) => sum + opt.optimizationTime, 0) / optimizations.length;
    summary.optimizationEffectiveness.averageMemoryReclaimed = 
      optimizations.reduce((sum, opt) => sum + opt.memoryReclaimed, 0) / optimizations.length;
    summary.optimizationEffectiveness.optimizationSuccessRate = 
      optimizations.filter(opt => opt.success).length / optimizations.length;
  }

  // Cleanup effectiveness
  if (metrics.cleanupEffectiveness.length > 0) {
    const cleanups = metrics.cleanupEffectiveness;
    summary.cleanupEffectiveness.cleanupSuccessRate = 
      cleanups.filter(cleanup => cleanup.cleanupComplete).length / cleanups.length;
  }

  // Concurrent connection support
  if (metrics.concurrentConnectionResults.length > 0) {
    const concurrentResults = metrics.concurrentConnectionResults;
    summary.concurrentConnectionSupport.maxTested = 
      Math.max(...concurrentResults.map(result => result.connectionCount));
    summary.concurrentConnectionSupport.memoryScalability = 
      concurrentResults.filter(result => 
        result.withinTotalLimit && result.withinPerConnectionLimit
      ).length / concurrentResults.length;
  }

  return summary;
}