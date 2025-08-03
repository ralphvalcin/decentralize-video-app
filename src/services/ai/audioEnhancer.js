/**
 * AI-Powered Audio Enhancement Service
 * Handles noise cancellation, voice enhancement, and audio effects
 */

class AudioEnhancer {
  constructor() {
    this.audioContext = null;
    this.isInitialized = false;
    this.isProcessing = false;
    
    // Audio processing nodes
    this.sourceNode = null;
    this.gainNode = null;
    this.filterNode = null;
    this.compressorNode = null;
    this.analyserNode = null;
    this.delayNode = null;
    this.convolverNode = null;
    this.scriptProcessor = null;
    
    // Noise cancellation
    this.noiseProfile = null;
    this.noiseCancellation = {
      enabled: false,
      intensity: 0.7,
      adaptiveThreshold: true,
      spectralSubtraction: true
    };
    
    // Voice enhancement
    this.voiceEnhancement = {
      enabled: false,
      clarityBoost: 1.2,
      bassReduction: 0.8,
      trebleBoost: 1.1,
      dynamicRange: true
    };
    
    // Audio effects
    this.effects = {
      echo: { enabled: false, delay: 0.3, feedback: 0.3, mix: 0.2 },
      reverb: { enabled: false, roomSize: 0.5, damping: 0.5, mix: 0.3 },
      voiceModulation: { enabled: false, pitch: 1.0, formant: 1.0 },
      robot: { enabled: false, intensity: 0.5 },
      whisper: { enabled: false, intensity: 0.3 }
    };
    
    // Performance monitoring
    this.stats = {
      processingLatency: [],
      cpuUsage: 0,
      noiseReductionLevel: 0,
      voiceActivityLevel: 0
    };
    
    // Frequency analysis
    this.frequencyData = new Uint8Array(1024);
    this.timeData = new Uint8Array(1024);
    
    // Voice activity detection
    this.vadThreshold = 30;
    this.vadSmoothingFactor = 0.1;
    this.currentVAD = 0;
  }

