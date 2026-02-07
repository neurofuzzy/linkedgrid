/**
 * Unit tests for FreeBodyStore.
 *
 * Tests:
 * - Registration and position tracking
 * - Position updates
 * - Cell snapping for collision detection
 * - Removal and cleanup
 * - Edge cases
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FreeBodyStore } from '../core/free-body-store';

describe('FreeBodyStore', () => {
  let store: FreeBodyStore;

  beforeEach(() => {
    store = new FreeBodyStore();
  });

  describe('register / getPosition', () => {
    it('stores float position on register', () => {
      store.register(1, 5.3, 7.8);
      const pos = store.getPosition(1);
      expect(pos).toEqual({ x: 5.3, y: 7.8 });
    });

    it('returns null for unregistered entity', () => {
      expect(store.getPosition(999)).toBeNull();
    });

    it('tracks multiple entities independently', () => {
      store.register(1, 1.0, 2.0);
      store.register(2, 3.5, 4.5);

      expect(store.getPosition(1)).toEqual({ x: 1.0, y: 2.0 });
      expect(store.getPosition(2)).toEqual({ x: 3.5, y: 4.5 });
    });
  });

  describe('setPosition', () => {
    it('updates position of registered entity', () => {
      store.register(1, 5.0, 5.0);
      store.setPosition(1, 6.2, 5.8);
      expect(store.getPosition(1)).toEqual({ x: 6.2, y: 5.8 });
    });

    it('is a no-op for unregistered entity', () => {
      store.setPosition(999, 1.0, 1.0);
      expect(store.getPosition(999)).toBeNull();
    });

    it('mutates position in place (same reference)', () => {
      store.register(1, 5.0, 5.0);
      const pos1 = store.getPosition(1);
      store.setPosition(1, 6.0, 7.0);
      const pos2 = store.getPosition(1);
      // Should be same object reference (mutable update)
      expect(pos1).toBe(pos2);
      expect(pos1!.x).toBe(6.0);
      expect(pos1!.y).toBe(7.0);
    });
  });

  describe('getCellXY', () => {
    it('floors to containing cell (world-space)', () => {
      store.register(1, 5.3, 7.8);
      expect(store.getCellXY(1)).toEqual({ x: 5, y: 7 });
    });

    it('floors 0.5 to same cell', () => {
      store.register(1, 2.5, 3.5);
      expect(store.getCellXY(1)).toEqual({ x: 2, y: 3 });
    });

    it('handles exact integers', () => {
      store.register(1, 10, 20);
      expect(store.getCellXY(1)).toEqual({ x: 10, y: 20 });
    });

    it('handles negative positions', () => {
      store.register(1, -1.3, -1.7);
      expect(store.getCellXY(1)).toEqual({ x: -2, y: -2 });
    });

    it('returns null for unregistered entity', () => {
      expect(store.getCellXY(999)).toBeNull();
    });
  });

  describe('has', () => {
    it('returns true for registered entity', () => {
      store.register(1, 0, 0);
      expect(store.has(1)).toBe(true);
    });

    it('returns false for unregistered entity', () => {
      expect(store.has(999)).toBe(false);
    });

    it('returns false after removal', () => {
      store.register(1, 0, 0);
      store.remove(1);
      expect(store.has(1)).toBe(false);
    });
  });

  describe('remove', () => {
    it('removes entity from tracking', () => {
      store.register(1, 5.0, 5.0);
      store.remove(1);
      expect(store.getPosition(1)).toBeNull();
      expect(store.size).toBe(0);
    });

    it('is safe to call on non-existent entity', () => {
      store.remove(999); // Should not throw
      expect(store.size).toBe(0);
    });
  });

  describe('entries', () => {
    it('iterates all registered entities', () => {
      store.register(1, 1.0, 2.0);
      store.register(2, 3.0, 4.0);
      store.register(3, 5.0, 6.0);

      const entries = [...store.entries()];
      expect(entries).toHaveLength(3);
      expect(entries.map(([id]) => id).sort()).toEqual([1, 2, 3]);
    });

    it('is empty for new store', () => {
      expect([...store.entries()]).toHaveLength(0);
    });
  });

  describe('size', () => {
    it('starts at 0', () => {
      expect(store.size).toBe(0);
    });

    it('increments on register', () => {
      store.register(1, 0, 0);
      expect(store.size).toBe(1);
      store.register(2, 0, 0);
      expect(store.size).toBe(2);
    });

    it('decrements on remove', () => {
      store.register(1, 0, 0);
      store.register(2, 0, 0);
      store.remove(1);
      expect(store.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all entities', () => {
      store.register(1, 1.0, 2.0);
      store.register(2, 3.0, 4.0);
      store.clear();
      expect(store.size).toBe(0);
      expect(store.getPosition(1)).toBeNull();
      expect(store.getPosition(2)).toBeNull();
    });
  });

  describe('concurrent projectile simulation', () => {
    it('allows multiple entities at the same position', () => {
      // Two projectiles at same cell -- this is the key advantage of free bodies
      store.register(1, 5.0, 10.0);
      store.register(2, 5.0, 10.0);

      expect(store.getPosition(1)).toEqual({ x: 5.0, y: 10.0 });
      expect(store.getPosition(2)).toEqual({ x: 5.0, y: 10.0 });
      expect(store.size).toBe(2);
    });

    it('updates positions independently', () => {
      store.register(1, 5.0, 5.0);
      store.register(2, 5.0, 5.0);

      store.setPosition(1, 6.0, 5.0); // Move right
      store.setPosition(2, 5.0, 6.0); // Move down

      expect(store.getPosition(1)).toEqual({ x: 6.0, y: 5.0 });
      expect(store.getPosition(2)).toEqual({ x: 5.0, y: 6.0 });
    });
  });
});
