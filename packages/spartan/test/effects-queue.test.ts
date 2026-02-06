/**
 * EffectsQueue Tests
 *
 * Tests for the platform-agnostic visual effect request queue.
 */
import { describe, it, expect } from 'vitest';
import { EffectsQueue } from '../core/effects-queue';
import type { VisualEffect } from '../core/effects-queue';

describe('EffectsQueue', () => {
  it('should start empty', () => {
    // Arrange
    const queue = new EffectsQueue();

    // Assert
    expect(queue.length).toBe(0);
    expect(queue.drain()).toEqual([]);
  });

  it('should push and drain effects', () => {
    // Arrange
    const queue = new EffectsQueue();
    const shake: VisualEffect = { type: 'shake', intensity: 8, durationMs: 300 };
    const flash: VisualEffect = { type: 'flash', color: '#ff0000', durationMs: 200 };

    // Act
    queue.push(shake);
    queue.push(flash);

    // Assert
    expect(queue.length).toBe(2);
    const drained = queue.drain();
    expect(drained).toHaveLength(2);
    expect(drained[0]).toEqual(shake);
    expect(drained[1]).toEqual(flash);

    // Queue should be empty after drain
    expect(queue.length).toBe(0);
    expect(queue.drain()).toEqual([]);
  });

  it('should peek without removing', () => {
    // Arrange
    const queue = new EffectsQueue();
    queue.push({ type: 'shake', intensity: 5, durationMs: 100 });

    // Act
    const peeked = queue.peek();

    // Assert
    expect(peeked).toHaveLength(1);
    expect(queue.length).toBe(1); // Still there
  });

  it('should clear all effects', () => {
    // Arrange
    const queue = new EffectsQueue();
    queue.push({ type: 'shake', intensity: 5, durationMs: 100 });
    queue.push({ type: 'flash', color: '#fff', durationMs: 100 });

    // Act
    queue.clear();

    // Assert
    expect(queue.length).toBe(0);
  });

  it('should handle particle effects', () => {
    // Arrange
    const queue = new EffectsQueue();
    const particle: VisualEffect = {
      type: 'particle',
      x: 5,
      y: 3,
      preset: 'explosion',
      color: '#ff6600',
    };

    // Act
    queue.push(particle);
    const drained = queue.drain();

    // Assert
    expect(drained).toHaveLength(1);
    expect(drained[0].type).toBe('particle');
    if (drained[0].type === 'particle') {
      expect(drained[0].x).toBe(5);
      expect(drained[0].y).toBe(3);
      expect(drained[0].preset).toBe('explosion');
      expect(drained[0].color).toBe('#ff6600');
    }
  });

  it('should handle area effects', () => {
    // Arrange
    const queue = new EffectsQueue();
    const area: VisualEffect = {
      type: 'area',
      x: 10,
      y: 10,
      radius: 3,
      effectType: 'shockwave',
      durationMs: 500,
    };

    // Act
    queue.push(area);
    const drained = queue.drain();

    // Assert
    expect(drained).toHaveLength(1);
    expect(drained[0].type).toBe('area');
    if (drained[0].type === 'area') {
      expect(drained[0].radius).toBe(3);
      expect(drained[0].effectType).toBe('shockwave');
    }
  });

  it('should preserve FIFO order', () => {
    // Arrange
    const queue = new EffectsQueue();

    // Act
    queue.push({ type: 'shake', intensity: 1, durationMs: 100 });
    queue.push({ type: 'flash', color: '#f00', durationMs: 100 });
    queue.push({ type: 'shake', intensity: 2, durationMs: 200 });

    const drained = queue.drain();

    // Assert
    expect(drained[0].type).toBe('shake');
    expect(drained[1].type).toBe('flash');
    expect(drained[2].type).toBe('shake');
    if (drained[0].type === 'shake' && drained[2].type === 'shake') {
      expect(drained[0].intensity).toBe(1);
      expect(drained[2].intensity).toBe(2);
    }
  });

  it('should support multiple drain cycles', () => {
    // Arrange
    const queue = new EffectsQueue();

    // Cycle 1
    queue.push({ type: 'shake', intensity: 5, durationMs: 100 });
    const d1 = queue.drain();
    expect(d1).toHaveLength(1);

    // Cycle 2 -- empty
    const d2 = queue.drain();
    expect(d2).toHaveLength(0);

    // Cycle 3 -- new effects
    queue.push({ type: 'flash', color: '#fff', durationMs: 200 });
    const d3 = queue.drain();
    expect(d3).toHaveLength(1);
    expect(d3[0].type).toBe('flash');
  });
});
