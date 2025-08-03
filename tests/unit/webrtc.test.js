import Peer from 'simple-peer';
import { createPeerConnection, handleSignal } from '../../src/utils/webrtc';

jest.mock('simple-peer');

describe('WebRTC Utilities', () => {
  let mockPeer;

  beforeEach(() => {
    mockPeer = {
      signal: jest.fn(),
      on: jest.fn(),
      addStream: jest.fn()
    };
    Peer.mockReturnValue(mockPeer);
  });

  test('creates peer connection', () => {
    const stream = new MediaStream();
    const peer = createPeerConnection(stream, true);
    
    expect(Peer).toHaveBeenCalledWith(expect.objectContaining({
      initiator: true,
      stream: stream
    }));
  });

  test('handles incoming signal', () => {
    const signalData = { type: 'offer', sdp: 'test-sdp' };
    handleSignal(mockPeer, signalData);
    
    expect(mockPeer.signal).toHaveBeenCalledWith(signalData);
  });
});