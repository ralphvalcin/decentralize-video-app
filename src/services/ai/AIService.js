/**
 * AI Service - Central AI Intelligence Orchestrator
 * 
 * Coordinates all AI-powered features and provides unified access:
 * - Manages AI system lifecycle and initialization
 * - Orchestrates communication between AI components
 * - Provides centralized AI configuration and settings
 * - Handles AI system monitoring and health checks
 */

import { ConnectionIntelligence } from './ConnectionIntelligence.js';
import { LayoutIntelligence } from './LayoutIntelligence.js';
import { ParticipantIntelligence } from './ParticipantIntelligence.js';
import { PerformanceIntelligence } from './PerformanceIntelligence.js';

export class AIService {
  constructor(stores) {
    const { connectionStore, mediaStore, roomStore, uiStore, aiStore } = stores;
    
    this.stores = {
      connectionStore,
      mediaStore,
      roomStore,
      uiStore,
      aiStore,
    };
    
    // AI Intelligence Components
    this.connectionIntelligence = new ConnectionIntelligence(
      connectionStore,
      aiStore
    );
    
    this.layoutIntelligence = new LayoutIntelligence(
      roomStore,
      uiStore,
      aiStore
    );
    
    this.participantIntelligence = new ParticipantIntelligence(
      mediaStore,
      roomStore,
      aiStore
    );
    
    this.performanceIntelligence = new PerformanceIntelligence(
      aiStore,
      connectionStore,
      mediaStore
    );
    
    // Service state
    this.isInitialized = false;
    this.isActive = false;
    this.initializationProgress = 0;
    
    // Configuration
    this.config = {
      enableConnectionIntelligence: true,
      enableLayoutIntelligence: true,
      enableParticipantIntelligence: true,
      enablePerformanceIntelligence: true,
      autoStartOnRoomJoin: true,
      intelligenceUpdateInterval: 5000, // 5 seconds
    };
    
    // Health monitoring
    this.healthMetrics = {
      connectionIntelligence: { healthy: false, lastCheck: 0 },
      layoutIntelligence: { healthy: false, lastCheck: 0 },
      participantIntelligence: { healthy: false, lastCheck: 0 },
      performanceIntelligence: { healthy: false, lastCheck: 0 },
    };
    
    // Intelligence coordination
    this.coordinationInterval = null;
    this.lastCoordinationRun = 0;
    
    // Event listeners
    this.eventListeners = new Set();
  }

  /**
   * Initialize AI Service and all intelligence components
   */
  async initialize(config = {}) {
    try {
      console.log('🤖 Initializing AI Service...');
      
      // Update configuration
      this.config = { ...this.config, ...config };
      
      // Initialize AI store first
      await this.stores.aiStore.getState().initialize();
      this.initializationProgress = 10;
      
      // Initialize intelligence components based on configuration
      const initPromises = [];
      
      if (this.config.enableConnectionIntelligence) {
        initPromises.push(this.initializeConnectionIntelligence());
      }
      
      if (this.config.enableLayoutIntelligence) {
        initPromises.push(this.initializeLayoutIntelligence());
      }
      
      if (this.config.enableParticipantIntelligence) {
        initPromises.push(this.initializeParticipantIntelligence());
      }
      
      if (this.config.enablePerformanceIntelligence) {
        initPromises.push(this.initializePerformanceIntelligence());
      }
      
      // Initialize all components in parallel
      await Promise.all(initPromises);
      this.initializationProgress = 80;
      
      // Set up coordination
      this.setupIntelligenceCoordination();
      this.initializationProgress = 90;
      
      // Set up event listeners
      this.setupEventListeners();
      this.initializationProgress = 100;
      
      this.isInitialized = true;
      console.log('✅ AI Service initialized successfully');
      
      // Update AI store with initialization complete
      this.stores.aiStore.getState().updateSettings({
        ...this.config,
      });
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize AI Service:', error);
      this.initializationProgress = 0;
      throw error;
    }
  }

  /**
   * Initialize individual intelligence components
   */
  async initializeConnectionIntelligence() {
    try {
      await this.connectionIntelligence.initialize();
      this.healthMetrics.connectionIntelligence.healthy = true;
      this.healthMetrics.connectionIntelligence.lastCheck = Date.now();
      console.log('✅ Connection Intelligence initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Connection Intelligence:', error);
      this.healthMetrics.connectionIntelligence.healthy = false;
      throw error;
    }
  }

