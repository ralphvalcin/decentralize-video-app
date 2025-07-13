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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Video Chat App
        </h1>
        
        <form onSubmit={joinRoom} className="space-y-4">
          <div>
            <label htmlFor="userName" className="block text-sm font-medium text-gray-300 mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="roomId" className="block text-sm font-medium text-gray-300 mb-2">
              Room ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID to join"
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              {roomId && (
                <button
                  type="button"
                  onClick={copyRoomId}
                  className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  title="Copy Room ID"
                >
                  📋
                </button>
              )}
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Join Room
            </button>
            <button
              type="button"
              onClick={createRoom}
              disabled={!userName.trim() || isCreatingRoom}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreatingRoom ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-sm font-medium text-white mb-2">How to use:</h3>
          <ul className="text-xs text-gray-300 space-y-1">
            <li>• Enter your name and click "Create Room" to start a new meeting</li>
            <li>• Share the room ID with others to invite them</li>
            <li>• Or enter an existing room ID to join someone else's meeting</li>
          </ul>
        </div>

        {roomId && (
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300 mb-2">Room ID: <span className="font-mono text-blue-200">{roomId}</span></p>
            <p className="text-xs text-blue-400">Share this ID with others to invite them to your room</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;