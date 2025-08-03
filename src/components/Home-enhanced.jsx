import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';

const Home = () => {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Animate features section on mount
    const timer = setTimeout(() => setShowFeatures(true), 500);
    return () => clearTimeout(timer);
  }, []);
  
  // Input sanitization
  const sanitizeInput = (input) => {
    return DOMPurify.sanitize(input.trim());
  };
  
  // Connect to signaling server and get room token
  const authenticateAndJoin = async (roomIdToJoin, userNameToUse) => {
    setIsConnecting(true);
    
    try {
      const socket = io('http://localhost:5001');
      
      return new Promise((resolve, reject) => {
        // Set timeout for connection
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Connection timeout'));
        }, 10000);
        
        socket.on('connect', () => {
          // Request room token
          socket.emit('request-room-token', {
            roomId: roomIdToJoin,
            userName: userNameToUse
          });
        });
        
        socket.on('room-token', (data) => {
          clearTimeout(timeout);
          socket.disconnect();
          // Store token and user data for room component
          localStorage.setItem('roomToken', data.token);
          localStorage.setItem('userName', data.userName);
          localStorage.setItem('roomId', data.roomId);
          resolve(data);
        });
        
        socket.on('error', (error) => {
          clearTimeout(timeout);
          socket.disconnect();
          reject(new Error(error.message || 'Authentication failed'));
        });
        
        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(new Error('Failed to connect to server'));
        });
      });
    } catch (error) {
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  // Generate a unique room ID
  const generateRoomId = () => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomStr}`;
  };

  const createRoom = async () => {
    const sanitizedUserName = sanitizeInput(userName);
    
    if (!sanitizedUserName || sanitizedUserName.length < 2) {
      toast.error('Please enter a valid name (at least 2 characters)');
      return;
    }
    
    if (sanitizedUserName.length > 50) {
      toast.error('Name must be less than 50 characters');
      return;
    }
    
    setIsCreatingRoom(true);
    
    try {
      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      
      // Authenticate and get token
      await authenticateAndJoin(newRoomId, sanitizedUserName);
      
      toast.success('Room created successfully!');
      navigate(`/room/${newRoomId}`);
    } catch (error) {
      toast.error(`Failed to create room: ${error.message}`);
      setRoomId('');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    
    const sanitizedRoomId = sanitizeInput(roomId);
    const sanitizedUserName = sanitizeInput(userName);
    
    if (!sanitizedRoomId || !sanitizedUserName) {
      toast.error('Please enter both room ID and your name');
      return;
    }
    
    if (sanitizedUserName.length < 2 || sanitizedUserName.length > 50) {
      toast.error('Name must be between 2 and 50 characters');
      return;
    }
    
    if (sanitizedRoomId.length < 3 || sanitizedRoomId.length > 100) {
      toast.error('Invalid room ID format');
      return;
    }
    
    try {
      // Authenticate and get token
      await authenticateAndJoin(sanitizedRoomId, sanitizedUserName);
      
      toast.success('Joining room...');
      navigate(`/room/${sanitizedRoomId}`);
    } catch (error) {
      toast.error(`Failed to join room: ${error.message}`);
    }
  };

  const copyRoomId = async () => {
    if (roomId) {
      try {
        await navigator.clipboard.writeText(roomId);
        toast.success('Room ID copied to clipboard!');
      } catch (err) {
        toast.error('Failed to copy room ID');
      }
    }
  };

  const features = [
    {
      icon: "🎥",
      title: "HD Video Calls",
      description: "Crystal clear video quality with adaptive streaming"
    },
    {
      icon: "🖥️",
      title: "Screen Sharing",
      description: "Share your screen with perfect clarity"
    },
    {
      icon: "💬",
      title: "Real-time Chat",
      description: "Instant messaging during your meetings"
    },
    {
      icon: "🔒",
      title: "Secure & Private",
      description: "End-to-end encrypted communications"
    },
    {
      icon: "📱",
      title: "Mobile Ready",
      description: "Works perfectly on all devices"
    },
    {
      icon: "⚡",
      title: "Lightning Fast",
      description: "Optimized for speed and reliability"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-950 via-surface-900 to-surface-950 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent)]"></div>
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-primary-600/10 to-transparent blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-primary-800/10 to-transparent blur-3xl"></div>
      
      <div className="relative z-10 container mx-auto px-4 py-8 lg:py-16">
        {/* Header Section */}
        <div className="text-center mb-12 lg:mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-glow">
              <span className="text-2xl">🎥</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold">
              <span className="gradient-text">SecureChat</span>
            </h1>
          </div>
          <p className="text-xl text-surface-300 max-w-2xl mx-auto leading-relaxed">
            Professional video conferencing with enterprise-grade security and lightning-fast performance
          </p>
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Main Form */}
          <div className="order-2 lg:order-1 animate-slide-up">
            <div className="card p-8 lg:p-10">
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-white mb-2">Join or Create a Meeting</h2>
                <p className="text-surface-400">Enter your details to get started with your video conference</p>
              </div>
              
              <form onSubmit={joinRoom} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="userName" className="block text-sm font-medium text-surface-300">
                    Display Name
                  </label>
                  <input
                    type="text"
                    id="userName"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your name"
                    className="input"
                    required
                    aria-describedby="userName-help"
                  />
                  <p id="userName-help" className="text-xs text-surface-500">
                    This name will be visible to other participants
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="roomId" className="block text-sm font-medium text-surface-300">
                    Room ID (Optional)
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      id="roomId"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      placeholder="Enter room ID to join existing meeting"
                      className="input flex-1"
                      aria-describedby="roomId-help"
                    />
                    {roomId && (
                      <button
                        type="button"
                        onClick={copyRoomId}
                        className="btn-secondary px-4 flex items-center gap-2"
                        title="Copy Room ID"
                        aria-label="Copy room ID to clipboard"
                      >
                        <span className="text-lg">📋</span>
                      </button>
                    )}
                  </div>
                  <p id="roomId-help" className="text-xs text-surface-500">
                    Leave empty to create a new room
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={isConnecting || isCreatingRoom || !roomId.trim()}
                    className="btn-primary flex-1 py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-describedby="join-help"
                  >
                    {isConnecting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Connecting...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span>🚪</span>
                        Join Meeting
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={createRoom}
                    disabled={!userName.trim() || isCreatingRoom || isConnecting}
                    className="btn-success flex-1 py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-describedby="create-help"
                  >
                    {isCreatingRoom ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Creating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span>✨</span>
                        Create New Room
                      </span>
                    )}
                  </button>
                </div>
                
                <div className="text-xs text-surface-500 space-y-1">
                  <p id="join-help">💡 <strong>Join:</strong> Enter a room ID to join an existing meeting</p>
                  <p id="create-help">💡 <strong>Create:</strong> Start a new meeting and get a shareable room ID</p>
                </div>
              </form>

              {roomId && (
                <div className="mt-6 p-4 bg-primary-500/10 border border-primary-500/30 rounded-xl animate-slide-down">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></div>
                    <p className="text-sm font-medium text-primary-300">Room Created Successfully</p>
                  </div>
                  <p className="text-sm text-primary-200 mb-3">
                    Room ID: <span className="font-mono bg-primary-500/20 px-2 py-1 rounded text-primary-100">{roomId}</span>
                  </p>
                  <p className="text-xs text-primary-300">
                    Share this room ID with others to invite them to your meeting
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Features */}
          <div className={`order-1 lg:order-2 transition-all duration-700 ${showFeatures ? 'animate-slide-up' : 'opacity-0 translate-y-8'}`}>
            <div className="mb-8">
              <h3 className="text-2xl font-semibold text-white mb-4">Why Choose SecureChat?</h3>
              <p className="text-surface-400">
                Experience the future of video conferencing with our cutting-edge features designed for modern teams.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`group p-4 bg-surface-800/50 rounded-xl border border-surface-700/50 hover:border-primary-500/50 transition-all duration-300 hover:bg-surface-800/80 ${showFeatures ? 'animate-scale-in' : ''}`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center group-hover:bg-primary-500/30 transition-colors duration-300">
                      <span className="text-xl">{feature.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white mb-1 group-hover:text-primary-300 transition-colors">
                        {feature.title}
                      </h4>
                      <p className="text-sm text-surface-400 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Start Guide */}
            <div className="mt-8 p-6 glass rounded-xl">
              <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                <span>🚀</span>
                Quick Start Guide
              </h4>
              <div className="space-y-3 text-sm text-surface-300">
                <div className="flex gap-3">
                  <span className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <p>Enter your display name in the form</p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <p>Click "Create New Room" to start a meeting or enter a Room ID to join</p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <p>Share your room ID with participants and start collaborating!</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-surface-500 text-sm">
            Built with ❤️ for secure, reliable video conferencing
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;