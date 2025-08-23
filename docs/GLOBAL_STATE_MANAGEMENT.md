# Global State Management System

This document provides a comprehensive guide to the lightweight global state management solution implemented for the decentralized video chat application.

## Overview

The global state management system replaces over 70 individual `useState` calls in the original Room.jsx component with a centralized, type-safe, and performant state solution using:

- **Zustand** for lightweight state management
- **TypeScript** for complete type safety
- **Custom Event Bus** for decoupled component communication
- **React Context** for application-wide state access
- **Optimized selectors** for performance

## Architecture

### Core Components

```
src/
├── types/index.ts                 # Complete TypeScript definitions
├── utils/EventBus.ts             # Type-safe event bus system
├── stores/                       # Zustand store modules
│   ├── connectionStore.ts        # WebRTC & Socket.io management
│   ├── mediaStore.ts            # Media devices & streams
│   ├── roomStore.ts             # Room state & engagement
│   ├── uiStore.ts               # UI state & preferences
│   └── index.ts                 # Unified exports & utilities
├── hooks/
│   └── useGlobalState.ts        # Integration hooks
└── providers/
    └── GlobalStateProvider.tsx  # React Context wrapper
```

## Store Modules

### 1. Connection Store (`connectionStore.ts`)

Manages WebRTC peer connections and Socket.io communication.

**State:**
- Socket instance and connection status
- Peer connections map with metadata
- Connection quality metrics
- Reconnection state and attempts

**Key Actions:**
```typescript
const { connection } = useStoreActions();

// Socket management
connection.setSocket(socket);
connection.setStatus('connected');

// Peer management
connection.addPeer(peerConnection);
connection.updatePeer(peerId, updates);
connection.removePeer(peerId);

// Quality monitoring
connection.updateQuality({ bandwidth: 1000000, latency: 50 });
```

**Selectors:**
```typescript
const status = useConnectionStatus();
const peers = usePeers();
const quality = useConnectionQuality();
const health = useConnectionHealth();
```

### 2. Media Store (`mediaStore.ts`)

Handles local media streams, device management, and permissions.

**State:**
- Local media stream
- Audio/video settings and constraints
- Available devices (cameras, microphones)
- Screen sharing state
- Media permissions

**Key Actions:**
```typescript
const { media } = useStoreActions();

// Stream management
media.setLocalStream(stream);
media.toggleAudio(); // Returns new state
media.toggleVideo(); // Returns new state

// Screen sharing
media.startScreenShare(screenStream);
media.stopScreenShare();

// Device switching
await switchMediaDevice('video', deviceId);
```

**Selectors:**
```typescript
const stream = useLocalStream();
const audioEnabled = useAudioEnabled();
const videoEnabled = useVideoEnabled();
const devices = useMediaDevices();
const screenShare = useScreenShare();
```

### 3. Room Store (`roomStore.ts`)

Manages room state, participants, and engagement features.

**State:**
- Room ID and user information
- Participants map
- Chat messages, polls, Q&A questions
- Emoji reactions and raised hands
- Unread counts per feature

**Key Actions:**
```typescript
const { room } = useStoreActions();

// Room setup
room.setRoomId(roomId);
room.setUserInfo(userInfo);

// Messaging
room.addMessage(createChatMessage(text, userInfo));

// Engagement
room.addPoll(createPoll(question, options, userInfo));
room.addQuestion(createQuestion(text, userInfo));
room.addReaction(createReaction(emoji, userInfo));

// Hand raising
room.raiseHand(createRaisedHand(userInfo));
room.lowerHand(userId);

// Unread management
room.clearUnreadCount('messages');
```

**Selectors:**
```typescript
const messages = useChatMessages();
const polls = useActivePolls();
const questions = usePendingQuestions();
const reactions = useRecentReactions();
const unreadCounts = useUnreadCounts();
const activity = useRoomActivity();
```

### 4. UI Store (`uiStore.ts`)

Controls interface state, layout, and user preferences.

**State:**
- Layout configuration (grid, spotlight, etc.)
- Panel states (chat, polls, Q&A)
- Modal states (share, feedback, etc.)
- Theme and notification preferences
- Performance and accessibility settings

**Key Actions:**
```typescript
const { ui } = useStoreActions();

// Layout management
ui.setLayout({ preset: 'spotlight', gridColumns: 2 });

// Panel control
ui.togglePanel('chat');
ui.togglePanel('polls');

// Modal management
ui.toggleModal('shareModal');

// Preferences
ui.setTheme('dark');
ui.setPerformanceMode(true);
```

**Selectors:**
```typescript
const layout = useLayout();
const panelStates = usePanels();
const modalStates = useModals();
const theme = useTheme();
const performanceMode = usePerformanceMode();
```

## Event Bus System

### Type-Safe Event Communication

The event bus provides decoupled communication between components with full TypeScript support.

```typescript
// Event emission
eventBus.emit('peer:joined', { peer, timestamp: Date.now() });
eventBus.emit('chat:message-received', { message, timestamp: Date.now() });

// Event subscription
const unsubscribe = eventBus.on('connection:status-changed', ({ status }) => {
  console.log('Connection status changed:', status);
});

// Cleanup
unsubscribe();
```

