/**
 * Data Channel Collaboration Manager
 * Handles whiteboard, file sharing, synchronized playback, and breakout rooms
 */

import { fabric } from 'fabric';

class DataChannelManager {
  constructor(connectionManager) {
    this.connectionManager = connectionManager;
    this.channels = new Map(); // peerId -> channel
    this.isInitialized = false;
    
    // Feature managers
    this.whiteboard = new WhiteboardManager(this);
    this.fileSharing = new FileSharingManager(this);
    this.synchronizedPlayback = new SynchronizedPlaybackManager(this);
    this.breakoutRooms = new BreakoutRoomManager(this);
    
    // Message handlers
    this.messageHandlers = new Map();
    this.setupMessageHandlers();
    
    // Channel configuration
    this.channelConfig = {
      ordered: true,
      maxRetransmits: 3,
      maxPacketLifeTime: 3000
    };
  }

  async initialize() {
    try {
      console.log('Initializing Data Channel Manager...');
      
      await this.whiteboard.initialize();
      await this.fileSharing.initialize();
      await this.synchronizedPlayback.initialize();
      await this.breakoutRooms.initialize();
      
      this.isInitialized = true;
      console.log('Data Channel Manager initialized');
      
    } catch (error) {
      console.error('Failed to initialize data channel manager:', error);
      throw error;
    }
  }

  setupMessageHandlers() {
    this.messageHandlers.set('whiteboard', (peerId, data) => this.whiteboard.handleMessage(peerId, data));
    this.messageHandlers.set('file_chunk', (peerId, data) => this.fileSharing.handleFileChunk(peerId, data));
    this.messageHandlers.set('file_request', (peerId, data) => this.fileSharing.handleFileRequest(peerId, data));
    this.messageHandlers.set('playback_sync', (peerId, data) => this.synchronizedPlayback.handleMessage(peerId, data));
    this.messageHandlers.set('room_management', (peerId, data) => this.breakoutRooms.handleMessage(peerId, data));
    this.messageHandlers.set('cursor_position', (peerId, data) => this.handleCursorUpdate(peerId, data));
    this.messageHandlers.set('user_status', (peerId, data) => this.handleUserStatus(peerId, data));
  }

  async createDataChannel(peerId, channelName = 'collaboration', config = {}) {
    try {
      const peerData = this.connectionManager.peers.get(peerId);
      if (!peerData || !peerData.peer) {
        throw new Error(`Peer ${peerId} not found`);
      }

      const peer = peerData.peer;
      const pc = peer._pc;
      
      if (!pc) {
        throw new Error('Peer connection not available');
      }

      const channelConfig = { ...this.channelConfig, ...config };
      const dataChannel = pc.createDataChannel(channelName, channelConfig);
      
      this.setupDataChannelHandlers(dataChannel, peerId);
      this.channels.set(peerId, dataChannel);
      
      console.log(`Data channel created for peer ${peerId}`);
      return dataChannel;
      
    } catch (error) {
      console.error(`Failed to create data channel for peer ${peerId}:`, error);
      throw error;
    }
  }

  setupDataChannelHandlers(dataChannel, peerId) {
    dataChannel.onopen = () => {
      console.log(`Data channel opened for peer ${peerId}`);
      this.handleChannelOpen(peerId, dataChannel);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed for peer ${peerId}`);
      this.handleChannelClose(peerId);
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error for peer ${peerId}:`, error);
      this.handleChannelError(peerId, error);
    };

