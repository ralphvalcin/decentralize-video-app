/**
 * UI Store - User interface state and preferences
 * Handles layout, panels, modals, notifications, and theme settings
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type {
  UIStore,
  UIState,
  UIActions,
  LayoutConfig,
  PanelStates,
  ModalStates,
  NotificationSettings,
} from '../types';
import { eventBus } from '../utils/EventBus';

/**
 * Initial UI state
 */
const initialState: UIState = {
  layout: {
    preset: 'grid',
    gridColumns: 3,
    showSidebar: true,
    compactMode: false,
  },
  panels: {
    chat: false,
    polls: false,
    qa: false,
    participants: false,
    reactions: false,
    moreMenu: false,
  },
  modals: {
    shareModal: false,
    feedbackModal: false,
    settingsModal: false,
    leaveConfirmation: false,
    participantsList: false,
    breakoutRooms: false,
  },
  notifications: {
    newParticipant: true,
    participantLeft: true,
    newMessage: true,
    handRaised: true,
    newPoll: true,
    newQuestion: true,
    connectionIssues: true,
  },
  theme: 'system',
  isFullscreen: false,
  sidebarCollapsed: false,
  performanceMode: false,
};

/**
 * UI store with comprehensive interface state management
 */
export const useUIStore = create<UIStore>()(
  persist(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,

        // =====================================================================
        // Core Actions
        // =====================================================================

        reset: () => {
          set((state) => {
            // Keep user preferences but reset transient state
            Object.assign(state, {
              ...initialState,
              theme: state.theme,
              notifications: state.notifications,
              layout: {
                ...initialState.layout,
                preset: state.layout.preset,
                gridColumns: state.layout.gridColumns,
                compactMode: state.layout.compactMode,
              },
              performanceMode: state.performanceMode,
            });
          });

          eventBus.emit('system:cleanup', { timestamp: Date.now() });
        },

        updateState: (updates) => {
          set((state) => {
            Object.assign(state, updates);
          });
        },

        // =====================================================================
        // Layout Management
        // =====================================================================

        setLayout: (layout) => {
          const prevLayout = get().layout;
          
          set((state) => {
            state.layout = { ...state.layout, ...layout };
          });

          eventBus.emit('ui:layout-changed', {
            layout: get().layout,
            timestamp: Date.now(),
          });

          // Auto-adjust for performance mode
          if (layout.preset === 'grid' && layout.gridColumns && layout.gridColumns > 4) {
            const { performanceMode } = get();
            if (performanceMode) {
              set((state) => {
                state.layout.gridColumns = 4; // Limit columns in performance mode
              });
            }
          }
        },

        // =====================================================================
        // Panel Management
        // =====================================================================

        togglePanel: (panel) => {
          const wasOpen = get().panels[panel];
          const newState = !wasOpen;

          set((state) => {
            state.panels[panel] = newState;
            
            // Auto-close other panels if too many are open (mobile optimization)
            const openPanels = Object.values(state.panels).filter(Boolean).length;
            if (openPanels > 2 && window.innerWidth < 768) {
              // Close other panels on mobile when opening a third
              Object.keys(state.panels).forEach((key) => {
                if (key !== panel) {
                  state.panels[key as keyof PanelStates] = false;
                }
              });
            }
          });

          eventBus.emit('ui:panel-toggled', {
            panel,
            isOpen: newState,
            timestamp: Date.now(),
          });

          // Update layout sidebar visibility based on panel state
          const anyPanelOpen = Object.values(get().panels).some(Boolean);
          if (!anyPanelOpen && get().layout.showSidebar) {
            get().setLayout({ showSidebar: false });
          } else if (anyPanelOpen && !get().layout.showSidebar) {
            get().setLayout({ showSidebar: true });
          }
        },

        // =====================================================================
        // Modal Management
        // =====================================================================

        toggleModal: (modal) => {
          const wasOpen = get().modals[modal];
          const newState = !wasOpen;

          set((state) => {
            state.modals[modal] = newState;
            
            // Close other modals when opening a new one (except for stacked modals)
            if (newState && modal !== 'leaveConfirmation') {
              Object.keys(state.modals).forEach((key) => {
                if (key !== modal && key !== 'leaveConfirmation') {
                  state.modals[key as keyof ModalStates] = false;
                }
              });
            }
          });

          eventBus.emit('ui:modal-toggled', {
            modal,
            isOpen: newState,
            timestamp: Date.now(),
          });

          // Handle fullscreen exit when opening modals
          if (newState && get().isFullscreen) {
            document.exitFullscreen?.();
          }
        },

        // =====================================================================
        // Notification Settings
        // =====================================================================

        updateNotifications: (settings) => {
          set((state) => {
            state.notifications = { ...state.notifications, ...settings };
          });
        },

        // =====================================================================
        // Theme Management
        // =====================================================================

        setTheme: (theme) => {
          const prevTheme = get().theme;
          
          set((state) => {
            state.theme = theme;
          });

          // Apply theme to document
          applyThemeToDocument(theme);
          
          // Emit theme change event
          eventBus.emit('ui:notification', {
            type: 'info',
            message: `Theme changed to ${theme}`,
            timestamp: Date.now(),
          });
        },

        // =====================================================================
        // Fullscreen Management
        // =====================================================================

        toggleFullscreen: () => {
          const isFullscreen = get().isFullscreen;
          
          if (isFullscreen) {
            document.exitFullscreen?.();
          } else {
            document.documentElement.requestFullscreen?.();
          }

          set((state) => {
            state.isFullscreen = !isFullscreen;
          });
        },

        // =====================================================================
        // Sidebar Management
        // =====================================================================

        toggleSidebar: () => {
          set((state) => {
            state.sidebarCollapsed = !state.sidebarCollapsed;
          });
        },

        // =====================================================================
        // Performance Mode
        // =====================================================================

        setPerformanceMode: (enabled) => {
          const prevPerformanceMode = get().performanceMode;
          
          set((state) => {
            state.performanceMode = enabled;
            
            if (enabled) {
              // Optimize layout for performance
              state.layout.compactMode = true;
              if (state.layout.gridColumns && state.layout.gridColumns > 4) {
                state.layout.gridColumns = 4;
              }
              
              // Close non-essential panels
              state.panels.reactions = false;
            }
          });

          if (prevPerformanceMode !== enabled) {
            eventBus.emit('ui:notification', {
              type: 'info',
              message: enabled ? 'Performance mode enabled' : 'Performance mode disabled',
              timestamp: Date.now(),
            });
          }
        },
      }))
    ),
    {
      name: 'video-app-ui-state',
      partialize: (state) => ({
        // Only persist user preferences, not transient state
        theme: state.theme,
        notifications: state.notifications,
        layout: {
          preset: state.layout.preset,
          gridColumns: state.layout.gridColumns,
          compactMode: state.layout.compactMode,
        },
        performanceMode: state.performanceMode,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

// ============================================================================
// Theme Application Utilities
// ============================================================================

/**
 * Apply theme to document
 */
const applyThemeToDocument = (theme: UIState['theme']): void => {
  const root = document.documentElement;
  
  // Remove existing theme classes
  root.classList.remove('theme-light', 'theme-dark', 'theme-system');
  
  if (theme === 'system') {
    // Use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
    root.classList.add('theme-system');
  } else {
    root.classList.add(`theme-${theme}`);
  }
};

/**
 * Initialize theme on app load
 */
export const initializeTheme = (): void => {
  const { theme } = useUIStore.getState();
  applyThemeToDocument(theme);
  
  // Listen for system theme changes
  if (theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (useUIStore.getState().theme === 'system') {
        applyThemeToDocument('system');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    // Return cleanup function
    return () => mediaQuery.removeEventListener('change', handleChange);
  }
};

// ============================================================================
// Responsive Design Utilities
// ============================================================================

/**
 * Get responsive layout configuration
 */
export const getResponsiveLayout = (windowWidth: number): Partial<LayoutConfig> => {
  if (windowWidth < 640) {
    // Mobile
    return {
      preset: 'spotlight',
      gridColumns: 1,
      compactMode: true,
    };
  } else if (windowWidth < 1024) {
    // Tablet
    return {
      preset: 'grid',
      gridColumns: 2,
      compactMode: false,
    };
  } else {
    // Desktop
    return {
      preset: 'grid',
      gridColumns: 3,
      compactMode: false,
    };
  }
};

/**
 * Apply responsive layout based on window size
 */
export const applyResponsiveLayout = (): void => {
  const layout = getResponsiveLayout(window.innerWidth);
  const currentLayout = useUIStore.getState().layout;
  
  // Only update if there are changes
  if (
    layout.preset !== currentLayout.preset ||
    layout.gridColumns !== currentLayout.gridColumns ||
    layout.compactMode !== currentLayout.compactMode
  ) {
    useUIStore.getState().setLayout(layout);
  }
};

// ============================================================================
// Selectors for Optimized Component Subscriptions
// ============================================================================

/**
 * Layout configuration selector
 */
export const useLayout = () =>
  useUIStore((state) => state.layout);

/**
 * Panel states selector
 */
export const usePanels = () =>
  useUIStore((state) => state.panels);

/**
 * Specific panel state selector
 */
export const usePanelState = (panel: keyof PanelStates) =>
  useUIStore((state) => state.panels[panel]);

/**
 * Open panels count selector
 */
export const useOpenPanelsCount = () =>
  useUIStore((state) => 
    Object.values(state.panels).filter(Boolean).length
  );

/**
 * Modal states selector
 */
export const useModals = () =>
  useUIStore((state) => state.modals);

/**
 * Specific modal state selector
 */
export const useModalState = (modal: keyof ModalStates) =>
  useUIStore((state) => state.modals[modal]);

/**
 * Any modal open selector
 */
export const useAnyModalOpen = () =>
  useUIStore((state) =>
    Object.values(state.modals).some(Boolean)
  );

/**
 * Theme selector
 */
export const useTheme = () =>
  useUIStore((state) => state.theme);

/**
 * Notification settings selector
 */
export const useNotificationSettings = () =>
  useUIStore((state) => state.notifications);

/**
 * Fullscreen state selector
 */
export const useFullscreen = () =>
  useUIStore((state) => state.isFullscreen);

/**
 * Sidebar state selector
 */
export const useSidebarState = () =>
  useUIStore((state) => ({
    collapsed: state.sidebarCollapsed,
    visible: state.layout.showSidebar,
  }));

/**
 * Performance mode selector
 */
export const usePerformanceMode = () =>
  useUIStore((state) => state.performanceMode);

/**
 * UI accessibility state selector
 */
export const useUIAccessibility = () =>
  useUIStore((state) => ({
    highContrast: state.theme === 'dark',
    compactMode: state.layout.compactMode,
    performanceMode: state.performanceMode,
    panelCount: Object.values(state.panels).filter(Boolean).length,
  }));

// ============================================================================
// Store Subscriptions and Side Effects
// ============================================================================

// Subscribe to fullscreen changes
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = !!document.fullscreenElement;
    const currentState = useUIStore.getState().isFullscreen;
    
    if (isFullscreen !== currentState) {
      useUIStore.getState().updateState({ isFullscreen });
    }
  });
}

// Subscribe to window resize for responsive layout
if (typeof window !== 'undefined') {
  let resizeTimeout: number;
  
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(() => {
      applyResponsiveLayout();
    }, 150); // Debounce resize events
  });
}

// Subscribe to performance mode changes for automatic optimizations
useUIStore.subscribe(
  (state) => state.performanceMode,
  (performanceMode) => {
    if (performanceMode) {
      // Apply performance optimizations
      const { layout } = useUIStore.getState();
      if (layout.gridColumns && layout.gridColumns > 4) {
        useUIStore.getState().setLayout({ gridColumns: 4 });
      }
    }
  }
);

export default useUIStore;