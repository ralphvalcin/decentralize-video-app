/**
 * Connection Store - WebRTC and Socket.io connection management
 * Handles peer connections, socket state, and connection quality monitoring
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Socket } from 'socket.io-client';
import type {
  ConnectionStore,
  ConnectionState,
  ConnectionActions,
  PeerConnection,
  ConnectionStatus,
  ConnectionQuality,
} from '../types';
import { eventBus } from '../utils/EventBus';

/**
 * Initial connection state
 */
const initialState: ConnectionState = {
  socket: null,
  status: 'disconnected',
  quality: { status: 'poor' },
  peers: new Map(),
  reconnectAttempts: 0,
  lastConnectedAt: undefined,
  isReconnecting: false,
};

/**
 * Connection store with comprehensive WebRTC and socket management
 */
export const useConnectionStore = create<ConnectionStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // =====================================================================
      // Core Actions
      // =====================================================================

      reset: () => {
        set((state) => {
          // Clean up existing connections
          state.peers.forEach((peer) => {
            try {
              if (peer.peer && !peer.peer.destroyed) {
                peer.peer.destroy();
              }
            } catch (error) {
              console.warn('Error cleaning up peer connection:', error);
            }
          });

          // Reset to initial state
          Object.assign(state, initialState);
        });

        eventBus.emit('system:cleanup', { timestamp: Date.now() });
      },

      updateState: (updates) => {
        set((state) => {
          Object.assign(state, updates);
        });
      },

      // =====================================================================
      // Socket Management
      // =====================================================================

      setSocket: (socket) => {
        set((state) => {
          state.socket = socket;
          
          if (socket) {
            state.status = 'connecting';
            
            // Set up socket event listeners
            socket.on('connect', () => {
              state.status = 'connected';
              state.lastConnectedAt = Date.now();
              state.reconnectAttempts = 0;
              state.isReconnecting = false;
              
              eventBus.emit('connection:status-changed', {
                status: 'connected',
                timestamp: Date.now(),
              });
            });

            socket.on('disconnect', () => {
              state.status = 'disconnected';
              
              eventBus.emit('connection:status-changed', {
                status: 'disconnected',
                timestamp: Date.now(),
              });
            });

            socket.on('connect_error', (error) => {
              state.status = 'error';
              state.isReconnecting = true;
              
              eventBus.emit('system:error', {
                error: new Error(`Socket connection error: ${error.message}`),
                context: 'socket-connection',
                timestamp: Date.now(),
              });
            });

            socket.on('reconnect', () => {
              state.status = 'connected';
              state.isReconnecting = false;
              state.reconnectAttempts = 0;
            });

            socket.on('reconnecting', (attemptNumber) => {
              state.status = 'reconnecting';
              state.isReconnecting = true;
              state.reconnectAttempts = attemptNumber;
            });

            socket.on('reconnect_failed', () => {
              state.status = 'failed';
              state.isReconnecting = false;
            });
          } else {
            state.status = 'disconnected';
          }
        });
      },

      setStatus: (status) => {
        const prevStatus = get().status;
        if (prevStatus === status) return;

        set((state) => {
          state.status = status;
        });

        eventBus.emit('connection:status-changed', {
          status,
          timestamp: Date.now(),
        });
      },

      // =====================================================================
      // Connection Quality Management
      // =====================================================================

      updateQuality: (qualityUpdates) => {
        set((state) => {
          state.quality = { ...state.quality, ...qualityUpdates };
        });

        const { quality } = get();
        eventBus.emit('connection:quality-changed', {
          quality,
          timestamp: Date.now(),
        });
      },

      // =====================================================================
      // Peer Connection Management
      // =====================================================================

      addPeer: (peer) => {
        const existingPeer = get().peers.get(peer.peerID);
        if (existingPeer) {
          console.warn(`Peer ${peer.peerID} already exists, updating instead`);
          get().updatePeer(peer.peerID, peer);
          return;
        }

        set((state) => {
          state.peers.set(peer.peerID, peer);
        });

        // Set up peer event listeners
        peer.peer.on('connect', () => {
          get().updatePeer(peer.peerID, { connectionState: 'connected' });
        });

        peer.peer.on('close', () => {
          get().updatePeer(peer.peerID, { connectionState: 'closed' });
        });

        peer.peer.on('error', (error) => {
          console.error(`Peer ${peer.peerID} error:`, error);
          get().updatePeer(peer.peerID, { connectionState: 'failed' });
          
          eventBus.emit('system:error', {
            error: new Error(`Peer connection error: ${error.message || error}`),
            context: `peer-${peer.peerID}`,
            timestamp: Date.now(),
          });
        });

        peer.peer.on('stream', (stream) => {
          get().updatePeer(peer.peerID, { stream });
          
          eventBus.emit('peer:stream-updated', {
            peerID: peer.peerID,
            stream,
            timestamp: Date.now(),
          });
        });

        eventBus.emit('peer:joined', { peer, timestamp: Date.now() });
      },

      removePeer: (peerID) => {
        const peer = get().peers.get(peerID);
        if (!peer) {
          console.warn(`Attempted to remove non-existent peer: ${peerID}`);
          return;
        }

        // Clean up peer connection
        try {
          if (peer.peer && !peer.peer.destroyed) {
            peer.peer.destroy();
          }
        } catch (error) {
          console.warn(`Error destroying peer ${peerID}:`, error);
        }

        set((state) => {
          state.peers.delete(peerID);
        });

        eventBus.emit('peer:left', {
          peerID,
          name: peer.name,
          timestamp: Date.now(),
        });
      },

      updatePeer: (peerID, updates) => {
        const currentPeer = get().peers.get(peerID);
        if (!currentPeer) {
          console.warn(`Attempted to update non-existent peer: ${peerID}`);
          return;
        }

        const updatedPeer = { ...currentPeer, ...updates };

        set((state) => {
          state.peers.set(peerID, updatedPeer);
        });

        // Emit stream update event if stream changed
        if (updates.stream && updates.stream !== currentPeer.stream) {
          eventBus.emit('peer:stream-updated', {
            peerID,
            stream: updates.stream,
            timestamp: Date.now(),
          });
        }
      },

      // =====================================================================
      // Reconnection Management
      // =====================================================================

      incrementReconnectAttempts: () => {
        set((state) => {
          state.reconnectAttempts += 1;
        });
      },

      resetReconnectAttempts: () => {
        set((state) => {
          state.reconnectAttempts = 0;
        });
      },
    }))
  )
);

