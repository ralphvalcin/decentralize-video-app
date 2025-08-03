import { useState, useEffect } from 'react';

const ConnectionStatus = ({ 
  connectionStatus, 
  stream, 
  peers, 
  onReconnect,
  signalStrength = 'good' // good, fair, poor
}) => {
  const [detailedStats, setDetailedStats] = useState({
    upload: 0,
    download: 0,
    latency: 0,
    packetLoss: 0
  });
  const [expanded, setExpanded] = useState(false);

  // Simple connection quality calculation
  const getConnectionQuality = () => {
    if (connectionStatus === 'connected' && peers.length > 0) {
      if (signalStrength === 'good') return 'excellent';
      if (signalStrength === 'fair') return 'good';
      return 'poor';
    }
    if (connectionStatus === 'connecting') return 'connecting';
    return 'disconnected';
  };

  const quality = getConnectionQuality();

  const statusConfig = {
    excellent: {
      color: 'text-green-600',
      bg: 'bg-green-100',
      icon: '🟢',
      text: 'Excellent',
      description: 'HD quality, stable connection'
    },
    good: {
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      icon: '🔵',
      text: 'Good',
      description: 'Good quality connection'
    },
    poor: {
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
      icon: '🟡',
      text: 'Fair',
      description: 'Connection may be unstable'
    },
    connecting: {
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      icon: '🔄',
      text: 'Connecting...',
      description: 'Establishing connection'
    },
    disconnected: {
      color: 'text-red-600',
      bg: 'bg-red-100',
      icon: '🔴',
      text: 'Disconnected',
      description: 'Connection lost'
    }
  };

  const config = statusConfig[quality];

  // Simulate network stats (in real app, get from WebRTC stats)
  useEffect(() => {
    const updateStats = () => {
      setDetailedStats({
        upload: Math.round(Math.random() * 1000 + 200),
        download: Math.round(Math.random() * 2000 + 500),
        latency: Math.round(Math.random() * 100 + 20),
        packetLoss: Math.round(Math.random() * 3 * 10) / 10
      });
    };

    if (quality === 'excellent' || quality === 'good') {
      updateStats();
      const interval = setInterval(updateStats, 5000);
      return () => clearInterval(interval);
    }
  }, [quality]);

  return (
    <div className="relative">
      {/* Main Status Indicator */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${config.bg} ${config.color} hover:opacity-80 transition-opacity`}
        title={config.description}
      >
        <span className={quality === 'connecting' ? 'animate-spin' : ''}>{config.icon}</span>
        <span className="text-sm font-medium">{config.text}</span>
        <span className="text-xs">({peers.length} connected)</span>
        {expanded ? '▲' : '▼'}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="absolute top-12 right-0 bg-white shadow-lg rounded-lg border p-4 min-w-64 z-50">
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-medium text-gray-900">Connection Details</h4>
              <button
                onClick={() => setExpanded(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {/* Connection Status */}
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`text-sm font-medium ${config.color}`}>
                {config.text}
              </span>
            </div>

            {/* Participants */}
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Participants:</span>
              <span className="text-sm font-medium">{peers.length + 1}</span>
            </div>

            {/* Audio/Video Status */}
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Media:</span>
              <span className="text-sm font-medium">
                {stream ? (
                  <>
                    {stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled ? '🎤' : '🔇'}
                    {stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled ? '📹' : '🚫'}
                  </>
                ) : (
                  'No media'
                )}
              </span>
            </div>

            {/* Network Stats (if connected) */}
            {(quality === 'excellent' || quality === 'good') && (
              <>
                <hr className="my-2" />
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Upload:</span>
                    <span>{detailedStats.upload} kbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Download:</span>
                    <span>{detailedStats.download} kbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latency:</span>
                    <span>{detailedStats.latency}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Packet Loss:</span>
                    <span>{detailedStats.packetLoss}%</span>
                  </div>
                </div>
              </>
            )}

            {/* Reconnect Button (if needed) */}
            {(quality === 'disconnected' || quality === 'poor') && onReconnect && (
              <>
                <hr className="my-2" />
                <button
                  onClick={onReconnect}
                  className="w-full py-2 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  🔄 Reconnect
                </button>
              </>
            )}

            {/* Tips */}
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              <strong>💡 Tips:</strong>
              <ul className="mt-1 space-y-1">
                <li>• Close other apps using internet</li>
                <li>• Move closer to your WiFi router</li>
                <li>• Check your internet connection</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;