    dataChannel.onmessage = (event) => {
      this.handleChannelMessage(peerId, event.data);
    };
  }

  handleChannelOpen(peerId, dataChannel) {
    // Send initial handshake
    this.sendMessage(peerId, {
      type: 'handshake',
      timestamp: Date.now(),
      capabilities: this.getCapabilities()
    });
  }

  handleChannelClose(peerId) {
    this.channels.delete(peerId);
    
    // Notify feature managers
    this.whiteboard.handlePeerDisconnect(peerId);
    this.fileSharing.handlePeerDisconnect(peerId);
    this.synchronizedPlayback.handlePeerDisconnect(peerId);
    this.breakoutRooms.handlePeerDisconnect(peerId);
  }

  handleChannelError(peerId, error) {
    console.error(`Data channel error for peer ${peerId}:`, error);
    
    // Attempt to recreate channel
    setTimeout(() => {
      this.createDataChannel(peerId);
    }, 5000);
  }

  handleChannelMessage(peerId, rawData) {
    try {
      const message = JSON.parse(rawData);
      
      // Route message to appropriate handler
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(peerId, message.data);
      } else {
        console.warn(`Unknown message type: ${message.type}`);
      }
      
    } catch (error) {
      console.error('Failed to parse data channel message:', error);
    }
  }

  sendMessage(peerId, message) {
    const channel = this.channels.get(peerId);
    if (!channel || channel.readyState !== 'open') {
      console.warn(`Cannot send message to peer ${peerId}: channel not ready`);
      return false;
    }

    try {
      const serializedMessage = JSON.stringify(message);
      channel.send(serializedMessage);
      return true;
    } catch (error) {
      console.error(`Failed to send message to peer ${peerId}:`, error);
      return false;
    }
  }

  broadcastMessage(message, excludePeerId = null) {
    let successCount = 0;
    
    for (const [peerId, channel] of this.channels) {
      if (peerId === excludePeerId) continue;
      
      if (this.sendMessage(peerId, message)) {
        successCount++;
      }
    }
    
    return successCount;
  }

  handleCursorUpdate(peerId, data) {
    // Broadcast cursor position to other peers
    this.broadcastMessage({
      type: 'cursor_position',
      data: {
        peerId,
        x: data.x,
        y: data.y,
        timestamp: Date.now()
      }
    }, peerId);
  }

  handleUserStatus(peerId, data) {
    console.log(`User status update from ${peerId}:`, data);
    // Handle user status changes (typing, away, etc.)
  }

  getCapabilities() {
    return {
      whiteboard: this.whiteboard.isEnabled(),
      fileSharing: this.fileSharing.isEnabled(),
      synchronizedPlayback: this.synchronizedPlayback.isEnabled(),
      breakoutRooms: this.breakoutRooms.isEnabled(),
      maxFileSize: this.fileSharing.getMaxFileSize(),
      supportedFileTypes: this.fileSharing.getSupportedTypes()
    };
  }

  // Public API methods
  getConnectedPeers() {
    return Array.from(this.channels.keys()).filter(peerId => {
      const channel = this.channels.get(peerId);
      return channel && channel.readyState === 'open';
    });
  }

  getChannelStats() {
    const stats = {};
    
    for (const [peerId, channel] of this.channels) {
      stats[peerId] = {
        state: channel.readyState,
        bufferedAmount: channel.bufferedAmount,
        maxRetransmits: channel.maxRetransmits,
        ordered: channel.ordered
      };
    }
    
    return stats;
  }

  dispose() {
    this.isInitialized = false;
    
    // Close all data channels
    for (const [peerId, channel] of this.channels) {
      try {
        channel.close();
      } catch (error) {
        console.warn(`Error closing channel for peer ${peerId}:`, error);
      }
    }
    
    this.channels.clear();
    
    // Dispose feature managers
    this.whiteboard.dispose();
    this.fileSharing.dispose();
    this.synchronizedPlayback.dispose();
    this.breakoutRooms.dispose();
  }
}

// Whiteboard Manager
class WhiteboardManager {
  constructor(dataChannelManager) {
    this.dataChannelManager = dataChannelManager;
    this.canvas = null;
    this.fabricCanvas = null;
    this.isEnabled = true;
    this.tools = {
      pen: { color: '#000000', width: 2 },
      eraser: { width: 10 },
      text: { fontSize: 16, fontFamily: 'Arial' },
      shapes: { stroke: '#000000', fill: 'transparent', strokeWidth: 2 }
    };
    this.activeTool = 'pen';
    this.history = [];
    this.historyIndex = -1;
    this.collaborators = new Map(); // peerId -> cursor info
  }

