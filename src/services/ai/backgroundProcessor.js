/**
 * AI-Powered Background Processing Service
 * Handles background blur, replacement, and virtual backgrounds using TensorFlow.js and MediaPipe
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';

class BackgroundProcessor {
  constructor() {
    this.isInitialized = false;
    this.isProcessing = false;
    this.segmentationModel = null;
    this.canvas = null;
    this.ctx = null;
    this.virtualBackground = null;
    this.blurAmount = 10;
    this.edgeSmoothing = 0.1;
    this.confidenceThreshold = 0.75;
    
    // Performance optimization
    this.processFrameCounter = 0;
    this.skipFrames = 1; // Process every 2nd frame for performance
    this.lastProcessedFrame = null;
    
    // WebGL optimization
    this.gl = null;
    this.program = null;
    this.vertexBuffer = null;
    this.textureCache = new Map();
    
    this.stats = {
      processingTime: [],
      frameRate: 0,
      lastFrameTime: performance.now()
    };
  }

  async initialize() {
    try {
      console.log('Initializing AI Background Processor...');
      
      // Initialize TensorFlow.js with WebGL backend
      await tf.ready();
      await tf.setBackend('webgl');
      
      // Initialize MediaPipe Selfie Segmentation
      this.segmentationModel = new SelfieSegmentation({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        }
      });
      
      await this.segmentationModel.setOptions({
        modelSelection: 1, // 0 for general, 1 for landscape (better quality)
        selfieMode: true,
      });
      
      // Setup canvas for processing
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      
      // Initialize WebGL for advanced processing
      await this.initializeWebGL();
      
      this.isInitialized = true;
      console.log('AI Background Processor initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize background processor:', error);
      throw error;
    }
  }

  async initializeWebGL() {
    try {
      const glCanvas = document.createElement('canvas');
      this.gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');
      
      if (!this.gl) {
        console.warn('WebGL not available, falling back to Canvas 2D');
        return;
      }

      // Vertex shader for background processing
      const vertexShaderSource = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
          v_texCoord = a_texCoord;
        }
      `;

      // Fragment shader for blur effect
      const fragmentShaderSource = `
        precision mediump float;
        
        uniform sampler2D u_image;
        uniform sampler2D u_mask;
        uniform vec2 u_resolution;
        uniform float u_blurAmount;
        
        varying vec2 v_texCoord;
        
        vec4 blur(sampler2D image, vec2 uv, vec2 resolution, float amount) {
          vec4 color = vec4(0.0);
          vec2 off1 = vec2(1.3333333) * amount / resolution;
          color += texture2D(image, uv) * 0.29411764;
          color += texture2D(image, uv + off1) * 0.35294117;
          color += texture2D(image, uv - off1) * 0.35294117;
          return color; 
        }
        
        void main() {
          vec4 originalColor = texture2D(u_image, v_texCoord);
          vec4 blurredColor = blur(u_image, v_texCoord, u_resolution, u_blurAmount);
          float mask = texture2D(u_mask, v_texCoord).r;
          
          // Smooth edge blending
          mask = smoothstep(0.1, 0.9, mask);
          
          gl_FragColor = mix(blurredColor, originalColor, mask);
        }
      `;

      this.program = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
      this.setupBuffers();
      
    } catch (error) {
      console.warn('WebGL initialization failed:', error);
    }
  }

  createShaderProgram(vertexSource, fragmentSource) {
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error('Unable to initialize shader program: ' + this.gl.getProgramInfoLog(program));
    }
    
    return program;
  }

  compileShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('An error occurred compiling the shaders: ' + this.gl.getShaderInfoLog(shader));
    }
    
    return shader;
  }

  setupBuffers() {
    const positions = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
      -1,  1,  0, 1,
      -1,  1,  0, 1,
       1, -1,  1, 0,
       1,  1,  1, 1,
    ]);
    
    this.vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
  }

  async processFrame(videoElement, outputCanvas, options = {}) {
    if (!this.isInitialized || this.isProcessing) {
      return false;
    }

    // Frame skipping for performance
    this.processFrameCounter++;
    if (this.processFrameCounter % (this.skipFrames + 1) !== 0) {
      return false;
    }

    const startTime = performance.now();
    this.isProcessing = true;

    try {
      const { mode = 'blur', backgroundImage, blurIntensity = 10 } = options;
      
      // Set canvas dimensions
      this.canvas.width = videoElement.videoWidth || 640;
      this.canvas.height = videoElement.videoHeight || 480;
      outputCanvas.width = this.canvas.width;
      outputCanvas.height = this.canvas.height;

      // Draw original video frame
      this.ctx.drawImage(videoElement, 0, 0, this.canvas.width, this.canvas.height);
      
      // Get segmentation mask
      const segmentationMask = await this.getSegmentationMask(videoElement);
      
      if (mode === 'blur') {
        await this.applyBackgroundBlur(outputCanvas, segmentationMask, blurIntensity);
      } else if (mode === 'replace' && backgroundImage) {
        await this.applyBackgroundReplacement(outputCanvas, segmentationMask, backgroundImage);
      } else if (mode === 'virtual') {
        await this.applyVirtualBackground(outputCanvas, segmentationMask, options.virtualBg);
      }

      // Update performance stats
      const processingTime = performance.now() - startTime;
      this.updateStats(processingTime);
      
      return true;
      
    } catch (error) {
      console.error('Error processing frame:', error);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  async getSegmentationMask(videoElement) {
    return new Promise((resolve) => {
      this.segmentationModel.onResults((results) => {
        if (results.segmentationMask) {
          resolve(results.segmentationMask);
        }
      });
      
      this.segmentationModel.send({ image: videoElement });
    });
  }

  async applyBackgroundBlur(outputCanvas, mask, intensity) {
    const outputCtx = outputCanvas.getContext('2d');
    
    if (this.gl && this.program) {
      // Use WebGL for better performance
      await this.applyWebGLBlur(outputCanvas, mask, intensity);
    } else {
      // Fallback to Canvas 2D
      await this.applyCanvas2DBlur(outputCanvas, mask, intensity);
    }
  }

  async applyWebGLBlur(outputCanvas, mask, intensity) {
    const gl = this.gl;
    const program = this.program;
    
    // Setup WebGL viewport
    gl.viewport(0, 0, outputCanvas.width, outputCanvas.height);
    
    // Use shader program
    gl.useProgram(program);
    
    // Create textures
    const imageTexture = this.createTexture(this.canvas);
    const maskTexture = this.createTexture(mask);
    
    // Set uniforms
    const imageLocation = gl.getUniformLocation(program, 'u_image');
    const maskLocation = gl.getUniformLocation(program, 'u_mask');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const blurLocation = gl.getUniformLocation(program, 'u_blurAmount');
    
    gl.uniform1i(imageLocation, 0);
    gl.uniform1i(maskLocation, 1);
    gl.uniform2f(resolutionLocation, outputCanvas.width, outputCanvas.height);
    gl.uniform1f(blurLocation, intensity);
    
    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    
    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    // Copy result to output canvas
    const outputCtx = outputCanvas.getContext('2d');
    outputCtx.drawImage(gl.canvas, 0, 0);
  }

  async applyCanvas2DBlur(outputCanvas, mask, intensity) {
    const outputCtx = outputCanvas.getContext('2d');
    
    // Create blurred version
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = this.canvas.width;
    blurCanvas.height = this.canvas.height;
    const blurCtx = blurCanvas.getContext('2d');
    
    // Apply CSS filter for blur (fallback)
    blurCtx.filter = `blur(${intensity}px)`;
    blurCtx.drawImage(this.canvas, 0, 0);
    
    // Composite original and blurred based on mask
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const blurredData = blurCtx.getImageData(0, 0, blurCanvas.width, blurCanvas.height);
    const maskData = mask.data || this.getMaskData(mask);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const maskValue = maskData[i / 4];
      const alpha = maskValue / 255;
      
      // Blend original and blurred
      imageData.data[i] = imageData.data[i] * alpha + blurredData.data[i] * (1 - alpha);
      imageData.data[i + 1] = imageData.data[i + 1] * alpha + blurredData.data[i + 1] * (1 - alpha);
      imageData.data[i + 2] = imageData.data[i + 2] * alpha + blurredData.data[i + 2] * (1 - alpha);
    }
    
    outputCtx.putImageData(imageData, 0, 0);
  }

  async applyBackgroundReplacement(outputCanvas, mask, backgroundImage) {
    const outputCtx = outputCanvas.getContext('2d');
    
    // Draw background image
    outputCtx.drawImage(backgroundImage, 0, 0, outputCanvas.width, outputCanvas.height);
    
    // Create temporary canvas for person extraction
    const personCanvas = document.createElement('canvas');
    personCanvas.width = this.canvas.width;
    personCanvas.height = this.canvas.height;
    const personCtx = personCanvas.getContext('2d');
    
    // Extract person using mask
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const maskData = this.getMaskData(mask);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const maskValue = maskData[i / 4];
      imageData.data[i + 3] = maskValue; // Set alpha based on mask
    }
    
    personCtx.putImageData(imageData, 0, 0);
    
    // Composite person over background
    outputCtx.drawImage(personCanvas, 0, 0);
  }

  async applyVirtualBackground(outputCanvas, mask, virtualBgType) {
    // Implement various virtual backgrounds (office, nature, abstract, etc.)
    const virtualBg = await this.generateVirtualBackground(virtualBgType, outputCanvas.width, outputCanvas.height);
    await this.applyBackgroundReplacement(outputCanvas, mask, virtualBg);
  }

  async generateVirtualBackground(type, width, height) {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d');
    
    switch (type) {
      case 'gradient':
        const gradient = bgCtx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        bgCtx.fillStyle = gradient;
        bgCtx.fillRect(0, 0, width, height);
        break;
        
      case 'office':
        // Generate office-like background
        bgCtx.fillStyle = '#f0f0f0';
        bgCtx.fillRect(0, 0, width, height);
        // Add office elements (simplified)
        bgCtx.fillStyle = '#d0d0d0';
        bgCtx.fillRect(width * 0.1, height * 0.2, width * 0.8, height * 0.6);
        break;
        
      case 'nature':
        // Generate nature-like background
        const natureGrad = bgCtx.createLinearGradient(0, 0, 0, height);
        natureGrad.addColorStop(0, '#87CEEB');
        natureGrad.addColorStop(0.7, '#98FB98');
        natureGrad.addColorStop(1, '#228B22');
        bgCtx.fillStyle = natureGrad;
        bgCtx.fillRect(0, 0, width, height);
        break;
        
      default:
        // Abstract background
        bgCtx.fillStyle = '#2d3748';
        bgCtx.fillRect(0, 0, width, height);
    }
    
    return bgCanvas;
  }

  createTexture(source) {
    const gl = this.gl;
    const texture = gl.createTexture();
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    if (source instanceof HTMLCanvasElement || source instanceof HTMLVideoElement || source instanceof HTMLImageElement) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else {
      // Handle ImageData or other formats
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
    }
    
    return texture;
  }

  getMaskData(mask) {
    if (mask.data) {
      return mask.data;
    }
    
    // Convert mask to ImageData if needed
    const canvas = document.createElement('canvas');
    canvas.width = mask.width || this.canvas.width;
    canvas.height = mask.height || this.canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(mask, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return Array.from(imageData.data).filter((_, index) => index % 4 === 0); // Extract alpha channel
  }

  updateStats(processingTime) {
    this.stats.processingTime.push(processingTime);
    if (this.stats.processingTime.length > 60) {
      this.stats.processingTime.shift(); // Keep last 60 measurements
    }
    
    const currentTime = performance.now();
    this.stats.frameRate = 1000 / (currentTime - this.stats.lastFrameTime);
    this.stats.lastFrameTime = currentTime;
  }

  getPerformanceStats() {
    const avgProcessingTime = this.stats.processingTime.reduce((sum, time) => sum + time, 0) / this.stats.processingTime.length;
    
    return {
      averageProcessingTime: avgProcessingTime || 0,
      currentFrameRate: this.stats.frameRate,
      isInitialized: this.isInitialized,
      isProcessing: this.isProcessing,
      skipFrames: this.skipFrames,
      webGLEnabled: !!this.gl
    };
  }

  setBlurIntensity(intensity) {
    this.blurAmount = Math.max(0, Math.min(50, intensity));
  }

  setEdgeSmoothing(smoothing) {
    this.edgeSmoothing = Math.max(0, Math.min(1, smoothing));
  }

  setPerformanceMode(mode) {
    switch (mode) {
      case 'high_performance':
        this.skipFrames = 0;
        break;
      case 'balanced':
        this.skipFrames = 1;
        break;
      case 'power_saver':
        this.skipFrames = 3;
        break;
    }
  }

  dispose() {
    this.isInitialized = false;
    this.isProcessing = false;
    
    if (this.segmentationModel) {
      this.segmentationModel.close();
    }
    
    if (this.gl) {
      this.gl.deleteProgram(this.program);
      this.gl.deleteBuffer(this.vertexBuffer);
      this.textureCache.forEach(texture => this.gl.deleteTexture(texture));
    }
    
    this.canvas = null;
    this.ctx = null;
  }
}

export default BackgroundProcessor;