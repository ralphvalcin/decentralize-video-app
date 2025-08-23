/**
 * Media Store - Local media stream and device management
 * Handles camera, microphone, screen sharing, and device permissions
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  MediaStore,
  MediaState,
  MediaActions,
  MediaDevice,
  MediaSettings,
} from '../types';
import { eventBus } from '../utils/EventBus';

/**
 * Initial media state
 */
const initialState: MediaState = {
  localStream: null,
  settings: {
    video: {
      enabled: true,
      width: 1280,
      height: 720,
      frameRate: 30,
    },
    audio: {
      enabled: true,
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
    },
  },
  devices: {
    audio: [],
    video: [],
  },
  screenShare: {
    isSharing: false,
  },
  isInitializing: false,
  permissions: {
    camera: null,
    microphone: null,
    screen: false,
  },
};

/**
 * Media store with comprehensive media device and stream management
 */
export const useMediaStore = create<MediaStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // =====================================================================
      // Core Actions
      // =====================================================================

      reset: () => {
        const { localStream, screenShare } = get();
        
        // Clean up existing streams
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            track.stop();
          });
        }

        if (screenShare.stream) {
          screenShare.stream.getTracks().forEach((track) => {
            track.stop();
          });
        }

        set((state) => {
          Object.assign(state, initialState);
        });

        eventBus.emit('system:cleanup', { timestamp: Date.now() });
      },

      updateState: (updates) => {
        set((state) => {
          Object.assign(state, updates);
        });
      },

      // =====================================================================
      // Stream Management
      // =====================================================================

      setLocalStream: (stream) => {
        const prevStream = get().localStream;
        
        // Clean up previous stream
        if (prevStream && prevStream !== stream) {
          prevStream.getTracks().forEach((track) => {
            track.stop();
          });
        }

        set((state) => {
          state.localStream = stream;
        });

        // Update settings based on stream
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];

          set((state) => {
            if (videoTrack) {
              state.settings.video.enabled = videoTrack.enabled;
            }
            if (audioTrack) {
              state.settings.audio.enabled = audioTrack.enabled;
            }
          });
        }

        eventBus.emit('media:stream-updated', {
          stream,
          timestamp: Date.now(),
        });
      },

      // =====================================================================
      // Settings Management
      // =====================================================================

      updateSettings: (settingsUpdates) => {
        const prevSettings = get().settings;
        
        set((state) => {
          state.settings = {
            video: { ...state.settings.video, ...settingsUpdates.video },
            audio: { ...state.settings.audio, ...settingsUpdates.audio },
          };
        });

        // Apply settings to current stream
        const { localStream } = get();
        if (localStream) {
          const videoTrack = localStream.getVideoTracks()[0];
          const audioTrack = localStream.getAudioTracks()[0];

          if (settingsUpdates.video && videoTrack) {
            if (typeof settingsUpdates.video.enabled === 'boolean') {
              videoTrack.enabled = settingsUpdates.video.enabled;
            }

            // Apply video constraints
            if (
              settingsUpdates.video.width ||
              settingsUpdates.video.height ||
              settingsUpdates.video.frameRate
            ) {
              const constraints = {
                width: settingsUpdates.video.width,
                height: settingsUpdates.video.height,
                frameRate: settingsUpdates.video.frameRate,
              };
              
              videoTrack.applyConstraints(constraints).catch((error) => {
                console.warn('Failed to apply video constraints:', error);
              });
            }
          }

          if (settingsUpdates.audio && audioTrack) {
            if (typeof settingsUpdates.audio.enabled === 'boolean') {
              audioTrack.enabled = settingsUpdates.audio.enabled;
            }

            // Apply audio constraints
            const audioConstraints: any = {};
            if (typeof settingsUpdates.audio.noiseSuppression === 'boolean') {
              audioConstraints.noiseSuppression = settingsUpdates.audio.noiseSuppression;
            }
            if (typeof settingsUpdates.audio.echoCancellation === 'boolean') {
              audioConstraints.echoCancellation = settingsUpdates.audio.echoCancellation;
            }
            if (typeof settingsUpdates.audio.autoGainControl === 'boolean') {
              audioConstraints.autoGainControl = settingsUpdates.audio.autoGainControl;
            }

            if (Object.keys(audioConstraints).length > 0) {
              audioTrack.applyConstraints(audioConstraints).catch((error) => {
                console.warn('Failed to apply audio constraints:', error);
              });
            }
          }
        }

        eventBus.emit('media:settings-changed', {
          settings: settingsUpdates,
          timestamp: Date.now(),
        });
      },

      // =====================================================================
      // Device Management
      // =====================================================================

      setDevices: (type, devices) => {
        set((state) => {
          state.devices[type] = devices;
        });
      },

      // =====================================================================
      // Media Controls
      // =====================================================================

      toggleAudio: () => {
        const { localStream, settings } = get();
        
        if (!localStream) {
          console.warn('No local stream available for audio toggle');
          return settings.audio.enabled;
        }

        const audioTrack = localStream.getAudioTracks()[0];
        if (!audioTrack) {
          console.warn('No audio track available for toggle');
          return settings.audio.enabled;
        }

        const newEnabled = !audioTrack.enabled;
        audioTrack.enabled = newEnabled;

        set((state) => {
          state.settings.audio.enabled = newEnabled;
        });

        eventBus.emit('media:settings-changed', {
          settings: { audio: { enabled: newEnabled } },
          timestamp: Date.now(),
        });

        return newEnabled;
      },

      toggleVideo: () => {
        const { localStream, settings } = get();
        
        if (!localStream) {
          console.warn('No local stream available for video toggle');
          return settings.video.enabled;
        }

        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) {
          console.warn('No video track available for toggle');
          return settings.video.enabled;
        }

        const newEnabled = !videoTrack.enabled;
        videoTrack.enabled = newEnabled;

        set((state) => {
          state.settings.video.enabled = newEnabled;
        });

        eventBus.emit('media:settings-changed', {
          settings: { video: { enabled: newEnabled } },
          timestamp: Date.now(),
        });

        return newEnabled;
      },

      // =====================================================================
      // Screen Sharing
      // =====================================================================

      startScreenShare: (stream) => {
        // Stop any existing screen share
        const { screenShare } = get();
        if (screenShare.stream) {
          screenShare.stream.getTracks().forEach((track) => {
            track.stop();
          });
        }

        set((state) => {
          state.screenShare = {
            isSharing: true,
            stream,
            startTime: Date.now(),
          };
        });

        // Set up stream end handler
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.addEventListener('ended', () => {
            get().stopScreenShare();
          });
        }

        eventBus.emit('screen:share-started', {
          stream,
          timestamp: Date.now(),
        });
      },

      stopScreenShare: () => {
        const { screenShare } = get();
        
        if (screenShare.stream) {
          screenShare.stream.getTracks().forEach((track) => {
            track.stop();
          });
        }

        set((state) => {
          state.screenShare = {
            isSharing: false,
          };
        });

        eventBus.emit('screen:share-stopped', {
          timestamp: Date.now(),
        });
      },

      // =====================================================================
      // Permissions Management
      // =====================================================================

      updatePermissions: (permissionUpdates) => {
        set((state) => {
          state.permissions = { ...state.permissions, ...permissionUpdates };
        });
      },
    }))
  )
);

