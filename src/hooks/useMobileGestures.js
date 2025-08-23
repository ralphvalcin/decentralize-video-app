// useMobileGestures.js - Hook for handling mobile touch gestures
import { useEffect, useCallback, useRef, useState } from 'react';

export const useMobileGestures = ({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPinchZoom,
  onDoubleTap,
  threshold = 50,
  timeThreshold = 300
}) => {
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);
  const lastTapRef = useRef(0);
  const tapCountRef = useRef(0);

  const handleTouchStart = useCallback((e) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      timestamp: Date.now(),
      touches: e.touches.length
    };
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartRef.current) return;

    // Handle pinch zoom
    if (e.touches.length === 2 && onPinchZoom) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      onPinchZoom({
        distance,
        center: {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        }
      });
    }
  }, [onPinchZoom]);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStartRef.current) return;

    touchEndRef.current = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      timestamp: Date.now()
    };

    const deltaX = touchEndRef.current.x - touchStartRef.current.x;
    const deltaY = touchEndRef.current.y - touchStartRef.current.y;
    const deltaTime = touchEndRef.current.timestamp - touchStartRef.current.timestamp;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Handle double tap
    if (distance < 10 && deltaTime < 200) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        tapCountRef.current++;
        if (tapCountRef.current === 2 && onDoubleTap) {
          onDoubleTap({
            x: touchEndRef.current.x,
            y: touchEndRef.current.y
          });
          tapCountRef.current = 0;
        }
      } else {
        tapCountRef.current = 1;
      }
      lastTapRef.current = now;
    }

    // Handle swipe gestures
    if (distance > threshold && deltaTime < timeThreshold) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight({ distance: absX, velocity: absX / deltaTime });
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft({ distance: absX, velocity: absX / deltaTime });
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown({ distance: absY, velocity: absY / deltaTime });
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp({ distance: absY, velocity: absY / deltaTime });
        }
      }
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onDoubleTap, threshold, timeThreshold]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    }
  };
};

// Additional hook for detecting mobile device capabilities
export const useMobileDetection = () => {
  const checkMobile = useCallback(() => {
    return {
      isMobile: window.innerWidth < 768 || 'ontouchstart' in window,
      isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
      isLandscape: window.innerHeight < window.innerWidth,
      hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      isAndroid: /Android/.test(navigator.userAgent)
    };
  }, []);

  return checkMobile;
};

// Hook for viewport size tracking
export const useViewport = () => {
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return viewport;
};