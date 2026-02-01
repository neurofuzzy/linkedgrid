# Architecture Decision Record: Platform-Agnostic Core Package Split

**Date:** January 31, 2026  
**Status:** Proposed  
**Component:** Spartan Game Engine - Package Architecture  
**Author:** Software Architecture Review

---

## Executive Summary

Split the Spartan game engine into multiple packages to separate platform-agnostic core logic from platform-specific input handling. This enables the engine to run in Node.js, headless environments, React Native, and other platforms without requiring browser APIs.

**Current State:** Single `spartan` package with web-specific input code mixed with core engine logic.

**Proposed State:** 
- `@spartan/core` - Platform-agnostic game engine
- `@spartan/web` - Web-specific input adapters (keyboard, mouse, gamepad)
- `@spartan/headless` - Headless/testing input adapters

**Key Benefit:** Core engine becomes truly portable - can run in Node.js, terminal applications, Discord bots, mobile apps, or any JavaScript environment.

---

## Problem Statement

### Current Architecture Issues

#### 1. **Browser APIs in Core Package**

```typescript
// Current structure (problematic)
packages/spartan/
├── core/
│   ├── spatial-system.ts       ✓ Platform-agnostic
│   ├── game-loop.ts            ✓ Platform-agnostic
│   └── entity-store.ts         ✓ Platform-agnostic
├── systems/
│   ├── fire.system.ts          ✓ Platform-agnostic
│   ├── liquid.system.ts        ✓ Platform-agnostic
│   └── player-input.system.ts  ❌ Requires browser (keyboard, mouse, gamepad)
└── input/
    ├── keyboard-input-manager.ts  ❌ Uses DOM events
    ├── mouse-manager.ts           ❌ Uses DOM events
    └── gamepad-manager.ts         ❌ Uses Browser Gamepad API
```

**Impact:**
- Cannot run Spartan in Node.js without browser shims
- Cannot use in headless testing without complex mocking
- Cannot port to React Native or other platforms
- Tree-shaking doesn't eliminate unused web code
- Tests require jsdom or browser environment

#### 2. **Platform Coupling in Tests**

```typescript
// Current test setup (problematic)
import { GameRuntime } from '../core/game-runtime';
import { InputManager } from '../input/input-manager';  // ❌ Requires browser

describe('FireSystem', () => {
  it('should spread fire', () => {
    const runtime = new GameRuntime({ width: 10, height: 10 });
    // Can't run in pure Node.js - InputManager needs DOM
  });
});
```

**Impact:**
- Slow tests (need browser environment)
- Complex test setup (jsdom, mocking DOM APIs)
- Can't run tests in CI without headless browser
- Can't simulate games in Node.js scripts

#### 3. **No Clear Platform Abstraction**

```typescript
// Current approach (tightly coupled)
class PlayerInputSystem {
  constructor(private inputManager: InputManager) {
    // Directly depends on web-specific InputManager
    // No abstraction for different input sources
  }
}
```

**Impact:**
- Hard to swap input implementations
- Can't support multiple platforms
- Difficult to add programmatic input for AI/bots
- No clean testing interface

### Real-World Use Cases Being Blocked

1. **Headless Game Simulation**
   ```bash
   # Want to do this, but can't:
   node scripts/simulate-1000-games.js
   # Error: document is not defined
   ```

2. **Discord Bot Integration**
   ```typescript
   // Want to run game in Discord bot
   // But can't because InputManager requires browser
   ```

3. **Terminal-Based Game**
   ```bash
   # Want CLI version using terminal input
   # But core is coupled to web input
   ```

4. **React Native Port**
   ```typescript
   // Want mobile version with touch controls
   // But can't reuse core without bringing in DOM dependencies
   ```

5. **Pure Logic Testing**
   ```typescript
   // Want to test fire spread without any input system
   // But core package includes web dependencies
   ```

---

## Proposed Solution

### Package Structure

```
packages/
├── spartan/                    # Core engine (platform-agnostic)
│   ├── core/
│   │   ├── spatial-system.ts
│   │   ├── game-loop.ts
│   │   ├── entity-store.ts
│   │   ├── game-runtime.ts
│   │   ├── input-provider.ts   # ← NEW: Platform abstraction
│   │   └── types.ts
│   ├── systems/
│   │   ├── fire.system.ts
│   │   ├── liquid.system.ts
│   │   ├── poison.system.ts
│   │   ├── door.system.ts
│   │   ├── collection.system.ts
│   │   └── (player-input.system.ts MOVED to platform packages)
│   ├── entities/
│   ├── traits/
│   ├── config/
│   └── helpers/
│
├── spartan-web/               # Web platform (browser-specific)
│   ├── input/
│   │   ├── keyboard-input-manager.ts
│   │   ├── mouse-manager.ts
│   │   ├── gamepad-manager.ts
│   │   └── web-input-provider.ts  # ← Implements InputProvider
│   └── systems/
│       └── player-input.system.ts  # ← Web-specific implementation
│
└── spartan-headless/          # Headless platform (testing/simulation)
    ├── input/
    │   └── headless-input-provider.ts  # ← Implements InputProvider
    └── systems/
        └── player-input.system.ts      # ← Headless implementation
```

### Core Platform Abstraction

**File:** `packages/spartan/core/input-provider.ts`

