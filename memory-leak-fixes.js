// PRIORITY 2: Memory Leak Prevention and Resource Management

import { useEffect, useRef, useCallback } from 'react';

// 1. Comprehensive cleanup hook
const useResourceCleanup = () => {
  const resourcesRef = useRef({
    intervals: new Set(),
    timeouts: new Set(),
    eventListeners: new Map(),
    mediaRecorders: new Set(),
    objectUrls: new Set(),
    peerConnections: new Map()
  });

  const addInterval = useCallback((intervalId) => {
    resourcesRef.current.intervals.add(intervalId);
    return intervalId;
  }, []);

  const addTimeout = useCallback((timeoutId) => {
    resourcesRef.current.timeouts.add(timeoutId);
    return timeoutId;
  }, []);

  const addObjectUrl = useCallback((url) => {
    resourcesRef.current.objectUrls.add(url);
    return url;
  }, []);

  const addMediaRecorder = useCallback((recorder) => {
    resourcesRef.current.mediaRecorders.add(recorder);
    return recorder;
  }, []);

  const addPeerConnection = useCallback((id, peer) => {
    resourcesRef.current.peerConnections.set(id, peer);
    return peer;
  }, []);

  const cleanup = useCallback(() => {
    const resources = resourcesRef.current;
    
    // Clear intervals
    resources.intervals.forEach(id => clearInterval(id));
    resources.intervals.clear();
    
    // Clear timeouts
    resources.timeouts.forEach(id => clearTimeout(id));
    resources.timeouts.clear();
    
    // Remove event listeners
    resources.eventListeners.forEach((listener, element) => {
      element.removeEventListener(listener.event, listener.handler);
    });
    resources.eventListeners.clear();
    
    // Stop media recorders
    resources.mediaRecorders.forEach(recorder => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    });
    resources.mediaRecorders.clear();
    
    // Revoke object URLs
    resources.objectUrls.forEach(url => URL.revokeObjectURL(url));
    resources.objectUrls.clear();
    
    // Destroy peer connections
    resources.peerConnections.forEach(peer => {
      if (peer && !peer.destroyed) {
        peer.destroy();
      }
    });
    resources.peerConnections.clear();
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    addInterval,
    addTimeout,
    addObjectUrl,
    addMediaRecorder,
    addPeerConnection,
    cleanup
  };
};

// 2. Optimized media recorder with proper cleanup
const useMediaRecorder = (stream) => {
  const [recording, setRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const { addMediaRecorder, addObjectUrl } = useResourceCleanup();

  const startRecording = useCallback(() => {
    if (!stream || recording) return;

    try {
      const recorder = new MediaRecorder(stream, { 
        mimeType: 'video/webm;codecs=vp9,opus' 
      });
      
      mediaRecorderRef.current = recorder;
      addMediaRecorder(recorder);
      
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(addObjectUrl(url));
        setRecordedChunks(chunks);
        toast.success('Recording complete!');
      };
      
      recorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        toast.error('Recording failed');
        setRecording(false);
      };
      
      recorder.start(1000); // Record in 1s chunks
      setRecording(true);
      toast.success('⏺️ Recording started');
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
    }
  }, [stream, recording, addMediaRecorder, addObjectUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, [recording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    recording,
    recordedChunks,
    downloadUrl,
    startRecording,
    stopRecording
  };
};

// 3. WebRTC peer connection manager with proper cleanup
const usePeerConnectionManager = () => {
  const peersRef = useRef(new Map());
  const { addPeerConnection } = useResourceCleanup();

  const createPeer = useCallback((userId, isInitiator, stream) => {
    const peer = new Peer({
      initiator: isInitiator,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    // Add to cleanup tracking
    addPeerConnection(userId, peer);
    
    // Enhanced error handling
    peer.on('error', (err) => {
      console.error(`Peer ${userId} error:`, err);
      removePeer(userId);
    });

    peer.on('close', () => {
      console.log(`Peer ${userId} connection closed`);
      removePeer(userId);
    });

    peersRef.current.set(userId, peer);
    return peer;
  }, [addPeerConnection]);

  const removePeer = useCallback((userId) => {
    const peer = peersRef.current.get(userId);
    if (peer && !peer.destroyed) {
      peer.destroy();
    }
    peersRef.current.delete(userId);
  }, []);

  const removeAllPeers = useCallback(() => {
    peersRef.current.forEach((peer, userId) => {
      removePeer(userId);
    });
    peersRef.current.clear();
  }, [removePeer]);

  return {
    createPeer,
    removePeer,
    removeAllPeers,
    peers: peersRef.current
  };
};

// 4. Socket event listener manager
const useSocketEventManager = (socket) => {
  const listenersRef = useRef(new Map());

  const addListener = useCallback((event, handler) => {
    // Remove existing listener if any
    if (listenersRef.current.has(event)) {
      socket.off(event, listenersRef.current.get(event));
    }
    
    socket.on(event, handler);
    listenersRef.current.set(event, handler);
  }, [socket]);

  const removeListener = useCallback((event) => {
    const handler = listenersRef.current.get(event);
    if (handler) {
      socket.off(event, handler);
      listenersRef.current.delete(event);
    }
  }, [socket]);

  const removeAllListeners = useCallback(() => {
    listenersRef.current.forEach((handler, event) => {
      socket.off(event, handler);
    });
    listenersRef.current.clear();
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return removeAllListeners;
  }, [removeAllListeners]);

  return {
    addListener,
    removeListener,
    removeAllListeners
  };
};

export {
  useResourceCleanup,
  useMediaRecorder,
  usePeerConnectionManager,
  useSocketEventManager
};