  async initializeLayoutIntelligence() {
    try {
      await this.layoutIntelligence.initialize();
      this.healthMetrics.layoutIntelligence.healthy = true;
      this.healthMetrics.layoutIntelligence.lastCheck = Date.now();
      console.log('✅ Layout Intelligence initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Layout Intelligence:', error);
      this.healthMetrics.layoutIntelligence.healthy = false;
      throw error;
    }
  }

  async initializeParticipantIntelligence() {
    try {
      await this.participantIntelligence.initialize();
      this.healthMetrics.participantIntelligence.healthy = true;
      this.healthMetrics.participantIntelligence.lastCheck = Date.now();
      console.log('✅ Participant Intelligence initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Participant Intelligence:', error);
      this.healthMetrics.participantIntelligence.healthy = false;
      throw error;
    }
  }

  async initializePerformanceIntelligence() {
    try {
      await this.performanceIntelligence.initialize();
      this.healthMetrics.performanceIntelligence.healthy = true;
      this.healthMetrics.performanceIntelligence.lastCheck = Date.now();
      console.log('✅ Performance Intelligence initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Performance Intelligence:', error);
      this.healthMetrics.performanceIntelligence.healthy = false;
      throw error;
    }
  }

  /**
   * Start AI intelligence for a room session
   */
  async startIntelligence(roomId, userInfo) {
    if (!this.isInitialized) {
      console.warn('AI Service not initialized. Starting intelligence failed.');
      return false;
    }
    
    try {
      console.log(`🧠 Starting AI Intelligence for room ${roomId}`);
      
      // Start connection intelligence monitoring
      if (this.config.enableConnectionIntelligence) {
        // Connection intelligence will start monitoring when peers are added
        console.log('🔗 Connection Intelligence ready');
      }
      
      // Start layout intelligence
      if (this.config.enableLayoutIntelligence) {
        this.layoutIntelligence.startAnalysis();
        console.log('🎨 Layout Intelligence started');
      }
      
      // Start participant intelligence
      if (this.config.enableParticipantIntelligence) {
        // Add self as participant
        this.participantIntelligence.addParticipant('self', userInfo);
        console.log('👥 Participant Intelligence started');
      }
      
      // Start performance intelligence monitoring
      if (this.config.enablePerformanceIntelligence) {
        // Performance intelligence starts automatically
        console.log('⚡ Performance Intelligence started');
      }
      
      this.isActive = true;
      return true;
      
    } catch (error) {
      console.error('Failed to start AI intelligence:', error);
      return false;
    }
  }

  /**
   * Stop AI intelligence
   */
  async stopIntelligence() {
    try {
      console.log('⏹️ Stopping AI Intelligence...');
      
      // Stop layout intelligence
      if (this.layoutIntelligence) {
        this.layoutIntelligence.stopAnalysis();
      }
      
      // Stop participant intelligence
      if (this.participantIntelligence) {
        this.participantIntelligence.stopAnalysis();
      }
      
      // Stop performance intelligence
      if (this.performanceIntelligence) {
        this.performanceIntelligence.stopMonitoring();
      }
      
      // Stop coordination
      this.stopIntelligenceCoordination();
      
      this.isActive = false;
      console.log('✅ AI Intelligence stopped');
      
    } catch (error) {
      console.error('Error stopping AI intelligence:', error);
    }
  }

  /**
   * Add participant to intelligence tracking
   */
  addParticipant(participantId, participantInfo, peerConnection = null) {
    if (!this.isActive) return;
    
    try {
      // Add to participant intelligence
      if (this.config.enableParticipantIntelligence) {
        this.participantIntelligence.addParticipant(participantId, participantInfo);
      }
      
      // Start connection intelligence for this peer
      if (this.config.enableConnectionIntelligence && peerConnection) {
        this.connectionIntelligence.startMonitoring(participantId);
      }
      
      console.log(`🎯 AI Intelligence tracking added for participant ${participantId}`);
      
    } catch (error) {
      console.error(`Failed to add participant ${participantId} to AI tracking:`, error);
    }
  }

