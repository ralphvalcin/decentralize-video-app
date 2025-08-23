import { createPeerConnection, handleIceCandidate } from '../../src/utils/webrtc-utils';

describe('WebRTC Utility Functions', () => {
  let mockPeerConnection;

  beforeEach(() => {
    mockPeerConnection = {
      addIceCandidate: jest.fn(),
      onicecandidate: null,
    };
  });

  test('createPeerConnection returns a valid peer connection', () => {
    const peerConnection = createPeerConnection();
    expect(peerConnection).toBeDefined();
    expect(peerConnection.createOffer).toBeDefined();
    expect(peerConnection.createAnswer).toBeDefined();
  });

  test('handleIceCandidate adds candidate to peer connection', () => {
    const mockCandidate = { candidate: 'test-candidate' };
    handleIceCandidate(mockPeerConnection, mockCandidate);
    
    expect(mockPeerConnection.addIceCandidate).toHaveBeenCalledWith(mockCandidate);
  });
});