  async initialize() {
    console.log('Initializing Whiteboard Manager...');
    // Whiteboard will be initialized when canvas element is provided
  }

  initializeCanvas(canvasElement) {
    this.canvas = canvasElement;
    this.fabricCanvas = new fabric.Canvas(canvasElement, {
      isDrawingMode: true,
      width: canvasElement.width,
      height: canvasElement.height
    });

    this.setupCanvasHandlers();
    console.log('Whiteboard canvas initialized');
  }

  setupCanvasHandlers() {
    this.fabricCanvas.on('path:created', (e) => {
      const pathData = this.serializePath(e.path);
      this.broadcastDrawing('path_created', pathData);
      this.saveToHistory();
    });

    this.fabricCanvas.on('object:added', (e) => {
      if (e.target.type !== 'path') {
        const objectData = this.serializeObject(e.target);
        this.broadcastDrawing('object_added', objectData);
        this.saveToHistory();
      }
    });

    this.fabricCanvas.on('object:modified', (e) => {
      const objectData = this.serializeObject(e.target);
      this.broadcastDrawing('object_modified', objectData);
      this.saveToHistory();
    });

    this.fabricCanvas.on('object:removed', (e) => {
      const objectId = e.target.id || this.getObjectId(e.target);
      this.broadcastDrawing('object_removed', { id: objectId });
      this.saveToHistory();
    });

    this.fabricCanvas.on('mouse:move', (e) => {
      if (this.activeTool === 'pen' && this.fabricCanvas.isDrawingMode) {
        const pointer = this.fabricCanvas.getPointer(e.e);
        this.broadcastCursor(pointer.x, pointer.y);
      }
    });
  }

  serializePath(path) {
    return {
      id: this.generateId(),
      type: 'path',
      path: path.path,
      stroke: path.stroke,
      strokeWidth: path.strokeWidth,
      fill: path.fill,
      left: path.left,
      top: path.top,
      timestamp: Date.now()
    };
  }

  serializeObject(object) {
    return {
      id: object.id || this.generateId(),
      type: object.type,
      left: object.left,
      top: object.top,
      width: object.width,
      height: object.height,
      scaleX: object.scaleX,
      scaleY: object.scaleY,
      angle: object.angle,
      stroke: object.stroke,
      strokeWidth: object.strokeWidth,
      fill: object.fill,
      text: object.text,
      fontSize: object.fontSize,
      fontFamily: object.fontFamily,
      timestamp: Date.now()
    };
  }

  broadcastDrawing(action, data) {
    this.dataChannelManager.broadcastMessage({
      type: 'whiteboard',
      data: {
        action,
        ...data
      }
    });
  }

  broadcastCursor(x, y) {
    this.dataChannelManager.broadcastMessage({
      type: 'cursor_position',
      data: { x, y }
    });
  }

  handleMessage(peerId, data) {
    switch (data.action) {
      case 'path_created':
        this.addRemotePath(data);
        break;
      case 'object_added':
        this.addRemoteObject(data);
        break;
      case 'object_modified':
        this.modifyRemoteObject(data);
        break;
      case 'object_removed':
        this.removeRemoteObject(data);
        break;
      case 'clear_canvas':
        this.clearCanvas(false);
        break;
      case 'cursor_update':
        this.updateCollaboratorCursor(peerId, data);
        break;
    }
  }

  addRemotePath(pathData) {
    const path = new fabric.Path(pathData.path, {
      id: pathData.id,
      left: pathData.left,
      top: pathData.top,
      stroke: pathData.stroke,
      strokeWidth: pathData.strokeWidth,
      fill: pathData.fill,
      selectable: false
    });

    this.fabricCanvas.add(path);
    this.fabricCanvas.renderAll();
  }

  addRemoteObject(objectData) {
    let fabricObject;

    switch (objectData.type) {
      case 'rect':
        fabricObject = new fabric.Rect(objectData);
        break;
      case 'circle':
        fabricObject = new fabric.Circle(objectData);
        break;
      case 'text':
        fabricObject = new fabric.Text(objectData.text, objectData);
        break;
      default:
        console.warn('Unknown object type:', objectData.type);
        return;
    }

    fabricObject.set({ selectable: false, id: objectData.id });
    this.fabricCanvas.add(fabricObject);
    this.fabricCanvas.renderAll();
  }