// ============================================================================
// Device Enumeration and Initialization Utilities
// ============================================================================

/**
 * Initialize media devices and permissions
 */
export const initializeMediaDevices = async (): Promise<void> => {
  const store = useMediaStore.getState();
  
  store.updateState({ isInitializing: true });

  try {
    // Request permissions first
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    // Set initial stream
    store.setLocalStream(stream);

    // Update permissions
    store.updatePermissions({
      camera: 'granted',
      microphone: 'granted',
    });

    // Enumerate devices
    await enumerateMediaDevices();

    // Check screen share support
    const screenSupported = 'getDisplayMedia' in navigator.mediaDevices;
    store.updatePermissions({ screen: screenSupported });

  } catch (error) {
    console.error('Failed to initialize media devices:', error);
    
    // Update permissions based on error
    if (error instanceof DOMException) {
      const permission: PermissionState = 
        error.name === 'NotAllowedError' ? 'denied' : 'prompt';
      
      store.updatePermissions({
        camera: permission,
        microphone: permission,
      });
    }

    eventBus.emit('system:error', {
      error: error as Error,
      context: 'media-initialization',
      timestamp: Date.now(),
    });
  } finally {
    store.updateState({ isInitializing: false });
  }
};

/**
 * Enumerate available media devices
 */
