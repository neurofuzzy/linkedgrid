/**
 * EffectsQueue - Platform-agnostic effect request queue.
 *
 * Systems push visual effect requests during tick processing.
 * View layers drain the queue each frame to apply effects.
 *
 * If no view layer is attached, effects accumulate silently
 * and can be drained later or cleared.
 *
 * @example
 * ```typescript
 * // In a system (e.g. ExplosionSystem):
 * effectsQueue.push({ type: 'shake', intensity: 8, durationMs: 300 });
 * effectsQueue.push({ type: 'particle', x: 5, y: 5, preset: 'explosion' });
 *
 * // In a renderer's frame loop:
 * const effects = effectsQueue.drain();
 * for (const fx of effects) {
 *   switch (fx.type) {
 *     case 'shake':
 *       renderer.shake(fx.intensity, fx.durationMs);
 *       break;
 *     case 'particle':
 *       renderer.emit(fx.x, fx.y, fx.preset, fx.color);
 *       break;
 *   }
 * }
 * ```
 */

/**
 * Screen shake effect.
 */
export interface ShakeEffect {
  type: 'shake';
  /** Shake intensity in pixels */
  intensity: number;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Screen flash overlay effect.
 */
export interface FlashEffect {
  type: 'flash';
  /** Flash color (CSS color string) */
  color: string;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Particle burst effect at a grid position.
 */
export interface ParticleEffect {
  type: 'particle';
  /** Grid X position (can be fractional) */
  x: number;
  /** Grid Y position (can be fractional) */
  y: number;
  /** Particle preset name (e.g. 'explosion', 'spark', 'blood') */
  preset: string;
  /** Optional color override */
  color?: string;
}

/**
 * Area effect at a grid position (e.g. explosion ring, shockwave).
 */
export interface AreaEffect {
  type: 'area';
  /** Center grid X position */
  x: number;
  /** Center grid Y position */
  y: number;
  /** Effect radius in cells */
  radius: number;
  /** Effect type identifier */
  effectType: string;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Union of all visual effect types.
 */
export type VisualEffect = ShakeEffect | FlashEffect | ParticleEffect | AreaEffect;

/**
 * EffectsQueue - FIFO queue for visual effect requests.
 *
 * Thread-safe for single-threaded game loop usage:
 * systems push during tick, renderer drains between frames.
 */
export class EffectsQueue {
  private queue: VisualEffect[] = [];

  /**
   * Push an effect request onto the queue.
   *
   * @param effect - Effect descriptor
   */
  push(effect: VisualEffect): void {
    this.queue.push(effect);
  }

  /**
   * Drain all queued effects, returning them and clearing the queue.
   *
   * Call this once per frame in the view layer.
   *
   * @returns Array of effect descriptors (may be empty)
   */
  drain(): VisualEffect[] {
    if (this.queue.length === 0) return [];
    const effects = this.queue;
    this.queue = [];
    return effects;
  }

  /**
   * Peek at queued effects without removing them.
   *
   * @returns Read-only view of the queue
   */
  peek(): ReadonlyArray<VisualEffect> {
    return this.queue;
  }

  /**
   * Get the number of queued effects.
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Clear all queued effects without processing them.
   */
  clear(): void {
    this.queue = [];
  }
}
