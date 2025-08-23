import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import SignalingService from '../services/SignalingService';
import PeerConnectionService from '../services/PeerConnectionService';
import MediaStreamService from '../services/MediaStreamService';
import ConnectionStateService from '../services/ConnectionStateService';
import ChatService from '../services/ChatService';

export const useRoomServices = (roomId, userInfo) => {
  const navigate = useNavigate();
  
  // Services
  const signalingServiceRef = useRef(null);
  const peerConnectionServiceRef = useRef(null);
  const mediaStreamServiceRef = useRef(null);
  const connectionStateServiceRef = useRef(null);
  const chatServiceRef = useRef(null);

  // State
  const [stream, setStream] = useState(null);
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [connectionQuality, setConnectionQuality] = useState('unknown');

  // Initialize services
  useEffect(() => {
    // Create services
    signalingServiceRef.current = new SignalingService();
    mediaStreamServiceRef.current = new MediaStreamService();
    connectionStateServiceRef.current = new ConnectionStateService();
    
    peerConnectionServiceRef.current = new PeerConnectionService(signalingServiceRef.current);
    chatServiceRef.current = new ChatService(signalingServiceRef.current);

    // Setup callbacks
    peerConnectionServiceRef.current.setCallbacks({
      onPeersUpdated: setPeers,
      onStreamReceived: (callerID, peerStream) => {
        // Handle stream received from peer
        console.log('Stream received from peer:', callerID);
      }
    });

    chatServiceRef.current.setCallbacks({
      onMessagesUpdated: setMessages,
      onUnreadCountChanged: setUnreadCount
    });

    connectionStateServiceRef.current.subscribe((state) => {
      setConnectionStatus(state.status);
      setConnectionQuality(state.quality);
    });

    return () => {
      // Cleanup services
      if (signalingServiceRef.current) {
        signalingServiceRef.current.disconnect();
      }
      if (mediaStreamServiceRef.current) {
        mediaStreamServiceRef.current.stopAllStreams();
      }
      if (peerConnectionServiceRef.current) {
        peerConnectionServiceRef.current.destroyAllPeers();
      }
      if (connectionStateServiceRef.current) {
        connectionStateServiceRef.current.destroy();
      }
      if (chatServiceRef.current) {
        chatServiceRef.current.destroy();
      }
    };
  }, []);

  // Initialize room connection
  useEffect(() => {
    if (!roomId || !userInfo || !signalingServiceRef.current) return;

    const initializeRoom = async () => {
      try {
        connectionStateServiceRef.current.setStatus('connecting');

        // Get user media
        const mediaStream = await mediaStreamServiceRef.current.getUserMedia();
        setStream(mediaStream);

        // Update mic/cam state based on initial stream
        setMicOn(mediaStreamServiceRef.current.getAudioEnabled());
        setCamOn(mediaStreamServiceRef.current.getVideoEnabled());

        // Connect signaling
        signalingServiceRef.current.connect();
        
        // Setup signaling event listeners
        setupSignalingListeners();

        // Join room
        signalingServiceRef.current.joinRoom(roomId, userInfo);
        
        connectionStateServiceRef.current.setStatus('connected');
        
      } catch (error) {
        console.error('Error initializing room:', error);
        connectionStateServiceRef.current.setStatus('error', error.message);
      }
    };

    initializeRoom();
  }, [roomId, userInfo]);

  const setupSignalingListeners = useCallback(() => {
    const signalingService = signalingServiceRef.current;
    const peerService = peerConnectionServiceRef.current;
    const mediaService = mediaStreamServiceRef.current;

    if (!signalingService || !peerService || !mediaService) return;

    signalingService.on('all-users', users => {
      console.log('Received all-users:', users);
      
      users.forEach(user => {
        if (!peerService.hasPeer(user.id)) {
          try {
            const peer = peerService.createPeer(user.id, signalingService.socketId, mediaService.getCurrentStream());
            peerService.addPeerData(user.id, {
              peer,
              name: user.name,
              role: user.role,
              signaled: false
            });
          } catch (err) {
            console.error('Error creating peer:', err);
            toast.error(`Failed to connect to ${user.name}: ${err.message}`);
          }
        }
      });
      
      toast.success(`Connected to ${users.length} participant(s)`);
    });

    signalingService.on('user-joined', payload => {
      console.log('User joined:', payload);
      if (!peerService.hasPeer(payload.callerID)) {
        try {
          const peer = peerService.addPeer(payload.signal, payload.callerID, mediaService.getCurrentStream());
          peerService.addPeerData(payload.callerID, {
            peer,
            name: payload.name,
            role: payload.role,
            signaled: false
          });
          toast.success(`${payload.name} joined the room`);
        } catch (err) {
          console.error('Error adding peer:', err);
          toast.error(`Failed to connect to ${payload.name}: ${err.message}`);
        }
      }
    });

    signalingService.on('receiving-returned-signal', payload => {
      console.log('Receiving returned signal:', payload);
      peerService.updatePeerSignal(payload.id, payload.signal);
    });

    signalingService.on('user-left', (userId) => {
      console.log('User left:', userId);
      const peerData = peerService.peers.get(userId);
      if (peerData) {
        toast.info(`${peerData.name} left the room`);
        peerService.removePeer(userId);
      }
    });
  }, []);

  // Media controls
  const toggleMic = useCallback(() => {
    if (mediaStreamServiceRef.current) {
      const enabled = mediaStreamServiceRef.current.toggleAudio();
      setMicOn(enabled);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (mediaStreamServiceRef.current) {
      const enabled = mediaStreamServiceRef.current.toggleVideo();
      setCamOn(enabled);
    }
  }, []);

  const handleShareScreen = useCallback(async () => {
    try {
      const screenStream = await mediaStreamServiceRef.current.getDisplayMedia();
      
      // Replace video track in all peer connections
      const currentStream = mediaStreamServiceRef.current.getCurrentStream();
      if (currentStream) {
        const videoTrack = currentStream.getVideoTracks()[0];
        const screenTrack = screenStream.getVideoTracks()[0];
        
        peerConnectionServiceRef.current.replaceTrack(videoTrack, screenTrack, screenStream);
      }

    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  }, []);

  // Chat functions
  const handleSendMessage = useCallback((text) => {
    if (chatServiceRef.current) {
      chatServiceRef.current.sendMessage(text, userInfo);
    }
  }, [userInfo]);

  const toggleChat = useCallback((isOpen) => {
    if (chatServiceRef.current) {
      chatServiceRef.current.setIsOpen(isOpen);
    }
  }, []);

  // Room management
  const handleLeaveRoom = useCallback(() => {
    // Stop all streams
    if (mediaStreamServiceRef.current) {
      mediaStreamServiceRef.current.stopAllStreams();
    }
    
    // Destroy all peer connections
    if (peerConnectionServiceRef.current) {
      peerConnectionServiceRef.current.destroyAllPeers();
    }
    
    // Leave signaling
    if (signalingServiceRef.current) {
      signalingServiceRef.current.leaveRoom(roomId, signalingServiceRef.current.socketId, userInfo.name);
    }
    
    // Reset connection state
    if (connectionStateServiceRef.current) {
      connectionStateServiceRef.current.reset();
    }
    
    toast.success('Meeting ended successfully');
    navigate('/');
  }, [roomId, userInfo, navigate]);

  const handleReconnect = useCallback(() => {
    if (connectionStateServiceRef.current?.shouldAttemptReconnection()) {
      toast.loading('Reconnecting...', { duration: 2000 });
      
      if (signalingServiceRef.current?.socket?.disconnected) {
        signalingServiceRef.current.connect();
      }
      
      // Refresh media stream if needed
      if (!stream) {
        mediaStreamServiceRef.current.getUserMedia()
          .then((currentStream) => {
            setStream(currentStream);
            toast.success('Reconnected successfully!');
          })
          .catch((error) => {
            console.error('Error reconnecting media:', error);
            toast.error('Failed to reconnect media');
          });
      }
    }
  }, [stream]);

  // Start connection monitoring
  useEffect(() => {
    if (peerConnectionServiceRef.current && connectionStateServiceRef.current) {
      const monitor = peerConnectionServiceRef.current.startConnectionMonitoring();
      
      // Update connection quality based on peer connections
      const qualityMonitor = setInterval(() => {
        const peers = peerConnectionServiceRef.current.getPeersArray();
        connectionStateServiceRef.current.updateQualityMetrics(peers);
      }, 5000);

      return () => {
        clearInterval(monitor);
        clearInterval(qualityMonitor);
      };
    }
  }, []);

  return {
    // State
    stream,
    peers,
    messages,
    unreadCount,
    micOn,
    camOn,
    connectionStatus,
    connectionQuality,
    
    // Actions
    toggleMic,
    toggleCamera,
    handleShareScreen,
    handleSendMessage,
    toggleChat,
    handleLeaveRoom,
    handleReconnect,
    
    // Services (for advanced usage)
    services: {
      signaling: signalingServiceRef.current,
      peerConnection: peerConnectionServiceRef.current,
      mediaStream: mediaStreamServiceRef.current,
      connectionState: connectionStateServiceRef.current,
      chat: chatServiceRef.current
    }
  };
};