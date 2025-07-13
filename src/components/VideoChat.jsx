import { useRef, useEffect, forwardRef } from 'react';

const Video = forwardRef(({ stream, name = 'Participant', isLocal = false }, ref) => {
  const videoRef = useRef();

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

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        muted={isLocal}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      
      {/* Enhanced name display */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-white font-medium text-sm">
              {name} {isLocal && '(You)'}
            </span>
          </div>
          {isLocal && (
            <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
              Local
            </div>
          )}
        </div>
      </div>
      
      {/* Connection status indicator */}
      {!isLocal && (
        <div className="absolute top-2 right-2">
          <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>
        </div>
      )}
    </div>
  );
});

Video.displayName = 'Video';

export default Video;