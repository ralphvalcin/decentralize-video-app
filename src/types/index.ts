/**
 * Global type definitions for the decentralized video app
 * Provides comprehensive type safety for WebRTC state management and AI intelligence
 */

import type { Instance } from 'simple-peer';
import type { Socket } from 'socket.io-client';

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * User information structure
 */
export interface UserInfo {
  readonly id: string;
  readonly name: string;
  readonly role: 'Host' | 'Participant' | 'Moderator';
  readonly avatar?: string;
  readonly joinedAt?: number;
}

/**
 * WebRTC peer connection information
 */
export interface PeerConnection {
  readonly peerID: string;
  readonly peer: Instance;
  readonly name: string;
  readonly role: UserInfo['role'];
  readonly stream?: MediaStream;
  readonly signaled: boolean;
  readonly connectionState: RTCPeerConnectionState;
  readonly joinedAt: number;
}

/**
 * Connection status types
 */
export type ConnectionStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'reconnecting' 
  | 'error'
  | 'failed';

/**
 * Connection quality metrics
 */
export interface ConnectionQuality {
  readonly status: 'excellent' | 'good' | 'fair' | 'poor';
  readonly bandwidth?: number;
  readonly latency?: number;
  readonly packetLoss?: number;
  readonly jitter?: number;
}

// ============================================================================
// Media & Device Types
// ============================================================================

/**
 * Media device information
 */
export interface MediaDevice {
  readonly deviceId: string;
  readonly kind: MediaDeviceKind;
  readonly label: string;
  readonly groupId: string;
}

/**
 * Media constraints and settings
 */
export interface MediaSettings {
  readonly video: {
    enabled: boolean;
    deviceId?: string;
    width?: number;
    height?: number;
    frameRate?: number;
  };
  readonly audio: {
    enabled: boolean;
    deviceId?: string;
    noiseSuppression?: boolean;
    echoCancellation?: boolean;
    autoGainControl?: boolean;
  };
}

/**
 * Screen sharing state
 */
export interface ScreenShareState {
  readonly isSharing: boolean;
  readonly stream?: MediaStream;
  readonly startTime?: number;
}

// ============================================================================
// Chat & Messaging Types
// ============================================================================

/**
 * Chat message structure
 */
export interface ChatMessage {
  readonly id: string;
  readonly userId: string;
  readonly userName: string;
  readonly text: string;
  readonly timestamp: number;
  readonly type: 'text' | 'system' | 'reaction';
  readonly edited?: boolean;
  readonly editedAt?: number;
}

/**
 * Emoji reaction
 */
export interface EmojiReaction {
  readonly id: string;
  readonly userId: string;
  readonly userName: string;
  readonly emoji: string;
  readonly timestamp: number;
  readonly x?: number;
  readonly y?: number;
}

// ============================================================================
// Engagement Features Types
// ============================================================================

/**
 * Poll option
 */
export interface PollOption {
  readonly id: string;
  readonly text: string;
  readonly votes: number;
  readonly voters: string[];
}

/**
 * Poll structure
 */
export interface Poll {
  readonly id: string;
  readonly question: string;
  readonly options: PollOption[];
  readonly createdBy: string;
  readonly createdAt: number;
  readonly expiresAt?: number;
  readonly allowMultipleChoice: boolean;
  readonly anonymous: boolean;
  readonly status: 'active' | 'closed' | 'draft';
}

/**
 * Q&A question
 */
export interface Question {
  readonly id: string;
  readonly text: string;
  readonly author: string;
  readonly authorId: string;
  readonly timestamp: number;
  readonly votes: number;
  readonly voters: string[];
  readonly answered: boolean;
  readonly answer?: {
    readonly text: string;
    readonly answeredBy: string;
    readonly answeredAt: number;
  };
  readonly status: 'pending' | 'answered' | 'dismissed';
}

/**
 * Raised hand information
 */
