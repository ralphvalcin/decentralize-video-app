// UserOnboardingFlow.jsx - Intelligent user onboarding system
import React, { useState, useEffect, useRef } from 'react';
import { useAccessibility } from './AccessibilityProvider';

const UserOnboardingFlow = ({
  isFirstTime = true,
  userType = 'participant', // 'host', 'participant', 'returning'
  deviceType = 'desktop', // 'desktop', 'mobile', 'tablet'
  onComplete,
  onSkip,
  roomId
}) => {
  const { announce, settings, focusManager } = useAccessibility();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(isFirstTime);
  const [deviceCapabilities, setDeviceCapabilities] = useState({});
  const modalRef = useRef(null);
  const [focusTrap, setFocusTrap] = useState(null);

  // Onboarding steps based on user type and device
  const getOnboardingSteps = () => {
    const baseSteps = [
      {
        id: 'welcome',
        title: 'Welcome to Video Chat',
        content: 'Let\'s get you set up for a great video calling experience.',
        icon: '👋',
        action: null
      }
    ];

    const permissionsStep = {
      id: 'permissions',
      title: 'Camera & Microphone Access',
      content: 'We need access to your camera and microphone to enable video calls.',
      icon: '🎥',
      action: 'requestPermissions',
      accessibility: {
        description: 'This step will request browser permissions for camera and microphone access'
      }
    };

    const deviceOptimizationStep = {
      id: 'optimization',
      title: 'Optimizing for Your Device',
      content: `We've detected you're using a ${deviceType}. We'll optimize the experience for your device.`,
      icon: deviceType === 'mobile' ? '📱' : deviceType === 'tablet' ? '📲' : '💻',
      action: 'optimizeDevice'
    };

    const controlsStep = {
      id: 'controls',
      title: 'Video Controls',
      content: 'Here are the main controls you\'ll use during your call.',
      icon: '🎛️',
      action: 'showControls',
      accessibility: {
        description: 'Learn about video controls and keyboard shortcuts',
        keyboardShortcuts: ['Ctrl+D to toggle microphone', 'Ctrl+E to toggle camera']
      }
    };

    const featuresStep = {
      id: 'features',
      title: userType === 'host' ? 'Host Features' : 'Collaboration Features',
      content: userType === 'host' 
        ? 'As a host, you can create polls, manage Q&A, and control the meeting.'
        : 'Use chat, polls, and Q&A to collaborate with other participants.',
      icon: userType === 'host' ? '👑' : '🤝',
      action: 'showFeatures'
    };

    const accessibilityStep = {
      id: 'accessibility',
      title: 'Accessibility Options',
      content: 'We support screen readers, keyboard navigation, and other accessibility features.',
      icon: '♿',
      action: 'showAccessibility',
      showIf: settings.highContrast || settings.reducedMotion || deviceCapabilities.screenReader
    };

    const completeStep = {
      id: 'complete',
      title: 'You\'re All Set!',
      content: 'You can always access help and settings from the menu.',
      icon: '✅',
      action: null
    };

    let steps = [...baseSteps, permissionsStep, deviceOptimizationStep, controlsStep];

    // Add conditional steps
    if (userType === 'host' || !isFirstTime) {
      steps.push(featuresStep);
    }

    if (accessibilityStep.showIf) {
      steps.push(accessibilityStep);
    }

    steps.push(completeStep);

    return steps;
  };

  const steps = getOnboardingSteps();

  // Device capability detection
  useEffect(() => {
    const detectCapabilities = async () => {
      const capabilities = {
        hasCamera: false,
        hasMicrophone: false,
        screenReader: false,
        touchSupport: 'ontouchstart' in window,
        batteryAPI: 'getBattery' in navigator,
        networkAPI: 'connection' in navigator
      };

      // Check media devices
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          capabilities.hasCamera = devices.some(device => device.kind === 'videoinput');
          capabilities.hasMicrophone = devices.some(device => device.kind === 'audioinput');
        } catch (error) {
          console.warn('Could not enumerate devices:', error);
        }
      }

      // Basic screen reader detection
      capabilities.screenReader = Boolean(
        navigator.userAgent.includes('NVDA') ||
        navigator.userAgent.includes('JAWS') ||
        window.speechSynthesis
      );

      setDeviceCapabilities(capabilities);
    };

    detectCapabilities();
  }, []);

  // Set up focus trap when modal opens
  useEffect(() => {
    if (isVisible && modalRef.current) {
      const trap = focusManager.createTrap(modalRef.current);
      setFocusTrap(() => trap);
      announce('Onboarding dialog opened. Use Tab to navigate, Escape to skip.');

      return () => {
        if (trap) trap();
      };
    }
  }, [isVisible, focusManager, announce]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isVisible) return;

      switch (event.key) {
        case 'Escape':
          handleSkip();
          break;
        case 'ArrowLeft':
          if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
            announce(`Step ${currentStep} of ${steps.length}: ${steps[currentStep - 1].title}`);
          }
          break;
        case 'ArrowRight':
          if (currentStep < steps.length - 1) {
            handleNext();
          } else {
            handleComplete();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, currentStep, steps.length]);

  const handleNext = async () => {
    const step = steps[currentStep];

    // Execute step action if present
    if (step.action) {
      try {
        await executeStepAction(step.action);
      } catch (error) {
        console.error('Error executing step action:', error);
        announce('There was an error with this step. You can continue or skip the tutorial.', 'assertive');
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      announce(`Step ${currentStep + 2} of ${steps.length}: ${steps[currentStep + 1].title}`);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      announce(`Step ${currentStep} of ${steps.length}: ${steps[currentStep - 1].title}`);
    }
  };

  const handleSkip = () => {
    announce('Onboarding skipped. You can access help from the menu anytime.');
    setIsVisible(false);
    if (onSkip) onSkip();
  };

  const handleComplete = () => {
    announce('Onboarding completed successfully. Welcome to your video call!');
    setIsVisible(false);
    if (onComplete) onComplete();
    
    // Store completion state
    localStorage.setItem('onboarding-completed', JSON.stringify({
      timestamp: Date.now(),
      userType,
      deviceType
    }));
  };

  // Execute step-specific actions
  const executeStepAction = async (action) => {
    switch (action) {
      case 'requestPermissions':
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            await navigator.mediaDevices.getUserMedia({ 
              video: deviceCapabilities.hasCamera, 
              audio: deviceCapabilities.hasMicrophone 
            });
            announce('Camera and microphone permissions granted successfully.');
          } catch (error) {
            announce('Unable to access camera or microphone. You can continue without them.', 'assertive');
          }
        }
        break;

      case 'optimizeDevice':
        // Apply device-specific optimizations
        if (deviceType === 'mobile') {
          document.documentElement.setAttribute('data-mobile-optimized', 'true');
        }
        announce(`Optimization applied for ${deviceType} device.`);
        break;

      case 'showControls':
        // Highlight controls temporarily
        const controls = document.querySelector('#video-controls');
        if (controls) {
          controls.style.outline = '3px solid #3B82F6';
          setTimeout(() => {
            controls.style.outline = '';
          }, 2000);
        }
        announce('Video controls highlighted. These are the main buttons you\'ll use during calls.');
        break;

      case 'showFeatures':
        announce(`${userType === 'host' ? 'Host' : 'Collaboration'} features will be available in the top navigation.`);
        break;

      case 'showAccessibility':
        announce('Accessibility features are available in settings. This includes high contrast mode, reduced motion, and screen reader enhancements.');
        break;
    }
  };

  if (!isVisible) return null;

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" aria-hidden="true" />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-content"
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Progress indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <button
                onClick={handleSkip}
                className="text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                aria-label="Skip onboarding tutorial"
              >
                Skip
              </button>
            </div>
            <div 
              className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Onboarding progress"
            >
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-8">
            {/* Icon */}
            <div className="text-4xl mb-4" aria-hidden="true">
              {currentStepData.icon}
            </div>
            
            {/* Title */}
            <h2 
              id="onboarding-title"
              className="text-xl font-bold text-gray-900 dark:text-white mb-4"
            >
              {currentStepData.title}
            </h2>
            
            {/* Content */}
            <p 
              id="onboarding-content"
              className="text-gray-600 dark:text-gray-300 leading-relaxed"
            >
              {currentStepData.content}
            </p>

            {/* Accessibility information */}
            {currentStepData.accessibility && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {currentStepData.accessibility.description}
                </p>
                {currentStepData.accessibility.keyboardShortcuts && (
                  <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    {currentStepData.accessibility.keyboardShortcuts.map((shortcut, index) => (
                      <li key={index}>• {shortcut}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white
                disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="Previous step"
            >
              Previous
            </button>

            <div className="flex space-x-2">
              {/* Step indicators */}
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep
                      ? 'bg-blue-600'
                      : index < currentStep
                      ? 'bg-blue-300'
                      : 'bg-gray-300'
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>

            <button
              onClick={currentStep === steps.length - 1 ? handleComplete : handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                transition-colors font-medium"
              aria-label={currentStep === steps.length - 1 ? 'Complete onboarding' : 'Next step'}
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>

          {/* Keyboard navigation hint */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Use arrow keys to navigate, Enter to proceed, Escape to skip
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserOnboardingFlow;