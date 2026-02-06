/**
 * VisualEventBus - Lightweight pub/sub for visual events.
 *
 * Platform-agnostic event emitter that bridges game logic to view layers.
 * No DOM dependencies. View layers subscribe to events they care about.
 *
 * Two consumption models:
 * - Push: Subscribe via on() for real-time notifications
 * - Pull: Use getDirtyEntities() on VisualStateSystem for polling
 *
 * Lifecycle:
 * - Created once, stored on GameManager (persists across scenes)
 * - View layers subscribe on init, unsubscribe on destroy
 * - clear() removes all listeners (for cleanup/testing)
 *
 * @example
 * ```typescript
 * const bus = new VisualEventBus();
 *
 * // Subscribe
 * const unsub = bus.on('entity:moved', (event) => {
 *   tweenManager.moveTo(String(event.entityId), event.data.toX, event.data.toY);
 * });
 *
 * // Emit (from systems)
 * bus.emit({
 *   type: 'entity:moved',
 *   entityId: 42,
 *   data: { fromX: 5, fromY: 5, toX: 6, toY: 5 }
 * });
 *
 * // Cleanup
 * unsub();
 * ```
 */

/**
 * Visual event types emitted by the visual system.
 */
export type VisualEventType =
  | 'entity:moved'
  | 'entity:state-changed'
  | 'entity:damaged'
  | 'entity:died'
  | 'entity:spawned'
  | 'entity:removed'
  | 'scene:transition'
  | 'effect:request';

/**
 * Visual event payload.
 *
 * All fields except type are optional -- events carry only what is relevant.
 */
export interface VisualEvent {
  /** Event type */
  type: VisualEventType;
  /** Entity involved (if applicable) */
  entityId?: number;
  /** Position (if applicable) */
  x?: number;
  /** Position (if applicable) */
  y?: number;
  /** Additional event-specific data */
  data?: Record<string, unknown>;
}

type VisualEventCallback = (event: VisualEvent) => void;

/**
 * VisualEventBus - Minimal pub/sub for visual events.
 *
 * No wildcard subscriptions. Each listener is bound to a specific event type.
 * Returns unsubscribe function from on() for clean teardown.
 */
export class VisualEventBus {
  private listeners: Map<VisualEventType, Set<VisualEventCallback>> = new Map();

  /**
   * Subscribe to a visual event type.
   *
   * @param type - Event type to listen for
   * @param callback - Function called when event is emitted
   * @returns Unsubscribe function
   */
  on(type: VisualEventType, callback: VisualEventCallback): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(callback);

    // Return unsubscribe function
    return () => {
      set!.delete(callback);
      if (set!.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  /**
   * Emit a visual event to all subscribers of that type.
   *
   * @param event - Event to emit
   */
  emit(event: VisualEvent): void {
    const set = this.listeners.get(event.type);
    if (!set) return;
    for (const callback of set) {
      callback(event);
    }
  }

  /**
   * Get the number of listeners for a specific event type.
   *
   * @param type - Event type
   * @returns Number of listeners
   */
  listenerCount(type: VisualEventType): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  /**
   * Remove all listeners for all event types.
   * Use for cleanup or testing.
   */
  clear(): void {
    this.listeners.clear();
  }
}
