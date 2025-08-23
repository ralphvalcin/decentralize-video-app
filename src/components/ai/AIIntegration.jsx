/**
 * AI Integration Component
 * 
 * Seamlessly integrates AI intelligence into the video chat application:
 * - Provides non-intrusive AI recommendations
 * - Shows AI insights when requested
 * - Handles AI service lifecycle
 * - Displays AI-powered notifications
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAIServices, useAIRecommendations, useAISettings } from '../../hooks/useAIServices.js';
import AIInsightsDashboard from './AIInsightsDashboard.jsx';
import toast from 'react-hot-toast';

const AIIntegration = ({ 
  roomId, 
  userInfo, 
  onRecommendation,
  className = '',
  position = 'bottom-right' 
}) => {
  const [showDashboard, setShowDashboard] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [lastRecommendationTime, setLastRecommendationTime] = useState(0);

  // AI services
  const aiServices = useAIServices(roomId, userInfo, {
    autoStart: true,
    enableConnectionIntelligence: true,
    enableLayoutIntelligence: true,
    enableParticipantIntelligence: true,
    enablePerformanceIntelligence: true,
  });

  // AI recommendations
  const aiRecommendations = useAIRecommendations();
  const aiSettings = useAISettings();

  // Show AI badge when there are active recommendations
  useEffect(() => {
    const hasRecommendations = aiRecommendations.counts.total > 0;
    const hasCritical = aiRecommendations.counts.critical > 0;
    
    setShowBadge(hasRecommendations);
    
    // Auto-show dashboard for critical recommendations
    if (hasCritical && !showDashboard) {
      setShowDashboard(true);
    }
  }, [aiRecommendations.counts, showDashboard]);

  // Handle new recommendations
  useEffect(() => {
    aiRecommendations.recommendations.forEach(recommendation => {
      if (recommendation.timestamp > lastRecommendationTime) {
        handleNewRecommendation(recommendation);
        setLastRecommendationTime(Math.max(lastRecommendationTime, recommendation.timestamp));
      }
    });
  }, [aiRecommendations.recommendations, lastRecommendationTime]);

  // Handle new AI recommendations
  const handleNewRecommendation = useCallback((recommendation) => {
    const { priority, title, message, actions } = recommendation;
    
    // Show toast notification for important recommendations
    if (priority === 'critical' || priority === 'high') {
      const toastOptions = {
        duration: priority === 'critical' ? 8000 : 5000,
        icon: priority === 'critical' ? '🚨' : '💡',
        position: 'top-right',
      };
      
      toast.custom((t) => (
        <div 
          className={`ai-recommendation-toast toast-${priority} ${t.visible ? 'animate-enter' : 'animate-leave'}`}
          onClick={() => {
            setShowDashboard(true);
            toast.dismiss(t.id);
          }}
        >
          <div className="toast-content">
            <div className="toast-header">
              <span className="toast-icon">{toastOptions.icon}</span>
              <span className="toast-title">{title}</span>
              <button 
                className="toast-close"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.dismiss(t.id);
                }}
              >
                ×
              </button>
            </div>
            <div className="toast-message">{message}</div>
            {actions && actions.length > 0 && (
              <div className="toast-actions">
                {actions.slice(0, 2).map((action, index) => (
                  <button
                    key={index}
                    className="toast-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRecommendationAction(recommendation.id, action);
                      toast.dismiss(t.id);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ), toastOptions);
    }
    
    // Notify parent component
    if (onRecommendation) {
      onRecommendation(recommendation);
    }
  }, [onRecommendation]);

  // Handle recommendation actions
  const handleRecommendationAction = useCallback(async (recommendationId, action) => {
    console.log('🤖 Handling AI recommendation action:', action.action, action.data);
    
    try {
      switch (action.action) {
        case 'dismiss':
          aiRecommendations.actions.dismiss(recommendationId);
          break;
          
        case 'apply_optimization':
          // Handle performance optimization
          if (action.data && aiServices.aiService) {
            // Apply the optimization through AI service
            console.log('Applying optimization:', action.data);
          }
          break;
          
        case 'force_layout_spotlight':
          // Force layout change to spotlight
          console.log('Switching to spotlight layout');
          break;
          
        case 'reduce_quality':
          // Reduce video quality
          console.log('Reducing video quality');
          break;
          
        case 'create_poll':
          // Create engagement poll
          console.log('Creating engagement poll');
          break;
          
        case 'check_network':
          // Open network diagnostics
          console.log('Opening network diagnostics');
          break;
          
        case 'cleanup_memory':
          // Trigger memory cleanup
          console.log('Triggering memory cleanup');
          break;
          
        case 'reload_page':
          // Confirm page reload
          if (confirm('Reload the page to free up memory? You will need to rejoin the meeting.')) {
            window.location.reload();
          }
          break;
          
        default:
          console.warn('Unknown AI recommendation action:', action.action);
      }
      
      // Dismiss the recommendation after handling
      aiRecommendations.actions.dismiss(recommendationId);
      
    } catch (error) {
      console.error('Error handling AI recommendation action:', error);
      
      toast.error(`Failed to execute "${action.label}": ${error.message}`, {
        duration: 4000,
      });
    }
  }, [aiRecommendations, aiServices]);

  // Toggle AI dashboard
  const toggleDashboard = useCallback(() => {
    setShowDashboard(!showDashboard);
  }, [showDashboard]);

  // Toggle AI features
  const toggleAIFeature = useCallback((feature) => {
    aiSettings.toggleFeature(feature);
    
    toast.success(`AI ${feature.replace(/([A-Z])/g, ' $1').toLowerCase()} ${aiSettings.isFeatureEnabled(feature) ? 'disabled' : 'enabled'}`, {
      duration: 3000,
    });
  }, [aiSettings]);

  // Don't render if AI services failed to initialize
  if (aiServices.initializationError) {
    console.warn('AI Integration disabled due to initialization error:', aiServices.initializationError);
    return null;
  }

  // Don't render if AI is not ready
  if (!aiServices.isInitialized || !aiServices.isActive) {
    return null;
  }

  return (
    <div className={`ai-integration ${className} ai-integration--${position}`}>
      {/* AI Status Badge */}
      {showBadge && (
        <button
          className="ai-badge"
          onClick={toggleDashboard}
          title="AI Intelligence Active"
        >
          <span className="ai-badge-icon">🤖</span>
          {aiRecommendations.counts.total > 0 && (
            <span className="ai-badge-count">
              {aiRecommendations.counts.total}
            </span>
          )}
          {aiRecommendations.counts.critical > 0 && (
            <span className="ai-badge-critical">!</span>
          )}
        </button>
      )}

      {/* AI Insights Dashboard */}
      <AIInsightsDashboard
        isVisible={showDashboard}
        onClose={() => setShowDashboard(false)}
        aiService={aiServices.aiService}
        compact={false}
      />

      {/* AI Quick Controls (Hidden by default) */}
      <div className="ai-quick-controls" style={{ display: 'none' }}>
        <button
          className="ai-control"
          onClick={() => aiServices.requestAnalysis()}
          title="Request AI Analysis"
        >
          🧠
        </button>
        
        <button
          className="ai-control"
          onClick={() => toggleAIFeature('enableConnectionIntelligence')}
          title="Toggle Connection Intelligence"
        >
          🔗
        </button>
        
        <button
          className="ai-control"
          onClick={() => toggleAIFeature('enableLayoutIntelligence')}
          title="Toggle Layout Intelligence"
        >
          🎨
        </button>
        
        <button
          className="ai-control"
          onClick={() => aiRecommendations.actions.clearAll()}
          title="Clear All Recommendations"
        >
          🧹
        </button>
      </div>
    </div>
  );
};