export interface RaisedHand {
  readonly userId: string;
  readonly userName: string;
  readonly timestamp: number;
  readonly reason?: string;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Layout configuration
 */
export interface LayoutConfig {
  readonly preset: 'grid' | 'spotlight' | 'sidebar' | 'presentation';
  readonly gridColumns?: number;
  readonly spotlightUser?: string;
  readonly showSidebar: boolean;
  readonly compactMode: boolean;
}

/**
 * Modal states
 */
export interface ModalStates {
  readonly shareModal: boolean;
  readonly feedbackModal: boolean;
  readonly settingsModal: boolean;
  readonly leaveConfirmation: boolean;
  readonly participantsList: boolean;
  readonly breakoutRooms: boolean;
}

/**
 * Panel visibility states
 */
export interface PanelStates {
  readonly chat: boolean;
  readonly polls: boolean;
  readonly qa: boolean;
  readonly participants: boolean;
  readonly reactions: boolean;
  readonly moreMenu: boolean;
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  readonly newParticipant: boolean;
  readonly participantLeft: boolean;
  readonly newMessage: boolean;
  readonly handRaised: boolean;
  readonly newPoll: boolean;
  readonly newQuestion: boolean;
  readonly connectionIssues: boolean;
}

// ============================================================================
// Event System Types
// ============================================================================

/**
 * Event bus event types
 */
export interface EventMap {
  // Connection events
  'connection:status-changed': { status: ConnectionStatus; timestamp: number };
  'connection:quality-changed': { quality: ConnectionQuality; timestamp: number };
  'peer:joined': { peer: PeerConnection; timestamp: number };
  'peer:left': { peerID: string; name: string; timestamp: number };
  'peer:stream-updated': { peerID: string; stream: MediaStream; timestamp: number };

  // Media events
  'media:stream-updated': { stream: MediaStream | null; timestamp: number };
  'media:device-changed': { type: 'audio' | 'video'; device: MediaDevice; timestamp: number };
  'media:settings-changed': { settings: Partial<MediaSettings>; timestamp: number };
  'screen:share-started': { stream: MediaStream; timestamp: number };
  'screen:share-stopped': { timestamp: number };

  // UI events
  'ui:panel-toggled': { panel: keyof PanelStates; isOpen: boolean; timestamp: number };
  'ui:modal-toggled': { modal: keyof ModalStates; isOpen: boolean; timestamp: number };
  'ui:layout-changed': { layout: LayoutConfig; timestamp: number };
  'ui:notification': { type: 'info' | 'success' | 'warning' | 'error'; message: string; timestamp: number };

  // Chat events
  'chat:message-sent': { message: ChatMessage; timestamp: number };
  'chat:message-received': { message: ChatMessage; timestamp: number };
  'chat:unread-count-changed': { count: number; timestamp: number };

  // Engagement events
  'reaction:sent': { reaction: EmojiReaction; timestamp: number };
  'poll:created': { poll: Poll; timestamp: number };
  'poll:voted': { pollId: string; optionId: string; userId: string; timestamp: number };
  'question:submitted': { question: Question; timestamp: number };
  'question:voted': { questionId: string; userId: string; timestamp: number };
  'hand:raised': { hand: RaisedHand; timestamp: number };
  'hand:lowered': { userId: string; timestamp: number };