  async initialize(inputStream) {
    try {
      console.log('Initializing Audio Enhancer...');
      
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: 48000
      });
      
      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Create source node from input stream
      this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);
      
      // Setup audio processing chain
      await this.setupProcessingChain();
      
      // Initialize noise profiling
      await this.initializeNoiseProfile();
      
      this.isInitialized = true;
      console.log('Audio Enhancer initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize audio enhancer:', error);
      throw error;
    }
  }

  async setupProcessingChain() {
    // Create audio nodes
    this.gainNode = this.audioContext.createGain();
    this.filterNode = this.audioContext.createBiquadFilter();
    this.compressorNode = this.audioContext.createDynamicsCompressor();
    this.analyserNode = this.audioContext.createAnalyser();
    this.delayNode = this.audioContext.createDelay(1.0);
    this.convolverNode = this.audioContext.createConvolver();
    
    // Create script processor for real-time processing
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    // Configure analyser for frequency analysis
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;
    
    // Configure compressor for dynamic range control
    this.compressorNode.threshold.setValueAtTime(-24, this.audioContext.currentTime);
    this.compressorNode.knee.setValueAtTime(30, this.audioContext.currentTime);
    this.compressorNode.ratio.setValueAtTime(12, this.audioContext.currentTime);
    this.compressorNode.attack.setValueAtTime(0.003, this.audioContext.currentTime);
    this.compressorNode.release.setValueAtTime(0.25, this.audioContext.currentTime);
    
    // Configure high-pass filter for noise reduction
    this.filterNode.type = 'highpass';
    this.filterNode.frequency.setValueAtTime(80, this.audioContext.currentTime);
    this.filterNode.Q.setValueAtTime(1, this.audioContext.currentTime);
    
    // Setup script processor for advanced processing
    this.scriptProcessor.onaudioprocess = (event) => {
      this.processAudioFrame(event);
    };
    
    // Connect basic processing chain
    this.sourceNode.connect(this.filterNode);
    this.filterNode.connect(this.compressorNode);
    this.compressorNode.connect(this.gainNode);
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.scriptProcessor);
  }

  async initializeNoiseProfile() {
    // Collect noise profile from first few seconds of silence
    this.noiseProfile = {
      spectrum: new Float32Array(1024),
      magnitude: 0,
      collected: false
    };
    
    // Start noise profiling
    setTimeout(() => {
      this.collectNoiseProfile();
    }, 1000);
  }

  collectNoiseProfile() {
    if (!this.analyserNode || this.noiseProfile.collected) return;
    
    const frequencyData = new Float32Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getFloatFrequencyData(frequencyData);
    
    // Check if this appears to be background noise (low energy)
    const averageLevel = frequencyData.reduce((sum, val) => sum + val, 0) / frequencyData.length;
    
    if (averageLevel < -40) { // Likely background noise
      // Update noise profile
      for (let i = 0; i < frequencyData.length; i++) {
        this.noiseProfile.spectrum[i] = Math.max(this.noiseProfile.spectrum[i], frequencyData[i]);
      }
      this.noiseProfile.magnitude = averageLevel;
    }
    
    // Continue profiling for a few seconds
    if (performance.now() < 10000) { // First 10 seconds
      setTimeout(() => this.collectNoiseProfile(), 100);
    } else {
      this.noiseProfile.collected = true;
      console.log('Noise profile collected');
    }
  }

  processAudioFrame(event) {
    if (!this.isInitialized) return;
    
    const startTime = performance.now();
    const inputBuffer = event.inputBuffer;
    const outputBuffer = event.outputBuffer;
    
    for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
      const inputData = inputBuffer.getChannelData(channel);
      const outputData = outputBuffer.getChannelData(channel);
      
      // Apply processing pipeline
      this.applyNoiseReduction(inputData, outputData);
      this.applyVoiceEnhancement(outputData);
      this.applyAudioEffects(outputData);
      this.updateVoiceActivityDetection(inputData);
    }
    
    // Update performance stats
    const processingTime = performance.now() - startTime;
    this.updateStats(processingTime);
  }

  applyNoiseReduction(inputData, outputData) {
    if (!this.noiseCancellation.enabled || !this.noiseProfile.collected) {
      // No processing, copy input to output
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = inputData[i];
      }
      return;
    }
    
    // Spectral subtraction noise reduction
    const bufferLength = inputData.length;
    const fftSize = Math.pow(2, Math.ceil(Math.log2(bufferLength)));
    
    // Simple noise gate implementation
    const threshold = -50 + (this.noiseCancellation.intensity * 20);
    
    for (let i = 0; i < bufferLength; i++) {
      const sample = inputData[i];
      const amplitude = Math.abs(sample);
      const amplitudeDb = 20 * Math.log10(amplitude + 1e-10);
      
      if (amplitudeDb < threshold) {
        // Reduce noise
        outputData[i] = sample * (1 - this.noiseCancellation.intensity);
      } else {
        // Preserve voice
        outputData[i] = sample;
      }
    }
  }

  applyVoiceEnhancement(audioData) {
    if (!this.voiceEnhancement.enabled) return;
    
    const length = audioData.length;
    
    // Apply clarity boost (subtle harmonic enhancement)
    for (let i = 0; i < length; i++) {
      const sample = audioData[i];
      
      // Soft saturation for clarity
      const enhanced = Math.tanh(sample * this.voiceEnhancement.clarityBoost) / this.voiceEnhancement.clarityBoost;
      
      audioData[i] = enhanced;
    }
  }

  applyAudioEffects(audioData) {
    const length = audioData.length;
    
    // Apply echo effect
    if (this.effects.echo.enabled) {
      this.applyEcho(audioData);
    }
    
    // Apply voice modulation
    if (this.effects.voiceModulation.enabled) {
      this.applyVoiceModulation(audioData);
    }
    
    // Apply robot effect
    if (this.effects.robot.enabled) {
      this.applyRobotEffect(audioData);
    }
    
    // Apply whisper effect
    if (this.effects.whisper.enabled) {
      this.applyWhisperEffect(audioData);
    }
  }

  applyEcho(audioData) {
    const delay = Math.floor(this.effects.echo.delay * this.audioContext.sampleRate);
    const feedback = this.effects.echo.feedback;
    const mix = this.effects.echo.mix;
    
    // Simple delay line implementation
    if (!this.delayBuffer) {
      this.delayBuffer = new Float32Array(delay);
      this.delayIndex = 0;
    }
    
    for (let i = 0; i < audioData.length; i++) {
      const delayedSample = this.delayBuffer[this.delayIndex];
      this.delayBuffer[this.delayIndex] = audioData[i] + (delayedSample * feedback);
      
      audioData[i] = audioData[i] * (1 - mix) + delayedSample * mix;
      
      this.delayIndex = (this.delayIndex + 1) % delay;
    }
  }

  applyVoiceModulation(audioData) {
    const pitch = this.effects.voiceModulation.pitch;
    
    // Simple pitch shifting using interpolation
    if (pitch !== 1.0) {
      for (let i = 0; i < audioData.length; i++) {
        const sourceIndex = i * pitch;
        const lowerIndex = Math.floor(sourceIndex);
        const upperIndex = Math.ceil(sourceIndex);
        const fraction = sourceIndex - lowerIndex;
        
        if (upperIndex < audioData.length) {
          const interpolated = audioData[lowerIndex] * (1 - fraction) + audioData[upperIndex] * fraction;
          audioData[i] = interpolated;
        }
      }
    }
  }

  applyRobotEffect(audioData) {
    const intensity = this.effects.robot.intensity;
    
    // Bit crushing and ring modulation for robot effect
    for (let i = 0; i < audioData.length; i++) {
      const sample = audioData[i];
      
      // Bit crushing
      const bits = Math.floor(16 - intensity * 12);
      const step = Math.pow(2, bits - 1);
      const crushed = Math.round(sample * step) / step;
      
      // Ring modulation
      const modFreq = 30; // Hz
      const modulation = Math.sin(2 * Math.PI * modFreq * i / this.audioContext.sampleRate);
      
      audioData[i] = crushed * (1 - intensity) + (crushed * modulation) * intensity;
    }
  }

  applyWhisperEffect(audioData) {
    const intensity = this.effects.whisper.intensity;
    
    // Add subtle noise and reduce amplitude for whisper effect
    for (let i = 0; i < audioData.length; i++) {
      const sample = audioData[i];
      const noise = (Math.random() - 0.5) * 0.01 * intensity;
      const whispered = sample * (1 - intensity * 0.5) + noise;
      
      audioData[i] = whispered;
    }
  }

  updateVoiceActivityDetection(audioData) {
    // Calculate RMS energy
    let rms = 0;
    for (let i = 0; i < audioData.length; i++) {
      rms += audioData[i] * audioData[i];
    }
    rms = Math.sqrt(rms / audioData.length);
    
    // Convert to dB
    const rmsDb = 20 * Math.log10(rms + 1e-10);
    
    // Smooth VAD using exponential averaging
    const vadActive = rmsDb > this.vadThreshold ? 1 : 0;
    this.currentVAD = this.currentVAD * (1 - this.vadSmoothingFactor) + vadActive * this.vadSmoothingFactor;
    
    this.stats.voiceActivityLevel = this.currentVAD;
  }

  updateStats(processingTime) {
    this.stats.processingLatency.push(processingTime);
    if (this.stats.processingLatency.length > 60) {
      this.stats.processingLatency.shift();
    }
    
    // Estimate CPU usage based on processing time
    const targetTime = (4096 / this.audioContext.sampleRate) * 1000; // Target processing time
    this.stats.cpuUsage = Math.min(100, (processingTime / targetTime) * 100);
  }

  // Public API methods
  enableNoiseCancellation(enabled = true, intensity = 0.7) {
    this.noiseCancellation.enabled = enabled;
    this.noiseCancellation.intensity = Math.max(0, Math.min(1, intensity));
  }

  enableVoiceEnhancement(enabled = true) {
    this.voiceEnhancement.enabled = enabled;
  }

  setAudioEffect(effectName, enabled, settings = {}) {
    if (this.effects[effectName]) {
      this.effects[effectName].enabled = enabled;
      Object.assign(this.effects[effectName], settings);
    }
  }

  setVADThreshold(threshold) {
    this.vadThreshold = Math.max(-60, Math.min(0, threshold));
  }

  getAudioAnalytics() {
    if (!this.analyserNode) return null;
    
    this.analyserNode.getByteFrequencyData(this.frequencyData);
    this.analyserNode.getByteTimeDomainData(this.timeData);
    
    return {
      frequencyData: Array.from(this.frequencyData),
      timeData: Array.from(this.timeData),
      voiceActivity: this.currentVAD,
      processingLatency: this.stats.processingLatency.slice(-10),
      cpuUsage: this.stats.cpuUsage,
      isNoiseProfileReady: this.noiseProfile.collected
    };
  }

  getProcessedStream() {
    if (!this.isInitialized) return null;
    
    // Create destination for processed audio
    const destination = this.audioContext.createMediaStreamDestination();
    this.scriptProcessor.connect(destination);
    
    return destination.stream;
  }

  getPerformanceStats() {
    const avgLatency = this.stats.processingLatency.reduce((sum, time) => sum + time, 0) / this.stats.processingLatency.length;
    
    return {
      averageLatency: avgLatency || 0,
      cpuUsage: this.stats.cpuUsage,
      voiceActivity: this.stats.voiceActivityLevel,
      isInitialized: this.isInitialized,
      contextState: this.audioContext?.state,
      noiseProfileReady: this.noiseProfile?.collected
    };
  }

  dispose() {
    this.isInitialized = false;
    this.isProcessing = false;
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }
    
    // Disconnect all nodes
    [this.gainNode, this.filterNode, this.compressorNode, this.analyserNode, 
     this.delayNode, this.convolverNode].forEach(node => {
      if (node) node.disconnect();
    });
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.audioContext = null;
  }
}

export default AudioEnhancer;