// Component Styles
const integrationStyles = `
  .ai-integration {
    position: fixed;
    z-index: 999;
    pointer-events: none;
  }

  .ai-integration--bottom-right {
    bottom: 20px;
    right: 20px;
  }

  .ai-integration--bottom-left {
    bottom: 20px;
    left: 20px;
  }

  .ai-integration--top-right {
    top: 20px;
    right: 20px;
  }

  .ai-integration--top-left {
    top: 20px;
    left: 20px;
  }

  .ai-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    position: relative;
    pointer-events: auto;
  }

  .ai-badge:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  }

  .ai-badge:active {
    transform: scale(0.95);
  }

  .ai-badge-icon {
    font-size: 24px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }

  .ai-badge-count {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ef4444;
    color: white;
    font-size: 12px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .ai-badge-critical {
    position: absolute;
    top: -2px;
    left: -2px;
    background: #ef4444;
    color: white;
    font-size: 14px;
    font-weight: bold;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse-critical 1s infinite;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
  }

  @keyframes pulse-critical {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  .ai-quick-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    pointer-events: auto;
  }

  .ai-control {
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
  }

  .ai-control:hover {
    background: white;
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .ai-recommendation-toast {
    background: white;
    border-radius: 8px;
    padding: 16px;
    margin: 8px;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    transition: all 0.3s ease;
    border-left: 4px solid #60a5fa;
  }

  .ai-recommendation-toast:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  }

  .toast-critical {
    border-left-color: #ef4444;
    background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%);
  }

  .toast-high {
    border-left-color: #f97316;
    background: linear-gradient(135deg, #fff7ed 0%, #ffffff 100%);
  }

  .toast-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .toast-icon {
    font-size: 18px;
  }

  .toast-title {
    font-weight: 600;
    font-size: 14px;
    flex: 1;
    color: #1f2937;
  }

  .toast-close {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .toast-close:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #374151;
  }

  .toast-message {
    font-size: 13px;
    color: #4b5563;
    line-height: 1.4;
    margin-bottom: 12px;
  }

  .toast-actions {
    display: flex;
    gap: 8px;
  }

  .toast-action {
    background: #60a5fa;
    border: none;
    color: white;
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .toast-action:hover {
    background: #3b82f6;
  }

  .toast-action:last-child {
    background: rgba(0, 0, 0, 0.05);
    color: #374151;
  }

  .toast-action:last-child:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .animate-enter {
    animation: slideIn 0.3s ease-out;
  }

  .animate-leave {
    animation: slideOut 0.3s ease-in;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .ai-integration--bottom-right,
    .ai-integration--top-right {
      right: 16px;
    }

    .ai-integration--bottom-left,
    .ai-integration--top-left {
      left: 16px;
    }

    .ai-integration--bottom-right,
    .ai-integration--bottom-left {
      bottom: 16px;
    }

    .ai-integration--top-right,
    .ai-integration--top-left {
      top: 16px;
    }

    .ai-badge {
      width: 48px;
      height: 48px;
    }

    .ai-badge-icon {
      font-size: 20px;
    }

    .ai-recommendation-toast {
      max-width: 320px;
      margin: 4px;
      padding: 12px;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = integrationStyles;
  document.head.appendChild(styleElement);
}

export default AIIntegration;