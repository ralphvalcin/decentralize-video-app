/**
 * Room Store - Room state, participants, and engagement features
 * Handles chat messages, polls, Q&A, reactions, and participant management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  RoomStore,
  RoomState,
  RoomActions,
  UserInfo,
  ChatMessage,
  Poll,
  Question,
  EmojiReaction,
  RaisedHand,
} from '../types';
import { eventBus } from '../utils/EventBus';

/**
 * Initial room state
 */
const initialState: RoomState = {
  roomId: null,
  userInfo: null,
  participants: new Map(),
  messages: [],
  polls: [],
  questions: [],
  reactions: [],
  raisedHands: new Map(),
  unreadCounts: {
    messages: 0,
    polls: 0,
    questions: 0,
  },
  metadata: {},
};

/**
 * Room store with comprehensive room and engagement management
 */
export const useRoomStore = create<RoomStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // =====================================================================
      // Core Actions
      // =====================================================================

      reset: () => {
        set((state) => {
          Object.assign(state, {
            ...initialState,
            // Keep user info and room ID for potential reconnection
            userInfo: state.userInfo,
            roomId: state.roomId,
          });
        });

        eventBus.emit('system:cleanup', { timestamp: Date.now() });
      },

      updateState: (updates) => {
        set((state) => {
          Object.assign(state, updates);
        });
      },

      // =====================================================================
      // Room Management
      // =====================================================================

      setRoomId: (roomId) => {
        set((state) => {
          state.roomId = roomId;
          state.metadata.createdAt = Date.now();
        });
      },

      setUserInfo: (userInfo) => {
        const prevUserInfo = get().userInfo;
        
        set((state) => {
          state.userInfo = userInfo;
          
          // Set host if this is the first user
          if (!state.metadata.hostId && userInfo.role === 'Host') {
            state.metadata.hostId = userInfo.id;
          }
        });

        // Add user as participant
        if (userInfo) {
          get().addParticipant(userInfo);
        }
      },

      // =====================================================================
      // Participant Management
      // =====================================================================

      addParticipant: (participant) => {
        const existing = get().participants.get(participant.id);
        if (existing) {
          // Update existing participant
          set((state) => {
            state.participants.set(participant.id, {
              ...existing,
              ...participant,
            });
          });
          return;
        }

        set((state) => {
          state.participants.set(participant.id, {
            ...participant,
            joinedAt: participant.joinedAt || Date.now(),
          });
        });
      },

      removeParticipant: (userId) => {
        const participant = get().participants.get(userId);
        if (!participant) return;

        set((state) => {
          state.participants.delete(userId);
          
          // Also remove from raised hands
          state.raisedHands.delete(userId);
        });

        // Remove participant's messages, polls, etc. if needed
        // (Usually you'd keep them for history)
      },

      // =====================================================================
      // Chat Management
      // =====================================================================

      addMessage: (message) => {
        set((state) => {
          state.messages.push(message);
          
          // Keep only last 100 messages for performance
          if (state.messages.length > 100) {
            state.messages = state.messages.slice(-100);
          }
          
          // Increment unread count
          state.unreadCounts.messages += 1;
        });

        eventBus.emit('chat:message-received', {
          message,
          timestamp: Date.now(),
        });

        eventBus.emit('chat:unread-count-changed', {
          count: get().unreadCounts.messages,
          timestamp: Date.now(),
        });
      },

      // =====================================================================
      // Poll Management
      // =====================================================================

      addPoll: (poll) => {
        set((state) => {
          state.polls.push(poll);
          state.unreadCounts.polls += 1;
        });

        eventBus.emit('poll:created', {
          poll,
          timestamp: Date.now(),
        });
      },

      updatePoll: (pollId, updates) => {
        const pollIndex = get().polls.findIndex((p) => p.id === pollId);
        if (pollIndex === -1) {
          console.warn(`Poll with ID ${pollId} not found`);
          return;
        }

        set((state) => {
          const poll = state.polls[pollIndex];
          state.polls[pollIndex] = { ...poll, ...updates };
        });

        // Emit vote event if options were updated (indicating a vote)
        if (updates.options) {
          const userId = get().userInfo?.id;
          if (userId) {
            eventBus.emit('poll:voted', {
              pollId,
              optionId: '', // Would need to track which option was voted on
              userId,
              timestamp: Date.now(),
            });
          }
        }
      },

      // =====================================================================
      // Q&A Management
      // =====================================================================

      addQuestion: (question) => {
        set((state) => {
          state.questions.push(question);
          state.unreadCounts.questions += 1;
        });

        eventBus.emit('question:submitted', {
          question,
          timestamp: Date.now(),
        });
      },

      updateQuestion: (questionId, updates) => {
        const questionIndex = get().questions.findIndex((q) => q.id === questionId);
        if (questionIndex === -1) {
          console.warn(`Question with ID ${questionId} not found`);
          return;
        }

        set((state) => {
          const question = state.questions[questionIndex];
          state.questions[questionIndex] = { ...question, ...updates };
        });

        // Emit vote event if votes were updated
        if (updates.votes !== undefined) {
          const userId = get().userInfo?.id;
          if (userId) {
            eventBus.emit('question:voted', {
              questionId,
              userId,
              timestamp: Date.now(),
            });
          }
        }
      },

      // =====================================================================
      // Reactions Management
      // =====================================================================

      addReaction: (reaction) => {
        set((state) => {
          state.reactions.push(reaction);
          
          // Keep only last 50 reactions for performance
          if (state.reactions.length > 50) {
            state.reactions = state.reactions.slice(-50);
          }
        });

        eventBus.emit('reaction:sent', {
          reaction,
          timestamp: Date.now(),
        });
      },

      // =====================================================================
      // Hand Raising Management
      // =====================================================================

      raiseHand: (hand) => {
        set((state) => {
          state.raisedHands.set(hand.userId, hand);
        });

        eventBus.emit('hand:raised', {
          hand,
          timestamp: Date.now(),
        });
      },

      lowerHand: (userId) => {
        const hand = get().raisedHands.get(userId);
        if (!hand) return;

        set((state) => {
          state.raisedHands.delete(userId);
        });

        eventBus.emit('hand:lowered', {
          userId,
          timestamp: Date.now(),
        });
      },

      // =====================================================================
      // Unread Count Management
      // =====================================================================

      updateUnreadCounts: (counts) => {
        set((state) => {
          state.unreadCounts = { ...state.unreadCounts, ...counts };
        });

        // Emit unread count changes
        Object.entries(counts).forEach(([type, count]) => {
          if (type === 'messages') {
            eventBus.emit('chat:unread-count-changed', {
              count: count as number,
              timestamp: Date.now(),
            });
          }
        });
      },

      clearUnreadCount: (type) => {
        set((state) => {
          state.unreadCounts[type] = 0;
        });

        if (type === 'messages') {
          eventBus.emit('chat:unread-count-changed', {
            count: 0,
            timestamp: Date.now(),
          });
        }
      },
    }))
  )
);

