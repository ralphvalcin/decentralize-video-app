import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

class SignalingService {
  constructor() {
    this.socket = null;
    this.eventListeners = new Map();
  }

  connect(serverUrl = import.meta.env.VITE_SIGNALING_SERVER_URL || 'wss://decentralize-video-app-2.onrender.com') {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    this.socket = io(serverUrl, {
      reconnectionDelayMax: 10000,
      reconnection: true,
      reconnectionAttempts: 10
    });

    // Set up default error handling
    this.setupDefaultEventHandlers();

    return this.socket;
  }

  setupDefaultEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect_error', (error) => {
      console.error('Connection Error:', error);
      toast.error(`Connection Error: ${error.message}`);
    });

    this.socket.on('connect', () => {
      console.log('Connected to signaling server');
      toast.success('Connected to signaling server');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from signaling server:', reason);
      toast.error(`Disconnected: ${reason}`);
    });

    this.socket.on('connect_timeout', () => {
      console.error('Connection timeout');
      toast.error('Connection timeout - please check your network');
    });
  }

  joinRoom(roomId, userInfo) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    
    console.log('Joining room:', roomId, 'with user info:', userInfo);
    this.socket.emit('join-room', { ...userInfo, roomId });
  }

  leaveRoom(roomId, userId, userName) {
    if (!this.socket) return;
    
    this.socket.emit('user-leaving', { roomId, userId, userName });
    this.disconnect();
  }

  sendSignal(userToSignal, callerID, signal) {
    if (!this.socket) return;
    
    this.socket.emit('sending-signal', { userToSignal, callerID, signal });
  }

  returnSignal(signal, callerID) {
    if (!this.socket) return;
    
    this.socket.emit('returning-signal', { signal, callerID });
  }

  sendMessage(message) {
    if (!this.socket) return;
    
    this.socket.emit('send-message', message);
  }

  sendReaction(reaction) {
    if (!this.socket) return;
    
    this.socket.emit('send-reaction', reaction);
  }

  createPoll(pollData) {
    if (!this.socket) return;
    
    this.socket.emit('create-poll', pollData);
  }

  votePoll(voteData) {
    if (!this.socket) return;
    
    this.socket.emit('vote-poll', voteData);
  }

  submitQuestion(questionData) {
    if (!this.socket) return;
    
    this.socket.emit('submit-question', questionData);
  }

  voteQuestion(voteData) {
    if (!this.socket) return;
    
    this.socket.emit('vote-question', voteData);
  }

  answerQuestion(answerData) {
    if (!this.socket) return;
    
    this.socket.emit('answer-question', answerData);
  }

  raiseHand(handData) {
    if (!this.socket) return;
    
    this.socket.emit('raise-hand', handData);
  }

  lowerHand(handData) {
    if (!this.socket) return;
    
    this.socket.emit('lower-hand', handData);
  }

  // Event listener management
  on(event, callback) {
    if (!this.socket) return;
    
    this.socket.on(event, callback);
    
    // Store for cleanup
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.socket) return;
    
    if (callback) {
      this.socket.off(event, callback);
      
      // Remove from stored listeners
      if (this.eventListeners.has(event)) {
        const listeners = this.eventListeners.get(event);
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    } else {
      this.socket.off(event);
      this.eventListeners.delete(event);
    }
  }

  disconnect() {
    if (this.socket) {
      // Clean up all event listeners
      this.eventListeners.forEach((listeners, event) => {
        this.socket.off(event);
      });
      this.eventListeners.clear();
      
      this.socket.disconnect();
      this.socket = null;
    }
  }

  get isConnected() {
    return this.socket && this.socket.connected;
  }

  get socketId() {
    return this.socket ? this.socket.id : null;
  }
}

export default SignalingService;