```typescript
/**
 * Platform-agnostic input interface.
 * 
 * All platform-specific packages must implement this interface
 * to provide player input to the game engine.
 * 
 * Implementations:
 * - @spartan/web: WebInputProvider (keyboard, mouse, gamepad)
 * - @spartan/headless: HeadlessInputProvider (programmatic)
 * - @spartan/native: TouchInputProvider (mobile touch/gestures)
 */
export interface InputProvider {
  /**
   * Get current input state.
   * Called once per tick by platform-specific PlayerInputSystem.
   * 
   * @returns Current player input state
   */
  getInput(): PlayerInput;
  
  /**
   * Clear any buffered input.
   * Called after input has been processed.
   */
  clearInput(): void;
  
  /**
   * Enable input capture.
   * Platform-specific implementation (e.g., add event listeners).
   */
  enable(): void;
  
  /**
   * Disable input capture.
   * Platform-specific implementation (e.g., remove event listeners).
   */
  disable(): void;
  
  /**
   * Check if input capture is currently enabled.
   */
  isEnabled(): boolean;
  
  /**
   * Cleanup resources.
   * Called when input provider is no longer needed.
   */
  destroy(): void;
}

/**
 * Platform-agnostic input state.
 * Same structure across all platforms - implementations convert
 * platform-specific input (keyboard, touch, etc.) to this format.
 */
export interface PlayerInput {
  /** Movement direction (null if no movement) */
  direction: Direction | null;
  
  /** Primary action button (attack, interact) */
  action: boolean;
  
  /** Secondary action button (use item, special ability) */
  secondary: boolean;
  
  /** Start/pause button */
  start: boolean;
  
  /** Restart/reset button */
  restart: boolean;
}
```

### Web Platform Implementation

**File:** `packages/spartan-web/input/web-input-provider.ts`

```typescript
import type { InputProvider, PlayerInput } from '@spartan/core';
import { KeyboardInputManager } from './keyboard-input-manager';
import { MouseManager } from './mouse-manager';
import { GamepadManager } from './gamepad-manager';

/**
 * Web platform input provider.
 * 
 * Combines keyboard, mouse, and gamepad input using browser APIs.
 * Implements the platform-agnostic InputProvider interface.
 */
export class WebInputProvider implements InputProvider {
  private keyboard: KeyboardInputManager;
  private mouse: MouseManager;
  private gamepad: GamepadManager;
  private enabled = false;
  
  constructor(config?: {
    enableKeyboard?: boolean;
    enableMouse?: boolean;
    enableGamepad?: boolean;
  }) {
    this.keyboard = new KeyboardInputManager();
    this.mouse = new MouseManager();
    this.gamepad = new GamepadManager();
    
    if (config?.enableKeyboard !== false) this.keyboard.enable();
    if (config?.enableMouse) this.mouse.enable();
    if (config?.enableGamepad) this.gamepad.enable();
    
    this.enabled = true;
  }
  
  getInput(): PlayerInput {
    const keyboardState = this.keyboard.getState();
    const gamepadState = this.gamepad.getState();
    
    // Merge inputs (keyboard takes priority)
    return {
      direction: keyboardState.direction ?? gamepadState.direction,
      action: keyboardState.action || gamepadState.action,
      secondary: keyboardState.secondary || gamepadState.secondary,
      start: keyboardState.start || gamepadState.start,
      restart: keyboardState.restart || gamepadState.restart,
    };
  }
  
  clearInput(): void {
    this.keyboard.clearBufferedDirection();
  }
  
  enable(): void {
    if (this.enabled) return;
    this.keyboard.enable();
    this.mouse.enable();
    this.gamepad.enable();
    this.enabled = true;
  }
  
  disable(): void {
    if (!this.enabled) return;
    this.keyboard.disable();
    this.mouse.disable();
    this.gamepad.disable();
    this.enabled = false;
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  destroy(): void {
    this.keyboard.destroy();
    this.mouse.destroy();
    this.gamepad.destroy();
  }
}
```

**File:** `packages/spartan-web/systems/player-input.system.ts`

```typescript
import { BaseReactiveSystem, type GameContext } from '@spartan/core';
import type { WebInputProvider } from '../input/web-input-provider';

/**
 * Web platform player input system.
 * 
 * Processes input from WebInputProvider (keyboard, mouse, gamepad)
 * and translates to player movement intents.
 */
export class WebPlayerInputSystem extends BaseReactiveSystem {
  constructor(
    private inputProvider: WebInputProvider,
    private playerId: number,
    private spatial: SpatialSystem
  ) {
    super();
  }
  
  update(context: GameContext): void {
    const input = this.inputProvider.getInput();
    
    // No input - skip processing
    if (!input.direction) {
      return;
    }
    
    // Get current player position
    const currentPos = this.spatial.getPosition(this.playerId);
    if (!currentPos) return;
    
    // Convert direction to delta
    const [dx, dy] = this.getDirectionDelta(input.direction);
    
    // Stage move operation (will be validated during commit)
    this.spatial.move(
      this.playerId,
      currentPos.x + dx,
      currentPos.y + dy,
      GameLayers.ACTORS
    );
    
    // Clear input after processing
    this.inputProvider.clearInput();
  }
  
  private getDirectionDelta(direction: Direction): [number, number] {
    switch (direction) {
      case Direction.UP: return [0, -1];
      case Direction.DOWN: return [0, 1];
      case Direction.LEFT: return [-1, 0];
      case Direction.RIGHT: return [1, 0];
    }
  }
}
```

### Headless Platform Implementation

**File:** `packages/spartan-headless/input/headless-input-provider.ts`

```typescript
import type { InputProvider, PlayerInput, Direction } from '@spartan/core';

/**
 * Headless platform input provider.
 * 
 * Provides programmatic input control for testing and simulation.
 * Input is queued manually via setter methods.
 */
export class HeadlessInputProvider implements InputProvider {
  private queuedInput: PlayerInput = {
    direction: null,
    action: false,
    secondary: false,
    start: false,
    restart: false,
  };
  
  private enabled = true;
  
  /**
   * Queue a movement direction.
   * Will be consumed on next getInput() call.
   */
  setDirection(direction: Direction | null): void {
    this.queuedInput.direction = direction;
  }
  
  /**
   * Queue an action button press.
   */
  setAction(pressed: boolean): void {
    this.queuedInput.action = pressed;
  }
  
  /**
   * Queue a secondary button press.
   */
  setSecondary(pressed: boolean): void {
    this.queuedInput.secondary = pressed;
  }
  
  /**
   * Queue a start button press.
   */
  setStart(pressed: boolean): void {
    this.queuedInput.start = pressed;
  }
  
  /**
   * Queue a restart button press.
   */
  setRestart(pressed: boolean): void {
    this.queuedInput.restart = pressed;
  }
  
  getInput(): PlayerInput {
    return { ...this.queuedInput };
  }
  
  clearInput(): void {
    this.queuedInput = {
      direction: null,
      action: false,
      secondary: false,
      start: false,
      restart: false,
    };
  }
  
  enable(): void {
    this.enabled = true;
  }
  
  disable(): void {
    this.enabled = false;
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  destroy(): void {
    this.clearInput();
  }
}
```

**File:** `packages/spartan-headless/systems/player-input.system.ts`

```typescript
import { BaseReactiveSystem, type GameContext } from '@spartan/core';
import type { HeadlessInputProvider } from '../input/headless-input-provider';

/**
 * Headless platform player input system.
 * 
 * Processes programmatic input from HeadlessInputProvider.
 * Identical logic to WebPlayerInputSystem, different input source.
 */
export class HeadlessPlayerInputSystem extends BaseReactiveSystem {
  constructor(
    private inputProvider: HeadlessInputProvider,
    private playerId: number,
    private spatial: SpatialSystem
  ) {
    super();
  }
  
  update(context: GameContext): void {
    const input = this.inputProvider.getInput();
    
    if (!input.direction) return;
    
    const currentPos = this.spatial.getPosition(this.playerId);
    if (!currentPos) return;
    
    const [dx, dy] = this.getDirectionDelta(input.direction);
    
    this.spatial.move(
      this.playerId,
      currentPos.x + dx,
      currentPos.y + dy,
      GameLayers.ACTORS
    );
    
    this.inputProvider.clearInput();
  }
  
  private getDirectionDelta(direction: Direction): [number, number] {
    switch (direction) {
      case Direction.UP: return [0, -1];
      case Direction.DOWN: return [0, 1];
      case Direction.LEFT: return [-1, 0];
      case Direction.RIGHT: return [1, 0];
    }
  }
}
```

---

## Usage Examples

### Web Application

```typescript
// app/main.ts
import { GameRuntime } from '@spartan/core';
import { 
  FireSystem, 
  LiquidSystem, 
  DoorSystem 
} from '@spartan/core/systems';
import { WebPlayerInputSystem } from '@spartan/web/systems';
import { WebInputProvider } from '@spartan/web/input';

// Create web input provider
const inputProvider = new WebInputProvider({
  enableKeyboard: true,
  enableGamepad: true,
  enableMouse: true,
});

// Create game runtime with core systems
const runtime = new GameRuntime({ width: 20, height: 20 });

// Add platform-agnostic systems
runtime.addSystem(new FireSystem(runtime.spatial));
runtime.addSystem(new LiquidSystem(runtime.spatial));
runtime.addSystem(new DoorSystem(runtime.gameManager, runtime.spatial));

// Add web-specific input system
const playerId = 1;
runtime.addSystem(
  new WebPlayerInputSystem(inputProvider, playerId, runtime.spatial)
);

// Start game loop
runtime.start();
```

### Headless Testing

