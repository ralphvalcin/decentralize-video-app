/**
 * Global State Management Test Suite
 * Comprehensive tests for stores, event bus, and integration
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { TypeSafeEventBus } from '../utils/EventBus';
import {
  useConnectionStore,
  useMediaStore,
  useRoomStore,
  useUIStore,
} from '../stores';
import type {
  UserInfo,
  PeerConnection,
  ChatMessage,
  Poll,
  MediaSettings,
  LayoutConfig,
} from '../types';

// Mock WebRTC APIs
global.MediaStream = vi.fn(() => ({
  getTracks: vi.fn(() => []),
  getAudioTracks: vi.fn(() => []),
  getVideoTracks: vi.fn(() => []),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
})) as any;

global.RTCPeerConnection = vi.fn() as any;

// Mock navigator APIs
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn(),
    enumerateDevices: vi.fn(),
    getDisplayMedia: vi.fn(),
  },
});

// ============================================================================
// Event Bus Tests
// ============================================================================

describe('TypeSafeEventBus', () => {
  let eventBus: TypeSafeEventBus;

  beforeEach(() => {
    eventBus = new TypeSafeEventBus({ enableLogging: false });
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('should emit and receive events with type safety', () => {
    const callback = vi.fn();
    
    eventBus.on('connection:status-changed', callback);
    eventBus.emit('connection:status-changed', { 
      status: 'connected', 
      timestamp: Date.now() 
    });

    expect(callback).toHaveBeenCalledWith({
      status: 'connected',
      timestamp: expect.any(Number),
    });
  });

  it('should handle multiple listeners for the same event', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    eventBus.on('ui:notification', callback1);
    eventBus.on('ui:notification', callback2);

    const eventData = {
      type: 'info' as const,
      message: 'Test notification',
      timestamp: Date.now(),
    };

    eventBus.emit('ui:notification', eventData);

    expect(callback1).toHaveBeenCalledWith(eventData);
    expect(callback2).toHaveBeenCalledWith(eventData);
  });

  it('should remove listeners correctly', () => {
    const callback = vi.fn();
    
    const unsubscribe = eventBus.on('peer:joined', callback);
    unsubscribe();

    eventBus.emit('peer:joined', {
      peer: {} as PeerConnection,
      timestamp: Date.now(),
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle once listeners', () => {
    const callback = vi.fn();
    
    eventBus.once('system:error', callback);

    const errorData = {
      error: new Error('Test error'),
      context: 'test',
      timestamp: Date.now(),
    };

    // Emit twice
    eventBus.emit('system:error', errorData);
    eventBus.emit('system:error', errorData);

    // Should only be called once
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should track metrics when enabled', () => {
    const eventBusWithMetrics = new TypeSafeEventBus({ 
      enableMetrics: true,
      enableLogging: false,
    });

    eventBusWithMetrics.emit('ui:notification', {
      type: 'info',
      message: 'Test',
      timestamp: Date.now(),
    });

    const metrics = eventBusWithMetrics.getMetrics();
    expect(metrics.totalEvents).toBe(1);
    expect(metrics.eventCounts.get('ui:notification')).toBe(1);
  });

  it('should handle error in listeners gracefully', () => {
    const errorCallback = vi.fn(() => {
      throw new Error('Callback error');
    });
    const goodCallback = vi.fn();

    eventBus.on('connection:status-changed', errorCallback);
    eventBus.on('connection:status-changed', goodCallback);

    // Should not throw
    expect(() => {
      eventBus.emit('connection:status-changed', {
        status: 'connected',
        timestamp: Date.now(),
      });
    }).not.toThrow();

    expect(goodCallback).toHaveBeenCalled();
  });

  it('should support waiting for events with timeout', async () => {
    const promise = eventBus.waitFor('peer:joined', 1000);

    setTimeout(() => {
      eventBus.emit('peer:joined', {
        peer: {} as PeerConnection,
        timestamp: Date.now(),
      });
    }, 100);

    const result = await promise;
    expect(result.timestamp).toBeTypeOf('number');
  });

  it('should timeout when waiting for events', async () => {
    const promise = eventBus.waitFor('peer:joined', 100);

    await expect(promise).rejects.toThrow('timeout after 100ms');
  });
});

// ============================================================================
// Connection Store Tests
// ============================================================================

describe('Connection Store', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset();
  });

  it('should initialize with correct default state', () => {
    const state = useConnectionStore.getState();
    
    expect(state.socket).toBeNull();
    expect(state.status).toBe('disconnected');
    expect(state.peers.size).toBe(0);
    expect(state.reconnectAttempts).toBe(0);
  });

  it('should update connection status', () => {
    const { result } = renderHook(() => useConnectionStore());
    
    act(() => {
      result.current.setStatus('connecting');
    });

    expect(result.current.status).toBe('connecting');
  });

  it('should manage peers correctly', () => {
    const { result } = renderHook(() => useConnectionStore());
    
    const mockPeer: PeerConnection = {
      peerID: 'peer1',
      peer: {} as any,
      name: 'Test User',
      role: 'Participant',
      signaled: false,
      connectionState: 'connecting',
      joinedAt: Date.now(),
    };

    act(() => {
      result.current.addPeer(mockPeer);
    });

    expect(result.current.peers.has('peer1')).toBe(true);
    expect(result.current.peers.get('peer1')).toEqual(mockPeer);

    act(() => {
      result.current.updatePeer('peer1', { connectionState: 'connected' });
    });

    expect(result.current.peers.get('peer1')?.connectionState).toBe('connected');

    act(() => {
      result.current.removePeer('peer1');
    });

    expect(result.current.peers.has('peer1')).toBe(false);
  });

  it('should handle connection quality updates', () => {
    const { result } = renderHook(() => useConnectionStore());
    
    act(() => {
      result.current.updateQuality({
        status: 'good',
        bandwidth: 1000000,
        latency: 50,
      });
    });

    expect(result.current.quality).toEqual({
      status: 'good',
      bandwidth: 1000000,
      latency: 50,
    });
  });
});

// ============================================================================
// Media Store Tests
// ============================================================================

describe('Media Store', () => {
  beforeEach(() => {
    useMediaStore.getState().reset();
  });

  it('should initialize with correct default state', () => {
    const state = useMediaStore.getState();
    
    expect(state.localStream).toBeNull();
    expect(state.settings.video.enabled).toBe(true);
    expect(state.settings.audio.enabled).toBe(true);
    expect(state.screenShare.isSharing).toBe(false);
  });

  it('should update media settings', () => {
    const { result } = renderHook(() => useMediaStore());
    
    const newSettings: Partial<MediaSettings> = {
      video: { enabled: false, width: 1920, height: 1080 },
    };

    act(() => {
      result.current.updateSettings(newSettings);
    });

    expect(result.current.settings.video.enabled).toBe(false);
    expect(result.current.settings.video.width).toBe(1920);
    expect(result.current.settings.video.height).toBe(1080);
  });

  it('should manage screen sharing state', () => {
    const { result } = renderHook(() => useMediaStore());
    
    const mockStream = new MediaStream();

    act(() => {
      result.current.startScreenShare(mockStream);
    });

    expect(result.current.screenShare.isSharing).toBe(true);
    expect(result.current.screenShare.stream).toBe(mockStream);

    act(() => {
      result.current.stopScreenShare();
    });

    expect(result.current.screenShare.isSharing).toBe(false);
    expect(result.current.screenShare.stream).toBeUndefined();
  });

  it('should toggle audio and video', () => {
    const { result } = renderHook(() => useMediaStore());
    
    // Create mock stream with tracks
    const mockAudioTrack = {
      enabled: true,
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    const mockVideoTrack = {
      enabled: true,
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    const mockStream = {
      getTracks: vi.fn(() => [mockAudioTrack, mockVideoTrack]),
      getAudioTracks: vi.fn(() => [mockAudioTrack]),
      getVideoTracks: vi.fn(() => [mockVideoTrack]),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
    } as any;

    act(() => {
      result.current.setLocalStream(mockStream);
    });

    act(() => {
      const audioEnabled = result.current.toggleAudio();
      expect(audioEnabled).toBe(false);
      expect(mockAudioTrack.enabled).toBe(false);
    });

    act(() => {
      const videoEnabled = result.current.toggleVideo();
      expect(videoEnabled).toBe(false);
      expect(mockVideoTrack.enabled).toBe(false);
    });
  });
});

// ============================================================================
// Room Store Tests
// ============================================================================

describe('Room Store', () => {
  let mockUserInfo: UserInfo;

  beforeEach(() => {
    useRoomStore.getState().reset();
    mockUserInfo = {
      id: 'user1',
      name: 'Test User',
      role: 'Participant',
      joinedAt: Date.now(),
    };
  });

  it('should initialize with correct default state', () => {
    const state = useRoomStore.getState();
    
    expect(state.roomId).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.polls).toEqual([]);
    expect(state.questions).toEqual([]);
    expect(state.unreadCounts.messages).toBe(0);
  });

  it('should manage room and user info', () => {
    const { result } = renderHook(() => useRoomStore());
    
    act(() => {
      result.current.setRoomId('room123');
      result.current.setUserInfo(mockUserInfo);
    });

    expect(result.current.roomId).toBe('room123');
    expect(result.current.userInfo).toEqual(mockUserInfo);
    expect(result.current.participants.has('user1')).toBe(true);
  });

  it('should manage chat messages', () => {
    const { result } = renderHook(() => useRoomStore());
    
    const message: ChatMessage = {
      id: 'msg1',
      userId: 'user1',
      userName: 'Test User',
      text: 'Hello world',
      timestamp: Date.now(),
      type: 'text',
    };

    act(() => {
      result.current.addMessage(message);
    });

    expect(result.current.messages).toContain(message);
    expect(result.current.unreadCounts.messages).toBe(1);

    act(() => {
      result.current.clearUnreadCount('messages');
    });

    expect(result.current.unreadCounts.messages).toBe(0);
  });

  it('should manage polls', () => {
    const { result } = renderHook(() => useRoomStore());
    
    const poll: Poll = {
      id: 'poll1',
      question: 'Test question?',
      options: [
        { id: 'opt1', text: 'Option 1', votes: 0, voters: [] },
        { id: 'opt2', text: 'Option 2', votes: 0, voters: [] },
      ],
      createdBy: 'user1',
      createdAt: Date.now(),
      allowMultipleChoice: false,
      anonymous: false,
      status: 'active',
    };

    act(() => {
      result.current.addPoll(poll);
    });

    expect(result.current.polls).toContain(poll);
    expect(result.current.unreadCounts.polls).toBe(1);

    // Test poll update
    const updatedPoll = {
      ...poll,
      options: [
        { id: 'opt1', text: 'Option 1', votes: 1, voters: ['user1'] },
        { id: 'opt2', text: 'Option 2', votes: 0, voters: [] },
      ],
    };

    act(() => {
      result.current.updatePoll('poll1', { options: updatedPoll.options });
    });

    const storedPoll = result.current.polls.find(p => p.id === 'poll1');
    expect(storedPoll?.options[0].votes).toBe(1);
  });

  it('should manage raised hands', () => {
    const { result } = renderHook(() => useRoomStore());
    
    const raisedHand = {
      userId: 'user1',
      userName: 'Test User',
      timestamp: Date.now(),
      reason: 'Question',
    };

    act(() => {
      result.current.raiseHand(raisedHand);
    });

    expect(result.current.raisedHands.has('user1')).toBe(true);
    expect(result.current.raisedHands.get('user1')).toEqual(raisedHand);

    act(() => {
      result.current.lowerHand('user1');
    });

    expect(result.current.raisedHands.has('user1')).toBe(false);
  });
});

// ============================================================================
// UI Store Tests
// ============================================================================

describe('UI Store', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
  });

  it('should initialize with correct default state', () => {
    const state = useUIStore.getState();
    
    expect(state.layout.preset).toBe('grid');
    expect(state.panels.chat).toBe(false);
    expect(state.modals.shareModal).toBe(false);
    expect(state.theme).toBe('system');
  });

  it('should manage layout configuration', () => {
    const { result } = renderHook(() => useUIStore());
    
    const newLayout: Partial<LayoutConfig> = {
      preset: 'spotlight',
      gridColumns: 2,
      compactMode: true,
    };

    act(() => {
      result.current.setLayout(newLayout);
    });

    expect(result.current.layout.preset).toBe('spotlight');
    expect(result.current.layout.gridColumns).toBe(2);
    expect(result.current.layout.compactMode).toBe(true);
  });

  it('should toggle panels correctly', () => {
    const { result } = renderHook(() => useUIStore());
    
    act(() => {
      result.current.togglePanel('chat');
    });

    expect(result.current.panels.chat).toBe(true);

    act(() => {
      result.current.togglePanel('chat');
    });

    expect(result.current.panels.chat).toBe(false);
  });

  it('should manage modal states', () => {
    const { result } = renderHook(() => useUIStore());
    
    act(() => {
      result.current.toggleModal('shareModal');
    });

    expect(result.current.modals.shareModal).toBe(true);

    act(() => {
      result.current.toggleModal('feedbackModal');
    });

    expect(result.current.modals.shareModal).toBe(false); // Other modals close
    expect(result.current.modals.feedbackModal).toBe(true);
  });

  it('should manage theme settings', () => {
    const { result } = renderHook(() => useUIStore());
    
    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
  });

  it('should toggle performance mode with optimizations', () => {
    const { result } = renderHook(() => useUIStore());
    
    act(() => {
      result.current.setPerformanceMode(true);
    });

    expect(result.current.performanceMode).toBe(true);
    expect(result.current.layout.compactMode).toBe(true);
    expect(result.current.panels.reactions).toBe(false);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Store Integration', () => {
  beforeEach(() => {
    // Reset all stores
    useConnectionStore.getState().reset();
    useMediaStore.getState().reset();
    useRoomStore.getState().reset();
    useUIStore.getState().reset();
  });

  it('should coordinate state between stores', () => {
    const connectionStore = useConnectionStore.getState();
    const roomStore = useRoomStore.getState();
    const uiStore = useUIStore.getState();

    // Simulate joining a room
    act(() => {
      roomStore.setRoomId('room123');
      roomStore.setUserInfo({
        id: 'user1',
        name: 'Test User',
        role: 'Participant',
        joinedAt: Date.now(),
      });
      connectionStore.setStatus('connected');
    });

    // Verify coordinated state
    expect(roomStore.roomId).toBe('room123');
    expect(connectionStore.status).toBe('connected');

    // Test UI response to state changes
    act(() => {
      uiStore.togglePanel('chat');
      roomStore.addMessage({
        id: 'msg1',
        userId: 'user1',
        userName: 'Test User',
        text: 'Hello',
        timestamp: Date.now(),
        type: 'text',
      });
    });

    expect(uiStore.panels.chat).toBe(true);
    expect(roomStore.unreadCounts.messages).toBe(1);

    // Clear unread when chat is opened
    act(() => {
      roomStore.clearUnreadCount('messages');
    });

    expect(roomStore.unreadCounts.messages).toBe(0);
  });

  it('should handle error scenarios gracefully', () => {
    const connectionStore = useConnectionStore.getState();
    
    // Simulate connection error
    act(() => {
      connectionStore.setStatus('error');
    });

    expect(connectionStore.status).toBe('error');
    
    // Store should maintain consistent state even during errors
    expect(connectionStore.peers.size).toBe(0);
    expect(connectionStore.reconnectAttempts).toBe(0);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Store Performance', () => {
  it('should handle large numbers of messages efficiently', () => {
    const { result } = renderHook(() => useRoomStore());
    
    const startTime = performance.now();
    
    // Add 1000 messages
    act(() => {
      for (let i = 0; i < 1000; i++) {
        result.current.addMessage({
          id: `msg${i}`,
          userId: 'user1',
          userName: 'Test User',
          text: `Message ${i}`,
          timestamp: Date.now() + i,
          type: 'text',
        });
      }
    });
    
    const endTime = performance.now();
    
    // Should complete in reasonable time (< 100ms)
    expect(endTime - startTime).toBeLessThan(100);
    
    // Should maintain only last 100 messages for performance
    expect(result.current.messages.length).toBeLessThanOrEqual(100);
  });

  it('should handle rapid state updates without issues', () => {
    const { result } = renderHook(() => useConnectionStore());
    
    const startTime = performance.now();
    
    // Rapidly update connection quality
    act(() => {
      for (let i = 0; i < 100; i++) {
        result.current.updateQuality({
          bandwidth: 1000000 + i,
          latency: 50 + Math.random() * 10,
        });
      }
    });
    
    const endTime = performance.now();
    
    // Should handle rapid updates efficiently
    expect(endTime - startTime).toBeLessThan(50);
    expect(result.current.quality.bandwidth).toBeGreaterThan(1000000);
  });
});

export {};