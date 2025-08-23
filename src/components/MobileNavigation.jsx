// MobileNavigation.jsx - Mobile-optimized navigation component
import { useState, useEffect } from 'react';

const MobileNavigation = ({ 
  showChat, 
  showPolls, 
  showQA,
  unreadCount,
  toggleChat,
  togglePolls, 
  toggleQA,
  onMoreMenu
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-collapse on small screens when multiple panels are open
  useEffect(() => {
    const openPanels = [showChat, showPolls, showQA].filter(Boolean).length;
    if (window.innerWidth < 480 && openPanels > 1) {
      setIsCollapsed(true);
    }
  }, [showChat, showPolls, showQA]);

  const navItems = [
    {
      key: 'chat',
      label: 'Chat',
      emoji: '💬',
      isActive: showChat,
      onClick: toggleChat,
      hasNotification: unreadCount > 0,
      notificationCount: unreadCount
    },
    {
      key: 'polls',
      label: 'Polls', 
      emoji: '📊',
      isActive: showPolls,
      onClick: togglePolls
    },
    {
      key: 'qa',
      label: 'Q&A',
      emoji: '❓', 
      isActive: showQA,
      onClick: toggleQA
    }
  ];

  return (
    <div className="fixed top-16 left-2 right-2 sm:left-4 sm:right-4 flex items-center justify-center z-30 mt-1">
      <div className="flex items-center gap-1 sm:gap-2 bg-gray-800/90 backdrop-blur-sm px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-gray-700 max-w-full">
        {/* Mobile collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="sm:hidden flex items-center justify-center w-8 h-8 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <span className="text-sm">
            {isCollapsed ? '⋯' : '✕'}
          </span>
        </button>

        {/* Navigation items */}
        <div className={`flex items-center gap-1 sm:gap-2 transition-all duration-300 overflow-hidden ${
          isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
        }`}>
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={item.onClick}
              className={`relative flex items-center space-x-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-all duration-200 text-xs sm:text-sm whitespace-nowrap touch-manipulation ${
                item.isActive 
                  ? 'text-white bg-blue-600 hover:bg-blue-700 shadow-md' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
              aria-label={item.label}
            >
              <span className="text-base sm:text-lg">{item.emoji}</span>
              <span className="hidden xs:inline sm:inline">{item.label}</span>
              
              {/* Chevron indicator */}
              <svg 
                className={`w-3 h-3 ml-1 transition-transform ${item.isActive ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              
              {/* Notification badge */}
              {item.hasNotification && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center min-w-[16px]">
                  {item.notificationCount > 9 ? '9+' : item.notificationCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* More menu button - visible on mobile when collapsed */}
        {isCollapsed && (
          <button
            onClick={onMoreMenu}
            className="sm:hidden flex items-center justify-center w-8 h-8 rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors touch-manipulation"
            aria-label="More options"
          >
            <span className="text-sm">⚙️</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default MobileNavigation;