```typescript
// test/fire-spread.test.ts
import { GameRuntime } from '@spartan/core';
import { FireSystem } from '@spartan/core/systems';
import { HeadlessPlayerInputSystem } from '@spartan/headless/systems';
import { HeadlessInputProvider } from '@spartan/headless/input';
import { Direction } from '@spartan/core';

describe('FireSystem', () => {
  it('should spread fire to adjacent grass', () => {
    // Create headless runtime (no browser APIs needed)
    const runtime = new GameRuntime({ width: 10, height: 10 });
    
    // Add fire system
    runtime.addSystem(new FireSystem(runtime.spatial));
    
    // Spawn fire and grass
    const fireId = runtime.spatial.spawn('fire', 5, 5, GameLayers.FLOOR, {});
    const grassId = runtime.spatial.spawn('grass', 6, 5, GameLayers.FLOOR, {});
    
    // Advance until fire spreads
    for (let i = 0; i < FIRE_SPREAD_DELAY; i++) {
      runtime.tick();
    }
    
    // Verify fire spread
    const entityAt6_5 = runtime.spatial.getEntityIdAt(6, 5, GameLayers.FLOOR);
    const entity = runtime.spatial.getEntityData(entityAt6_5);
    expect(entity?.type).toBe('fire');
  });
  
  it('should allow player movement with headless input', () => {
    const runtime = new GameRuntime({ width: 10, height: 10 });
    
    // Create headless input provider
    const inputProvider = new HeadlessInputProvider();
    
    // Spawn player
    const playerId = runtime.spatial.spawn('player', 5, 5, GameLayers.ACTORS, {
      hp: 100,
      maxHp: 100,
      damage: 10,
      sceneId: 'test',
      inventory: [],
    });
    
    // Add headless input system
    runtime.addSystem(
      new HeadlessPlayerInputSystem(inputProvider, playerId, runtime.spatial)
    );
    
    // Programmatically set input
    inputProvider.setDirection(Direction.RIGHT);
    
    // Process one tick
    runtime.tick();
    
    // Verify player moved
    const playerPos = runtime.spatial.getPosition(playerId);
    expect(playerPos).toEqual({ x: 6, y: 5 });
  });
});

// ✓ Tests run in pure Node.js
// ✓ No browser APIs required
// ✓ No jsdom needed
// ✓ Fast, isolated tests
```

### Node.js Simulation Script

```typescript
// scripts/simulate-game.ts
import { GameRuntime } from '@spartan/core';
import { 
  FireSystem, 
  LiquidSystem,
  PoisonSystem 
} from '@spartan/core/systems';
import { HeadlessPlayerInputSystem } from '@spartan/headless/systems';
import { HeadlessInputProvider } from '@spartan/headless/input';

// Create headless game for simulation
const runtime = new GameRuntime({ width: 30, height: 30 });

// Add all game systems (no web dependencies)
runtime.addSystem(new FireSystem(runtime.spatial));
runtime.addSystem(new LiquidSystem(runtime.spatial));
runtime.addSystem(new PoisonSystem(runtime.spatial));

// Add headless input for AI control
const inputProvider = new HeadlessInputProvider();
const playerId = runtime.spatial.spawn('player', 15, 15, GameLayers.ACTORS, {
  hp: 100,
  maxHp: 100,
  damage: 10,
  sceneId: 'simulation',
  inventory: [],
});

runtime.addSystem(
  new HeadlessPlayerInputSystem(inputProvider, playerId, runtime.spatial)
);

// Spawn initial entities
runtime.spatial.spawn('fire', 5, 5, GameLayers.FLOOR, {});
runtime.spatial.spawn('grass', 6, 5, GameLayers.FLOOR, {});
runtime.spatial.spawn('water', 10, 10, GameLayers.FLOOR, {});

// Simulate 1000 ticks
console.log('Starting simulation...');
for (let i = 0; i < 1000; i++) {
  // AI logic: random movement
  if (i % 10 === 0) {
    const directions = [
      Direction.UP, 
      Direction.DOWN, 
      Direction.LEFT, 
      Direction.RIGHT
    ];
    const randomDir = directions[Math.floor(Math.random() * 4)];
    inputProvider.setDirection(randomDir);
  }
  
  runtime.tick();
  
  // Log every 100 ticks
  if (i % 100 === 0) {
    const playerPos = runtime.spatial.getPosition(playerId);
    console.log(`Tick ${i}: Player at (${playerPos?.x}, ${playerPos?.y})`);
  }
}

console.log('Simulation complete');

// ✓ Runs in Node.js without browser
// ✓ Can be used for AI training
// ✓ Can generate analytics data
// ✓ Can test game balance
```

### Future: React Native Mobile App

```typescript
// mobile/App.tsx (future implementation)
import { GameRuntime } from '@spartan/core';
import { FireSystem, LiquidSystem } from '@spartan/core/systems';
import { NativePlayerInputSystem } from '@spartan/native/systems';
import { TouchInputProvider } from '@spartan/native/input';

export function GameApp() {
  const [runtime] = useState(() => {
    const rt = new GameRuntime({ width: 20, height: 20 });
    
    // Platform-agnostic systems work as-is
    rt.addSystem(new FireSystem(rt.spatial));
    rt.addSystem(new LiquidSystem(rt.spatial));
    
    // Native-specific input
    const inputProvider = new TouchInputProvider({
      virtualJoystick: true,
      swipeGestures: true,
    });
    
    rt.addSystem(
      new NativePlayerInputSystem(inputProvider, playerId, rt.spatial)
    );
    
    return rt;
  });
  
  // ... React Native rendering
}

// ✓ Core engine works unchanged
// ✓ Only input handling is platform-specific
// ✓ Can reuse all game systems
```

---

## Package Dependencies

### @spartan/core