// ============================================================================
// Message and Content Creation Utilities
// ============================================================================

/**
 * Create a new chat message
 */
export const createChatMessage = (
  text: string,
  userInfo: UserInfo,
  type: ChatMessage['type'] = 'text'
): ChatMessage => {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: userInfo.id,
    userName: userInfo.name,
    text,
    timestamp: Date.now(),
    type,
  };
};

/**
 * Create a new poll
 */
export const createPoll = (
  question: string,
  options: string[],
  userInfo: UserInfo,
  settings: {
    allowMultipleChoice?: boolean;
    anonymous?: boolean;
    expiresAt?: number;
  } = {}
): Poll => {
  return {
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
    allowMultipleChoice: settings.allowMultipleChoice ?? false,
    anonymous: settings.anonymous ?? false,
    expiresAt: settings.expiresAt,
    status: 'active',
  };
};

/**
 * Create a new question
 */
export const createQuestion = (
  text: string,
  userInfo: UserInfo
): Question => {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text,
    author: userInfo.name,
    authorId: userInfo.id,
    timestamp: Date.now(),
    votes: 0,
    voters: [],
    answered: false,
    status: 'pending',
  };
};

/**
 * Create a new emoji reaction
 */
export const createReaction = (
  emoji: string,
  userInfo: UserInfo,
  position?: { x: number; y: number }
): EmojiReaction => {
  return {
    id: `react_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: userInfo.id,
    userName: userInfo.name,
    emoji,
    timestamp: Date.now(),
    x: position?.x,
    y: position?.y,
  };
};

/**
 * Create a raised hand
 */
export const createRaisedHand = (
  userInfo: UserInfo,
  reason?: string
): RaisedHand => {
  return {
    userId: userInfo.id,
    userName: userInfo.name,
    timestamp: Date.now(),
    reason,
  };
};

// ============================================================================
// Selectors for Optimized Component Subscriptions
// ============================================================================

/**
 * Room ID selector
 */
export const useRoomId = () =>
  useRoomStore((state) => state.roomId);

/**
 * Current user info selector
 */
export const useUserInfo = () =>
  useRoomStore((state) => state.userInfo);

/**
 * Participants list selector
 */
export const useParticipants = () =>
  useRoomStore((state) => Array.from(state.participants.values()));

/**
 * Participant count selector
 */
export const useParticipantCount = () =>
  useRoomStore((state) => state.participants.size);

/**
 * Chat messages selector
 */
export const useChatMessages = () =>
  useRoomStore((state) => state.messages);

/**
 * Recent chat messages selector (last N messages)
 */
export const useRecentChatMessages = (count: number = 20) =>
  useRoomStore((state) => state.messages.slice(-count));

/**
 * Polls selector
 */
export const usePolls = () =>
  useRoomStore((state) => state.polls);

/**
 * Active polls selector
 */
export const useActivePolls = () =>
  useRoomStore((state) => state.polls.filter((poll) => poll.status === 'active'));

/**
 * Questions selector
 */
export const useQuestions = () =>
  useRoomStore((state) => state.questions);

/**
 * Pending questions selector
 */
export const usePendingQuestions = () =>
  useRoomStore((state) => 
    state.questions
      .filter((q) => q.status === 'pending')
      .sort((a, b) => b.votes - a.votes)
  );

/**
 * Recent reactions selector
 */
export const useRecentReactions = (seconds: number = 10) =>
  useRoomStore((state) => {
    const cutoff = Date.now() - seconds * 1000;
    return state.reactions.filter((reaction) => reaction.timestamp > cutoff);
  });

/**
 * Raised hands selector
 */
export const useRaisedHands = () =>
  useRoomStore((state) => 
    Array.from(state.raisedHands.values())
      .sort((a, b) => a.timestamp - b.timestamp)
  );

/**
 * Unread counts selector
 */
export const useUnreadCounts = () =>
  useRoomStore((state) => state.unreadCounts);

/**
 * Specific unread count selector
 */
export const useUnreadCount = (type: keyof RoomState['unreadCounts']) =>
  useRoomStore((state) => state.unreadCounts[type]);

/**
 * Room metadata selector
 */
export const useRoomMetadata = () =>
  useRoomStore((state) => state.metadata);

/**
 * Host status selector
 */
export const useIsHost = () =>
  useRoomStore((state) => {
    const { userInfo, metadata } = state;
    return userInfo?.role === 'Host' || userInfo?.id === metadata.hostId;
  });

/**
 * Room activity summary selector
 */
export const useRoomActivity = () =>
  useRoomStore((state) => ({
    participantCount: state.participants.size,
    messageCount: state.messages.length,
    pollCount: state.polls.length,
    questionCount: state.questions.length,
    activePolls: state.polls.filter((p) => p.status === 'active').length,
    pendingQuestions: state.questions.filter((q) => q.status === 'pending').length,
    raisedHands: state.raisedHands.size,
    unreadTotal: Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0),
  }));

// ============================================================================
// Store Subscriptions and Side Effects
// ============================================================================

// Subscribe to message additions for automatic cleanup
useRoomStore.subscribe(
  (state) => state.messages.length,
  (messageCount) => {
    // Clean up old messages if they exceed limit
    if (messageCount > 150) {
      const state = useRoomStore.getState();
      const trimmedMessages = state.messages.slice(-100);
      state.updateState({ messages: trimmedMessages });
    }
  }
);

// Subscribe to reaction additions for automatic cleanup
useRoomStore.subscribe(
  (state) => state.reactions.length,
  (reactionCount) => {
    // Clean up old reactions if they exceed limit
    if (reactionCount > 100) {
      const state = useRoomStore.getState();
      const trimmedReactions = state.reactions.slice(-50);
      state.updateState({ reactions: trimmedReactions });
    }
  }
);

export default useRoomStore;