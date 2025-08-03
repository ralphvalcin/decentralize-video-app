// VideoLayout.jsx
import { Responsive, WidthProvider } from 'react-grid-layout';
import Video from './VideoChat';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useState, useEffect } from 'react';

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

  return (
    <div className="space-y-6">
      {/* Layout Selector */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 bg-surface-800/50 rounded-xl p-2 border border-surface-700/50">
          {Object.keys(layoutPresets).map((preset) => (
            <button
              key={preset}
              onClick={() => setSelectedLayout(preset)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedLayout === preset
                  ? 'bg-primary-600 text-white shadow-glow'
                  : 'text-surface-300 hover:bg-surface-700 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>
                  {preset === 'grid' ? '⊞' : preset === 'podcast' ? '🎙️' : '⭐'}
                </span>
                {preset.charAt(0).toUpperCase() + preset.slice(1)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
        rowHeight={100}
        isResizable
        isDraggable
        onLayoutChange={handleLayoutChange}
        margin={[8, 8]}
      >
        {/* Local Video */}
        <div key="local" className="video-container aspect-video animate-fade-in">
          <Video 
            stream={localStream} 
            name={userInfo?.name || 'You'} 
            isLocal={true} 
            handRaised={localHandRaised}
          />
        </div>

        {/* Peer Videos */}
        {peers.map((peer, index) => (
          <div key={`peer${index + 1}`} className="video-container aspect-video animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
            <Video
              stream={peer.stream}
              name={peer.name || `Peer ${index + 1}`}
              isLocal={false}
              handRaised={peer.handRaised}
            />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