  /**
   * Remove participant from intelligence tracking
   */
  removeParticipant(participantId) {
    if (!this.isActive) return;
    
    try {
      // Remove from participant intelligence
      if (this.config.enableParticipantIntelligence) {
        this.participantIntelligence.removeParticipant(participantId);
      }
      
      // Stop connection intelligence for this peer
      if (this.config.enableConnectionIntelligence) {
        this.connectionIntelligence.stopMonitoring(participantId);
      }
      
      console.log(`🎯 AI Intelligence tracking removed for participant ${participantId}`);
      
    } catch (error) {
      console.error(`Failed to remove participant ${participantId} from AI tracking:`, error);
    }
  }

  /**
   * Setup intelligence coordination between components
   */
  setupIntelligenceCoordination() {
    this.coordinationInterval = setInterval(() => {
      this.coordinateIntelligence();
    }, this.config.intelligenceUpdateInterval);
  }

  /**
   * Stop intelligence coordination
   */
  stopIntelligenceCoordination() {
    if (this.coordinationInterval) {
      clearInterval(this.coordinationInterval);
      this.coordinationInterval = null;
    }
  }

  /**
   * Coordinate information sharing between intelligence components
   */
  coordinateIntelligence() {
    try {
      const now = Date.now();
      
      // Skip if not enough time has passed
      if (now - this.lastCoordinationRun < this.config.intelligenceUpdateInterval) {
        return;
      }
      
      // Get insights from all components
      const insights = this.gatherIntelligenceInsights();
      
      // Share relevant information between components
      this.shareInsightsBetweenComponents(insights);
      
      // Generate cross-component recommendations
      this.generateCrossComponentRecommendations(insights);
      
      this.lastCoordinationRun = now;
      
    } catch (error) {
      console.error('Error in intelligence coordination:', error);
    }
  }

  /**
   * Gather insights from all intelligence components
   */
  gatherIntelligenceInsights() {
    const insights = {
      timestamp: Date.now(),
      connection: null,
      layout: null,
      participants: null,
      performance: null,
    };
    
    try {
      // Connection insights
      if (this.config.enableConnectionIntelligence) {
        insights.connection = this.connectionIntelligence.getMetrics();
      }
      
      // Layout insights
      if (this.config.enableLayoutIntelligence) {
        insights.layout = this.layoutIntelligence.getMetrics();
      }
      
      // Participant insights
      if (this.config.enableParticipantIntelligence) {
        insights.participants = this.participantIntelligence.getMetrics();
      }
      
      // Performance insights
      if (this.config.enablePerformanceIntelligence) {
        insights.performance = this.performanceIntelligence.getMetrics();
      }
      
    } catch (error) {
      console.error('Error gathering intelligence insights:', error);
    }
    
    return insights;
  }

  /**
   * Share insights between components for improved decision making
   */
  shareInsightsBetweenComponents(insights) {
    // Example: Share performance insights with layout intelligence
    if (insights.performance && insights.layout) {
      // If performance is poor, layout intelligence should prefer simpler layouts
      if (insights.performance.currentOptimizationsActive > 0) {
        // Inform layout intelligence about performance constraints
        this.layoutIntelligence.updatePerformanceConstraints({
          hasPerformanceIssues: true,
          preferSimpleLayouts: true,
          timestamp: Date.now(),
        });
      }
    }
    
    // Share participant engagement with layout intelligence
    if (insights.participants && insights.layout) {
      const engagementLevel = insights.participants.averageEngagement;
      if (engagementLevel < 0.4) {
        // Low engagement - suggest more interactive layouts
        this.layoutIntelligence.updateEngagementContext({
          level: 'low',
          suggestion: 'interactive_layout',
        });
      }
    }
    
    // Share connection quality with performance intelligence
    if (insights.connection && insights.performance) {
      const avgConfidence = insights.connection.averageConfidence;
      if (avgConfidence < 0.6) {
        // Poor connection predictions - be more conservative with performance
        this.performanceIntelligence.updateConnectionContext({
          reliability: 'low',
          beConservative: true,
        });
      }
    }
  }