```json
{
  "name": "@spartan/core",
  "version": "1.0.0",
  "description": "Platform-agnostic game engine core",
  "main": "index.ts",
  "exports": {
    ".": "./index.ts",
    "./core": "./core/index.ts",
    "./systems": "./systems/index.ts",
    "./entities": "./entities/index.ts",
    "./traits": "./traits/index.ts",
    "./config": "./config/index.ts"
  },
  "dependencies": {
    // Zero platform-specific dependencies
  },
  "keywords": [
    "game-engine",
    "platform-agnostic",
    "entity-component-system",
    "grid-based"
  ]
}
```

### @spartan/web

```json
{
  "name": "@spartan/web",
  "version": "1.0.0",
  "description": "Web platform adapters for Spartan engine",
  "main": "index.ts",
  "exports": {
    ".": "./index.ts",
    "./input": "./input/index.ts",
    "./systems": "./systems/index.ts"
  },
  "dependencies": {
    "@spartan/core": "workspace:*"
  },
  "peerDependencies": {
    // Implicitly requires browser environment
  },
  "keywords": [
    "browser",
    "web",
    "keyboard",
    "mouse",
    "gamepad"
  ]
}
```

### @spartan/headless

```json
{
  "name": "@spartan/headless",
  "version": "1.0.0",
  "description": "Headless platform adapters for Spartan engine (testing/simulation)",
  "main": "index.ts",
  "exports": {
    ".": "./index.ts",
    "./input": "./input/index.ts",
    "./systems": "./systems/index.ts"
  },
  "dependencies": {
    "@spartan/core": "workspace:*"
  },
  "keywords": [
    "headless",
    "testing",
    "simulation",
    "node"
  ]
}
```

---

## Migration Path

### Phase 1: Create Package Structure (Week 1)

**Goal:** Set up new packages without breaking existing code.

```bash
# Create new package directories
mkdir -p packages/spartan-web/input
mkdir -p packages/spartan-web/systems
mkdir -p packages/spartan-headless/input
mkdir -p packages/spartan-headless/systems

# Initialize package.json files
cd packages/spartan-web && npm init -y
cd packages/spartan-headless && npm init -y

# Update package names and dependencies
# (See package.json examples above)
```

**Checklist:**
- [ ] Create `packages/spartan-web/` directory
- [ ] Create `packages/spartan-headless/` directory
- [ ] Initialize package.json for each
- [ ] Set up workspace dependencies
- [ ] Verify packages can import @spartan/core

**Validation:** `npm run build` succeeds for all packages

---

### Phase 2: Create InputProvider Interface (Week 1)

**Goal:** Define platform abstraction in core package.

**File:** `packages/spartan/core/input-provider.ts`

```typescript
export interface InputProvider {
  getInput(): PlayerInput;
  clearInput(): void;
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
  destroy(): void;
}

export interface PlayerInput {
  direction: Direction | null;
  action: boolean;
  secondary: boolean;
  start: boolean;
  restart: boolean;
}
```

**Checklist:**
- [ ] Create `input-provider.ts` in core
- [ ] Export from `core/index.ts`
- [ ] Add JSDoc documentation
- [ ] Add to TypeScript exports

**Validation:** Interface can be imported from `@spartan/core`

---

### Phase 3: Move Input Managers to spartan-web (Week 1-2)

**Goal:** Relocate browser-specific input code.

```bash
# Move web input files
mv packages/spartan/input/keyboard-input-manager.ts \
   packages/spartan-web/input/

mv packages/spartan/input/mouse-manager.ts \
   packages/spartan-web/input/

mv packages/spartan/input/gamepad-manager.ts \
   packages/spartan-web/input/

mv packages/spartan/input/input-manager.ts \
   packages/spartan-web/input/

# Update imports in moved files
# @spartan/core instead of relative paths
```

**Checklist:**
- [ ] Move keyboard-input-manager.ts
- [ ] Move mouse-manager.ts
- [ ] Move gamepad-manager.ts
- [ ] Move input-manager.ts
- [ ] Update imports to use @spartan/core
- [ ] Create WebInputProvider implementing InputProvider
- [ ] Export from spartan-web/input/index.ts

**Validation:** `npm run build` succeeds, web input managers accessible from `@spartan/web/input`

---

### Phase 4: Move Headless Input Manager (Week 2)

**Goal:** Extract headless input to separate package.

```bash
# Move headless input
mv packages/spartan/input/headless-input-manager.ts \
   packages/spartan-headless/input/

# Rename and adapt to InputProvider interface
# headless-input-manager.ts → headless-input-provider.ts
```

**Checklist:**
- [ ] Move headless-input-manager.ts to spartan-headless
- [ ] Rename to headless-input-provider.ts
- [ ] Implement InputProvider interface
- [ ] Update imports to use @spartan/core
- [ ] Export from spartan-headless/input/index.ts

**Validation:** Headless input accessible from `@spartan/headless/input`

---

### Phase 5: Create Platform-Specific PlayerInputSystems (Week 2)

**Goal:** Split PlayerInputSystem into web and headless variants.

**Web Version:**
```bash
# Move and adapt
cp packages/spartan/systems/player-input.system.ts \
   packages/spartan-web/systems/

# Update to use WebInputProvider
```

**Headless Version:**
```typescript
// Create new file
packages/spartan-headless/systems/player-input.system.ts

// Implement using HeadlessInputProvider
```

