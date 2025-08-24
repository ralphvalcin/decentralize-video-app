// PWAInstallPrompt.jsx - Install app prompt for mobile devices
import { useState, useEffect } from 'react';
import pwaService from '../services/pwa';

const PWAInstallPrompt = () => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

   
  useEffect(() => {
    // Listen for install availability
    const handleInstallAvailable = () => {
      if (!pwaService.isInstalled()) {
        setShowInstallPrompt(true);
      }
    };

    // Listen for updates
    const handleUpdateAvailable = () => {
      setShowUpdatePrompt(true);
    };

    // Listen for connectivity changes
    const handleConnectivityChange = (event) => {
      setIsOnline(event.detail.isOnline);
    };

    // Listen for successful installation
    const handleInstalled = () => {
      setShowInstallPrompt(false);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    window.addEventListener('pwa-connectivity-change', handleConnectivityChange);
    window.addEventListener('pwa-installed', handleInstalled);

    // Check initial state
    if (pwaService.canInstall() && !pwaService.isInstalled()) {
      setShowInstallPrompt(true);
    }

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
      window.removeEventListener('pwa-connectivity-change', handleConnectivityChange);
      window.removeEventListener('pwa-installed', handleInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await pwaService.promptInstall();
    } catch (error) {
      console.error('Install failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUpdateClick = async () => {
    try {
      await pwaService.activateUpdate();
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    // Remember dismissal for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  const dismissUpdatePrompt = () => {
    setShowUpdatePrompt(false);
  };

  // Don't show if already dismissed this session
  if (sessionStorage.getItem('pwa-install-dismissed') && showInstallPrompt) {
    return null;
  }

  return (
    <>
      {/* Install Prompt */}
      {showInstallPrompt && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-slide-up">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">📱</span>
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Install Video Conference
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                  Get the full app experience with offline support and push notifications.
                </p>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleInstallClick}
                    disabled={isInstalling}
                    className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors touch-manipulation"
                  >
                    {isInstalling ? 'Installing...' : 'Install App'}
                  </button>
                  <button
                    onClick={dismissInstallPrompt}
                    className="px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors touch-manipulation"
                  >
                    Later
                  </button>
                </div>
              </div>
              
              <button
                onClick={dismissInstallPrompt}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 touch-manipulation"
                aria-label="Dismiss"
              >
                <span className="text-lg">✕</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Prompt */}
      {showUpdatePrompt && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-slide-down">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow-lg border border-green-200 dark:border-green-800 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">↻</span>
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                  Update Available
                </h3>
                <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                  A new version is ready to install with improvements and bug fixes.
                </p>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateClick}
                    className="flex-1 px-3 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors touch-manipulation"
                  >
                    Update Now
                  </button>
                  <button
                    onClick={dismissUpdatePrompt}
                    className="px-3 py-2 text-xs font-medium text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 transition-colors touch-manipulation"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white text-center py-2 text-sm font-medium z-50">
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            You're currently offline
          </span>
        </div>
      )}
    </>
  );
};

export default PWAInstallPrompt;
