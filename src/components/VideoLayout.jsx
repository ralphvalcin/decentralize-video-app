// VideoLayout.jsx
import { Responsive, WidthProvider } from 'react-grid-layout';
import Video from './VideoChat';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useState, useEffect, useCallback } from 'react';

const ResponsiveGridLayout = WidthProvider(Responsive);

const layoutPresets = {
  grid: [
    { i: 'local', x: 0, y: 0, w: 4, h: 3 },
    { i: 'peer1', x: 4, y: 0, w: 4, h: 3 },
    { i: 'peer2', x: 8, y: 0, w: 4, h: 3 }
  ],
  podcast: [
    { i: 'local', x: 0, y: 0, w: 6, h: 4 },
    { i: 'peer1', x: 6, y: 0, w: 6, h: 4 }
  ],
  spotlight: [
    { i: 'local', x: 0, y: 0, w: 12, h: 5 },
    { i: 'peer1', x: 0, y: 5, w: 6, h: 3 },
    { i: 'peer2', x: 6, y: 5, w: 6, h: 3 }
  ]
};

export default function VideoLayout({ localStream, peers, userInfo, localHandRaised, onLayoutChange }) {
  const [selectedLayout, setSelectedLayout] = useState('grid');
  const [layout, setLayout] = useState(() => {
    const saved = localStorage.getItem('video-layout');
    return saved ? JSON.parse(saved) : layoutPresets.grid;
  });

  // Generate layout based on number of participants
  const generateLayout = (layoutType, participantCount) => {
    const baseLayout = layoutPresets[layoutType] || layoutPresets.grid;
    
    if (participantCount <= 1) {
      return [baseLayout[0]]; // Just local video
    }
    
    if (participantCount === 2) {
      return baseLayout.slice(0, 2); // Local + 1 peer
    }
    
    // For more participants, extend the layout
    const extendedLayout = [...baseLayout];
    for (let i = 2; i < participantCount; i++) {
      const lastItem = extendedLayout[extendedLayout.length - 1];
      extendedLayout.push({
        i: `peer${i}`,
        x: (i % 3) * 4,
        y: Math.floor(i / 3) * 3,
        w: 4,
        h: 3
      });
    }
    
    return extendedLayout;
  };

   
  useEffect(() => {
    const participantCount = peers.length + 1; // +1 for local user
    const newLayout = generateLayout(selectedLayout, participantCount);
    setLayout(newLayout);
    localStorage.setItem('layout-preset', selectedLayout);
  }, [selectedLayout, peers.length]);

  const handleLayoutChange = (currentLayout) => {
    setLayout(currentLayout);
    localStorage.setItem('video-layout', JSON.stringify(currentLayout));
    if (onLayoutChange) {
      onLayoutChange(currentLayout);
    }
  };

  // Create streams object for the layout
  const streams = {
    local: localStream
  };
  
  peers.forEach((peer, index) => {
    streams[`peer${index + 1}`] = peer.stream;
  });

  // Touch gesture handling for mobile
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
   
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle touch gestures
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragStop = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Mobile-Optimized Layout Selector */}
      <div className="flex justify-center">
        <div className="flex items-center gap-1 sm:gap-2 bg-surface-800/50 rounded-xl p-1 sm:p-2 border border-surface-700/50 max-w-full overflow-x-auto mobile-nav-scroll">
          {Object.keys(layoutPresets).map((preset) => (
            <button
              key={preset}
              onClick={() => setSelectedLayout(preset)}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap touch-manipulation ${
                selectedLayout === preset
                  ? 'bg-primary-600 text-white shadow-glow'
                  : 'text-surface-300 hover:bg-surface-700 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1 sm:gap-2">
                <span className="text-sm sm:text-base">
                  {preset === 'grid' ? '⊞' : preset === 'podcast' ? '🎙️' : '⭐'}
                </span>
                <span className="hidden xs:inline">
                  {preset.charAt(0).toUpperCase() + preset.slice(1)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <ResponsiveGridLayout
        className={`layout ${isDragging ? 'dragging' : ''}`}
        layouts={{ 
          lg: layout, 
          md: layout, 
          sm: layout.map(item => ({ ...item, w: Math.min(item.w, 6) })),
          xs: layout.map(item => ({ ...item, w: 4, x: 0 })) 
        }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={isMobile ? 80 : 100}
        isResizable={!isMobile}
        isDraggable={true}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onLayoutChange={handleLayoutChange}
        margin={isMobile ? [4, 4] : [8, 8]}
        containerPadding={isMobile ? [8, 8] : [16, 16]}
        // Mobile touch optimization
        useCSSTransforms={true}
        preventCollision={false}
        compactType="vertical"
      >
        {/* Local Video */}
        <div 
          key="local" 
          className={`video-container aspect-video animate-fade-in ${isMobile ? 'mobile-video-container' : ''} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <Video 
            stream={localStream} 
            name={userInfo?.name || 'You'} 
            isLocal={true} 
            handRaised={localHandRaised}
          />
          {/* Mobile drag indicator */}
          {isMobile && (
            <div className="absolute top-2 right-2 text-white/60 text-xs bg-black/20 px-2 py-1 rounded">
              📱 Drag to move
            </div>
          )}
        </div>

        {/* Peer Videos */}
        {peers.map((peer, index) => (
          <div 
            key={`peer${index + 1}`} 
            className={`video-container aspect-video animate-fade-in ${isMobile ? 'mobile-video-container' : ''} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`} 
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <Video
              stream={peer.stream}
              name={peer.name || `Peer ${index + 1}`}
              isLocal={false}
              handRaised={peer.handRaised}
            />
            {/* Mobile drag indicator */}
            {isMobile && (
              <div className="absolute top-2 right-2 text-white/60 text-xs bg-black/20 px-2 py-1 rounded">
                📱 Drag to move
              </div>
            )}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
