require('@testing-library/jest-dom');
const { webcrypto } = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

// Polyfill TextEncoder and TextDecoder for Node.js test environment
Object.defineProperty(globalThis, 'TextEncoder', {
  value: TextEncoder,
  configurable: true,
});
Object.defineProperty(globalThis, 'TextDecoder', {
  value: TextDecoder,
  configurable: true,
});

// Polyfill btoa and atob for Node.js test environment
Object.defineProperty(globalThis, 'btoa', {
  value: (str) => Buffer.from(str, 'binary').toString('base64'),
  configurable: true,
});
Object.defineProperty(globalThis, 'atob', {
  value: (str) => Buffer.from(str, 'base64').toString('binary'),
  configurable: true,
});

// Polyfill crypto.subtle for Node.js test environment
Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: (arr) => webcrypto.getRandomValues(arr),
    subtle: webcrypto.subtle,
  },
  configurable: true,
});

// Extend timeout for complex tests
jest.setTimeout(10000);

// Mock browser APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
});

// Comprehensive WebRTC Mock
window.RTCPeerConnection = jest.fn(() => ({
  createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
  createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
  setLocalDescription: jest.fn().mockResolvedValue({}),
  setRemoteDescription: jest.fn().mockResolvedValue({}),
  addIceCandidate: jest.fn().mockResolvedValue({}),
  close: jest.fn(),
  onicecandidate: null,
  ontrack: null,
  signalingState: 'stable',
  iceConnectionState: 'new',
}));

// Mock Navigator Media Devices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [],
      addTrack: jest.fn(),
      removeTrack: jest.fn(),
    })),
    enumerateDevices: jest.fn(() => Promise.resolve([
      { kind: 'videoinput', deviceId: 'mock-video-device' },
      { kind: 'audioinput', deviceId: 'mock-audio-device' }
    ])),
  },
  configurable: true
});

// Mock Socket.io Client
jest.mock('socket.io-client', () => {
  const emit = jest.fn();
  const on = jest.fn();
  const socket = {
    emit,
    on,
    connect: jest.fn(),
    disconnect: jest.fn(),
    id: 'mock-socket-id',
  };
  return jest.fn(() => socket);
});

// Simple Peer Mock
jest.mock('simple-peer', () => {
  return jest.fn().mockImplementation(() => ({
    signal: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
  }));
});

// @jitsi/rnnoise-wasm uses ESM; mock globally to prevent import errors in jsdom.
// Tests that need specific behaviour (NoiseProcessor.test.ts) override this mock locally.
jest.mock('@jitsi/rnnoise-wasm', () =>
  jest.fn().mockResolvedValue({
    newState: jest.fn(() => ({
      processFrame: jest.fn(() => 0),
      destroy: jest.fn(),
    })),
  })
);

// @huggingface/transformers uses ESM; mock globally to prevent import errors in jsdom.
// Tests that need specific behaviour (TranscriptionWorker.test.ts) override this mock locally.
jest.mock('@huggingface/transformers', () => ({
  pipeline: jest.fn(),
}));

// MediaRecorder is not implemented in jsdom. Provide a minimal stub so that
// the typeof-guard in RecordingController (and similar components) behaves the
// same way it would in a real browser. Tests that specifically verify the
// "unsupported" path delete global.MediaRecorder themselves and restore it
// after the assertion.
if (typeof global.MediaRecorder === 'undefined') {
  global.MediaRecorder = jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    state: 'inactive',
  }));
  global.MediaRecorder.isTypeSupported = jest.fn(() => true);
}