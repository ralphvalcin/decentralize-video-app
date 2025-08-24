// AccessibleVideoControls.jsx - Fully accessible video control interface
import React, { useState, useEffect, useRef } from 'react';
import { useAccessibility } from './AccessibilityProvider';

const AccessibleVideoControls = ({
  micOn,
  camOn,
  onToggleMic,
  onToggleCamera,
  onShareScreen,
  onLeave,
  isScreenSharing = false,
  connectionStatus = 'connected',
  participantCount = 1
}) => {
  const { announce, settings, keyboardManager, focusManager } = useAccessibility();
  const controlsRef = useRef(null);
  const [activeControl, setActiveControl] = useState(0);

  // Control definitions with accessibility metadata
  const controls = [
    {
      id: 'microphone',
      label: micOn ? 'Mute microphone' : 'Unmute microphone',
      icon: micOn ? '🎤' : '🔇',
      action: onToggleMic,
      status: micOn ? 'on' : 'off',
      shortcut: 'Ctrl+D',
      description: micOn ? 'Your microphone is currently on' : 'Your microphone is currently muted'
    },
    {
      id: 'camera',
      label: camOn ? 'Turn off camera' : 'Turn on camera',
      icon: camOn ? '📹' : '🎥',
      action: onToggleCamera,
      status: camOn ? 'on' : 'off',
      shortcut: 'Ctrl+E',
      description: camOn ? 'Your camera is currently on' : 'Your camera is currently off'
    },
    {
      id: 'screen-share',
      label: isScreenSharing ? 'Stop sharing screen' : 'Share screen',
      icon: '📺',
      action: onShareScreen,
      status: isScreenSharing ? 'active' : 'inactive',
      shortcut: 'Ctrl+Shift+S',
      description: isScreenSharing ? 'You are currently sharing your screen' : 'Share your screen with participants'
    },
    {
      id: 'leave',
      label: 'Leave meeting',
      icon: '✕',
      action: onLeave,
      status: 'destructive',
      shortcut: 'Ctrl+L',
      description: 'End the meeting and disconnect from all participants',
      className: 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
    }
  ];

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!controlsRef.current?.contains(document.activeElement)) return;

      const controlElements = Array.from(controlsRef.current.querySelectorAll('[data-control]'));
      const currentIndex = controlElements.findIndex(el => el === document.activeElement);

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown':
          event.preventDefault();
          const newIndex = keyboardManager.handleArrowNavigation(
            controlElements,
            currentIndex,
            event.key
          );
          setActiveControl(newIndex);
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          if (currentIndex >= 0 && controls[currentIndex]) {
            handleControlActivation(controls[currentIndex], event);
          }
          break;

        case 'Home':
          event.preventDefault();
          controlElements[0]?.focus();
          setActiveControl(0);
          break;

        case 'End':
          event.preventDefault();
          controlElements[controlElements.length - 1]?.focus();
          setActiveControl(controlElements.length - 1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [controls, keyboardManager]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      // Skip if user is typing in an input
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      const isCtrl = event.ctrlKey || event.metaKey;

      if (isCtrl) {
        switch (event.key.toLowerCase()) {
          case 'd':
            event.preventDefault();
            handleControlActivation(controls[0], event); // Microphone
            break;
          case 'e':
            event.preventDefault();
            handleControlActivation(controls[1], event); // Camera
            break;
          case 's':
            if (event.shiftKey) {
              event.preventDefault();
              handleControlActivation(controls[2], event); // Screen share
            }
            break;
          case 'l':
            event.preventDefault();
            handleControlActivation(controls[3], event); // Leave
            break;
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [controls]);

  // Handle control activation with accessibility feedback
  const handleControlActivation = async (control, event) => {
    try {
      await control.action();
      
      // Announce the action to screen readers
      const announcement = `${control.label} activated. ${control.description}`;
      announce(announcement);

      // Provide haptic feedback on mobile if supported
      if (navigator.vibrate && 'ontouchstart' in window) {
        navigator.vibrate(50);
      }

    } catch (error) {
      console.error(`Error activating ${control.id}:`, error);
      announce(`Error: Unable to ${control.label.toLowerCase()}. Please try again.`, 'assertive');
    }
  };

  // Connection status announcement
  useEffect(() => {
    const statusMessages = {
      connected: 'Connection stable',
      connecting: 'Connecting to meeting',
      reconnecting: 'Reconnecting to meeting',
      disconnected: 'Disconnected from meeting',
      error: 'Connection error - please check your internet connection'
    };

    if (statusMessages[connectionStatus]) {
      announce(statusMessages[connectionStatus]);
    }
  }, [connectionStatus, announce]);

  // Touch target size calculation based on accessibility settings
  const getTouchTargetClass = () => {
    if (settings.largerTouchTargets) {
      return 'w-16 h-16 sm:w-20 sm:h-20'; // 64px/80px minimum
    }
    return 'w-12 h-12 sm:w-14 sm:h-14'; // 48px/56px standard
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Skip link to main controls */}
      <a
        href="#video-controls"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
          bg-blue-600 text-white px-4 py-2 rounded z-60"
      >
        Skip to video controls
      </a>

      <div
        id="video-controls"
        ref={controlsRef}
        role="toolbar"
        aria-label="Video call controls"
        aria-orientation="horizontal"
        className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 
          flex items-center justify-center gap-2 sm:gap-4 px-4 py-4"
      >
        {/* Connection status indicator */}
        <div className="sr-only" aria-live="polite">
          Connection status: {connectionStatus}
        </div>

        {/* Main controls */}
        <div className="flex items-center gap-2 sm:gap-4" role="group" aria-label="Primary controls">
          {controls.map((control, index) => (
            <button
              key={control.id}
              data-control={control.id}
              onClick={(e) => handleControlActivation(control, e)}
              className={`
                relative flex items-center justify-center ${getTouchTargetClass()}
                rounded-full transition-all duration-200 focus:outline-none
                focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50
                ${control.className || (
                  control.status === 'on' || control.status === 'active'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : control.status === 'off'
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                )}
                ${settings.highContrast ? 'border-2 border-current' : ''}
              `}
              aria-label={control.label}
              aria-description={control.description}
              aria-pressed={control.status === 'on' || control.status === 'active'}
              aria-keyshortcuts={control.shortcut}
              title={`${control.label} (${control.shortcut})`}
            >
              {/* Icon */}
              <span 
                className="text-xl sm:text-2xl" 
                aria-hidden="true"
                role="img"
                aria-label={control.icon === '🎤' ? 'microphone' : 
                           control.icon === '📹' ? 'camera' :
                           control.icon === '🔇' ? 'muted microphone' :
                           control.icon === '🎥' ? 'camera off' :
                           control.icon === '📺' ? 'screen share' :
                           control.icon === '✕' ? 'leave meeting' : ''}
              >
                {control.icon}
              </span>

              {/* Status indicator for screen readers */}
              <span className="sr-only">
                {control.status === 'on' ? ', currently on' :
                 control.status === 'off' ? ', currently off' :
                 control.status === 'active' ? ', currently active' : ''}
              </span>

              {/* Visual status indicator */}
              {(control.status === 'off' || control.status === 'active') && (
                <div
                  className={`absolute -top-1 -right-1 w-3 h-3 rounded-full
                    ${control.status === 'off' ? 'bg-red-400' : 'bg-green-400'}
                  `}
                  aria-hidden="true"
                />
              )}

              {/* Enhanced focus indicator */}
              <div 
                className="absolute inset-0 rounded-full border-2 border-transparent
                  peer-focus:border-blue-400 transition-colors"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>

        {/* Meeting info */}
        <div className="ml-auto flex items-center space-x-4">
          {/* Participant count */}
          <div 
            className="text-gray-300 text-sm hidden sm:flex items-center space-x-2"
            aria-live="polite"
            role="status"
          >
            <span className="w-2 h-2 bg-green-400 rounded-full" aria-hidden="true"></span>
            <span>
              {participantCount} participant{participantCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Screen reader participant count */}
          <div className="sr-only" aria-live="polite">
            {participantCount === 1 ? 'You are alone in the meeting' :
             `${participantCount} people are in this meeting`}
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts help (toggle with ?) */}
      <div className="sr-only" role="region" aria-label="Keyboard shortcuts">
        <h3>Available keyboard shortcuts:</h3>
        <ul>
          {controls.map(control => (
            <li key={control.id}>
              {control.shortcut}: {control.label}
            </li>
          ))}
          <li>Arrow keys: Navigate between controls</li>
          <li>Enter or Space: Activate focused control</li>
          <li>Home: Focus first control</li>
          <li>End: Focus last control</li>
        </ul>
      </div>
    </div>
  );
};

export default AccessibleVideoControls;