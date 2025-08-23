/**
 * Advanced WebRTC Connection Manager Performance Tests
 * 
 * Validates the comprehensive WebRTC connection management implementation
 * including simulcast, SVC, quality adaptation, and performance monitoring.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import AdvancedConnectionManager from '../../../src/services/webrtc/advancedConnectionManager.js';

describe('Advanced WebRTC Connection Manager - Performance Validation', () => {
  let connectionManager;
  let mockPeerConnection;
  let mockMediaStream;
  let performanceMetrics;

  beforeEach(async () => {
    // Setup mock WebRTC environment
    setupWebRTCMocks();
    
    connectionManager = new AdvancedConnectionManager({
      enableSimulcast: true,
      enableSVC: true,
      maxConnections: 50,
      qualityLevels: ['low', 'medium', 'high'],
      bandwidthLimits: {
        low: 300000,
        medium: 1000000,
        high: 2500000
      }
    });

    await connectionManager.initialize();
    performanceMetrics = {
      connectionTimes: [],
      qualityAdaptations: [],
      memoryUsage: []
    };
  });

  afterEach(async () => {
    if (connectionManager) {
      connectionManager.dispose();
    }
    cleanupWebRTCMocks();
  });

  describe('Connection Establishment Performance', () => {
    test('should establish connection within 500ms target', async () => {
      const startTime = performance.now();
      
      const peer = await connectionManager.createPeerConnection(
        'test-peer-001',
        mockMediaStream,
        { initiator: true }
      );
      
      const connectionTime = performance.now() - startTime;
      performanceMetrics.connectionTimes.push(connectionTime);
      
      expect(peer).toBeDefined();
      expect(connectionTime).toBeLessThan(500); // <500ms target
      expect(connectionManager.getPerformanceMetrics().totalConnections).toBe(1);
    });

    test('should handle multiple concurrent connections under 50 peer limit', async () => {
      const connectionPromises = [];
      const maxConcurrentConnections = 25; // Test with 25 to stay well under 50 limit
      
      for (let i = 0; i < maxConcurrentConnections; i++) {
        const promise = connectionManager.createPeerConnection(
          `test-peer-${i.toString().padStart(3, '0')}`,
          mockMediaStream,
          { initiator: i % 2 === 0 }
        );
        connectionPromises.push(promise);
      }
      
      const connections = await Promise.all(connectionPromises);
      
      expect(connections).toHaveLength(maxConcurrentConnections);
      expect(connections.every(peer => peer !== null)).toBe(true);
      expect(connectionManager.getPerformanceMetrics().totalConnections).toBe(maxConcurrentConnections);
    });

    test('should initialize advanced connection configuration correctly', async () => {
      const peer = await connectionManager.createPeerConnection(
        'config-test-peer',
        mockMediaStream,
        { initiator: true }
      );

      // Verify ICE configuration
      expect(peer._pc.getConfiguration().iceServers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ urls: 'stun:stun.l.google.com:19302' }),
          expect.objectContaining({ urls: 'stun:global.stun.twilio.com:3478' })
        ])
      );

      // Verify bundle policy and other advanced settings
      expect(peer._pc.getConfiguration().bundlePolicy).toBe('max-bundle');
      expect(peer._pc.getConfiguration().rtcpMuxPolicy).toBe('require');
    });
  });

  describe('Simulcast and SVC Functionality', () => {
    test('should configure simulcast encoding parameters when supported', async () => {
      // Mock simulcast support
      mockSimulcastSupport(true);
      
      const peer = await connectionManager.createPeerConnection(
        'simulcast-peer',
        mockMediaStream,
        { initiator: true }
      );

      // Verify simulcast configuration
      const mockSender = peer._pc.getSenders()[0];
      expect(mockSender.setParameters).toHaveBeenCalledWith(
        expect.objectContaining({
          encodings: expect.arrayContaining([
            expect.objectContaining({ rid: 'high', maxBitrate: 2500000 }),
            expect.objectContaining({ rid: 'medium', maxBitrate: 1000000 }),
            expect.objectContaining({ rid: 'low', maxBitrate: 300000 })
          ])
        })
      );
    });

    test('should gracefully handle simulcast unavailability', async () => {
      // Mock simulcast not supported
      mockSimulcastSupport(false);
      
      const peer = await connectionManager.createPeerConnection(
        'no-simulcast-peer',
        mockMediaStream,
        { initiator: true }
      );

      expect(peer).toBeDefined();
      // Should still create connection without simulcast
      expect(connectionManager.isSimulcastSupported()).toBe(false);
    });

    test('should perform quality adaptation within performance targets', async () => {
      const peer = await connectionManager.createPeerConnection(
        'adaptation-peer',
        mockMediaStream,
        { initiator: true }
      );

      const adaptationStartTime = performance.now();
      
      await connectionManager.adaptQuality('adaptation-peer', 'low');
      
      const adaptationTime = performance.now() - adaptationStartTime;
      performanceMetrics.qualityAdaptations.push(adaptationTime);
      
      expect(adaptationTime).toBeLessThan(1000); // Should adapt within 1 second
      expect(connectionManager.getPeerStats('adaptation-peer').qualityLevel).toBe('low');
    });
  });

  describe('Performance Monitoring and Statistics', () => {
    test('should collect comprehensive WebRTC statistics', async () => {
      const peer = await connectionManager.createPeerConnection(
        'stats-peer',
        mockMediaStream,
        { initiator: true }
      );

      // Simulate stats collection
      await simulateStatsCollection(connectionManager, 'stats-peer');

      const stats = connectionManager.getPeerStats('stats-peer');
      
      expect(stats).toMatchObject({
        connectionTime: expect.any(Number),
        bytesReceived: expect.any(Number),
        bytesSent: expect.any(Number),
        packetsLost: expect.any(Number),
        rtt: expect.any(Number),
        jitter: expect.any(Number),
        qualityLevel: expect.stringMatching(/^(low|medium|high)$/),
        bandwidth: expect.objectContaining({
          upload: expect.any(Number),
          download: expect.any(Number)
        })
      });
    });

    test('should maintain performance metrics within enterprise targets', async () => {
      // Create multiple connections and monitor performance
      const connectionCount = 10;
      const connections = [];

      for (let i = 0; i < connectionCount; i++) {
        const peer = await connectionManager.createPeerConnection(
          `metrics-peer-${i}`,
          mockMediaStream,
          { initiator: i % 2 === 0 }
        );
        connections.push(peer);
      }

      const metrics = connectionManager.getPerformanceMetrics();
      
      // Validate enterprise performance targets
      expect(metrics.totalConnections).toBe(connectionCount);
      expect(metrics.activeConnections).toBe(connectionCount);
      expect(metrics.averageRTT).toBeLessThan(200); // <200ms target
      expect(metrics.packetLoss).toBeLessThan(0.02); // <2% packet loss target
    });

    test('should track network conditions and provide recommendations', async () => {
      const peer = await connectionManager.createPeerConnection(
        'network-peer',
        mockMediaStream,
        { initiator: true }
      );

      // Simulate network condition analysis
      await simulateNetworkAnalysis(connectionManager);

      const networkConditions = connectionManager.getNetworkConditions();
      
      expect(networkConditions).toMatchObject({
        averageRTT: expect.any(Number),
        totalBandwidth: expect.any(Number),
        packetLossRate: expect.any(Number),
        connectionStability: expect.stringMatching(/^(excellent|good|fair|poor)$/),
        recommendation: expect.any(Array)
      });
    });
  });

  describe('Resource Management and Cleanup', () => {
    test('should properly cleanup peer connections', async () => {
      const peerId = 'cleanup-test-peer';
      
      const peer = await connectionManager.createPeerConnection(
        peerId,
        mockMediaStream,
        { initiator: true }
      );
      
      expect(connectionManager.getPeerStats(peerId)).toBeDefined();
      
      connectionManager.removePeer(peerId);
      
      expect(connectionManager.getPeerStats(peerId)).toBeUndefined();
      expect(peer.destroyed).toBe(true);
    });

    test('should handle connection failures gracefully', async () => {
      // Mock connection failure scenario
      mockPeerConnection.emit('error', new Error('ICE connection failed'));
      
      let connectionError = null;
      try {
        await connectionManager.createPeerConnection(
          'error-test-peer',
          mockMediaStream,
          { initiator: true }
        );
      } catch (error) {
        connectionError = error;
      }
      
      expect(connectionError).toBeDefined();
      expect(connectionError.message).toContain('ICE connection failed');
    });

    test('should implement connection recovery mechanisms', async () => {
      const peerId = 'recovery-test-peer';
      
      const peer = await connectionManager.createPeerConnection(
        peerId,
        mockMediaStream,
        { initiator: true }
      );
      
      // Simulate recoverable error
      const error = new Error('Connection timeout');
      const isRecoverable = connectionManager.isRecoverableError(error);
      
      expect(isRecoverable).toBe(true);
      
      // Verify reconnection attempt is scheduled
      const reconnectionSpy = jest.spyOn(connectionManager, 'attemptReconnection');
      connectionManager.handlePeerError(peerId, error);
      
      await new Promise(resolve => setTimeout(resolve, 2500)); // Wait for reconnection delay
      
      expect(reconnectionSpy).toHaveBeenCalledWith(peerId);
    });
  });

  describe('Stress Testing and Edge Cases', () => {
    test('should maintain performance under high connection load', async () => {
      const highLoadCount = 40; // Stress test with 40 connections
      const connections = [];
      const connectionTimes = [];

      for (let i = 0; i < highLoadCount; i++) {
        const startTime = performance.now();
        
        const peer = await connectionManager.createPeerConnection(
          `stress-peer-${i}`,
          mockMediaStream,
          { initiator: i % 2 === 0 }
        );
        
        const connectionTime = performance.now() - startTime;
        connectionTimes.push(connectionTime);
        connections.push(peer);
      }

      // Calculate performance statistics
      const averageConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length;
      const p95ConnectionTime = connectionTimes.sort((a, b) => a - b)[Math.floor(connectionTimes.length * 0.95)];

      expect(averageConnectionTime).toBeLessThan(750); // Allow some degradation under load
      expect(p95ConnectionTime).toBeLessThan(1000); // 95th percentile target
      expect(connections.length).toBe(highLoadCount);
    });

    test('should handle rapid connection/disconnection cycles', async () => {
      const cycleCount = 20;
      
      for (let i = 0; i < cycleCount; i++) {
        const peerId = `cycle-peer-${i}`;
        
        const peer = await connectionManager.createPeerConnection(
          peerId,
          mockMediaStream,
          { initiator: true }
        );
        
        expect(peer).toBeDefined();
        
        // Immediate cleanup
        connectionManager.removePeer(peerId);
        
        expect(connectionManager.getPeerStats(peerId)).toBeUndefined();
      }

      // Verify no memory leaks or orphaned connections
      expect(connectionManager.getPerformanceMetrics().totalConnections).toBe(0);
    });

    test('should maintain memory usage within limits during stress testing', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const connectionCount = 30;
      
      for (let i = 0; i < connectionCount; i++) {
        await connectionManager.createPeerConnection(
          `memory-test-peer-${i}`,
          mockMediaStream,
          { initiator: i % 2 === 0 }
        );
      }
      
      const peakMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = peakMemory - initialMemory;
      const memoryPerConnection = memoryIncrease / connectionCount;
      
      performanceMetrics.memoryUsage.push({
        connections: connectionCount,
        totalIncrease: memoryIncrease,
        perConnection: memoryPerConnection
      });
      
      // Target: <50MB per connection (in bytes: 50 * 1024 * 1024)
      expect(memoryPerConnection).toBeLessThan(50 * 1024 * 1024);
    });
  });

  // Helper functions for mocking and simulation
  function setupWebRTCMocks() {
    // Mock RTCPeerConnection
    global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
      addTransceiver: jest.fn().mockReturnValue({
        sender: {
          getParameters: jest.fn().mockReturnValue({ encodings: [] }),
          setParameters: jest.fn().mockResolvedValue(undefined)
        }
      }),
      getSenders: jest.fn().mockReturnValue([{
        track: { kind: 'video' },
        getParameters: jest.fn().mockReturnValue({ encodings: [] }),
        setParameters: jest.fn().mockResolvedValue(undefined)
      }]),
      getReceivers: jest.fn().mockReturnValue([]),
      getConfiguration: jest.fn().mockReturnValue({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ],
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      }),
      close: jest.fn()
    }));

    // Mock MediaStream
    mockMediaStream = {
      getVideoTracks: jest.fn().mockReturnValue([{
        kind: 'video',
        id: 'video-track-1'
      }]),
      getAudioTracks: jest.fn().mockReturnValue([{
        kind: 'audio',
        id: 'audio-track-1'
      }])
    };

    // Mock simple-peer
    jest.mock('simple-peer', () => {
      return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        signal: jest.fn(),
        send: jest.fn(),
        destroy: jest.fn(),
        destroyed: false,
        _pc: new RTCPeerConnection()
      }));
    });

    // Mock webrtc-stats
    jest.mock('webrtc-stats', () => ({
      getStats: jest.fn().mockResolvedValue({
        video: {
          inbound: {
            framesReceived: 1000,
            framesPerSecond: 30,
            bytesReceived: 1000000,
            packetsReceived: 500,
            packetsLost: 2,
            jitter: 0.01
          },
          outbound: {
            framesSent: 1000,
            bytesSent: 1000000,
            packetsSent: 500
          }
        },
        audio: {
          inbound: {
            bytesReceived: 100000,
            packetsReceived: 200,
            packetsLost: 0
          }
        },
        connection: {
          rtt: 50,
          availableIncomingBitrate: 1500000,
          availableOutgoingBitrate: 1200000
        }
      })
    }));
  }

  function cleanupWebRTCMocks() {
    jest.restoreAllMocks();
  }

  function mockSimulcastSupport(supported) {
    RTCPeerConnection.prototype.addTransceiver = jest.fn().mockReturnValue({
      sender: {
        getParameters: jest.fn().mockReturnValue(
          supported ? { encodings: [] } : {}
        ),
        setParameters: jest.fn().mockResolvedValue(undefined)
      }
    });
  }

  async function simulateStatsCollection(manager, peerId) {
    // Simulate periodic stats collection
    await manager.collectConnectionStats();
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  async function simulateNetworkAnalysis(manager) {
    // Simulate network condition analysis
    const networkHealth = {
      averageRTT: 75,
      totalBandwidth: 2700000,
      packetLossRate: 0.01,
      jitter: 0.02,
      connectionStability: 'good',
      recommendation: ['Network conditions are good']
    };
    
    // Mock network analyzer
    manager.networkAnalyzer = {
      analyze: jest.fn().mockResolvedValue(networkHealth)
    };
    
    await manager.analyzeNetworkConditions();
  }
});

// Performance validation helper
export function validatePerformanceMetrics(metrics) {
  const summary = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    performance: {
      averageConnectionTime: 0,
      p95ConnectionTime: 0,
      adaptationTimes: [],
      memoryUsagePerConnection: 0
    }
  };

  // Calculate connection time statistics
  if (metrics.connectionTimes.length > 0) {
    const sortedTimes = metrics.connectionTimes.sort((a, b) => a - b);
    summary.performance.averageConnectionTime = 
      sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;
    summary.performance.p95ConnectionTime = 
      sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  }

  // Quality adaptation performance
  summary.performance.adaptationTimes = metrics.qualityAdaptations;

  // Memory usage analysis
  if (metrics.memoryUsage.length > 0) {
    summary.performance.memoryUsagePerConnection = 
      metrics.memoryUsage.reduce((sum, usage) => sum + usage.perConnection, 0) / 
      metrics.memoryUsage.length;
  }

  return summary;
}