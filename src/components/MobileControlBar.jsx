// MobileControlBar.jsx - Touch-friendly mobile controls
import { useState, useEffect } from 'react';

const MobileControlBar = ({
  micOn,
  camOn,
  toggleMic,
  toggleCamera,
  handleShareScreen,
  showMoreMenu,
  setShowMoreMenu,
  confirmLeaveRoom
}) => {
  const [isLandscape, setIsLandscape] = useState(false);

  // Detect orientation changes
   
  useEffect(() => {
    const handleOrientationChange = () => {
      setIsLandscape(window.innerHeight < window.innerWidth);
    };

    handleOrientationChange();
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  const controlItems = [
    {
      key: 'mic',
      icon: micOn ? '🎤' : '🔇',
      label: micOn ? 'Mute' : 'Unmute',
      onClick: toggleMic,
      isActive: micOn,
      isAlert: !micOn,
      className: micOn 
        ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500' 
        : 'bg-red-500 hover:bg-red-600 active:bg-red-700 animate-pulse'
    },
    {
      key: 'camera',
      icon: camOn ? '📹' : '🎥',
      label: camOn ? 'Turn off camera' : 'Turn on camera',
      onClick: toggleCamera,
      isActive: camOn,
      isAlert: !camOn,
      className: camOn 
        ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500' 
        : 'bg-red-500 hover:bg-red-600 active:bg-red-700 animate-pulse'
    },
    {
      key: 'share',
      icon: '📺',
      label: 'Share screen',
      onClick: handleShareScreen,
      className: 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500',
      hideOnSmall: true
    },
    {
      key: 'more',
      icon: '⋯',
      label: 'More options',
      onClick: () => setShowMoreMenu(!showMoreMenu),
      isActive: showMoreMenu,
      className: showMoreMenu 
        ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800' 
        : 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500'
    }
  ];

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 z-50 safe-area-bottom ${
        isLandscape ? 'h-14' : 'h-16 sm:h-20'
      }`}
    >
      <div className="flex items-center justify-between h-full px-2 sm:px-4">
        {/* Main controls */}
        <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-center">
          {controlItems.map((item) => (
            <button
              key={item.key}
              onClick={item.onClick}
              className={`
                relative flex items-center justify-center rounded-full text-white transition-all duration-200 touch-manipulation mobile-button
                ${isLandscape ? 'w-9 h-9' : 'w-10 h-10 sm:w-12 sm:h-12'}
                ${item.hideOnSmall ? 'hidden xs:flex' : 'flex'}
                ${item.className}
              `}
              title={item.label}
              aria-label={item.label}
            >
              <span className={`${isLandscape ? 'text-sm' : 'text-base sm:text-xl'}`}>
                {item.icon}
              </span>
              
              {/* Alert indicator for muted/disabled states */}
              {item.isAlert && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-400 rounded-full animate-pulse"></div>
              )}
              
              {/* Active state indicator */}
              {item.isActive && item.key === 'more' && (
                <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-300 rounded-full"></div>
              )}
            </button>
          ))}
        </div>

        {/* Leave button */}
        <button
          onClick={confirmLeaveRoom}
          className={`
            flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white transition-all duration-200 shadow-lg hover:shadow-red-500/25 touch-manipulation mobile-button ml-2
            ${isLandscape ? 'w-9 h-9' : 'w-10 h-10 sm:w-12 sm:h-12'}
          `}
          title="End Meeting"
          aria-label="End Meeting"
        >
          <span className={`font-bold ${isLandscape ? 'text-sm' : 'text-base sm:text-xl'}`}>
            ✕
          </span>
        </button>
      </div>
    </div>
  );
};

export default MobileControlBar;
