/**
 * Advanced Video Component with AI Features
 * Integrates all advanced WebRTC capabilities into the video display
 */

import { useRef, useEffect, useState, forwardRef, memo, useCallback } from 'react';
import { useAdvancedWebRTC } from '../../hooks/webrtc/useAdvancedWebRTC';

const AdvancedVideo = memo(forwardRef(({ 
  stream, 
  name = 'Participant', 
  isLocal = false, 
  handRaised = false,
  enableAI = true,
  showControls = true,
  qualityLevel = 'medium',
  onQualityChange,
  peerId
}, ref) => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [isPiP, setIsPiP] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAIControls, setShowAIControls] = useState(false);
  const [connectionQuality, setConnectionQualityState] = useState('good');
  const [processingEnabled, setProcessingEnabled] = useState(false);

  // Advanced WebRTC features
  const {
    backgroundMode,
    backgroundIntensity,
    noiseCancellation,
    voiceEnhancement,
    processVideoFrame,
    toggleBackgroundBlur,
    toggleNoiseCancellation,
    toggleVoiceEnhancement,
    setAudioEffect,
    enabledFeatures,
    aiProcessingStats,
    connectionStats,
    setConnectionQuality
  } = useAdvancedWebRTC();

  // Video processing state
  const [aiFeatures, setAIFeatures] = useState({
    backgroundBlur: false,
    backgroundReplace: false,
    noiseCancellation: false,
    voiceEnhancement: false,
    gestureRecognition: false,
    autoFraming: false
  });

  const [audioEffects, setAudioEffects] = useState({
    echo: false,
    robot: false,
    whisper: false
  });

  const [videoEffects, setVideoEffects] = useState({
    beauty: false,
    vintage: false,
    contrast: 1.0,
    brightness: 1.0,
    saturation: 1.0
  });

  // Setup video element
  useEffect(() => {
    if (!videoRef.current || !stream) return;
    
    try {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => console.error('Error playing video:', err));
    } catch (err) {
      console.error('Video setup error:', err);
    }

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  // AI video processing
  useEffect(() => {
    if (!isLocal || !enableAI || !videoRef.current) return;

    let animationFrame;
    
    const processFrame = async () => {
      if (processingEnabled && (backgroundMode !== 'none' || Object.values(videoEffects).some(v => v !== false && v !== 1.0))) {
        await processVideoFrame(videoRef.current);
      }
      animationFrame = requestAnimationFrame(processFrame);
    };

    if (videoRef.current.readyState >= 2) {
      processFrame();
    } else {
      videoRef.current.addEventListener('loadeddata', processFrame);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      videoRef.current?.removeEventListener('loadeddata', processFrame);
    };
  }, [isLocal, enableAI, processingEnabled, backgroundMode, videoEffects, processVideoFrame]);

  // Monitor connection quality
  useEffect(() => {
    if (!peerId || isLocal) return;

    const stats = connectionStats[peerId];
    if (stats) {
      const quality = getQualityIndicator(stats);
      setConnectionQuality(quality);
    }
  }, [connectionStats, peerId, isLocal]);

  // Quality indicator calculation
  const getQualityIndicator = useCallback((stats) => {
    if (!stats) return 'unknown';
    
    const rtt = stats.rtt || 0;
    const packetLoss = stats.packetsLost || 0;
    const bandwidth = (stats.bandwidth?.download || 0) + (stats.bandwidth?.upload || 0);
    
    if (rtt < 50 && packetLoss < 0.5 && bandwidth > 1000000) return 'excellent';
    if (rtt < 100 && packetLoss < 1 && bandwidth > 500000) return 'good';
    if (rtt < 200 && packetLoss < 3 && bandwidth > 200000) return 'fair';
    return 'poor';
  }, []);

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

  // AI Feature handlers
  const handleBackgroundBlur = async () => {
    const newState = !aiFeatures.backgroundBlur;
    setAIFeatures(prev => ({ ...prev, backgroundBlur: newState }));
    await toggleBackgroundBlur(newState, backgroundIntensity);
    setProcessingEnabled(newState);
  };

  const handleNoiseCancellation = () => {
    const newState = !aiFeatures.noiseCancellation;
    setAIFeatures(prev => ({ ...prev, noiseCancellation: newState }));
    toggleNoiseCancellation(newState);
  };

  const handleVoiceEnhancement = () => {
    const newState = !aiFeatures.voiceEnhancement;
    setAIFeatures(prev => ({ ...prev, voiceEnhancement: newState }));
    toggleVoiceEnhancement(newState);
  };

  const handleAudioEffect = (effect) => {
    const newState = !audioEffects[effect];
    setAudioEffects(prev => ({ ...prev, [effect]: newState }));
    setAudioEffect(effect, newState);
  };

  const handleQualityChange = (newQuality) => {
    if (onQualityChange) {
      onQualityChange(peerId, newQuality);
    }
    if (setConnectionQuality && peerId) {
      setConnectionQuality(peerId, newQuality);
    }
  };

  // PiP event listeners
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

  // Fullscreen event listeners
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement && document.fullscreenElement === videoRef.current);
    };
    
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const getQualityColor = (quality) => {
    switch (quality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'fair': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getQualityBars = (quality) => {
    const bars = [];
    const levels = { excellent: 4, good: 3, fair: 2, poor: 1, unknown: 0 };
    const activeCount = levels[quality] || 0;
    
    for (let i = 0; i < 4; i++) {
      bars.push(
        <div
          key={i}
          className={`w-1 rounded-full ${
            i < activeCount ? 'bg-current' : 'bg-gray-600'
          }`}
          style={{ height: `${(i + 1) * 3}px` }}
        />
      );
    }
    return bars;
  };

  return (
    <div className="relative w-full h-full group">
      {/* Main Video Element */}
      <video
        ref={videoRef}
        muted={isLocal}
        autoPlay
        playsInline
        className="w-full h-full object-cover transition-all duration-300"
      />
      
      {/* Processed Canvas (for AI features) */}
      {processingEnabled && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: processingEnabled ? 'block' : 'none' }}
        />
      )}
      
      {/* Video Overlay Controls */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-black/60 via-transparent to-black/40">
        
        {/* Top Controls */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          
          {/* Status Indicators */}
          <div className="flex items-center gap-2">
            {handRaised && (
              <div className="bg-warning-500 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg animate-pulse">
                ✋ Hand Raised
              </div>
            )}
            
            {isLocal && processingEnabled && (
              <div className="bg-purple-500 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg">
                🤖 AI Processing
              </div>
            )}
            
            {isLocal && Object.values(aiFeatures).some(Boolean) && (
              <div className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg">
                ✨ Enhanced
              </div>
            )}
          </div>
          
          {/* Main Controls */}
          <div className="flex items-center gap-2">
            
            {/* AI Controls Toggle (Local Only) */}
            {isLocal && enableAI && showControls && (
              <button
                onClick={() => setShowAIControls(!showAIControls)}
                className={`p-2 bg-black/60 backdrop-blur-sm rounded-lg text-white hover:bg-purple-600 transition-all duration-200 ${
                  showAIControls ? 'bg-purple-600' : ''
                }`}
                title="AI Features"
                aria-label="Toggle AI Controls"
              >
                <span className="text-sm">🤖</span>
              </button>
            )}
            
            {/* Quality Control */}
            {!isLocal && showControls && (
              <div className="relative">
                <select
                  value={qualityLevel}
                  onChange={(e) => handleQualityChange(e.target.value)}
                  className="bg-black/60 backdrop-blur-sm text-white text-sm rounded-lg px-2 py-1 border-none outline-none"
                >
                  <option value="low">360p</option>
                  <option value="medium">720p</option>
                  <option value="high">1080p</option>
                </select>
              </div>
            )}
            
            {/* Picture-in-Picture */}
            <button
              onClick={handlePiP}
              className={`p-2 bg-black/60 backdrop-blur-sm rounded-lg text-white hover:bg-primary-600 transition-all duration-200 ${
                isPiP ? 'opacity-50 cursor-not-allowed' : ''
              }`}
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
        
        {/* AI Controls Panel */}
        {isLocal && showAIControls && enabledFeatures && (
          <div className="absolute top-16 right-3 bg-black/80 backdrop-blur-md rounded-lg p-4 w-64 max-h-96 overflow-y-auto">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              🤖 AI Features
              <span className="text-xs bg-purple-600 px-2 py-0.5 rounded-full">
                {Object.values(aiFeatures).filter(Boolean).length} active
              </span>
            </h3>
            
            {/* Video AI Features */}
            <div className="space-y-2 mb-4">
              <h4 className="text-white/80 text-sm font-medium">Video Enhancement</h4>
              
              {enabledFeatures.features.AI_BACKGROUND_BLUR?.enabled && (
                <label className="flex items-center justify-between text-white/90 text-sm">
                  <span>Background Blur</span>
                  <input
                    type="checkbox"
                    checked={aiFeatures.backgroundBlur}
                    onChange={handleBackgroundBlur}
                    className="ml-2"
                  />
                </label>
              )}
              
              {enabledFeatures.features.AI_BACKGROUND_REPLACEMENT?.enabled && (
                <label className="flex items-center justify-between text-white/90 text-sm">
                  <span>Virtual Background</span>
                  <input
                    type="checkbox"
                    checked={aiFeatures.backgroundReplace}
                    onChange={() => setAIFeatures(prev => ({ ...prev, backgroundReplace: !prev.backgroundReplace }))}
                    className="ml-2"
                  />
                </label>
              )}
              
              {enabledFeatures.features.BEAUTY_FILTERS?.enabled && (
                <label className="flex items-center justify-between text-white/90 text-sm">
                  <span>Beauty Filter</span>
                  <input
                    type="checkbox"
                    checked={videoEffects.beauty}
                    onChange={() => setVideoEffects(prev => ({ ...prev, beauty: !prev.beauty }))}
                    className="ml-2"
                  />
                </label>
              )}
            </div>
            
            {/* Audio AI Features */}
            <div className="space-y-2 mb-4">
              <h4 className="text-white/80 text-sm font-medium">Audio Enhancement</h4>
              
              {enabledFeatures.features.AI_NOISE_CANCELLATION?.enabled && (
                <label className="flex items-center justify-between text-white/90 text-sm">
                  <span>Noise Cancellation</span>
                  <input
                    type="checkbox"
                    checked={aiFeatures.noiseCancellation}
                    onChange={handleNoiseCancellation}
                    className="ml-2"
                  />
                </label>
              )}
              
              <label className="flex items-center justify-between text-white/90 text-sm">
                <span>Voice Enhancement</span>
                <input
                  type="checkbox"
                  checked={aiFeatures.voiceEnhancement}
                  onChange={handleVoiceEnhancement}
                  className="ml-2"
                />
              </label>
            </div>
            
            {/* Audio Effects */}
            <div className="space-y-2">
              <h4 className="text-white/80 text-sm font-medium">Audio Effects</h4>
              
              <label className="flex items-center justify-between text-white/90 text-sm">
                <span>Echo</span>
                <input
                  type="checkbox"
                  checked={audioEffects.echo}
                  onChange={() => handleAudioEffect('echo')}
                  className="ml-2"
                />
              </label>
              
              <label className="flex items-center justify-between text-white/90 text-sm">
                <span>Robot Voice</span>
                <input
                  type="checkbox"
                  checked={audioEffects.robot}
                  onChange={() => handleAudioEffect('robot')}
                  className="ml-2"
                />
              </label>
              
              <label className="flex items-center justify-between text-white/90 text-sm">
                <span>Whisper Mode</span>
                <input
                  type="checkbox"
                  checked={audioEffects.whisper}
                  onChange={() => handleAudioEffect('whisper')}
                  className="ml-2"
                />
              </label>
            </div>
            
            {/* Performance Stats */}
            {aiProcessingStats && Object.keys(aiProcessingStats).length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/20">
                <h4 className="text-white/80 text-xs font-medium mb-2">Performance</h4>
                {aiProcessingStats.backgroundProcessing && (
                  <div className="text-xs text-white/70">
                    Processing: {aiProcessingStats.backgroundProcessing.averageProcessingTime?.toFixed(1)}ms
                  </div>
                )}
                {aiProcessingStats.audioEnhancement && (
                  <div className="text-xs text-white/70">
                    Audio CPU: {aiProcessingStats.audioEnhancement.cpuUsage?.toFixed(1)}%
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Network Quality Indicator */}
        {!isLocal && (
          <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <div className="flex items-center gap-2">
                <div className={`flex items-end gap-0.5 ${getQualityColor(connectionQuality)}`}>
                  {getQualityBars(connectionQuality)}
                </div>
                <span className={`text-xs capitalize ${getQualityColor(connectionQuality)}`}>
                  {connectionQuality}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom Overlay - Always Visible */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
        <div className="flex items-center justify-between">
          
          {/* Participant Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
              isLocal 
                ? 'bg-gradient-to-br from-primary-500 to-primary-700' 
                : 'bg-gradient-to-br from-surface-600 to-surface-700'
            }`}>
              {name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            
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
                {Object.values(aiFeatures).some(Boolean) && (
                  <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    AI
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  isLocal ? 'bg-green-400' : connectionQuality === 'excellent' ? 'bg-green-400' :
                  connectionQuality === 'good' ? 'bg-blue-400' :
                  connectionQuality === 'fair' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
                <span className="text-xs text-white/80">
                  {isLocal ? 'You' : `${connectionQuality} connection`}
                </span>
              </div>
            </div>
          </div>
          
          {/* Connection Quality Indicator */}
          {!isLocal && (
            <div className={`flex items-center gap-1 ${getQualityColor(connectionQuality)}`}>
              <div className="flex items-end gap-0.5">
                {getQualityBars(connectionQuality)}
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
    </div>
  );
}));

AdvancedVideo.displayName = 'AdvancedVideo';

export default AdvancedVideo;