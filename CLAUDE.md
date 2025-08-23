# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server (runs on http://localhost:5173)
- `npm run build` - Build for production
- `npm run lint` - Run ESLint with React-specific rules
- `npm run preview` - Preview production build

### Server Commands
- `node signaling-server.js` - Start WebRTC signaling server (port 5001)
- `npm run start:signaling` - Start signaling server via npm script

### Production Deployment
- `./scripts/deploy-production.sh` - Automated production deployment script
- `vercel --prod` - Deploy frontend to Vercel
- `railway up` - Deploy backend to Railway/Render

Both the signaling server and frontend dev server must be running for the application to work properly in development.

## Production URLs
- **Frontend**: https://decentralized-video-nvf0257p1-ralph-s-projects-676f1f6e.vercel.app
- **Backend**: https://decentralize-video-app-2.onrender.com
- **WebSocket**: wss://decentralize-video-app-2.onrender.com
- **Health Check**: https://decentralize-video-app-2.onrender.com/health

## Architecture Overview

This is a decentralized video chat application built with React and WebRTC. The architecture follows a peer-to-peer model with a signaling server for initial connection establishment.

### Core Components Architecture

**Room.jsx** (`src/components/Room.jsx`)
- Main orchestrator for video calls and WebRTC peer connections
- Manages Socket.io communication with signaling server
- Handles media stream acquisition, peer management, and chat integration
- Controls meeting state (mic/camera toggles, participants, layout switching)
- Implements error handling and reconnection logic
- Livestorm-inspired professional design with simplified UI
- Integrated side-panel chat and enhanced user experience

**SessionHeader.jsx** (`src/components/SessionHeader.jsx`) [NEW]
- Professional header replacing cluttered navigation
- Clean, minimalist design inspired by enterprise video platforms
- Centralized meeting controls and status indicators

**ShareModal.jsx** (`src/components/ShareModal.jsx`) [NEW]
- Professional room sharing mechanism
- QR code generation for quick room access
- Clipboard link copying with visual feedback

**FeedbackModal.jsx** (`src/components/FeedbackModal.jsx`) [NEW]
- Post-call feedback collection system
- Structured feedback form with rating and comment sections
- Seamless integration with session flow

**ConnectionStatus.jsx** (`src/components/ConnectionStatus.jsx`) [NEW]
- Real-time connection quality indicators
- Detailed network and stream performance metrics
- Proactive connection health notifications

**VideoChat.jsx** (`src/components/VideoChat.jsx`)
- Renders individual video streams with user info and connection status
- Handles video element lifecycle and stream binding
- Displays participant names and connection indicators

**VideoLayout.jsx** (`src/components/VideoLayout.jsx`)
- Advanced drag-and-drop video layout system using react-grid-layout
- Multiple layout presets (Grid, Podcast, Spotlight)
- Responsive design with customizable video positions

**Chat.jsx** (`src/components/Chat.jsx`)
- Real-time messaging with message history
- Unread message indicators and notification system
- Integrates with Socket.io for message persistence

### Signaling Server (`signaling-server.js`)
- WebRTC signaling server using Socket.io
- Manages room-based user connections and peer discovery
- Handles chat message persistence (last 100 messages per room)
- Supports user presence, hand-raising, and graceful disconnection

### Key Integration Points

**WebRTC Flow Details**:
1. User joins room → Socket.io signaling server
2. Peer discovery via 'all-users' and 'user-joined' events
3. WebRTC signaling (offer/answer) through Socket.io
4. Direct peer-to-peer media streaming via simple-peer

**Connection Establishment**:
1. Socket.io Signaling:
   - Connects to signaling server at `localhost:5001`
   - Sends user metadata (name, room ID)
   - Receives list of existing room participants

2. Peer Discovery Mechanism:
   - 'all-users' event retrieves existing participants
   - 'user-joined' event triggers new peer connection
   - Implements ICE candidate exchange for NAT traversal

3. Peer Connection Lifecycle:
   - Create RTCPeerConnection instance
   - Add local media streams
   - Negotiate connection via offer/answer
   - Handle connection state changes
   - Implement fallback STUN/TURN strategies

**Connection State Management**:
- Tracks peer connection states:
  - CONNECTING
  - CONNECTED
  - DISCONNECTED
  - FAILED

**State Management:**
- React hooks for local component state
- Socket.io events for real-time synchronization
- No global state management library used

**Error Handling:**
- ErrorBoundary component wraps the entire app
- Toast notifications for user feedback
- Robust reconnection logic in Room component
- Connection status indicators throughout UI
- Graceful degradation on connection failures
- Automatic reconnection attempts
- Detailed error logging

## Technology Stack Specifics

### Frontend
- **React 18** with advanced Concurrent Mode, Suspense, and optimized rendering
- **Vite** for high-performance build tooling and developer experience
- **Tailwind CSS** with professional design system and adaptive dark/light themes
- **react-router-dom** for advanced routing with code-splitting and lazy loading
- **react-hot-toast** with enhanced notification management and UX design
- **react-grid-layout** with Livestorm-inspired advanced video layout capabilities