### Event Categories

1. **Connection Events**: `connection:*`, `peer:*`
2. **Media Events**: `media:*`, `screen:*`
3. **UI Events**: `ui:*`
4. **Chat Events**: `chat:*`
5. **Engagement Events**: `reaction:*`, `poll:*`, `question:*`, `hand:*`
6. **System Events**: `system:*`

### Event Bus Features

- **Type Safety**: All events are typed with specific payload schemas
- **Performance Monitoring**: Built-in metrics for event frequency and latency
- **Error Handling**: Graceful handling of listener errors
- **Once Listeners**: Automatic cleanup for one-time events
- **Promise Integration**: `waitFor()` method for async event handling
- **Scoped Emitters**: Domain-specific event emitters
- **Development Tools**: Logging and debugging utilities

## React Integration

### Global State Provider

Wrap your application with the `GlobalStateProvider` for automatic state management:

```tsx
import { GlobalStateProvider } from './providers/GlobalStateProvider';

function App() {
  return (
    <GlobalStateProvider>
      <Router>
        <Routes>
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </Router>
    </GlobalStateProvider>
  );
}
```

### Component Usage

```tsx
import { useGlobalStateContext, useCurrentSession } from '../providers/GlobalStateProvider';

function MyComponent() {
  // Access global state
  const { globalState, actions } = useGlobalStateContext();
  const { roomId, userInfo, isReady } = useCurrentSession();
  
  // Use specific selectors for optimized re-renders
  const connectionStatus = useConnectionStatus();
  const chatMessages = useChatMessages();
  const layout = useLayout();
  
  // Actions
  const handleSendMessage = (text: string) => {
    actions.room.addMessage(createChatMessage(text, userInfo));
  };
  
  return (
    <div>
      {/* Your component JSX */}
    </div>
  );
}
```

### High-Level Hooks

```typescript
// Complete application state
const appState = useGlobalApplicationState(roomId, userInfo);

// Combined connection and media status
const callStatus = useCallStatus();

// Room engagement metrics
const engagement = useRoomEngagement();

// Interface state
const interfaceState = useInterfaceState();
```

## Migration Guide

### Before: Room.jsx (Original)

```jsx
// 70+ useState calls
const [stream, setStream] = useState(null);
const [peers, setPeers] = useState([]);
const [micOn, setMicOn] = useState(true);
const [camOn, setCamOn] = useState(true);
const [connectionStatus, setConnectionStatus] = useState('disconnected');
const [showChat, setShowChat] = useState(false);
const [showPolls, setShowPolls] = useState(false);
const [messages, setMessages] = useState([]);
// ... 60+ more useState calls

// Manual prop drilling
<Chat 
  messages={messages}
  onSendMessage={handleSendMessage}
  isOpen={showChat}
  onToggle={toggleChat}
  userInfo={userInfo}
/>
```

### After: Room Component (Migrated)

```tsx
// Global state access
const { globalState, actions } = useGlobalStateContext();
const { connection, engagement } = globalState;

// Optimized selectors
const connectionStatus = useConnectionStatus();
const messages = useChatMessages();
const chatOpen = usePanelState('chat');

// Simplified actions
const toggleChat = () => {
  actions.ui.togglePanel('chat');
  actions.room.clearUnreadCount('messages');
};

// No prop drilling
<Chat /> // Gets all state from global stores
```

## Performance Optimizations

### Selective Subscriptions

Components only re-render when their specific state slices change:

```typescript
// ✅ Only re-renders when connection status changes
const status = useConnectionStatus();

// ✅ Only re-renders when new messages arrive
const messageCount = useChatMessages().length;

// ❌ Re-renders on any room state change
const roomState = useRoomStore();
```

### Memoization and Batching

```typescript
// Automatic batching of related updates
actions.room.addMessage(message);
actions.room.updateUnreadCounts({ messages: count + 1 });
// ↑ Batched into single re-render

// Memoized selectors prevent unnecessary computations
const sortedQuestions = usePendingQuestions(); // Pre-sorted
const activity = useRoomActivity(); // Pre-computed metrics
```

### Performance Monitoring

```typescript
// Built-in performance tracking
const performance = usePerformanceOptimization();

// Automatic performance mode activation
if (renderTime > threshold) {
  actions.ui.setPerformanceMode(true);
}
```

## Type Safety

### Complete TypeScript Coverage

```typescript
// All state shapes are typed
interface ConnectionState {
  readonly socket: Socket | null;
  readonly status: ConnectionStatus;
  readonly quality: ConnectionQuality;
  readonly peers: Map<string, PeerConnection>;
  // ...
}

// Event payloads are typed
interface EventMap {
  'peer:joined': { peer: PeerConnection; timestamp: number };
  'chat:message-received': { message: ChatMessage; timestamp: number };
  // ...
}

// Actions have proper signatures
interface ConnectionActions {
  readonly setSocket: (socket: Socket | null) => void;
  readonly addPeer: (peer: PeerConnection) => void;
  // ...
}
```