// ============================================================================
// Selectors for Optimized Component Subscriptions
// ============================================================================

/**
 * Connection status selector
 */
export const useConnectionStatus = () =>
  useConnectionStore((state) => state.status);

/**
 * Connection quality selector
 */
export const useConnectionQuality = () =>
  useConnectionStore((state) => state.quality);

/**
 * Peers list selector
 */
export const usePeers = () =>
  useConnectionStore((state) => Array.from(state.peers.values()));

/**
 * Specific peer selector
 */
export const usePeer = (peerID: string) =>
  useConnectionStore((state) => state.peers.get(peerID));

/**
 * Peer count selector
 */
export const usePeerCount = () =>
  useConnectionStore((state) => state.peers.size);

/**
 * Socket instance selector
 */
export const useSocket = () =>
  useConnectionStore((state) => state.socket);

/**
 * Reconnection state selector
 */
export const useReconnectionState = () =>
  useConnectionStore((state) => ({
    isReconnecting: state.isReconnecting,
    attempts: state.reconnectAttempts,
  }));

/**
 * Connection health selector - derived state
 */
export const useConnectionHealth = () =>
  useConnectionStore((state) => {
    const { status, quality, peers, reconnectAttempts } = state;
    
    let health: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';
    
    if (status === 'connected') {
      if (quality.status === 'excellent' || quality.status === 'good') {
        health = 'healthy';
      } else if (quality.status === 'fair') {
        health = 'degraded';
      }
    } else if (status === 'reconnecting' && reconnectAttempts < 3) {
      health = 'degraded';
    }
    
    return {
      health,
      status,
      quality,
      peerCount: peers.size,
      reconnectAttempts,
    };
  });

// ============================================================================
// Store Subscriptions and Side Effects
// ============================================================================

// Subscribe to connection status changes for automatic quality monitoring
useConnectionStore.subscribe(
  (state) => state.status,
  (status, prevStatus) => {
    if (status === 'connected' && prevStatus !== 'connected') {
      // Start connection quality monitoring
      const monitorInterval = setInterval(() => {
        const currentStatus = useConnectionStore.getState().status;
        if (currentStatus !== 'connected') {
          clearInterval(monitorInterval);
          return;
        }

        // Monitor connection quality
        // This would integrate with WebRTC stats API in a real implementation
        const store = useConnectionStore.getState();
        if (store.peers.size > 0) {
          // Update quality based on peer connections
          // Simplified example - in reality, you'd gather actual WebRTC stats
          store.updateQuality({
            status: 'good',
            bandwidth: 1000000, // 1 Mbps example
            latency: 50,
          });
        }
      }, 5000);
    }
  }
);

export default useConnectionStore;