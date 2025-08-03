import React from 'react';

const StatusIndicator = ({ status, label, size = 'md', showLabel = true }) => {
  const statusClasses = {
    online: 'status-online',
    offline: 'status-offline', 
    connecting: 'status-connecting',
    error: 'status-error'
  };

  const icons = {
    online: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 8 8">
        <circle cx={4} cy={4} r={3} />
      </svg>
    ),
    offline: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 8 8">
        <circle cx={4} cy={4} r={3} />
      </svg>
    ),
    connecting: (
      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    ),
    error: (
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    )
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5', 
    lg: 'text-sm px-3 py-1'
  };

  return (
    <span className={`status-indicator ${statusClasses[status]} ${sizeClasses[size]} gap-1.5`}>
      {icons[status]}
      {showLabel && (label || status)}
    </span>
  );
};

export default StatusIndicator;