export const enumerateMediaDevices = async (): Promise<void> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    const audioDevices: MediaDevice[] = [];
    const videoDevices: MediaDevice[] = [];

    devices.forEach((device) => {
      const mediaDevice: MediaDevice = {
        deviceId: device.deviceId,
        kind: device.kind,
        label: device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`,
        groupId: device.groupId,
      };

      if (device.kind === 'audioinput') {
        audioDevices.push(mediaDevice);
      } else if (device.kind === 'videoinput') {
        videoDevices.push(mediaDevice);
      }
    });

    const store = useMediaStore.getState();
    store.setDevices('audio', audioDevices);
    store.setDevices('video', videoDevices);

  } catch (error) {
    console.error('Failed to enumerate media devices:', error);
  }
};

/**
 * Switch to a different media device
 */
export const switchMediaDevice = async (
  type: 'audio' | 'video',
  deviceId: string
): Promise<void> => {
  const store = useMediaStore.getState();
  const { localStream, settings } = store;

  if (!localStream) {
    console.warn('No local stream available for device switching');
    return;
  }

  try {
    const constraints: MediaStreamConstraints = {};
    
    if (type === 'video') {
      constraints.video = {
        deviceId: { exact: deviceId },
        width: settings.video.width,
        height: settings.video.height,
        frameRate: settings.video.frameRate,
      };
      constraints.audio = localStream.getAudioTracks().length > 0;
    } else {
      constraints.audio = {
        deviceId: { exact: deviceId },
        noiseSuppression: settings.audio.noiseSuppression,
        echoCancellation: settings.audio.echoCancellation,
        autoGainControl: settings.audio.autoGainControl,
      };
      constraints.video = localStream.getVideoTracks().length > 0;
    }

    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Replace tracks in the local stream
    if (type === 'video') {
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStream.getVideoTracks()[0];
      
      if (oldVideoTrack) {
        localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      
      if (newVideoTrack) {
        localStream.addTrack(newVideoTrack);
      }
    } else {
      const newAudioTrack = newStream.getAudioTracks()[0];
      const oldAudioTrack = localStream.getAudioTracks()[0];
      
      if (oldAudioTrack) {
        localStream.removeTrack(oldAudioTrack);
        oldAudioTrack.stop();
      }
      
      if (newAudioTrack) {
        localStream.addTrack(newAudioTrack);
      }
    }

    // Update settings with new device
    store.updateSettings({
      [type]: { deviceId },
    });

    // Clean up the temporary stream (tracks are already moved)
    newStream.getTracks().forEach((track) => {
      if (!localStream.getTracks().includes(track)) {
        track.stop();
      }
    });

    eventBus.emit('media:device-changed', {
      type,
      device: store.devices[type].find((d) => d.deviceId === deviceId)!,
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error(`Failed to switch ${type} device:`, error);
    
    eventBus.emit('system:error', {
      error: error as Error,
      context: `media-device-switch-${type}`,
      timestamp: Date.now(),
    });
  }
};

// ============================================================================
// Selectors for Optimized Component Subscriptions
// ============================================================================

/**
 * Local stream selector
 */
export const useLocalStream = () =>
  useMediaStore((state) => state.localStream);

/**
 * Media settings selector
 */
export const useMediaSettings = () =>
  useMediaStore((state) => state.settings);

/**
 * Audio enabled selector
 */
export const useAudioEnabled = () =>
  useMediaStore((state) => state.settings.audio.enabled);

/**
 * Video enabled selector
 */
export const useVideoEnabled = () =>
  useMediaStore((state) => state.settings.video.enabled);

/**
 * Available devices selector
 */
export const useMediaDevices = () =>
  useMediaStore((state) => state.devices);

/**
 * Screen share state selector
 */
export const useScreenShare = () =>
  useMediaStore((state) => state.screenShare);

/**
 * Media permissions selector
 */
export const useMediaPermissions = () =>
  useMediaStore((state) => state.permissions);

/**
 * Media initialization state selector
 */
export const useMediaInitialization = () =>
  useMediaStore((state) => ({
    isInitializing: state.isInitializing,
    hasStream: !!state.localStream,
    permissions: state.permissions,
  }));

// ============================================================================
// Store Subscriptions and Side Effects
// ============================================================================

// Subscribe to device changes for automatic re-enumeration
if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    enumerateMediaDevices();
  });
}

export default useMediaStore;