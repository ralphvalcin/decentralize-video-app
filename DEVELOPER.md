# Decentralized Video Chat: Developer Guide

## Architecture Overview

### System Design
Our decentralized video chat application is built with a peer-to-peer architecture, leveraging WebRTC for direct media streaming and Socket.io for signaling and coordination.

#### Key Components
- **Frontend**: React 18 with Vite
- **Signaling**: Node.js Socket.io server
- **WebRTC**: Peer-to-peer media streaming
- **State Management**: React Hooks
- **Styling**: Tailwind CSS

### Performance Architecture
- Custom performance optimization hooks
- Memoization strategies
- Lazy loading components
- WebRTC connection optimizations

## Custom Hooks

### useOptimizedRoom
Manages room state and WebRTC connections with advanced performance considerations.

```javascript
const { 
  peers, 
  localStream, 
  joinRoom, 
  leaveRoom 
} = useOptimizedRoom(roomId);
```

### usePeerConnection
Handles WebRTC peer connection lifecycle with robust error handling.

```javascript
const { 
  connect, 
  disconnect, 
  connectionState 
} = usePeerConnection(peerId);
```

## WebRTC Connection Flow
1. Socket.io signaling
2. ICE candidate exchange
3. Peer discovery
4. Direct media streaming
5. Fallback STUN/TURN strategies

## Testing Strategies
- Unit Testing: Jest
- Integration Testing: React Testing Library
- E2E Testing: Playwright
- Performance Testing: Custom performance audit scripts

## Optimization Techniques
- Minimize re-renders with React.memo
- Use useCallback for event handlers
- Implement lazy loading for components
- Adaptive bitrate streaming
- Efficient media stream management

## Contributing Guidelines
1. Fork the repository
2. Create feature branch
3. Write tests
4. Implement feature
5. Run performance and security audits
6. Submit pull request

## Local Development Setup
1. Clone repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`
4. Start development servers:
   - Frontend: `npm run dev`
   - Signaling server: `npm run start:server`
5. Run tests: `npm test`

## Recommended Tools
- React DevTools
- WebRTC adapter
- Performance profilers
- Socket.io debugging extensions

## Security Considerations
- Always sanitize inputs
- Use HTTPS and secure WebSocket
- Implement rate limiting
- Regular dependency updates
- Follow OWASP security guidelines