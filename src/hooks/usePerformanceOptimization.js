/**
 * Performance Optimization React Hook
 * 
 * This hook provides:
 * - WebRTC performance monitoring
 * - Adaptive bitrate streaming
 * - Intelligent peer selection
 * - React component optimization
 * - Memory leak prevention
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { debounce, throttle } from 'lodash-es';
import performanceMonitor from '../utils/PerformanceMonitor';
import adaptiveBitrate from '../utils/AdaptiveBitrate';
import peerOptimizer from '../utils/PeerOptimizer';
import toast from 'react-hot-toast';

export const usePerformanceOptimization = ({
  peers = [],
  stream = null,
  roomId = null,
  enabled = true
}) => {
  const monitoringRef = useRef(false);
  const performanceDataRef = useRef(new Map());
  const adaptationTimeoutRef = useRef(null);
  const cleanupFunctionsRef = useRef([]);

  // Memoized callbacks to prevent unnecessary re-renders
  const debouncedAdaptation = useMemo(
    () => debounce(async (metrics) => {
      if (!enabled) return;
      
      try {
        const adaptation = await adaptiveBitrate.adaptQuality(metrics);
        if (adaptation && stream) {
          await adaptiveBitrate.applyConstraints(stream, adaptation.to);
          toast.success(`📊 Quality adapted: ${adaptation.from} → ${adaptation.to}`);
        }
      } catch (error) {
        console.error('Adaptive quality error:', error);
      }
    }, 5000),
    [stream, enabled]
  );

  const throttledPeerMonitoring = useMemo(
    () => throttle(async (peer, peerId) => {
      if (!enabled || !peer || peer.destroyed) return;
      
      try {
        const stats = await performanceMonitor.monitorPeerConnection(peer, peerId);
        if (stats) {
          peerOptimizer.updatePeerMetrics(peerId, {
            rtt: stats.network.currentRoundTripTime,
            bandwidth: stats.network.availableOutgoingBitrate,
            packetLoss: calculatePacketLoss(stats),
            frameRate: stats.video.inbound?.framesPerSecond || 0
          });
          
          performanceDataRef.current.set(peerId, stats);
          
          // Trigger adaptive quality if needed
          debouncedAdaptation({
            bandwidth: stats.network.availableOutgoingBitrate,
            rtt: stats.network.currentRoundTripTime,
            packetLoss: calculatePacketLoss(stats),
            connectionType: getConnectionType()
          });
        }
      } catch (error) {
        console.error(`Error monitoring peer ${peerId}:`, error);
      }
    }, 2000),
    [enabled, debouncedAdaptation]
  );

  // Calculate packet loss from WebRTC stats
  const calculatePacketLoss = useCallback((stats) => {
    const inbound = stats.video.inbound;
    if (!inbound || !inbound.packetsReceived) return 0;
    
    const packetsLost = inbound.packetsLost || 0;
    const packetsReceived = inbound.packetsReceived;
    return packetsLost / (packetsLost + packetsReceived);
  }, []);

  // Get connection type from Network API
  const getConnectionType = useCallback(() => {
    if (navigator.connection) {
      return navigator.connection.effectiveType === '4g' ? 'wifi' : 'cellular';
    }
    return 'unknown';
  }, []);

  // Initialize performance monitoring
  const startPerformanceMonitoring = useCallback(() => {
    if (monitoringRef.current || !enabled) return;

    console.log('🚀 Starting performance monitoring');
    monitoringRef.current = true;
    
    // Start performance monitor
    performanceMonitor.start();
    
    // Register performance observers
    const performanceObserver = (data) => {
      if (data.type === 'performance_issues') {
        toast.error(`⚠️ Performance issue: ${data.issues[0]?.message}`);
      }
    };
    
    const qualityObserver = (data) => {
      if (data.type === 'quality_adapted') {
        console.log('Quality adapted:', data);
      }
    };

    performanceMonitor.addObserver(performanceObserver);
    adaptiveBitrate.addObserver(qualityObserver);
    
    // Store cleanup functions
    cleanupFunctionsRef.current.push(
      () => performanceMonitor.removeObserver(performanceObserver),
      () => adaptiveBitrate.removeObserver(qualityObserver)
    );
  }, [enabled]);

  // Stop performance monitoring
  const stopPerformanceMonitoring = useCallback(() => {
    if (!monitoringRef.current) return;

    console.log('🛑 Stopping performance monitoring');
    monitoringRef.current = false;
    
    // Stop performance monitor
    performanceMonitor.stop();
    
    // Clear timeouts
    if (adaptationTimeoutRef.current) {
      clearTimeout(adaptationTimeoutRef.current);
    }
    
    // Execute cleanup functions
    cleanupFunctionsRef.current.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
    cleanupFunctionsRef.current = [];
    
    // Clear performance data
    performanceDataRef.current.clear();
  }, []);

  // Monitor individual peer performance
  const monitorPeer = useCallback((peer, peerId) => {
    if (!enabled || !peer) return;

    // Register peer with optimizer
    peerOptimizer.registerPeer(peerId, peer, {
      userAgent: navigator.userAgent,
      location: null,
      capabilities: {
        video: true,
        audio: true,
        screen: 'getDisplayMedia' in navigator.mediaDevices
      }
    });

    // Start monitoring
    const monitoringInterval = setInterval(() => {
      throttledPeerMonitoring(peer, peerId);
    }, 3000);

    // Store cleanup function
    cleanupFunctionsRef.current.push(() => {
      clearInterval(monitoringInterval);
      peerOptimizer.unregisterPeer(peerId);
    });

    return () => {
      clearInterval(monitoringInterval);
      peerOptimizer.unregisterPeer(peerId);
    };
  }, [enabled, throttledPeerMonitoring]);

  // Optimize peer connections
  const optimizePeerConnections = useCallback(() => {
    if (!enabled) return [];

    const peerIds = peers.map(peer => peer.peerID).filter(Boolean);
    const optimizations = peerOptimizer.optimizeConnections();
    
    console.log('🔍 Peer optimization results:', optimizations);
    
    return optimizations;
  }, [peers, enabled]);

  // Get optimal peer selection
  const getOptimalPeers = useCallback((availablePeers, maxConnections = 4) => {
    if (!enabled) return availablePeers;

    return peerOptimizer.getOptimalPeers(
      availablePeers, 
      'hybrid', 
      maxConnections
    );
  }, [enabled]);

  // Apply performance constraints to stream
  const applyPerformanceConstraints = useCallback(async (mediaStream) => {
    if (!enabled || !mediaStream) return false;

    try {
      // Get current network conditions
      const networkInfo = performanceMonitor.getNetworkInfo();
      const networkCondition = networkInfo ? 
        (networkInfo.effectiveType === 'slow-2g' ? 'poor' : 
         networkInfo.effectiveType === '2g' ? 'fair' : 
         networkInfo.effectiveType === '3g' ? 'good' : 'excellent') : 'good';

      // Apply adaptive constraints
      const success = await adaptiveBitrate.applyConstraints(mediaStream);
      
      if (success) {
        console.log('✅ Performance constraints applied successfully');
      }
      
      return success;
    } catch (error) {
      console.error('Error applying performance constraints:', error);
      return false;
    }
  }, [enabled]);

  // Get performance metrics summary
  const getPerformanceMetrics = useCallback(() => {
    if (!enabled) return null;

    return {
      monitoring: monitoringRef.current,
      peers: peerOptimizer.getOptimizationStats(),
      quality: adaptiveBitrate.getCurrentQuality(),
      adaptation: adaptiveBitrate.getAdaptationStats(),
      memory: performanceMonitor.getMemoryUsage(),
      network: performanceMonitor.getNetworkInfo()
    };
  }, [enabled]);

  // Optimized connection establishment
  const createOptimizedPeerConnection = useCallback((peerId, isInitiator = false) => {
    if (!enabled) return null;

    // Get optimal ICE configuration based on network conditions
    const networkInfo = performanceMonitor.getNetworkInfo();
    const iceConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ],
      iceCandidatePoolSize: networkInfo?.effectiveType === 'slow-2g' ? 2 : 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    return {
      config: iceConfig,
      optimizations: {
        lowLatency: networkInfo?.rtt < 100,
        limitBandwidth: networkInfo?.effectiveType === 'slow-2g',
        enableAdaptation: true
      }
    };
  }, [enabled]);

  // Memory optimization
  const optimizeMemoryUsage = useCallback(() => {
    if (!enabled) return;

    // Force garbage collection if available (development only)
    if (typeof window.gc === 'function') {
      window.gc();
    }

    // Clean up old performance data
    const cutoff = Date.now() - 300000; // 5 minutes
    performanceDataRef.current.forEach((data, peerId) => {
      if (data.timestamp < cutoff) {
        performanceDataRef.current.delete(peerId);
      }
    });

    console.log('🧹 Memory optimization completed');
  }, [enabled]);

  // Effect: Initialize and cleanup
  useEffect(() => {
    if (enabled) {
      startPerformanceMonitoring();
    }

    return () => {
      stopPerformanceMonitoring();
    };
  }, [enabled, startPerformanceMonitoring, stopPerformanceMonitoring]);

  // Effect: Monitor peers
  useEffect(() => {
    if (!enabled || peers.length === 0) return;

    const cleanupFunctions = peers.map(peer => {
      if (peer.peer && peer.peerID) {
        return monitorPeer(peer.peer, peer.peerID);
      }
      return null;
    }).filter(Boolean);

    return () => {
      cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
    };
  }, [peers, enabled, monitorPeer]);

  // Effect: Periodic memory optimization
  useEffect(() => {
    if (!enabled) return;

    const memoryInterval = setInterval(optimizeMemoryUsage, 60000); // Every minute

    return () => clearInterval(memoryInterval);
  }, [enabled, optimizeMemoryUsage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending debounced/throttled functions
      debouncedAdaptation.cancel();
      throttledPeerMonitoring.cancel();
      
      // Stop monitoring
      stopPerformanceMonitoring();
    };
  }, [debouncedAdaptation, throttledPeerMonitoring, stopPerformanceMonitoring]);

  return {
    // Monitoring controls
    isMonitoring: monitoringRef.current,
    startMonitoring: startPerformanceMonitoring,
    stopMonitoring: stopPerformanceMonitoring,
    
    // Peer optimization
    monitorPeer,
    optimizePeerConnections,
    getOptimalPeers,
    
    // Stream optimization
    applyPerformanceConstraints,
    createOptimizedPeerConnection,
    
    // Metrics and statistics
    getPerformanceMetrics,
    performanceData: performanceDataRef.current,
    
    // Utility functions
    optimizeMemoryUsage,
    
    // Adaptive quality controls
    setQualityProfile: adaptiveBitrate.setQualityProfile.bind(adaptiveBitrate),
    setAdaptiveMode: adaptiveBitrate.setAdaptiveMode.bind(adaptiveBitrate),
    getCurrentQuality: adaptiveBitrate.getCurrentQuality.bind(adaptiveBitrate)
  };
};