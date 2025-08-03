import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const navigate = useNavigate();

  // Generate a unique room ID
  const generateRoomId = () => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomStr}`;
  };

  const createRoom = () => {
    if (!userName.trim()) {
      alert('Please enter your name first');
      return;
    }
    
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    setIsCreatingRoom(true);
    
    // Store user name in localStorage
    localStorage.setItem('userName', userName);
    
    // Navigate to the new room
    navigate(`/room/${newRoomId}`);
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (roomId.trim() && userName.trim()) {
      // Store user name in localStorage for use in the room
      localStorage.setItem('userName', userName);
      navigate(`/room/${roomId}`);
    } else {
      alert('Please enter both room ID and your name');
    }
  };

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId).then(() => {
        alert('Room ID copied to clipboard!');
      }).catch(() => {
        alert('Failed to copy room ID');
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 layout-flex-center p-4">
      <div className="layout-container">
        <div className="max-w-2xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-12">
            <h1 className="text-display-lg text-slate-900 mb-4">
              Video Calls That Just Work
            </h1>
            <p className="text-body-lg text-slate-600 max-w-lg mx-auto mb-6">
              No downloads, no accounts, no hassle. Start HD video calls instantly with anyone, anywhere. 
              <strong> It's that simple.</strong>
            </p>
            
            {/* Quick Demo Link */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-4">
              <button
                onClick={() => {
                  setUserName('Demo User');
                  navigate('/room/demo-room-live');
                }}
                className="btn btn-outline px-6 py-3 text-base"
              >
                🎬 Try Live Demo
              </button>
              <span className="text-sm text-slate-500">No registration required</span>
            </div>

            {/* Trust Indicators */}
            <div className="flex justify-center items-center gap-6 text-sm text-slate-500 mt-6">
              <div className="flex items-center gap-1">
                <span className="text-green-500">🔒</span>
                <span>End-to-end encrypted</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-blue-500">⚡</span>
                <span>Works instantly</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-purple-500">📱</span>
                <span>Any device</span>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div className="card-elevated max-w-md mx-auto">
            <div className="card-header">
              <h2 className="text-heading-md text-slate-900">Get Started</h2>
              <p className="text-body-md text-slate-600 mt-1">Join or create a room to begin</p>
            </div>
            <div className="card-content space-y-6">
              {/* User Name Input */}
              <div className="input-group">
                <label htmlFor="userName" className="input-label">
                  Your Display Name
                </label>
                <input
                  type="text"
                  id="userName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="input"
                  placeholder="Enter your display name"
                  required
                />
              </div>
              
              {/* Room ID Input */}
              <div className="input-group">
                <label htmlFor="roomId" className="input-label">
                  Room ID <span className="text-slate-400">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="roomId"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="input flex-1"
                    placeholder="Enter room ID to join existing room"
                  />
                  {roomId && (
                    <button
                      type="button"
                      onClick={copyRoomId}
                      className="btn btn-ghost px-3"
                      title="Copy Room ID"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="space-y-3">
                <form onSubmit={joinRoom}>
                  <button type="submit" className="btn btn-primary btn-lg w-full">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Join Existing Room
                  </button>
                </form>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-slate-500">or</span>
                  </div>
                </div>
                
                <button 
                  type="button" 
                  onClick={createRoom} 
                  disabled={!userName.trim() || isCreatingRoom}
                  className="btn btn-success btn-lg w-full"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {isCreatingRoom ? 'Creating Room...' : 'Create New Room'}
                </button>
              </div>

              {/* Room ID Display */}
              {roomId && (
                <div className="notification-info rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 mb-1">Room Created Successfully</p>
                      <p className="text-sm text-blue-700">
                        Room ID: <code className="font-mono bg-blue-100 px-2 py-1 rounded text-blue-800">{roomId}</code>
                      </p>
                      <p className="text-xs text-blue-600 mt-1">Share this ID with others to invite them</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Why Choose Us Section */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">
              Why teams choose us over Zoom & Google Meet
            </h2>
            <p className="text-slate-600 mb-8 max-w-md mx-auto">
              We built this because we were tired of complicated video tools. Here's what makes us different:
            </p>
          </div>

          {/* Features Grid */}
          <div className="layout-grid mt-8">
            <div className="card text-center hover:shadow-lg transition-shadow">
              <div className="card-content">
                <div className="w-12 h-12 bg-green-100 rounded-lg layout-flex-center mx-auto mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-heading-md text-slate-900 mb-2">Start in 5 Seconds</h3>
                <p className="text-body-md text-slate-600">No downloads, accounts, or waiting rooms. Just click and talk.</p>
              </div>
            </div>
            
            <div className="card text-center hover:shadow-lg transition-shadow">
              <div className="card-content">
                <div className="w-12 h-12 bg-blue-100 rounded-lg layout-flex-center mx-auto mb-4">
                  <span className="text-2xl">🔊</span>
                </div>
                <h3 className="text-heading-md text-slate-900 mb-2">Crystal Clear Quality</h3>
                <p className="text-body-md text-slate-600">HD video & audio that adapts to your connection automatically.</p>
              </div>
            </div>
            
            <div className="card text-center hover:shadow-lg transition-shadow">
              <div className="card-content">
                <div className="w-12 h-12 bg-purple-100 rounded-lg layout-flex-center mx-auto mb-4">
                  <span className="text-2xl">🛡️</span>
                </div>
                <h3 className="text-heading-md text-slate-900 mb-2">Truly Private</h3>
                <p className="text-body-md text-slate-600">Direct peer-to-peer connections. Your conversations never touch our servers.</p>
              </div>
            </div>

            <div className="card text-center hover:shadow-lg transition-shadow">
              <div className="card-content">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg layout-flex-center mx-auto mb-4">
                  <span className="text-2xl">💬</span>
                </div>
                <h3 className="text-heading-md text-slate-900 mb-2">Built for Teams</h3>
                <p className="text-body-md text-slate-600">Chat, polls, Q&A, screen sharing - everything you need to collaborate.</p>
              </div>
            </div>

            <div className="card text-center hover:shadow-lg transition-shadow">
              <div className="card-content">
                <div className="w-12 h-12 bg-red-100 rounded-lg layout-flex-center mx-auto mb-4">
                  <span className="text-2xl">💰</span>
                </div>
                <h3 className="text-heading-md text-slate-900 mb-2">Always Free</h3>
                <p className="text-body-md text-slate-600">No subscriptions, limits, or "premium" features. Great video calls for everyone.</p>
              </div>
            </div>

            <div className="card text-center hover:shadow-lg transition-shadow">
              <div className="card-content">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg layout-flex-center mx-auto mb-4">
                  <span className="text-2xl">📱</span>
                </div>
                <h3 className="text-heading-md text-slate-900 mb-2">Works Everywhere</h3>
                <p className="text-body-md text-slate-600">Desktop, mobile, tablet - any device with a web browser works perfectly.</p>
              </div>
            </div>
          </div>

          {/* Social Proof Placeholder */}
          <div className="mt-16 text-center bg-white rounded-lg p-8 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Join thousands of happy users</h3>
            <div className="flex justify-center items-center gap-8 text-slate-600">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">1000+</div>
                <div className="text-sm">Rooms created daily</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">4.8/5</div>
                <div className="text-sm">Average rating</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">99.9%</div>
                <div className="text-sm">Call success rate</div>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-4 italic">
              "Finally, a video call app that just works!" - Sarah, Remote Team Lead
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;