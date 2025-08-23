/**
 * Type-safe centralized event bus for decoupled component communication
 * Implements pub/sub pattern with comprehensive TypeScript support
 */

import type { EventMap, EventCallback, EventUnsubscribe } from '../types';

/**
 * Event subscription information
 */
interface EventSubscription<T extends keyof EventMap> {
  readonly callback: EventCallback<T>;
  readonly once: boolean;
  readonly timestamp: number;
  readonly id: string;
}

/**
 * Event bus configuration
 */
interface EventBusConfig {
  readonly enableLogging: boolean;
  readonly maxListeners: number;
  readonly enableMetrics: boolean;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Event metrics for performance monitoring
 */
interface EventMetrics {
  readonly totalEvents: number;
  readonly eventCounts: Map<keyof EventMap, number>;
  readonly averageLatency: number;
  readonly lastEventTime: number;
}

/**
 * Centralized event bus class with full TypeScript support
 */
class TypeSafeEventBus {
  private readonly listeners = new Map<keyof EventMap, Set<EventSubscription<any>>>();
  private readonly config: EventBusConfig;
  private readonly metrics: EventMetrics;
  private subscriptionId = 0;

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = {
      enableLogging: false,
      maxListeners: 100,
      enableMetrics: true,
      logLevel: 'info',
      ...config,
    };

    this.metrics = {
      totalEvents: 0,
      eventCounts: new Map(),
      averageLatency: 0,
      lastEventTime: 0,
    };

    // Enable development mode logging
    if (import.meta.env.DEV) {
      this.config = { ...this.config, enableLogging: true, logLevel: 'debug' };
    }
  }

  /**
   * Subscribe to an event with type safety
   */
  public on<T extends keyof EventMap>(
    event: T,
    callback: EventCallback<T>,
    options: { once?: boolean } = {}
  ): EventUnsubscribe {
    return this.addListener(event, callback, options.once ?? false);
  }

  /**
   * Subscribe to an event that fires only once
   */
  public once<T extends keyof EventMap>(
    event: T,
    callback: EventCallback<T>
  ): EventUnsubscribe {
    return this.addListener(event, callback, true);
  }

