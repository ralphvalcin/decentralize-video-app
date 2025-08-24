// AccessibilityProvider.jsx - Comprehensive accessibility context and utilities
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AccessibilityContext = createContext();

// Accessibility preferences and settings
const defaultAccessibilitySettings = {
  // Visual accessibility
  highContrast: false,
  reducedMotion: false,
  fontSize: 'medium', // small, medium, large, extra-large
  customTheme: null,
  
  // Screen reader settings
  announcements: true,
  verboseDescriptions: false,
  
  // Motor accessibility
  largerTouchTargets: false,
  stickyDrag: false,
  reducedGestures: false,
  
  // Cognitive accessibility
  simplifiedInterface: false,
  extendedTimeouts: false,
  
  // Audio/Visual accessibility
  closedCaptions: false,
  audioDescriptions: false,
  soundAlerts: true,
  visualAlerts: true
};

export const AccessibilityProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    // Load settings from localStorage or use system preferences
    const saved = localStorage.getItem('accessibility-settings');
    const systemPrefs = getSystemAccessibilityPreferences();
    
    return {
      ...defaultAccessibilitySettings,
      ...systemPrefs,
      ...(saved ? JSON.parse(saved) : {})
    };
  });

  const [screenReader, setScreenReader] = useState({
    active: false,
    type: null, // 'nvda', 'jaws', 'voiceover', 'talkback'
    version: null
  });

  const [announcements, setAnnouncements] = useState([]);

  // Detect system accessibility preferences
  function getSystemAccessibilityPreferences() {
    const prefs = {};
    
    // Check for reduced motion preference
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      prefs.reducedMotion = true;
    }
    
    // Check for high contrast preference
    if (window.matchMedia?.('(prefers-contrast: high)')?.matches) {
      prefs.highContrast = true;
    }
    
    // Check for forced colors (Windows high contrast)
    if (window.matchMedia?.('(forced-colors: active)')?.matches) {
      prefs.highContrast = true;
      prefs.customTheme = 'system-high-contrast';
    }
    
    return prefs;
  }

  // Detect screen reader
  useEffect(() => {
    const detectScreenReader = () => {
      // Method 1: Check for screen reader specific properties
      const hasScreenReader = (
        navigator.userAgent.includes('NVDA') ||
        navigator.userAgent.includes('JAWS') ||
        window.speechSynthesis ||
        document.body.getAttribute('role') === 'application'
      );

      // Method 2: Test for screen reader behavior
      const testElement = document.createElement('div');
      testElement.style.position = 'absolute';
      testElement.style.left = '-9999px';
      testElement.style.width = '1px';
      testElement.style.height = '1px';
      testElement.innerHTML = 'Screen reader test';
      testElement.setAttribute('aria-live', 'polite');
      testElement.setAttribute('aria-atomic', 'true');
      
      document.body.appendChild(testElement);
      
      // If screen reader is present, this should be announced
      setTimeout(() => {
        document.body.removeChild(testElement);
        if (hasScreenReader) {
          setScreenReader({
            active: true,
            type: detectScreenReaderType(),
            version: null
          });
        }
      }, 100);
    };

    detectScreenReader();
  }, []);

  const detectScreenReaderType = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('nvda')) return 'nvda';
    if (ua.includes('jaws')) return 'jaws';
    if (navigator.platform.includes('Mac')) return 'voiceover';
    if (navigator.platform.includes('Android')) return 'talkback';
    return 'unknown';
  };

  // Update accessibility settings
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      localStorage.setItem('accessibility-settings', JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  // Announce to screen readers
  const announce = useCallback((message, priority = 'polite') => {
    if (!settings.announcements) return;

    const announcement = {
      id: Date.now(),
      message,
      priority,
      timestamp: Date.now()
    };

    setAnnouncements(prev => [...prev, announcement]);

    // Create live region announcement
    const liveRegion = document.getElementById('accessibility-announcements') || 
      (() => {
        const region = document.createElement('div');
        region.id = 'accessibility-announcements';
        region.setAttribute('aria-live', priority);
        region.setAttribute('aria-atomic', 'true');
        region.style.position = 'absolute';
        region.style.left = '-9999px';
        region.style.width = '1px';
        region.style.height = '1px';
        document.body.appendChild(region);
        return region;
      })();

    liveRegion.textContent = message;

    // Clean up old announcements
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== announcement.id));
    }, 5000);
  }, [settings.announcements]);

  // Focus management utilities
  const focusManager = {
    // Move focus to element
    moveTo: (elementOrSelector, options = {}) => {
      const element = typeof elementOrSelector === 'string' 
        ? document.querySelector(elementOrSelector)
        : elementOrSelector;
      
      if (element) {
        element.focus(options);
        
        if (settings.verboseDescriptions && element.getAttribute('aria-label')) {
          announce(element.getAttribute('aria-label'));
        }
      }
    },

    // Create focus trap for modals
    createTrap: (container) => {
      const focusableElements = container.querySelectorAll(
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
      );
      
      if (focusableElements.length === 0) return null;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const trapFocus = (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };

      container.addEventListener('keydown', trapFocus);
      firstElement.focus();

      return () => container.removeEventListener('keydown', trapFocus);
    }
  };

  // Keyboard navigation utilities
  const keyboardManager = {
    // Handle arrow key navigation
    handleArrowNavigation: (elements, currentIndex, key) => {
      let newIndex = currentIndex;
      
      switch (key) {
        case 'ArrowRight':
        case 'ArrowDown':
          newIndex = (currentIndex + 1) % elements.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          newIndex = currentIndex === 0 ? elements.length - 1 : currentIndex - 1;
          break;
        default:
          return currentIndex;
      }
      
      elements[newIndex]?.focus();
      return newIndex;
    },

    // Add skip links
    addSkipLinks: (links) => {
      const skipContainer = document.createElement('div');
      skipContainer.className = 'skip-links';
      skipContainer.innerHTML = links.map(link => 
        `<a href="#${link.target}" class="skip-link">${link.text}</a>`
      ).join('');
      
      document.body.insertBefore(skipContainer, document.body.firstChild);
    }
  };

  // Theme and visual utilities
  const themeManager = {
    // Apply high contrast mode
    applyHighContrast: (enabled) => {
      document.documentElement.setAttribute('data-high-contrast', enabled);
      updateSetting('highContrast', enabled);
    },

    // Apply custom font size
    applyFontSize: (size) => {
      const sizeMap = {
        small: '0.875rem',
        medium: '1rem',
        large: '1.125rem',
        'extra-large': '1.25rem'
      };
      
      document.documentElement.style.setProperty('--base-font-size', sizeMap[size] || sizeMap.medium);
      updateSetting('fontSize', size);
    },

    // Apply reduced motion
    applyReducedMotion: (enabled) => {
      document.documentElement.setAttribute('data-reduced-motion', enabled);
      updateSetting('reducedMotion', enabled);
    }
  };

  const contextValue = {
    settings,
    updateSetting,
    screenReader,
    announce,
    focusManager,
    keyboardManager,
    themeManager,
    announcements
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
      
      {/* Accessibility announcements live region */}
      <div
        id="accessibility-announcements"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }}
      />
      
      {/* Screen reader only content */}
      <div className="sr-only">
        {announcements.map(announcement => (
          <div key={announcement.id}>{announcement.message}</div>
        ))}
      </div>
    </AccessibilityContext.Provider>
  );
};

// Hook to use accessibility context
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};

// Higher-order component for accessibility enhancements
export const withAccessibility = (Component) => {
  return React.forwardRef((props, ref) => {
    const accessibility = useAccessibility();
    return <Component {...props} ref={ref} accessibility={accessibility} />;
  });
};

// Utility components
export const SkipLink = ({ href, children, className = '' }) => (
  <a
    href={href}
    className={`skip-link absolute left-0 top-0 z-50 bg-blue-600 text-white px-4 py-2 
      -translate-y-full focus:translate-y-0 transition-transform ${className}`}
  >
    {children}
  </a>
);

export const ScreenReaderOnly = ({ children, as: Component = 'span' }) => (
  <Component className="sr-only">
    {children}
  </Component>
);

export const LiveRegion = ({ children, priority = 'polite', atomic = false }) => (
  <div
    aria-live={priority}
    aria-atomic={atomic}
    style={{
      position: 'absolute',
      left: '-9999px',
      width: '1px',
      height: '1px',
      overflow: 'hidden'
    }}
  >
    {children}
  </div>
);

export default AccessibilityProvider;