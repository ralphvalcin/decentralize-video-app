import { useRef, useEffect } from 'react';
import EmojiReactions from './EmojiReactions';
import RaiseHand from './RaiseHand';

const MoreMenu = ({ 
  isOpen, 
  onClose,
  // Emoji Reactions props
  onSendReaction,
  reactions,
  // Raise Hand props
  onRaiseHand,
  onLowerHand,
  raisedHands,
  userInfo,
  isHost,
  // Feature toggles
  onTogglePolls,
  onToggleQA,
  onToggleAdvancedLayout,
  useAdvancedLayout,
  onTogglePerformanceDashboard,
  showPerformanceDashboard,
  // Advanced Performance Dashboard - Phase 1
  onToggleAdvancedPerformanceDashboard,
  showAdvancedPerformanceDashboard
}) => {
  const menuRef = useRef(null);

  // Handle click outside to close menu
   
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'polls',
      label: 'Polls',
      icon: '📊',
      onClick: () => {
        onTogglePolls();
        onClose();
      }
    },
    {
      id: 'qa',
      label: 'Q&A',
      icon: '❓',
      onClick: () => {
        onToggleQA();
        onClose();
      }
    },
    {
      id: 'layout',
      label: useAdvancedLayout ? 'Simple Layout' : 'Advanced Layout',
      icon: useAdvancedLayout ? '📱' : '🎛️',
      onClick: () => {
        onToggleAdvancedLayout();
        onClose();
      }
    },
    {
      id: 'performance',
      label: showPerformanceDashboard ? 'Hide Performance' : 'Performance Dashboard',
      icon: '📊',
      onClick: () => {
        onTogglePerformanceDashboard();
        onClose();
      }
    },
    {
      id: 'advanced-performance',
      label: showAdvancedPerformanceDashboard ? 'Hide AI Analytics' : 'AI Performance Analytics',
      icon: '🚀',
      badge: 'Phase 1',
      onClick: () => {
        onToggleAdvancedPerformanceDashboard();
        onClose();
      }
    }
  ];

  return (
    <div 
      ref={menuRef}
      className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4 z-50 min-w-80"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium text-sm">More Options</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Engagement Features Section */}
      <div className="mb-4">
        <h4 className="text-gray-300 text-xs font-medium mb-2 uppercase tracking-wide">
          Engagement
        </h4>
        <div className="flex items-center gap-3 mb-3">
          <EmojiReactions 
            onSendReaction={onSendReaction}
            reactions={reactions}
          />
          <RaiseHand
            onRaiseHand={onRaiseHand}
            onLowerHand={onLowerHand}
            raisedHands={raisedHands}
            userInfo={userInfo}
            isHost={isHost}
          />
        </div>
      </div>

      {/* Feature Toggles Section */}
      <div>
        <h4 className="text-gray-300 text-xs font-medium mb-2 uppercase tracking-wide">
          Features
        </h4>
        <div className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
            >
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm">{item.label}</span>
                {item.badge && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-medium">
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MoreMenu;
