import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

const Chat = ({ messages, onSendMessage, isOpen, onToggle, userInfo }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const sanitizedMessage = DOMPurify.sanitize(newMessage.trim());
    if (sanitizedMessage && sanitizedMessage.length > 0 && sanitizedMessage.length <= 1000) {
      onSendMessage(sanitizedMessage);
      setNewMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-4 top-16 bottom-24 w-96 max-w-[calc(100vw-2rem)] card flex flex-col z-40 shadow-hard animate-slide-down">
      {/* Chat Header */}
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
              <span className="text-sm">💬</span>
            </div>
            <div>
              <h3 className="text-white font-semibold">Meeting Chat</h3>
              <p className="text-xs text-surface-400">
                {messages.length} message{messages.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="btn-ghost p-2 text-surface-400 hover:text-white"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-surface-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <p className="text-surface-400 text-sm mb-2">No messages yet</p>
              <p className="text-surface-500 text-xs">Start the conversation with your team!</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((message, index) => {
              const isOwnMessage = message.userId === userInfo?.id;
              const showAvatar = !isOwnMessage && (index === 0 || messages[index - 1]?.userId !== message.userId);
              
              return (
                <div
                  key={index}
                  className={`flex gap-3 ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-slide-up`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Avatar for other users */}
                  {!isOwnMessage && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br from-surface-600 to-surface-700 flex-shrink-0 ${
                      showAvatar ? '' : 'invisible'
                    }`}>
                      {message.userName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div className={`max-w-xs ${isOwnMessage ? 'order-first' : ''}`}>
                    {/* Sender name for other users */}
                    {!isOwnMessage && showAvatar && (
                      <div className="text-xs text-surface-400 mb-1 px-1">
                        {message.userName}
                      </div>
                    )}
                    
                    {/* Message content */}
                    <div
                      className={`px-4 py-3 rounded-2xl shadow-soft ${
                        isOwnMessage
                          ? 'bg-primary-600 text-white rounded-br-lg'
                          : 'bg-surface-700 text-white rounded-bl-lg'
                      }`}
                    >
                      <div 
                        className="text-sm leading-relaxed" 
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.text) }}
                      />
                      <div className={`text-xs mt-2 ${
                        isOwnMessage ? 'text-primary-100' : 'text-surface-400'
                      }`}>
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Spacer for own messages */}
                  {isOwnMessage && <div className="w-8"></div>}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="card-footer">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="input pr-12 resize-none min-h-[48px] max-h-32"
                maxLength={1000}
                rows={1}
                aria-label="Message input"
              />
              <div className="absolute right-3 bottom-3 text-xs text-surface-500">
                {newMessage.length}/1000
              </div>
            </div>
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="btn-primary px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <span className="text-lg">📤</span>
            </button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-2 text-xs text-surface-500">
            <div className="flex items-center gap-1">
              <span>💡</span>
              <span>Press Enter to send</span>
            </div>
            <div className="w-px h-3 bg-surface-600"></div>
            <div className="flex items-center gap-1">
              <span>📝</span>
              <span>Shift + Enter for new line</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chat; 