import Peer from 'simple-peer';
import toast from 'react-hot-toast';

class PeerConnectionService {
  constructor(signalingService) {
    this.signalingService = signalingService;
    this.peers = new Map(); // Map of userId -> peer data
    this.onPeersUpdated = null;
    this.onStreamReceived = null;

    // ICE servers configuration
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ];
  }

  // Set callback functions
  setCallbacks({ onPeersUpdated, onStreamReceived }) {
    this.onPeersUpdated = onPeersUpdated;
    this.onStreamReceived = onStreamReceived;
  }

  createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: {
        iceServers: this.iceServers
      }
    });

    this.setupPeerEventHandlers(peer, callerID);

    peer.on('signal', signal => {
      if (!peer.destroyed) {
        this.signalingService.sendSignal(userToSignal, callerID, signal);
      }
    });

    return peer;
  }

  addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
      config: {
        iceServers: this.iceServers
      }
    });

    this.setupPeerEventHandlers(peer, callerID);

    peer.on('signal', signal => {
      if (!peer.destroyed) {
        this.signalingService.returnSignal(signal, callerID);
      }
    });

    // Signal once
    let signaled = false;
    if (!signaled) {
      peer.signal(incomingSignal);
      signaled = true;
    }

    return peer;
  }

  setupPeerEventHandlers(peer, callerID) {
    peer.on('stream', peerStream => {
      // Update peer with stream
      if (this.peers.has(callerID)) {
        const peerData = this.peers.get(callerID);
        peerData.stream = peerStream;
        this.peers.set(callerID, peerData);
      }

      // Notify callback
      if (this.onStreamReceived) {
        this.onStreamReceived(callerID, peerStream);
      }

      this.notifyPeersUpdated();
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      toast.error(`Peer connection error: ${err.message || err.type}`);
      
      // Remove the failed peer
      if (this.peers.has(callerID)) {
        const peerData = this.peers.get(callerID);
        const peerName = peerData.name;
        this.removePeer(callerID);
        toast.info(`Lost connection to ${peerName}`);
      }
    });

    peer.on('close', () => {
      console.log('Peer connection closed');
      peer.destroy();
    });

    peer.on('connect', () => {
      console.log('Peer connection established');
    });
  }

  addPeerData(userId, peerData) {
    this.peers.set(userId, {
      peerID: userId,
      peer: peerData.peer,
      name: peerData.name,
      role: peerData.role,
      signaled: peerData.signaled || false,
      stream: peerData.stream || null
    });
    this.notifyPeersUpdated();
  }

  updatePeerSignal(userId, signal) {
    const peerData = this.peers.get(userId);
    if (peerData && !peerData.peer.destroyed && !peerData.signaled) {
      try {
        peerData.peer.signal(signal);
        peerData.signaled = true;
        this.peers.set(userId, peerData);
      } catch (err) {
        console.error('Error signaling peer:', err);
        toast.error('Connection signal error');
      }
    }
  }

  removePeer(userId) {
    if (this.peers.has(userId)) {
      const peerData = this.peers.get(userId);
      if (peerData.peer && !peerData.peer.destroyed) {
        peerData.peer.destroy();
      }
      this.peers.delete(userId);
      this.notifyPeersUpdated();
    }
  }

  replaceTrack(oldTrack, newTrack, stream) {
    this.peers.forEach(({ peer }) => {
      if (peer && !peer.destroyed && peer.replaceTrack) {
        try {
          peer.replaceTrack(oldTrack, newTrack, stream);
        } catch (err) {
          console.error('Error replacing track:', err);
        }
      }
    });
  }

  // Monitor connection quality
  startConnectionMonitoring() {
    const monitor = setInterval(() => {
      this.peers.forEach(({ peer, name }) => {
        if (peer && !peer.destroyed) {
          try {
            const stats = peer.getStats();
            if (stats && stats.bandwidth < 100000) { // Less than 100 Kbps
              toast.warning(`Poor connection detected with ${name}`);
            }
          } catch (err) {
            // Ignore stats errors
          }
        }
      });
    }, 5000);

    return monitor;
  }

  getPeersArray() {
    return Array.from(this.peers.values());
  }

  getPeerCount() {
    return this.peers.size;
  }

  hasPeer(userId) {
    return this.peers.has(userId);
  }

  notifyPeersUpdated() {
    if (this.onPeersUpdated) {
      this.onPeersUpdated(this.getPeersArray());
    }
  }

  destroyAllPeers() {
    this.peers.forEach(({ peer }) => {
      if (peer && !peer.destroyed) {
        peer.destroy();
      }
    });
    this.peers.clear();
    this.notifyPeersUpdated();
  }
}

export default PeerConnectionService;