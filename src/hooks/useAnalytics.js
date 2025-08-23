// useAnalytics.js - React hook for analytics integration
import { useEffect, useCallback, useRef } from 'react';
import analyticsService from '../services/analytics';

export const useAnalytics = () => {
  const trackingRef = useRef(new Map());

  const track = useCallback((eventName, properties = {}) => {
    analyticsService.track(eventName, properties);
  }, []);

  const trackMobile = useCallback((eventName, properties = {}) => {
    analyticsService.trackMobileEvent(eventName, properties);
  }, []);

  const trackWebRTC = useCallback((eventName, properties = {}) => {
    analyticsService.trackWebRTCEvent(eventName, properties);
  }, []);

  const trackTiming = useCallback((eventName, startTime) => {
    const duration = performance.now() - startTime;
    track(`${eventName}_timing`, { duration });
    return duration;
  }, [track]);

  // Track component mount/unmount
  const trackComponentLifecycle = useCallback((componentName) => {
    const mountTime = performance.now();
    
    track('component_mount', { 
      component: componentName,
      timestamp: mountTime 
    });

    return () => {
      const unmountTime = performance.now();
      const sessionDuration = unmountTime - mountTime;
      
      track('component_unmount', { 
        component: componentName,
        sessionDuration,
        timestamp: unmountTime
      });
    };
  }, [track]);

  return {
    track,
    trackMobile,
    trackWebRTC,
    trackTiming,
    trackComponentLifecycle,
    flush: analyticsService.flush.bind(analyticsService),
    getMetrics: analyticsService.getAllMetrics.bind(analyticsService)
  };
};

// Hook for tracking page views
export const usePageTracking = (pageName) => {
  const { track } = useAnalytics();

  useEffect(() => {
    const startTime = performance.now();
    
    track('page_view', {
      page: pageName,
      timestamp: Date.now(),
      referrer: document.referrer,
      userAgent: navigator.userAgent
    });

    return () => {
      const sessionTime = performance.now() - startTime;
      track('page_session_end', {
        page: pageName,
        sessionTime,
        timestamp: Date.now()
      });
    };
  }, [pageName, track]);
};

// Hook for tracking user interactions
export const useInteractionTracking = () => {
  const { track } = useAnalytics();

  const trackClick = useCallback((element, properties = {}) => {
    track('click', {
      element,
      timestamp: Date.now(),
      ...properties
    });
  }, [track]);

  const trackFormSubmit = useCallback((formName, formData = {}) => {
    track('form_submit', {
      form: formName,
      timestamp: Date.now(),
      ...formData
    });
  }, [track]);

  const trackError = useCallback((error, context = {}) => {
    track('error', {
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      context
    });
  }, [track]);

  return {
    trackClick,
    trackFormSubmit,
    trackError
  };
};

// Hook for WebRTC call analytics
export const useCallAnalytics = () => {
  const { trackWebRTC, track } = useAnalytics();
  const callMetrics = useRef({
    startTime: null,
    participantCount: 0,
    qualityIssues: 0,
    reconnections: 0
  });

  const startCall = useCallback((roomId) => {
    callMetrics.current.startTime = Date.now();
    
    trackWebRTC('call_started', {
      roomId,
      timestamp: callMetrics.current.startTime
    });
  }, [trackWebRTC]);

  const endCall = useCallback((roomId) => {
    if (!callMetrics.current.startTime) return;

    const duration = Date.now() - callMetrics.current.startTime;
    
    trackWebRTC('call_ended', {
      roomId,
      duration,
      participantCount: callMetrics.current.participantCount,
      qualityIssues: callMetrics.current.qualityIssues,
      reconnections: callMetrics.current.reconnections,
      timestamp: Date.now()
    });

    // Reset metrics
    callMetrics.current = {
      startTime: null,
      participantCount: 0,
      qualityIssues: 0,
      reconnections: 0
    };
  }, [trackWebRTC]);

  const trackParticipantJoin = useCallback(() => {
    callMetrics.current.participantCount++;
    trackWebRTC('participant_joined', {
      participantCount: callMetrics.current.participantCount
    });
  }, [trackWebRTC]);

  const trackParticipantLeave = useCallback(() => {
    callMetrics.current.participantCount = Math.max(0, callMetrics.current.participantCount - 1);
    trackWebRTC('participant_left', {
      participantCount: callMetrics.current.participantCount
    });
  }, [trackWebRTC]);

  const trackQualityIssue = useCallback((issueType, severity = 'medium') => {
    callMetrics.current.qualityIssues++;
    trackWebRTC('quality_issue', {
      issueType,
      severity,
      timestamp: Date.now()
    });
  }, [trackWebRTC]);

  const trackReconnection = useCallback((reason) => {
    callMetrics.current.reconnections++;
    trackWebRTC('reconnection', {
      reason,
      reconnectionCount: callMetrics.current.reconnections,
      timestamp: Date.now()
    });
  }, [trackWebRTC]);

  const trackCallQuality = useCallback((metrics) => {
    trackWebRTC('call_quality_metrics', {
      ...metrics,
      timestamp: Date.now()
    });
  }, [trackWebRTC]);

  return {
    startCall,
    endCall,
    trackParticipantJoin,
    trackParticipantLeave,
    trackQualityIssue,
    trackReconnection,
    trackCallQuality
  };
};

// Hook for mobile-specific analytics
export const useMobileAnalytics = () => {
  const { trackMobile } = useAnalytics();

  useEffect(() => {
    // Track initial mobile capabilities
    trackMobile('mobile_capabilities', {
      touchSupport: 'ontouchstart' in window,
      devicePixelRatio: window.devicePixelRatio,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight
      },
      orientation: screen.orientation?.angle || 0
    });

    // Track orientation changes
    const handleOrientationChange = () => {
      trackMobile('orientation_change', {
        angle: screen.orientation?.angle || window.orientation || 0,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      });
    };

    // Track visibility changes
    const handleVisibilityChange = () => {
      trackMobile('visibility_change', {
        hidden: document.hidden,
        timestamp: Date.now()
      });
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [trackMobile]);

  const trackGesture = useCallback((gestureType, properties = {}) => {
    trackMobile('gesture', {
      type: gestureType,
      timestamp: Date.now(),
      ...properties
    });
  }, [trackMobile]);

  const trackTouchInteraction = useCallback((interactionType, duration) => {
    trackMobile('touch_interaction', {
      type: interactionType,
      duration,
      timestamp: Date.now()
    });
  }, [trackMobile]);

  return {
    trackGesture,
    trackTouchInteraction
  };
};

export default useAnalytics;