  modifyRemoteObject(objectData) {
    const object = this.fabricCanvas.getObjects().find(obj => obj.id === objectData.id);
    if (object) {
      object.set(objectData);
      this.fabricCanvas.renderAll();
    }
  }

  removeRemoteObject(data) {
    const object = this.fabricCanvas.getObjects().find(obj => obj.id === data.id);
    if (object) {
      this.fabricCanvas.remove(object);
      this.fabricCanvas.renderAll();
    }
  }

  updateCollaboratorCursor(peerId, data) {
    this.collaborators.set(peerId, {
      x: data.x,
      y: data.y,
      timestamp: Date.now()
    });
    
    // Update cursor display
    this.renderCollaboratorCursors();
  }

  renderCollaboratorCursors() {
    // Remove old cursor objects
    const cursors = this.fabricCanvas.getObjects().filter(obj => obj.type === 'collaborator-cursor');
    cursors.forEach(cursor => this.fabricCanvas.remove(cursor));

    // Add current cursors
    for (const [peerId, cursor] of this.collaborators) {
      if (Date.now() - cursor.timestamp < 5000) { // Show cursors for 5 seconds
        const cursorObject = new fabric.Circle({
          left: cursor.x,
          top: cursor.y,
          radius: 5,
          fill: this.getPeerColor(peerId),
          selectable: false,
          evented: false,
          type: 'collaborator-cursor'
        });
        
        this.fabricCanvas.add(cursorObject);
      }
    }
    
    this.fabricCanvas.renderAll();
  }

  saveToHistory() {
    const state = JSON.stringify(this.fabricCanvas.toJSON());
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(state);
    this.historyIndex++;
    
    // Limit history size
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = this.history[this.historyIndex];
      this.fabricCanvas.loadFromJSON(state, () => {
        this.fabricCanvas.renderAll();
        this.broadcastDrawing('undo', { historyIndex: this.historyIndex });
      });
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = this.history[this.historyIndex];
      this.fabricCanvas.loadFromJSON(state, () => {
        this.fabricCanvas.renderAll();
        this.broadcastDrawing('redo', { historyIndex: this.historyIndex });
      });
    }
  }

  clearCanvas(broadcast = true) {
    this.fabricCanvas.clear();
    if (broadcast) {
      this.broadcastDrawing('clear_canvas', {});
    }
    this.saveToHistory();
  }

  setTool(tool, options = {}) {
    this.activeTool = tool;
    
    switch (tool) {
      case 'pen':
        this.fabricCanvas.isDrawingMode = true;
        this.fabricCanvas.freeDrawingBrush.color = options.color || this.tools.pen.color;
        this.fabricCanvas.freeDrawingBrush.width = options.width || this.tools.pen.width;
        break;
      case 'eraser':
        this.fabricCanvas.isDrawingMode = true;
        this.fabricCanvas.freeDrawingBrush = new fabric.EraserBrush(this.fabricCanvas);
        this.fabricCanvas.freeDrawingBrush.width = options.width || this.tools.eraser.width;
        break;
      case 'select':
        this.fabricCanvas.isDrawingMode = false;
        break;
    }
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  getObjectId(object) {
    return object.id || this.generateId();
  }

  getPeerColor(peerId) {
    // Generate consistent color for peer
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
    const index = parseInt(peerId.substr(-2), 16) % colors.length;
    return colors[index];
  }

  handlePeerDisconnect(peerId) {
    this.collaborators.delete(peerId);
    this.renderCollaboratorCursors();
  }

  isEnabled() {
    return this.isEnabled;
  }

  dispose() {
    if (this.fabricCanvas) {
      this.fabricCanvas.dispose();
      this.fabricCanvas = null;
    }
    this.collaborators.clear();
    this.history = [];
  }
}

