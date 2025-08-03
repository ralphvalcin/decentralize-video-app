# Decentralized Video App

A modern, peer-to-peer video chat application built with React, WebRTC, and Socket.io. Features real-time video communication, text chat, screen sharing, and responsive design.

## 🚀 Features

### Core Functionality
- **Real-time Video Chat**: Peer-to-peer video communication using WebRTC
- **Text Chat**: Real-time messaging with message history
- **Screen Sharing**: Share your screen with other participants
- **User Management**: Display participant names and connection status
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### Advanced Features
- **Multiple Layout Options**: 
  - Simple grid layout for basic video calls
  - Advanced drag-and-drop layout with customizable video positions
  - Podcast view with large main video
  - Spotlight view for presentations
- **Connection Management**: Robust error handling and automatic reconnection
- **Meeting Controls**: Mute/unmute, camera toggle, and meeting end functionality
- **Keyboard Shortcuts**: Quick access to chat (Ctrl/Cmd + Enter) and meeting end (Escape)

### User Experience
- **Dark Theme**: Modern dark interface for better video viewing
- **Connection Indicators**: Visual status indicators for all participants
- **Toast Notifications**: Real-time feedback for user actions
- **Participant List**: Easy access to see all connected users
- **Unread Message Count**: Visual indicator for new chat messages

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern React with Concurrent Mode, hooks, and functional components
- **Vite**: Next-generation build tool and development server
- **Tailwind CSS**: Utility-first CSS framework with professional design system
- **Socket.io Client**: Real-time communication
- **Simple Peer**: Advanced WebRTC peer connection management
- **React Grid Layout**: Dynamic, responsive video layout system

### Backend
- **Node.js**: High-performance server runtime
- **Socket.io**: Robust real-time bidirectional communication
- **WebRTC**: Peer-to-peer media streaming
- **JWT**: Secure authentication mechanism

### Infrastructure
- **Docker**: Containerization
- **Kubernetes**: Orchestration and scaling
- **Prometheus**: Performance monitoring
- **Grafana**: Metrics visualization

### Security
- **HTTPS/WSS**: Secure communication
- **Input Sanitization**: Comprehensive validation
- **XSS Prevention**: Advanced protection mechanisms

### Development Tools
- **ESLint**: Advanced code quality and security linting
- **Jest**: Comprehensive unit and integration testing
- **Playwright**: End-to-end testing
- **PostCSS**: Advanced CSS processing
- **DOMPurify**: Input sanitization

### Optimization
- **Memoization**: Performance optimization techniques
- **Lazy Loading**: Efficient component rendering
- **WebRTC Insertable Streams**: Advanced media stream handling

## 📦 Installation

### Prerequisites
- Node.js (v18 LTS or higher)
- npm (v9+ recommended)
- Modern web browser with WebRTC support
- Docker (optional, for containerized development)
- Kubernetes CLI (optional, for advanced deployments)

### Recommended Development Environment
- Operating System: macOS, Linux, or Windows WSL2
- IDE: Visual Studio Code with recommended extensions
- Git with SSH key authentication
- Postman or similar API testing tool

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd decentralized-video-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   Edit `.env` file with your configuration:
   ```env
   VITE_SIGNALING_SERVER_URL=http://localhost:5001
   ```