### Runtime Type Validation

```typescript
// Events are validated at runtime in development
eventBus.emit('peer:joined', { 
  peer, 
  timestamp: Date.now() 
}); // ✅ Type-checked

eventBus.emit('peer:joined', { 
  peer 
}); // ❌ TypeScript error - missing timestamp
```

## Testing

### Store Testing

```typescript
import { useConnectionStore } from '../stores';

describe('Connection Store', () => {
  it('should manage peer connections', () => {
    const { result } = renderHook(() => useConnectionStore());
    
    act(() => {
      result.current.addPeer(mockPeer);
    });
    
    expect(result.current.peers.has('peer1')).toBe(true);
  });
});
```

### Event Bus Testing

```typescript
describe('Event Bus', () => {
  it('should emit and receive events', () => {
    const callback = vi.fn();
    eventBus.on('connection:status-changed', callback);
    
    eventBus.emit('connection:status-changed', { 
      status: 'connected', 
      timestamp: Date.now() 
    });
    
    expect(callback).toHaveBeenCalled();
  });
});
```

### Integration Testing

```typescript
describe('Store Integration', () => {
  it('should coordinate state between stores', () => {
    // Test cross-store interactions
    roomStore.addMessage(message);
    uiStore.togglePanel('chat');
    
    expect(roomStore.unreadCounts.messages).toBe(0);
  });
});
```

## Development Tools

### Browser DevTools Integration

In development mode, stores are available globally:

```javascript
// Browser console access
window.stores.connection.getState()
window.stores.media.getState()
window.stores.room.getState()
window.stores.ui.getState()

// Subscribe to changes
window.stores.subscribe((storeName, state) => {
  console.log(`${storeName} changed:`, state);
});
```

### Event Bus Debugging

```typescript
// Enable logging in development
const eventBus = new TypeSafeEventBus({
  enableLogging: true,
  logLevel: 'debug'
});

// View metrics
console.log(eventBus.getMetrics());
```

## Best Practices

### State Organization

1. **Single Source of Truth**: Each piece of state lives in exactly one store
2. **Normalized Data**: Use Maps for entity collections (peers, participants)
3. **Derived State**: Compute derived values in selectors, not stores
4. **Immutable Updates**: Use Immer for immutable state updates

### Component Design

1. **Selective Subscriptions**: Subscribe to specific state slices
2. **Action Coupling**: Group related actions together
3. **Event-Driven Architecture**: Use event bus for cross-component communication
4. **Error Boundaries**: Wrap state-dependent components in error boundaries

### Performance

1. **Memoization**: Use React.memo for expensive components
2. **Lazy Loading**: Load stores and components on demand
3. **Cleanup**: Properly clean up subscriptions and resources
4. **Monitoring**: Track render performance and optimize bottlenecks

### TypeScript Usage

1. **Strict Types**: Enable all strict TypeScript options
2. **Interface Segregation**: Keep interfaces focused and specific
3. **Utility Types**: Use utility types for common patterns
4. **Runtime Validation**: Add runtime checks in development

## Troubleshooting

### Common Issues

**Store not updating:**
- Check if actions are being called correctly
- Verify selectors are using the right store slice
- Ensure component is wrapped in provider

**Performance issues:**
- Use specific selectors instead of whole store state
- Check for unnecessary re-renders with React DevTools
- Enable performance mode for low-end devices

**Type errors:**
- Update TypeScript definitions when adding new state
- Use proper typing for event payloads
- Check middleware compatibility

**Event bus issues:**
- Verify event names match EventMap definitions
- Check if listeners are properly cleaned up
- Enable logging for debugging

### Debugging Steps

1. **Check Store State**: Use browser DevTools to inspect current state
2. **Monitor Events**: Enable event bus logging to track communications
3. **Profile Performance**: Use React DevTools Profiler
4. **Test in Isolation**: Create minimal reproductions of issues

## Future Enhancements

### Planned Features

1. **State Persistence**: Automatic state hydration and persistence
2. **Offline Support**: Queue actions when disconnected
3. **Time Travel Debugging**: Record and replay state changes
4. **Advanced Metrics**: Detailed performance and usage analytics
5. **Plugin System**: Extensible middleware architecture

### Migration Path

1. **Phase 1**: Core stores and event bus ✅
2. **Phase 2**: Component migration and testing ✅
3. **Phase 3**: Performance optimization and monitoring
4. **Phase 4**: Advanced features and tooling

## Conclusion

The global state management system provides a scalable, type-safe, and performant foundation for the video chat application. It eliminates prop drilling, reduces complexity, and improves maintainability while preserving the application's reactive nature.

Key benefits:
- **70+ useState calls** → **4 focused stores**
- **Complex prop drilling** → **Direct state access**
- **Manual synchronization** → **Automatic event coordination**
- **Runtime errors** → **Compile-time type safety**
- **Difficult testing** → **Isolated, testable units**

The system is designed to grow with the application while maintaining excellent developer experience and runtime performance.