// File Sharing Manager
class FileSharingManager {
  constructor(dataChannelManager) {
    this.dataChannelManager = dataChannelManager;
    this.isEnabled = true;
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.chunkSize = 16 * 1024; // 16KB chunks
    this.activeTransfers = new Map(); // transferId -> transfer info
    this.supportedTypes = ['image/*', 'application/pdf', 'text/*', 'video/*', 'audio/*'];
  }

  async initialize() {
    console.log('Initializing File Sharing Manager...');
  }

  async shareFile(file, targetPeers = null) {
    if (!this.validateFile(file)) {
      throw new Error('File validation failed');
    }

    const transferId = this.generateTransferId();
    const peers = targetPeers || this.dataChannelManager.getConnectedPeers();
    
    const transfer = {
      id: transferId,
      file,
      totalChunks: Math.ceil(file.size / this.chunkSize),
      chunksPerPeer: new Map(),
      startTime: Date.now(),
      status: 'preparing'
    };

    this.activeTransfers.set(transferId, transfer);

    // Announce file to peers
    const fileInfo = {
      transferId,
      name: file.name,
      size: file.size,
      type: file.type,
      totalChunks: transfer.totalChunks,
      chunkSize: this.chunkSize
    };

    for (const peerId of peers) {
      this.dataChannelManager.sendMessage(peerId, {
        type: 'file_request',
        data: fileInfo
      });
      
      transfer.chunksPerPeer.set(peerId, 0);
    }

    transfer.status = 'announced';
    return transferId;
  }

  async sendFileChunks(transferId) {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) return;

    transfer.status = 'sending';
    const fileReader = new FileReader();
    
    for (let chunkIndex = 0; chunkIndex < transfer.totalChunks; chunkIndex++) {
      const start = chunkIndex * this.chunkSize;
      const end = Math.min(start + this.chunkSize, transfer.file.size);
      const chunk = transfer.file.slice(start, end);
      
      const chunkData = await this.readChunk(chunk);
      
      const chunkMessage = {
        transferId,
        chunkIndex,
        data: chunkData,
        isLastChunk: chunkIndex === transfer.totalChunks - 1
      };

      // Send to all peers
      for (const peerId of transfer.chunksPerPeer.keys()) {
        this.dataChannelManager.sendMessage(peerId, {
          type: 'file_chunk',
          data: chunkMessage
        });
      }

      // Update progress
      this.updateTransferProgress(transferId, chunkIndex + 1);
    }