**Checklist:**
- [ ] Create WebPlayerInputSystem in spartan-web
- [ ] Create HeadlessPlayerInputSystem in spartan-headless
- [ ] Both implement same logic, different input sources
- [ ] Export from respective systems/index.ts
- [ ] Remove original from spartan/systems

**Validation:** Both systems can be imported and used

---

### Phase 6: Update Tests (Week 2-3)

**Goal:** Convert tests to use headless platform.

```typescript
// Before:
import { InputManager } from '../input/input-manager';

// After:
import { HeadlessInputProvider } from '@spartan/headless/input';
import { HeadlessPlayerInputSystem } from '@spartan/headless/systems';

describe('Game logic', () => {
  it('should work', () => {
    const inputProvider = new HeadlessInputProvider();
    const runtime = new GameRuntime({ width: 10, height: 10 });
    
    runtime.addSystem(
      new HeadlessPlayerInputSystem(inputProvider, playerId, runtime.spatial)
    );
    
    // Pure Node.js test - no browser APIs
  });
});
```

**Checklist:**
- [ ] Update all test imports
- [ ] Replace web input with headless input
- [ ] Remove jsdom/browser requirements
- [ ] Verify tests run in pure Node.js
- [ ] Update test documentation

**Validation:** `npm test` runs without browser environment

---

### Phase 7: Update Application Code (Week 3)

**Goal:** Update game applications to use new packages.

```typescript
// Before:
import { GameRuntime } from '@spartan/core';
import { InputManager } from '@spartan/core/input';
import { PlayerInputSystem } from '@spartan/core/systems';

// After:
import { GameRuntime } from '@spartan/core';
import { WebInputProvider } from '@spartan/web/input';
import { WebPlayerInputSystem } from '@spartan/web/systems';

const inputProvider = new WebInputProvider();
const runtime = new GameRuntime({ width: 20, height: 20 });

runtime.addSystem(
  new WebPlayerInputSystem(inputProvider, playerId, runtime.spatial)
);
```

**Checklist:**
- [ ] Update main game application
- [ ] Update examples
- [ ] Update documentation
- [ ] Update README with new package structure
- [ ] Create migration guide

**Validation:** Game runs in browser with new packages

---

### Phase 8: Cleanup (Week 3)

**Goal:** Remove old input code from core package.

```bash
# Delete old input directory from core
rm -rf packages/spartan/input/

# Verify no references remain
grep -r "input-manager" packages/spartan/
grep -r "gamepad-manager" packages/spartan/
grep -r "keyboard-input" packages/spartan/
```

**Checklist:**
- [ ] Remove input/ directory from spartan core
- [ ] Remove any remaining web-specific code
- [ ] Update core package.json (ensure no browser deps)
- [ ] Run full test suite
- [ ] Update documentation

**Validation:** 
- Core package has zero browser dependencies
- All tests pass
- Applications work with new structure

---

### Phase 9: Verification (Week 3-4)

**Goal:** Confirm core is truly platform-agnostic.

**Test 1: Pure Node.js Script**
```typescript
// scripts/verify-platform-agnostic.ts
import { GameRuntime } from '@spartan/core';
import { FireSystem } from '@spartan/core/systems';

// This should work in pure Node.js (no browser)
const runtime = new GameRuntime({ width: 10, height: 10 });
runtime.addSystem(new FireSystem(runtime.spatial));

for (let i = 0; i < 100; i++) {
  runtime.tick();
}

console.log('✓ Core is platform-agnostic');
```

```bash
node scripts/verify-platform-agnostic.ts
# Should run without errors
```

**Test 2: Bundle Size Analysis**
```bash
# Verify web bundle doesn't include headless code
npm run build:web
npx webpack-bundle-analyzer dist/web/stats.json

# Verify core bundle has no DOM APIs
npm run build:core
grep -i "document\|window\|addEventListener" dist/core/*.js
# Should find nothing
```

**Checklist:**
- [ ] Core runs in pure Node.js
- [ ] Core has no browser globals (window, document)
- [ ] Web bundle doesn't include headless code
- [ ] Headless bundle doesn't include web code
- [ ] Tree-shaking works correctly
- [ ] TypeScript exports are correct

**Validation:** All verification tests pass

---

## Benefits

### 1. **True Platform Portability**

```typescript
// ✓ Node.js simulation
node scripts/simulate-game.js

// ✓ Headless testing  
npm test  // Pure Node.js, no browser

// ✓ Discord bot
const bot = new GameBot(runtime);

// ✓ Terminal game
const terminal = new TerminalRenderer(runtime);

// ✓ React Native (future)
const mobile = new MobileGame(runtime);
```

### 2. **Cleaner Dependencies**

**Before (monolithic):**
```json
// spartan/package.json
{
  "dependencies": {
    // Everything mixed together
  },
  "devDependencies": {
    "jsdom": "^20.0.0"  // Needed for tests
  }
}
```

**After (split):**
```json
// @spartan/core - Zero platform deps
{
  "dependencies": {}
}

// @spartan/web - Only web needs browser types
{
  "dependencies": {
    "@spartan/core": "workspace:*"
  }
}

// Tests - No jsdom needed
{
  "devDependencies": {
    // jsdom removed - tests use @spartan/headless
  }
}
```

### 3. **Better Tree-Shaking**

