/**
 * Global State Provider - React Context wrapper for global state management
 * Provides application-wide state access and event bus integration
 */

import React, { createContext, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { eventBus } from '../utils/EventBus';
import { useGlobalApplicationState } from '../hooks/useGlobalState';
import { initializeStores, cleanupStores } from '../stores';
import type { UserInfo, EventCallback } from '../types';

// ============================================================================
// Context Types and Interfaces
// ============================================================================

interface GlobalStateContextType {
  // Application state
  isInitialized: boolean;
  isReady: boolean;
  hasError: boolean;
  
  // Current session info
  roomId: string | null;
  userInfo: UserInfo | null;
  
  // State management hooks
  globalState: ReturnType<typeof useGlobalApplicationState>;
  
  // Actions
  initializeApp: (userInfo: UserInfo) => Promise<void>;
  leaveRoom: () => Promise<void>;
  handleError: (error: Error, context?: string) => void;
}

// ============================================================================
// Context Creation
// ============================================================================

const GlobalStateContext = createContext<GlobalStateContextType | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface GlobalStateProviderProps {
  children: ReactNode;
  defaultUserInfo?: UserInfo;
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = ({
  children,
  defaultUserInfo,
}) => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  // Get or create user info
  const [userInfo, setUserInfo] = React.useState<UserInfo | null>(() => {
    if (defaultUserInfo) return defaultUserInfo;
    
    // Try to get user info from localStorage
    const savedUserInfo = localStorage.getItem('userInfo');
    if (savedUserInfo) {
      try {
        return JSON.parse(savedUserInfo);
      } catch {
        // Invalid data, will create new user info
      }
    }
    
    // Create default user info
    const defaultUser: UserInfo = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: localStorage.getItem('userName') || `User${Math.floor(Math.random() * 1000)}`,
      role: 'Participant',
      joinedAt: Date.now(),
    };
    
    localStorage.setItem('userInfo', JSON.stringify(defaultUser));
    return defaultUser;
  });

  // Application state
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  // Global state hook
  const globalState = useGlobalApplicationState(roomId, userInfo);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  // Handle system errors
  const handleSystemError = useCallback<EventCallback<'system:error'>>(
    ({ error, context }) => {
      console.error(`System error in ${context}:`, error);
      setHasError(true);
      
      // Show user-friendly error message
      let userMessage = 'An unexpected error occurred';
      
      if (context?.includes('connection')) {
        userMessage = 'Connection failed. Please check your network.';
      } else if (context?.includes('media')) {
        userMessage = 'Unable to access camera or microphone.';
      } else if (context?.includes('peer')) {
        userMessage = 'Failed to connect to another participant.';
      }
      
      toast.error(userMessage);
      
      // Log to external service (if configured)
      if (import.meta.env.VITE_ERROR_REPORTING_URL) {
        // Send error to reporting service
        fetch(import.meta.env.VITE_ERROR_REPORTING_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: error.message,
            stack: error.stack,
            context,
            userId: userInfo?.id,
            roomId,
            timestamp: Date.now(),
          }),
        }).catch(console.warn);
      }
    },
    [userInfo, roomId]
  );

  // Handle connection status changes
  const handleConnectionStatusChange = useCallback<EventCallback<'connection:status-changed'>>(
    ({ status }) => {
      switch (status) {
        case 'connected':
          toast.success('Connected successfully');
          setHasError(false);
          break;
        case 'connecting':
          toast.loading('Connecting...', { id: 'connection-status' });
          break;
        case 'disconnected':
          toast.dismiss('connection-status');
          toast.error('Disconnected');
          break;
        case 'reconnecting':
          toast.loading('Reconnecting...', { id: 'connection-status' });
          break;
        case 'error':
        case 'failed':
          toast.dismiss('connection-status');
          toast.error('Connection failed');
          setHasError(true);
          break;
      }
    },
    []
  );

  // Handle UI notifications
  const handleUINotification = useCallback<EventCallback<'ui:notification'>>(
    ({ type, message }) => {
      switch (type) {
        case 'success':
          toast.success(message);
          break;
        case 'error':
          toast.error(message);
          break;
        case 'warning':
          toast((t) => (
            <div className="flex items-center">
              <span className="text-yellow-600 mr-2">⚠️</span>
              <span>{message}</span>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          ));
          break;
        case 'info':
        default:
          toast(message);
          break;
      }
    },
    []
  );

  // Set up global event listeners
  useEffect(() => {
    const unsubscribers = [
      eventBus.on('system:error', handleSystemError),
      eventBus.on('connection:status-changed', handleConnectionStatusChange),
      eventBus.on('ui:notification', handleUINotification),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [handleSystemError, handleConnectionStatusChange, handleUINotification]);

  // ============================================================================
  // Initialization and Cleanup
  // ============================================================================

  const initializeApp = useCallback(
    async (newUserInfo: UserInfo) => {
      if (!roomId) {
        throw new Error('Room ID is required for initialization');
      }

      try {
        setIsInitialized(false);
        setHasError(false);
        
        // Update user info
        setUserInfo(newUserInfo);
        localStorage.setItem('userInfo', JSON.stringify(newUserInfo));
        
        // Initialize all stores
        await initializeStores(roomId, newUserInfo);
        
        setIsInitialized(true);
        
        eventBus.emit('ui:notification', {
          type: 'success',
          message: `Joined room ${roomId}`,
          timestamp: Date.now(),
        });
        
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setHasError(true);
        
        eventBus.emit('system:error', {
          error: error as Error,
          context: 'app-initialization',
          timestamp: Date.now(),
        });
        
        throw error;
      }
    },
    [roomId]
  );

  const leaveRoom = useCallback(async () => {
    try {
      // Emit leaving event
      eventBus.emit('room:leaving', {
        userId: userInfo?.id || 'unknown',
        timestamp: Date.now(),
      });
      
      // Clean up all resources
      cleanupStores();
      
      // Show farewell message
      toast.success('Left room successfully');
      
      // Navigate to home
      navigate('/');
      
    } catch (error) {
      console.error('Error leaving room:', error);
      
      eventBus.emit('system:error', {
        error: error as Error,
        context: 'room-leave',
        timestamp: Date.now(),
      });
      
      // Force navigation anyway
      navigate('/');
    }
  }, [userInfo, navigate]);

  const handleError = useCallback(
    (error: Error, context?: string) => {
      eventBus.emit('system:error', {
        error,
        context: context || 'unknown',
        timestamp: Date.now(),
      });
    },
    []
  );

  // Auto-initialize when roomId and userInfo are available
  useEffect(() => {
    if (roomId && userInfo && !isInitialized && !hasError) {
      initializeApp(userInfo).catch(console.error);
    }
  }, [roomId, userInfo, isInitialized, hasError, initializeApp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupStores();
    };
  }, []);

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: GlobalStateContextType = {
    // Application state
    isInitialized,
    isReady: isInitialized && globalState.isReady,
    hasError,
    
    // Current session
    roomId: roomId || null,
    userInfo,
    
    // Global state hook
    globalState,
    
    // Actions
    initializeApp,
    leaveRoom,
    handleError,
  };

  return (
    <GlobalStateContext.Provider value={contextValue}>
      {children}
    </GlobalStateContext.Provider>
  );
};

