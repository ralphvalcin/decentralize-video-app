/**
 * Store Index - Centralized store exports and utilities
 * Provides unified access to all stores and custom hooks
 */

// ============================================================================
// Store Exports
// ============================================================================

export { default as useConnectionStore } from './connectionStore';
export { default as useMediaStore } from './mediaStore';
export { default as useRoomStore } from './roomStore';
export { default as useUIStore } from './uiStore';
export { default as useAIStore } from './aiStore';

// ============================================================================
// Selector Exports
// ============================================================================

// Connection selectors
export {
  useConnectionStatus,
  useConnectionQuality,
  usePeers,
  usePeer,
  usePeerCount,
  useSocket,
  useReconnectionState,
  useConnectionHealth,
} from './connectionStore';

// Media selectors
export {
  useLocalStream,
  useMediaSettings,
  useAudioEnabled,
  useVideoEnabled,
  useMediaDevices,
  useScreenShare,
  useMediaPermissions,
  useMediaInitialization,
} from './mediaStore';

// Room selectors
export {
  useRoomId,
  useUserInfo,
  useParticipants,
  useParticipantCount,
  useChatMessages,
  useRecentChatMessages,
  usePolls,
  useActivePolls,
  useQuestions,
  usePendingQuestions,
  useRecentReactions,
  useRaisedHands,
  useUnreadCounts,
  useUnreadCount,
  useRoomMetadata,
  useIsHost,
  useRoomActivity,
} from './roomStore';

// UI selectors
export {
  useLayout,
  usePanels,
  usePanelState,
  useOpenPanelsCount,
  useModals,
  useModalState,
  useAnyModalOpen,
  useTheme,
  useNotificationSettings,
  useFullscreen,
  useSidebarState,
  usePerformanceMode,
  useUIAccessibility,
} from './uiStore';

// AI selectors
export {
  useAIInitialization,
  useConnectionIntelligence,
  useLayoutIntelligence,
  useParticipantIntelligence,
  usePerformanceIntelligence,
  useAIRecommendations,
  useAISettings,
  useAILearning,
} from './aiStore';

// ============================================================================
// Utility Exports
// ============================================================================

// Media utilities
export {
  initializeMediaDevices,
  enumerateMediaDevices,
  switchMediaDevice,
} from './mediaStore';

// Room utilities
export {
  createChatMessage,
  createPoll,
  createQuestion,
  createReaction,
  createRaisedHand,
} from './roomStore';

// UI utilities
export {
  initializeTheme,
  getResponsiveLayout,
  applyResponsiveLayout,
} from './uiStore';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Store types
  ConnectionStore,
  MediaStore,
  RoomStore,
  UIStore,
  AIStore,
  
  // State types
  ConnectionState,
  MediaState,
  RoomState,
  UIState,
  AIState,
  
  // Action types
  ConnectionActions,
  MediaActions,
  RoomActions,
  UIActions,
  AIActions,
  
  // Domain types
  UserInfo,
  PeerConnection,
  ConnectionStatus,
  ConnectionQuality,
  MediaDevice,
  MediaSettings,
  ScreenShareState,
  ChatMessage,
  EmojiReaction,
  Poll,
  Question,
  RaisedHand,
  LayoutConfig,
  PanelStates,
  ModalStates,
  NotificationSettings,
  
  // Event types
  EventMap,
  EventCallback,
  EventUnsubscribe,
  
  // Utility types
  DeepReadonly,
  Optional,
  AppError,
  PerformanceMetrics,
  
  // AI types
  AIInsights,
  AIRecommendation,
  AIOptimization,
  ConnectionPrediction,
  LayoutSuggestion,
  EngagementAnalysis,
  PerformancePrediction,
} from '../types';

// ============================================================================
// Combined Store Hooks
// ============================================================================

import { useCallback } from 'react';
import type { ChatMessage, Poll, Question, EmojiReaction, UserInfo } from '../types';

/**
 * Combined connection and media status hook
 */
export const useCallStatus = () => {
  const connectionStatus = useConnectionStatus();
  const connectionQuality = useConnectionQuality();
  const localStream = useLocalStream();
  const peerCount = usePeerCount();
  const audioEnabled = useAudioEnabled();
  const videoEnabled = useVideoEnabled();

  return {
    isConnected: connectionStatus === 'connected',
    quality: connectionQuality,
    hasLocalStream: !!localStream,
    participantCount: peerCount + 1, // Include self
    audioEnabled,
    videoEnabled,
    status: connectionStatus,
  };
};

/**
 * Combined room activity hook
 */
export const useRoomEngagement = () => {
  const messages = useChatMessages();
  const polls = usePolls();
  const questions = useQuestions();
  const reactions = useRecentReactions();
  const raisedHands = useRaisedHands();
  const unreadCounts = useUnreadCounts();

  return {
    totalMessages: messages.length,
    totalPolls: polls.length,
    totalQuestions: questions.length,
    activeReactions: reactions.length,
    raisedHandsCount: raisedHands.length,
    hasUnread: Object.values(unreadCounts).some((count) => count > 0),
    unreadCounts,
  };
};

