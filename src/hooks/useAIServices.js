/**
 * AI Services Hook
 * 
 * Provides integration with AI intelligence services for React components:
 * - Manages AI service lifecycle
 * - Provides access to AI insights and recommendations
 * - Handles AI service initialization and cleanup
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AIService } from '../services/ai/AIService.js';
import {
  useConnectionStore,
  useMediaStore, 
  useRoomStore,
  useUIStore,
  useAIStore,
} from '../stores/index.ts';

export const useAIServices = (roomId, userInfo, options = {}) => {
  const {
    autoStart = true,
    enableConnectionIntelligence = true,
    enableLayoutIntelligence = true,
    enableParticipantIntelligence = true,
    enablePerformanceIntelligence = true,
  } = options;

  // Store references
  const connectionStore = useConnectionStore();
  const mediaStore = useMediaStore();
  const roomStore = useRoomStore();
  const uiStore = useUIStore();
  const aiStore = useAIStore();

  // AI service instance
  const aiServiceRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [initializationError, setInitializationError] = useState(null);

  // AI insights and status
  const [systemStatus, setSystemStatus] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  /**
   * Initialize AI service
   */
  const initializeAI = useCallback(async () => {
    if (aiServiceRef.current || !roomId || !userInfo) return;

    try {
      console.log('🤖 Initializing AI Services...');
      
      // Create AI service instance
      const aiService = new AIService({
        connectionStore,
        mediaStore,
        roomStore,
        uiStore,
        aiStore,
      });

      // Initialize with configuration
      await aiService.initialize({
        enableConnectionIntelligence,
        enableLayoutIntelligence,
        enableParticipantIntelligence,
        enablePerformanceIntelligence,
        autoStartOnRoomJoin: autoStart,
      });

      aiServiceRef.current = aiService;
      setIsInitialized(true);
      setInitializationError(null);
      
      console.log('✅ AI Services initialized successfully');

      // Start intelligence if auto-start is enabled
      if (autoStart) {
        await startIntelligence();
      }

    } catch (error) {
      console.error('❌ Failed to initialize AI Services:', error);
      setInitializationError(error);
      setIsInitialized(false);
    }
  }, [
    roomId, 
    userInfo, 
    connectionStore, 
    mediaStore, 
    roomStore, 
    uiStore, 
    aiStore,
    enableConnectionIntelligence,
    enableLayoutIntelligence,
    enableParticipantIntelligence,
    enablePerformanceIntelligence,
    autoStart
  ]);

  /**
   * Start AI intelligence
   */
  const startIntelligence = useCallback(async () => {
    if (!aiServiceRef.current || !isInitialized) {
      console.warn('AI Service not initialized. Cannot start intelligence.');
      return false;
    }

    try {
      const success = await aiServiceRef.current.startIntelligence(roomId, userInfo);
      setIsActive(success);
      return success;
    } catch (error) {
      console.error('Failed to start AI intelligence:', error);
      return false;
    }
  }, [roomId, userInfo, isInitialized]);

  /**
   * Stop AI intelligence
   */
  const stopIntelligence = useCallback(async () => {
    if (!aiServiceRef.current) return;

    try {
      await aiServiceRef.current.stopIntelligence();
      setIsActive(false);
    } catch (error) {
      console.error('Failed to stop AI intelligence:', error);
    }
  }, []);

  /**
   * Add participant to AI tracking
   */
  const addParticipant = useCallback((participantId, participantInfo, peerConnection = null) => {
    if (!aiServiceRef.current || !isActive) return;
    
    aiServiceRef.current.addParticipant(participantId, participantInfo, peerConnection);
  }, [isActive]);

  /**
   * Remove participant from AI tracking
   */
  const removeParticipant = useCallback((participantId) => {
    if (!aiServiceRef.current || !isActive) return;
    
    aiServiceRef.current.removeParticipant(participantId);
  }, [isActive]);

  /**
   * Get AI system status
   */
  const getSystemStatus = useCallback(() => {
    if (!aiServiceRef.current) return null;
    return aiServiceRef.current.getSystemStatus();
  }, []);

  /**
   * Get AI insights
   */
  const getAIInsights = useCallback(() => {
    if (!aiServiceRef.current) return null;
    return aiServiceRef.current.getAIInsights();
  }, []);

  /**
   * Request immediate AI analysis
   */
  const requestAnalysis = useCallback(async () => {
    if (!aiServiceRef.current) return null;
    return await aiServiceRef.current.requestAnalysis();
  }, []);

  /**
   * Update AI configuration
   */
  const updateConfiguration = useCallback((newConfig) => {
    if (!aiServiceRef.current) return;
    aiServiceRef.current.updateConfiguration(newConfig);
  }, []);

  /**
   * Refresh AI data
   */
  const refreshAIData = useCallback(async () => {
    if (!aiServiceRef.current) return;

    try {
      const status = getSystemStatus();
      const insights = getAIInsights();
      
      setSystemStatus(status);
      setAiInsights(insights);
      setLastUpdate(Date.now());
      
      return { status, insights };
    } catch (error) {
      console.error('Failed to refresh AI data:', error);
      return null;
    }
  }, [getSystemStatus, getAIInsights]);

  // Initialize AI service when dependencies are ready
  useEffect(() => {
    if (roomId && userInfo && !aiServiceRef.current) {
      initializeAI();
    }
  }, [roomId, userInfo, initializeAI]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (aiServiceRef.current) {
        aiServiceRef.current.cleanup().catch(console.error);
        aiServiceRef.current = null;
        setIsInitialized(false);
        setIsActive(false);
      }
    };
  }, []);

  // Auto-refresh AI data periodically
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      refreshAIData();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [isActive, refreshAIData]);

  // Listen to store changes and update participants
  useEffect(() => {
    if (!isActive) return;

    const unsubscribe = roomStore.subscribe(
      (state) => state.participants,
      (participants, previousParticipants) => {
        if (!participants || !previousParticipants) return;

        // Handle new participants
        participants.forEach((info, id) => {
          if (!previousParticipants.has(id)) {
            addParticipant(id, info);
          }
        });

        // Handle removed participants
        previousParticipants.forEach((info, id) => {
          if (!participants.has(id)) {
            removeParticipant(id);
          }
        });
      }
    );

    return unsubscribe;
  }, [isActive, addParticipant, removeParticipant, roomStore]);

  // Return AI service interface
  return {
    // Service state
    aiService: aiServiceRef.current,
    isInitialized,
    isActive,
    initializationError,
    
    // AI data
    systemStatus,
    aiInsights,
    lastUpdate,
    
    // Service controls
    startIntelligence,
    stopIntelligence,
    addParticipant,
    removeParticipant,
    
    // Data access
    getSystemStatus,
    getAIInsights,
    requestAnalysis,
    refreshAIData,
    
    // Configuration
    updateConfiguration,
    
    // Convenience methods
    reinitialize: initializeAI,
    cleanup: async () => {
      await stopIntelligence();
      if (aiServiceRef.current) {
        await aiServiceRef.current.cleanup();
        aiServiceRef.current = null;
        setIsInitialized(false);
        setIsActive(false);
      }
    },
  };
};

