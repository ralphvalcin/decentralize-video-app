/**
 * Global State Hooks - Integration between stores and event bus
 * Provides high-level hooks for common application patterns
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useStoreActions, useCallStatus, useRoomEngagement } from '../stores';
import { eventBus, useEventBus } from '../utils/EventBus';
import type {
  UserInfo,
  ChatMessage,
  Poll,
  Question,
  EmojiReaction,
  RaisedHand,
  EventCallback,
  EventUnsubscribe,
} from '../types';

// ============================================================================
// Event-Driven Hooks
// ============================================================================

/**
 * Hook for managing WebRTC connection with automatic event handling
 */
export const useWebRTCConnection = () => {
  const { connection } = useStoreActions();
  const callStatus = useCallStatus();
  const eventBusInstance = useEventBus();

  // Connection event handlers
  const handleConnectionStatusChange = useCallback<EventCallback<'connection:status-changed'>>(
    ({ status }) => {
      console.log(`Connection status changed: ${status}`);
      
      if (status === 'failed') {
        // Trigger reconnection logic
        setTimeout(() => {
          const socket = connection.setSocket;
          // Reconnection would be handled by the socket.io client
        }, 1000);
      }
    },
    [connection]
  );

  const handlePeerJoined = useCallback<EventCallback<'peer:joined'>>(
    ({ peer }) => {
      console.log(`Peer joined: ${peer.name}`);
    },
    []
  );

  const handlePeerLeft = useCallback<EventCallback<'peer:left'>>(
    ({ peerID, name }) => {
      console.log(`Peer left: ${name}`);
    },
    []
  );

  // Set up event listeners
  useEffect(() => {
    const unsubscribers: EventUnsubscribe[] = [
      eventBusInstance.on('connection:status-changed', handleConnectionStatusChange),
      eventBusInstance.on('peer:joined', handlePeerJoined),
      eventBusInstance.on('peer:left', handlePeerLeft),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [eventBusInstance, handleConnectionStatusChange, handlePeerJoined, handlePeerLeft]);

  return {
    ...callStatus,
    // Additional connection utilities
    isInitializing: callStatus.status === 'connecting',
    hasError: callStatus.status === 'error' || callStatus.status === 'failed',
    canReconnect: callStatus.status === 'disconnected' || callStatus.status === 'failed',
  };
};

/**
 * Hook for managing chat with automatic event handling and optimizations
 */
export const useGlobalChat = () => {
  const { room, ui } = useStoreActions();
  const eventBusInstance = useEventBus();
  const messagesRef = useRef<ChatMessage[]>([]);

  // Chat event handlers
  const handleNewMessage = useCallback<EventCallback<'chat:message-received'>>(
    ({ message }) => {
      messagesRef.current = [...messagesRef.current, message];
      
      // Auto-show notification if chat is not visible
      const chatOpen = ui.togglePanel; // Would need to check actual state
      // if (!chatOpen) {
      //   showNotification('New message from ' + message.userName);
      // }
    },
    [ui]
  );

  const sendMessage = useCallback(
    (text: string, userInfo: UserInfo) => {
      const message: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userInfo.id,
        userName: userInfo.name,
        text,
        timestamp: Date.now(),
        type: 'text',
      };

      room.addMessage(message);
      
      eventBusInstance.emit('chat:message-sent', {
        message,
        timestamp: Date.now(),
      });
    },
    [room, eventBusInstance]
  );

  // Set up event listeners
  useEffect(() => {
    const unsubscribe = eventBusInstance.on('chat:message-received', handleNewMessage);
    return unsubscribe;
  }, [eventBusInstance, handleNewMessage]);

  return {
    sendMessage,
    messages: messagesRef.current,
  };
};

/**
 * Hook for managing polls with event-driven updates
 */
export const useGlobalPolls = () => {
  const { room } = useStoreActions();
  const eventBusInstance = useEventBus();

  const createPoll = useCallback(
    (question: string, options: string[], userInfo: UserInfo) => {
      const poll: Poll = {
        id: `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        question,
        options: options.map((text, index) => ({
          id: `opt_${index}`,
          text,
          votes: 0,
          voters: [],
        })),
        createdBy: userInfo.id,
        createdAt: Date.now(),
        allowMultipleChoice: false,
        anonymous: false,
        status: 'active',
      };

      room.addPoll(poll);
      
      eventBusInstance.emit('poll:created', {
        poll,
        timestamp: Date.now(),
      });
    },
    [room, eventBusInstance]
  );

  const votePoll = useCallback(
    (pollId: string, optionId: string, userInfo: UserInfo) => {
      // This would update the poll in the store
      // For now, just emit the event
      eventBusInstance.emit('poll:voted', {
        pollId,
        optionId,
        userId: userInfo.id,
        timestamp: Date.now(),
      });
    },
    [eventBusInstance]
  );

  return {
    createPoll,
    votePoll,
  };
};

/**
 * Hook for managing reactions with automatic cleanup
 */
export const useGlobalReactions = () => {
  const { room } = useStoreActions();
  const eventBusInstance = useEventBus();
  const cleanupTimeoutRef = useRef<number>();

  const sendReaction = useCallback(
    (emoji: string, userInfo: UserInfo, position?: { x: number; y: number }) => {
      const reaction: EmojiReaction = {
        id: `react_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userInfo.id,
        userName: userInfo.name,
        emoji,
        timestamp: Date.now(),
        x: position?.x,
        y: position?.y,
      };

      room.addReaction(reaction);
      
      eventBusInstance.emit('reaction:sent', {
        reaction,
        timestamp: Date.now(),
      });

      // Auto-cleanup after 10 seconds
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      
      cleanupTimeoutRef.current = window.setTimeout(() => {
        // Remove old reactions (this would be handled by the store)
      }, 10000);
    },
    [room, eventBusInstance]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, []);

  return {
    sendReaction,
  };
};

// ============================================================================
// Performance and Optimization Hooks
// ============================================================================

/**
 * Hook for automatic performance monitoring and optimization
 */
export const usePerformanceOptimization = () => {
  const { ui, connection } = useStoreActions();
  const performanceRef = useRef({
    renderCount: 0,
    lastRenderTime: performance.now(),
  });

  // Monitor rendering performance
  useEffect(() => {
    performanceRef.current.renderCount++;
    const now = performance.now();
    const timeSinceLastRender = now - performanceRef.current.lastRenderTime;
    performanceRef.current.lastRenderTime = now;

    // If renders are happening too frequently (< 16ms apart), enable performance mode
    if (timeSinceLastRender < 16 && performanceRef.current.renderCount > 10) {
      const currentPerformanceMode = ui.setPerformanceMode;
      // ui.setPerformanceMode(true);
    }
  });

  // Monitor connection quality for automatic adjustments
  const connectionHealth = connection.updateQuality;
  
  const adjustForPerformance = useCallback(() => {
    // This would contain logic to adjust video quality, disable animations, etc.
    ui.setPerformanceMode(true);
  }, [ui]);

  return {
    adjustForPerformance,
    renderCount: performanceRef.current.renderCount,
  };
};

/**
 * Hook for managing UI state with automatic responsive adjustments
 */
export const useResponsiveUI = () => {
  const { ui } = useStoreActions();
  
  // Monitor window size changes
  useEffect(() => {
    let resizeTimeout: number;
    
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        const width = window.innerWidth;
        
        // Auto-adjust layout based on screen size
        if (width < 768) {
          // Mobile - close multiple panels, use spotlight layout
          ui.setLayout({
            preset: 'spotlight',
            compactMode: true,
          });
        } else if (width < 1024) {
          // Tablet - moderate layout
          ui.setLayout({
            preset: 'grid',
            gridColumns: 2,
            compactMode: false,
          });
        } else {
          // Desktop - full layout
          ui.setLayout({
            preset: 'grid',
            gridColumns: 3,
            compactMode: false,
          });
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [ui]);

  return {
    // Responsive utilities
    isMobile: window.innerWidth < 768,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
  };
};

// ============================================================================
// Composite Application State Hook
// ============================================================================

/**
 * Master hook that combines all global state management
 * Use this in top-level components for complete state access
 */
export const useGlobalApplicationState = (roomId?: string, userInfo?: UserInfo) => {
  const connection = useWebRTCConnection();
  const chat = useGlobalChat();
  const polls = useGlobalPolls();
  const reactions = useGlobalReactions();
  const performance = usePerformanceOptimization();
  const responsive = useResponsiveUI();
  const engagement = useRoomEngagement();
  const actions = useStoreActions();

  // Initialize stores when room info is available
  useEffect(() => {
    if (roomId && userInfo) {
      actions.room.setRoomId(roomId);
      actions.room.setUserInfo(userInfo);
    }
  }, [roomId, userInfo, actions.room]);

  // Global error handling
  const eventBusInstance = useEventBus();
  
  useEffect(() => {
    const handleSystemError = (errorData: Parameters<EventCallback<'system:error'>>[0]) => {
      console.error('System error:', errorData.error);
      
      // Could integrate with error reporting service here
      if (errorData.context?.includes('connection')) {
        // Handle connection errors
        actions.ui.toggleModal('leaveConfirmation');
      }
    };

    const unsubscribe = eventBusInstance.on('system:error', handleSystemError);
    return unsubscribe;
  }, [eventBusInstance, actions.ui]);

  return {
    // Connection state
    connection,
    
    // Communication features
    chat,
    polls,
    reactions,
    
    // Engagement metrics
    engagement,
    
    // UI and performance
    responsive,
    performance,
    
    // All store actions
    actions,
    
    // Computed state
    isReady: connection.isConnected && !!roomId && !!userInfo,
    hasActivity: engagement.hasUnread || engagement.activeReactions > 0,
  };
};

export default useGlobalApplicationState;