import toast from 'react-hot-toast';

class MediaStreamService {
  constructor() {
    this.currentStream = null;
    this.screenStream = null;
    this.isScreenSharing = false;
    this.devices = {
      cameras: [],
      microphones: []
    };

    // Default constraints
    this.constraints = {
      video: true,
      audio: true
    };
  }

  async getUserMedia(constraints = this.constraints) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentStream = stream;
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      let errorMessage = 'Failed to access camera or microphone';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone access denied. Please allow permissions.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera or microphone is already in use.';
      }
      
      toast.error(`❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  async getDisplayMedia() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      this.screenStream = screenStream;
      this.isScreenSharing = true;
      toast.success('🖥️ Screen sharing started');

      // Handle screen sharing stop
      screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenSharing();
        toast.info('📤 Screen sharing ended');
      };

      return screenStream;
    } catch (err) {
      console.error('Error sharing screen:', err);
      toast.error('❌ Failed to share screen');
      throw err;
    }
  }

  stopScreenSharing() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    this.isScreenSharing = false;
  }

  toggleAudio() {
    if (this.currentStream) {
      const audioTrack = this.currentStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toast.success(
          audioTrack.enabled ? '🎤 Microphone unmuted' : '🔇 Microphone muted'
        );
        return audioTrack.enabled;
      }
    }
    return false;
  }

  toggleVideo() {
    if (this.currentStream) {
      const videoTrack = this.currentStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toast.success(
          videoTrack.enabled ? '📹 Camera turned on' : '🎥 Camera turned off'
        );
        return videoTrack.enabled;
      }
    }
    return false;
  }

  getAudioEnabled() {
    if (this.currentStream) {
      const audioTrack = this.currentStream.getAudioTracks()[0];
      return audioTrack ? audioTrack.enabled : false;
    }
    return false;
  }

  getVideoEnabled() {
    if (this.currentStream) {
      const videoTrack = this.currentStream.getVideoTracks()[0];
      return videoTrack ? videoTrack.enabled : false;
    }
    return false;
  }

  async enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices.cameras = devices.filter(device => device.kind === 'videoinput');
      this.devices.microphones = devices.filter(device => device.kind === 'audioinput');
      return this.devices;
    } catch (err) {
      console.error('Error enumerating devices:', err);
      return this.devices;
    }
  }

  async switchCamera(deviceId) {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: this.constraints.audio
      });
      
      // Stop current stream
      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => track.stop());
      }
      
      this.currentStream = newStream;
      toast.success('📹 Camera switched successfully');
      return newStream;
    } catch (err) {
      console.error('Error switching camera:', err);
      toast.error('Failed to switch camera');
      throw err;
    }
  }

  async switchMicrophone(deviceId) {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: this.constraints.video,
        audio: { deviceId: { exact: deviceId } }
      });
      
      // Stop current stream
      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => track.stop());
      }
      
      this.currentStream = newStream;
      toast.success('🎤 Microphone switched successfully');
      return newStream;
    } catch (err) {
      console.error('Error switching microphone:', err);
      toast.error('Failed to switch microphone');
      throw err;
    }
  }

  setVideoQuality(quality) {
    const qualitySettings = {
      low: { width: 320, height: 240 },
      medium: { width: 640, height: 480 },
      high: { width: 1280, height: 720 },
      hd: { width: 1920, height: 1080 }
    };

    if (qualitySettings[quality]) {
      this.constraints.video = {
        ...qualitySettings[quality],
        frameRate: { ideal: 30 }
      };
    }
  }

  getCurrentStream() {
    return this.currentStream;
  }

  getScreenStream() {
    return this.screenStream;
  }

  stopAllStreams() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
    
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    
    this.isScreenSharing = false;
  }

  // Get stream statistics
  getStreamStats() {
    const stats = {
      hasAudio: false,
      hasVideo: false,
      audioEnabled: false,
      videoEnabled: false,
      isScreenSharing: this.isScreenSharing
    };

    if (this.currentStream) {
      const audioTracks = this.currentStream.getAudioTracks();
      const videoTracks = this.currentStream.getVideoTracks();
      
      stats.hasAudio = audioTracks.length > 0;
      stats.hasVideo = videoTracks.length > 0;
      stats.audioEnabled = audioTracks.length > 0 && audioTracks[0].enabled;
      stats.videoEnabled = videoTracks.length > 0 && videoTracks[0].enabled;
    }

    return stats;
  }
}

export default MediaStreamService;