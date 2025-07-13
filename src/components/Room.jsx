import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import Video from './VideoChat'; // Changed from './Videochat'
import VideoLayout from './VideoLayout';
import Chat from './Chat';
import toast from 'react-hot-toast';

const PROJECT_ID = import.meta.env.VITE_INFURA_PROJECT_ID;
const API_KEY = import.meta.env.VITE_INFURA_API_SECRET;

const socket = io('http://localhost:5001', { // Fixed port to match signaling server
  reconnectionDelayMax: 10000,
  reconnection: true,
  reconnectionAttempts: 10
});

// Add error handling
socket.on('connect_error', (error) => {
  console.error('Connection Error:', error);
  toast.error(`Connection Error: ${error.message}`);
});

socket.on('connect', () => {
  console.log('Connected to signaling server');
  toast.success('Connected to signaling server');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from signaling server:', reason);
  toast.error(`Disconnected: ${reason}`);
});

socket.on('connect_timeout', () => {
  console.error('Connection timeout');
  toast.error('Connection timeout - please check your network');
});

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [stream, setStream] = useState(null);
  const [peers, setPeers] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [showParticipants, setShowParticipants] = useState(false);
  const [useAdvancedLayout, setUseAdvancedLayout] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const userVideo = useRef();
  const peersRef = useRef(new Map());
  const [userInfo] = useState(() => {
    // Get user name from localStorage or generate a random one
    const savedName = localStorage.getItem('userName');
    return {
      name: savedName || `User${Math.floor(Math.random() * 1000)}`,
      role: 'Participant'
    };
  });

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
        toast.success(
          audioTrack.enabled ? '🎤 Microphone unmuted' : '🔇 Microphone muted'
        );
      }
    }
  };

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCamOn(videoTrack.enabled);
        toast.success(
          videoTrack.enabled ? '📹 Camera turned on' : '🎥 Camera turned off'
        );
      }
    }
  };

  const handleShareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      userVideo.current.srcObject = screenStream;
      toast.success('🖥️ Screen sharing started');

      // Update all peer connections with the new stream
      peersRef.current.forEach(({ peer }) => {
        peer.replaceTrack(
          stream.getVideoTracks()[0],
          screenStream.getVideoTracks()[0],
          stream
        );
      });

      // Handle screen sharing stop
      screenStream.getVideoTracks()[0].onended = () => {
        userVideo.current.srcObject = stream;
        peersRef.current.forEach(({ peer }) => {
          peer.replaceTrack(
            screenStream.getVideoTracks()[0],
            stream.getVideoTracks()[0],
            stream
          );
        });
        toast.info('📤 Screen sharing ended');
      };
    } catch (err) {
      console.error('Error sharing screen:', err);
      toast.error('❌ Failed to share screen');
    }
  };

  const handleLeaveRoom = () => {
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
    socket.emit('user-leaving', { roomId, userId: socket.id, userName: userInfo.name });
    
    // Disconnect socket
    socket.disconnect();
    
    // Clear state
    setPeers([]);
    setStream(null);
    setConnectionStatus('disconnected');
    
    // Clear any stored layout preferences
    localStorage.removeItem('video-layout');
    localStorage.removeItem('layout-preset');
    
    toast.success('Meeting ended successfully');
    
    // Navigate back to home page
    navigate('/');
  };

  const confirmLeaveRoom = () => {
    setShowLeaveConfirm(true);
  };

  const cancelLeaveRoom = () => {
    setShowLeaveConfirm(false);
  };

  const handleSendMessage = (text) => {
    socket.emit('send-message', { text });
  };

  const toggleChat = () => {
    setShowChat(!showChat);
    if (!showChat) {
      setUnreadCount(0); // Clear unread count when opening chat
    }
  };

  // Update the initial media stream effect
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        setStream(mediaStream);
        if (userVideo.current) {
          userVideo.current.srcObject = mediaStream;
        }

        console.log('Joining room:', roomId, 'with user info:', userInfo);
        socket.emit('join-room', { ...userInfo, roomId });

        socket.on('all-users', users => {
          console.log('Received all-users:', users);
          const peers = [];
          users.forEach(user => {
            if (!peersRef.current.has(user.id)) {
              try {
                console.log('Creating peer for user:', user);
                const peer = createPeer(user.id, socket.id, mediaStream);
                peersRef.current.set(user.id, {
                  peerID: user.id,
                  peer,
                  name: user.name,
                  role: user.role,
                  signaled: false
                });
                peers.push({
                  peerID: user.id,
                  peer,
                  name: user.name,
                  role: user.role
                });
              } catch (err) {
                console.error('Error creating peer:', err);
                toast.error(`Failed to connect to ${user.name}: ${err.message}`);
              }
            }
          });
          setPeers(Array.from(peersRef.current.values()));
          setConnectionStatus('connected');
          toast.success(`Connected to ${peers.length} participant(s)`);
        });

        socket.on('user-joined', payload => {
          console.log('User joined:', payload);
          if (!peersRef.current.has(payload.callerID)) {
            try {
              const peer = addPeer(payload.signal, payload.callerID, mediaStream);
              peersRef.current.set(payload.callerID, {
                peerID: payload.callerID,
                peer,
                name: payload.name,
                role: payload.role,
                signaled: false
              });
              setPeers(Array.from(peersRef.current.values()));
              toast.success(`${payload.name} joined the room`);
            } catch (err) {
              console.error('Error adding peer:', err);
              toast.error(`Failed to connect to ${payload.name}: ${err.message}`);
            }
          }
        });

        socket.on('receiving-returned-signal', payload => {
          console.log('Receiving returned signal:', payload);
          const item = peersRef.current.get(payload.id);
          if (item && !item.peer.destroyed && !item.signaled) {
            try {
              item.peer.signal(payload.signal);
              item.signaled = true;
            } catch (err) {
              console.error('Error signaling peer:', err);
              toast.error('Connection signal error');
            }
          }
        });

        socket.on('user-left', (userId) => {
          console.log('User left:', userId);
          if (peersRef.current.has(userId)) {
            const peerName = peersRef.current.get(userId).name;
            peersRef.current.delete(userId);
            setPeers(Array.from(peersRef.current.values()));
            toast.info(`${peerName} left the room`);
          }
        });

        // Chat event listeners
        socket.on('chat-history', (chatHistory) => {
          setMessages(chatHistory);
        });

        socket.on('new-message', (message) => {
          setMessages(prev => [...prev, message]);
          // Increment unread count if chat is not open
          if (!showChat) {
            setUnreadCount(prev => prev + 1);
          }
        });
      })
      .catch((error) => {
        console.error('Error accessing media devices:', error);
        let errorMessage = 'Failed to access camera or microphone';
        
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera/microphone access denied. Please allow permissions.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera or microphone found.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera or microphone is already in use.';
        }
        
        toast.error(`❌ ${errorMessage}`);
        setConnectionStatus('error');
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      socket.off('all-users');
      socket.off('user-joined');
      socket.off('receiving-returned-signal');
      socket.off('user-left');
      socket.off('chat-history');
      socket.off('new-message');
    };
  }, [roomId]);

  useEffect(() => {
    if (stream) {
      const monitor = setInterval(() => {
        peersRef.current.forEach(({ peer }) => {
          const stats = peer.getStats();
          // Monitor connection quality
          if (stats && stats.bandwidth < 100000) { // Less than 100 Kbps
            toast.warning('Poor connection detected');
          }
        });
      }, 5000);

      return () => clearInterval(monitor);
    }
  }, [stream]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Escape' && !showLeaveConfirm) {
        confirmLeaveRoom();
      }
      // Ctrl/Cmd + Enter to toggle chat
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        toggleChat();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showLeaveConfirm, showChat]);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    // Add stream handling
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
      console.error('Peer error:', err);
      toast.error(`Peer connection error: ${err.message || err.type}`);
      
      // Remove the failed peer
      const peerIndex = peersRef.current.findIndex(p => p.peer === peer);
      if (peerIndex !== -1) {
        const peerName = peersRef.current[peerIndex].name;
        peersRef.current.splice(peerIndex, 1);
        setPeers(prev => prev.filter(p => p.peer !== peer));
        toast.info(`Lost connection to ${peerName}`);
      }
    });

    peer.on('close', () => {
      console.log('Peer connection closed');
      peer.destroy();
    });

    peer.on('connect', () => {
      console.log('Peer connection established');
    });

    peer.on('signal', signal => {
      if (!peer.destroyed) {
        socket.emit('sending-signal', { userToSignal, callerID, signal });
      }
    });

    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('signal', signal => {
      if (!peer.destroyed) {
        socket.emit('returning-signal', { signal, callerID });
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
      console.error('Peer error:', err);
      toast.error(`Peer connection error: ${err.message || err.type}`);
      
      // Remove the failed peer
      const peerIndex = peersRef.current.findIndex(p => p.peer === peer);
      if (peerIndex !== -1) {
        const peerName = peersRef.current[peerIndex].name;
        peersRef.current.splice(peerIndex, 1);
        setPeers(prev => prev.filter(p => p.peer !== peer));
        toast.info(`Lost connection to ${peerName}`);
      }
    });

    peer.on('close', () => {
      console.log('Peer connection closed');
      peer.destroy();
    });

    peer.on('connect', () => {
      console.log('Peer connection established');
    });

    // Only signal once
    let signaled = false;
    if (!signaled) {
      peer.signal(incomingSignal);
      signaled = true;
    }
    return peer;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <h1 className="text-xl font-semibold text-center text-white mb-4">
        Room: {roomId}
      </h1>

      {/* Top Navigation Bar */}
      <div className="fixed top-4 left-4 right-4 flex items-center justify-between z-40">
        {/* Left side - Room info and participants */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="bg-gray-800 text-white px-2 py-2 sm:px-3 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            <span className="hidden sm:inline">👥 Participants</span>
            <span className="sm:hidden">👥</span>
            <span className="ml-1">({peers.length + 1})</span>
          </button>
          
          <button
            onClick={toggleChat}
            className="bg-gray-800 text-white px-2 py-2 sm:px-3 rounded-lg hover:bg-gray-700 transition-colors text-sm relative"
          >
            <span className="hidden sm:inline">💬 Chat</span>
            <span className="sm:hidden">💬</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setUseAdvancedLayout(!useAdvancedLayout)}
            className="bg-gray-800 text-white px-2 py-2 sm:px-3 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            <span className="hidden sm:inline">
              {useAdvancedLayout ? '📱 Simple View' : '🎛️ Advanced Layout'}
            </span>
            <span className="sm:hidden">
              {useAdvancedLayout ? '📱' : '🎛️'}
            </span>
          </button>
        </div>

        {/* Right side - Connection status and leave button */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2 bg-gray-800 px-2 py-2 sm:px-3 rounded-lg">
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 
              connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
            }`}></span>
            <span className="text-xs sm:text-sm text-white hidden sm:inline">
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'error' ? 'Error' : 'Connecting...'}
            </span>
            {peers.length > 0 && (
              <span className="text-xs text-gray-400">
                ({peers.length})
              </span>
            )}
          </div>

          {/* Leave Meeting Button */}
          <button
            onClick={confirmLeaveRoom}
            className="bg-red-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
            title="End Meeting (Esc)"
          >
            <span className="hidden sm:inline">🚪 Leave Meeting</span>
            <span className="sm:hidden">🚪</span>
          </button>
        </div>
      </div>

      {/* Participant List Panel */}
      {showParticipants && (
        <div className="fixed top-20 left-4 bg-gray-800 rounded-lg p-4 w-64 max-h-96 overflow-y-auto z-40 shadow-lg border border-gray-700">
          <h3 className="text-white font-semibold mb-3">Participants</h3>
          <div className="space-y-2">
            {/* Local user */}
            <div className="flex items-center gap-2 p-2 bg-gray-700 rounded">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-white text-sm">{userInfo.name} (You)</span>
            </div>
            {/* Remote users */}
            {peers.map((peer, index) => (
              <div key={peer.peerID} className="flex items-center gap-2 p-2 bg-gray-700 rounded">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-white text-sm">{peer.name || `Peer ${index + 1}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-gray-800 flex items-center justify-center gap-4 px-4 z-50">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full ${
            micOn ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {micOn ? '🎤' : '🔇'}
        </button>
        <button
          onClick={toggleCamera}
          className={`p-3 rounded-full ${
            camOn ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {camOn ? '📹' : '🎥'}
        </button>
        <button
          onClick={handleShareScreen}
          className="p-3 rounded-full bg-gray-600 hover:bg-gray-700"
        >
          📺
        </button>
        <button
          onClick={confirmLeaveRoom}
          className="p-3 rounded-full bg-red-500 hover:bg-red-600"
          title="End Meeting"
        >
          ✕
        </button>
      </div>

      {/* Leave Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">
              End Meeting?
            </h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to end this meeting? You will be disconnected from all participants.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelLeaveRoom}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveRoom}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                End Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Grid */}
      <div className="mb-20">
        {useAdvancedLayout ? (
          <VideoLayout
            localStream={stream}
            peers={peers}
            userInfo={userInfo}
            onLayoutChange={(layout) => {
              console.log('Layout changed:', layout);
            }}
          />
        ) : (
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
                {userInfo.name} (You)
              </div>
            </div>

            {/* Peer Videos */}
            {peers.map((peer, index) => (
              <div key={index} className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                <Video
                  stream={peer.stream}
                  name={peer.name || `Peer ${index + 1}`}
                  isLocal={false}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Component */}
      <Chat
        messages={messages}
        onSendMessage={handleSendMessage}
        isOpen={showChat}
        onToggle={toggleChat}
        userInfo={userInfo}
      />
    </div>
  );
};

export default Room;