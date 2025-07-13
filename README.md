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
- **React 18**: Modern React with hooks and functional components
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Socket.io Client**: Real-time communication
- **Simple Peer**: WebRTC peer connections
- **React Grid Layout**: Advanced video layout management

### Backend
- **Node.js**: Server runtime
- **Socket.io**: Real-time bidirectional communication
- **Express**: Web framework (if needed for future features)

### Development Tools
- **ESLint**: Code linting and quality assurance
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Modern web browser with WebRTC support

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

## 🔒 Security Considerations

### Current Implementation
- **WebRTC**: Peer-to-peer connections for video/audio
- **Socket.io**: Secure signaling server communication
- **Input Validation**: Form validation and sanitization
- **Error Handling**: Comprehensive error handling and user feedback

### Security Features
- **No Centralized Video Storage**: All video streams are peer-to-peer
- **Secure Signaling**: Socket.io with proper event handling
- **Input Sanitization**: All user inputs are validated
- **Error Boundaries**: React error boundaries for graceful failures

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

## 🚀 Future Enhancements

### Planned Features
- **IPFS Integration**: Decentralized file sharing and storage
- **Blockchain Features**: User identity and room management
- **Advanced Analytics**: Usage tracking and performance monitoring
- **Mobile App**: Native mobile application
- **Recording**: Meeting recording and playback
- **AI Features**: Background blur, noise cancellation

### Technical Improvements
- **TypeScript**: Add type safety throughout the codebase
- **Testing**: Comprehensive unit and integration tests
- **CI/CD**: Automated testing and deployment
- **Monitoring**: Application performance monitoring
- **Documentation**: API documentation and developer guides

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
