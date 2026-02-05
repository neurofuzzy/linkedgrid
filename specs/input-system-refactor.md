# Input System Refactor

## Overview

The Input System supports multiple input presets for different game styles. The architecture follows a strict separation of concerns:

1. **InputManager** - Captures raw keyboard/gamepad input (low-level, stable)
2. **WebInputProvider** - Maps raw input to game intent based on preset (high-level, flexible)
3. **Game Systems** - Consume abstract input via InputProvider interface

This separation ensures the InputManager remains stable and well-tested while allowing flexible preset logic in the provider layer.

## Input Presets

| Preset | Move | Aim | Primary Action | Secondary Action | Notes |
|--------|------|-----|----------------|------------------|-------|
| `classic` | Arrow keys + WASD | Last move direction | Space/Enter | Shift | Traditional arcade style |
| `twin-stick` | Arrow keys / LStick | WASD / RStick | Space/Enter | Shift | Auto-fires when aiming |
| `separated` | Arrow keys | WASD (auto-fire) | Space (melee) | Shift (fire) | WASD immediately fires in that direction |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Input Devices  │────▶│  InputManager   │────▶│WebInputProvider │
│  Keyboard/      │     │  Raw state:     │     │  Preset logic:  │
│  Gamepad/Mouse  │     │  • direction    │     │  • setPreset()  │
└─────────────────┘     │  • shootDirection│    │  • getMoveDir() │
                        │  • action/etc    │    │  • getAimDir()  │
                        └─────────────────┘     └─────────────────┘
                                                       │
                                                       ▼
                                           ┌─────────────────────┐
                                           │   Game Systems      │
                                           │ • PlayerInputSystem │
                                           │ • MeleeSystem       │
                                           │ • PlayerWeaponSystem│
                                           └─────────────────────┘
```

### Key Design Decisions

1. **InputManager is STABLE** - Do not add preset logic to InputManager. It only exposes raw `direction` (any key), `shootDirection` (WASD only), and action booleans.

2. **WebInputProvider owns preset mapping** - All preset-specific logic lives in WebInputProvider, including the heuristic to distinguish arrow-only vs WASD-only input.

3. **Per-frame caching** - WebInputProvider caches input state via `beginFrame()` to prevent multiple reads from draining one-shot events.

4. **GameEmbed applies preset** - The preset from game config is applied to WebInputProvider via `setPreset()` after construction.

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
  isAiming(): boolean;              // Twin-stick/separated auto-fire detection
  beginFrame?(): void;              // Called at start of each tick (optional)
}

type InputPreset = 'classic' | 'twin-stick' | 'separated';
```

### InputManager (Raw Input)

The InputManager provides raw input state. **Do not add preset logic here.**

```typescript
interface InputState {
  direction: Direction;       // Combined arrow + WASD direction
  shootDirection: Direction;  // WASD direction only
  action: boolean;            // Space/Enter
  secondary: boolean;         // Shift
  start: boolean;             // P/Escape
  restart: boolean;           // R
}
```

### WebInputProvider (Preset Mapping)

```typescript
const provider = new WebInputProvider(manager);
provider.setPreset('separated');

// In game loop:
provider.beginFrame();  // Cache input for this tick
const moveDir = provider.getMoveDirection();
const aimDir = provider.getAimDirection();
```

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
- Uses `getPrimaryAction()` (Space) for manual melee trigger
- **NEW**: Also uses `isAiming()` to trigger melee when WASD is pressed AND player has no weapon/ammo
- Default attack direction is DOWN (so melee works at game start)

### PlayerWeaponSystem
- Uses `getAimDirection()` for aim direction
- Uses `getSecondaryAction()` for manual fire (Shift)
- Uses `isAiming()` for auto-fire in separated/twin-stick modes
- Falls back to melee via `meleeDirection` when out of ammo

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

- **weapons-demo.json**: Arrow keys move, WASD fires directly
- **combat-demo.json**: Arrow keys move, WASD attacks directly

### Controls (Separated Mode)

| Key | Action |
|-----|--------|
| Arrow keys | Move player |
| W | Fire/melee UP |
| A | Fire/melee LEFT |
| S | Fire/melee DOWN |
| D | Fire/melee RIGHT |
| Space | Manual melee in last aimed direction |

**Note**: WASD fires projectiles if weapon has ammo, otherwise performs melee attack.

## Known Issues Fixed (Feb 2026)

1. **WASD causing movement**: Fixed by making `shootDirection` check `keysJustPressed` (not just `keysDown`) to match `direction` behavior.

2. **Melee not working at game start**: Fixed by defaulting `lastPlayerDirection` to DOWN, and adding `isAiming()` check to MeleeSystem.

3. **Weapon display not updating**: Fixed HUD to show "MELEE" when no weapon/ammo available.

4. **Projectiles skipping adjacent enemies**: Fixed by including spawn cell in projectile path (prepend to `getLine()` result).