```typescript
// Import only what you need
import { GameRuntime, FireSystem } from '@spartan/core';
// Web input code not included in bundle

import { WebInputProvider } from '@spartan/web/input';
// Only web input code included

// Result: Smaller bundles
```

### 4. **Faster Tests**

```bash
# Before: Tests need browser environment
npm test
# Uses jsdom, slower startup, complex setup

# After: Tests run in pure Node.js  
npm test
# Fast startup, simple setup, isolated tests
```

### 5. **Future Platform Support**

**Easy to add new platforms:**

```typescript
// packages/spartan-terminal/
// Terminal-based game using blessed/ink

// packages/spartan-native/
// React Native mobile game

// packages/spartan-electron/
// Desktop app (could use web input or native)

// packages/spartan-discord/
// Discord bot integration
```

Each platform:
- Implements InputProvider interface
- Creates platform-specific PlayerInputSystem
- Reuses entire @spartan/core

### 6. **Clear Architecture**

```
@spartan/core = Game logic (what)
Platform packages = Input/rendering (how)

Core: Fire spreads, water flows, doors unlock
Platform: How player controls the game
```

---

## Risks & Mitigations

### Risk 1: Duplication Between Platform Systems

**Problem:** WebPlayerInputSystem and HeadlessPlayerInputSystem have identical logic.

**Mitigation:**
Extract shared logic to base class in core:

```typescript
// @spartan/core/systems/base-player-input.system.ts
export abstract class BasePlayerInputSystem extends BaseReactiveSystem {
  constructor(
    protected playerId: number,
    protected spatial: SpatialSystem
  ) {
    super();
  }
  
  protected abstract getInput(): PlayerInput;
  protected abstract clearInput(): void;
  
  update(context: GameContext): void {
    const input = this.getInput();
    if (!input.direction) return;
    
    const currentPos = this.spatial.getPosition(this.playerId);
    if (!currentPos) return;
    
    const [dx, dy] = this.getDirectionDelta(input.direction);
    this.spatial.move(this.playerId, currentPos.x + dx, currentPos.y + dy, GameLayers.ACTORS);
    
    this.clearInput();
  }
  
  private getDirectionDelta(direction: Direction): [number, number] {
    // Shared logic
  }
}

// Platform systems just implement input methods
export class WebPlayerInputSystem extends BasePlayerInputSystem {
  constructor(
    private inputProvider: WebInputProvider,
    playerId: number,
    spatial: SpatialSystem
  ) {
    super(playerId, spatial);
  }
  
  protected getInput() { return this.inputProvider.getInput(); }
  protected clearInput() { this.inputProvider.clearInput(); }
}
```

---

### Risk 2: Breaking Changes for Existing Users

**Problem:** Current API changes significantly.

**Mitigation:**
Provide migration guide and compatibility layer:

```typescript
// @spartan/web/compat.ts - Temporary compatibility exports
export { WebInputProvider as InputManager } from './input/web-input-provider';
export { WebPlayerInputSystem as PlayerInputSystem } from './systems/player-input.system';

// Old code still works:
import { InputManager, PlayerInputSystem } from '@spartan/web/compat';
```

Deprecate after 2-3 releases.

---

### Risk 3: Increased Complexity for Simple Use Cases

**Problem:** Users need to import from multiple packages.

**Mitigation:**
Create convenience packages:

```typescript
// @spartan/game - Batteries-included web game package
export * from '@spartan/core';
export * from '@spartan/web';

// Simple usage:
import { GameRuntime, WebInputProvider, WebPlayerInputSystem } from '@spartan/game';
```

---

### Risk 4: Maintaining Multiple Implementations

**Problem:** Changes need to be applied to web, headless, and future platforms.

**Mitigation:**
- Base class extracts shared logic (see Risk 1)
- Platform-specific code is minimal (just input source)
- Comprehensive tests ensure compatibility
- Clear documentation on platform requirements

---

## Alternatives Considered

### Alternative 1: Keep Everything in One Package

**Approach:** Leave current structure as-is.

**Pros:**
- No migration needed
- Simpler package structure
- No duplication concerns

**Cons:**
- Can't use in Node.js without browser shims
- Tests require complex browser mocking
- Can't port to other platforms
- Bundle includes unused code

**Rejected because:** Blocks too many legitimate use cases.

---

### Alternative 2: Dependency Injection Only (No Package Split)

**Approach:** Core package accepts InputProvider interface, but input implementations stay in same package.

```typescript
// All in @spartan/core
export interface InputProvider { ... }
export class WebInputProvider implements InputProvider { ... }
export class HeadlessInputProvider implements InputProvider { ... }
```

**Pros:**
- Single package
- Dependency injection benefits
- No migration needed

**Cons:**
- Core still has browser dependencies (DOM APIs in WebInputProvider)
- Can't tree-shake web code from headless builds
- Doesn't solve Node.js compatibility
- Bundle includes all platforms

**Rejected because:** Doesn't achieve true platform agnosticism.

---

### Alternative 3: Plugin System

**Approach:** Dynamic plugin loading for input systems.

```typescript
runtime.loadPlugin('@spartan/plugin-web-input');
runtime.loadPlugin('@spartan/plugin-keyboard');
```

**Pros:**
- Maximum flexibility
- Easy to add new platforms
- Clean separation

**Cons:**
- Complex plugin architecture
- Runtime overhead
- Harder to type-check
- Overkill for this use case

