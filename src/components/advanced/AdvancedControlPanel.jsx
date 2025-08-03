/**
 * Advanced Control Panel
 * Centralized control interface for all advanced WebRTC features
 */

import { useState, useEffect } from 'react';
import { useAdvancedWebRTC } from '../../hooks/webrtc/useAdvancedWebRTC';

const AdvancedControlPanel = ({ 
  isVisible, 
  onClose, 
  onToggleWhiteboard,
  onShareFile,
  onStartRecording,
  onCreateBreakoutRoom 
}) => {
  const {
    enabledFeatures,
    aiProcessingStats,
    performanceMetrics,
    networkConditions,
    connectionStats,
    backgroundMode,
    backgroundIntensity,
    noiseCancellation,
    voiceEnhancement,
    toggleBackgroundBlur,
    toggleNoiseCancellation,
    toggleVoiceEnhancement,
    setAudioEffect,
    services
  } = useAdvancedWebRTC();

  const [activeTab, setActiveTab] = useState('ai');
  const [showPerformance, setShowPerformance] = useState(false);
  const [virtualBackground, setVirtualBackground] = useState('none');
  const [audioEffects, setAudioEffects] = useState({
    echo: false,
    robot: false,
    whisper: false,
    reverb: false
  });

  const [qualitySettings, setQualitySettings] = useState({
    preset: 'balanced',
    customBitrate: 1000000,
    frameRate: 30,
    resolution: '1280x720'
  });

  const [collaborationSettings, setCollaborationSettings] = useState({
    whiteboardEnabled: false,
    fileSharingEnabled: true,
    maxFileSize: 100,
    allowedFileTypes: ['image/*', 'application/pdf', 'text/*']
  });

  const [networkOptimization, setNetworkOptimization] = useState({
    simulcastEnabled: true,
    adaptiveQuality: true,
    bandwidthOptimization: true,
    predictiveAdjustment: true
  });

  useEffect(() => {
    if (!isVisible) return;

    // Auto-hide after 30 seconds of inactivity
    const hideTimer = setTimeout(() => {
      onClose();
    }, 30000);

    return () => clearTimeout(hideTimer);
  }, [isVisible, onClose]);

  const handleBackgroundChange = async (mode) => {
    setVirtualBackground(mode);
    
    switch (mode) {
      case 'blur':
        await toggleBackgroundBlur(true, backgroundIntensity);
        break;
      case 'none':
        await toggleBackgroundBlur(false);
        break;
      default:
        // Handle virtual background replacement
        await toggleBackgroundBlur(false);
        // Implement virtual background logic
    }
  };

  const handleAudioEffectToggle = (effect) => {
    const newState = !audioEffects[effect];
    setAudioEffects(prev => ({ ...prev, [effect]: newState }));
    setAudioEffect(effect, newState);
  };

  const handleQualityPresetChange = (preset) => {
    setQualitySettings(prev => ({ ...prev, preset }));
    
    const presets = {
      'power_saver': { bitrate: 300000, frameRate: 15, resolution: '640x480' },
      'balanced': { bitrate: 1000000, frameRate: 24, resolution: '1280x720' },
      'high_quality': { bitrate: 2500000, frameRate: 30, resolution: '1920x1080' },
      'ultra': { bitrate: 4000000, frameRate: 60, resolution: '1920x1080' }
    };
    
    const presetConfig = presets[preset];
    if (presetConfig) {
      setQualitySettings(prev => ({
        ...prev,
        customBitrate: presetConfig.bitrate,
        frameRate: presetConfig.frameRate,
        resolution: presetConfig.resolution
      }));
    }
  };

  const getFeatureAvailability = (feature) => {
    return enabledFeatures?.features[feature]?.enabled || false;
  };

  const getPerformanceColor = (value, thresholds) => {
    if (value <= thresholds.good) return 'text-green-400';
    if (value <= thresholds.fair) return 'text-yellow-400';
    return 'text-red-400';
  };

  const tabs = [
    { id: 'ai', label: 'AI Features', icon: '🤖' },
    { id: 'quality', label: 'Quality', icon: '🎥' },
    { id: 'collaboration', label: 'Collaboration', icon: '🤝' },
    { id: 'network', label: 'Network', icon: '📡' },
    { id: 'analytics', label: 'Analytics', icon: '📊' }
  ];

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface-900 rounded-xl shadow-2xl w-full max-w-4xl h-full max-h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-xl">⚙️</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Advanced Controls</h2>
              <p className="text-surface-400 text-sm">
                Configure AI features, quality settings, and collaboration tools
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPerformance(!showPerformance)}
              className={`p-2 rounded-lg transition-colors ${
                showPerformance 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
              }`}
              title="Performance Monitor"
            >
              📊
            </button>
            
            <button
              onClick={onClose}
              className="p-2 bg-surface-700 text-surface-300 rounded-lg hover:bg-surface-600 transition-colors"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar Tabs */}
          <div className="w-48 bg-surface-800 border-r border-surface-700 p-4">
            <div className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-600 text-white'
                      : 'text-surface-300 hover:bg-surface-700'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
            
            {/* Performance Summary */}
            {showPerformance && performanceMetrics && (
              <div className="mt-6 p-3 bg-surface-700 rounded-lg">
                <h4 className="text-white text-xs font-semibold mb-2">Performance</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-surface-300">RTT:</span>
                    <span className={getPerformanceColor(performanceMetrics.averageRTT, { good: 50, fair: 100 })}>
                      {performanceMetrics.averageRTT?.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-300">Connections:</span>
                    <span className="text-white">{performanceMetrics.activeConnections}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-300">Packet Loss:</span>
                    <span className={getPerformanceColor(performanceMetrics.packetLoss, { good: 1, fair: 3 })}>
                      {performanceMetrics.packetLoss?.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            
            {/* AI Features Tab */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">AI-Powered Features</h3>
                  
                  {/* Video Enhancement */}
                  <div className="bg-surface-800 rounded-lg p-4 mb-4">
                    <h4 className="text-white font-medium mb-3">Video Enhancement</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Background Options */}
                      <div>
                        <label className="block text-surface-300 text-sm mb-2">Background</label>
                        <select
                          value={virtualBackground}
                          onChange={(e) => handleBackgroundChange(e.target.value)}
                          disabled={!getFeatureAvailability('AI_BACKGROUND_BLUR')}
                          className="w-full bg-surface-700 text-white rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="none">None</option>
                          <option value="blur">Blur</option>
                          <option value="office">Virtual Office</option>
                          <option value="nature">Nature Scene</option>
                          <option value="abstract">Abstract</option>
                        </select>
                      </div>
                      
                      {/* Blur Intensity */}
                      {virtualBackground === 'blur' && (
                        <div>
                          <label className="block text-surface-300 text-sm mb-2">
                            Blur Intensity: {backgroundIntensity}
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="20"
                            value={backgroundIntensity}
                            onChange={(e) => setBackgroundIntensity(Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Feature Toggles */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <label className="flex items-center justify-between">
                        <span className="text-surface-300 text-sm">Auto Framing</span>
                        <input
                          type="checkbox"
                          disabled={!getFeatureAvailability('AI_AUTO_FRAMING')}
                          className="ml-2"
                        />
                      </label>
                      
                      <label className="flex items-center justify-between">
                        <span className="text-surface-300 text-sm">Gesture Recognition</span>
                        <input
                          type="checkbox"
                          disabled={!getFeatureAvailability('AI_GESTURE_RECOGNITION')}
                          className="ml-2"
                        />
                      </label>
                      
                      <label className="flex items-center justify-between">
                        <span className="text-surface-300 text-sm">Beauty Filter</span>
                        <input
                          type="checkbox"
                          disabled={!getFeatureAvailability('BEAUTY_FILTERS')}
                          className="ml-2"
                        />
                      </label>
                    </div>
                  </div>
                  
                  {/* Audio Enhancement */}
                  <div className="bg-surface-800 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">Audio Enhancement</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center justify-between">
                        <span className="text-surface-300 text-sm">Noise Cancellation</span>
                        <input
                          type="checkbox"
                          checked={noiseCancellation}
                          onChange={toggleNoiseCancellation}
                          disabled={!getFeatureAvailability('AI_NOISE_CANCELLATION')}
                          className="ml-2"
                        />
                      </label>
                      
                      <label className="flex items-center justify-between">
                        <span className="text-surface-300 text-sm">Voice Enhancement</span>
                        <input
                          type="checkbox"
                          checked={voiceEnhancement}
                          onChange={toggleVoiceEnhancement}
                          className="ml-2"
                        />
                      </label>
                    </div>
                    
                    {/* Audio Effects */}
                    <div className="mt-4">
                      <h5 className="text-surface-300 text-sm font-medium mb-2">Audio Effects</h5>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(audioEffects).map(([effect, enabled]) => (
                          <label key={effect} className="flex items-center justify-between">
                            <span className="text-surface-300 text-sm capitalize">{effect}</span>
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={() => handleAudioEffectToggle(effect)}
                              className="ml-2"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Quality Tab */}
            {activeTab === 'quality' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Quality Settings</h3>
                  
                  {/* Quality Presets */}
                  <div className="bg-surface-800 rounded-lg p-4 mb-4">
                    <h4 className="text-white font-medium mb-3">Quality Presets</h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {['power_saver', 'balanced', 'high_quality', 'ultra'].map(preset => (
                        <button
                          key={preset}
                          onClick={() => handleQualityPresetChange(preset)}
                          className={`p-3 rounded-lg text-left transition-colors ${
                            qualitySettings.preset === preset
                              ? 'bg-primary-600 text-white'
                              : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                          }`}
                        >
                          <div className="font-medium text-sm capitalize">
                            {preset.replace('_', ' ')}
                          </div>
                          <div className="text-xs mt-1 opacity-75">
                            {preset === 'power_saver' && '360p, 15fps, Low CPU'}
                            {preset === 'balanced' && '720p, 24fps, Balanced'}
                            {preset === 'high_quality' && '1080p, 30fps, High CPU'}
                            {preset === 'ultra' && '1080p, 60fps, Max Quality'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Custom Settings */}
                  <div className="bg-surface-800 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">Custom Settings</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-surface-300 text-sm mb-2">Resolution</label>
                        <select
                          value={qualitySettings.resolution}
                          onChange={(e) => setQualitySettings(prev => ({ ...prev, resolution: e.target.value }))}
                          className="w-full bg-surface-700 text-white rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="640x480">640x480 (480p)</option>
                          <option value="1280x720">1280x720 (720p)</option>
                          <option value="1920x1080">1920x1080 (1080p)</option>
                          <option value="2560x1440">2560x1440 (1440p)</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-surface-300 text-sm mb-2">Frame Rate</label>
                        <select
                          value={qualitySettings.frameRate}
                          onChange={(e) => setQualitySettings(prev => ({ ...prev, frameRate: Number(e.target.value) }))}
                          className="w-full bg-surface-700 text-white rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="15">15 FPS</option>
                          <option value="24">24 FPS</option>
                          <option value="30">30 FPS</option>
                          <option value="60">60 FPS</option>
                        </select>
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-surface-300 text-sm mb-2">
                          Bitrate: {(qualitySettings.customBitrate / 1000000).toFixed(1)} Mbps
                        </label>
                        <input
                          type="range"
                          min="100000"
                          max="10000000"
                          step="100000"
                          value={qualitySettings.customBitrate}
                          onChange={(e) => setQualitySettings(prev => ({ ...prev, customBitrate: Number(e.target.value) }))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Collaboration Tab */}
            {activeTab === 'collaboration' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Collaboration Tools</h3>
                  
                  {/* Feature Toggles */}
                  <div className="bg-surface-800 rounded-lg p-4 mb-4">
                    <h4 className="text-white font-medium mb-3">Available Features</h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-surface-700 rounded-lg">
                        <div>
                          <span className="text-white font-medium">Whiteboard</span>
                          <p className="text-surface-400 text-sm">Real-time collaborative drawing</p>
                        </div>
                        <button
                          onClick={onToggleWhiteboard}
                          className={`px-4 py-2 rounded-lg transition-colors ${
                            collaborationSettings.whiteboardEnabled
                              ? 'bg-primary-600 text-white'
                              : 'bg-surface-600 text-surface-300 hover:bg-surface-500'
                          }`}
                        >
                          {collaborationSettings.whiteboardEnabled ? 'Enabled' : 'Enable'}
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-surface-700 rounded-lg">
                        <div>
                          <span className="text-white font-medium">File Sharing</span>
                          <p className="text-surface-400 text-sm">Share files through P2P connections</p>
                        </div>
                        <button
                          onClick={onShareFile}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          Share File
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-surface-700 rounded-lg">
                        <div>
                          <span className="text-white font-medium">Screen Recording</span>
                          <p className="text-surface-400 text-sm">Record meeting with cloud storage</p>
                        </div>
                        <button
                          onClick={onStartRecording}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Start Recording
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-surface-700 rounded-lg">
                        <div>
                          <span className="text-white font-medium">Breakout Rooms</span>
                          <p className="text-surface-400 text-sm">Create separate discussion rooms</p>
                        </div>
                        <button
                          onClick={onCreateBreakoutRoom}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Create Room
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* File Sharing Settings */}
                  <div className="bg-surface-800 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">File Sharing Settings</h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-surface-300 text-sm mb-2">
                          Max File Size: {collaborationSettings.maxFileSize} MB
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="500"
                          value={collaborationSettings.maxFileSize}
                          onChange={(e) => setCollaborationSettings(prev => ({ 
                            ...prev, 
                            maxFileSize: Number(e.target.value) 
                          }))}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-surface-300 text-sm mb-2">Allowed File Types</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['image/*', 'application/pdf', 'text/*', 'video/*', 'audio/*'].map(type => (
                            <label key={type} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={collaborationSettings.allowedFileTypes.includes(type)}
                                onChange={(e) => {
                                  const types = e.target.checked
                                    ? [...collaborationSettings.allowedFileTypes, type]
                                    : collaborationSettings.allowedFileTypes.filter(t => t !== type);
                                  setCollaborationSettings(prev => ({ ...prev, allowedFileTypes: types }));
                                }}
                                className="mr-2"
                              />
                              <span className="text-surface-300 text-sm">{type}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Network Tab */}
            {activeTab === 'network' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Network Optimization</h3>
                  
                  {/* Connection Status */}
                  <div className="bg-surface-800 rounded-lg p-4 mb-4">
                    <h4 className="text-white font-medium mb-3">Connection Status</h4>
                    
                    {networkConditions && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white">
                            {networkConditions.averageRTT?.toFixed(0) || 0}
                          </div>
                          <div className="text-surface-400 text-sm">RTT (ms)</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white">
                            {((networkConditions.totalBandwidth || 0) / 1000000).toFixed(1)}
                          </div>
                          <div className="text-surface-400 text-sm">Bandwidth (Mbps)</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white">
                            {networkConditions.packetLossRate?.toFixed(1) || 0}
                          </div>
                          <div className="text-surface-400 text-sm">Packet Loss (%)</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white capitalize">
                            {networkConditions.connectionStability || 'Unknown'}
                          </div>
                          <div className="text-surface-400 text-sm">Stability</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Optimization Settings */}
                  <div className="bg-surface-800 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">Optimization Settings</h4>
                    
                    <div className="space-y-3">
                      {Object.entries(networkOptimization).map(([setting, enabled]) => (
                        <label key={setting} className="flex items-center justify-between">
                          <div>
                            <span className="text-white capitalize">
                              {setting.replace(/([A-Z])/g, ' $1')}
                            </span>
                            <p className="text-surface-400 text-sm">
                              {setting === 'simulcastEnabled' && 'Multiple quality streams for better adaptation'}
                              {setting === 'adaptiveQuality' && 'Automatic quality adjustment based on network'}
                              {setting === 'bandwidthOptimization' && 'Intelligent bandwidth allocation'}
                              {setting === 'predictiveAdjustment' && 'AI-powered connection prediction'}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setNetworkOptimization(prev => ({
                              ...prev,
                              [setting]: e.target.checked
                            }))}
                            className="ml-2"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Performance Analytics</h3>
                  
                  {/* Real-time Stats */}
                  {aiProcessingStats && (
                    <div className="bg-surface-800 rounded-lg p-4 mb-4">
                      <h4 className="text-white font-medium mb-3">AI Processing Stats</h4>
                      
                      {aiProcessingStats.backgroundProcessing && (
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-white">
                              {aiProcessingStats.backgroundProcessing.averageProcessingTime?.toFixed(1) || 0}ms
                            </div>
                            <div className="text-surface-400 text-sm">Processing Time</div>
                          </div>
                          
                          <div className="text-center">
                            <div className="text-lg font-semibold text-white">
                              {aiProcessingStats.backgroundProcessing.currentFrameRate?.toFixed(1) || 0}
                            </div>
                            <div className="text-surface-400 text-sm">Frame Rate</div>
                          </div>
                          
                          <div className="text-center">
                            <div className={`text-lg font-semibold ${
                              aiProcessingStats.backgroundProcessing.webGLEnabled ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {aiProcessingStats.backgroundProcessing.webGLEnabled ? 'GPU' : 'CPU'}
                            </div>
                            <div className="text-surface-400 text-sm">Acceleration</div>
                          </div>
                        </div>
                      )}
                      
                      {aiProcessingStats.audioEnhancement && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-white">
                              {aiProcessingStats.audioEnhancement.cpuUsage?.toFixed(1) || 0}%
                            </div>
                            <div className="text-surface-400 text-sm">Audio CPU Usage</div>
                          </div>
                          
                          <div className="text-center">
                            <div className="text-lg font-semibold text-white">
                              {aiProcessingStats.audioEnhancement.voiceActivity?.toFixed(2) || 0}
                            </div>
                            <div className="text-surface-400 text-sm">Voice Activity</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Connection Analytics */}
                  <div className="bg-surface-800 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">Connection Analytics</h4>
                    
                    {Object.keys(connectionStats).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(connectionStats).map(([peerId, stats]) => (
                          <div key={peerId} className="bg-surface-700 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white font-medium">Peer {peerId.slice(-6)}</span>
                              <span className={`text-sm px-2 py-1 rounded ${
                                stats.qualityLevel === 'high' ? 'bg-green-600' :
                                stats.qualityLevel === 'medium' ? 'bg-yellow-600' : 'bg-red-600'
                              } text-white`}>
                                {stats.qualityLevel}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div>
                                <div className="text-surface-400">RTT</div>
                                <div className="text-white">{stats.rtt?.toFixed(0) || 0}ms</div>
                              </div>
                              <div>
                                <div className="text-surface-400">Loss</div>
                                <div className="text-white">{stats.packetsLost || 0}</div>
                              </div>
                              <div>
                                <div className="text-surface-400">Jitter</div>
                                <div className="text-white">{stats.jitter?.toFixed(1) || 0}ms</div>
                              </div>
                              <div>
                                <div className="text-surface-400">Bandwidth</div>
                                <div className="text-white">
                                  {((stats.bandwidth?.download || 0) / 1000).toFixed(0)}k
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-surface-400 py-8">
                        No active connections to analyze
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-surface-700 p-4">
          <div className="flex items-center justify-between">
            <div className="text-surface-400 text-sm">
              {enabledFeatures && (
                <>
                  {enabledFeatures.summary.enabledCount} of {enabledFeatures.summary.totalFeatures} features enabled
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-surface-700 text-surface-300 rounded-lg hover:bg-surface-600 transition-colors"
              >
                Close
              </button>
              
              <button
                onClick={() => {
                  // Apply settings
                  onClose();
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Apply Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedControlPanel;