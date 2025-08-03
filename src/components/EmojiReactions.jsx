import { useState, useEffect, useRef } from 'react';

const EmojiReactions = ({ onSendReaction, reactions = [] }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const pickerRef = useRef(null);

  const emojiOptions = [
    { emoji: '👍', label: 'Thumbs up' },
    { emoji: '❤️', label: 'Love' },
    { emoji: '😂', label: 'Laugh' },
    { emoji: '😮', label: 'Wow' },
    { emoji: '😢', label: 'Sad' },
    { emoji: '😡', label: 'Angry' },
    { emoji: '👏', label: 'Clap' },
    { emoji: '🎉', label: 'Celebrate' },
    { emoji: '💯', label: 'Perfect' },
    { emoji: '🔥', label: 'Fire' },
    { emoji: '✨', label: 'Sparkles' },
    { emoji: '⚡', label: 'Lightning' }
  ];

  // Handle click outside to close picker
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add new reactions to floating animations
  useEffect(() => {
    if (reactions.length > 0) {
      const latestReaction = reactions[reactions.length - 1];
      const id = Date.now() + Math.random();
      
      setFloatingReactions(prev => [...prev, {
        id,
        emoji: latestReaction.emoji,
        userName: latestReaction.userName,
        timestamp: latestReaction.timestamp
      }]);

      // Remove reaction after animation
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== id));
      }, 3000);
    }
  }, [reactions]);

  const handleEmojiClick = (emoji) => {
    onSendReaction(emoji);
    setShowPicker(false);
  };

  return (
    <div className="relative">
      {/* Floating Reactions Container */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingReactions.map((reaction) => (
          <FloatingEmoji
            key={reaction.id}
            emoji={reaction.emoji}
            userName={reaction.userName}
          />
        ))}
      </div>

      {/* Emoji Picker Button */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-full transition-colors shadow-lg"
        title="Send reaction"
        aria-label="Open emoji reactions"
      >
        😀
      </button>

      {/* Emoji Picker Dropdown */}
      {showPicker && (
        <div
          ref={pickerRef}
          className="absolute bottom-full mb-2 right-0 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-3 min-w-[280px] animate-slide-up z-40"
        >
          <div className="mb-2">
            <h4 className="text-white text-sm font-semibold mb-2">Quick Reactions</h4>
          </div>
          
          <div className="grid grid-cols-6 gap-2">
            {emojiOptions.map((option) => (
              <button
                key={option.emoji}
                onClick={() => handleEmojiClick(option.emoji)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-xl hover:scale-110 transform duration-150"
                title={option.label}
                aria-label={`React with ${option.label}`}
              >
                {option.emoji}
              </button>
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-gray-700">
            <p className="text-xs text-gray-400 text-center">
              Click an emoji to send reaction to all participants
            </p>
          </div>
        </div>
      )}

      {/* Recent Reactions Summary */}
      {reactions.length > 0 && (
        <div className="absolute -top-8 right-0 flex gap-1">
          {reactions.slice(-3).map((reaction, index) => (
            <div
              key={index}
              className="bg-gray-800 border border-gray-600 rounded-full px-2 py-1 text-xs text-white flex items-center gap-1 animate-fade-in"
            >
              <span>{reaction.emoji}</span>
              <span className="max-w-12 truncate">{reaction.userName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Floating Emoji Animation Component
const FloatingEmoji = ({ emoji, userName }) => {
  const [position, setPosition] = useState({
    x: Math.random() * (window.innerWidth - 100),
    y: window.innerHeight - 100,
    rotation: Math.random() * 360
  });

  useEffect(() => {
    // Animate upward
    const timer = setTimeout(() => {
      setPosition(prev => ({
        ...prev,
        y: -100,
        x: prev.x + (Math.random() - 0.5) * 200,
        rotation: prev.rotation + 180
      }));
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="absolute transition-all duration-3000 ease-out pointer-events-none z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `rotate(${position.rotation}deg)`,
        opacity: position.y < 0 ? 0 : 1
      }}
    >
      <div className="bg-white rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 border">
        <span className="text-2xl">{emoji}</span>
        <span className="text-xs font-medium text-gray-700">{userName}</span>
      </div>
    </div>
  );
};

export default EmojiReactions;