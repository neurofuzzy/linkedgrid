/**
 * Input Presets Test Suite
 *
 * Tests the three input presets (classic, twin-stick, separated) using HeadlessInputManager.
 * Verifies that movement and aim directions are mapped correctly based on the active preset.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Direction } from '../core/grid/direction';
import { HeadlessInputManager } from '../../spartan-web/input/headless-input-manager';
import type { InputProvider } from '../core/input-provider';

describe('Input Presets', () => {
  let headless: HeadlessInputManager;
  let provider: InputProvider;

  beforeEach(() => {
    headless = new HeadlessInputManager();
    headless.enable();
    provider = headless.asInputProvider();
  });

  describe('Classic Preset', () => {
    beforeEach(() => {
      headless.setPreset('classic');
    });

    it('should use direction for both movement and aim', () => {
      headless.setDirection(Direction.RIGHT);
      provider.beginFrame?.();

      expect(provider.getMoveDirection()).toBe(Direction.RIGHT);
      expect(provider.getAimDirection()).toBe(Direction.RIGHT);
    });

    it('should track last movement direction for aim', () => {
      // Move right, then stop
      headless.setDirection(Direction.RIGHT);
      provider.beginFrame?.();
      provider.getMoveDirection(); // read move direction

      headless.setDirection(Direction.NONE);
      provider.beginFrame?.();

      expect(provider.getMoveDirection()).toBe(Direction.NONE);
      expect(provider.getAimDirection()).toBe(Direction.RIGHT); // Last direction remembered
    });

    it('should update aim when movement changes', () => {
      headless.setDirection(Direction.UP);
      provider.beginFrame?.();
      expect(provider.getAimDirection()).toBe(Direction.UP);

      headless.setDirection(Direction.LEFT);
      provider.beginFrame?.();
      expect(provider.getAimDirection()).toBe(Direction.LEFT);
    });

    it('should not auto-aim (isAiming returns false)', () => {
      headless.setDirection(Direction.RIGHT);
      provider.beginFrame?.();
      expect(provider.isAiming()).toBe(false);
    });

    it('should map primary action correctly', () => {
      headless.setAction(true);
      provider.beginFrame?.();
      expect(provider.getPrimaryAction()).toBe(true);

      headless.setAction(false);
      provider.beginFrame?.();
      expect(provider.getPrimaryAction()).toBe(false);
    });

    it('should map secondary action correctly', () => {
      headless.setSecondary(true);
      provider.beginFrame?.();
      expect(provider.getSecondaryAction()).toBe(true);

      headless.setSecondary(false);
      provider.beginFrame?.();
      expect(provider.getSecondaryAction()).toBe(false);
    });
  });

  describe('Twin-Stick Preset', () => {
    beforeEach(() => {
      headless.setPreset('twin-stick');
    });

    it('should use setMoveDirection for movement', () => {
      headless.setMoveDirection(Direction.UP);
      provider.beginFrame?.();
      expect(provider.getMoveDirection()).toBe(Direction.UP);
    });

    it('should use setAimDirection for aim', () => {
      headless.setAimDirection(Direction.DOWN);
      provider.beginFrame?.();
      expect(provider.getAimDirection()).toBe(Direction.DOWN);
    });

    it('should allow independent movement and aim', () => {
      headless.setMoveDirection(Direction.LEFT);
      headless.setAimDirection(Direction.RIGHT);
      provider.beginFrame?.();

      expect(provider.getMoveDirection()).toBe(Direction.LEFT);
      expect(provider.getAimDirection()).toBe(Direction.RIGHT);
    });

    it('should return isAiming=true when aim direction is set', () => {
      headless.setAimDirection(Direction.NONE);
      provider.beginFrame?.();
      expect(provider.isAiming()).toBe(false);

      headless.setAimDirection(Direction.UP);
      provider.beginFrame?.();
      expect(provider.isAiming()).toBe(true);
    });

    it('should support auto-fire via isAiming', () => {
      // Move without aiming - no auto-fire
      headless.setMoveDirection(Direction.RIGHT);
      headless.setAimDirection(Direction.NONE);
      provider.beginFrame?.();
      expect(provider.isAiming()).toBe(false);

      // Start aiming - auto-fire triggered
      headless.setAimDirection(Direction.LEFT);
      provider.beginFrame?.();
      expect(provider.isAiming()).toBe(true);
      expect(provider.getAimDirection()).toBe(Direction.LEFT);
    });
  });

  describe('Separated Preset', () => {
    beforeEach(() => {
      headless.setPreset('separated');
    });

    it('should use setMoveDirection for movement (arrows)', () => {
      headless.setMoveDirection(Direction.DOWN);
      provider.beginFrame?.();
      expect(provider.getMoveDirection()).toBe(Direction.DOWN);
    });

    it('should use setAimDirection for attack direction (WASD)', () => {
      headless.setAimDirection(Direction.UP);
      provider.beginFrame?.();
      expect(provider.getAimDirection()).toBe(Direction.UP);
    });

    it('should keep movement and aim independent', () => {
      headless.setMoveDirection(Direction.DOWN);
      headless.setAimDirection(Direction.UP);
      provider.beginFrame?.();

      expect(provider.getMoveDirection()).toBe(Direction.DOWN);
      expect(provider.getAimDirection()).toBe(Direction.UP);
    });

    it('should auto-fire when aim direction is set (isAiming returns true)', () => {
      // Separated mode: pressing WASD fires in that direction immediately
      headless.setAimDirection(Direction.RIGHT);
      provider.beginFrame?.();
      expect(provider.isAiming()).toBe(true);

      // No aim direction = not aiming
      headless.setAimDirection(Direction.NONE);
      provider.beginFrame?.();
      expect(provider.isAiming()).toBe(false);
    });

    it('should require primary action for melee', () => {
      headless.setAimDirection(Direction.RIGHT);
      headless.setAction(false);
      provider.beginFrame?.();
      expect(provider.getPrimaryAction()).toBe(false);

      headless.setAction(true);
      provider.beginFrame?.();
      expect(provider.getPrimaryAction()).toBe(true);
    });

    it('should require secondary action for ranged', () => {
      headless.setAimDirection(Direction.RIGHT);
      headless.setSecondary(false);
      provider.beginFrame?.();
      expect(provider.getSecondaryAction()).toBe(false);

      headless.setSecondary(true);
      provider.beginFrame?.();
      expect(provider.getSecondaryAction()).toBe(true);
    });
  });

  describe('Preset Switching', () => {
    it('should reset aim tracking when switching to classic', () => {
      headless.setPreset('twin-stick');
      headless.setAimDirection(Direction.LEFT);
      provider.beginFrame?.();

      headless.setPreset('classic');
      // After switching, aim should follow movement again
      headless.setDirection(Direction.RIGHT);
      provider.beginFrame?.();
      expect(provider.getAimDirection()).toBe(Direction.RIGHT);
    });

    it('should handle switching from classic to twin-stick', () => {
      headless.setPreset('classic');
      headless.setDirection(Direction.UP);
      provider.beginFrame?.();

      headless.setPreset('twin-stick');
      headless.setMoveDirection(Direction.DOWN);
      headless.setAimDirection(Direction.LEFT);
      provider.beginFrame?.();

      expect(provider.getMoveDirection()).toBe(Direction.DOWN);
      expect(provider.getAimDirection()).toBe(Direction.LEFT);
    });

    it('should handle switching from separated to classic', () => {
      headless.setPreset('separated');
      headless.setMoveDirection(Direction.RIGHT);
      headless.setAimDirection(Direction.LEFT);
      provider.beginFrame?.();

      headless.setPreset('classic');
      headless.setDirection(Direction.UP);
      provider.beginFrame?.();

      expect(provider.getMoveDirection()).toBe(Direction.UP);
      expect(provider.getAimDirection()).toBe(Direction.UP);
    });
  });

  describe('State Management', () => {
    it('should clear all input on clearInput()', () => {
      headless.setPreset('twin-stick');
      headless.setMoveDirection(Direction.UP);
      headless.setAimDirection(Direction.DOWN);
      headless.setAction(true);
      headless.setSecondary(true);
      provider.beginFrame?.();

      headless.clearInput();
      provider.beginFrame?.();

      expect(provider.getMoveDirection()).toBe(Direction.NONE);
      expect(provider.getAimDirection()).toBe(Direction.NONE);
      expect(provider.getPrimaryAction()).toBe(false);
      expect(provider.getSecondaryAction()).toBe(false);
    });

    it('should consume one-shot inputs (start, restart) per frame', () => {
      // One-shot inputs are consumed when beginFrame() is called
      headless.pressStart();

      // First frame: start is true
      provider.beginFrame?.();
      expect(provider.getStart()).toBe(true);
      expect(provider.getStart()).toBe(true); // Same frame, still true

      // Second frame: start is consumed
      provider.beginFrame?.();
      expect(provider.getStart()).toBe(false); // Consumed in previous frame

      headless.pressRestart();

      // First frame: restart is true
      provider.beginFrame?.();
      expect(provider.getRestart()).toBe(true);

      // Second frame: restart is consumed
      provider.beginFrame?.();
      expect(provider.getRestart()).toBe(false);
    });

    it('should return empty state when disabled', () => {
      headless.setPreset('twin-stick');
      headless.setMoveDirection(Direction.UP);
      headless.setAimDirection(Direction.DOWN);
      headless.setAction(true);
      provider.beginFrame?.();

      headless.disable();
      provider.beginFrame?.();

      expect(provider.getMoveDirection()).toBe(Direction.NONE);
      expect(provider.getAimDirection()).toBe(Direction.NONE);
      expect(provider.getPrimaryAction()).toBe(false);
    });
  });

  describe('getPreset()', () => {
    it('should return current preset', () => {
      headless.setPreset('classic');
      expect(headless.getPreset()).toBe('classic');

      headless.setPreset('twin-stick');
      expect(headless.getPreset()).toBe('twin-stick');

      headless.setPreset('separated');
      expect(headless.getPreset()).toBe('separated');
    });

    it('should default to classic', () => {
      const fresh = new HeadlessInputManager();
      expect(fresh.getPreset()).toBe('classic');
    });
  });
});