    transfer.status = 'completed';
  }

  readChunk(chunk) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(chunk);
    });
  }

  handleFileRequest(peerId, fileInfo) {
    // Create incoming transfer
    const transfer = {
      id: fileInfo.transferId,
      name: fileInfo.name,
      size: fileInfo.size,
      type: fileInfo.type,
      totalChunks: fileInfo.totalChunks,
      receivedChunks: new Map(),
      fromPeer: peerId,
      startTime: Date.now(),
      status: 'receiving'
    };

    this.activeTransfers.set(fileInfo.transferId, transfer);
    
    // Notify UI about incoming file
    this.notifyIncomingFile(fileInfo);
  }

  handleFileChunk(peerId, chunkData) {
    const transfer = this.activeTransfers.get(chunkData.transferId);
    if (!transfer) return;

    // Store chunk
    transfer.receivedChunks.set(chunkData.chunkIndex, chunkData.data);

    // Check if transfer is complete
    if (transfer.receivedChunks.size === transfer.totalChunks) {
      this.assembleFile(transfer);
    }

    // Update progress
    this.updateReceiveProgress(chunkData.transferId, transfer.receivedChunks.size);
  }

  assembleFile(transfer) {
    const chunks = [];
    
    // Assemble chunks in order
    for (let i = 0; i < transfer.totalChunks; i++) {
      const chunk = transfer.receivedChunks.get(i);
      if (chunk) {
        chunks.push(chunk);
      }
    }

    // Create blob and download
    const blob = new Blob(chunks, { type: transfer.type });
    this.downloadFile(blob, transfer.name);
    
    transfer.status = 'completed';
    this.activeTransfers.delete(transfer.id);
    
    this.notifyTransferComplete(transfer.id);
  }

  downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  validateFile(file) {
    if (file.size > this.maxFileSize) {
      console.error('File too large');
      return false;
    }

    const isTypeSupported = this.supportedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isTypeSupported) {
      console.error('File type not supported');
      return false;
    }

    return true;
  }

  updateTransferProgress(transferId, sentChunks) {
    const transfer = this.activeTransfers.get(transferId);
    if (transfer) {
      const progress = (sentChunks / transfer.totalChunks) * 100;
      this.notifyProgress(transferId, progress, 'upload');
    }
  }

  updateReceiveProgress(transferId, receivedChunks) {
    const transfer = this.activeTransfers.get(transferId);
    if (transfer) {
      const progress = (receivedChunks / transfer.totalChunks) * 100;
      this.notifyProgress(transferId, progress, 'download');
    }
  }

  generateTransferId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Event notifications (to be connected to UI)
  notifyIncomingFile(fileInfo) {
    console.log('Incoming file:', fileInfo);
    // Emit event for UI
  }

  notifyProgress(transferId, progress, type) {
    console.log(`Transfer ${transferId} ${type} progress: ${progress.toFixed(1)}%`);
    // Emit event for UI
  }

  notifyTransferComplete(transferId) {
    console.log(`Transfer ${transferId} completed`);
    // Emit event for UI
  }

  handlePeerDisconnect(peerId) {
    // Cancel active transfers with disconnected peer
    for (const [transferId, transfer] of this.activeTransfers) {
      if (transfer.fromPeer === peerId || transfer.chunksPerPeer?.has(peerId)) {
        transfer.status = 'cancelled';
        this.activeTransfers.delete(transferId);
      }
    }
  }

  getMaxFileSize() {
    return this.maxFileSize;
  }

  getSupportedTypes() {
    return [...this.supportedTypes];
  }

  isEnabled() {
    return this.isEnabled;
  }

  dispose() {
    this.activeTransfers.clear();
  }
}

// Synchronized Playback Manager (simplified implementation)
class SynchronizedPlaybackManager {
  constructor(dataChannelManager) {
    this.dataChannelManager = dataChannelManager;
    this.isEnabled = true;
    this.mediaElement = null;
    this.isLeader = false;
    this.syncTolerance = 100; // ms
  }

  async initialize() {
    console.log('Initializing Synchronized Playback Manager...');
  }

  setMediaElement(element) {
    this.mediaElement = element;
    this.setupMediaHandlers();
  }

  setupMediaHandlers() {
    if (!this.mediaElement) return;

    this.mediaElement.addEventListener('play', () => {
      if (this.isLeader) {
        this.broadcastPlaybackEvent('play', { currentTime: this.mediaElement.currentTime });
      }
    });

    this.mediaElement.addEventListener('pause', () => {
      if (this.isLeader) {
        this.broadcastPlaybackEvent('pause', { currentTime: this.mediaElement.currentTime });
      }
    });

    this.mediaElement.addEventListener('seeked', () => {
      if (this.isLeader) {
        this.broadcastPlaybackEvent('seek', { currentTime: this.mediaElement.currentTime });
      }
    });
  }

  broadcastPlaybackEvent(action, data) {
    this.dataChannelManager.broadcastMessage({
      type: 'playback_sync',
      data: {
        action,
        timestamp: Date.now(),
        ...data
      }
    });
  }

  handleMessage(peerId, data) {
    if (this.isLeader || !this.mediaElement) return;

    const latency = Date.now() - data.timestamp;
    const adjustedTime = data.currentTime + (latency / 1000);

    switch (data.action) {
      case 'play':
        this.syncPlay(adjustedTime);
        break;
      case 'pause':
        this.syncPause(adjustedTime);
        break;
      case 'seek':
        this.syncSeek(adjustedTime);
        break;
    }
  }

  syncPlay(targetTime) {
    const currentTime = this.mediaElement.currentTime;
    const timeDiff = Math.abs(currentTime - targetTime) * 1000;

    if (timeDiff > this.syncTolerance) {
      this.mediaElement.currentTime = targetTime;
    }
    
    this.mediaElement.play();
  }