// ============================================================================
// Hook for Using Context
// ============================================================================

/**
 * Hook to access the global state context
 */
export const useGlobalStateContext = (): GlobalStateContextType => {
  const context = useContext(GlobalStateContext);
  
  if (!context) {
    throw new Error(
      'useGlobalStateContext must be used within a GlobalStateProvider'
    );
  }
  
  return context;
};

// ============================================================================
// Specific State Hooks
// ============================================================================

/**
 * Hook for accessing current room and user information
 */
export const useCurrentSession = () => {
  const { roomId, userInfo, isReady } = useGlobalStateContext();
  
  return {
    roomId,
    userInfo,
    isReady,
    isInRoom: !!roomId,
    isAuthenticated: !!userInfo,
  };
};

/**
 * Hook for accessing application readiness state
 */
export const useAppReadiness = () => {
  const { isInitialized, isReady, hasError } = useGlobalStateContext();
  
  return {
    isInitialized,
    isReady,
    hasError,
    isLoading: !isInitialized && !hasError,
  };
};

/**
 * Hook for accessing global actions
 */
export const useGlobalActions = () => {
  const { initializeApp, leaveRoom, handleError, globalState } = useGlobalStateContext();
  
  return {
    // App-level actions
    initializeApp,
    leaveRoom,
    handleError,
    
    // Store actions
    ...globalState.actions,
  };
};

// ============================================================================
// Higher-Order Component
// ============================================================================

/**
 * HOC that wraps a component with global state context
 */
export const withGlobalState = <P extends object>(
  Component: React.ComponentType<P>
) => {
  const WrappedComponent = (props: P) => (
    <GlobalStateProvider>
      <Component {...props} />
    </GlobalStateProvider>
  );
  
  WrappedComponent.displayName = `withGlobalState(${
    Component.displayName || Component.name
  })`;
  
  return WrappedComponent;
};

// ============================================================================
// Development Utilities
// ============================================================================

if (process.env.NODE_ENV === 'development') {
  // Make context available globally for debugging
  (window as any).GlobalStateContext = GlobalStateContext;
  (window as any).eventBus = eventBus;
}

export default GlobalStateProvider;