### Design System and Philosophy
- **Design Principles**:
  - Enterprise-grade user interface
  - Minimalist and intuitive design language
  - Adaptive layouts with intelligent component positioning
  - Focus on user experience and interaction fluidity

- **UI/UX Design Inspiration**:
  1. Livestorm video conferencing platform
  2. Zoom's professional meeting interface
  3. Modern SaaS product design trends

### Deployment and Infrastructure
- **Frontend Deployment**:
  - **Vercel** for seamless frontend hosting
  - Global Content Delivery Network (CDN) integration
  - Automatic preview deployments for pull requests
  - Edge network optimization

- **Backend and Signaling Server**:
  - **Railway** for reliable and scalable hosting
  - Automatic deployment from GitHub
  - Built-in environment management
  - Easy scaling and resource allocation

- **Continuous Integration/Continuous Deployment (CI/CD)**:
  1. Automated testing on every commit
  2. Security vulnerability scanning
  3. Performance benchmarking
  4. Automatic staging and production deployments
  5. Rollback and canary release strategies

### Backend
- **Node.js** with Socket.io for signaling server
- **WebRTC** with **simple-peer** for peer connection management

### Performance & Optimization
- Custom React hooks for performance optimization
- WebRTC connection optimization techniques
- Memoization and lazy loading strategies

### Security
- JWT authentication
- Input sanitization
- XSS prevention mechanisms
- HTTPS and secure WebSocket connections

### Testing & Monitoring
- **Jest** for unit testing
- **Playwright** for E2E testing
- **Prometheus** and **Grafana** for performance monitoring
- Comprehensive test coverage (unit, integration, E2E)

## Development Notes

### Environment Setup
- Frontend runs on port 5173 (Vite default)
- Signaling server runs on port 5001
- CORS configured for localhost and production environments
- Environment variables managed via `.env` (copy from `env.example`)
- Docker and Kubernetes configurations for consistent deployment

### Recommended Development Environment
- **Node.js**: v18.x or higher (LTS)
- **npm**: 9.x or higher
- **Recommended IDE**: VSCode with:
  - ESLint integration
  - React DevTools
  - Socket.io debugging extensions
  - Performance profiling tools

### Development Workflows
- **Branch Strategy**: Feature branches with PR review process
- **Commit Guidelines**: Conventional commits
- **Continuous Integration**:
  - Automated testing on every PR
  - Security and performance scans
  - Deployment to staging environment

### Performance Optimization Workflow
1. Profile application using React DevTools
2. Identify performance bottlenecks
3. Apply custom hooks and memoization
4. Run performance tests
5. Monitor and iterate

### File Organization
- All React components in `src/components/`
- Global styles in `src/index.css` (Tailwind imports)
- Signaling server is a standalone Node.js file at project root

### Common Patterns
- Functional components with React hooks throughout
- Socket.io event handlers typically in useEffect hooks
- Error handling with try-catch and toast notifications
- Responsive design using Tailwind breakpoint classes

## Advanced Troubleshooting Guide

### WebRTC Connection Problems
- **Symptom**: No video/audio stream
- **Potential Causes**:
  - Browser compatibility
  - Firewall restrictions
  - Incorrect STUN/TURN server configuration
  - Network NAT traversal issues
- **Comprehensive Solutions**:
  1. Check browser console for specific errors
  2. Verify camera/microphone permissions
  3. Test on different networks
  4. Use WebRTC adapter for cross-browser compatibility
  5. Analyze ICE candidate negotiations
  6. Implement fallback TURN server strategies

### Performance Degradation Management
- **Symptoms**: 
  - Laggy video
  - High CPU/Memory usage
  - Inconsistent stream quality
- **Advanced Diagnostic Steps**:
  1. Use Prometheus metrics for real-time performance tracking
  2. Analyze Grafana dashboards for system resource utilization
  3. Review WebRTC peer connection statistics
  4. Implement adaptive bitrate streaming
  5. Use performance profiling tools (React DevTools)
  6. Optimize media stream configurations

### Signaling Server Connection Resilience
- **Robust Troubleshooting Approach**:
  - Confirm signaling server health via monitoring
  - Implement connection retry mechanisms
  - Validate Socket.io event handler robustness
  - Use distributed signaling server architecture
  - Implement circuit breaker patterns

## Dependency and Security Management

### Dependency Lifecycle
- **Update Strategy**:
  1. Minor updates: Monthly
  2. Major updates: Quarterly
  3. Security patches: Immediately

- **Security Best Practices**:
  1. Regularly run `npm audit`
  2. Use Dependabot for automated updates
  3. Maintain lockfiles in version control
  4. Periodic security vulnerability scans

### Security Monitoring
- Continuous integration security checks
- OWASP Top 10 compliance
- Regular penetration testing
- Automated vulnerability detection

### Performance Monitoring Guidelines
- Track key performance indicators:
  1. WebRTC connection establishment time
  2. Media stream quality metrics
  3. CPU and memory consumption
  4. Network latency
- Use Prometheus and Grafana for comprehensive monitoring

## Scalability Considerations
- Horizontal scaling via Kubernetes
- Load balancing strategies
- Efficient resource allocation
- Containerization best practices
- Multi-region deployment support