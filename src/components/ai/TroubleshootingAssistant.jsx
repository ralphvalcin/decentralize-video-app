/**
 * Troubleshooting Assistant Component
 * 
 * AI-powered troubleshooting interface that provides:
 * - Intelligent issue detection and resolution
 * - Step-by-step troubleshooting guides
 * - Automated problem diagnosis
 * - Performance optimization suggestions
 */

import React, { useState, useCallback } from 'react';

const TroubleshootingAssistant = ({ recommendations, compact = false }) => {
  const [expandedRecommendation, setExpandedRecommendation] = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Filter recommendations
  const filteredRecommendations = recommendations.active.filter(rec => {
    const priorityMatch = filterPriority === 'all' || rec.priority === filterPriority;
    const typeMatch = filterType === 'all' || rec.type === filterType;
    return priorityMatch && typeMatch;
  });

  // Get unique types for filter
  const availableTypes = [...new Set(recommendations.active.map(r => r.type))];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';  
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '💡';
      case 'low': return 'ℹ️';
      default: return '❓';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'connection_optimization': return '🔗';
      case 'performance_optimization': return '⚡';
      case 'performance_bottleneck': return '🚫';
      case 'layout_change': return '🎨';
      case 'engagement_improvement': return '👥';
      case 'troubleshooting': return '🔧';
      case 'memory_leak': return '🧠';
      case 'cross_component_optimization': return '🔄';
      case 'engagement_recovery': return '📈';
      default: return '🤖';
    }
  };

  const handleRecommendationToggle = useCallback((id) => {
    setExpandedRecommendation(expandedRecommendation === id ? null : id);
  }, [expandedRecommendation]);

  const formatTimestamp = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className={`troubleshooting-assistant ${compact ? 'compact' : ''}`}>
      {/* Header */}
      <div className="assistant-header">
        <h3>🔧 AI Troubleshooting Assistant</h3>
        <div className="assistant-stats">
          <span className="stat">
            {recommendations.active.length} Active Issues
          </span>
          <span className="stat">
            {recommendations.dismissed.size} Resolved
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="assistant-filters">
        <div className="filter-group">
          <label>Priority:</label>
          <select 
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Type:</label>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            {availableTypes.map(type => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Recommendations List */}
      {filteredRecommendations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <h4>No Issues Found</h4>
          <p>
            {recommendations.active.length === 0 ? 
              'Your meeting is running smoothly!' : 
              'No issues match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="recommendations-list">
          {filteredRecommendations.map(rec => (
            <div 
              key={rec.id} 
              className={`recommendation-card priority-${rec.priority}`}
            >
              {/* Header */}
              <div 
                className="card-header"
                onClick={() => handleRecommendationToggle(rec.id)}
              >
                <div className="header-left">
                  <span className="type-icon">{getTypeIcon(rec.type)}</span>
                  <div className="header-info">
                    <div className="card-title">{rec.title}</div>
                    <div className="card-meta">
                      <span className="priority-badge" style={{ 
                        backgroundColor: getPriorityColor(rec.priority) 
                      }}>
                        {getPriorityIcon(rec.priority)} {rec.priority}
                      </span>
                      <span className="confidence">
                        {Math.round(rec.confidence * 100)}% confident
                      </span>
                      <span className="timestamp">
                        {formatTimestamp(rec.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <button className="expand-button">
                  {expandedRecommendation === rec.id ? '−' : '+'}
                </button>
              </div>

              {/* Content */}
              <div className="card-content">
                <p className="recommendation-message">{rec.message}</p>
                
                {expandedRecommendation === rec.id && (
                  <div className="expanded-content">
                    {/* Additional Details */}
                    {rec.metadata && (
                      <div className="metadata">
                        <h5>Details:</h5>
                        <div className="metadata-grid">
                          {Object.entries(rec.metadata).map(([key, value]) => (
                            <div key={key} className="metadata-item">
                              <span className="metadata-key">{key}:</span>
                              <span className="metadata-value">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Peer Information */}
                    {rec.peerId && (
                      <div className="peer-info">
                        <h5>Affected Connection:</h5>
                        <span className="peer-id">{rec.peerId}</span>
                      </div>
                    )}

                    {/* Troubleshooting Steps */}
                    {rec.type === 'troubleshooting' && (
                      <div className="troubleshooting-steps">
                        <h5>Recommended Steps:</h5>
                        <ol className="steps-list">
                          <li>Check your network connection stability</li>
                          <li>Verify camera and microphone permissions</li>
                          <li>Close unnecessary browser tabs</li>
                          <li>Try refreshing the page</li>
                          <li>Switch to a different network if available</li>
                        </ol>
                      </div>
                    )}

                    {/* Performance Optimization Steps */}
                    {rec.type === 'performance_optimization' && (
                      <div className="optimization-steps">
                        <h5>Optimization Options:</h5>
                        <ul className="optimization-list">
                          <li>💻 Reduce video quality to improve performance</li>
                          <li>🔇 Disable video when not needed</li>
                          <li>🗂️ Close other applications</li>
                          <li>📱 Switch to audio-only mode</li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              {rec.actions && rec.actions.length > 0 && (
                <div className="card-actions">
                  {rec.actions.map((action, index) => (
                    <button
                      key={index}
                      className={`action-button ${index === 0 ? 'primary' : 'secondary'}`}
                      onClick={() => handleAction(rec.id, action)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="quick-action-btn" onClick={() => window.location.reload()}>
          🔄 Refresh Page
        </button>
        <button className="quick-action-btn" onClick={() => console.log('Test connection')}>
          🔍 Test Connection
        </button>
        <button className="quick-action-btn" onClick={() => console.log('System info')}>
          ℹ️ System Info
        </button>
      </div>
    </div>
  );

  function handleAction(recommendationId, action) {
    console.log('Handling troubleshooting action:', action);
    // This would integrate with the parent component's action handler
  }
};

// Component styles
const troubleshootingStyles = `
  .troubleshooting-assistant {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
  }

  .troubleshooting-assistant.compact {
    gap: 12px;
  }

  .assistant-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .assistant-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .assistant-stats {
    display: flex;
    gap: 16px;
    font-size: 14px;
  }

  .assistant-stats .stat {
    opacity: 0.8;
  }

  .assistant-filters {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .filter-group label {
    font-size: 14px;
    opacity: 0.8;
  }

  .filter-select {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: white;
    padding: 4px 8px;
    font-size: 13px;
  }

  .filter-select option {
    background: #1a1a2e;
    color: white;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.6;
  }

  .empty-state h4 {
    margin: 0 0 8px 0;
    opacity: 0.8;
  }

  .empty-state p {
    margin: 0;
    opacity: 0.6;
    font-size: 14px;
  }

  .recommendations-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
  }

  .recommendation-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .recommendation-card:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .priority-critical {
    border-left: 4px solid #ef4444;
  }

  .priority-high {
    border-left: 4px solid #f97316;
  }

  .priority-medium {
    border-left: 4px solid #f59e0b;
  }

  .priority-low {
    border-left: 4px solid #10b981;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    cursor: pointer;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .type-icon {
    font-size: 20px;
  }

  .header-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-title {
    font-weight: 600;
    font-size: 14px;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    opacity: 0.8;
  }

  .priority-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 12px;
    color: white;
    font-weight: 500;
    font-size: 11px;
  }

  .confidence {
    color: #60a5fa;
  }

  .expand-button {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: background 0.2s;
  }

  .expand-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .card-content {
    padding: 0 16px 16px 16px;
  }

  .recommendation-message {
    margin: 0 0 12px 0;
    font-size: 14px;
    opacity: 0.9;
    line-height: 1.4;
  }

  .expanded-content {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 12px;
    margin-top: 12px;
  }

  .expanded-content h5 {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 600;
    opacity: 0.9;
  }

  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }

  .metadata-item {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .metadata-key {
    opacity: 0.7;
    text-transform: capitalize;
  }

  .metadata-value {
    font-weight: 500;
  }

  .peer-info {
    margin-bottom: 12px;
  }

  .peer-id {
    font-family: monospace;
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  .troubleshooting-steps,
  .optimization-steps {
    margin-bottom: 12px;
  }

  .steps-list,
  .optimization-list {
    margin: 8px 0 0 0;
    padding-left: 20px;
    font-size: 13px;
    opacity: 0.9;
  }

  .steps-list li,
  .optimization-list li {
    margin-bottom: 4px;
  }

  .optimization-list {
    list-style: none;
    padding-left: 0;
  }

  .optimization-list li {
    padding-left: 20px;
    position: relative;
  }

  .card-actions {
    display: flex;
    gap: 8px;
    padding: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
  }

  .action-button {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
  }

  .action-button.primary {
    background: #60a5fa;
    color: white;
    border-color: #60a5fa;
  }

  .action-button.primary:hover {
    background: #3b82f6;
  }

  .action-button.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .action-button.secondary:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .quick-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .quick-action-btn {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: white;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .quick-action-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  /* Compact mode adjustments */
  .troubleshooting-assistant.compact .recommendations-list {
    max-height: 300px;
  }

  .troubleshooting-assistant.compact .card-header {
    padding: 12px;
  }

  .troubleshooting-assistant.compact .card-content {
    padding: 0 12px 12px 12px;
  }

  .troubleshooting-assistant.compact .card-actions {
    padding: 12px;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = troubleshootingStyles;
  document.head.appendChild(styleElement);
}

export default TroubleshootingAssistant;