**Rejected because:** Over-engineered for current needs. Package split is simpler.

---

## Success Metrics

### Metric 1: Platform Independence

**Target:** Core package has zero browser-specific dependencies

**Measurement:**
```bash
# Check for browser globals in core
grep -r "window\|document\|navigator\|localStorage" packages/spartan/core/
# Should return nothing

# Verify core runs in Node.js
node -e "require('@spartan/core')"
# Should not throw "window is not defined"
```

**Success Criteria:** ✓ Core package can be imported in Node.js without errors

---

### Metric 2: Test Performance

**Target:** 50% faster test execution without browser environment

**Measurement:**
```bash
# Before (with jsdom)
time npm test
# ~15 seconds

# After (pure Node.js)
time npm test
# ~7 seconds
```

**Success Criteria:** ✓ Test suite runs in under 10 seconds

---

### Metric 3: Bundle Size

**Target:** Web builds don't include headless code

**Measurement:**
```bash
# Analyze web bundle
npm run build:web
npx webpack-bundle-analyzer dist/web/stats.json

# Search for headless code
grep -i "headless" dist/web/main.js
# Should find nothing
```

**Success Criteria:** ✓ Web bundle < 150KB (gzipped), no headless code

---

### Metric 4: Developer Experience

**Target:** New platform can be added in < 1 day

**Measurement:**
- Create packages/spartan-terminal/
- Implement TerminalInputProvider
- Implement TerminalPlayerInputSystem
- Create simple example

**Success Criteria:** ✓ Terminal platform works in under 8 hours of development

---

### Metric 5: API Clarity

**Target:** 90%+ of developers understand new structure without explanation

**Measurement:**
- Survey 10 developers
- Show new package structure
- Ask: "Which package would you import for a web game?"
- Track correct answers

**Success Criteria:** ✓ 9+ out of 10 developers answer correctly

---

## Documentation Updates

### Files to Update

1. **README.md**
   - New package structure diagram
   - Installation instructions for each package
   - Quick start examples (web, headless, Node.js)

2. **ARCHITECTURE.md** (new)
   - Detailed explanation of package split
   - Platform abstraction layer
   - Adding new platforms guide

3. **MIGRATION.md** (new)
   - Step-by-step migration from old to new API
   - Code examples (before/after)
   - Breaking changes list

4. **API_REFERENCE.md**
   - Document InputProvider interface
   - Platform-specific exports
   - Usage patterns

5. **CONTRIBUTING.md**
   - Guidelines for platform implementations
   - Testing requirements
   - Platform compatibility checklist

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | Week 1 | Package structure created |
| Phase 2 | Week 1 | InputProvider interface defined |
| Phase 3 | Week 1-2 | Web input moved to spartan-web |
| Phase 4 | Week 2 | Headless input moved to spartan-headless |
| Phase 5 | Week 2 | Platform-specific systems created |
| Phase 6 | Week 2-3 | Tests converted to headless |
| Phase 7 | Week 3 | Applications updated |
| Phase 8 | Week 3 | Core cleanup completed |
| Phase 9 | Week 3-4 | Verification and validation |

**Total Duration:** 3-4 weeks

**Risk Level:** Low (incremental changes, backward compatibility maintained)

---

## Decision

**Recommendation:** Approve package split.

**Rationale:**
1. **Enables critical use cases** - Node.js simulation, headless testing, future platforms
2. **Clean architecture** - Proper separation of concerns (hexagonal architecture)
3. **Low risk** - Incremental migration, backward compatibility possible
4. **Future-proof** - Easy to add new platforms (terminal, mobile, Discord)
5. **Better performance** - Faster tests, smaller bundles, cleaner dependencies

**Next Steps:**
1. Create tracking issue in GitHub
2. Begin Phase 1 (package structure)
3. Communicate changes to users
4. Set up CI/CD for multi-package build

---

## Appendix: Package API Reference

### @spartan/core

```typescript
// Core game engine exports
export { GameRuntime } from './core/game-runtime';
export { GameLoop } from './core/game-loop';
export { SpatialSystem } from './core/spatial-system';
export { Scene } from './core/scene';
export { BaseSystem, BaseTickedSystem, BaseReactiveSystem } from './core/base-system';

// Input abstraction (no implementations)
export type { InputProvider, PlayerInput } from './core/input-provider';

// All game systems (fire, liquid, poison, doors, etc.)
export * from './systems';

// Entity types and helpers
export * from './entities';

// Traits and guards
export * from './traits';

// Config and constants
export * from './config';
```

### @spartan/web

```typescript
// Web input implementations
export { WebInputProvider } from './input/web-input-provider';
export { KeyboardInputManager } from './input/keyboard-input-manager';
export { MouseManager } from './input/mouse-manager';
export { GamepadManager } from './input/gamepad-manager';

// Web-specific systems
export { WebPlayerInputSystem } from './systems/player-input.system';

// Compatibility exports (deprecated)
export { WebInputProvider as InputManager } from './compat';
```

### @spartan/headless

```typescript
// Headless input implementations
export { HeadlessInputProvider } from './input/headless-input-provider';

// Headless-specific systems
export { HeadlessPlayerInputSystem } from './systems/player-input.system';
```

---

**End of ADR**