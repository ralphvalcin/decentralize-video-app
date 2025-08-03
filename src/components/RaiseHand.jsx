import { useState, useEffect } from 'react';

const RaiseHand = ({ onRaiseHand, onLowerHand, raisedHands = [], userInfo, isHost = false }) => {
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showHandsList, setShowHandsList] = useState(false);

  // Check if current user has hand raised
  useEffect(() => {
    const userHand = raisedHands.find(hand => hand.userId === userInfo.id);
    setIsHandRaised(!!userHand);
  }, [raisedHands, userInfo.id]);

  const handleToggleHand = () => {
    if (isHandRaised) {
      onLowerHand(userInfo.id);
    } else {
      onRaiseHand({
        userId: userInfo.id,
        userName: userInfo.name,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleLowerUserHand = (userId) => {
    if (isHost) {
      onLowerHand(userId);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const sortedHands = raisedHands.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return (
    <div className="relative">
      {/* Raise Hand Button */}
      <button
        onClick={handleToggleHand}
        className={`p-3 rounded-full transition-colors shadow-lg ${
          isHandRaised
            ? 'bg-yellow-500 hover:bg-yellow-600 text-white animate-pulse'
            : 'bg-gray-600 hover:bg-gray-700 text-white'
        }`}
        title={isHandRaised ? 'Lower hand' : 'Raise hand'}
        aria-label={isHandRaised ? 'Lower hand' : 'Raise hand'}
      >
        ✋
      </button>

      {/* Raised Hands Counter (for host) */}
      {isHost && raisedHands.length > 0 && (
        <button
          onClick={() => setShowHandsList(!showHandsList)}
          className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold animate-bounce"
          title={`${raisedHands.length} raised hand${raisedHands.length !== 1 ? 's' : ''}`}
        >
          {raisedHands.length > 9 ? '9+' : raisedHands.length}
        </button>
      )}

      {/* Raised Hands List (Host View) */}
      {showHandsList && isHost && raisedHands.length > 0 && (
        <div className="absolute bottom-full mb-2 right-0 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-3 min-w-[280px] max-h-64 overflow-y-auto z-40 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white text-sm font-semibold">Raised Hands</h4>
            <button
              onClick={() => setShowHandsList(false)}
              className="text-gray-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-2">
            {sortedHands.map((hand, index) => (
              <div
                key={hand.userId}
                className="flex items-center justify-between p-2 bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400">✋</span>
                  <div>
                    <div className="text-white text-sm font-medium">
                      {hand.userName}
                    </div>
                    <div className="text-xs text-gray-400">
                      #{index + 1} • {formatTime(hand.timestamp)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleLowerUserHand(hand.userId)}
                  className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-500/20 transition-colors"
                  title="Lower hand"
                >
                  Lower
                </button>
              </div>
            ))}
          </div>

          {raisedHands.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-700">
              <button
                onClick={() => raisedHands.forEach(hand => handleLowerUserHand(hand.userId))}
                className="w-full text-xs text-red-400 hover:text-red-300 py-1"
              >
                Lower All Hands
              </button>
            </div>
          )}
        </div>
      )}

      {/* Visual Indicator for Non-Host Users */}
      {!isHost && raisedHands.length > 0 && (
        <div className="absolute -top-8 right-0 bg-gray-800 border border-gray-600 rounded-full px-2 py-1 text-xs text-white flex items-center gap-1 animate-fade-in">
          <span>✋</span>
          <span>{raisedHands.length}</span>
        </div>
      )}

      {/* Personal Hand Status */}
      {isHandRaised && (
        <div className="absolute -top-12 right-0 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-medium animate-pulse">
          Hand raised!
        </div>
      )}
    </div>
  );
};

export default RaiseHand;