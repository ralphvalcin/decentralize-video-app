/**
 * Participant Intelligence System
 * 
 * Provides intelligent participant management and engagement analysis:
 * - Analyzes speaking patterns and turn-taking
 * - Measures participant engagement levels
 * - Detects meeting flow issues and suggests improvements
 * - Provides insights on participation balance
 */

export class ParticipantIntelligence {
  constructor(mediaStore, roomStore, aiStore) {
    this.mediaStore = mediaStore;
    this.roomStore = roomStore;
    this.aiStore = aiStore;
    
    // Analysis components
    this.engagementAnalyzer = new EngagementAnalyzer();
    this.speakingPatternAnalyzer = new SpeakingPatternAnalyzer();
    this.participationAnalyzer = new ParticipationAnalyzer();
    this.sentimentAnalyzer = new SentimentAnalyzer();
    
    // Participant tracking
    this.participants = new Map(); // participantId -> participant data
    this.engagementHistory = [];
    this.speakingHistory = new Map(); // participantId -> speaking events
    this.interactionMatrix = new Map(); // interactions between participants
    
    // Audio analysis
    this.audioContext = null;
    this.audioAnalyzers = new Map(); // participantId -> analyzer
    
    // Configuration
    this.config = {
      analysisInterval: 5000, // 5 seconds
      engagementWindow: 60000, // 1 minute window for engagement
      speakingThreshold: 0.1, // Audio level threshold
      silenceThreshold: 3000, // 3 seconds of silence
      participationBalanceThreshold: 0.3, // 30% variance threshold
    };
    
    // State
    this.isInitialized = false;
    this.isAnalyzing = false;
    this.analysisInterval = null;
    this.currentSpeaker = null;
    this.lastSpeakerChange = Date.now();
  }

  /**
   * Initialize participant intelligence system
   */
  async initialize() {
    try {
      console.log('👥 Initializing Participant Intelligence...');
      
      // Initialize audio context for speaking detection
      await this.initializeAudioAnalysis();
      
      // Initialize analysis components
      await this.engagementAnalyzer.initialize();
      await this.speakingPatternAnalyzer.initialize();
      await this.participationAnalyzer.initialize();
      await this.sentimentAnalyzer.initialize();
      
      // Start continuous analysis
      this.startAnalysis();
      
      this.isInitialized = true;
      console.log('✅ Participant Intelligence initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Participant Intelligence:', error);
      throw error;
    }
  }

  /**
   * Initialize audio analysis for speaking detection
   */
  async initializeAudioAnalysis() {
    try {
      // Initialize Web Audio API
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      console.log('🔊 Audio analysis initialized');
    } catch (error) {
      console.error('Failed to initialize audio analysis:', error);
      // Continue without audio analysis
    }
  }