/**
 * Simplified AI hook for basic AI features
 */
export const useAI = (roomId, userInfo) => {
  const aiServices = useAIServices(roomId, userInfo, {
    autoStart: true,
    enableConnectionIntelligence: true,
    enableLayoutIntelligence: true,
    enableParticipantIntelligence: true,
    enablePerformanceIntelligence: true,
  });

  return {
    isReady: aiServices.isInitialized && aiServices.isActive,
    error: aiServices.initializationError,
    insights: aiServices.aiInsights,
    status: aiServices.systemStatus,
    refresh: aiServices.refreshAIData,
    analyze: aiServices.requestAnalysis,
  };
};

/**
 * Hook for AI recommendations management
 */
export const useAIRecommendations = () => {
  const { active: recommendations, dismissed } = useAIStore(state => ({
    active: state.activeRecommendations,
    dismissed: state.dismissedRecommendations,
  }));
  
  const aiStore = useAIStore();
  
  const dismissRecommendation = useCallback((id) => {
    aiStore.getState().dismissRecommendation(id);
  }, [aiStore]);
  
  const clearAllRecommendations = useCallback(() => {
    aiStore.getState().clearRecommendations();
  }, [aiStore]);
  
  const addRecommendation = useCallback((recommendation) => {
    aiStore.getState().addRecommendation(recommendation);
  }, [aiStore]);
  
  // Get recommendations by priority
  const critical = recommendations.filter(r => r.priority === 'critical');
  const high = recommendations.filter(r => r.priority === 'high');
  const medium = recommendations.filter(r => r.priority === 'medium');
  const low = recommendations.filter(r => r.priority === 'low');
  
  return {
    recommendations,
    dismissed,
    counts: {
      total: recommendations.length,
      critical: critical.length,
      high: high.length,
      medium: medium.length,
      low: low.length,
    },
    byPriority: { critical, high, medium, low },
    actions: {
      dismiss: dismissRecommendation,
      clearAll: clearAllRecommendations,
      add: addRecommendation,
    },
  };
};

/**
 * Hook for AI settings management
 */
export const useAISettings = () => {
  const settings = useAIStore(state => state.settings);
  const aiStore = useAIStore();
  
  const updateSettings = useCallback((newSettings) => {
    aiStore.getState().updateSettings(newSettings);
  }, [aiStore]);
  
  const toggleFeature = useCallback((feature) => {
    const currentValue = settings[feature];
    updateSettings({ [feature]: !currentValue });
  }, [settings, updateSettings]);
  
  return {
    settings,
    updateSettings,
    toggleFeature,
    isFeatureEnabled: (feature) => settings[feature] || false,
  };
};

export default useAIServices;