# Input System Refactor

## Overview

The Input System has been refactored to support multiple input presets for different game styles. The system separates raw input from mapped intent, allowing games to configure how keyboard/gamepad inputs map to movement and combat actions.

## Input Presets

| Preset | Move | Aim | Primary Action | Secondary Action | Notes |
|--------|------|-----|----------------|------------------|-------|
| `classic` | Arrow keys + WASD | Last move direction | Space/Enter | Shift | Traditional arcade style |
| `twin-stick` | Arrow keys / LStick | WASD / RStick | Space/Enter | Shift | Auto-fires when aiming |
| `separated` | Arrow keys | WASD | Space (melee) | Shift (fire) | Separate move and attack directions |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Input Devices  │────▶│  InputManager   │────▶│ InputProvider   │
│  Keyboard/      │     │  Raw state +    │     │ v2 Interface    │
│  Gamepad/Mouse  │     │  Preset mapping │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                            ┌─────────────────────┐
                                            │   Game Systems      │
                                            │ • PlayerInputSystem │
                                            │ • MeleeSystem       │
                                            │ • PlayerWeaponSystem│
                                            └─────────────────────┘
```

## API Reference

### InputProvider Interface

```typescript
interface InputProvider {
  getMoveDirection(): Direction;    // Movement input
  getAimDirection(): Direction;     // Aiming/attack direction
  getPrimaryAction(): boolean;      // Space/Enter/A button
  getSecondaryAction(): boolean;    // Shift/B button
  getStart(): boolean;              // Start/pause
  getRestart(): boolean;            // Restart
  isAiming(): boolean;              // Twin-stick auto-fire detection
}

type InputPreset = 'classic' | 'twin-stick' | 'separated';
```

### InputManager Additions

- `arrowDirection` / `wasdDirection` - Separated raw input channels
- `moveDirection` / `aimDirection` - Mapped based on preset
- `setPreset(preset: InputPreset)` - Change preset at runtime
- `getPreset()` - Get current preset

### HeadlessInputManager

For testing and headless environments:

```typescript
const headless = new HeadlessInputManager();
headless.enable();
headless.setPreset('twin-stick');

// Control input programmatically
headless.setMoveDirection(Direction.UP);
headless.setAimDirection(Direction.RIGHT);
headless.setAction(true);

// Get InputProvider interface
const provider = headless.asInputProvider();
```

## Game Configuration

### JSON Config

```json
{
  "input": {
    "type": "keyboard",
    "preset": "separated",
    "options": {
      "directionMode": "continuous"
    }
  }
}
```

### GameEmbed Config

```typescript
const embed = new GameEmbed(container, {
  input: {
    type: 'keyboard',
    preset: 'twin-stick'
  }
});
```

## System Integration

### PlayerInputSystem
Uses `getMoveDirection()` for player movement.

### MeleeSystem
- Uses `getAimDirection()` for attack direction
- Uses `getPrimaryAction()` for melee trigger

### PlayerWeaponSystem
- Uses `getAimDirection()` for aim direction
- Uses `getSecondaryAction()` for manual fire
- Uses `isAiming()` for twin-stick auto-fire

## Files Modified

| File | Changes |
|------|---------|
| `packages/spartan/core/input-provider.ts` | New InputProvider interface, InputPreset type |
| `packages/spartan-web/input/input-manager.ts` | Preset support, separated channels |
| `packages/spartan-web/input/web-input-provider.ts` | New interface implementation |
| `packages/spartan-web/input/headless-input-manager.ts` | Preset support, asInputProvider() |
| `packages/spartan/systems/player-input.system.ts` | Uses getMoveDirection() |
| `packages/spartan/systems/melee.system.ts` | Uses getAimDirection(), getPrimaryAction() |
| `packages/spartan/systems/player-weapon.system.ts` | Uses new interface + isAiming() |
| `packages/spartan/core/game-runtime.ts` | GameConfig preset option |
| `packages/spartan-web/game-embed.ts` | Preset configuration flow |
| `packages/spartan/traits/trait-guards.ts` | Updated hasMelee, hasWeapon type guards |
| `dev/grid-renderer.tsx` | HUD weapon/ammo display |

## Testing

Tests are located at `packages/spartan/test/input-presets.test.ts` with 25 test cases covering:

- Classic preset behavior (movement equals aim)
- Twin-stick preset behavior (independent move/aim, auto-fire)
- Separated preset behavior (independent move/aim, manual actions)
- Preset switching
- State management (clearInput, one-shot inputs, disabled state)

Run tests:
```bash
npm test -- --run packages/spartan/test/input-presets.test.ts
```

## Demo Games

Both combat demos use the `separated` preset:

- **weapons-demo.json**: Arrow keys move, WASD sets fire direction
- **combat-demo.json**: Arrow keys move, WASD sets attack direction

Controls:
- Arrow keys: Move
- WASD: Attack/fire direction
- Space: Melee attack
- Shift: Fire weapon