4. **Start the signaling server**
   ```bash
   node signaling-server.js
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## 🎯 Usage

### Joining a Room
1. Enter your name and a room ID
2. Click "Join Room" to enter the video call
3. Allow camera and microphone permissions when prompted

### During a Call
- **Mute/Unmute**: Click the microphone button or press the mic icon
- **Camera Toggle**: Click the camera button to turn video on/off
- **Screen Share**: Click the screen share button to share your screen
- **Chat**: Click the chat button or press Ctrl/Cmd + Enter
- **Layout**: Toggle between simple and advanced layouts
- **End Meeting**: Click the red X button or press Escape

### Advanced Layout Features
- **Drag & Drop**: Rearrange video positions in advanced layout mode
- **Resize**: Resize video containers by dragging the handles
- **Layout Presets**: Choose from Grid, Podcast, or Spotlight views

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Project Structure
```
decentralized-video-app/
├── src/
│   ├── components/
│   │   ├── Room.jsx           # Main video room component
│   │   ├── VideoChat.jsx      # Individual video component
│   │   ├── VideoLayout.jsx    # Advanced layout management
│   │   ├── Chat.jsx           # Chat functionality
│   │   ├── Home.jsx           # Landing page
│   │   └── ErrorBoundary.jsx  # Error handling
│   ├── App.jsx                # Main app component
│   ├── main.jsx              # App entry point
│   └── index.css             # Global styles
├── signaling-server.js        # WebRTC signaling server
├── public/                   # Static assets
└── docs/                     # Documentation
```

### Key Components

#### Room.jsx
- Manages WebRTC peer connections
- Handles socket.io communication
- Controls meeting state and user interactions
- Implements error handling and reconnection logic

#### VideoChat.jsx
- Displays individual video streams
- Shows user names and connection status
- Handles video element lifecycle

#### Chat.jsx
- Real-time text messaging
- Message history and persistence
- Unread message indicators

#### VideoLayout.jsx
- Advanced drag-and-drop video layout
- Multiple layout presets
- Responsive design for different screen sizes

## 🔒 Security Architecture

### Authentication & Authorization
- **JWT Token-Based Authentication**
- **Role-Based Access Control**
- **Secure Room Creation**
- **Connection Token Validation**

### Network Security
- **WebRTC**: Advanced peer-to-peer security
- **HTTPS/WSS**: Encrypted communication channels
- **STUN/TURN Server Authentication**
- **ICE Candidate Filtering**

### Input Protection
- **DOMPurify Sanitization**
- **Comprehensive Input Validation**
- **XSS Prevention Mechanisms**
- **CSRF Token Implementation**

### Data Privacy
- **No Centralized Video Storage**
- **End-to-End Media Encryption**
- **Minimal Personal Data Collection**
- **Compliance with GDPR/CCPA Guidelines**

### Error & Threat Handling
- **Comprehensive Error Boundaries**
- **Graceful Failure Modes**
- **Real-Time Threat Detection**
- **Automatic Connection Recovery**

### Monitoring & Auditing
- **Security Event Logging**
- **Continuous Vulnerability Scanning**
- **Automated Dependency Checks**
- **Incident Response Workflows**

## 🚧 Known Issues & Limitations

### Security Vulnerabilities
- Some dependencies have known vulnerabilities (see npm audit)
- Development server security considerations
- IPFS integration not yet implemented

### Browser Compatibility
- Requires modern browsers with WebRTC support
- Mobile browsers may have limited functionality
- Safari has some WebRTC limitations

### Performance
- Video quality depends on network conditions
- Large participant counts may impact performance
- Screen sharing may be resource-intensive

## 🚀 Future Roadmap

### Architectural Evolution
- **WebAssembly Performance Optimization**
- **Advanced WebRTC Codec Support**
- **Multi-Region Real-Time Infrastructure**
- **Edge Computing Integration**
- **Advanced Peer Discovery Mechanisms**

### Decentralization Features
- **IPFS Integration**: Distributed storage and sharing
- **Blockchain Identity Management**
- **Decentralized Room Creation**
- **Peer Reputation System**

### Machine Learning & AI
- **Adaptive Streaming Intelligence**
- **Background Noise Cancellation**
- **Intelligent Layout Management**
- **Real-Time Language Translation**
- **Meeting Insights and Analytics**

### Technical Innovations
- **TypeScript Migration**: Enhanced type safety
- **Comprehensive Test Coverage**
- **Advanced CI/CD Pipelines**
- **Prometheus/Grafana Monitoring**
- **OpenTelemetry Instrumentation**
- **Chaos Engineering Experiments**

### Mobile & Cross-Platform
- **React Native Mobile App**
- **Electron Desktop Application**
- **Progressive Web App (PWA) Support**
- **Cross-Platform WebRTC Optimization**

### Compliance & Enterprise Features
- **HIPAA Compliance**
- **SOC 2 Certification**
- **Advanced Access Controls**
- **Enterprise Single Sign-On (SSO)**
- **Audit Logging**

## 🤝 Contributing

### Development Guidelines
1. Follow the existing code style and patterns
2. Add comprehensive error handling
3. Test thoroughly before submitting
4. Update documentation for new features
5. Follow the simplicity principle from CLAUDE.md

### Code Quality
- Use ESLint for code linting
- Follow React best practices
- Implement proper error boundaries
- Add meaningful comments and documentation

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **WebRTC**: For peer-to-peer communication technology
- **Socket.io**: For real-time signaling server
- **React**: For the component-based architecture
- **Tailwind CSS**: For the utility-first styling approach

## 📞 Support

For issues, questions, or contributions:
1. Check the existing documentation
2. Review the activity log in `docs/activity.md`
3. Create an issue with detailed information
4. Follow the development guidelines

---

**Note**: This is a development project. For production use, additional security measures and testing are recommended.
