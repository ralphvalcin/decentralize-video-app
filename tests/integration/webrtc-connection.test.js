import { setupPeerConnection, connectPeers } from '../../src/services/webrtc-connection';
import MockSocket from 'jest-websocket-mock';

describe('WebRTC Connection Integration', () => {
  let server, socket;

  beforeEach(async () => {
    server = new MockSocket('ws://localhost:8080');
    socket = await server.connected;
  });

  afterEach(() => {
    MockSocket.clean();
  });

  test('establishes peer connection through signaling server', async () => {
    const localStream = new MediaStream();
    const peerConnection = setupPeerConnection(socket, localStream);

    await server.nextMessage; // Wait for signaling message
    
    expect(peerConnection).toBeDefined();
    expect(peerConnection.iceConnectionState).toBe('new');
  });

  test('handles multiple peer connections', async () => {
    const peers = connectPeers(socket, 3);
    
    expect(peers.length).toBe(3);
    peers.forEach(peer => {
      expect(peer.connected).toBeFalsy();
    });
  });
});