  /**
   * Generate recommendations that consider multiple intelligence components
   */
  generateCrossComponentRecommendations(insights) {
    const recommendations = [];
    
    // Poor performance + high participant count = suggest layout change
    if (insights.performance?.currentOptimizationsActive > 2 && 
        insights.participants?.participantsTracked > 6) {
      
      recommendations.push({
        id: `cross_perf_layout_${Date.now()}`,
        type: 'cross_component_optimization',
        priority: 'medium',
        title: 'Performance & Layout Optimization',
        message: 'High resource usage with many participants. Consider switching to spotlight layout.',
        confidence: 0.8,
        actions: [
          { label: 'Switch to Spotlight', action: 'force_layout_spotlight' },
          { label: 'Reduce Quality', action: 'reduce_quality' },
          { label: 'Dismiss', action: 'dismiss' },
        ],
        timestamp: Date.now(),
        metadata: {
          involvedComponents: ['performance', 'layout', 'participants'],
        },
      });
    }
    
    // Poor connection quality + low engagement = suggest interaction features
    if (insights.connection?.averageConfidence < 0.5 && 
        insights.participants?.averageEngagement < 0.4) {
      
      recommendations.push({
        id: `cross_engagement_${Date.now()}`,
        type: 'engagement_recovery',
        priority: 'medium',
        title: 'Connection & Engagement Issues',
        message: 'Poor connection and low engagement detected. Try interactive features.',
        confidence: 0.7,
        actions: [
          { label: 'Start Poll', action: 'create_poll' },
          { label: 'Enable Reactions', action: 'enable_reactions' },
          { label: 'Dismiss', action: 'dismiss' },
        ],
        timestamp: Date.now(),
        metadata: {
          involvedComponents: ['connection', 'participants'],
        },
      });
    }
    
    // Add recommendations to AI store
    recommendations.forEach(rec => {
      this.stores.aiStore.getState().addRecommendation(rec);
    });
  }

  /**
   * Setup event listeners for store changes
   */
  setupEventListeners() {
    // Listen for room participant changes
    const unsubscribeRoom = this.stores.roomStore.subscribe(
      (state) => state.participants,
      (participants, prevParticipants) => {
        this.handleParticipantChanges(participants, prevParticipants);
      }
    );
    this.eventListeners.add(unsubscribeRoom);
    
    // Listen for connection changes
    const unsubscribeConnection = this.stores.connectionStore.subscribe(
      (state) => state.peers,
      (peers, prevPeers) => {
        this.handleConnectionChanges(peers, prevPeers);
      }
    );
    this.eventListeners.add(unsubscribeConnection);
    
    // Listen for AI setting changes
    const unsubscribeAI = this.stores.aiStore.subscribe(
      (state) => state.settings,
      (settings) => {
        this.handleAISettingsChange(settings);
      }
    );
    this.eventListeners.add(unsubscribeAI);
  }

  /**
   * Handle participant changes
   */
  handleParticipantChanges(participants, prevParticipants) {
    if (!participants || !prevParticipants) return;
    
    // Find added participants
    participants.forEach((info, id) => {
      if (!prevParticipants.has(id)) {
        this.addParticipant(id, info);
      }
    });
    
    // Find removed participants
    prevParticipants.forEach((info, id) => {
      if (!participants.has(id)) {
        this.removeParticipant(id);
      }
    });
  }

  /**
   * Handle connection changes
   */
  handleConnectionChanges(peers, prevPeers) {
    if (!peers || !prevPeers) return;
    
    // Handle new peer connections
    peers.forEach((peerConnection, peerId) => {
      if (!prevPeers.has(peerId)) {
        // New peer connection
        if (this.config.enableConnectionIntelligence) {
          this.connectionIntelligence.startMonitoring(peerId);
        }
      }
    });
    
    // Handle removed peer connections
    prevPeers.forEach((peerConnection, peerId) => {
      if (!peers.has(peerId)) {
        // Peer connection removed
        if (this.config.enableConnectionIntelligence) {
          this.connectionIntelligence.stopMonitoring(peerId);
        }
      }
    });
  }

  /**
   * Handle AI settings changes
   */
  handleAISettingsChange(settings) {
    // Update configuration
    Object.keys(settings).forEach(key => {
      if (key in this.config) {
        this.config[key] = settings[key];
      }
    });
    
    // Apply setting changes
    this.applyConfigurationChanges(settings);
  }

