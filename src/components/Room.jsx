import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import Video from './VideoChat'; // Changed from './Videochat'
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
  const [useAdvancedLayout, setUseAdvancedLayout] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
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
    const callDuration = Math.round((Date.now() - callStartTime) / 1000); // in seconds
    
    // Show feedback modal if call was longer than 30 seconds
    if (callDuration > 30) {
      setShowLeaveConfirm(false);
      setShowFeedbackModal(true);
      return; // Don't leave immediately, wait for feedback modal
    }
    
    // For short calls, leave immediately
    performLeaveRoom();
  };

  const performLeaveRoom = () => {
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

  const handleFeedbackSubmit = (feedbackData) => {
    console.log('Feedback submitted:', feedbackData);
    toast.success('Thank you for your feedback!');
    performLeaveRoom();
  };

  const handleFeedbackClose = () => {
    setShowFeedbackModal(false);
    performLeaveRoom();
  };

  const handleReconnect = () => {
    toast.loading('Reconnecting...', { duration: 2000 });
    
    // Simple reconnection attempt
    if (socket.disconnected) {
      socket.connect();
    }
    
    // Refresh media stream if needed
    if (!stream) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((currentStream) => {
          setStream(currentStream);
          if (userVideo.current) {
            userVideo.current.srcObject = currentStream;
          }
          toast.success('Reconnected successfully!');
        })
        .catch((error) => {
          console.error('Error reconnecting media:', error);
          toast.error('Failed to reconnect media');
        });
    }
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

  // Engagement handlers
  const handleSendReaction = (emoji) => {
    socket.emit('send-reaction', { emoji });
  };

  const handleCreatePoll = (pollData) => {
    socket.emit('create-poll', pollData);
  };

  const handleVotePoll = (pollId, optionIndex) => {
    socket.emit('vote-poll', { pollId, optionIndex });
  };

  const handleSubmitQuestion = (questionData) => {
    socket.emit('submit-question', questionData);
  };

  const handleVoteQuestion = (questionId, userId) => {
    socket.emit('vote-question', { questionId, userId });
  };

  const handleAnswerQuestion = (questionId, answerData) => {
    socket.emit('answer-question', { questionId, ...answerData });
  };

  const handleRaiseHand = (handData) => {
    socket.emit('raise-hand', handData);
  };

  const handleLowerHand = (userId) => {
    socket.emit('lower-hand', { userId });
  };

  const togglePolls = () => {
    setShowPolls(!showPolls);
  };

  const toggleQA = () => {
    setShowQA(!showQA);
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
          // First user in room is the host
          setIsHost(users.length === 0);
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

        // Engagement event listeners
        socket.on('polls-history', (pollsHistory) => {
          setPolls(pollsHistory);
        });

        socket.on('questions-history', (questionsHistory) => {
          setQuestions(questionsHistory);
        });

        socket.on('raised-hands-history', (handsHistory) => {
          setRaisedHands(handsHistory);
        });

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
    <div className="min-h-screen bg-gray-900">
      {/* Professional Session Header */}
      <SessionHeader
        roomId={roomId}
        participantCount={peers.length + 1}
        userInfo={userInfo}
        onShare={() => setShowShareModal(true)}
        onLeave={confirmLeaveRoom}
        connectionStatus={connectionStatus}
      />

      {/* Main Content with Chat Panel Spacing */}
      <div className={`transition-all duration-300 ${showChat ? 'mr-80 md:mr-96' : 'mr-0'}`}>
        {/* Secondary Navigation for Additional Features */}
        <div className="fixed top-16 left-4 right-4 flex items-center justify-center z-30 mt-1">
        <div className="flex items-center gap-2 bg-gray-800/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700">
          <button
            onClick={toggleChat}
            className={`flex items-center space-x-1 px-3 py-2 rounded-md transition-colors text-sm relative ${
              showChat 
                ? 'text-white bg-blue-600 hover:bg-blue-700' 
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            <span>💬</span>
            <span className="hidden sm:inline">Chat</span>
            <svg 
              className={`w-3 h-3 ml-1 transition-transform ${showChat ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
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
        {/* Essential Controls */}
        <div className="flex items-center gap-4">
          {/* Microphone */}
          <button
            onClick={toggleMic}
            className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
              micOn 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            }`}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            <span className="text-xl">{micOn ? '🎤' : '🔇'}</span>
            {!micOn && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full"></div>
            )}
          </button>

          {/* Camera */}
          <button
            onClick={toggleCamera}
            className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
              camOn 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            }`}
            title={camOn ? 'Turn off camera' : 'Turn on camera'}
          >
            <span className="text-xl">{camOn ? '📹' : '🎥'}</span>
            {!camOn && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full"></div>
            )}
          </button>

          {/* Screen Share */}
          <button
            onClick={handleShareScreen}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
            title="Share screen"
          >
            <span className="text-xl">📺</span>
          </button>

          {/* More Menu Toggle */}
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
              showMoreMenu 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title="More options"
          >
            <span className="text-xl">⋯</span>
          </button>
        </div>

        {/* Leave Meeting Button */}
        <button
          onClick={confirmLeaveRoom}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200 shadow-lg hover:shadow-red-500/25"
          title="End Meeting"
        >
          <span className="text-xl font-bold">✕</span>
        </button>
      </div>

      {/* More Menu */}
      <MoreMenu
        isOpen={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        onSendReaction={handleSendReaction}
        reactions={reactions}
        onRaiseHand={handleRaiseHand}
        onLowerHand={handleLowerHand}
        raisedHands={raisedHands}
        userInfo={userInfo}
        isHost={isHost}
        onTogglePolls={togglePolls}
        onToggleQA={toggleQA}
        onToggleAdvancedLayout={() => setUseAdvancedLayout(!useAdvancedLayout)}
        useAdvancedLayout={useAdvancedLayout}
      />

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
      <div className="pt-28 pb-24 px-4">
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
      </div>

      {/* Chat Component */}
      <Chat
        messages={messages}
        onSendMessage={handleSendMessage}
        isOpen={showChat}
        onToggle={toggleChat}
        userInfo={userInfo}
      />

      {/* Polls Component */}
      <Polls
        isOpen={showPolls}
        onToggle={togglePolls}
        onCreatePoll={handleCreatePoll}
        onVote={handleVotePoll}
        polls={polls}
        userInfo={userInfo}
        isHost={isHost}
      />

      {/* Q&A Component */}
      <QA
        isOpen={showQA}
        onToggle={toggleQA}
        onSubmitQuestion={handleSubmitQuestion}
        onVoteQuestion={handleVoteQuestion}
        onAnswerQuestion={handleAnswerQuestion}
        questions={questions}
        userInfo={userInfo}
        isHost={isHost}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={handleFeedbackClose}
        onSubmit={handleFeedbackSubmit}
        roomId={roomId}
        callDuration={Math.round((Date.now() - callStartTime) / 1000)}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        roomId={roomId}
        roomUrl={`${window.location.origin}/room/${roomId}`}
      />
    </div>
  );
};

export default Room;