require('@testing-library/jest-dom');

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