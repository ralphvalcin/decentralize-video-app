// PWA Service Worker Registration and Management
class PWAService {
  constructor() {
    this.registration = null;
    this.isOnline = navigator.onLine;
    this.installPrompt = null;
    this.updateAvailable = false;
    
    this.setupOnlineOfflineHandlers();
    this.setupBeforeInstallPrompt();
  }

  async register() {
    if ('serviceWorker' in navigator) {
      try {
        console.log('[PWA] Registering service worker...');
        
        this.registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        console.log('[PWA] Service worker registered:', this.registration);

        // Listen for updates
        this.registration.addEventListener('updatefound', () => {
          this.handleUpdateFound();
        });

        // Check for updates periodically
        setInterval(() => {
          this.checkForUpdates();
        }, 60000); // Check every minute

        return this.registration;
      } catch (error) {
        console.error('[PWA] Service worker registration failed:', error);
        throw error;
      }
    } else {
      console.warn('[PWA] Service workers not supported');
      return null;
    }
  }

  handleUpdateFound() {
    console.log('[PWA] Update found');
    const newWorker = this.registration.installing;

    if (newWorker) {
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[PWA] New content available');
          this.updateAvailable = true;
          this.notifyUpdateAvailable();
        }
      });
    }
  }

  async checkForUpdates() {
    if (this.registration) {
      try {
        await this.registration.update();
      } catch (error) {
        console.error('[PWA] Update check failed:', error);
      }
    }
  }

  notifyUpdateAvailable() {
    // Dispatch custom event for update notification
    const event = new CustomEvent('pwa-update-available', {
      detail: { registration: this.registration }
    });
    window.dispatchEvent(event);
  }

  async activateUpdate() {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  setupOnlineOfflineHandlers() {
    window.addEventListener('online', () => {
      console.log('[PWA] Back online');
      this.isOnline = true;
      this.dispatchConnectivityEvent('online');
    });

    window.addEventListener('offline', () => {
      console.log('[PWA] Gone offline');
      this.isOnline = false;
      this.dispatchConnectivityEvent('offline');
    });
  }

  dispatchConnectivityEvent(status) {
    const event = new CustomEvent('pwa-connectivity-change', {
      detail: { isOnline: this.isOnline, status }
    });
    window.dispatchEvent(event);
  }

  setupBeforeInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] Install prompt available');
      e.preventDefault();
      this.installPrompt = e;
      
      // Dispatch event for install button
      const event = new CustomEvent('pwa-install-available', {
        detail: { prompt: this.installPrompt }
      });
      window.dispatchEvent(event);
    });

    // Handle successful installation
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed');
      this.installPrompt = null;
      
      const event = new CustomEvent('pwa-installed');
      window.dispatchEvent(event);
    });
  }

  async promptInstall() {
    if (this.installPrompt) {
      try {
        const result = await this.installPrompt.prompt();
        console.log('[PWA] Install prompt result:', result);
        
        if (result.outcome === 'accepted') {
          console.log('[PWA] User accepted install');
        } else {
          console.log('[PWA] User dismissed install');
        }
        
        this.installPrompt = null;
        return result;
      } catch (error) {
        console.error('[PWA] Install prompt failed:', error);
        throw error;
      }
    }
    return null;
  }

  canInstall() {
    return this.installPrompt !== null;
  }

  isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  // Notification permissions and setup
  async requestNotificationPermission() {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        console.log('[PWA] Notification permission:', permission);
        return permission;
      } catch (error) {
        console.error('[PWA] Notification permission failed:', error);
        throw error;
      }
    }
    return 'not-supported';
  }

  async showNotification(title, options = {}) {
    if (this.registration && Notification.permission === 'granted') {
      try {
        await this.registration.showNotification(title, {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          vibrate: [200, 100, 200],
          ...options
        });
      } catch (error) {
        console.error('[PWA] Show notification failed:', error);
        throw error;
      }
    }
  }

  // Background sync for offline actions
  async registerBackgroundSync(tag) {
    if (this.registration && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        await this.registration.sync.register(tag);
        console.log('[PWA] Background sync registered:', tag);
      } catch (error) {
        console.error('[PWA] Background sync registration failed:', error);
        throw error;
      }
    }
  }

  // Cache management
  async precacheResources(urls) {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_URLS',
        payload: urls
      });
    }
  }

  // Performance metrics
  getNetworkInfo() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      };
    }
    return null;
  }

  // Device capabilities
  getDeviceCapabilities() {
    return {
      touchSupport: 'ontouchstart' in window,
      deviceMemory: navigator.deviceMemory || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
      maxTouchPoints: navigator.maxTouchPoints || 0,
      standalone: this.isInstalled(),
      online: this.isOnline
    };
  }
}

// Create singleton instance
const pwaService = new PWAService();

// Auto-register when module loads
pwaService.register().catch(console.error);

export default pwaService;