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

  // Generate user avatar color based on name
  const getUserAvatarColor = (userName) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 
      'bg-yellow-500', 'bg-indigo-500', 'bg-red-500', 'bg-teal-500'
    ];
    let hash = 0;
    if (userName) {
      for (let i = 0; i < userName.length; i++) {
        hash = userName.charCodeAt(i) + ((hash << 5) - hash);
      }
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className={`fixed top-16 right-0 bottom-20 bg-slate-900 border-l border-slate-700 transition-all duration-300 ease-in-out z-40 ${
      isOpen ? 'w-80 md:w-96' : 'w-0'
    } overflow-hidden flex flex-col`}>
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg layout-flex-center">
            <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Team Chat</h3>
            <p className="text-xs text-slate-400">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="Close chat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-slate-300 text-sm mb-2">No messages yet</p>
              <p className="text-slate-500 text-xs">Start the conversation with your team!</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {messages.map((message, index) => {
              const isOwnMessage = message.userId === userInfo?.id;
              const showAvatar = index === 0 || messages[index - 1]?.userId !== message.userId;
              const showName = showAvatar && !isOwnMessage;
              
              return (
                <div key={index} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                  {/* Message with avatar and content */}
                  <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-xs flex-shrink-0 ${
                      showAvatar ? getUserAvatarColor(message.userName) : 'invisible'
                    }`}>
                      {message.userName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    
                    {/* Message Content */}
                    <div className={`flex-1 max-w-[250px] ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                      {/* Sender name and timestamp */}
                      {showName && (
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className="text-xs font-medium text-white">{message.userName}</span>
                          <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
                        </div>
                      )}
                      
                      {/* Message bubble */}
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          isOwnMessage
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-slate-700 text-slate-100 rounded-bl-md'
                        }`}
                      >
                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.text) }} />
                      </div>
                      
                      {/* Timestamp for own messages */}
                      {isOwnMessage && showAvatar && (
                        <div className="text-xs text-slate-500 mt-1 px-1">
                          {formatTime(message.timestamp)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="w-full px-3 py-2.5 text-sm bg-slate-700 border border-slate-600 rounded-lg resize-none min-h-[40px] max-h-32 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                maxLength={1000}
                rows={1}
                aria-label="Message input"
              />
              <div className="absolute right-3 bottom-2 text-xs text-slate-500">
                {newMessage.length}/1000
              </div>
            </div>
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded">Enter</kbd>
              <span>to send</span>
            </div>
            <div className="w-px h-3 bg-slate-600"></div>
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                <kbd className="px-1.5 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded">Shift</kbd>
                <span className="text-slate-600">+</span>
                <kbd className="px-1.5 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded">Enter</kbd>
              </div>
              <span>for new line</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chat; 