  syncPause(targetTime) {
    this.mediaElement.pause();
    this.mediaElement.currentTime = targetTime;
  }

  syncSeek(targetTime) {
    this.mediaElement.currentTime = targetTime;
  }

  becomeLeader() {
    this.isLeader = true;
    console.log('Became playback leader');
  }

  handlePeerDisconnect(peerId) {
    // Handle leader disconnection logic
  }

  isEnabled() {
    return this.isEnabled;
  }

  dispose() {
    this.mediaElement = null;
    this.isLeader = false;
  }
}

// Breakout Room Manager (simplified implementation)
class BreakoutRoomManager {
  constructor(dataChannelManager) {
    this.dataChannelManager = dataChannelManager;
    this.isEnabled = true;
    this.currentRoom = 'main';
    this.rooms = new Map(); // roomId -> participants
    this.maxRooms = 10;
  }

  async initialize() {
    console.log('Initializing Breakout Room Manager...');
    this.rooms.set('main', new Set());
  }

  createRoom(roomId, participants = []) {
    if (this.rooms.size >= this.maxRooms) {
      throw new Error('Maximum number of rooms reached');
    }

    this.rooms.set(roomId, new Set(participants));
    
    this.broadcastRoomUpdate('room_created', { roomId, participants });
    console.log(`Breakout room ${roomId} created`);
  }

  joinRoom(roomId, peerId = null) {
    if (!this.rooms.has(roomId)) {
      throw new Error(`Room ${roomId} does not exist`);
    }

    const oldRoom = this.currentRoom;
    this.currentRoom = roomId;
    
    // Remove from old room
    if (this.rooms.has(oldRoom)) {
      this.rooms.get(oldRoom).delete(peerId || 'self');
    }
    
    // Add to new room
    this.rooms.get(roomId).add(peerId || 'self');
    
    this.broadcastRoomUpdate('user_moved', { 
      peerId: peerId || 'self', 
      fromRoom: oldRoom, 
      toRoom: roomId 
    });
    
    console.log(`Moved to room ${roomId}`);
  }

  leaveRoom(peerId = null) {
    const room = this.rooms.get(this.currentRoom);
    if (room) {
      room.delete(peerId || 'self');
    }
    
    this.currentRoom = 'main';
    this.rooms.get('main').add(peerId || 'self');
    
    this.broadcastRoomUpdate('user_left', { peerId: peerId || 'self' });
  }

  broadcastRoomUpdate(action, data) {
    this.dataChannelManager.broadcastMessage({
      type: 'room_management',
      data: {
        action,
        timestamp: Date.now(),
        ...data
      }
    });
  }

  handleMessage(peerId, data) {
    switch (data.action) {
      case 'room_created':
        if (!this.rooms.has(data.roomId)) {
          this.rooms.set(data.roomId, new Set(data.participants));
        }
        break;
      case 'user_moved':
        this.handleUserMove(data);
        break;
      case 'user_left':
        this.handleUserLeave(data);
        break;
    }
  }

  handleUserMove(data) {
    if (this.rooms.has(data.fromRoom)) {
      this.rooms.get(data.fromRoom).delete(data.peerId);
    }
    
    if (this.rooms.has(data.toRoom)) {
      this.rooms.get(data.toRoom).add(data.peerId);
    }
  }

  handleUserLeave(data) {
    for (const [roomId, participants] of this.rooms) {
      participants.delete(data.peerId);
    }
  }

  getRoomParticipants(roomId) {
    return Array.from(this.rooms.get(roomId) || []);
  }

  getCurrentRoom() {
    return this.currentRoom;
  }

  handlePeerDisconnect(peerId) {
    // Remove peer from all rooms
    for (const [roomId, participants] of this.rooms) {
      participants.delete(peerId);
    }
  }

  isEnabled() {
    return this.isEnabled;
  }

  dispose() {
    this.rooms.clear();
    this.currentRoom = 'main';
  }
}

export default DataChannelManager;