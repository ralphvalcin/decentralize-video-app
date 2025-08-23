/**
 * Layout Intelligence System
 * 
 * Automatically suggests optimal video layouts based on meeting context:
 * - Analyzes participant behavior and speaking patterns
 * - Recommends layouts for different meeting types
 * - Adapts to screen sharing and presentation modes
 * - Learns from user preferences over time
 */

export class LayoutIntelligence {
  constructor(roomStore, uiStore, aiStore) {
    this.roomStore = roomStore;
    this.uiStore = uiStore;
    this.aiStore = aiStore;
    
    // Context analyzers
    this.contextAnalyzer = new MeetingContextAnalyzer();
    this.layoutOptimizer = new LayoutOptimizer();
    this.userPreferenceEngine = new UserPreferenceEngine();
    
    // Meeting state tracking
    this.meetingContext = {
      type: 'unknown',
      participantCount: 0,
      speakingPatterns: new Map(),
      activityLevel: 'low',
      screenSharingActive: false,
      dominantSpeaker: null,
      engagementLevel: 'medium',
    };
    
    // Layout recommendation history
    this.recommendationHistory = [];
    this.userFeedback = new Map(); // layoutId -> feedback
    
    // Configuration
    this.config = {
      analysisInterval: 15000, // 15 seconds
      confidenceThreshold: 0.6,
      maxRecommendations: 3,
      learningRate: 0.1,
    };
    
    // State
    this.isInitialized = false;
    this.isAnalyzing = false;
    this.analysisInterval = null;
  }

  /**
   * Initialize layout intelligence system
   */
  async initialize() {
    try {
      console.log('🎨 Initializing Layout Intelligence...');
      
      // Initialize components
      await this.contextAnalyzer.initialize();
      await this.layoutOptimizer.initialize();
      await this.userPreferenceEngine.initialize();
      
      // Start continuous analysis
      this.startAnalysis();
      
      this.isInitialized = true;
      console.log('✅ Layout Intelligence initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Layout Intelligence:', error);
      throw error;
    }
  }

  /**
   * Start continuous meeting context analysis
   */
  startAnalysis() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    this.analysisInterval = setInterval(async () => {
      await this.analyzeMeetingContext();
    }, this.config.analysisInterval);
    
