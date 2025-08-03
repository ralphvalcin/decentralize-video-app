import React from 'react';
import StatusIndicator from './StatusIndicator';

const VideoControls = ({ 
  micOn, 
  camOn, 
  isHost, 
  connectionStatus,
  participantCount,
  onToggleMic, 
  onToggleCamera,
  onLeaveRoom,
  onToggleScreenShare,
  onToggleChat,
  onToggleParticipants
}) => {
  return (
    <div className="video-controls">
      <div className="flex items-center gap-3">
        {/* Media Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMic}
            className={`p-3 rounded-lg transition-all duration-200 ${
              micOn 
                ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micOn ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 010 1.414L13.414 10l2.243 2.243a1 1 0 11-1.414 1.414L12 11.414l-2.243 2.243a1 1 0 11-1.414-1.414L10.586 10 8.343 7.757a1 1 0 111.414-1.414L12 8.586l2.243-2.243a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <button
            onClick={onToggleCamera}
            className={`p-3 rounded-lg transition-all duration-200 ${
              camOn 
                ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={camOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {camOn ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
            )}
          </button>

          {isHost && (
            <button
              onClick={onToggleScreenShare}
              className="p-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all duration-200"
              title="Share screen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/20"></div>

        {/* Communication Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleChat}
            className="p-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all duration-200"
            title="Toggle chat"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </button>

          <button
            onClick={onToggleParticipants}
            className="p-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-all duration-200 relative"
            title="View participants"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
            </svg>
            {participantCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-medium min-w-[20px] h-5 rounded-full flex items-center justify-center px-1">
                {participantCount}
              </span>
            )}
          </button>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2 ml-2">
          <StatusIndicator 
            status={connectionStatus} 
            size="sm"
            showLabel={false}
          />
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/20"></div>

        {/* Leave Button */}
        <button
          onClick={onLeaveRoom}
          className="btn btn-danger px-4 py-2 text-sm"
          title="Leave meeting"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Leave
        </button>
      </div>
    </div>
  );
};

export default VideoControls;