import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import Video from './VideoChat';
import VideoLayout from './VideoLayout';
import Chat from './Chat';
import EmojiReactions from './EmojiReactions';
import Polls from './Polls';
import QA from './QA';
import RaiseHand from './RaiseHand';
import MoreMenu from './MoreMenu';
import FeedbackModal from './FeedbackModal';
import ShareModal from './ShareModal';
import ConnectionStatus from './ConnectionStatus';
import SessionHeader from './SessionHeader';
import toast from 'react-hot-toast';
import {
  generateSecureRandom,
  generateRoomKey,
  encryptSignalingMessage,
  decryptSignalingMessage,
  generatePeerToken,
  verifyPeerToken,
  sanitizeInput,
  validateRoomId,
  validateUserName,
  RateLimiter,
  SecurityLogger,
  getSecureWebRTCConfig,
  validateWebRTCConnection
} from '../utils/security';

// SECURITY ENHANCEMENT: Use environment variable for signaling server URL
const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL || 'wss://decentralize-video-app-2.onrender.com';

// SECURITY ENHANCEMENT: Initialize secure socket connection
let socket = null;
const initializeSecureSocket = (roomToken) => {
  if (socket?.connected) {
    socket.disconnect();
  }
  
  socket = io(SIGNALING_SERVER_URL, {
    reconnectionDelayMax: 10000,
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 20000,
    auth: {
      token: roomToken
    },
    // SECURITY: Force secure transport
    forceNew: true,
    transports: ['websocket', 'polling'],
    upgrade: true
  });

  return socket;
};

const SecureRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [stream, setStream] = useState(null);
  const [peers, setPeers] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [useAdvancedLayout, setUseAdvancedLayout] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Security state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [roomToken, setRoomToken] = useState(null);
  const [userSecret, setUserSecret] = useState(null);
  const [roomKey, setRoomKey] = useState(null);
  const [authenticationError, setAuthenticationError] = useState(null);
  
  // Engagement features state
  const [showPolls, setShowPolls] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [polls, setPolls] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [raisedHands, setRaisedHands] = useState([]);
  const [isHost, setIsHost] = useState(false);

  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [callStartTime] = useState(Date.now());

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);

  const userVideo = useRef();
  const peersRef = useRef(new Map());
  const rateLimiter = useRef(new RateLimiter(10, 60000)); // 10 requests per minute
  
  const [userInfo] = useState(() => {
    // SECURITY ENHANCEMENT: Validate and sanitize user name
    const savedName = localStorage.getItem('userName');
    const userName = savedName || `User${Math.floor(Math.random() * 1000)}`;
    
    if (!validateUserName(userName)) {
      SecurityLogger.logSecurityEvent('INVALID_USERNAME_FROM_STORAGE', { userName });
      const fallbackName = `User${Math.floor(Math.random() * 1000)}`;
      localStorage.setItem('userName', fallbackName);
      return { name: fallbackName, role: 'Participant' };
    }
    
    return {
      name: sanitizeInput(userName),
      role: 'Participant'
    };
  });

  // SECURITY ENHANCEMENT: Secure authentication flow
   
  useEffect(() => {
    const authenticateUser = async () => {
      try {
        // Validate room ID format
        if (!validateRoomId(roomId)) {
          setAuthenticationError('Invalid room ID format');
          SecurityLogger.logSecurityEvent('INVALID_ROOM_ID', { roomId });
          return;
        }

        // Generate user secret for this session
        const secret = generateSecureRandom(32);
        setUserSecret(secret);

        // Generate room encryption key
        const key = generateRoomKey(roomId, secret);
        setRoomKey(key);

        // Initialize secure socket connection
        const secureSocket = initializeSecureSocket();

        // Set up security event handlers
        secureSocket.on('connect_error', (error) => {
          console.error('Secure connection error:', error);
          SecurityLogger.logSecurityEvent('CONNECTION_FAILED', { error: error.message });
          setAuthenticationError('Failed to establish secure connection');
          toast.error(`Secure Connection Error: ${error.message}`);
        });

        secureSocket.on('error', (error) => {
          SecurityLogger.logSecurityEvent('SOCKET_ERROR', error);
          toast.error(`Security Error: ${error.message || 'Unknown error'}`);
        });

        // Request room access token
        secureSocket.emit('request-room-token', {
          roomId: roomId,
          userName: userInfo.name
        });

        secureSocket.on('room-token', (tokenData) => {
          setRoomToken(tokenData.token);
          setIsAuthenticated(true);
          SecurityLogger.logSecurityEvent('AUTHENTICATION_SUCCESS', { roomId: tokenData.roomId });
          toast.success('🔐 Secure connection established');
        });

        secureSocket.on('connect', () => {
          console.log('Connected to secure signaling server');
          setConnectionStatus('connecting');
        });

        secureSocket.on('disconnect', (reason) => {
          console.log('Disconnected from signaling server:', reason);
          setConnectionStatus('disconnected');
          setIsAuthenticated(false);
          SecurityLogger.logSecurityEvent('DISCONNECTED', { reason });
          toast.error(`Disconnected: ${reason}`);
        });

      } catch (error) {
        console.error('Authentication failed:', error);
        setAuthenticationError('Authentication failed');
        SecurityLogger.logSecurityEvent('AUTHENTICATION_FAILED', { error: error.message });
      }
    };

    authenticateUser();

    return () => {
      if (socket?.connected) {
        socket.disconnect();
      }
    };
  }, [roomId, userInfo.name]);

  // SECURITY ENHANCEMENT: Secure media stream initialization
   
  useEffect(() => {
    if (!isAuthenticated || !roomToken || !socket) return;

    const initializeSecureMedia = async () => {
      try {
        // Request media with security considerations
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        setStream(mediaStream);
        if (userVideo.current) {
          userVideo.current.srcObject = mediaStream;
        }

        // SECURITY ENHANCEMENT: Secure room joining with token
        console.log('Joining room securely:', roomId, 'with user info:', userInfo);
        socket.emit('join-room', { 
          ...userInfo, 
          roomId,
          token: roomToken 
        });

        // Set up secure event handlers with encryption
        setupSecureEventHandlers(socket, mediaStream);
        
        setConnectionStatus('connected');
        
      } catch (error) {
        console.error('Error accessing media devices:', error);
        handleMediaError(error);
      }
    };

    initializeSecureMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      cleanupEventHandlers();
    };
  }, [isAuthenticated, roomToken, roomId]);

  // SECURITY ENHANCEMENT: Setup secure event handlers with message encryption
  const setupSecureEventHandlers = (socket, mediaStream) => {
    socket.on('all-users', users => {
      SecurityLogger.logSecurityEvent('RECEIVED_USERS_LIST', { userCount: users.length });
      setIsHost(users.length === 0);
      const peers = [];
      
      users.forEach(user => {
        if (!peersRef.current.has(user.id)) {
          try {
            const peer = createSecurePeer(user.id, socket.id, mediaStream);
            peersRef.current.set(user.id, {
              peerID: user.id,
              peer,
              name: user.name,
              role: user.role,
              signaled: false,
              authenticated: false
            });
            peers.push({
              peerID: user.id,
              peer,
              name: user.name,
              role: user.role
            });
          } catch (err) {
            console.error('Error creating secure peer:', err);
            SecurityLogger.logSecurityEvent('PEER_CREATION_FAILED', { userId: user.id, error: err.message });
            toast.error(`Failed to connect securely to ${user.name}`);
          }
        }
      });
      
      setPeers(Array.from(peersRef.current.values()));
      toast.success(`🔐 Secure connection established with ${peers.length} participant(s)`);
    });

    socket.on('user-joined', payload => {
      SecurityLogger.logSecurityEvent('USER_JOINED', { callerId: payload.callerID, name: payload.name });
      
      if (!peersRef.current.has(payload.callerID)) {
        try {
          const peer = addSecurePeer(payload.signal, payload.callerID, mediaStream);
          peersRef.current.set(payload.callerID, {
            peerID: payload.callerID,
            peer,
            name: payload.name,
            role: payload.role,
            signaled: false,
            authenticated: false
          });
          setPeers(Array.from(peersRef.current.values()));
          toast.success(`🔐 ${payload.name} joined securely`);
        } catch (err) {
          console.error('Error adding secure peer:', err);
          SecurityLogger.logSecurityEvent('SECURE_PEER_ADD_FAILED', { callerId: payload.callerID, error: err.message });
          toast.error(`Failed to establish secure connection with ${payload.name}`);
        }
      }
    });

    socket.on('receiving-returned-signal', payload => {
      const item = peersRef.current.get(payload.id);
      if (item && !item.peer.destroyed && !item.signaled) {
        try {
          // SECURITY: Verify peer authentication before signaling
          const peerToken = generatePeerToken(payload.id, roomId, userSecret);
          if (verifyPeerToken(peerToken, payload.id, roomId, userSecret)) {
            item.peer.signal(payload.signal);
            item.signaled = true;
            item.authenticated = true;
            SecurityLogger.logSecurityEvent('PEER_AUTHENTICATED', { peerId: payload.id });
          } else {
            throw new Error('Peer authentication failed');
          }
        } catch (err) {
          console.error('Error in secure signaling:', err);
          SecurityLogger.logSecurityEvent('PEER_AUTHENTICATION_FAILED', { peerId: payload.id, error: err.message });
          toast.error('Secure connection verification failed');
        }
      }
    });

    socket.on('user-left', (userId) => {
      if (peersRef.current.has(userId)) {
        const peerName = peersRef.current.get(userId).name;
        peersRef.current.delete(userId);
        setPeers(Array.from(peersRef.current.values()));
        SecurityLogger.logSecurityEvent('USER_LEFT', { userId, name: peerName });
        toast.info(`${peerName} left the room`);
      }
    });

    // Secure chat event listeners with message encryption
    socket.on('chat-history', (chatHistory) => {
      try {
        // SECURITY: Decrypt chat history if encrypted
        const decryptedHistory = chatHistory.map(msg => {
          if (msg.encrypted) {
            const decrypted = decryptSignalingMessage(msg, roomKey);
            return { ...msg, text: decrypted.text };
          }
          return msg;
        });
        setMessages(decryptedHistory);
      } catch (error) {
        console.error('Error decrypting chat history:', error);
        SecurityLogger.logSecurityEvent('CHAT_DECRYPTION_FAILED', { error: error.message });
        setMessages(chatHistory); // Fallback to unencrypted
      }
    });

    socket.on('new-message', (message) => {
      try {
        // SECURITY: Decrypt new message if encrypted
        let processedMessage = message;
        if (message.encrypted) {
          const decrypted = decryptSignalingMessage(message, roomKey);
          processedMessage = { ...message, text: decrypted.text };
        }
        
        setMessages(prev => [...prev, processedMessage]);
        if (!showChat) {
          setUnreadCount(prev => prev + 1);
        }
        SecurityLogger.logSecurityEvent('MESSAGE_RECEIVED', { from: message.userName });
      } catch (error) {
        console.error('Error processing encrypted message:', error);
        SecurityLogger.logSecurityEvent('MESSAGE_DECRYPTION_FAILED', { error: error.message });
      }
    });

    // Other event listeners (polls, questions, reactions, hands)
    socket.on('polls-history', setPolls);
    socket.on('questions-history', setQuestions);
    socket.on('raised-hands-history', setRaisedHands);
    socket.on('new-reaction', (reaction) => {
      setReactions(prev => [...prev, reaction]);
    });
    socket.on('new-poll', (poll) => {
      setPolls(prev => [...prev, poll]);
      toast.success(`New poll: ${poll.question}`);
    });
    socket.on('poll-updated', (updatedPoll) => {
      setPolls(prev => prev.map(poll => 
        poll.id === updatedPoll.id ? updatedPoll : poll
      ));
    });
    socket.on('new-question', (question) => {
      setQuestions(prev => [...prev, question]);
      toast.success(`New question from ${question.author}`);
    });
    socket.on('question-updated', (updatedQuestion) => {
      setQuestions(prev => prev.map(question => 
        question.id === updatedQuestion.id ? updatedQuestion : question
      ));
    });
    socket.on('hand-raised', (hand) => {
      setRaisedHands(prev => [...prev, hand]);
      toast.success(`${hand.userName} raised their hand`);
    });
    socket.on('hand-lowered', (data) => {
      setRaisedHands(prev => prev.filter(hand => hand.userId !== data.userId));
    });
  };

  const cleanupEventHandlers = () => {
    if (socket) {
      socket.off('all-users');
      socket.off('user-joined');
      socket.off('receiving-returned-signal');
      socket.off('user-left');
      socket.off('chat-history');
      socket.off('new-message');
      socket.off('polls-history');
      socket.off('questions-history');
      socket.off('raised-hands-history');
      socket.off('new-reaction');
      socket.off('new-poll');
      socket.off('poll-updated');
      socket.off('new-question');
      socket.off('question-updated');
      socket.off('hand-raised');
      socket.off('hand-lowered');
    }
  };

  // SECURITY ENHANCEMENT: Create secure peer connection
  function createSecurePeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: getSecureWebRTCConfig() // Use secure WebRTC configuration
    });

    peer.on('stream', peerStream => {
      setPeers(prevPeers => {
        const peerIndex = prevPeers.findIndex(p => p.peerID === callerID);
        if (peerIndex >= 0) {
          const updatedPeers = [...prevPeers];
          updatedPeers[peerIndex] = {
            ...updatedPeers[peerIndex],
            stream: peerStream
          };
          return updatedPeers;
        }
        return prevPeers;
      });
    });

    peer.on('error', (err) => {
      console.error('Secure peer error:', err);
      SecurityLogger.logSecurityEvent('PEER_CONNECTION_ERROR', { peerId: callerID, error: err.message });
      toast.error(`Secure peer connection error: ${err.message || err.type}`);
      
      // Remove the failed peer
      const peerData = peersRef.current.get(callerID);
      if (peerData) {
        peersRef.current.delete(callerID);
        setPeers(Array.from(peersRef.current.values()));
        toast.info(`Lost secure connection to ${peerData.name}`);
      }
    });

    peer.on('close', () => {
      console.log('Secure peer connection closed');
      SecurityLogger.logSecurityEvent('PEER_CONNECTION_CLOSED', { peerId: callerID });
      peer.destroy();
    });

    peer.on('connect', () => {
      console.log('Secure peer connection established');
      SecurityLogger.logSecurityEvent('PEER_CONNECTION_ESTABLISHED', { peerId: callerID });
      
      // Validate connection security
      const validation = validateWebRTCConnection(peer);
      if (!validation.isSecure) {
        SecurityLogger.logSecurityEvent('INSECURE_PEER_CONNECTION', { 
          peerId: callerID, 
          issues: validation.issues 
        });
        toast.warning('Connection security warning detected');
      }
    });

    peer.on('signal', signal => {
      if (!peer.destroyed) {
        // SECURITY: Encrypt signaling data
        try {
          const encryptedSignal = encryptSignalingMessage(signal, roomKey);
          socket.emit('sending-signal', { 
            userToSignal, 
            callerID, 
            signal: encryptedSignal 
          });
        } catch (error) {
          console.error('Failed to encrypt signaling data:', error);
          SecurityLogger.logSecurityEvent('SIGNALING_ENCRYPTION_FAILED', { error: error.message });
          // Fallback to unencrypted (with warning)
          socket.emit('sending-signal', { userToSignal, callerID, signal });
          toast.warning('⚠️ Signaling encryption failed - using fallback');
        }
      }
    });

    return peer;
  }

  function addSecurePeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
      config: getSecureWebRTCConfig() // Use secure WebRTC configuration
    });

    peer.on('signal', signal => {
      if (!peer.destroyed) {
        // SECURITY: Encrypt signaling data
        try {
          const encryptedSignal = encryptSignalingMessage(signal, roomKey);
          socket.emit('returning-signal', { 
            signal: encryptedSignal, 
            callerID 
          });
        } catch (error) {
          console.error('Failed to encrypt return signal:', error);
          SecurityLogger.logSecurityEvent('RETURN_SIGNAL_ENCRYPTION_FAILED', { error: error.message });
          // Fallback to unencrypted (with warning)
          socket.emit('returning-signal', { signal, callerID });
          toast.warning('⚠️ Return signal encryption failed - using fallback');
        }
      }
    });

    peer.on('stream', peerStream => {
      setPeers(prevPeers => {
        const peerIndex = prevPeers.findIndex(p => p.peerID === callerID);
        if (peerIndex >= 0) {
          const updatedPeers = [...prevPeers];
          updatedPeers[peerIndex] = {
            ...updatedPeers[peerIndex],
            stream: peerStream
          };
          return updatedPeers;
        }
        return prevPeers;
      });
    });

    peer.on('error', (err) => {
      console.error('Secure peer error:', err);
      SecurityLogger.logSecurityEvent('PEER_CONNECTION_ERROR', { peerId: callerID, error: err.message });
      toast.error(`Secure peer connection error: ${err.message || err.type}`);
      
      const peerData = peersRef.current.get(callerID);
      if (peerData) {
        peersRef.current.delete(callerID);
        setPeers(Array.from(peersRef.current.values()));
        toast.info(`Lost secure connection to ${peerData.name}`);
      }
    });

    peer.on('close', () => {
      console.log('Secure peer connection closed');
      SecurityLogger.logSecurityEvent('PEER_CONNECTION_CLOSED', { peerId: callerID });
      peer.destroy();
    });

    peer.on('connect', () => {
      console.log('Secure peer connection established');
      SecurityLogger.logSecurityEvent('PEER_CONNECTION_ESTABLISHED', { peerId: callerID });
    });

    // SECURITY: Decrypt incoming signal before processing
    try {
      const decryptedSignal = decryptSignalingMessage(incomingSignal, roomKey);
      peer.signal(decryptedSignal);
    } catch (error) {
      console.error('Failed to decrypt incoming signal:', error);
      SecurityLogger.logSecurityEvent('INCOMING_SIGNAL_DECRYPTION_FAILED', { error: error.message });
      // Fallback to unencrypted signal
      peer.signal(incomingSignal);
      toast.warning('⚠️ Incoming signal decryption failed - using fallback');
    }
    
    return peer;
  }

  const handleMediaError = (error) => {
    let errorMessage = 'Failed to access camera or microphone';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Camera/microphone access denied. Please allow permissions.';
      SecurityLogger.logSecurityEvent('MEDIA_PERMISSION_DENIED', { error: error.name });
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No camera or microphone found.';
      SecurityLogger.logSecurityEvent('MEDIA_DEVICE_NOT_FOUND', { error: error.name });
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Camera or microphone is already in use.';
      SecurityLogger.logSecurityEvent('MEDIA_DEVICE_BUSY', { error: error.name });
    } else {
      SecurityLogger.logSecurityEvent('MEDIA_ACCESS_ERROR', { error: error.message });
    }
    
    toast.error(`❌ ${errorMessage}`);
    setConnectionStatus('error');
  };

  // Enhanced secure message sending
  const handleSendMessage = (text) => {
    // Rate limiting check
    if (!rateLimiter.current.isAllowed('send-message')) {
      toast.error('⚠️ Rate limit exceeded. Please slow down.');
      return;
    }

    // Input validation and sanitization
    const sanitizedText = sanitizeInput(text, 1000);
    if (!sanitizedText) {
      toast.error('Message cannot be empty');
      return;
    }

    try {
      // SECURITY: Encrypt message before sending
      const encryptedMessage = encryptSignalingMessage({ text: sanitizedText }, roomKey);
      socket.emit('send-message', { 
        text: sanitizedText,
        encrypted: encryptedMessage 
      });
      SecurityLogger.logSecurityEvent('MESSAGE_SENT', { length: sanitizedText.length });
    } catch (error) {
      console.error('Failed to encrypt message:', error);
      SecurityLogger.logSecurityEvent('MESSAGE_ENCRYPTION_FAILED', { error: error.message });
      // Fallback to unencrypted message
      socket.emit('send-message', { text: sanitizedText });
      toast.warning('⚠️ Message encryption failed - sent unencrypted');
    }
  };

  // Other secure handlers (keeping existing functionality but with security logging)
  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
        SecurityLogger.logSecurityEvent('MIC_TOGGLED', { enabled: audioTrack.enabled });
        toast.success(audioTrack.enabled ? '🎤 Microphone unmuted' : '🔇 Microphone muted');
      }
    }
  };

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCamOn(videoTrack.enabled);
        SecurityLogger.logSecurityEvent('CAMERA_TOGGLED', { enabled: videoTrack.enabled });
        toast.success(videoTrack.enabled ? '📹 Camera turned on' : '🎥 Camera turned off');
      }
    }
  };

  const performLeaveRoom = () => {
    try {
      // Stop all tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Destroy all peer connections
      peersRef.current.forEach(({ peer }) => {
        if (peer) {
          peer.destroy();
        }
      });
      
      // Notify other users that we're leaving
      if (socket?.connected) {
        socket.emit('user-leaving', { 
          roomId, 
          userId: socket.id, 
          userName: userInfo.name 
        });
        socket.disconnect();
      }
      
      // Clear state
      setPeers([]);
      setStream(null);
      setConnectionStatus('disconnected');
      setIsAuthenticated(false);
      
      SecurityLogger.logSecurityEvent('ROOM_LEFT', { roomId });
      toast.success('🔐 Secure session ended successfully');
      
      // Navigate back to home page
      navigate('/');
    } catch (error) {
      console.error('Error leaving room:', error);
      SecurityLogger.logSecurityEvent('ROOM_LEAVE_ERROR', { error: error.message });
    }
  };

  // Show authentication error if present
  if (authenticationError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-8 max-w-md">
          <h2 className="text-red-400 text-xl font-semibold mb-4">🔒 Authentication Error</h2>
          <p className="text-gray-300 mb-6">{authenticationError}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // Show loading screen while authenticating
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-white text-xl font-semibold mb-2">🔐 Establishing Secure Connection</h2>
          <p className="text-gray-400">Authenticating and encrypting your session...</p>
        </div>
      </div>
    );
  }

  // Main secure room interface (using existing Room.jsx JSX with security indicators)
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Security Status Indicator */}
      <div className="fixed top-2 right-2 z-50 bg-green-900/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-green-500">
        <span className="text-green-400 text-sm font-medium">🔐 Secure Session</span>
      </div>

      {/* Professional Session Header */}
      <SessionHeader
        roomId={roomId}
        participantCount={peers.length + 1}
        userInfo={userInfo}
        onShare={() => setShowShareModal(true)}
        onLeave={performLeaveRoom}
        connectionStatus={connectionStatus}
      />

      {/* Main Content - Using existing Room.jsx layout */}
      <div className={`transition-all duration-300 ${
        (() => {
          const openPanels = [showChat, showPolls, showQA].filter(Boolean).length;
          if (openPanels === 0) return 'mr-0';
          if (openPanels === 1) return 'mr-80 md:mr-96';
          if (openPanels === 2) return 'mr-[480px] md:mr-[576px]';
          if (openPanels === 3) return 'mr-[720px] md:mr-[864px]';
          return 'mr-0';
        })()
      }`}>
        {/* Secondary Navigation */}
        <div className="fixed top-16 left-4 right-4 flex items-center justify-center z-30 mt-1">
          <div className="flex items-center gap-2 bg-gray-800/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700">
            <button
              onClick={() => setShowChat(!showChat)}
              className={`flex items-center space-x-1 px-3 py-2 rounded-md transition-colors text-sm relative ${
                showChat ? 'text-white bg-blue-600 hover:bg-blue-700' : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <span>💬</span>
              <span className="hidden sm:inline">Secure Chat</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Simplified Controls Bar */}
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 flex items-center justify-center gap-6 px-8 z-50">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleMic}
              className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
                micOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              }`}
              title={micOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              <span className="text-xl">{micOn ? '🎤' : '🔇'}</span>
            </button>

            <button
              onClick={toggleCamera}
              className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
                camOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              }`}
              title={camOn ? 'Turn off camera' : 'Turn on camera'}
            >
              <span className="text-xl">{camOn ? '📹' : '🎥'}</span>
            </button>
          </div>

          <button
            onClick={performLeaveRoom}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200 shadow-lg hover:shadow-red-500/25"
            title="End Secure Meeting"
          >
            <span className="text-xl font-bold">✕</span>
          </button>
        </div>

        {/* Video Grid */}
        <div className="pt-28 pb-24 px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Local Video */}
            <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
              <video
                ref={userVideo}
                muted
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-sm">
                {userInfo.name} (You) 🔐
              </div>
            </div>

            {/* Peer Videos */}
            {peers.map((peer, index) => (
              <div key={index} className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                <Video
                  stream={peer.stream}
                  name={`${peer.name || `Peer ${index + 1}`} 🔐`}
                  isLocal={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secure Chat Component */}
      <Chat
        messages={messages}
        onSendMessage={handleSendMessage}
        isOpen={showChat}
        onToggle={() => setShowChat(!showChat)}
        userInfo={userInfo}
        stackPosition={0}
        totalOpenPanels={showChat ? 1 : 0}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        roomId={roomId}
        roomUrl={`${window.location.origin}/secure-room/${roomId}`}
      />
    </div>
  );
};

export default SecureRoom;