  /**
   * Emit an event with type-safe payload
   */
  public emit<T extends keyof EventMap>(event: T, data: EventMap[T]): void {
    const startTime = performance.now();
    
    this.logEvent('emit', event, data);
    this.updateMetrics(event, startTime);

    const eventListeners = this.listeners.get(event);
    if (!eventListeners || eventListeners.size === 0) {
      this.logEvent('warn', event, 'No listeners registered');
      return;
    }

    // Create array to track listeners to remove (for 'once' listeners)
    const toRemove: EventSubscription<T>[] = [];

    // Execute all listeners
    eventListeners.forEach((subscription) => {
      try {
        subscription.callback(data);
        
        if (subscription.once) {
          toRemove.push(subscription);
        }
      } catch (error) {
        this.logEvent('error', event, `Listener error: ${error}`);
        console.error(`Event bus listener error for ${String(event)}:`, error);
      }
    });

    // Remove 'once' listeners
    toRemove.forEach((subscription) => {
      eventListeners.delete(subscription);
    });

    // Clean up empty event listener sets
    if (eventListeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Remove a specific event listener
   */
  public off<T extends keyof EventMap>(event: T, callback: EventCallback<T>): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;

    // Find and remove the subscription with matching callback
    const subscriptionToRemove = Array.from(eventListeners).find(
      (subscription) => subscription.callback === callback
    );

    if (subscriptionToRemove) {
      eventListeners.delete(subscriptionToRemove);
      this.logEvent('debug', event, 'Listener removed');
    }

    // Clean up empty event listener sets
    if (eventListeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Remove all listeners for a specific event
   */
  public removeAllListeners<T extends keyof EventMap>(event?: T): void {
    if (event) {
      this.listeners.delete(event);
      this.logEvent('debug', event, 'All listeners removed');
    } else {
      // Remove all listeners for all events
      this.listeners.clear();
      this.logEvent('debug', 'system', 'All event listeners cleared');
    }
  }

  /**
   * Get the number of listeners for an event
   */
  public listenerCount<T extends keyof EventMap>(event: T): number {
    const eventListeners = this.listeners.get(event);
    return eventListeners ? eventListeners.size : 0;
  }

  /**
   * Get all registered event types
   */
  public getRegisteredEvents(): (keyof EventMap)[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get current metrics
   */
  public getMetrics(): Readonly<EventMetrics> {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    Object.assign(this.metrics, {
      totalEvents: 0,
      eventCounts: new Map(),
      averageLatency: 0,
      lastEventTime: 0,
    });
  }

  /**
   * Check if event bus has listeners for an event
   */
  public hasListeners<T extends keyof EventMap>(event: T): boolean {
    return this.listenerCount(event) > 0;
  }

  /**
   * Create a scoped event emitter that automatically prefixes events
   */
  public createScope<P extends string>(prefix: P) {
    type ScopedEvents = {
      [K in keyof EventMap as `${P}:${string & K}`]: EventMap[K];
    };

    return {
      on: <T extends keyof ScopedEvents>(
        event: T,
        callback: EventCallback<T extends keyof EventMap ? T : never>,
        options?: { once?: boolean }
      ) => this.on(event as keyof EventMap, callback as any, options),

      emit: <T extends keyof ScopedEvents>(
        event: T,
        data: ScopedEvents[T]
      ) => this.emit(event as keyof EventMap, data as any),

      off: <T extends keyof ScopedEvents>(
        event: T,
        callback: EventCallback<T extends keyof EventMap ? T : never>
      ) => this.off(event as keyof EventMap, callback as any),
    };
  }

  /**
   * Create a promise that resolves when an event is emitted
   */
  public waitFor<T extends keyof EventMap>(
    event: T,
    timeout?: number
  ): Promise<EventMap[T]> {
    return new Promise((resolve, reject) => {
      let timeoutId: number | undefined;

      const unsubscribe = this.once(event, (data) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(data);
      });

      if (timeout) {
        timeoutId = window.setTimeout(() => {
          unsubscribe();
          reject(new Error(`Event ${String(event)} timeout after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  /**
   * Add event listener with subscription tracking
   */
  private addListener<T extends keyof EventMap>(
    event: T,
    callback: EventCallback<T>,
    once: boolean
  ): EventUnsubscribe {
    // Check max listeners limit
    const currentCount = this.listenerCount(event);
    if (currentCount >= this.config.maxListeners) {
      console.warn(
        `Maximum listeners (${this.config.maxListeners}) exceeded for event: ${String(event)}`
      );
    }

    // Create subscription
    const subscription: EventSubscription<T> = {
      callback,
      once,
      timestamp: Date.now(),
      id: `sub_${++this.subscriptionId}`,
    };

    // Add to listeners map
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(subscription);

    this.logEvent('debug', event, `Listener added (${once ? 'once' : 'persistent'})`);

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(subscription);
        
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Update event metrics
   */
  private updateMetrics<T extends keyof EventMap>(event: T, startTime: number): void {
    if (!this.config.enableMetrics) return;

    const latency = performance.now() - startTime;
    
    // Update total events
    (this.metrics as any).totalEvents++;
    
    // Update event-specific count
    const currentCount = this.metrics.eventCounts.get(event) || 0;
    (this.metrics.eventCounts as any).set(event, currentCount + 1);
    
    // Update average latency
    const totalEvents = this.metrics.totalEvents;
    (this.metrics as any).averageLatency = 
      (this.metrics.averageLatency * (totalEvents - 1) + latency) / totalEvents;
    
    // Update last event time
    (this.metrics as any).lastEventTime = Date.now();
  }

  /**
   * Log event activity
   */
  private logEvent<T extends keyof EventMap>(
    level: EventBusConfig['logLevel'],
    event: T | 'system',
    message: string | any
  ): void {
    if (!this.config.enableLogging) return;

    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = logLevels[this.config.logLevel];
    const messageLevel = logLevels[level];

    if (messageLevel < configLevel) return;

    const timestamp = new Date().toISOString();
    const prefix = `[EventBus ${timestamp}] ${String(event)}:`;

    switch (level) {
      case 'debug':
        console.debug(prefix, message);
        break;
      case 'info':
        console.info(prefix, message);
        break;
      case 'warn':
        console.warn(prefix, message);
        break;
      case 'error':
        console.error(prefix, message);
        break;
    }
  }
}

// ============================================================================
// Singleton Instance and Utilities
// ============================================================================

/**
 * Global event bus instance
 */
export const eventBus = new TypeSafeEventBus({
  enableLogging: import.meta.env.DEV,
  maxListeners: 50,
  enableMetrics: true,
  logLevel: import.meta.env.DEV ? 'debug' : 'warn',
});

/**
 * Hook for using the event bus in React components
 */
export function useEventBus() {
  return eventBus;
}

/**
 * Decorator for automatic event cleanup in class components
 */
export function withEventCleanup<T extends { new (...args: any[]): any }>(
  constructor: T
) {
  return class extends constructor {
    private eventUnsubscribers: EventUnsubscribe[] = [];

    protected addEventSubscription(unsubscribe: EventUnsubscribe): void {
      this.eventUnsubscribers.push(unsubscribe);
    }

    public componentWillUnmount(): void {
      // Clean up all event subscriptions
      this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe());
      this.eventUnsubscribers = [];

      // Call parent componentWillUnmount if it exists
      if (super.componentWillUnmount) {
        super.componentWillUnmount();
      }
    }
  };
}

/**
 * Utility for creating typed event emitters for specific domains
 */
export function createTypedEventEmitter<T extends Record<string, any>>() {
  return {
    on: <K extends keyof T>(event: K, callback: (data: T[K]) => void) =>
      eventBus.on(event as keyof EventMap, callback as any),
    
    emit: <K extends keyof T>(event: K, data: T[K]) =>
      eventBus.emit(event as keyof EventMap, data as any),
    
    off: <K extends keyof T>(event: K, callback: (data: T[K]) => void) =>
      eventBus.off(event as keyof EventMap, callback as any),
  };
}

// Export the class for potential custom instances
export { TypeSafeEventBus };
export default eventBus;