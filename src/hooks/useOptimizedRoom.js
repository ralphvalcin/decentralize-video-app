import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { debounce } from '../utils/debounce';

export const useOptimizedRoom = () => {
  const [state, setState] = useState({
    micOn: true,
    camOn: true,
    connectionStatus: 'disconnected',
    showParticipants: false,
    useAdvancedLayout: false,
    showLeaveConfirm: false,
    showChat: false,
    unreadCount: 0,
    handRaised: false,
    recording: false
  });
  
  const [messages, setMessages] = useState([]);
  const [peers, setPeers] = useState([]);
  const [hands, setHands] = useState({});
  const [stream, setStream] = useState(null);
  
  // Refs for cleanup tracking
  const cleanupRefs = useRef(new Set());
  
  // Memoized state updates to prevent unnecessary re-renders
  const updateState = useCallback((updates) => {
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      // Only update if there are actual changes
      const hasChanges = Object.keys(updates).some(key => prevState[key] !== newState[key]);
      return hasChanges ? newState : prevState;
    });
  }, []);
  
  // Debounced state updates for rapid changes
  const debouncedUpdateState = useMemo(
    () => debounce(updateState, 100),
    [updateState]
  );
  
  // Optimized message handling
  const addMessage = useCallback((message) => {
    setMessages(prevMessages => {
      // Limit message history to prevent memory issues
      const newMessages = [...prevMessages, message];
      return newMessages.length > 100 ? newMessages.slice(-100) : newMessages;
    });
    
    // Update unread count if chat is closed
    if (!state.showChat) {
      debouncedUpdateState({ unreadCount: state.unreadCount + 1 });
    }
  }, [state.showChat, state.unreadCount, debouncedUpdateState]);
  
  // Memoized peer updates
  const updatePeers = useCallback((peerUpdates) => {
    setPeers(prevPeers => {
      // Shallow comparison to prevent unnecessary re-renders
      const newPeers = Array.isArray(peerUpdates) ? peerUpdates : [...prevPeers];
      
      if (Array.isArray(peerUpdates)) {
        // Full replacement
        return newPeers;
      } else {
        // Incremental update
        return prevPeers.map(peer => 
          peer.peerID === peerUpdates.peerID ? { ...peer, ...peerUpdates } : peer
        );
      }
    });
  }, []);
  
  // Optimized hand tracking
  const updateHands = useCallback((userId, handRaised) => {
    setHands(prevHands => {
      if (prevHands[userId] === handRaised) {
        return prevHands; // No change, return same object
      }
      return { ...prevHands, [userId]: handRaised };
    });
  }, []);
  
  // Media stream optimization
  const updateStream = useCallback((newStream) => {
    // Cleanup old stream
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        cleanupRefs.current.add(track);
      });
    }
    setStream(newStream);
  }, [stream]);
  
  // Toggle functions with optimization
  const toggleMic = useCallback(() => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        updateState({ micOn: audioTrack.enabled });
        return audioTrack.enabled;
      }
    }
    return state.micOn;
  }, [stream, state.micOn, updateState]);
  
  const toggleCamera = useCallback(() => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        updateState({ camOn: videoTrack.enabled });
        return videoTrack.enabled;
      }
    }
    return state.camOn;
  }, [stream, state.camOn, updateState]);
  
  const toggleChat = useCallback(() => {
    const newShowChat = !state.showChat;
    updateState({ 
      showChat: newShowChat,
      unreadCount: newShowChat ? 0 : state.unreadCount // Clear unread when opening
    });
  }, [state.showChat, state.unreadCount, updateState]);
  
  const toggleHandRaise = useCallback(() => {
    const newHandRaised = !state.handRaised;
    updateState({ handRaised: newHandRaised });
    return newHandRaised;
  }, [state.handRaised, updateState]);
  
  // Memoized derived state
  const participantCount = useMemo(() => peers.length + 1, [peers.length]);
  
  const connectionQuality = useMemo(() => {
    if (state.connectionStatus === 'connected' && peers.length > 0) {
      return 'good';
    } else if (state.connectionStatus === 'connected') {
      return 'fair';
    }
    return 'poor';
  }, [state.connectionStatus, peers.length]);
  
  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop all tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    // Cleanup any tracked resources
    cleanupRefs.current.forEach(resource => {
      try {
        if (typeof resource.stop === 'function') {
          resource.stop();
        }
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    });
    cleanupRefs.current.clear();
  }, [stream]);
  
  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  return {
    // State
    ...state,
    messages,
    peers,
    hands,
    stream,
    
    // Derived state
    participantCount,
    connectionQuality,
    
    // Actions
    updateState,
    addMessage,
    updatePeers,
    updateHands,
    updateStream,
    toggleMic,
    toggleCamera,
    toggleChat,
    toggleHandRaise,
    cleanup
  };
};

export default useOptimizedRoom;