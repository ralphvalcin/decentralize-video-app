/**
 * Connection Quality Predictions Component
 * 
 * Displays AI-powered connection quality predictions and insights:
 * - Real-time connection quality scoring
 * - Predictive connection degradation warnings
 * - Network optimization recommendations
 * - Historical connection performance trends
 */

import React, { useState, useEffect } from 'react';

const ConnectionQualityPredictions = ({ intelligence, compact = false }) => {
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [timeRange, setTimeRange] = useState('5m'); // 5m, 15m, 1h
  const [showDetails, setShowDetails] = useState(!compact);

  const { insights, predictions, optimizations } = intelligence;

  // Convert Map to Array for easier handling
  const connectionInsights = insights ? Array.from(insights.entries()) : [];
  const connectionPredictions = predictions ? Array.from(predictions.entries()) : [];

  // Get the selected connection data
  const selectedInsight = selectedConnection ? insights?.get(selectedConnection) : null;
  const selectedPrediction = selectedConnection ? predictions?.get(selectedConnection) : null;

  // Auto-select first connection if none selected
  useEffect(() => {
    if (!selectedConnection && connectionInsights.length > 0) {
      setSelectedConnection(connectionInsights[0][0]);
    }
  }, [connectionInsights.length, selectedConnection]);

  const getQualityColor = (quality) => {
    if (typeof quality === 'number') {
      if (quality >= 80) return '#10b981'; // Green
      if (quality >= 60) return '#f59e0b'; // Yellow
      if (quality >= 40) return '#f97316'; // Orange
      return '#ef4444'; // Red
    }
    
    switch (quality) {
      case 'excellent': return '#10b981';
      case 'good': return '#22c55e';
      case 'fair': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improving': return '📈';
      case 'degrading': return '📉';
      case 'stable': return '➡️';
      default: return '❓';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  if (connectionInsights.length === 0) {
    return (
      <div className="connection-predictions">
        <div className="empty-state">
          <div className="empty-icon">🔗</div>
          <h3>No Active Connections</h3>
          <p>Connection intelligence will appear when participants join the meeting.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`connection-predictions ${compact ? 'connection-predictions--compact' : ''}`}>
      {/* Connection Overview */}
      <div className="connections-overview">
        <div className="section-header">
          <h3>🔗 Connection Quality Intelligence</h3>
          <div className="overview-stats">
            <span className="stat">
              {connectionInsights.length} Active
            </span>
            <span className="stat">
              {optimizations.length} Optimizations
            </span>
          </div>
        </div>

        {/* Connection List */}
        <div className="connections-list">
          {connectionInsights.map(([peerId, insight]) => {
            const prediction = predictions?.get(peerId);
            const qualityScore = insight.current?.quality || 0;
            const isSelected = selectedConnection === peerId;
            
            return (
              <div
                key={peerId}
                className={`connection-item ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedConnection(peerId)}
              >
                <div className="connection-info">
                  <div className="connection-id">
                    {peerId.substring(0, 8)}...
                  </div>
                  <div className="connection-quality">
                    <div 
                      className="quality-bar"
                      style={{ 
                        backgroundColor: getQualityColor(qualityScore),
                        width: `${qualityScore}%`
                      }}
                    />
                    <span className="quality-score">{qualityScore}</span>
                  </div>
                </div>
                
                <div className="connection-status">
                  {prediction && (
                    <>
                      <span className="trend-icon">
                        {getTrendIcon(prediction.trend)}
                      </span>
                      <span className="confidence">
                        {Math.round((prediction.confidence || 0) * 100)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed View */}
      {showDetails && selectedInsight && (
        <div className="connection-details">
          <div className="details-header">
            <h4>📊 Connection Details: {selectedConnection?.substring(0, 12)}...</h4>
            <div className="time-range-selector">
              {['5m', '15m', '1h'].map(range => (
                <button
                  key={range}
                  className={`time-range ${timeRange === range ? 'active' : ''}`}
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Current Metrics */}
          <div className="current-metrics">
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Quality Score</div>
                <div 
                  className="metric-value large"
                  style={{ color: getQualityColor(selectedInsight.current?.quality) }}
                >
                  {selectedInsight.current?.quality || 0}
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-label">Bandwidth</div>
                <div className="metric-value">
                  {Math.round((selectedInsight.current?.bandwidth || 0) / 1000)}k
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-label">Latency</div>
                <div className="metric-value">
                  {selectedInsight.current?.latency || 0}ms
                </div>
              </div>
              
              <div className="metric-card">
                <div className="metric-label">Packet Loss</div>
                <div className="metric-value">
                  {((selectedInsight.current?.packetLoss || 0) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Prediction Details */}
          {selectedPrediction && (
            <div className="prediction-details">
              <h5>🔮 AI Predictions</h5>
              <div className="prediction-content">
                <div className="prediction-item">
                  <span className="prediction-label">Quality Trend:</span>
                  <span className="prediction-value">
                    {getTrendIcon(selectedPrediction.trend)} {selectedPrediction.trend}
                  </span>
                </div>
                
                <div className="prediction-item">
                  <span className="prediction-label">Confidence:</span>
                  <span className="prediction-value">
                    {Math.round((selectedPrediction.confidence || 0) * 100)}%
                  </span>
                </div>
                
                {selectedPrediction.timeToIssue && (
                  <div className="prediction-item">
                    <span className="prediction-label">Time to Issue:</span>
                    <span className="prediction-value warning">
                      {selectedPrediction.timeToIssue}s
                    </span>
                  </div>
                )}
                
                {selectedPrediction.factors && selectedPrediction.factors.length > 0 && (
                  <div className="prediction-factors">
                    <div className="factors-label">Contributing Factors:</div>
                    <ul className="factors-list">
                      {selectedPrediction.factors.map((factor, index) => (
                        <li key={index} className="factor">{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Network Patterns */}
          {selectedInsight.patterns && (
            <div className="network-patterns">
              <h5>🌐 Network Patterns</h5>
              <div className="patterns-grid">
                <div className="pattern-item">
                  <span className="pattern-label">Time of Day:</span>
                  <span className="pattern-value">
                    {selectedInsight.patterns.timeOfDay}
                  </span>
                </div>
                
                <div className="pattern-item">
                  <span className="pattern-label">Network Type:</span>
                  <span className="pattern-value">
                    {selectedInsight.patterns.networkType}
                  </span>
                </div>
                
                <div className="pattern-item">
                  <span className="pattern-label">Usage Pattern:</span>
                  <span className="pattern-value">
                    {selectedInsight.patterns.usagePattern}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Trends Chart Placeholder */}
          <div className="trends-chart">
            <h5>📈 Quality Trends ({timeRange})</h5>
            <div className="chart-placeholder">
              <div className="chart-info">
                <span>Quality trend visualization would appear here</span>
                <small>Shows {timeRange} connection quality history</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Optimizations */}
      {optimizations.length > 0 && (
        <div className="active-optimizations">
          <h4>⚙️ Active Optimizations</h4>
          <div className="optimizations-list">
            {optimizations.map(opt => (
              <div key={opt.id} className="optimization-item">
                <div className="optimization-info">
                  <div className="optimization-type">{opt.type}</div>
                  <div className="optimization-description">{opt.description}</div>
                </div>
                
                <div className="optimization-meta">
                  <div className="optimization-confidence">
                    {Math.round((opt.confidence || 0) * 100)}%
                  </div>
                  <div className="optimization-time">
                    {new Date(opt.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <button 
          className="action-button primary"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
        
        <button className="action-button">
          Refresh Analysis
        </button>
        
        <button className="action-button">
          Export Data
        </button>
      </div>
    </div>
  );
};

// Component Styles
const connectionStyles = `
  .connection-predictions {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
  }

  .connection-predictions--compact {
    gap: 12px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .section-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .overview-stats {
    display: flex;
    gap: 16px;
  }

  .overview-stats .stat {
    font-size: 14px;
    opacity: 0.8;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    opacity: 0.8;
  }

  .empty-state p {
    margin: 0;
    opacity: 0.6;
    font-size: 14px;
  }

  .connections-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .connection-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
  }

  .connection-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .connection-item.selected {
    background: rgba(96, 165, 250, 0.1);
    border-color: rgba(96, 165, 250, 0.3);
  }

  .connection-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .connection-id {
    font-weight: 500;
    font-size: 14px;
  }

  .connection-quality {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .quality-bar {
    width: 60px;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    position: relative;
  }

  .quality-bar::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: inherit;
    background: inherit;
    border-radius: inherit;
  }

  .quality-score {
    font-size: 12px;
    font-weight: 600;
    min-width: 24px;
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .trend-icon {
    font-size: 16px;
  }

  .confidence {
    font-size: 12px;
    opacity: 0.8;
  }

  .connection-details {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .details-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .details-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .time-range-selector {
    display: flex;
    gap: 4px;
  }

  .time-range {
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .time-range:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .time-range.active {
    background: #60a5fa;
  }

  .current-metrics {
    margin-bottom: 20px;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 16px;
  }

  .metric-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
  }

  .metric-label {
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 4px;
  }

  .metric-value {
    font-size: 16px;
    font-weight: 600;
  }

  .metric-value.large {
    font-size: 24px;
  }

  .prediction-details {
    margin-bottom: 20px;
  }

  .prediction-details h5 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .prediction-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .prediction-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
  }

  .prediction-label {
    opacity: 0.8;
  }

  .prediction-value {
    font-weight: 500;
  }

  .prediction-value.warning {
    color: #f59e0b;
  }

  .prediction-factors {
    margin-top: 8px;
  }

  .factors-label {
    font-size: 13px;
    opacity: 0.8;
    margin-bottom: 4px;
  }

  .factors-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .factor {
    font-size: 12px;
    opacity: 0.7;
    padding-left: 12px;
    position: relative;
  }

  .factor::before {
    content: '•';
    position: absolute;
    left: 0;
    color: #60a5fa;
  }

  .network-patterns {
    margin-bottom: 20px;
  }

  .network-patterns h5 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .patterns-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
  }

  .pattern-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
  }

  .pattern-label {
    opacity: 0.7;
  }

  .pattern-value {
    font-weight: 500;
    text-transform: capitalize;
  }

  .trends-chart {
    margin-bottom: 20px;
  }

  .trends-chart h5 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .chart-placeholder {
    height: 120px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    border: 1px dashed rgba(255, 255, 255, 0.2);
  }

  .chart-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    opacity: 0.6;
  }

  .chart-info small {
    font-size: 12px;
  }

  .active-optimizations {
    margin-bottom: 20px;
  }

  .active-optimizations h4 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .optimizations-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .optimization-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 6px;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .optimization-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .optimization-type {
    font-weight: 500;
    font-size: 14px;
    color: #10b981;
  }

  .optimization-description {
    font-size: 12px;
    opacity: 0.8;
  }

  .optimization-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    font-size: 12px;
  }

  .optimization-confidence {
    font-weight: 600;
    color: #10b981;
  }

  .optimization-time {
    opacity: 0.6;
  }

  .quick-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .action-button {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .action-button.primary {
    background: #60a5fa;
    border-color: #60a5fa;
  }

  .action-button.primary:hover {
    background: #3b82f6;
  }

  /* Compact mode adjustments */
  .connection-predictions--compact .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .connection-predictions--compact .patterns-grid {
    grid-template-columns: 1fr;
  }

  .connection-predictions--compact .chart-placeholder {
    height: 80px;
  }

  .connection-predictions--compact .connection-details {
    padding: 16px;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = connectionStyles;
  document.head.appendChild(styleElement);
}

export default ConnectionQualityPredictions;