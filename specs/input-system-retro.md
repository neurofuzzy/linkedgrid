# Input System Refactor Retrospective

**Date**: February 5, 2026

## Summary

The input system was refactored to support multiple input presets (classic, twin-stick, separated) for different game styles. The work encountered significant challenges, required multiple iterations, and ultimately needed architectural restructuring to stabilize.

## What Went Well

1. **Final architecture is clean**: The separation between InputManager (raw capture) and WebInputProvider (preset interpretation) provides clear responsibilities.

2. **Comprehensive test coverage**: 25 input preset tests plus combat gameplay tests ensure the system works correctly.

3. **HeadlessInputManager**: Programmatic input control enables reliable automated testing.

4. **HUD improvements**: Weapon/ammo display with MELEE fallback provides better player feedback.

## What Went Wrong

### 1. Over-engineering InputManager

**Problem**: Initial approach added preset logic, separate arrow/WASD direction tracking, and complex state management directly to InputManager.

**Impact**: This introduced regressions including dropped keypresses, which broke the core input loop.

**Root Cause**: Mixing concerns - raw input capture and preset interpretation are separate responsibilities.

**Lesson**: InputManager should remain a stable, well-tested component. Complex mapping logic belongs in a separate layer.

### 2. Inconsistent keysJustPressed vs keysDown Handling

**Problem**: `direction` checked both `keysJustPressed` AND `keysDown`, but `shootDirection` only checked `keysDown`. When WASD was tapped quickly:
- `direction` = UP (from keysJustPressed)
- `shootDirection` = NONE (keysDown empty after keyup)
- Result: WebInputProvider thought arrows were pressed, causing unwanted movement.

**Impact**: WASD caused player movement in separated mode.

**Fix**: Added `getWasdDirection()` method that checks both `keysJustPressed` and `keysDown`, matching `getCurrentDirection()` behavior.

**Lesson**: Related state properties must use consistent derivation logic.

### 3. Missing Spawn Cell in Projectile Path

**Problem**: `LinkedCellUtils.getLine()` excludes the start cell by design. Projectiles spawned one cell ahead of the player, but their path didn't include that spawn position.

**Impact**: Enemies at the spawn cell were skipped, appearing as "projectiles passing through adjacent enemies."

**Fix**: Prepend spawn cell to path in `initializePath()`.

**Lesson**: Verify edge cases at boundaries - the first and last elements of paths/ranges are often where bugs hide.

### 4. Melee Direction Initialization

**Problem**: `MeleeSystem.lastPlayerDirection` initialized to `NONE`. Player couldn't melee until they aimed first.

**Impact**: Melee didn't work at game start.

**Fix**: Default to `Direction.DOWN` and add `isAiming()` check for separated mode WASD-triggered melee.

**Lesson**: Consider the "cold start" case - what happens before any input is received?

### 5. GameEmbed Not Applying Preset

**Problem**: WebInputProvider was created but `setPreset()` wasn't called with the config value.

**Impact**: Preset was always 'classic' even when config specified 'separated'.

**Fix**: Added explicit `setPreset(config.preset)` call in GameEmbed.

**Lesson**: When adding configuration, trace the full path from JSON → config → component to ensure it's wired correctly.

## Architectural Insights

### The InputManager Contract

The "WORKING" InputManager from the develop branch established a stable contract:

```typescript
// What InputManager provides:
{
  direction: Direction;       // Combined input from any directional key
  shootDirection: Direction;  // WASD-only direction
  action: boolean;           // Space/Enter/click
  secondary: boolean;        // Shift/right-click
  // ... other raw state
}

// Critical behavior:
// - getState() clears one-shot events (keysJustPressed, actionKeyPressed)
// - direction checks keysJustPressed before keysDown
// - shootDirection must also check keysJustPressed for consistency
```

### WebInputProvider's Heuristic

Separated mode must distinguish "only WASD pressed" from "only arrows pressed". The heuristic:

```typescript
if (shootDirection !== NONE && direction === shootDirection) {
  // WASD is pressed, direction came from WASD
  return NONE; // No movement
}
if (shootDirection !== NONE && direction !== shootDirection) {
  // Both pressed with different directions - arrows win for movement
  return direction;
}
// shootDirection is NONE - direction came from arrows (or nothing)
return direction;
```

This works IF shootDirection correctly captures WASD even on quick taps.

## Recommendations for Future Work

1. **Don't touch InputManager**: It's stable. Add new capabilities to WebInputProvider or create new providers.

2. **Test input edge cases**: Quick taps, simultaneous keys, key release timing.

3. **Document the "why"**: Comments explaining *why* keysJustPressed matters prevent future regressions.

4. **Integration tests for demos**: Add tests that actually load demo JSON and verify player can move/attack.

## Files Changed

| Category | Files |
|----------|-------|
| Core Input | `input-manager.ts`, `web-input-provider.ts`, `input-provider.ts` |
| Systems | `melee.system.ts`, `player-weapon.system.ts`, `projectile.system.ts` |
| Config | `game-embed.ts`, `game-runtime.ts` |
| UI | `grid-renderer.tsx` (HUD) |
| Tests | `input-presets.test.ts`, `combat-gameplay.test.ts` |

## Metrics

- Tests: 428 passing, 2 skipped
- Bugs fixed: 4 (WASD movement, melee start, HUD display, projectile collision)
- Architecture reverts: 1 (InputManager reset to WORKING version)
- Spec updates: 2 (input-system-refactor.md, this retro)
