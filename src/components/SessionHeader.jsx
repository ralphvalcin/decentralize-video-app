import { useState } from 'react';

const SessionHeader = ({
  roomId,
  participantCount,
  userInfo,
  onShare,
  onLeave,
  connectionStatus
}) => {
  const [showParticipants, setShowParticipants] = useState(false);

  // Generate a professional session title from roomId
  const getSessionTitle = (roomId) => {
    // If roomId looks like a generated ID, create a more professional title
    if (roomId && roomId.length > 8) {
      return `Meeting ${roomId.slice(0, 8)}`;
    }
    return roomId || 'Video Meeting';
  };

  // Connection status indicator
  const getConnectionIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return { color: 'bg-green-500', text: 'Connected', pulse: false };
      case 'connecting':
        return { color: 'bg-yellow-500', text: 'Connecting', pulse: true };
      case 'error':
        return { color: 'bg-red-500', text: 'Connection issues', pulse: false };
      default:
        return { color: 'bg-gray-500', text: 'Disconnected', pulse: false };
    }
  };

  const connectionIndicator = getConnectionIndicator();

  return (
    <>
      {/* Main Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          {/* Left Section - Session Info */}
          <div className="flex items-center space-x-4">
            {/* Session Title */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg 
                    className="w-4 h-4 text-white" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM5 8a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm0 3a1 1 0 011-1h4a1 1 0 110 2H6a1 1 0 01-1-1z" />
                  </svg>
                </div>
                <h1 className="text-lg font-semibold text-white">
                  {getSessionTitle(roomId)}
                </h1>
              </div>
              
              {/* Connection Status Dot */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${connectionIndicator.color} ${connectionIndicator.pulse ? 'animate-pulse' : ''}`}></div>
                <span className="text-xs text-gray-400 hidden sm:inline">
                  {connectionIndicator.text}
                </span>
              </div>
            </div>

            {/* Participants Counter */}
            <div className="relative">
              <button
                onClick={() => setShowParticipants(!showParticipants)}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-1">
                  {/* Avatar placeholder */}
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-medium">
                      {userInfo?.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  {participantCount > 1 && (
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center -ml-2 border-2 border-gray-800">
                      <span className="text-xs text-white font-medium">
                        +
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-sm text-gray-300">
                  {participantCount} participant{participantCount !== 1 ? 's' : ''}
                </span>
                <svg 
                  className={`w-4 h-4 text-gray-400 transition-transform ${showParticipants ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center space-x-3">
            {/* Share Button */}
            <button
              onClick={onShare}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* Leave Button */}
            <button
              onClick={onLeave}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </header>

      {/* Participants Dropdown */}
      {showParticipants && (
        <div className="fixed top-16 left-4 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4 w-72 max-h-80 overflow-y-auto z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">Participants</h3>
            <button
              onClick={() => setShowParticipants(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-2">
            {/* Current user */}
            <div className="flex items-center space-x-3 p-2 bg-gray-700 rounded-lg">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-sm text-white font-medium">
                  {userInfo?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-white text-sm font-medium">
                    {userInfo?.name || 'You'}
                  </span>
                  <span className="text-xs text-blue-400 bg-blue-900 px-2 py-0.5 rounded">
                    You
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {userInfo?.role || 'Participant'}
                </div>
              </div>
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            </div>
            
            {/* Other participants placeholder */}
            {participantCount > 1 && (
              <div className="text-xs text-gray-400 p-2">
                + {participantCount - 1} other participant{participantCount !== 2 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close participants dropdown */}
      {showParticipants && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowParticipants(false)}
        />
      )}
    </>
  );
};

export default SessionHeader;
