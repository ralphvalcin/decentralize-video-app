// PRIORITY 3: WebRTC Performance Enhancements

import { useEffect, useRef, useCallback, useState } from 'react';

// 1. Advanced connection quality monitoring
const useConnectionQualityMonitor = (peer, onQualityChange) => {
  const [qualityMetrics, setQualityMetrics] = useState({
    bandwidth: 0,
    packetLoss: 0,
    latency: 0,
    jitter: 0,
    quality: 'unknown'
  });

  const monitoringRef = useRef(null);

  const analyzeStats = useCallback(async () => {
    if (!peer || peer.destroyed) return;

    try {
      const stats = await peer._pc.getStats();
      const report = {};
      
      stats.forEach(stat => {
        if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
          report.inboundRtp = stat;
        }
        if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
          report.outboundRtp = stat;
        }
        if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
          report.candidatePair = stat;
        }
      });

      const metrics = calculateQualityMetrics(report);
      setQualityMetrics(metrics);
      
      if (onQualityChange) {
        onQualityChange(metrics);
      }
    } catch (error) {
      console.error('Stats analysis error:', error);
    }
  }, [peer, onQualityChange]);

  useEffect(() => {
    if (!peer) return;

    monitoringRef.current = setInterval(analyzeStats, 5000);
    
    return () => {
      if (monitoringRef.current) {
        clearInterval(monitoringRef.current);
      }
    };
  }, [peer, analyzeStats]);

  return qualityMetrics;
};

const calculateQualityMetrics = (report) => {
  const metrics = {
    bandwidth: 0,
    packetLoss: 0,
    latency: 0,
    jitter: 0,
    quality: 'unknown'
  };

  if (report.inboundRtp) {
    const inbound = report.inboundRtp;
    metrics.bandwidth = inbound.bytesReceived || 0;
    metrics.packetLoss = (inbound.packetsLost || 0) / (inbound.packetsReceived || 1) * 100;
    metrics.jitter = inbound.jitter || 0;
  }

  if (report.candidatePair) {
    metrics.latency = report.candidatePair.currentRoundTripTime || 0;
  }

  // Calculate overall quality score
  if (metrics.bandwidth > 500000 && metrics.packetLoss < 1 && metrics.latency < 0.1) {
    metrics.quality = 'excellent';
  } else if (metrics.bandwidth > 200000 && metrics.packetLoss < 3 && metrics.latency < 0.2) {
    metrics.quality = 'good';
  } else if (metrics.bandwidth > 100000 && metrics.packetLoss < 5 && metrics.latency < 0.5) {
    metrics.quality = 'fair';
  } else {
    metrics.quality = 'poor';
  }

  return metrics;
};

// 2. Adaptive bitrate control
const useAdaptiveBitrate = (peer, qualityMetrics) => {
  const [currentBitrate, setCurrentBitrate] = useState(1000000); // 1Mbps default
  const lastAdjustmentRef = useRef(Date.now());

  const adjustBitrate = useCallback(async () => {
    if (!peer || peer.destroyed) return;

    const now = Date.now();
    // Only adjust every 10 seconds
    if (now - lastAdjustmentRef.current < 10000) return;

    try {
      const sender = peer._pc.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );

      if (!sender) return;

      let newBitrate = currentBitrate;

      switch (qualityMetrics.quality) {
        case 'poor':
          newBitrate = Math.max(200000, currentBitrate * 0.7); // Reduce by 30%
          break;
        case 'fair':
          newBitrate = Math.max(500000, currentBitrate * 0.9); // Reduce by 10%
          break;
        case 'good':
          newBitrate = Math.min(2000000, currentBitrate * 1.1); // Increase by 10%
          break;
        case 'excellent':
          newBitrate = Math.min(3000000, currentBitrate * 1.2); // Increase by 20%
          break;
      }

      if (newBitrate !== currentBitrate) {
        const params = sender.getParameters();
        if (params.encodings && params.encodings[0]) {
          params.encodings[0].maxBitrate = newBitrate;
          await sender.setParameters(params);
          setCurrentBitrate(newBitrate);
          lastAdjustmentRef.current = now;
          
          console.log(`Bitrate adjusted: ${currentBitrate} -> ${newBitrate} (Quality: ${qualityMetrics.quality})`);
        }
      }
    } catch (error) {
      console.error('Bitrate adjustment error:', error);
    }
  }, [peer, qualityMetrics, currentBitrate]);

  useEffect(() => {
    adjustBitrate();
  }, [qualityMetrics.quality, adjustBitrate]);

  return currentBitrate;
};