  /**
   * Apply configuration changes to running components
   */
  applyConfigurationChanges(settings) {
    // Enable/disable components based on settings
    if ('enableConnectionIntelligence' in settings) {
      if (settings.enableConnectionIntelligence && !this.config.enableConnectionIntelligence) {
        // Enable connection intelligence
        this.initializeConnectionIntelligence().catch(console.error);
      } else if (!settings.enableConnectionIntelligence && this.config.enableConnectionIntelligence) {
        // Disable connection intelligence
        this.connectionIntelligence.cleanup();
      }
    }
    
    // Similar logic for other components...
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform health check on all components
   */
  performHealthCheck() {
    const now = Date.now();
    
    Object.keys(this.healthMetrics).forEach(componentName => {
      try {
        const component = this[componentName];
        const isHealthy = component && component.isInitialized !== false;
        
        this.healthMetrics[componentName] = {
          healthy: isHealthy,
          lastCheck: now,
        };
        
      } catch (error) {
        this.healthMetrics[componentName] = {
          healthy: false,
          lastCheck: now,
          error: error.message,
        };
      }
    });
  }

  /**
   * Public API methods
   */
  
  /**
   * Get overall AI system status
   */
  getSystemStatus() {
    return {
      isInitialized: this.isInitialized,
      isActive: this.isActive,
      initializationProgress: this.initializationProgress,
      healthMetrics: this.healthMetrics,
      config: this.config,
      componentsEnabled: {
        connectionIntelligence: this.config.enableConnectionIntelligence,
        layoutIntelligence: this.config.enableLayoutIntelligence,
        participantIntelligence: this.config.enableParticipantIntelligence,
        performanceIntelligence: this.config.enablePerformanceIntelligence,
      },
    };
  }

  /**
   * Get comprehensive AI insights
   */
  getAIInsights() {
    return this.gatherIntelligenceInsights();
  }

  /**
   * Request immediate analysis from all components
   */
  async requestAnalysis() {
    const results = {};
    
    if (this.config.enableConnectionIntelligence) {
      // Connection intelligence runs continuously
      results.connection = 'running';
    }
    
    if (this.config.enableLayoutIntelligence) {
      results.layout = await this.layoutIntelligence.analyzeMeetingContext();
    }
    
    if (this.config.enableParticipantIntelligence) {
      results.participants = await this.participantIntelligence.analyzeParticipants();
    }
    
    if (this.config.enablePerformanceIntelligence) {
      results.performance = await this.performanceIntelligence.requestPerformanceAnalysis();
    }
    
    return results;
  }

  /**
   * Update AI configuration
   */
  updateConfiguration(newConfig) {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Apply changes
    this.applyConfigurationChanges(newConfig);
    
    // Update AI store
    this.stores.aiStore.getState().updateSettings(this.config);
    
    console.log('🔄 AI Service configuration updated', { oldConfig, newConfig });
  }

  /**
   * Cleanup and shutdown AI service
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up AI Service...');
      
      // Stop all intelligence
      await this.stopIntelligence();
      
      // Cleanup individual components
      if (this.connectionIntelligence) {
        this.connectionIntelligence.cleanup();
      }
      
      if (this.layoutIntelligence) {
        this.layoutIntelligence.cleanup();
      }
      
      if (this.participantIntelligence) {
        this.participantIntelligence.cleanup();
      }
      
      if (this.performanceIntelligence) {
        this.performanceIntelligence.cleanup();
      }
      
      // Remove event listeners
      this.eventListeners.forEach(unsubscribe => unsubscribe());
      this.eventListeners.clear();
      
      // Cleanup AI store
      this.stores.aiStore.getState().cleanup();
      
      this.isInitialized = false;
      this.isActive = false;
      
      console.log('✅ AI Service cleanup completed');
      
    } catch (error) {
      console.error('Error during AI Service cleanup:', error);
    }
  }

  /**
   * Get service metrics for monitoring
   */
  getServiceMetrics() {
    return {
      systemStatus: this.getSystemStatus(),
      insights: this.gatherIntelligenceInsights(),
      uptime: this.isInitialized ? Date.now() - this.initializationTime : 0,
      lastCoordinationRun: this.lastCoordinationRun,
      coordinationInterval: this.config.intelligenceUpdateInterval,
    };
  }
}

export default AIService;