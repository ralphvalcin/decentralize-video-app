import { useRef, useCallback, useEffect } from 'react';
import Peer from 'simple-peer';
import toast from 'react-hot-toast';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Add TURN servers for production
  // { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' }
];

export const usePeerConnection = (stream, socket) => {
  const peersRef = useRef(new Map());
  const pendingSignals = useRef(new Map());
  
  // Cleanup function to properly dispose of peer connections
  const cleanupPeer = useCallback((peerId) => {
    const peerData = peersRef.current.get(peerId);
    if (peerData) {
      try {
        if (peerData.peer && !peerData.peer.destroyed) {
          peerData.peer.removeAllListeners();
          peerData.peer.destroy();
        }
      } catch (error) {
        console.warn('Error cleaning up peer:', error);
      }
      peersRef.current.delete(peerId);
    }
  }, []);
  
  // Create peer connection with optimized configuration
  const createPeer = useCallback((userToSignal, callerID, mediaStream) => {
    try {
      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: mediaStream,
        config: {
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 10,
          sdpSemantics: 'unified-plan'
        }
      });
      
      // Add comprehensive error handling
      peer.on('error', (error) => {
        console.error('Peer connection error:', error);
        toast.error(`Connection error: ${error.message}`);
        cleanupPeer(userToSignal);
      });
      
      peer.on('connect', () => {
        console.log('Peer connected:', userToSignal);
      });
      
      peer.on('close', () => {
        console.log('Peer connection closed:', userToSignal);
        cleanupPeer(userToSignal);
      });
      
      // Handle signaling
      peer.on('signal', signal => {
        if (socket && socket.connected) {
          socket.emit('sending-signal', { userToSignal, callerID, signal });
        } else {
          // Store signal if socket not ready
          pendingSignals.current.set(userToSignal, { userToSignal, callerID, signal });
        }
      });
      
      return peer;
    } catch (error) {
      console.error('Failed to create peer:', error);
      toast.error('Failed to establish connection');
      return null;
    }
  }, [socket, cleanupPeer]);
  
  // Add peer with proper error handling
  const addPeer = useCallback((incomingSignal, callerID, mediaStream, userData = {}) => {
    try {
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: mediaStream,
        config: {
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 10,
          sdpSemantics: 'unified-plan'
        }
      });
      
      // Add error handling
      peer.on('error', (error) => {
        console.error('Peer connection error:', error);
        toast.error(`Connection error with ${userData.name || callerID}`);
        cleanupPeer(callerID);
      });
      
      peer.on('connect', () => {
        console.log('Peer connected:', callerID);
      });
      
      peer.on('close', () => {
        console.log('Peer connection closed:', callerID);
        cleanupPeer(callerID);
      });
      
      // Handle return signal
      peer.on('signal', signal => {
        if (socket && socket.connected) {
          socket.emit('returning-signal', { signal, callerID });
        }
      });
      
      // Accept the incoming signal
      if (incomingSignal) {
        peer.signal(incomingSignal);
      }
      
      return peer;
    } catch (error) {
      console.error('Failed to add peer:', error);
      toast.error('Failed to establish connection');
      return null;
    }
  }, [socket, cleanupPeer]);
  
  // Replace track for screen sharing with error handling
  const replaceTrack = useCallback((oldTrack, newTrack) => {
    let successCount = 0;
    let totalPeers = peersRef.current.size;
    
    peersRef.current.forEach(({ peer }) => {
      try {
        if (peer && !peer.destroyed && peer.replaceTrack) {
          peer.replaceTrack(oldTrack, newTrack, stream);
          successCount++;
        }
      } catch (error) {
        console.warn('Failed to replace track for peer:', error);
      }
    });
    
    if (totalPeers > 0 && successCount < totalPeers) {
      toast.warning(`Track replacement partially failed (${successCount}/${totalPeers})`);
    }
  }, [stream]);
  
  // Get current peers
  const getPeers = useCallback(() => {
    return Array.from(peersRef.current.values());
  }, []);
  
  // Get peer count
  const getPeerCount = useCallback(() => {
    return peersRef.current.size;
  }, []);
  
  // Remove peer
  const removePeer = useCallback((peerId) => {
    cleanupPeer(peerId);
  }, [cleanupPeer]);
  
  // Cleanup all peers
  const cleanupAllPeers = useCallback(() => {
    peersRef.current.forEach((_, peerId) => {
      cleanupPeer(peerId);
    });
    peersRef.current.clear();
    pendingSignals.current.clear();
  }, [cleanupPeer]);
  
  // Send pending signals when socket connects
  useEffect(() => {
    if (socket && socket.connected && pendingSignals.current.size > 0) {
      pendingSignals.current.forEach((signalData) => {
        socket.emit('sending-signal', signalData);
      });
      pendingSignals.current.clear();
    }
  }, [socket]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAllPeers();
    };
  }, [cleanupAllPeers]);
  
  return {
    peersRef,
    createPeer,
    addPeer,
    replaceTrack,
    getPeers,
    getPeerCount,
    removePeer,
    cleanupAllPeers
  };
};

export default usePeerConnection;