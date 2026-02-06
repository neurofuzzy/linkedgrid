/**
 * VisualEventBus Tests
 *
 * Tests for the lightweight pub/sub event system.
 */
import { describe, it, expect, vi } from 'vitest';
import { VisualEventBus } from '../core/visual-event-bus';
import type { VisualEvent } from '../core/visual-event-bus';

describe('VisualEventBus', () => {
  it('should emit events to subscribers', () => {
    // Arrange
    const bus = new VisualEventBus();
    const callback = vi.fn();
    bus.on('entity:moved', callback);

    // Act
    bus.emit({ type: 'entity:moved', entityId: 1, x: 5, y: 5 });

    // Assert
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      type: 'entity:moved',
      entityId: 1,
      x: 5,
      y: 5,
    });
  });

  it('should not call subscribers of other event types', () => {
    // Arrange
    const bus = new VisualEventBus();
    const movedCb = vi.fn();
    const damagedCb = vi.fn();
    bus.on('entity:moved', movedCb);
    bus.on('entity:damaged', damagedCb);

    // Act
    bus.emit({ type: 'entity:moved', entityId: 1 });

    // Assert
    expect(movedCb).toHaveBeenCalledTimes(1);
    expect(damagedCb).not.toHaveBeenCalled();
  });

  it('should support multiple subscribers for the same event', () => {
    // Arrange
    const bus = new VisualEventBus();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bus.on('entity:died', cb1);
    bus.on('entity:died', cb2);

    // Act
    bus.emit({ type: 'entity:died', entityId: 42 });

    // Assert
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('should return unsubscribe function', () => {
    // Arrange
    const bus = new VisualEventBus();
    const callback = vi.fn();
    const unsub = bus.on('entity:spawned', callback);

    // Act
    bus.emit({ type: 'entity:spawned', entityId: 1 });
    unsub();
    bus.emit({ type: 'entity:spawned', entityId: 2 });

    // Assert
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should clear all listeners', () => {
    // Arrange
    const bus = new VisualEventBus();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bus.on('entity:moved', cb1);
    bus.on('entity:died', cb2);

    // Act
    bus.clear();
    bus.emit({ type: 'entity:moved', entityId: 1 });
    bus.emit({ type: 'entity:died', entityId: 2 });

    // Assert
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  it('should report listener count', () => {
    // Arrange
    const bus = new VisualEventBus();

    // Act
    const unsub1 = bus.on('entity:moved', () => {});
    bus.on('entity:moved', () => {});
    bus.on('entity:died', () => {});

    // Assert
    expect(bus.listenerCount('entity:moved')).toBe(2);
    expect(bus.listenerCount('entity:died')).toBe(1);
    expect(bus.listenerCount('entity:spawned')).toBe(0);

    // After unsubscribe
    unsub1();
    expect(bus.listenerCount('entity:moved')).toBe(1);
  });

  it('should pass event data correctly', () => {
    // Arrange
    const bus = new VisualEventBus();
    let received: VisualEvent | null = null;
    bus.on('entity:state-changed', (event) => {
      received = event;
    });

    // Act
    bus.emit({
      type: 'entity:state-changed',
      entityId: 10,
      data: { previousState: 'idle', newState: 'walk' },
    });

    // Assert
    expect(received).not.toBeNull();
    expect(received!.entityId).toBe(10);
    expect(received!.data?.previousState).toBe('idle');
    expect(received!.data?.newState).toBe('walk');
  });

  it('should handle emit with no subscribers gracefully', () => {
    // Arrange
    const bus = new VisualEventBus();

    // Act + Assert (should not throw)
    expect(() => {
      bus.emit({ type: 'entity:moved', entityId: 1 });
    }).not.toThrow();
  });
});
