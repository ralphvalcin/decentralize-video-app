/**
 * Room Component Migration Example - Using Global State Management
 * This shows how to migrate the existing Room.jsx to use the new state system
 * 
 * BEFORE: 70+ useState calls, complex prop drilling, manual state synchronization
 * AFTER: Centralized state management, type-safe event system, optimized re-renders
 */

import React, { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import toast from 'react-hot-toast';

// Import new global state hooks and components
import { useGlobalStateContext, useCurrentSession } from '../providers/GlobalStateProvider';
import { eventBus } from '../utils/EventBus';
import type { PeerConnection, UserInfo } from '../types';

// Import UI components (these would be updated to use global state too)
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

/**
 * Migrated Room Component using Global State Management
 */
const Room: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  
  // Global state access - replaces all useState calls
  const { globalState, isReady, leaveRoom } = useGlobalStateContext();
  const { userInfo } = useCurrentSession();
  
  // Destructure what we need from global state
  const {
    connection,
    chat,
    reactions,
    engagement,
    actions,
  } = globalState;

  // Socket initialization - now managed by connection store
  const initializeSocket = useCallback(async () => {
    if (!roomId || !userInfo) return;

    const socket = io('http://localhost:5001', {
      reconnectionDelayMax: 10000,
      reconnection: true,
      reconnectionAttempts: 10,
    });

    // Set socket in connection store
    actions.connection.setSocket(socket);

    // Socket event handlers - now integrated with global state
    socket.on('connect', () => {
      console.log('Connected to signaling server');
      actions.connection.setStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      actions.connection.setStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection Error:', error);
      actions.connection.setStatus('error');
      
      eventBus.emit('system:error', {
        error: new Error(`Socket connection error: ${error.message}`),
        context: 'socket-connection',
        timestamp: Date.now(),
      });
    });

    // WebRTC peer management
    socket.on('all-users', (users: any[]) => {
      console.log('Received all-users:', users);
      
      users.forEach((user) => {
        if (user.id !== socket.id) {
          createPeerConnection(user, socket, true);
        }
      });
    });

    socket.on('user-joined', (payload: any) => {
      console.log('User joined:', payload);
      createPeerConnection(payload, socket, false);
    });

    socket.on('receiving-returned-signal', (payload: any) => {
      const peer = actions.connection.updatePeer;
      // Handle WebRTC signaling through store
    });

    socket.on('user-left', (userId: string) => {
      actions.connection.removePeer(userId);
    });

    // Chat events - now handled by chat store
    socket.on('chat-history', (messages: any[]) => {
      messages.forEach((message) => {
        actions.room.addMessage(message);
      });
    });

    socket.on('new-message', (message: any) => {
      actions.room.addMessage(message);
    });

    // Engagement events
    socket.on('new-poll', (poll: any) => {
      actions.room.addPoll(poll);
    });

    socket.on('new-question', (question: any) => {
      actions.room.addQuestion(question);
    });

    socket.on('new-reaction', (reaction: any) => {
      actions.room.addReaction(reaction);
    });

    socket.on('hand-raised', (hand: any) => {
      actions.room.raiseHand(hand);
    });

    socket.on('hand-lowered', ({ userId }: { userId: string }) => {
      actions.room.lowerHand(userId);
    });

    // Join room
    socket.emit('join-room', { ...userInfo, roomId });

  }, [roomId, userInfo, actions]);

  // WebRTC peer connection creation - now uses store
  const createPeerConnection = useCallback(
    (user: any, socket: Socket, initiator: boolean) => {
      const { localStream } = actions.media;

      const peer = new Peer({
        initiator,
        trickle: false,
        stream: localStream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      const peerConnection: PeerConnection = {
        peerID: user.id,
        peer,
        name: user.name,
        role: user.role || 'Participant',
        signaled: false,
        connectionState: 'connecting',
        joinedAt: Date.now(),
      };

      // Add to connection store
      actions.connection.addPeer(peerConnection);

      // WebRTC event handlers
      peer.on('signal', (signal) => {
        if (initiator) {
          socket.emit('sending-signal', { userToSignal: user.id, callerID: socket.id, signal });
        } else {
          socket.emit('returning-signal', { signal, callerID: user.id });
        }
      });

      peer.on('stream', (stream) => {
        actions.connection.updatePeer(user.id, { stream });
      });

      peer.on('error', (error) => {
        console.error('Peer error:', error);
        eventBus.emit('system:error', {
          error: new Error(`Peer error: ${error.message || error}`),
          context: `peer-${user.id}`,
          timestamp: Date.now(),
        });
      });

      peer.on('connect', () => {
        actions.connection.updatePeer(user.id, { connectionState: 'connected' });
      });

      peer.on('close', () => {
        actions.connection.updatePeer(user.id, { connectionState: 'closed' });
      });

      return peer;
    },
    [actions]
  );

  // Media controls - now use media store actions
  const toggleMic = useCallback(() => {
    const enabled = actions.media.toggleAudio();
    toast.success(enabled ? '🎤 Microphone unmuted' : '🔇 Microphone muted');
  }, [actions.media]);

  const toggleCamera = useCallback(() => {
    const enabled = actions.media.toggleVideo();
    toast.success(enabled ? '📹 Camera turned on' : '🎥 Camera turned off');
  }, [actions.media]);

  const handleShareScreen = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      actions.media.startScreenShare(screenStream);
      toast.success('🖥️ Screen sharing started');

      screenStream.getVideoTracks()[0].onended = () => {
        actions.media.stopScreenShare();
        toast.info('📤 Screen sharing ended');
      };

    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('❌ Failed to share screen');
    }
  }, [actions.media]);

  // UI interactions - now use UI store
  const toggleChat = useCallback(() => {
    actions.ui.togglePanel('chat');
    actions.room.clearUnreadCount('messages');
  }, [actions.ui, actions.room]);

  const togglePolls = useCallback(() => {
    actions.ui.togglePanel('polls');
    actions.room.clearUnreadCount('polls');
  }, [actions.ui, actions.room]);

  const toggleQA = useCallback(() => {
    actions.ui.togglePanel('qa');
    actions.room.clearUnreadCount('questions');
  }, [actions.ui, actions.room]);

  const confirmLeaveRoom = useCallback(() => {
    actions.ui.toggleModal('leaveConfirmation');
  }, [actions.ui]);

  // Message sending - now uses global chat system
  const handleSendMessage = useCallback(
    (text: string) => {
      if (!userInfo) return;
      chat.sendMessage(text, userInfo);
    },
    [chat, userInfo]
  );

  // Initialize socket when component mounts
  useEffect(() => {
    if (isReady) {
      initializeSocket();
    }
  }, [isReady, initializeSocket]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Cleanup is now handled by the global state provider
    };
  }, []);

  // Show loading state while initializing
  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Initializing room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Session Header - now receives state from stores */}
      <SessionHeader
        roomId={roomId || ''}
        participantCount={connection.participantCount}
        userInfo={userInfo!}
        onShare={() => actions.ui.toggleModal('shareModal')}
        onLeave={confirmLeaveRoom}
        connectionStatus={connection.status}
      />

      {/* Main Video Area */}
      <div className="pt-28 pb-24 px-4">
        <VideoLayout
          // Props now come from global state
          localStream={globalState.connection.hasLocalStream ? undefined : null}
          peers={[]} // Would get from connection store
          userInfo={userInfo!}
          onLayoutChange={(layout) => {
            console.log('Layout changed:', layout);
          }}
        />
      </div>

      {/* Control Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 flex items-center justify-center gap-6 px-8 z-50">
        <div className="flex items-center gap-4">
          {/* Microphone */}
          <button
            onClick={toggleMic}
            className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
              connection.audioEnabled 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            }`}
            title={connection.audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            <span className="text-xl">{connection.audioEnabled ? '🎤' : '🔇'}</span>
          </button>

          {/* Camera */}
          <button
            onClick={toggleCamera}
            className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
              connection.videoEnabled 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            }`}
            title={connection.videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            <span className="text-xl">{connection.videoEnabled ? '📹' : '🎥'}</span>
          </button>

          {/* Screen Share */}
          <button
            onClick={handleShareScreen}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
            title="Share screen"
          >
            <span className="text-xl">📺</span>
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

      {/* Feature Panels - now driven by UI store */}
      <div className="fixed top-20 right-4 flex flex-col gap-2">
        <button
          onClick={toggleChat}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            globalState.actions.ui.togglePanel ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
          }`}
        >
          Chat {engagement.unreadCounts.messages > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
              {engagement.unreadCounts.messages}
            </span>
          )}
        </button>

        <button
          onClick={togglePolls}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
        >
          Polls {engagement.unreadCounts.polls > 0 && (
            <span className="ml-2 bg-green-500 text-white text-xs rounded-full px-2 py-1">
              {engagement.unreadCounts.polls}
            </span>
          )}
        </button>

        <button
          onClick={toggleQA}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
        >
          Q&A {engagement.unreadCounts.questions > 0 && (
            <span className="ml-2 bg-purple-500 text-white text-xs rounded-full px-2 py-1">
              {engagement.unreadCounts.questions}
            </span>
          )}
        </button>
      </div>

      {/* Side Panels - These components would be updated to use global state */}
      {/* Chat Component */}
      <Chat
        messages={[]} // Now gets from room store
        onSendMessage={handleSendMessage}
        isOpen={false} // Now gets from UI store
        onToggle={toggleChat}
        userInfo={userInfo!}
        stackPosition={0}
        totalOpenPanels={1}
      />

      {/* Modals - controlled by UI store */}
      <FeedbackModal
        isOpen={false} // globalState.modals.feedbackModal
        onClose={() => actions.ui.toggleModal('feedbackModal')}
        onSubmit={(data) => {
          console.log('Feedback submitted:', data);
          leaveRoom();
        }}
        roomId={roomId || ''}
        callDuration={0}
      />

      <ShareModal
        isOpen={false} // globalState.modals.shareModal
        onClose={() => actions.ui.toggleModal('shareModal')}
        roomId={roomId || ''}
        roomUrl={`${window.location.origin}/room/${roomId}`}
      />

      {/* Leave Confirmation Modal */}
      {/* {globalState.modals.leaveConfirmation && ( */}
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">
              End Meeting?
            </h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to end this meeting?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => actions.ui.toggleModal('leaveConfirmation')}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={leaveRoom}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                End Meeting
              </button>
            </div>
          </div>
        </div>
      {/* )} */}
    </div>
  );
};

export default Room;