// 3. Enhanced ICE configuration with fallbacks
const getOptimizedICEConfig = () => {
  return {
    iceServers: [
      // Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // Twilio STUN servers
      { urls: 'stun:global.stun.twilio.com:3478' },
      
      // Additional STUN servers for better connectivity
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.softjoys.com' }
    ],
    iceCandidatePoolSize: 15,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    
    // Enhanced for mobile and restricted networks
    iceConnectionReceivingTimeout: 4000,
    iceBackupCandidatePairPingInterval: 2000
  };
};

// 4. Screen sharing optimization with content detection
const useOptimizedScreenShare = (peer, onShareChange) => {
  const [isSharing, setIsSharing] = useState(false);
  const [shareType, setShareType] = useState('unknown');
  const originalStreamRef = useRef(null);

  const startScreenShare = useCallback(async () => {
    try {
      const constraints = {
        video: {
          mediaSource: 'screen',
          // Optimize based on content type
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { max: 30, ideal: 15 } // Start conservative
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      // Store original stream
      if (peer && peer.streams[0]) {
        originalStreamRef.current = peer.streams[0];
      }

      // Detect content type for optimization
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        // Listen for content type hints
        videoTrack.addEventListener('ended', () => {
          stopScreenShare();
        });

        // Optimize encoding parameters for screen content
        if (peer && peer._pc) {
          const sender = peer._pc.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          
          if (sender) {
            const params = sender.getParameters();
            if (params.encodings && params.encodings[0]) {
              // Screen content optimization
              params.encodings[0].scaleResolutionDownBy = 1;
              params.encodings[0].maxBitrate = 2000000; // 2Mbps for screen
              params.encodings[0].maxFramerate = 15; // Lower framerate for screen
              await sender.setParameters(params);
            }
          }
        }
      }

      setIsSharing(true);
      setShareType('screen');
      
      if (onShareChange) {
        onShareChange({ isSharing: true, stream: screenStream, type: 'screen' });
      }

      return screenStream;
    } catch (error) {
      console.error('Screen share error:', error);
      throw error;
    }
  }, [peer, onShareChange]);

  const stopScreenShare = useCallback(() => {
    if (originalStreamRef.current && peer) {
      // Restore original stream
      if (onShareChange) {
        onShareChange({ 
          isSharing: false, 
          stream: originalStreamRef.current, 
          type: 'camera' 
        });
      }
    }
    
    setIsSharing(false);
    setShareType('camera');
    originalStreamRef.current = null;
  }, [peer, onShareChange]);

  return {
    isSharing,
    shareType,
    startScreenShare,
    stopScreenShare
  };
};

// 5. Peer connection factory with optimizations
const createOptimizedPeer = (isInitiator, stream, options = {}) => {
  const config = {
    initiator: isInitiator,
    trickle: false,
    stream: stream,
    config: getOptimizedICEConfig(),
    ...options
  };

  const peer = new Peer(config);

  // Add quality monitoring
  peer.qualityMonitor = null;
  
  // Enhanced error handling with retry logic
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;

  peer.on('error', (err) => {
    console.error('Peer error:', err);
    
    if (err.code === 'ERR_CONNECTION_FAILURE' && reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts}`);
      
      setTimeout(() => {
        // Attempt to restart ICE
        if (peer._pc && peer._pc.iceConnectionState === 'failed') {
          peer._pc.restartIce();
        }
      }, 1000 * reconnectAttempts);
    }
  });

  // Connection state monitoring
  peer.on('connect', () => {
    console.log('Peer connected successfully');
    reconnectAttempts = 0; // Reset on successful connection
  });

  return peer;
};

export {
  useConnectionQualityMonitor,
  useAdaptiveBitrate,
  getOptimizedICEConfig,
  useOptimizedScreenShare,
  createOptimizedPeer,
  calculateQualityMetrics
};