class ChatService {
  constructor(signalingService) {
    this.signalingService = signalingService;
    this.messages = [];
    this.unreadCount = 0;
    this.isOpen = false;
    
    // Callbacks
    this.onMessagesUpdated = null;
    this.onUnreadCountChanged = null;

    // Initialize event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.signalingService) return;

    this.signalingService.on('chat-history', (chatHistory) => {
      this.messages = chatHistory || [];
      this.notifyMessagesUpdated();
    });

    this.signalingService.on('new-message', (message) => {
      this.messages.push(message);
      
      // Increment unread count if chat is not open
      if (!this.isOpen) {
        this.unreadCount++;
        this.notifyUnreadCountChanged();
      }
      
      this.notifyMessagesUpdated();
    });
  }

  setCallbacks({ onMessagesUpdated, onUnreadCountChanged }) {
    this.onMessagesUpdated = onMessagesUpdated;
    this.onUnreadCountChanged = onUnreadCountChanged;
  }

  sendMessage(text, userInfo) {
    if (!text.trim() || !this.signalingService) return;

    const message = {
      id: Date.now(),
      text: text.trim(),
      userName: userInfo.name,
      userId: this.signalingService.socketId,
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    // Optimistically add to local messages
    this.messages.push(message);
    this.notifyMessagesUpdated();

    // Send to server
    this.signalingService.sendMessage({ text: text.trim() });
  }

  sendReaction(emoji, userInfo) {
    if (!emoji || !this.signalingService) return;

    const reaction = {
      id: Date.now(),
      emoji,
      userName: userInfo.name,
      userId: this.signalingService.socketId,
      timestamp: new Date().toISOString(),
      type: 'reaction'
    };

    // Send to server
    this.signalingService.sendReaction({ emoji });
  }

  setIsOpen(isOpen) {
    this.isOpen = isOpen;
    
    if (isOpen && this.unreadCount > 0) {
      this.unreadCount = 0;
      this.notifyUnreadCountChanged();
    }
  }

  getMessages() {
    return [...this.messages];
  }

  getUnreadCount() {
    return this.unreadCount;
  }

  clearUnreadCount() {
    if (this.unreadCount > 0) {
      this.unreadCount = 0;
      this.notifyUnreadCountChanged();
    }
  }

  // Message filtering and search
  searchMessages(query) {
    if (!query.trim()) return this.messages;

    const searchTerm = query.toLowerCase();
    return this.messages.filter(message => 
      message.text?.toLowerCase().includes(searchTerm) ||
      message.userName?.toLowerCase().includes(searchTerm)
    );
  }

  getMessagesByUser(userId) {
    return this.messages.filter(message => message.userId === userId);
  }

  getMessagesAfter(timestamp) {
    const targetTime = new Date(timestamp);
    return this.messages.filter(message => new Date(message.timestamp) > targetTime);
  }

  getMessagesBefore(timestamp) {
    const targetTime = new Date(timestamp);
    return this.messages.filter(message => new Date(message.timestamp) < targetTime);
  }

  // Message statistics
  getMessageStats() {
    const totalMessages = this.messages.length;
    const textMessages = this.messages.filter(m => m.type === 'text').length;
    const reactions = this.messages.filter(m => m.type === 'reaction').length;
    
    // Get unique users
    const uniqueUsers = [...new Set(this.messages.map(m => m.userId))];
    
    // Get most active user
    const userMessageCounts = {};
    this.messages.forEach(message => {
      userMessageCounts[message.userId] = (userMessageCounts[message.userId] || 0) + 1;
    });
    
    const mostActiveUser = Object.keys(userMessageCounts).reduce((a, b) => 
      userMessageCounts[a] > userMessageCounts[b] ? a : b, null
    );

    return {
      totalMessages,
      textMessages,
      reactions,
      uniqueUsers: uniqueUsers.length,
      mostActiveUser,
      mostActiveUserCount: mostActiveUser ? userMessageCounts[mostActiveUser] : 0
    };
  }

  // Export chat history
  exportChatHistory(format = 'json') {
    const history = {
      messages: this.messages,
      exportedAt: new Date().toISOString(),
      totalMessages: this.messages.length,
      stats: this.getMessageStats()
    };

    if (format === 'json') {
      return JSON.stringify(history, null, 2);
    } else if (format === 'text') {
      let text = `Chat History - Exported ${new Date().toLocaleString()}\n\n`;
      this.messages.forEach(message => {
        const timestamp = new Date(message.timestamp).toLocaleString();
        if (message.type === 'reaction') {
          text += `[${timestamp}] ${message.userName} reacted: ${message.emoji}\n`;
        } else {
          text += `[${timestamp}] ${message.userName}: ${message.text}\n`;
        }
      });
      return text;
    }

    return history;
  }

  // Clear all messages
  clearMessages() {
    this.messages = [];
    this.unreadCount = 0;
    this.notifyMessagesUpdated();
    this.notifyUnreadCountChanged();
  }

  // Notification callbacks
  notifyMessagesUpdated() {
    if (this.onMessagesUpdated) {
      this.onMessagesUpdated(this.getMessages());
    }
  }

  notifyUnreadCountChanged() {
    if (this.onUnreadCountChanged) {
      this.onUnreadCountChanged(this.unreadCount);
    }
  }

  // Cleanup
  destroy() {
    this.messages = [];
    this.unreadCount = 0;
    this.onMessagesUpdated = null;
    this.onUnreadCountChanged = null;
  }
}

export default ChatService;