  // System events
  'system:error': { error: Error; context: string; timestamp: number };
  'system:cleanup': { timestamp: number };
  'room:leaving': { userId: string; timestamp: number };
}

/**
 * Event listener callback type
 */
export type EventCallback<T extends keyof EventMap> = (data: EventMap[T]) => void;

/**
 * Event unsubscribe function
 */
export type EventUnsubscribe = () => void;

// ============================================================================
// Store State Types
// ============================================================================

/**
 * Connection store state
 */
export interface ConnectionState {
  readonly socket: Socket | null;
  readonly status: ConnectionStatus;
  readonly quality: ConnectionQuality;
  readonly peers: Map<string, PeerConnection>;
  readonly reconnectAttempts: number;
  readonly lastConnectedAt?: number;
  readonly isReconnecting: boolean;
}

/**
 * Media store state
 */
export interface MediaState {
  readonly localStream: MediaStream | null;
  readonly settings: MediaSettings;
  readonly devices: {
    readonly audio: MediaDevice[];
    readonly video: MediaDevice[];
  };
  readonly screenShare: ScreenShareState;
  readonly isInitializing: boolean;
  readonly permissions: {
    readonly camera: PermissionState | null;
    readonly microphone: PermissionState | null;
    readonly screen: boolean;
  };
}

/**
 * Room store state
 */
export interface RoomState {
  readonly roomId: string | null;
  readonly userInfo: UserInfo | null;
  readonly participants: Map<string, UserInfo>;
  readonly messages: ChatMessage[];
  readonly polls: Poll[];
  readonly questions: Question[];
  readonly reactions: EmojiReaction[];
  readonly raisedHands: Map<string, RaisedHand>;
  readonly unreadCounts: {
    readonly messages: number;
    readonly polls: number;
    readonly questions: number;
  };
  readonly metadata: {
    readonly createdAt?: number;
    readonly hostId?: string;
    readonly maxParticipants?: number;
  };
}

/**
 * UI store state
 */
export interface UIState {
  readonly layout: LayoutConfig;
  readonly panels: PanelStates;
  readonly modals: ModalStates;
  readonly notifications: NotificationSettings;
  readonly theme: 'light' | 'dark' | 'system';
  readonly isFullscreen: boolean;
  readonly sidebarCollapsed: boolean;
  readonly performanceMode: boolean;
}

// ============================================================================
// Store Action Types
// ============================================================================

/**
 * Generic store actions interface
 */
export interface StoreActions<T> {
  readonly reset: () => void;
  readonly updateState: (updates: Partial<T>) => void;
}

/**
 * Connection store actions
 */
export interface ConnectionActions extends StoreActions<ConnectionState> {
  readonly setSocket: (socket: Socket | null) => void;
  readonly setStatus: (status: ConnectionStatus) => void;
  readonly updateQuality: (quality: Partial<ConnectionQuality>) => void;
  readonly addPeer: (peer: PeerConnection) => void;
  readonly removePeer: (peerID: string) => void;
  readonly updatePeer: (peerID: string, updates: Partial<PeerConnection>) => void;
  readonly incrementReconnectAttempts: () => void;
  readonly resetReconnectAttempts: () => void;
}

/**
 * Media store actions
 */
export interface MediaActions extends StoreActions<MediaState> {
  readonly setLocalStream: (stream: MediaStream | null) => void;
  readonly updateSettings: (settings: Partial<MediaSettings>) => void;
  readonly setDevices: (type: 'audio' | 'video', devices: MediaDevice[]) => void;
  readonly toggleAudio: () => boolean;
  readonly toggleVideo: () => boolean;
  readonly startScreenShare: (stream: MediaStream) => void;
  readonly stopScreenShare: () => void;
  readonly updatePermissions: (permissions: Partial<MediaState['permissions']>) => void;
}

/**
 * Room store actions
 */
export interface RoomActions extends StoreActions<RoomState> {
  readonly setRoomId: (roomId: string) => void;
  readonly setUserInfo: (userInfo: UserInfo) => void;
  readonly addParticipant: (participant: UserInfo) => void;
  readonly removeParticipant: (userId: string) => void;
  readonly addMessage: (message: ChatMessage) => void;
  readonly addPoll: (poll: Poll) => void;
  readonly updatePoll: (pollId: string, updates: Partial<Poll>) => void;
  readonly addQuestion: (question: Question) => void;
  readonly updateQuestion: (questionId: string, updates: Partial<Question>) => void;
  readonly addReaction: (reaction: EmojiReaction) => void;
  readonly raiseHand: (hand: RaisedHand) => void;
  readonly lowerHand: (userId: string) => void;
  readonly updateUnreadCounts: (counts: Partial<RoomState['unreadCounts']>) => void;
  readonly clearUnreadCount: (type: keyof RoomState['unreadCounts']) => void;
}

/**
 * UI store actions
 */
export interface UIActions extends StoreActions<UIState> {
  readonly setLayout: (layout: LayoutConfig) => void;
  readonly togglePanel: (panel: keyof PanelStates) => void;
  readonly toggleModal: (modal: keyof ModalStates) => void;
  readonly updateNotifications: (settings: Partial<NotificationSettings>) => void;
  readonly setTheme: (theme: UIState['theme']) => void;
  readonly toggleFullscreen: () => void;
  readonly toggleSidebar: () => void;
  readonly setPerformanceMode: (enabled: boolean) => void;
}

// ============================================================================
// Store Types
// ============================================================================

/**
 * Complete connection store type
 */
export type ConnectionStore = ConnectionState & ConnectionActions;

/**
 * Complete media store type
 */
export type MediaStore = MediaState & MediaActions;

/**
 * Complete room store type
 */
export type RoomStore = RoomState & RoomActions;

/**
 * Complete UI store type
 */
export type UIStore = UIState & UIActions;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep readonly utility type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Optional fields utility type
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Required fields utility type
 */
export type Required<T, K extends keyof T> = T & RequiredPick<T, K>;

type RequiredPick<T, K extends keyof T> = {
  [P in K]-?: T[P];
};

/**
 * Error with context information
 */
export interface AppError extends Error {
  readonly context?: string;
  readonly code?: string;
  readonly timestamp: number;
  readonly userId?: string;
  readonly roomId?: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  readonly renderTime: number;
  readonly connectionLatency: number;
  readonly memoryUsage: number;
  readonly frameRate: number;
  readonly timestamp: number;
}

// ============================================================================
// AI Intelligence Types
// ============================================================================

/**
 * AI insights for connections, participants, and performance
 */
export interface AIInsights {
  readonly peerId?: string;
  readonly timestamp: number;
  readonly current: {
    readonly quality: number;
    readonly bandwidth: number;
    readonly latency: number;
    readonly packetLoss: number;
  };
  readonly prediction?: ConnectionPrediction;
  readonly patterns: {
    readonly timeOfDay: string;
    readonly networkType: string;
    readonly usagePattern: string;
  };
  readonly trends: {
    readonly quality: 'improving' | 'degrading' | 'stable';
    readonly bandwidth: 'improving' | 'degrading' | 'stable';
  };
  readonly recommendations: string[];
}

/**
 * AI recommendation structure
 */
export interface AIRecommendation {
  readonly id: string;
  readonly type: 'connection_optimization' | 'layout_change' | 'engagement_improvement' | 
                'performance_optimization' | 'troubleshooting' | 'cross_component_optimization' |
                'performance_bottleneck' | 'memory_leak' | 'engagement_recovery';
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly title: string;
  readonly message: string;
  readonly confidence: number;
  readonly actions: Array<{
    readonly label: string;
    readonly action: string;
    readonly data?: any;
  }>;
  readonly timestamp: number;
  readonly peerId?: string;
  readonly metadata?: Record<string, any>;
}

/**
 * AI optimization information
 */
export interface AIOptimization {
  readonly id: string;
  readonly peerId?: string;
  readonly type: 'quality_adjustment' | 'bandwidth_management' | 'memory_cleanup' | 
                'connection_optimization' | 'codec_optimization' | 'preemptive_optimization';
  readonly description: string;
  readonly result?: {
    readonly success: boolean;
    readonly details?: string;
    readonly error?: string;
    readonly impact?: string;
  };
  readonly confidence: number;
  readonly timestamp: number;
  readonly appliedAt?: number;
}

/**
 * Connection quality prediction
 */
export interface ConnectionPrediction {
  readonly quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  readonly confidence: number;
  readonly trend: 'improving' | 'degrading' | 'stable';
  readonly timeToIssue?: number | null;
  readonly factors: string[];
  readonly timestamp: number;
}

/**
 * Layout optimization suggestion
 */
export interface LayoutSuggestion {
  readonly id: string;
  readonly type: 'grid' | 'spotlight' | 'presentation' | 'dynamic';
  readonly name?: string;
  readonly confidence: number;
  readonly reasoning: string;
  readonly participantCount: number;
  readonly meetingType: 'discussion' | 'presentation' | 'collaborative' | 
                        'one_on_one' | 'webinar' | 'business_meeting';
  readonly timestamp: number;
  readonly config?: Record<string, any>;
  readonly features?: {
    readonly autoArrange?: boolean;
    readonly speakerFocus?: boolean;
    readonly screenShareFocus?: boolean;
    readonly adaptiveSize?: boolean;
  };
  readonly participantRange?: {
    readonly min: number;
    readonly max: number;
  };
  readonly optimalFor?: string[];
}

/**
 * Participant engagement analysis
 */
export interface EngagementAnalysis {
  readonly overallLevel: 'low' | 'medium' | 'high';
  readonly videoEngagement: number;
  readonly audioEngagement: number;
  readonly chatEngagement: number;
  readonly trends: {
    readonly overall: 'improving' | 'degrading' | 'stable';
  };
  readonly timestamp: number;
}

/**
 * Performance prediction from AI
 */
export interface PerformancePrediction {
  readonly id: string;
  readonly timestamp: number;
  readonly predictions: Record<string, {
    readonly value: number;
    readonly confidence: number;
    readonly trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  readonly confidence: number;
  readonly resourceUsage: any;
}

// ============================================================================
// AI Store State and Actions
// ============================================================================

/**
 * AI store state
 */
export interface AIState {
  readonly isInitialized: boolean;
  readonly isProcessing: boolean;
  readonly connectionInsights: Map<string, AIInsights>;
  readonly connectionPredictions: Map<string, ConnectionPrediction>;
  readonly connectionOptimizations: AIOptimization[];
  readonly layoutSuggestions: LayoutSuggestion[];
  readonly currentLayoutRecommendation: LayoutSuggestion | null;
  readonly layoutConfidence: number;
  readonly engagementAnalysis: EngagementAnalysis | null;
  readonly speakingPatterns: Map<string, any>;
  readonly participantInsights: Map<string, any>;
  readonly performancePredictions: PerformancePrediction[];
  readonly resourceOptimizations: AIOptimization[];
  readonly predictiveAdjustments: Map<string, any>;
  readonly activeRecommendations: AIRecommendation[];
  readonly dismissedRecommendations: Set<string>;
  readonly recommendationHistory: AIRecommendation[];
  readonly userPreferences: Map<string, any>;
  readonly behaviorPatterns: Map<string, any>;
  readonly learningData: Map<string, any>;
  readonly settings: {
    readonly enableConnectionIntelligence: boolean;
    readonly enableLayoutIntelligence: boolean;
    readonly enableParticipantIntelligence: boolean;
    readonly enablePerformanceIntelligence: boolean;
    readonly enableProactiveOptimizations: boolean;
    readonly confidenceThreshold: number;
    readonly learningEnabled: boolean;
  };
  readonly diagnostics: {
    readonly modelLoadTime: number;
    readonly predictionAccuracy: number;
    readonly optimizationSuccessRate: number;
    readonly lastProcessingTime: number;
  };
}

/**
 * AI store actions
 */
export interface AIActions extends StoreActions<AIState> {
  readonly initialize: () => Promise<void>;
  readonly cleanup: () => void;
  readonly updateConnectionInsights: (peerId: string, insights: AIInsights) => void;
  readonly addConnectionPrediction: (peerId: string, prediction: ConnectionPrediction) => void;
  readonly applyConnectionOptimization: (optimization: AIOptimization) => void;
  readonly generateLayoutSuggestions: (context: any) => Promise<LayoutSuggestion[]>;
  readonly applyLayoutRecommendation: (suggestion: LayoutSuggestion) => void;
  readonly updateLayoutConfidence: (confidence: number) => void;
  readonly updateEngagementAnalysis: (analysis: EngagementAnalysis) => void;
  readonly updateSpeakingPatterns: (peerId: string, patterns: any) => void;
  readonly updateParticipantInsights: (peerId: string, insights: any) => void;
  readonly addPerformancePrediction: (prediction: PerformancePrediction) => void;
  readonly applyResourceOptimization: (optimization: AIOptimization) => void;
  readonly updatePredictiveAdjustments: (peerId: string, adjustments: any) => void;
  readonly addRecommendation: (recommendation: AIRecommendation) => void;
  readonly dismissRecommendation: (id: string) => void;
  readonly clearRecommendations: () => void;
  readonly updateUserPreferences: (key: string, value: any) => void;
  readonly recordBehaviorPattern: (pattern: string, data: any) => void;
  readonly updateLearningData: (key: string, data: any) => void;
  readonly updateSettings: (settings: Partial<AIState['settings']>) => void;
}

/**
 * Complete AI store type
 */
export type AIStore = AIState & AIActions;