  /**
   * Start continuous participant analysis
   */
  startAnalysis() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    this.analysisInterval = setInterval(async () => {
      await this.analyzeParticipants();
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
   * Add participant to tracking
   */
  addParticipant(participantId, participantInfo) {
    const participant = {
      id: participantId,
      info: participantInfo,
      joinedAt: Date.now(),
      
      // Engagement metrics
      engagement: {
        overall: 0,
        video: 0,
        audio: 0,
        chat: 0,
        reactions: 0,
        lastActivity: Date.now(),
      },
      
      // Speaking metrics
      speaking: {
        totalTime: 0,
        sessionCount: 0,
        averageSessionLength: 0,
        longestSession: 0,
        interruptions: 0,
        wasInterrupted: 0,
        currentSessionStart: null,
      },
      
      // Participation metrics
      participation: {
        chatMessages: 0,
        reactions: 0,
        pollResponses: 0,
        questionsAsked: 0,
        handsRaised: 0,
      },
      
      // Behavioral patterns
      patterns: {
        speakingStyle: 'unknown', // chatty, reserved, balanced
        engagementStyle: 'unknown', // active, passive, reactive
        interactionPreference: 'unknown', // verbal, text, visual
      },
      
      // Real-time state
      currentState: {
        isSpeaking: false,
        videoEnabled: false,
        audioEnabled: false,
        isPresenting: false,
        attentionLevel: 'medium',
      },
    };
    
    this.participants.set(participantId, participant);
    this.speakingHistory.set(participantId, []);
    
    // Set up audio analysis for this participant
    this.setupParticipantAudioAnalysis(participantId);
    
    console.log(`👤 Added participant ${participantId} to intelligence tracking`);
  }

  /**
   * Remove participant from tracking
   */
  removeParticipant(participantId) {
    this.participants.delete(participantId);
    this.speakingHistory.delete(participantId);
    
    // Cleanup audio analyzer
    if (this.audioAnalyzers.has(participantId)) {
      this.audioAnalyzers.delete(participantId);
    }
    
    console.log(`👤 Removed participant ${participantId} from intelligence tracking`);
  }

  /**
   * Setup audio analysis for a participant
   */
  setupParticipantAudioAnalysis(participantId) {
    if (!this.audioContext) return;
    
    try {
      // This would connect to the participant's audio stream
      // For now, we'll simulate audio analysis
      const analyzer = {
        id: participantId,
        analyzeAudio: this.analyzeParticipantAudio.bind(this, participantId),
      };
      
      this.audioAnalyzers.set(participantId, analyzer);
    } catch (error) {
      console.error(`Failed to setup audio analysis for ${participantId}:`, error);
    }
  }

  /**
   * Analyze participant's audio for speaking detection
   */
  analyzeParticipantAudio(participantId) {
    // Simplified audio analysis
    // In a real implementation, this would analyze actual audio data
    const participant = this.participants.get(participantId);
    if (!participant) return;
    
    const isSpeaking = this.detectSpeaking();
    const wasSpeaking = participant.currentState.isSpeaking;
    
    if (isSpeaking !== wasSpeaking) {
      this.handleSpeakingStateChange(participantId, isSpeaking);
    }
  }

  /**
   * Detect if participant is speaking
   */
  detectSpeaking() {
    // Simplified speaking detection
    // Real implementation would use audio level analysis
    return Math.random() > 0.9; // 10% chance of speaking at any moment
  }

  /**
   * Handle speaking state change
   */
  handleSpeakingStateChange(participantId, isSpeaking) {
    const participant = this.participants.get(participantId);
    if (!participant) return;
    
    const now = Date.now();
    
    if (isSpeaking) {
      // Started speaking
      participant.currentState.isSpeaking = true;
      participant.speaking.currentSessionStart = now;
      
      // Check for interruption
      if (this.currentSpeaker && this.currentSpeaker !== participantId) {
        this.handleInterruption(participantId, this.currentSpeaker);
      }
      
      this.currentSpeaker = participantId;
      this.lastSpeakerChange = now;
      
    } else {
      // Stopped speaking
      participant.currentState.isSpeaking = false;
      
      if (participant.speaking.currentSessionStart) {
        const sessionLength = now - participant.speaking.currentSessionStart;
        this.recordSpeakingSession(participantId, sessionLength);
        participant.speaking.currentSessionStart = null;
      }
      
      if (this.currentSpeaker === participantId) {
        this.currentSpeaker = null;
      }
    }
    
    // Update speaking patterns
    this.updateSpeakingPatterns(participantId);
  }

  /**
   * Handle speaking interruption
   */
  handleInterruption(interrupterParticipantId, interruptedParticipantId) {
    const interrupter = this.participants.get(interrupterParticipantId);
    const interrupted = this.participants.get(interruptedParticipantId);
    
    if (interrupter) {
      interrupter.speaking.interruptions++;
    }
    
    if (interrupted) {
      interrupted.speaking.wasInterrupted++;
    }
    
    // Record interaction
    this.recordInteraction(interrupterParticipantId, interruptedParticipantId, 'interruption');
    
    console.log(`🚫 Interruption: ${interrupterParticipantId} interrupted ${interruptedParticipantId}`);
  }

  /**
   * Record speaking session
   */
  recordSpeakingSession(participantId, sessionLength) {
    const participant = this.participants.get(participantId);
    if (!participant) return;
    
    // Update speaking metrics
    participant.speaking.totalTime += sessionLength;
    participant.speaking.sessionCount++;
    participant.speaking.averageSessionLength = 
      participant.speaking.totalTime / participant.speaking.sessionCount;
    participant.speaking.longestSession = Math.max(
      participant.speaking.longestSession, 
      sessionLength
    );
    
    // Record in speaking history
    const history = this.speakingHistory.get(participantId);
    history.push({
      start: Date.now() - sessionLength,
      end: Date.now(),
      duration: sessionLength,
    });
    
    // Limit history size
    if (history.length > 100) {
      history.shift();
    }
    
    this.speakingHistory.set(participantId, history);
  }

  /**
   * Record interaction between participants
   */
  recordInteraction(fromParticipantId, toParticipantId, type) {
    const key = `${fromParticipantId}-${toParticipantId}`;
    const interactions = this.interactionMatrix.get(key) || [];
    
    interactions.push({
      type,
      timestamp: Date.now(),
    });
    
    this.interactionMatrix.set(key, interactions);
  }

  /**
   * Main participant analysis loop
   */
  async analyzeParticipants() {
    try {
      const roomState = this.roomStore.getState();
      
      // Update participant states
      await this.updateParticipantStates(roomState);
      
      // Analyze engagement
      const engagementAnalysis = await this.analyzeEngagement();
      
      // Analyze speaking patterns
      const speakingAnalysis = await this.analyzeSpeakingPatterns();
      
      // Analyze participation balance
      const participationAnalysis = await this.analyzeParticipation();
      
      // Analyze chat sentiment
      const sentimentAnalysis = await this.analyzeChatSentiment(roomState.chatMessages || []);
      
      // Generate comprehensive insights
      const insights = this.generateParticipantInsights({
        engagement: engagementAnalysis,
        speaking: speakingAnalysis,
        participation: participationAnalysis,
        sentiment: sentimentAnalysis,
      });
      
      // Update AI store
      this.updateAIStore(insights);
      
      // Generate recommendations if needed
      await this.generateRecommendations(insights);
      
    } catch (error) {
      console.error('Error analyzing participants:', error);
    }
  }

  /**
   * Update participant states based on room data
   */
  async updateParticipantStates(roomState) {
    const participants = roomState.participants || new Map();
    
    participants.forEach((participantInfo, participantId) => {
      let participant = this.participants.get(participantId);
      
      if (!participant) {
        this.addParticipant(participantId, participantInfo);
        participant = this.participants.get(participantId);
      }
      
      // Update current state
      participant.currentState.videoEnabled = participantInfo.videoEnabled || false;
      participant.currentState.audioEnabled = participantInfo.audioEnabled || false;
      participant.currentState.isPresenting = participantInfo.isPresenting || false;
      
      // Update engagement based on recent activity
      this.updateEngagementMetrics(participant, roomState);
    });
  }

  /**
   * Update engagement metrics for a participant
   */
  updateEngagementMetrics(participant, roomState) {
    const now = Date.now();
    const windowStart = now - this.config.engagementWindow;
    
    // Video engagement
    if (participant.currentState.videoEnabled) {
      participant.engagement.video = Math.min(1.0, participant.engagement.video + 0.1);
      participant.engagement.lastActivity = now;
    } else {
      participant.engagement.video = Math.max(0, participant.engagement.video - 0.05);
    }
    
    // Audio engagement
    if (participant.currentState.audioEnabled && participant.currentState.isSpeaking) {
      participant.engagement.audio = Math.min(1.0, participant.engagement.audio + 0.15);
      participant.engagement.lastActivity = now;
    } else {
      participant.engagement.audio = Math.max(0, participant.engagement.audio - 0.03);
    }
    
    // Chat engagement
    const recentMessages = (roomState.chatMessages || []).filter(msg => 
      msg.userId === participant.id && msg.timestamp > windowStart
    );
    
    if (recentMessages.length > 0) {
      participant.engagement.chat = Math.min(1.0, 
        participant.engagement.chat + recentMessages.length * 0.1
      );
      participant.engagement.lastActivity = now;
      participant.participation.chatMessages += recentMessages.length;
    } else {
      participant.engagement.chat = Math.max(0, participant.engagement.chat - 0.02);
    }
    
    // Overall engagement calculation
    participant.engagement.overall = (
      participant.engagement.video * 0.3 +
      participant.engagement.audio * 0.4 +
      participant.engagement.chat * 0.2 +
      participant.engagement.reactions * 0.1
    );
  }

  /**
   * Analyze overall engagement
   */
  async analyzeEngagement() {
    return await this.engagementAnalyzer.analyze({
      participants: this.participants,
      history: this.engagementHistory,
      window: this.config.engagementWindow,
    });
  }

  /**
   * Analyze speaking patterns
   */
  async analyzeSpeakingPatterns() {
    return await this.speakingPatternAnalyzer.analyze({
      participants: this.participants,
      speakingHistory: this.speakingHistory,
      currentSpeaker: this.currentSpeaker,
    });
  }

  /**
   * Analyze participation balance
   */
  async analyzeParticipation() {
    return await this.participationAnalyzer.analyze({
      participants: this.participants,
      interactionMatrix: this.interactionMatrix,
    });
  }

  /**
   * Analyze chat sentiment
   */
  async analyzeChatSentiment(messages) {
    return await this.sentimentAnalyzer.analyze(messages);
  }

  /**
   * Generate comprehensive participant insights
   */
  generateParticipantInsights(analysis) {
    return {
      timestamp: Date.now(),
      
      // Overall metrics
      totalParticipants: this.participants.size,
      activeParticipants: Array.from(this.participants.values())
        .filter(p => p.engagement.overall > 0.3).length,
      
      // Engagement insights
      engagement: {
        ...analysis.engagement,
        averageLevel: this.calculateAverageEngagement(),
        distribution: this.calculateEngagementDistribution(),
      },
      
      // Speaking insights
      speaking: {
        ...analysis.speaking,
        dominantSpeaker: this.findDominantSpeaker(),
        participationBalance: this.calculateParticipationBalance(),
      },
      
      // Participation insights
      participation: analysis.participation,
      
      // Sentiment insights
      sentiment: analysis.sentiment,
      
      // Behavioral patterns
      patterns: this.identifyBehavioralPatterns(),
      
      // Meeting health
      meetingHealth: this.assessMeetingHealth(analysis),
    };
  }

  /**
   * Update AI store with insights
   */
  updateAIStore(insights) {
    const aiState = this.aiStore.getState();
    
    // Update engagement analysis
    aiState.updateEngagementAnalysis(insights.engagement);
    
    // Update speaking patterns for each participant
    this.participants.forEach((participant, participantId) => {
      aiState.updateSpeakingPatterns(participantId, {
        totalTime: participant.speaking.totalTime,
        sessionCount: participant.speaking.sessionCount,
        interruptions: participant.speaking.interruptions,
        style: participant.patterns.speakingStyle,
      });
      
      aiState.updateParticipantInsights(participantId, {
        engagement: participant.engagement.overall,
        participation: participant.participation,
        patterns: participant.patterns,
      });
    });
  }

  /**
   * Generate recommendations based on insights
   */
  async generateRecommendations(insights) {
    const recommendations = [];
    
    // Low engagement recommendation
    if (insights.engagement.averageLevel < 0.4) {
      recommendations.push({
        id: `engagement_${Date.now()}`,
        type: 'engagement_improvement',
        priority: 'medium',
        title: 'Low Engagement Detected',
        message: 'Consider using interactive features like polls or reactions to increase engagement',
        confidence: 0.8,
        actions: [
          { label: 'Create Poll', action: 'create_poll' },
          { label: 'Acknowledge', action: 'dismiss' },
        ],
        timestamp: Date.now(),
      });
    }
    
    // Participation imbalance recommendation
    if (insights.speaking.participationBalance < 0.5) {
      const dominantSpeaker = insights.speaking.dominantSpeaker;
      recommendations.push({
        id: `balance_${Date.now()}`,
        type: 'participation_balance',
        priority: 'medium',
        title: 'Unbalanced Participation',
        message: dominantSpeaker ? 
          `${dominantSpeaker} is dominating the conversation. Consider encouraging others to speak.` :
          'Participation is unbalanced. Consider encouraging quieter participants.',
        confidence: 0.7,
        actions: [
          { label: 'Encourage Participation', action: 'encourage_participation' },
          { label: 'Acknowledge', action: 'dismiss' },
        ],
        timestamp: Date.now(),
      });
    }
    
    // Meeting flow recommendation
    if (insights.speaking.interruptions > 3) {
      recommendations.push({
        id: `flow_${Date.now()}`,
        type: 'meeting_flow',
        priority: 'low',
        title: 'Meeting Flow Issue',
        message: 'Multiple interruptions detected. Consider moderating the discussion.',
        confidence: 0.6,
        actions: [
          { label: 'Enable Hand Raising', action: 'enable_hand_raising' },
          { label: 'Acknowledge', action: 'dismiss' },
        ],
        timestamp: Date.now(),
      });
    }
    
    // Add recommendations to AI store
    recommendations.forEach(rec => {
      this.aiStore.getState().addRecommendation(rec);
    });
  }

  /**
   * Update speaking patterns
   */
  updateSpeakingPatterns(participantId) {
    const participant = this.participants.get(participantId);
    if (!participant) return;
    
    // Classify speaking style
    const sessionCount = participant.speaking.sessionCount;
    const averageSession = participant.speaking.averageSessionLength;
    // Note: totalTime extracted but not used in current classification logic
    
    if (sessionCount > 0) {
      if (averageSession > 30000) { // 30 seconds
        participant.patterns.speakingStyle = 'chatty';
      } else if (averageSession < 5000) { // 5 seconds
        participant.patterns.speakingStyle = 'reserved';
      } else {
        participant.patterns.speakingStyle = 'balanced';
      }
    }
  }

  /**
   * Helper methods for calculations
   */
  calculateAverageEngagement() {
    const participants = Array.from(this.participants.values());
    if (participants.length === 0) return 0;
    
    const totalEngagement = participants.reduce((sum, p) => sum + p.engagement.overall, 0);
    return totalEngagement / participants.length;
  }

  calculateEngagementDistribution() {
    const participants = Array.from(this.participants.values());
    const distribution = { low: 0, medium: 0, high: 0 };
    
    participants.forEach(p => {
      if (p.engagement.overall < 0.3) distribution.low++;
      else if (p.engagement.overall < 0.7) distribution.medium++;
      else distribution.high++;
    });
    
    return distribution;
  }

  findDominantSpeaker() {
    let maxSpeakingTime = 0;
    let dominantSpeaker = null;
    
    this.participants.forEach((participant, id) => {
      if (participant.speaking.totalTime > maxSpeakingTime) {
        maxSpeakingTime = participant.speaking.totalTime;
        dominantSpeaker = participant.info.name || id;
      }
    });
    
    return dominantSpeaker;
  }

  calculateParticipationBalance() {
    const participants = Array.from(this.participants.values());
    if (participants.length < 2) return 1.0;
    
    const speakingTimes = participants.map(p => p.speaking.totalTime);
    const maxTime = Math.max(...speakingTimes);
    const minTime = Math.min(...speakingTimes);
    
    if (maxTime === 0) return 1.0;
    
    return 1.0 - (maxTime - minTime) / maxTime;
  }

  identifyBehavioralPatterns() {
    const patterns = {};
    
    this.participants.forEach((participant, id) => {
      patterns[id] = {
        speakingStyle: participant.patterns.speakingStyle,
        engagementStyle: participant.patterns.engagementStyle,
        interactionPreference: participant.patterns.interactionPreference,
      };
    });
    
    return patterns;
  }

  assessMeetingHealth(analysis) {
    let healthScore = 0.5; // Base score
    
    // Engagement factor
    if (analysis.engagement.averageLevel > 0.7) healthScore += 0.2;
    else if (analysis.engagement.averageLevel < 0.3) healthScore -= 0.2;
    
    // Participation balance factor
    if (analysis.speaking.participationBalance > 0.7) healthScore += 0.15;
    else if (analysis.speaking.participationBalance < 0.3) healthScore -= 0.15;
    
    // Interruption factor
    if (analysis.speaking.interruptions < 2) healthScore += 0.1;
    else if (analysis.speaking.interruptions > 5) healthScore -= 0.1;
    
    // Sentiment factor
    if (analysis.sentiment.overall === 'positive') healthScore += 0.15;
    else if (analysis.sentiment.overall === 'negative') healthScore -= 0.15;
    
    return {
      score: Math.max(0, Math.min(1, healthScore)),
      level: healthScore > 0.7 ? 'good' : healthScore > 0.4 ? 'fair' : 'poor',
    };
  }

  /**
   * Public API methods
   */
  getParticipantInsights(participantId) {
    return this.participants.get(participantId);
  }

  getCurrentEngagement() {
    return {
      average: this.calculateAverageEngagement(),
      distribution: this.calculateEngagementDistribution(),
      activeCount: Array.from(this.participants.values())
        .filter(p => p.engagement.overall > 0.3).length,
    };
  }

  getSpeakingStatistics() {
    return {
      currentSpeaker: this.currentSpeaker,
      dominantSpeaker: this.findDominantSpeaker(),
      participationBalance: this.calculateParticipationBalance(),
      totalInterruptions: Array.from(this.participants.values())
        .reduce((sum, p) => sum + p.speaking.interruptions, 0),
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopAnalysis();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.participants.clear();
    this.speakingHistory.clear();
    this.interactionMatrix.clear();
    this.audioAnalyzers.clear();
    
    this.isInitialized = false;
  }

  /**
   * Get intelligence metrics
   */
  getMetrics() {
    return {
      participantsTracked: this.participants.size,
      totalSpeakingTime: Array.from(this.participants.values())
        .reduce((sum, p) => sum + p.speaking.totalTime, 0),
      averageEngagement: this.calculateAverageEngagement(),
      participationBalance: this.calculateParticipationBalance(),
      isAnalyzing: this.isAnalyzing,
    };
  }
}

// ============================================================================
// Supporting Analyzer Classes
// ============================================================================

class EngagementAnalyzer {
  async initialize() {
    console.log('📊 Engagement Analyzer initialized');
  }

  async analyze(context) {
    const { participants } = context;
    // Note: history and window parameters reserved for future engagement trend analysis
    
    const participantArray = Array.from(participants.values());
    
    return {
      overallLevel: this.calculateOverallEngagement(participantArray),
      videoEngagement: this.calculateVideoEngagement(participantArray),
      audioEngagement: this.calculateAudioEngagement(participantArray),
      chatEngagement: this.calculateChatEngagement(participantArray),
      trends: this.analyzeTrends(),
    };
  }

  calculateOverallEngagement(participants) {
    if (participants.length === 0) return 0;
    
    const totalEngagement = participants.reduce((sum, p) => sum + p.engagement.overall, 0);
    const average = totalEngagement / participants.length;
    
    if (average > 0.7) return 'high';
    if (average > 0.4) return 'medium';
    return 'low';
  }

  calculateVideoEngagement(participants) {
    const videoEnabled = participants.filter(p => p.currentState.videoEnabled).length;
    return videoEnabled / Math.max(1, participants.length);
  }

  calculateAudioEngagement(participants) {
    const audioActive = participants.filter(p => p.currentState.audioEnabled).length;
    return audioActive / Math.max(1, participants.length);
  }

  calculateChatEngagement(participants) {
    const chatActive = participants.filter(p => p.participation.chatMessages > 0).length;
    return chatActive / Math.max(1, participants.length);
  }

  analyzeTrends() {
    // Simplified trend analysis
    return { overall: 'stable' };
  }
}

class SpeakingPatternAnalyzer {
  async initialize() {
    console.log('🗣️ Speaking Pattern Analyzer initialized');
  }

  async analyze(context) {
    const { participants, currentSpeaker } = context;
    // Note: speakingHistory reserved for future turn-taking analysis enhancements
    
    const participantArray = Array.from(participants.values());
    const totalInterruptions = participantArray.reduce((sum, p) => sum + p.speaking.interruptions, 0);
    
    return {
      currentSpeaker,
      dominantSpeaker: this.findDominantSpeaker(participantArray),
      participationBalance: this.calculateBalance(participantArray),
      interruptions: totalInterruptions,
      speakingDistribution: this.calculateSpeakingDistribution(participantArray),
      turnTaking: this.analyzeTurnTaking(),
    };
  }

  findDominantSpeaker(participants) {
    let maxTime = 0;
    let dominant = null;
    
    participants.forEach(p => {
      if (p.speaking.totalTime > maxTime) {
        maxTime = p.speaking.totalTime;
        dominant = p.info.name || p.id;
      }
    });
    
    return dominant;
  }

  calculateBalance(participants) {
    if (participants.length < 2) return 1.0;
    
    const times = participants.map(p => p.speaking.totalTime);
    const max = Math.max(...times);
    const min = Math.min(...times);
    
    if (max === 0) return 1.0;
    return 1.0 - (max - min) / max;
  }

  calculateSpeakingDistribution(participants) {
    const distribution = {};
    participants.forEach(p => {
      distribution[p.id] = p.speaking.totalTime;
    });
    return distribution;
  }

  analyzeTurnTaking() {
    // Simplified turn-taking analysis
    return { style: 'balanced' };
  }
}

class ParticipationAnalyzer {
  async initialize() {
    console.log('🤝 Participation Analyzer initialized');
  }

  async analyze(context) {
    const { participants, interactionMatrix } = context;
    
    const participantArray = Array.from(participants.values());
    
    return {
      chatParticipation: this.analyzeChatParticipation(participantArray),
      reactionActivity: this.analyzeReactionActivity(participantArray),
      questionActivity: this.analyzeQuestionActivity(participantArray),
      interactions: this.analyzeInteractions(interactionMatrix),
    };
  }

  analyzeChatParticipation(participants) {
    const totalMessages = participants.reduce((sum, p) => sum + p.participation.chatMessages, 0);
    const activeParticipants = participants.filter(p => p.participation.chatMessages > 0).length;
    
    return {
      totalMessages,
      activeParticipants,
      averageMessages: totalMessages / Math.max(1, participants.length),
    };
  }

  analyzeReactionActivity(participants) {
    const totalReactions = participants.reduce((sum, p) => sum + p.participation.reactions, 0);
    return { totalReactions };
  }

  analyzeQuestionActivity(participants) {
    const totalQuestions = participants.reduce((sum, p) => sum + p.participation.questionsAsked, 0);
    return { totalQuestions };
  }

  analyzeInteractions(interactionMatrix) {
    return {
      totalInteractions: Array.from(interactionMatrix.values()).reduce((sum, interactions) => sum + interactions.length, 0),
      interactionTypes: this.categorizeInteractions(interactionMatrix),
    };
  }

  categorizeInteractions(interactionMatrix) {
    const types = {};
    
    interactionMatrix.forEach(interactions => {
      interactions.forEach(interaction => {
        types[interaction.type] = (types[interaction.type] || 0) + 1;
      });
    });
    
    return types;
  }
}

class SentimentAnalyzer {
  async initialize() {
    console.log('😊 Sentiment Analyzer initialized');
  }

  async analyze(messages) {
    if (!messages || messages.length === 0) {
      return { overall: 'neutral', confidence: 0.5 };
    }
    
    // Simplified sentiment analysis
    // In production, this would use actual NLP
    const recentMessages = messages.filter(m => 
      Date.now() - m.timestamp < 300000 // Last 5 minutes
    );
    
    if (recentMessages.length === 0) {
      return { overall: 'neutral', confidence: 0.5 };
    }
    
    // Simple keyword-based analysis
    let positiveCount = 0;
    let negativeCount = 0;
    
    const positiveKeywords = ['good', 'great', 'awesome', 'thanks', 'excellent', 'love', 'perfect'];
    const negativeKeywords = ['bad', 'terrible', 'hate', 'awful', 'wrong', 'problem', 'issue'];
    
    recentMessages.forEach(message => {
      const text = message.text.toLowerCase();
      
      positiveKeywords.forEach(keyword => {
        if (text.includes(keyword)) positiveCount++;
      });
      
      negativeKeywords.forEach(keyword => {
        if (text.includes(keyword)) negativeCount++;
      });
    });
    
    let overall = 'neutral';
    if (positiveCount > negativeCount) overall = 'positive';
    else if (negativeCount > positiveCount) overall = 'negative';
    
    const confidence = Math.min(1.0, (Math.abs(positiveCount - negativeCount) + 1) / recentMessages.length);
    
    return {
      overall,
      confidence,
      positiveCount,
      negativeCount,
      messageCount: recentMessages.length,
    };
  }
}

export default ParticipantIntelligence;