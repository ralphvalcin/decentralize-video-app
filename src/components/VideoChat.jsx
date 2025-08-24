import { useRef, useEffect, useState, forwardRef, memo } from 'react';
import { useMobileGestures, useMobileDetection } from '../hooks/useMobileGestures';

const Video = memo(forwardRef(({ stream, name = 'Participant', isLocal = false, handRaised = false }, ref) => {
  const videoRef = useRef();
  const containerRef = useRef();
  const [isPiP, setIsPiP] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  const getMobileInfo = useMobileDetection();
  const mobileInfo = getMobileInfo();

   
  useEffect(() => {
    if (!videoRef.current) return;
    if (stream instanceof MediaStream) {
      try {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => console.error('Error playing video:', err));
      } catch (err) {
        console.error('Video setup error:', err);
      }
    }
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  // PiP handlers
  const handlePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (!isPiP) {
        await videoRef.current.requestPictureInPicture();
      } else {
        document.exitPictureInPicture();
      }
    } catch (err) {
      console.error('PiP error:', err);
    }
  };

   
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);
    video.addEventListener('enterpictureinpicture', onEnterPiP);
    video.addEventListener('leavepictureinpicture', onLeavePiP);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP);
      video.removeEventListener('leavepictureinpicture', onLeavePiP);
    };
  }, []);

  // Fullscreen handlers
  const handleFullscreen = async () => {
    if (!videoRef.current) return;
    try {
      if (!isFullscreen) {
        if (videoRef.current.requestFullscreen) {
          await videoRef.current.requestFullscreen();
        }
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  // Mobile gesture handlers
  const { touchHandlers } = useMobileGestures({
    onDoubleTap: () => {
      if (mobileInfo.isMobile) {
        handleFullscreen();
      }
    },
    onSwipeUp: () => {
      if (mobileInfo.isMobile) {
        setShowControls(true);
        setTimeout(() => setShowControls(false), 3000);
      }
    },
    onSwipeDown: () => {
      if (mobileInfo.isMobile && isFullscreen) {
        handleFullscreen(); // Exit fullscreen
      }
    }
  });

   
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement && document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // Auto-hide controls on mobile
   
  useEffect(() => {
    if (mobileInfo.isMobile && showControls) {
      const timer = setTimeout(() => setShowControls(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showControls, mobileInfo.isMobile]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full ${mobileInfo.isMobile ? 'touch-manipulation' : 'group'}`}
      {...(mobileInfo.isMobile ? touchHandlers : {})}
      onClick={() => mobileInfo.isMobile && setShowControls(!showControls)}
    >
      <video
        ref={videoRef}
        muted={isLocal}
        autoPlay
        playsInline
        className="w-full h-full object-cover transition-all duration-300"
      />
      
      {/* Video Overlay Controls - Show on hover or mobile tap */}
      <div className={`absolute inset-0 transition-all duration-300 bg-gradient-to-t from-black/60 via-transparent to-black/40 ${
        mobileInfo.isMobile 
          ? (showControls ? 'opacity-100' : 'opacity-0') 
          : 'opacity-0 group-hover:opacity-100'
      }`}>
        {/* Top Controls */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          {/* Hand Raised Indicator */}
          <div className="flex items-center gap-2">
            {handRaised && (
              <div className="bg-warning-500 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg hand-raised">
                ✋ Hand Raised
              </div>
            )}
          </div>
          
          {/* Video Controls */}
          <div className="flex items-center gap-2">
            {/* Picture-in-Picture */}
            <button
              onClick={handlePiP}
              className={`p-2 bg-black/60 backdrop-blur-sm rounded-lg text-white hover:bg-primary-600 transition-all duration-200 ${isPiP ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isPiP ? 'PiP Active' : 'Picture-in-Picture'}
              aria-label="Picture-in-Picture"
              disabled={isPiP}
            >
              <span className="text-sm">📺</span>
            </button>
            
            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              className="p-2 bg-black/60 backdrop-blur-sm rounded-lg text-white hover:bg-primary-600 transition-all duration-200"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              <span className="text-sm">{isFullscreen ? '❌' : '⛶'}</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Bottom Overlay - Always visible */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
        <div className="flex items-center justify-between">
          {/* Participant Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
              isLocal 
                ? 'bg-gradient-to-br from-primary-500 to-primary-700' 
                : 'bg-gradient-to-br from-surface-600 to-surface-700'
            }`}>
              {name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            
            {/* Name and Status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium text-sm truncate">
                  {name} {isLocal && '(You)'}
                </span>
                {isLocal && (
                  <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    Local
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  isLocal ? 'connection-excellent' : 'connection-excellent'
                }`}></div>
                <span className="text-xs text-white/80">
                  {isLocal ? 'You' : 'Connected'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Connection Quality Indicator */}
          {!isLocal && (
            <div className="flex items-center gap-1">
              <div className="flex flex-col gap-0.5">
                <div className="w-1 h-1 bg-success-500 rounded-full"></div>
                <div className="w-1 h-2 bg-success-500 rounded-full"></div>
                <div className="w-1 h-3 bg-success-500 rounded-full"></div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Loading State */}
      {!isLocal && !stream && (
        <div className="absolute inset-0 bg-surface-800 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-surface-700 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
              <span className="text-2xl">👤</span>
            </div>
            <p className="text-surface-400 text-sm">Connecting...</p>
          </div>
        </div>
      )}
      
      {/* Video Error State */}
      {!isLocal && stream && videoRef.current?.error && (
        <div className="absolute inset-0 bg-surface-800 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-error-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl text-white">⚠️</span>
            </div>
            <p className="text-error-400 text-sm">Video unavailable</p>
          </div>
        </div>
      )}
      
      {/* Network Quality Indicator for Remote Peers */}
      {!isLocal && (
        <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-success-500 rounded-full"></div>
              <div className="w-1 h-2 bg-success-500 rounded-full"></div>
              <div className="w-1 h-3 bg-success-400 rounded-full"></div>
              <span className="text-xs text-white ml-1">Good</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}));

Video.displayName = 'Video';

// Custom comparison function for memo
Video.compare = (prevProps, nextProps) => {
  return (
    prevProps.stream === nextProps.stream &&
    prevProps.name === nextProps.name &&
    prevProps.isLocal === nextProps.isLocal &&
    prevProps.handRaised === nextProps.handRaised
  );
};

export default Video;
