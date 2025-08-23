/**
 * AI Insights Dashboard Component
 * 
 * Provides a comprehensive view of AI-powered features and recommendations:
 * - Real-time connection quality predictions
 * - Layout optimization suggestions  
 * - Participant engagement insights
 * - Performance optimization recommendations
 * - AI system health and metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  useAIInitialization,
  useConnectionIntelligence,
  useLayoutIntelligence,
  useParticipantIntelligence,
  usePerformanceIntelligence,
  useAIRecommendations,
  useAISettings,
} from '../../stores/aiStore';

// Sub-components
import ConnectionQualityPredictions from './ConnectionQualityPredictions.jsx';
import LayoutRecommendations from './LayoutRecommendations.jsx';
import EngagementInsights from './EngagementInsights.jsx';
import PerformanceOptimizations from './PerformanceOptimizations.jsx';
import TroubleshootingAssistant from './TroubleshootingAssistant.jsx';
import AISystemHealth from './AISystemHealth.jsx';

const AIInsightsDashboard = ({ 
  isVisible = false, 
  onClose, 
  compact = false,
  aiService 
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  
  // AI store hooks
  const aiInitialization = useAIInitialization();
  const connectionIntelligence = useConnectionIntelligence();
  const layoutIntelligence = useLayoutIntelligence();
  const participantIntelligence = useParticipantIntelligence();
  const performanceIntelligence = usePerformanceIntelligence();
  const aiRecommendations = useAIRecommendations();
  const aiSettings = useAISettings();
  
  // Local state
  const [systemMetrics, setSystemMetrics] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !isVisible) return;
    
    const interval = setInterval(() => {
      refreshDashboard();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, isVisible, refreshInterval]);

  // Refresh dashboard data
  const refreshDashboard = useCallback(async () => {
    if (!aiService || isLoading) return;
    
    setIsLoading(true);
    try {
      const metrics = await aiService.getServiceMetrics();
      setSystemMetrics(metrics);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error('Failed to refresh AI dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, [aiService, isLoading]);

  // Manual refresh
  const handleManualRefresh = useCallback(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  // Request immediate AI analysis
  const handleRequestAnalysis = useCallback(async () => {
    if (!aiService) return;
    
    setIsLoading(true);
    try {
      await aiService.requestAnalysis();
      await refreshDashboard();
    } catch (error) {
      console.error('Failed to request AI analysis:', error);
    } finally {
      setIsLoading(false);
    }
  }, [aiService, refreshDashboard]);

  if (!isVisible) return null;

  if (!aiInitialization.isInitialized) {
    return (
      <div className="ai-insights-dashboard ai-insights-dashboard--loading">
        <div className="dashboard-header">
          <h2>AI Intelligence System</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Initializing AI Intelligence System...</p>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${aiInitialization.initializationProgress || 0}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '🎯' },
    { id: 'connections', label: 'Connections', icon: '🔗' },
    { id: 'layout', label: 'Layout', icon: '🎨' },
    { id: 'participants', label: 'Participants', icon: '👥' },
    { id: 'performance', label: 'Performance', icon: '⚡' },
    { id: 'recommendations', label: 'Recommendations', icon: '💡' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  const activeRecommendationsCount = aiRecommendations.active.length;
  const criticalRecommendations = aiRecommendations.active.filter(r => r.priority === 'high').length;

  return (
    <div className={`ai-insights-dashboard ${compact ? 'ai-insights-dashboard--compact' : ''}`}>
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="header-title">
          <h2>🤖 AI Intelligence Dashboard</h2>
          <div className="system-status">
            <div className={`status-indicator ${aiInitialization.isInitialized ? 'online' : 'offline'}`} />
            <span>{aiInitialization.isInitialized ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        
        <div className="header-controls">
          <button 
            onClick={handleRequestAnalysis}
            disabled={isLoading}
            className="refresh-button"
            title="Request AI Analysis"
          >
            {isLoading ? '🔄' : '🧠'}
          </button>
          
          <button 
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="refresh-button"
            title="Refresh Dashboard"
          >
            🔄
          </button>
          
          <div className="auto-refresh-control">
            <input
              type="checkbox"
              id="auto-refresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <label htmlFor="auto-refresh">Auto-refresh</label>
          </div>
          
          <button onClick={onClose} className="close-button">×</button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="quick-stats">
        <div className="stat">
          <span className="stat-label">Recommendations</span>
          <span className={`stat-value ${criticalRecommendations > 0 ? 'critical' : ''}`}>
            {activeRecommendationsCount}
            {criticalRecommendations > 0 && <span className="critical-badge">!</span>}
          </span>
        </div>
        
        <div className="stat">
          <span className="stat-label">Connections</span>
          <span className="stat-value">
            {Object.keys(connectionIntelligence.insights || {}).length}
          </span>
        </div>
        
        <div className="stat">
          <span className="stat-label">Layout Confidence</span>
          <span className="stat-value">
            {Math.round((layoutIntelligence.confidence || 0) * 100)}%
          </span>
        </div>
        
        <div className="stat">
          <span className="stat-label">Performance</span>
          <span className="stat-value">
            {performanceIntelligence.optimizations.length > 0 ? '⚠️' : '✅'}
          </span>
        </div>
        
        <div className="stat">
          <span className="stat-label">Last Updated</span>
          <span className="stat-value">
            {Math.round((Date.now() - lastUpdated) / 1000)}s ago
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="dashboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.id === 'recommendations' && activeRecommendationsCount > 0 && (
              <span className="tab-badge">{activeRecommendationsCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <OverviewTab
            connectionIntelligence={connectionIntelligence}
            layoutIntelligence={layoutIntelligence}
            participantIntelligence={participantIntelligence}
            performanceIntelligence={performanceIntelligence}
            aiRecommendations={aiRecommendations}
            systemMetrics={systemMetrics}
            compact={compact}
          />
        )}

        {activeTab === 'connections' && (
          <ConnectionQualityPredictions 
            intelligence={connectionIntelligence}
            compact={compact}
          />
        )}

        {activeTab === 'layout' && (
          <LayoutRecommendations 
            intelligence={layoutIntelligence}
            compact={compact}
          />
        )}

        {activeTab === 'participants' && (
          <EngagementInsights 
            intelligence={participantIntelligence}
            compact={compact}
          />
        )}

        {activeTab === 'performance' && (
          <PerformanceOptimizations 
            intelligence={performanceIntelligence}
            compact={compact}
          />
        )}

        {activeTab === 'recommendations' && (
          <RecommendationsTab 
            recommendations={aiRecommendations}
            compact={compact}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab 
            settings={aiSettings}
            systemMetrics={systemMetrics}
            compact={compact}
          />
        )}
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ 
  connectionIntelligence, 
  layoutIntelligence, 
  participantIntelligence, 
  performanceIntelligence,
  aiRecommendations,
  systemMetrics,
  compact 
}) => {
  const criticalRecommendations = aiRecommendations.active.filter(r => r.priority === 'high');
  
  return (
    <div className="overview-tab">
      {/* Critical Alerts */}
      {criticalRecommendations.length > 0 && (
        <div className="critical-alerts">
          <h3>🚨 Critical Recommendations</h3>
          {criticalRecommendations.slice(0, 3).map(rec => (
            <div key={rec.id} className="critical-alert">
              <div className="alert-content">
                <strong>{rec.title}</strong>
                <p>{rec.message}</p>
              </div>
              <div className="alert-confidence">
                {Math.round(rec.confidence * 100)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Intelligence Summary Cards */}
      <div className="intelligence-summary">
        <div className="summary-grid">
          <div className="summary-card">
            <div className="card-header">
              <span className="card-icon">🔗</span>
              <h4>Connection Intelligence</h4>
            </div>
            <div className="card-content">
              <div className="metric">
                <span className="metric-label">Monitored Connections</span>
                <span className="metric-value">
                  {Object.keys(connectionIntelligence.insights || {}).length}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Avg. Confidence</span>
                <span className="metric-value">
                  {Math.round((connectionIntelligence.averageConfidence || 0) * 100)}%
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Optimizations</span>
                <span className="metric-value">
                  {connectionIntelligence.optimizations.length}
                </span>
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-header">
              <span className="card-icon">🎨</span>
              <h4>Layout Intelligence</h4>
            </div>
            <div className="card-content">
              <div className="metric">
                <span className="metric-label">Current Layout</span>
                <span className="metric-value">
                  {layoutIntelligence.currentRecommendation?.type || 'Auto'}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Confidence</span>
                <span className="metric-value">
                  {Math.round((layoutIntelligence.confidence || 0) * 100)}%
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Suggestions</span>
                <span className="metric-value">
                  {layoutIntelligence.suggestions.length}
                </span>
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-header">
              <span className="card-icon">👥</span>
              <h4>Participant Intelligence</h4>
            </div>
            <div className="card-content">
              <div className="metric">
                <span className="metric-label">Participants</span>
                <span className="metric-value">
                  {participantIntelligence.insights?.size || 0}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Engagement</span>
                <span className="metric-value">
                  {participantIntelligence.engagement?.overallLevel || 'Medium'}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Speaking Balance</span>
                <span className="metric-value">
                  {Math.round((participantIntelligence.speakingBalance || 0.5) * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-header">
              <span className="card-icon">⚡</span>
              <h4>Performance Intelligence</h4>
            </div>
            <div className="card-content">
              <div className="metric">
                <span className="metric-label">Active Optimizations</span>
                <span className="metric-value">
                  {performanceIntelligence.optimizations.length}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Predictions</span>
                <span className="metric-value">
                  {performanceIntelligence.predictions.length}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">System Health</span>
                <span className="metric-value">
                  {systemMetrics?.systemStatus?.healthMetrics ? '✅' : '⚠️'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <h3>📊 Recent AI Activity</h3>
        <div className="activity-list">
          {aiRecommendations.history.slice(-5).reverse().map(rec => (
            <div key={rec.id} className="activity-item">
              <div className="activity-time">
                {new Date(rec.timestamp).toLocaleTimeString()}
              </div>
              <div className="activity-content">
                <span className="activity-type">{rec.type}</span>: {rec.title}
              </div>
              <div className="activity-confidence">
                {Math.round(rec.confidence * 100)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Recommendations Tab Component
const RecommendationsTab = ({ recommendations, compact }) => {
  return (
    <div className="recommendations-tab">
      <TroubleshootingAssistant 
        recommendations={recommendations}
        compact={compact}
      />
    </div>
  );
};

// Settings Tab Component
const SettingsTab = ({ settings, systemMetrics, compact }) => {
  return (
    <div className="settings-tab">
      <AISystemHealth 
        settings={settings}
        systemMetrics={systemMetrics}
        compact={compact}
      />
    </div>
  );
};

// Dashboard Styles
const dashboardStyles = `
  .ai-insights-dashboard {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 900px;
    max-height: 80vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 1000;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .ai-insights-dashboard--compact {
    width: 400px;
    max-height: 60vh;
  }

  .ai-insights-dashboard--loading {
    width: 400px;
    height: 200px;
    display: flex;
    flex-direction: column;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-title h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .system-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    opacity: 0.8;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
  }

  .status-indicator.online {
    background: #10b981;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .refresh-button {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    transition: background 0.2s;
  }

  .refresh-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auto-refresh-control {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }

  .close-button {
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .loading-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 40px;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top: 3px solid #60a5fa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .progress-bar {
    width: 200px;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #60a5fa;
    transition: width 0.3s ease;
  }

  .quick-stats {
    display: flex;
    gap: 20px;
    padding: 16px 24px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    overflow-x: auto;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 80px;
  }

  .stat-label {
    font-size: 12px;
    opacity: 0.7;
    text-align: center;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 600;
    position: relative;
  }

  .stat-value.critical {
    color: #ef4444;
  }

  .critical-badge {
    position: absolute;
    top: -4px;
    right: -8px;
    font-size: 12px;
    color: #ef4444;
  }

  .dashboard-tabs {
    display: flex;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    overflow-x: auto;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    white-space: nowrap;
    min-width: fit-content;
  }

  .tab:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.9);
  }

  .tab.active {
    background: rgba(96, 165, 250, 0.1);
    color: #60a5fa;
  }

  .tab.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: #60a5fa;
  }

  .tab-badge {
    background: #ef4444;
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 16px;
    text-align: center;
  }

  .dashboard-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .overview-tab {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .critical-alerts {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 16px;
  }

  .critical-alerts h3 {
    margin: 0 0 12px 0;
    color: #ef4444;
    font-size: 16px;
  }

  .critical-alert {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  }

  .critical-alert:last-child {
    border-bottom: none;
  }

  .alert-content strong {
    color: #ef4444;
    display: block;
    margin-bottom: 4px;
  }

  .alert-content p {
    margin: 0;
    font-size: 14px;
    opacity: 0.8;
  }

  .alert-confidence {
    font-weight: 600;
    color: #ef4444;
  }

  .intelligence-summary h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .summary-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .card-icon {
    font-size: 20px;
  }

  .card-header h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .metric {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }

  .metric-label {
    opacity: 0.7;
  }

  .metric-value {
    font-weight: 600;
  }

  .recent-activity h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
  }

  .activity-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .activity-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    font-size: 13px;
  }

  .activity-time {
    min-width: 60px;
    opacity: 0.6;
    font-size: 11px;
  }

  .activity-content {
    flex: 1;
  }

  .activity-type {
    color: #60a5fa;
    font-weight: 500;
  }

  .activity-confidence {
    min-width: 40px;
    text-align: right;
    opacity: 0.8;
  }

  /* Compact mode adjustments */
  .ai-insights-dashboard--compact .summary-grid {
    grid-template-columns: 1fr;
  }

  .ai-insights-dashboard--compact .quick-stats {
    flex-wrap: wrap;
    gap: 10px;
  }

  .ai-insights-dashboard--compact .stat {
    min-width: 60px;
  }

  .ai-insights-dashboard--compact .dashboard-content {
    padding: 16px;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = dashboardStyles;
  document.head.appendChild(styleElement);
}

export default AIInsightsDashboard;