/**
 * Combined UI state hook
 */
export const useInterfaceState = () => {
  const layout = useLayout();
  const panels = usePanels();
  const modals = useModals();
  const theme = useTheme();
  const isFullscreen = useFullscreen();
  const performanceMode = usePerformanceMode();

  const openPanelsCount = Object.values(panels).filter(Boolean).length;
  const anyModalOpen = Object.values(modals).some(Boolean);

  return {
    layout,
    openPanelsCount,
    anyModalOpen,
    theme,
    isFullscreen,
    performanceMode,
    isDarkMode: theme === 'dark' || (theme === 'system' && 
      window.matchMedia('(prefers-color-scheme: dark)').matches),
  };
};

/**
 * Store actions hook - provides all store actions in one place
 */
export const useStoreActions = () => {
  const connectionStore = useConnectionStore();
  const mediaStore = useMediaStore();
  const roomStore = useRoomStore();
  const uiStore = useUIStore();

  return {
    // Connection actions
    connection: {
      setSocket: connectionStore.setSocket,
      setStatus: connectionStore.setStatus,
      updateQuality: connectionStore.updateQuality,
      addPeer: connectionStore.addPeer,
      removePeer: connectionStore.removePeer,
      updatePeer: connectionStore.updatePeer,
      reset: connectionStore.reset,
    },
    
    // Media actions
    media: {
      setLocalStream: mediaStore.setLocalStream,
      updateSettings: mediaStore.updateSettings,
      toggleAudio: mediaStore.toggleAudio,
      toggleVideo: mediaStore.toggleVideo,
      startScreenShare: mediaStore.startScreenShare,
      stopScreenShare: mediaStore.stopScreenShare,
      updatePermissions: mediaStore.updatePermissions,
      reset: mediaStore.reset,
    },
    
    // Room actions
    room: {
      setRoomId: roomStore.setRoomId,
      setUserInfo: roomStore.setUserInfo,
      addMessage: roomStore.addMessage,
      addPoll: roomStore.addPoll,
      addQuestion: roomStore.addQuestion,
      addReaction: roomStore.addReaction,
      raiseHand: roomStore.raiseHand,
      lowerHand: roomStore.lowerHand,
      clearUnreadCount: roomStore.clearUnreadCount,
      reset: roomStore.reset,
    },
    
    // UI actions
    ui: {
      setLayout: uiStore.setLayout,
      togglePanel: uiStore.togglePanel,
      toggleModal: uiStore.toggleModal,
      setTheme: uiStore.setTheme,
      toggleFullscreen: uiStore.toggleFullscreen,
      setPerformanceMode: uiStore.setPerformanceMode,
      reset: uiStore.reset,
    },
  };
};

// ============================================================================
// Initialization and Cleanup
// ============================================================================

/**
 * Initialize all stores with default values
 */
export const initializeStores = async (
  roomId: string,
  userInfo: UserInfo
): Promise<void> => {
  const { room, ui } = useStoreActions();
  
  // Initialize room
  room.setRoomId(roomId);
  room.setUserInfo(userInfo);
  
  // Initialize UI based on device
  ui.setLayout(getResponsiveLayout(window.innerWidth));
  
  // Initialize media devices
  try {
    await initializeMediaDevices();
  } catch (error) {
    console.error('Failed to initialize media devices:', error);
  }
  
  // Initialize theme
  initializeTheme();
};

/**
 * Clean up all stores and resources
 */
export const cleanupStores = (): void => {
  const stores = useStoreActions();
  
  // Reset all stores
  stores.connection.reset();
  stores.media.reset();
  stores.room.reset();
  stores.ui.reset();
};

// ============================================================================
// Development Utilities
// ============================================================================

/**
 * Get current state of all stores (for debugging)
 */
export const getStoreStates = () => {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('getStoreStates should only be used in development');
    return null;
  }
  
  return {
    connection: useConnectionStore.getState(),
    media: useMediaStore.getState(),
    room: useRoomStore.getState(),
    ui: useUIStore.getState(),
  };
};

/**
 * Subscribe to all store changes (for debugging)
 */
export const subscribeToStoreChanges = (callback: (storeName: string, state: any) => void) => {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('subscribeToStoreChanges should only be used in development');
    return () => {};
  }

  const unsubscribers = [
    useConnectionStore.subscribe(
      (state) => state,
      (state) => callback('connection', state)
    ),
    useMediaStore.subscribe(
      (state) => state,
      (state) => callback('media', state)
    ),
    useRoomStore.subscribe(
      (state) => state,
      (state) => callback('room', state)
    ),
    useUIStore.subscribe(
      (state) => state,
      (state) => callback('ui', state)
    ),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
};

// Make stores available globally in development
if (process.env.NODE_ENV === 'development') {
  (window as any).stores = {
    connection: useConnectionStore,
    media: useMediaStore,
    room: useRoomStore,
    ui: useUIStore,
    getStates: getStoreStates,
    subscribe: subscribeToStoreChanges,
  };
}