    this.isAnalyzing = true;
  }

  /**
   * Stop analysis
   */
  stopAnalysis() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    this.isAnalyzing = false;
  }

  /**
   * Analyze current meeting context and generate layout recommendations
   */
  async analyzeMeetingContext() {
    try {
      // Get current room state
      const roomState = this.roomStore.getState();
      const aiState = this.aiStore.getState();
      // Note: uiState reserved for future UI state analysis
      
      // Update meeting context
      await this.updateMeetingContext(roomState, aiState);
      
      // Generate layout recommendations
      const recommendations = await this.generateLayoutRecommendations();
      
      // Apply best recommendation if confidence is high enough
      if (recommendations.length > 0) {
        const bestRecommendation = recommendations[0];
        
        if (bestRecommendation.confidence >= this.config.confidenceThreshold) {
          await this.applyLayoutRecommendation(bestRecommendation);
        }
        
        // Update AI store with all recommendations
        this.aiStore.getState().generateLayoutSuggestions({ 
          context: this.meetingContext 
        });
      }
      
    } catch (error) {
      console.error('Error analyzing meeting context:', error);
    }
  }

  /**
   * Update meeting context based on current room state
   */
  async updateMeetingContext(roomState, aiState) {
    const participants = roomState.participants || new Map();
    const messages = roomState.chatMessages || [];
    const screenShare = roomState.screenShare;
    const engagement = aiState.engagementAnalysis;
    
    // Update basic context
    this.meetingContext.participantCount = participants.size;
    this.meetingContext.screenSharingActive = !!screenShare?.active;
    
    // Analyze meeting type
    this.meetingContext.type = await this.contextAnalyzer.classifyMeetingType({
      participantCount: participants.size,
      chatActivity: messages.length,
      screenSharing: this.meetingContext.screenSharingActive,
      duration: this.getMeetingDuration(),
      timeOfDay: new Date().getHours(),
    });
    
    // Update activity level
    this.meetingContext.activityLevel = this.calculateActivityLevel(messages);
    
    // Update engagement level
    if (engagement) {
      this.meetingContext.engagementLevel = engagement.overallLevel || 'medium';
    }
    
    // Analyze speaking patterns
    this.updateSpeakingPatterns(aiState.speakingPatterns);
    
    console.log('📊 Meeting context updated:', this.meetingContext);
  }

  /**
   * Generate layout recommendations based on meeting context
   */
  async generateLayoutRecommendations() {
    const recommendations = [];
    
    // Get user preferences
    const userPreferences = await this.userPreferenceEngine.getPreferences(this.meetingContext);
    
    // Generate recommendations based on context
    const contextRecommendations = await this.layoutOptimizer.optimize(
      this.meetingContext
    );
    
    // Score and rank recommendations
    for (const recommendation of contextRecommendations) {
      const scoredRecommendation = await this.scoreRecommendation(
        recommendation,
        userPreferences
      );
      
      if (scoredRecommendation.confidence > 0.3) {
        recommendations.push(scoredRecommendation);
      }
    }
    
    // Sort by confidence and limit
    recommendations.sort((a, b) => b.confidence - a.confidence);
    
    return recommendations.slice(0, this.config.maxRecommendations);
  }

  /**
   * Score a layout recommendation
   */
  async scoreRecommendation(recommendation, userPreferences) {
    let score = recommendation.baseScore || 0.5;
    let confidence = 0.5;
    
    // Context matching score
    const contextScore = this.calculateContextScore(recommendation);
    score = score * 0.4 + contextScore * 0.6;
    
    // User preference score
    const preferenceScore = this.calculatePreferenceScore(recommendation, userPreferences);
    score = score * 0.7 + preferenceScore * 0.3;
    
    // Historical success score
    const historicalScore = this.calculateHistoricalScore(recommendation);
    score = score * 0.8 + historicalScore * 0.2;
    
    // Confidence based on data quality
    confidence = Math.min(1.0, this.meetingContext.participantCount / 5 * 0.5 + 0.5);
    
    return {
      ...recommendation,
      confidence: Math.min(1.0, Math.max(0.0, score * confidence)),
      scoring: {
        context: contextScore,
        preference: preferenceScore,
        historical: historicalScore,
        confidence,
      },
    };
  }

  /**
   * Calculate context matching score
   */
  calculateContextScore(recommendation) {
    let score = 0.5;
    
    // Meeting type matching
    if (recommendation.optimalFor?.includes(this.meetingContext.type)) {
      score += 0.3;
    }
    
    // Participant count optimization
    const optimalRange = recommendation.participantRange;
    if (optimalRange && 
        this.meetingContext.participantCount >= optimalRange.min && 
        this.meetingContext.participantCount <= optimalRange.max) {
      score += 0.2;
    }
    
    // Screen sharing consideration
    if (this.meetingContext.screenSharingActive && recommendation.type === 'spotlight') {
      score += 0.2;
    } else if (!this.meetingContext.screenSharingActive && recommendation.type === 'grid') {
      score += 0.1;
    }
    
    // Activity level matching
    if (this.meetingContext.activityLevel === 'high' && recommendation.type === 'dynamic') {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate user preference score
   */
  calculatePreferenceScore(recommendation, userPreferences) {
    if (!userPreferences || Object.keys(userPreferences).length === 0) {
      return 0.5; // Neutral score if no preferences
    }
    
    let score = 0.5;
    
    // Layout type preference
    if (userPreferences.preferredLayouts?.includes(recommendation.type)) {
      score += 0.3;
    }
    
    // Feature preferences
    if (userPreferences.features) {
      if (userPreferences.features.autoArrange && recommendation.features?.autoArrange) {
        score += 0.1;
      }
      if (userPreferences.features.speakerFocus && recommendation.features?.speakerFocus) {
        score += 0.1;
      }
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate historical success score
   */
  calculateHistoricalScore(recommendation) {
    const historicalData = this.getHistoricalData(recommendation.type);
    
    if (!historicalData || historicalData.length === 0) {
      return 0.5; // Neutral score for new layouts
    }
    
    const successfulApplications = historicalData.filter(h => h.feedback === 'positive').length;
    const totalApplications = historicalData.length;
    
    return successfulApplications / totalApplications;
  }

  /**
   * Apply layout recommendation
   */
  async applyLayoutRecommendation(recommendation) {
    try {
      console.log('🎯 Applying layout recommendation:', recommendation);
      
      // Update UI store with new layout
      const uiActions = this.uiStore.getState();
      uiActions.setLayout({
        type: recommendation.type,
        config: recommendation.config,
        source: 'ai_recommendation',
        timestamp: Date.now(),
      });
      
      // Update AI store
      this.aiStore.getState().applyLayoutRecommendation(recommendation);
      
      // Record application
      this.recordRecommendationApplication(recommendation);
      
      // Generate user notification
      this.generateLayoutNotification(recommendation);
      
    } catch (error) {
      console.error('Failed to apply layout recommendation:', error);
    }
  }

  /**
   * Generate user notification for layout change
   */
  generateLayoutNotification(recommendation) {
    this.aiStore.getState().addRecommendation({
      id: `layout_${Date.now()}`,
      type: 'layout_change',
      priority: 'low',
      title: 'Layout Optimized',
      message: recommendation.reasoning || 'Layout automatically optimized for better meeting experience',
      confidence: recommendation.confidence,
      actions: [
        { label: 'OK', action: 'dismiss' },
        { label: 'Undo', action: 'undo_layout' },
      ],
      timestamp: Date.now(),
      metadata: {
        layoutType: recommendation.type,
        reason: recommendation.reasoning,
      },
    });
  }

  /**
   * Record user feedback on layout
   */
  recordLayoutFeedback(layoutId, feedback) {
    this.userFeedback.set(layoutId, {
      feedback,
      timestamp: Date.now(),
      context: { ...this.meetingContext },
    });
    
    // Update user preference engine
    this.userPreferenceEngine.updatePreferences(layoutId, feedback, this.meetingContext);
  }

  /**
   * Helper methods
   */
  getMeetingDuration() {
    // This would calculate actual meeting duration
    return 600; // 10 minutes default
  }

  calculateActivityLevel(messages) {
    const recentMessages = messages.filter(m => 
      Date.now() - m.timestamp < 60000 // Last minute
    ).length;
    
    if (recentMessages > 5) return 'high';
    if (recentMessages > 2) return 'medium';
    return 'low';
  }

  updateSpeakingPatterns(speakingPatterns) {
    if (!speakingPatterns) return;
    
    // Find dominant speaker
    let dominantSpeaker = null;
    let maxSpeakingTime = 0;
    
    speakingPatterns.forEach((patterns, peerId) => {
      const totalTime = patterns.totalSpeakingTime || 0;
      if (totalTime > maxSpeakingTime) {
        maxSpeakingTime = totalTime;
        dominantSpeaker = peerId;
      }
    });
    
    this.meetingContext.dominantSpeaker = dominantSpeaker;
    this.meetingContext.speakingPatterns = speakingPatterns;
  }

  recordRecommendationApplication(recommendation) {
    this.recommendationHistory.push({
      recommendation,
      timestamp: Date.now(),
      context: { ...this.meetingContext },
    });
    
    // Limit history size
    if (this.recommendationHistory.length > 50) {
      this.recommendationHistory.shift();
    }
  }

  getHistoricalData(layoutType) {
    return this.recommendationHistory
      .filter(h => h.recommendation.type === layoutType)
      .map(h => ({
        ...h,
        feedback: this.userFeedback.get(h.recommendation.id)?.feedback || 'neutral',
      }));
  }

  /**
   * Public API methods
   */
  async requestLayoutSuggestion(context = {}) {
    const customContext = { ...this.meetingContext, ...context };
    const recommendations = await this.layoutOptimizer.optimize(customContext);
    
    return recommendations.map(rec => this.scoreRecommendation(rec, {}));
  }

  async forceLayoutChange(layoutType, reason = 'Manual override') {
    const recommendation = {
      id: `force_${Date.now()}`,
      type: layoutType,
      confidence: 1.0,
      reasoning: reason,
      config: this.getDefaultLayoutConfig(layoutType),
    };
    
    await this.applyLayoutRecommendation(recommendation);
    return recommendation;
  }

  getDefaultLayoutConfig(layoutType) {
    const configs = {
      grid: { columns: 'auto', aspectRatio: '16:9' },
      spotlight: { mainSize: 'large', thumbnailSize: 'small' },
      presentation: { presenterSize: 'large', audienceGrid: true },
      dynamic: { adaptiveSize: true, speakerFocus: true },
    };
    
    return configs[layoutType] || {};
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopAnalysis();
    this.meetingContext = {};
    this.recommendationHistory = [];
    this.userFeedback.clear();
    this.isInitialized = false;
  }

  /**
   * Get intelligence metrics
   */
  getMetrics() {
    return {
      totalRecommendations: this.recommendationHistory.length,
      averageConfidence: this.calculateAverageConfidence(),
      userSatisfaction: this.calculateUserSatisfaction(),
      layoutDistribution: this.calculateLayoutDistribution(),
      isAnalyzing: this.isAnalyzing,
      currentContext: this.meetingContext,
    };
  }

  calculateAverageConfidence() {
    if (this.recommendationHistory.length === 0) return 0;
    
    const totalConfidence = this.recommendationHistory
      .reduce((sum, h) => sum + h.recommendation.confidence, 0);
    
    return totalConfidence / this.recommendationHistory.length;
  }

  calculateUserSatisfaction() {
    const feedbacks = Array.from(this.userFeedback.values());
    if (feedbacks.length === 0) return 0.5;
    
    const positiveCount = feedbacks.filter(f => f.feedback === 'positive').length;
    return positiveCount / feedbacks.length;
  }

  calculateLayoutDistribution() {
    const distribution = {};
    
    this.recommendationHistory.forEach(h => {
      const type = h.recommendation.type;
      distribution[type] = (distribution[type] || 0) + 1;
    });
    
    return distribution;
  }
}

// ============================================================================
// Supporting Classes
// ============================================================================

class MeetingContextAnalyzer {
  async initialize() {
    console.log('🔍 Meeting Context Analyzer initialized');
  }

  async classifyMeetingType(context) {
    const { participantCount, chatActivity, screenSharing, timeOfDay } = context;
    // Note: duration parameter reserved for future meeting type classification improvements
    
    // Simple rule-based classification (would be ML-based in production)
    if (screenSharing && participantCount > 3) {
      return 'presentation';
    }
    
    if (participantCount <= 2) {
      return 'one_on_one';
    }
    
    if (chatActivity > participantCount * 2) {
      return 'collaborative';
    }
    
    if (participantCount > 8) {
      return 'webinar';
    }
    
    if (timeOfDay >= 9 && timeOfDay <= 17) {
      return 'business_meeting';
    }
    
    return 'discussion';
  }
}

class LayoutOptimizer {
  constructor() {
    this.layouts = [
      {
        id: 'grid_equal',
        type: 'grid',
        name: 'Equal Grid',
        optimalFor: ['discussion', 'collaborative', 'business_meeting'],
        participantRange: { min: 3, max: 9 },
        features: { autoArrange: true },
        baseScore: 0.7,
        config: { columns: 'auto', equalSize: true },
      },
      {
        id: 'spotlight_speaker',
        type: 'spotlight',
        name: 'Speaker Spotlight',
        optimalFor: ['presentation', 'webinar', 'one_on_one'],
        participantRange: { min: 2, max: 20 },
        features: { speakerFocus: true },
        baseScore: 0.8,
        config: { mainSize: 'large', thumbnails: true },
      },
      {
        id: 'presentation_mode',
        type: 'presentation',
        name: 'Presentation Mode',
        optimalFor: ['presentation', 'webinar'],
        participantRange: { min: 3, max: 50 },
        features: { screenShareFocus: true },
        baseScore: 0.9,
        config: { presenterSize: 'xlarge', audienceGrid: true },
      },
      {
        id: 'dynamic_adaptive',
        type: 'dynamic',
        name: 'Dynamic Layout',
        optimalFor: ['discussion', 'collaborative'],
        participantRange: { min: 3, max: 12 },
        features: { adaptiveSize: true, speakerFocus: true },
        baseScore: 0.6,
        config: { adaptiveSize: true, speakerBoost: true },
      },
    ];
  }

  async initialize() {
    console.log('🎨 Layout Optimizer initialized');
  }

  async optimize(meetingContext) {
    const suitableLayouts = this.layouts.filter(layout => 
      this.isLayoutSuitable(layout, meetingContext)
    );
    
    return suitableLayouts.map(layout => ({
      ...layout,
      reasoning: this.generateReasoning(layout, meetingContext),
      timestamp: Date.now(),
    }));
  }

  isLayoutSuitable(layout, context) {
    // Check participant count
    if (context.participantCount < layout.participantRange.min ||
        context.participantCount > layout.participantRange.max) {
      return false;
    }
    
    // Check meeting type compatibility
    if (!layout.optimalFor.includes(context.type)) {
      return false;
    }
    
    return true;
  }

  generateReasoning(layout, context) {
    const reasons = [];
    
    if (layout.optimalFor.includes(context.type)) {
      reasons.push(`Optimized for ${context.type} meetings`);
    }
    
    if (context.participantCount >= layout.participantRange.min && 
        context.participantCount <= layout.participantRange.max) {
      reasons.push(`Ideal for ${context.participantCount} participants`);
    }
    
    if (context.screenSharingActive && layout.features?.screenShareFocus) {
      reasons.push('Optimized for screen sharing');
    }
    
    if (context.dominantSpeaker && layout.features?.speakerFocus) {
      reasons.push('Focuses on active speaker');
    }
    
    return reasons.join(', ') || 'General optimization';
  }
}

class UserPreferenceEngine {
  constructor() {
    this.preferences = new Map();
  }

  async initialize() {
    // Load preferences from localStorage
    this.loadPreferences();
    console.log('👤 User Preference Engine initialized');
  }

  async getPreferences(context) {
    const contextKey = this.getContextKey(context);
    return this.preferences.get(contextKey) || this.getDefaultPreferences();
  }

  updatePreferences(layoutId, feedback, context) {
    const contextKey = this.getContextKey(context);
    const current = this.preferences.get(contextKey) || this.getDefaultPreferences();
    
    // Update preferences based on feedback
    if (feedback === 'positive') {
      current.preferredLayouts = current.preferredLayouts || [];
      if (!current.preferredLayouts.includes(layoutId)) {
        current.preferredLayouts.push(layoutId);
      }
    } else if (feedback === 'negative') {
      current.dislikedLayouts = current.dislikedLayouts || [];
      if (!current.dislikedLayouts.includes(layoutId)) {
        current.dislikedLayouts.push(layoutId);
      }
    }
    
    this.preferences.set(contextKey, current);
    this.savePreferences();
  }

  getContextKey(context) {
    // Create context key based on meeting characteristics
    return `${context.type}_${Math.floor(context.participantCount / 3)}`;
  }

  getDefaultPreferences() {
    return {
      preferredLayouts: [],
      dislikedLayouts: [],
      features: {
        autoArrange: true,
        speakerFocus: true,
      },
    };
  }

  loadPreferences() {
    try {
      const stored = localStorage.getItem('ai_layout_preferences');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.preferences = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Failed to load layout preferences:', error);
    }
  }

  savePreferences() {
    try {
      const obj = Object.fromEntries(this.preferences);
      localStorage.setItem('ai_layout_preferences', JSON.stringify(obj));
    } catch (error) {
      console.error('Failed to save layout preferences:', error);
    }
  }
}

export default LayoutIntelligence;