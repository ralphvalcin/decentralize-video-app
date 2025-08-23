import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
import PerformanceDashboard from './PerformanceDashboard';
import toast from 'react-hot-toast';
import { useRoomServices } from '../hooks/useRoomServices';
import { usePerformanceOptimization } from '../hooks/usePerformanceOptimization';
import { useMobileOptimization, useAdaptiveQuality, useMobileUI } from '../hooks/useMobileOptimization';
import { usePageTracking, useCallAnalytics, useMobileAnalytics } from '../hooks/useAnalytics';

const Room = () => {
  const { roomId } = useParams();
  const [useAdvancedLayout, setUseAdvancedLayout] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  
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

  // Performance dashboard state
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false);

  const userVideo = useRef();
  const [userInfo] = useState(() => {
    // Get user name from localStorage or generate a random one
    const savedName = localStorage.getItem('userName');
    return {
      name: savedName || `User${Math.floor(Math.random() * 1000)}`,
      role: 'Participant'
    };
  });

  // Initialize room services
  const {
    stream,
    peers,
    messages,
    unreadCount,
    micOn,
    camOn,
    connectionStatus,
    toggleMic,
    toggleCamera,
    handleShareScreen: serviceShareScreen,
    handleSendMessage,
    toggleChat: serviceToggleChat,
    handleLeaveRoom: serviceLeaveRoom,
    services
  } = useRoomServices(roomId, userInfo);

  // Initialize performance optimization
  const {
    optimizePeerConnections,
    applyPerformanceConstraints
  } = usePerformanceOptimization({
    peers,
    stream,
    roomId,
    enabled: true
  });

  // Mobile-specific optimizations
  const deviceCapabilities = useMobileOptimization();
  const { qualitySettings } = useAdaptiveQuality({ 
    stream, 
    peers, 
    deviceCapabilities 
  });
  const mobileUI = useMobileUI();

  // Analytics integration
  usePageTracking(`room_${roomId}`);
  const callAnalytics = useCallAnalytics();
  useMobileAnalytics();

  const handleShareScreen = async () => {
    await serviceShareScreen();
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
    // Track call end
    callAnalytics.endCall(roomId);
    
    // Clear any stored layout preferences
    localStorage.removeItem('video-layout');
    localStorage.removeItem('layout-preset');
    
    serviceLeaveRoom();
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


  const confirmLeaveRoom = () => {
    setShowLeaveConfirm(true);
  };

  const cancelLeaveRoom = () => {
    setShowLeaveConfirm(false);
  };

  // Apply performance constraints when stream is available
  useEffect(() => {
    if (stream) {
      applyPerformanceConstraints(stream);
      
      // Apply mobile-specific quality settings
      if (deviceCapabilities.isLowEndDevice || deviceCapabilities.batteryLevel < 0.3) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.applyConstraints(qualitySettings.video);
        }
      }
    }
  }, [stream, applyPerformanceConstraints, deviceCapabilities, qualitySettings]);

  // Optimize peer connections periodically
  useEffect(() => {
    if (peers.length > 0) {
      const optimizationInterval = setInterval(() => {
        const optimizations = optimizePeerConnections();
        if (optimizations.length > 0) {
          console.log('🔧 Peer optimizations available:', optimizations);
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(optimizationInterval);
    }
  }, [peers, optimizePeerConnections]);

  // Performance dashboard toggle
  const togglePerformanceDashboard = useCallback(() => {
    setShowPerformanceDashboard(prev => !prev);
  }, []);

  // Engagement feature handlers (placeholders - to be implemented with actual backend integration)
  const handleSendReaction = useCallback((emoji) => {
    const reaction = {
      id: Date.now(),
      emoji,
      userId: userInfo.name,
      timestamp: Date.now()
    };
    setReactions(prev => [...prev, reaction]);
    toast.success(`Sent reaction: ${emoji}`);
  }, [userInfo.name]);

  const handleRaiseHand = useCallback(() => {
    const hand = {
      userId: userInfo.name,
      userName: userInfo.name,
      timestamp: Date.now()
    };
    setRaisedHands(prev => [...prev, hand]);
    toast.success('Hand raised');
  }, [userInfo.name]);

  const handleLowerHand = useCallback((userId) => {
    setRaisedHands(prev => prev.filter(hand => hand.userId !== userId));
    toast.success('Hand lowered');
  }, []);

  const toggleChat = useCallback(() => {
    const newShowChat = !showChat;
    setShowChat(newShowChat);
    serviceToggleChat(newShowChat);
  }, [showChat, serviceToggleChat]);

  // Engagement handlers - using services (updated to use signaling service)
  const handleCreatePoll = (pollData) => {
    if (services.signaling) {
      services.signaling.createPoll(pollData);
    }
  };

  const handleVotePoll = (pollId, optionIndex) => {
    if (services.signaling) {
      services.signaling.votePoll({ pollId, optionIndex });
    }
  };

  const handleSubmitQuestion = (questionData) => {
    if (services.signaling) {
      services.signaling.submitQuestion(questionData);
    }
  };

  const handleVoteQuestion = (questionId, userId) => {
    if (services.signaling) {
      services.signaling.voteQuestion({ questionId, userId });
    }
  };

  const handleAnswerQuestion = (questionId, answerData) => {
    if (services.signaling) {
      services.signaling.answerQuestion({ questionId, ...answerData });
    }
  };

  const togglePolls = () => {
    setShowPolls(!showPolls);
  };

  const toggleQA = () => {
    setShowQA(!showQA);
  };

  // Set up user video stream reference
  useEffect(() => {
    if (stream && userVideo.current) {
      userVideo.current.srcObject = stream;
      // Track call start when stream is available
      callAnalytics.startCall(roomId);
    }
  }, [stream, callAnalytics, roomId]);

  // Set up engagement event listeners
  useEffect(() => {
    if (!services.signaling) return;

    // Set up engagement event listeners
    services.signaling.on('polls-history', (pollsHistory) => {
      setPolls(pollsHistory);
    });

    services.signaling.on('questions-history', (questionsHistory) => {
      setQuestions(questionsHistory);
    });

    services.signaling.on('raised-hands-history', (handsHistory) => {
      setRaisedHands(handsHistory);
    });

    services.signaling.on('new-reaction', (reaction) => {
      setReactions(prev => [...prev, reaction]);
    });

    services.signaling.on('new-poll', (poll) => {
      setPolls(prev => [...prev, poll]);
      toast.success(`New poll: ${poll.question}`);
    });

    services.signaling.on('poll-updated', (updatedPoll) => {
      setPolls(prev => prev.map(poll => 
        poll.id === updatedPoll.id ? updatedPoll : poll
      ));
    });

    services.signaling.on('new-question', (question) => {
      setQuestions(prev => [...prev, question]);
      toast.success(`New question from ${question.author}`);
    });

    services.signaling.on('question-updated', (updatedQuestion) => {
      setQuestions(prev => prev.map(question => 
        question.id === updatedQuestion.id ? updatedQuestion : question
      ));
    });

    services.signaling.on('hand-raised', (hand) => {
      setRaisedHands(prev => [...prev, hand]);
      toast.success(`${hand.userName} raised their hand`);
    });

    services.signaling.on('hand-lowered', (data) => {
      setRaisedHands(prev => prev.filter(hand => hand.userId !== data.userId));
    });

    // Determine if user is host (first user in room)
    services.signaling.on('all-users', users => {
      setIsHost(users.length === 0);
    });

    services.signaling.on('user-joined', () => {
      callAnalytics.trackParticipantJoin();
    });

    services.signaling.on('user-left', () => {
      callAnalytics.trackParticipantLeave();
    });

    return () => {
      services.signaling.off('polls-history');
      services.signaling.off('questions-history');
      services.signaling.off('raised-hands-history');
      services.signaling.off('new-reaction');
      services.signaling.off('new-poll');
      services.signaling.off('poll-updated');
      services.signaling.off('new-question');
      services.signaling.off('question-updated');
      services.signaling.off('hand-raised');
      services.signaling.off('hand-lowered');
      services.signaling.off('all-users');
    };
  }, [services.signaling]);

  // Connection monitoring is now handled by the services

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
  }, [showLeaveConfirm, showChat, toggleChat]);

  // Peer connection functions are now handled by PeerConnectionService

  return (
    <div 
      className={`min-h-screen bg-gray-900 ${mobileUI.isKeyboardOpen ? 'mobile-keyboard-open' : ''}`}
      style={{
        paddingTop: mobileUI.safeAreaInsets.top,
        paddingBottom: mobileUI.safeAreaInsets.bottom,
        paddingLeft: mobileUI.safeAreaInsets.left,
        paddingRight: mobileUI.safeAreaInsets.right
      }}
    >
      {/* Professional Session Header */}
      <SessionHeader
        roomId={roomId}
        participantCount={peers.length + 1}
        userInfo={userInfo}
        onShare={() => setShowShareModal(true)}
        onLeave={confirmLeaveRoom}
        connectionStatus={connectionStatus}
      />

      {/* Main Content with Panel Spacing */}
      <div className={`transition-all duration-300 ${
        (() => {
          const openPanels = [showChat, showPolls, showQA].filter(Boolean).length;
          if (openPanels === 0) return 'mr-0';
          if (openPanels === 1) return 'mr-80 md:mr-96';
          if (openPanels === 2) return 'mr-[480px] md:mr-[576px]'; // 2 * (240px on mobile, 288px on desktop)  
          if (openPanels === 3) return 'mr-[720px] md:mr-[864px]'; // 3 * (240px on mobile, 288px on desktop)
          return 'mr-0';
        })()
      }`}>
        {/* Mobile-First Secondary Navigation */}
        <div className="fixed top-16 left-2 right-2 sm:left-4 sm:right-4 flex items-center justify-center z-30 mt-1">
        <div className="flex items-center gap-1 sm:gap-2 bg-gray-800/90 backdrop-blur-sm px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-gray-700 max-w-full overflow-x-auto">
          <button
            onClick={toggleChat}
            className={`flex items-center space-x-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-colors text-xs sm:text-sm relative whitespace-nowrap ${
              showChat 
                ? 'text-white bg-blue-600 hover:bg-blue-700' 
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            <span className="text-base sm:text-lg">💬</span>
            <span className="hidden xs:inline sm:inline">Chat</span>
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

          <button
            onClick={togglePolls}
            className={`flex items-center space-x-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-colors text-xs sm:text-sm relative whitespace-nowrap ${
              showPolls 
                ? 'text-white bg-green-600 hover:bg-green-700' 
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            <span className="text-base sm:text-lg">📊</span>
            <span className="hidden xs:inline sm:inline">Polls</span>
            <svg 
              className={`w-3 h-3 ml-1 transition-transform ${showPolls ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <button
            onClick={toggleQA}
            className={`flex items-center space-x-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-colors text-xs sm:text-sm relative whitespace-nowrap ${
              showQA 
                ? 'text-white bg-purple-600 hover:bg-purple-700' 
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            <span className="text-base sm:text-lg">❓</span>
            <span className="hidden xs:inline sm:inline">Q&A</span>
            <svg 
              className={`w-3 h-3 ml-1 transition-transform ${showQA ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

        </div>
      </div>

      {/* Mobile-Optimized Controls Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-16 sm:h-20 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 flex items-center justify-between sm:justify-center gap-2 sm:gap-6 px-2 sm:px-8 z-50">
        {/* Essential Controls */}
        <div className="flex items-center gap-1 sm:gap-4 flex-1 sm:flex-none justify-center sm:justify-start">
          {/* Microphone */}
          <button
            onClick={toggleMic}
            className={`relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all duration-200 touch-manipulation ${
              micOn 
                ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white' 
                : 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white animate-pulse'
            }`}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            <span className="text-base sm:text-xl">{micOn ? '🎤' : '🔇'}</span>
            {!micOn && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full"></div>
            )}
          </button>

          {/* Camera */}
          <button
            onClick={toggleCamera}
            className={`relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all duration-200 touch-manipulation ${
              camOn 
                ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white' 
                : 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white animate-pulse'
            }`}
            title={camOn ? 'Turn off camera' : 'Turn on camera'}
          >
            <span className="text-base sm:text-xl">{camOn ? '📹' : '🎥'}</span>
            {!camOn && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full"></div>
            )}
          </button>

          {/* Screen Share - Hidden on smallest screens */}
          <button
            onClick={handleShareScreen}
            className="hidden xs:flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white transition-all duration-200 touch-manipulation"
            title="Share screen"
          >
            <span className="text-base sm:text-xl">📺</span>
          </button>

          {/* More Menu Toggle */}
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all duration-200 touch-manipulation ${
              showMoreMenu 
                ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white'
            }`}
            title="More options"
          >
            <span className="text-base sm:text-xl">⋯</span>
          </button>
        </div>

        {/* Leave Meeting Button */}
        <button
          onClick={confirmLeaveRoom}
          className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all duration-200 shadow-lg hover:shadow-red-500/25 touch-manipulation"
          title="End Meeting"
        >
          <span className="text-base sm:text-xl font-bold">✕</span>
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
        onTogglePerformanceDashboard={togglePerformanceDashboard}
        showPerformanceDashboard={showPerformanceDashboard}
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

      {/* Mobile-Optimized Video Grid */}
      <div className="pt-20 sm:pt-28 pb-16 sm:pb-24 px-2 sm:px-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
            {/* Local Video */}
            <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden touch-pan-y">
              <video
                ref={userVideo}
                muted
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 bg-black/60 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-white text-xs sm:text-sm">
                {userInfo.name} (You)
              </div>
            </div>

            {/* Peer Videos */}
            {peers.map((peer, index) => (
              <div key={index} className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden touch-pan-y">
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
      {(() => {
        const openPanels = [showChat, showPolls, showQA].filter(Boolean).length;
        let stackPosition = 0;
        if (showPolls && showQA) stackPosition = 2; // Chat is rightmost when all are open
        else if (showPolls || showQA) stackPosition = 1; // Chat is rightmost when one other is open
        
        return (
          <Chat
            messages={messages}
            onSendMessage={handleSendMessage}
            isOpen={showChat}
            onToggle={toggleChat}
            userInfo={userInfo}
            stackPosition={stackPosition}
            totalOpenPanels={openPanels}
          />
        );
      })()}

      {/* Polls Component */}
      {(() => {
        const openPanels = [showChat, showPolls, showQA].filter(Boolean).length;
        let stackPosition = 0;
        if (showChat && showQA) stackPosition = 1; // Polls is in middle when all are open
        else if (showChat) stackPosition = 1; // Polls is leftmost when chat is open
        else if (showQA) stackPosition = 1; // Polls is rightmost when only QA is also open
        
        return (
          <Polls
            isOpen={showPolls}
            onToggle={togglePolls}
            onCreatePoll={handleCreatePoll}
            onVote={handleVotePoll}
            polls={polls}
            userInfo={userInfo}
            isHost={isHost}
            stackPosition={stackPosition}
            totalOpenPanels={openPanels}
          />
        );
      })()}

      {/* Q&A Component */}
      {(() => {
        const openPanels = [showChat, showPolls, showQA].filter(Boolean).length;
        let stackPosition = 0;
        if (showChat && showPolls) stackPosition = 0; // QA is leftmost when all are open
        else if (showChat || showPolls) stackPosition = 0; // QA is leftmost when others are open
        
        return (
          <QA
            isOpen={showQA}
            onToggle={toggleQA}
            onSubmitQuestion={handleSubmitQuestion}
            onVoteQuestion={handleVoteQuestion}
            onAnswerQuestion={handleAnswerQuestion}
            questions={questions}
            userInfo={userInfo}
            isHost={isHost}
            stackPosition={stackPosition}
            totalOpenPanels={openPanels}
          />
        );
      })()}

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

      {/* Performance Dashboard */}
      <PerformanceDashboard
        peers={peers}
        isOpen={showPerformanceDashboard}
        onToggle={togglePerformanceDashboard}
        position="bottom-right"
      />
    </div>
  );
};

export default Room;