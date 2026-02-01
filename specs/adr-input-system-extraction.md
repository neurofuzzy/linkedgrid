# Architecture Decision Record: Input System Extraction

**Date:** January 31, 2026  
**Status:** Proposed  
**Component:** Input System (InputManager, PlayerInputSystem)  
**Author:** Architecture Review

---

## Executive Summary

The current Spartan framework includes web-specific input handling (`InputManager`, keyboard/mouse/gamepad managers) that couples the framework to browser DOM APIs. This ADR proposes extracting the input system into the web harness layer, making Spartan a truly platform-agnostic spatial game framework.

**Benefits:**
- **Platform Independence** - Spartan can run in Node.js, terminals, embedded systems
- **Cleaner Architecture** - Clear separation between framework (logic) and harness (I/O)
- **Better Testability** - No DOM mocking required for core framework tests
- **Reduced Dependencies** - Smaller surface area for the framework
- **Aligned with Philosophy** - Follows "minimal" and "explicit" Spartan principles

---

## Problem Statement

### Current Implementation

The Spartan framework currently includes platform-specific input handling:

```
packages/spartan/
├── input/
│   ├── input-manager.ts         # Browser DOM APIs
│   ├── keyboard-input-manager.ts # document.addEventListener
│   ├── mouse-manager.ts          # HTMLCanvasElement
│   ├── gamepad-manager.ts        # navigator.getGamepads()
│   └── headless-input-manager.ts # Testing only
└── systems/
    └── player-input.system.ts    # Depends on InputManager
```

### Issues with Current Approach

#### 1. **Platform Lock-In**

```typescript
// packages/spartan/input/input-manager.ts
export class InputManager {
  constructor(
    container: HTMLElement | null,  // ❌ Browser-specific
    canvas: HTMLCanvasElement | null, // ❌ Browser-specific
    config: InputConfig = {}
  ) {
    // DOM event listeners
    document.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    
    // Gamepad API
    const gamepads = navigator.getGamepads();
  }
}
```

**Impact:** Spartan cannot run in:
- Node.js servers (for multiplayer validation, bot AI)
- Terminal/CLI games (ncurses, blessed)
- Embedded systems (IoT devices, custom hardware)
- Native platforms (Electron without DOM, Tauri)
- Testing environments (without jsdom mocking)

#### 2. **Violates Framework-Harness Boundary**

Looking at Spartan's core components:

| Component | Platform-Agnostic? | Pure Logic? |
|-----------|-------------------|-------------|
| LinkedGrid | ✅ Yes | ✅ Yes |
| LinkedCell | ✅ Yes | ✅ Yes |
| SpatialSystem | ✅ Yes | ✅ Yes |
| Scene | ✅ Yes | ✅ Yes |
| GameManager | ✅ Yes | ✅ Yes |
| GameLoop | ✅ Yes | ✅ Yes |
| EntityStore | ✅ Yes | ✅ Yes |
| **InputManager** | ❌ **No** | ❌ **No** |

InputManager is the **only** component in Spartan that depends on platform-specific I/O.

#### 3. **Tight Coupling to Web Technologies**

```typescript
// packages/spartan/systems/player-input.system.ts
import { InputManager } from '../input/input-manager';

export class PlayerInputSystem extends BaseReactiveSystem {
  constructor(
    private gameManager: GameManager,
    private inputManager: InputManager  // ❌ Hard dependency
  ) {
    super();
  }
}
```

This means:
- PlayerInputSystem can't work without browser APIs
- Tests require DOM mocking or headless browsers
- Alternative input sources (network, AI) require wrapper classes
- Porting to new platforms requires rewriting input layer

#### 4. **Unclear Responsibility**

From `specs/spartan-responsibilities.md`:

> **PlayerInputSystem**  
> One Job: Translate input into movement intents

But what about `InputManager`? It's not listed in the responsibility matrix because **input acquisition is not a framework concern** - it's a harness concern.

**Framework Concerns (Spartan):**
- Spatial logic
- Entity management
- System orchestration
- Game state management

**Harness Concerns (Web, Terminal, etc.):**
- **Input acquisition** ← This is where InputManager belongs
- Output rendering
- Asset loading
- Audio playback

#### 5. **Testing Friction**

Current headless testing requires special `HeadlessInputManager`:

```typescript
// packages/spartan/input/headless-input-manager.ts
export class HeadlessInputManager {
  // Mimics InputManager but for testing
  // Duplicates interface, increases maintenance
}
```

This is a code smell indicating wrong abstraction level.

---

## Proposed Solution

### Overview

Extract input handling from Spartan into the web harness layer by:

1. **Define generic `InputProvider` interface** in Spartan (framework)
2. **Move `InputManager` hierarchy** to web harness (`dev/`)
3. **Refactor `PlayerInputSystem`** to accept `InputProvider`
4. **Create platform-specific providers** in respective harnesses

### Core Design: InputProvider Interface

```typescript
// packages/spartan/core/input-provider.ts

import { Direction } from './grid/direction';

/**
 * InputProvider - Abstract interface for game input.
 * 
 * Platform-agnostic contract between framework and harness.
 * Implementations handle platform-specific input acquisition.
 * 
 * @example Web Implementation
 * ```typescript
 * class WebInputProvider implements InputProvider {
 *   private manager: InputManager;
 *   getDirection() { return this.manager.getState().direction; }
 * }
 * ```
 * 
 * @example Network Implementation
 * ```typescript
 * class NetworkInputProvider implements InputProvider {
 *   private socket: WebSocket;
 *   getDirection() { return this.latestInputFromNetwork; }
 * }
 * ```
 * 
 * @example AI Implementation
 * ```typescript
 * class AIInputProvider implements InputProvider {
 *   private pathfinder: Pathfinder;
 *   getDirection() { return this.pathfinder.nextMove(); }
 * }
 * ```
 */
export interface InputProvider {
  /**
   * Get current movement direction.
   * Called each tick by PlayerInputSystem.
   */
  getDirection(): Direction;
  
  /**
   * Get primary action button state.
   * Used for: attack, interact, confirm
   */
  getAction(): boolean;
  
  /**
   * Get secondary action button state.
   * Used for: special ability, cancel, menu
   */
  getSecondary(): boolean;
  
  /**
   * Get start/pause button state (just pressed).
   * Used for: pause menu, scene transitions
   */
  getStart(): boolean;
  
  /**
   * Get restart button state (just pressed).
   * Used for: quick restart, reset level
   */
  getRestart(): boolean;
}
```

### Refactored PlayerInputSystem

```typescript
// packages/spartan/systems/player-input.system.ts

import { BaseReactiveSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import type { InputProvider } from '../core/input-provider';
import { Direction } from '../core/grid/direction';
import type { GameManager } from '../core/game-manager';

/**
 * PlayerInputSystem - Translates input into movement intents.
 * 
 * Platform-agnostic: Works with any InputProvider implementation.
 * 
 * @example Web Harness
 * ```typescript
 * const webInput = new WebInputProvider(container, canvas);
 * const system = new PlayerInputSystem(gameManager, webInput);
 * ```
 * 
 * @example AI Bot
 * ```typescript
 * const aiInput = new AIInputProvider(pathfinder);
 * const system = new PlayerInputSystem(gameManager, aiInput);
 * ```
 */
export class PlayerInputSystem extends BaseReactiveSystem {
  constructor(
    private gameManager: GameManager,
    private inputProvider: InputProvider  // ✓ Generic interface
  ) {
    super();
  }

  update(context: GameContext): void {
    const playerId = this.gameManager.gameState.playerEntityId;
    if (!playerId || playerId === 0) return;

    const pos = context.spatial.getEntityPosition(playerId);
    if (!pos) return;

    // Get input from provider (implementation unknown)
    const direction = this.inputProvider.getDirection();
    
    if (direction === Direction.NONE) return;

    const delta = this.directionToDelta(direction);
    const newX = pos.x + delta.dx;
    const newY = pos.y + delta.dy;

    const grid = context.spatial.grid;
    if (newX < 0 || newX >= grid.width || newY < 0 || newY >= grid.height) {
      return;
    }

    // Stage movement intent (no validation)
    context.spatial.move(playerId, newX, newY);
  }

  private directionToDelta(dir: Direction): { dx: number; dy: number } {
    switch (dir) {
      case Direction.UP: return { dx: 0, dy: -1 };
      case Direction.DOWN: return { dx: 0, dy: 1 };
      case Direction.LEFT: return { dx: -1, dy: 0 };
      case Direction.RIGHT: return { dx: 1, dy: 0 };
      default: return { dx: 0, dy: 0 };
    }
  }
}
```

### Web Harness Implementation

```typescript
// dev/input/web-input-provider.ts

import { InputProvider } from '../../packages/spartan/core/input-provider';
import { Direction } from '../../packages/spartan/core/grid/direction';
import { InputManager } from './input-manager';

/**
 * WebInputProvider - Browser-based input using DOM APIs.
 * 
 * Adapts browser InputManager to framework InputProvider interface.
 * Handles keyboard, mouse, and gamepad input.
 */
export class WebInputProvider implements InputProvider {
  private manager: InputManager;
  
  constructor(
    container: HTMLElement | null,
    canvas: HTMLCanvasElement | null,
    config: {
      cellSize?: number;
      cellGap?: number;
      bufferInput?: boolean;
      directionMode?: 'continuous' | 'tap';
    } = {}
  ) {
    // InputManager lives in web harness now
    this.manager = new InputManager(container, canvas, config);
    this.manager.enableKeyboard().enableBuffering(true);
  }
  
  getDirection(): Direction {
    return this.manager.getState().direction;
  }
  
  getAction(): boolean {
    return this.manager.getState().action;
  }
  
  getSecondary(): boolean {
    return this.manager.getState().secondary;
  }
  
  getStart(): boolean {
    return this.manager.getState().start;
  }
  
  getRestart(): boolean {
    return this.manager.getState().restart;
  }
  
  /**
   * Enable mouse input.
   * Web-specific feature exposed through provider.
   */
  enableMouse(): this {
    this.manager.enableMouse();
    return this;
  }
  
  /**
   * Enable gamepad input.
   * Web-specific feature exposed through provider.
   */
  enableGamepad(): this {
    this.manager.enableGamepad();
    return this;
  }
  
  /**
   * Cleanup DOM event listeners.
   * Must be called when provider is no longer needed.
   */
  destroy(): void {
    this.manager.destroy();
  }
}
```

### Testing Implementation

```typescript
// packages/spartan/test/test-input-provider.ts

import { InputProvider } from '../core/input-provider';
import { Direction } from '../core/grid/direction';

/**
 * TestInputProvider - Programmatic input for tests.
 * 
 * Allows tests to inject input without DOM APIs.
 * Simple, deterministic, no mocking required.
 */
export class TestInputProvider implements InputProvider {
  private direction: Direction = Direction.NONE;
  private action: boolean = false;
  private secondary: boolean = false;
  private start: boolean = false;
  private restart: boolean = false;
  
  // Setters for test control
  setDirection(dir: Direction): this {
    this.direction = dir;
    return this;
  }
  
  setAction(pressed: boolean): this {
    this.action = pressed;
    return this;
  }
  
  setSecondary(pressed: boolean): this {
    this.secondary = pressed;
    return this;
  }
  
  setStart(pressed: boolean): this {
    this.start = pressed;
    return this;
  }
  
  setRestart(pressed: boolean): this {
    this.restart = pressed;
    return this;
  }
  
  // Clear all input (convenience)
  clear(): this {
    this.direction = Direction.NONE;
    this.action = false;
    this.secondary = false;
    this.start = false;
    this.restart = false;
    return this;
  }
  
  // InputProvider interface
  getDirection(): Direction { return this.direction; }
  getAction(): boolean { return this.action; }
  getSecondary(): boolean { return this.secondary; }
  getStart(): boolean { return this.start; }
  getRestart(): boolean { return this.restart; }
}
```

### Usage in Scene Loader

```typescript
// dev/scene-loader.ts

import { WebInputProvider } from './input/web-input-provider';
import { TestInputProvider } from '../packages/spartan/test/test-input-provider';

export class SceneLoader {
  load(config: SceneConfig): GameRuntime {
    // ... scene setup ...
    
    // Create input provider based on config
    if (config.input && config.input.type !== 'none') {
      const provider = this.createInputProvider(config.input, this.container);
      
      // PlayerInputSystem works with any provider
      const playerInputSystem = new PlayerInputSystem(runtime.game, provider);
      runtime.addSystem(playerInputSystem);
      
      // Store for cleanup
      runtime.inputProvider = provider;
    }
    
    return runtime;
  }
  
  private createInputProvider(
    config: SceneConfig['input'],
    container?: HTMLElement | null
  ): InputProvider {
    if (config?.type === 'headless' || config?.type === 'test') {
      return new TestInputProvider();
    }
    
    // Web input (keyboard/mouse/gamepad)
    const options = {
      cellSize: config?.options?.cellSize || 24,
      cellGap: config?.options?.cellGap || 0,
      bufferInput: config?.options?.bufferInput || false,
      directionMode: config?.options?.directionMode || 'continuous',
    };
    
    return new WebInputProvider(container ?? null, null, options);
  }
}
```

---

## New Capabilities Enabled

### 1. Network-Based Input

```typescript
// server/input/network-input-provider.ts

export class NetworkInputProvider implements InputProvider {
  private socket: WebSocket;
  private latestInput: {
    direction: Direction;
    action: boolean;
    // ...
  };
  
  constructor(socket: WebSocket) {
    this.socket = socket;
    this.socket.on('input', (data) => {
      this.latestInput = data;
    });
  }
  
  getDirection(): Direction {
    return this.latestInput.direction;
  }
  
  // ... other methods
}

// Server-side game validation
const netInput = new NetworkInputProvider(clientSocket);
const playerSystem = new PlayerInputSystem(game, netInput);
```

### 2. AI Bot Input

```typescript
// ai/ai-input-provider.ts

export class AIInputProvider implements InputProvider {
  private pathfinder: Pathfinder;
  private targetPos: { x: number; y: number };
  
  constructor(pathfinder: Pathfinder) {
    this.pathfinder = pathfinder;
  }
  
  setTarget(x: number, y: number): void {
    this.targetPos = { x, y };
  }
  
  getDirection(): Direction {
    // AI calculates next move
    const currentPos = this.getCurrentPosition();
    const path = this.pathfinder.findPath(currentPos, this.targetPos);
    return this.pathToDirection(path);
  }
  
  // AI bots don't press action buttons (unless you want them to!)
  getAction(): boolean { return false; }
  getSecondary(): boolean { return false; }
  getStart(): boolean { return false; }
  getRestart(): boolean { return false; }
}
```

### 3. Terminal/CLI Input

```typescript
// terminal/input/terminal-input-provider.ts

import * as readline from 'readline';

export class TerminalInputProvider implements InputProvider {
  private currentDirection: Direction = Direction.NONE;
  
  constructor() {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    
    process.stdin.on('keypress', (str, key) => {
      if (key.name === 'up') this.currentDirection = Direction.UP;
      if (key.name === 'down') this.currentDirection = Direction.DOWN;
      if (key.name === 'left') this.currentDirection = Direction.LEFT;
      if (key.name === 'right') this.currentDirection = Direction.RIGHT;
    });
  }
  
  getDirection(): Direction {
    const dir = this.currentDirection;
    this.currentDirection = Direction.NONE; // Tap mode
    return dir;
  }
  
  getAction(): boolean { return false; }
  getSecondary(): boolean { return false; }
  getStart(): boolean { return false; }
  getRestart(): boolean { return false; }
}
```

### 4. Replay/Recording System

```typescript
// replay/replay-input-provider.ts

export class ReplayInputProvider implements InputProvider {
  private recording: Array<{
    tick: number;
    direction: Direction;
    action: boolean;
  }>;
  private currentTick: number = 0;
  
  constructor(recording: Recording) {
    this.recording = recording.inputs;
  }
  
  advance(): void {
    this.currentTick++;
  }
  
  getDirection(): Direction {
    const input = this.recording.find(r => r.tick === this.currentTick);
    return input?.direction || Direction.NONE;
  }
  
  getAction(): boolean {
    const input = this.recording.find(r => r.tick === this.currentTick);
    return input?.action || false;
  }
  
  // ... other methods
}

// Deterministic replay of recorded game
const replay = new ReplayInputProvider(savedRecording);
const game = GameRuntime.new(config);
game.on('tick', () => replay.advance());
```

---

## File Reorganization

### Before

```
packages/spartan/
├── input/
│   ├── input-manager.ts          # 1278 lines
│   ├── keyboard-input-manager.ts
│   ├── mouse-manager.ts
│   ├── gamepad-manager.ts
│   ├── headless-input-manager.ts
│   └── index.ts
├── systems/
│   └── player-input.system.ts
└── index.ts  # Exports InputManager
```

### After

```
packages/spartan/
├── core/
│   └── input-provider.ts         # Interface only (~50 lines)
├── systems/
│   └── player-input.system.ts    # Uses InputProvider
├── test/
│   └── test-input-provider.ts    # Simple implementation
└── index.ts  # Exports InputProvider interface

dev/
├── input/
│   ├── input-manager.ts          # Moved from spartan/
│   ├── keyboard-input-manager.ts # Moved from spartan/
│   ├── mouse-manager.ts          # Moved from spartan/
│   ├── gamepad-manager.ts        # Moved from spartan/
│   ├── web-input-provider.ts     # NEW: Adapter
│   └── index.ts
└── scene-loader.ts               # Uses WebInputProvider
```

### Dependencies After Change

**Spartan (framework):**
- ✅ Zero DOM dependencies
- ✅ Zero browser API dependencies
- ✅ Pure TypeScript logic
- ✅ Platform-agnostic

**Web Harness (dev/):**
- Uses DOM APIs
- Uses browser APIs
- Implements WebInputProvider
- Depends on Spartan (one-way)

---

## Migration Strategy

### Phase 1: Create InputProvider Interface

1. Add `packages/spartan/core/input-provider.ts`
2. Define interface with minimal methods
3. Export from `packages/spartan/index.ts`

**Files Changed:** 2  
**Breaking Changes:** None  
**Risk:** Very Low

### Phase 2: Create Test Provider

1. Add `packages/spartan/test/test-input-provider.ts`
2. Implement `InputProvider` interface
3. Use in existing tests

**Files Changed:** 1 + test files  
**Breaking Changes:** None  
**Risk:** Low

### Phase 3: Refactor PlayerInputSystem

1. Change `PlayerInputSystem` constructor parameter
2. Change from `InputManager` to `InputProvider`
3. Update method calls to interface methods

**Files Changed:** 1  
**Breaking Changes:** Yes (constructor signature)  
**Risk:** Medium

### Phase 4: Create WebInputProvider

1. Add `dev/input/web-input-provider.ts`
2. Adapt `InputManager` to `InputProvider` interface
3. Handle cleanup properly

**Files Changed:** 1 (new)  
**Breaking Changes:** None  
**Risk:** Low

### Phase 5: Move Input Managers

1. Move `packages/spartan/input/` → `dev/input/`
2. Update import paths in WebInputProvider
3. Update exports

**Files Changed:** ~10 (moves + imports)  
**Breaking Changes:** Yes (import paths)  
**Risk:** Medium

### Phase 6: Update Scene Loader

1. Change scene-loader.ts to use WebInputProvider
2. Update input configuration logic
3. Handle cleanup in GameRuntime

**Files Changed:** 2  
**Breaking Changes:** None (internal to dev/)  
**Risk:** Low

### Phase 7: Update Exports

1. Remove input exports from `packages/spartan/index.ts`
2. Add input exports to `dev/input/index.ts` (if needed)
3. Update documentation

**Files Changed:** 2 + docs  
**Breaking Changes:** Yes (removed exports)  
**Risk:** Low

### Phase 8: Update Tests

1. Update tests to use TestInputProvider
2. Remove DOM mocking from Spartan tests
3. Update visual tests in dev/

**Files Changed:** ~15 test files  
**Breaking Changes:** None  
**Risk:** Low

---

## Impact Analysis

### Breaking Changes

**Public API Changes:**

```typescript
// BEFORE
import { InputManager } from '@linkedgrid/spartan';
const input = new InputManager(container, canvas, config);
const system = new PlayerInputSystem(game, input);

// AFTER
import { InputProvider } from '@linkedgrid/spartan';
import { WebInputProvider } from '@linkedgrid/dev'; // Or your web harness
const input = new WebInputProvider(container, canvas, config);
const system = new PlayerInputSystem(game, input);
```

**Who is affected:**
- Anyone instantiating PlayerInputSystem directly
- Anyone importing InputManager from Spartan
- Anyone depending on input manager exports

**Who is NOT affected:**
- Users of scene-loader.ts (internal change)
- Systems using GameContext (no change)
- Users of SpatialSystem, GameLoop, etc. (no change)

### Benefits

**Framework (Spartan):**
- ✅ Zero platform dependencies
- ✅ Smaller bundle size (~1500 lines removed)
- ✅ Faster tests (no DOM mocking)
- ✅ More focused responsibility
- ✅ Portable to any platform

**Web Harness:**
- ✅ Clear ownership of web-specific code
- ✅ Can evolve independently
- ✅ Can add web-specific features freely
- ✅ Better organized

**New Platforms:**
- ✅ Terminal games (blessed, ink)
- ✅ Node.js servers (multiplayer)
- ✅ Native apps (Tauri, Electron)
- ✅ Embedded systems
- ✅ Custom hardware

**Testing:**
- ✅ No jsdom required
- ✅ No DOM mocking
- ✅ Simpler test setup
- ✅ Faster test execution
- ✅ More reliable CI

### Metrics

**Lines of Code:**

| Component | Before | After | Change |
|-----------|--------|-------|--------|
| Spartan Core | ~6000 | ~4500 | -25% |
| Input System | ~1500 | ~50 (interface) | -97% |
| Web Harness | ~1000 | ~2500 | +150% |

**Dependencies:**

| Package | Before | After |
|---------|--------|-------|
| Spartan | DOM APIs, Browser APIs | None |
| Web Harness | DOM APIs | DOM APIs |

**Test Setup:**

| Environment | Before | After |
|-------------|--------|-------|
| Spartan Tests | jsdom + mocking | Pure Node.js |
| Web Harness Tests | jsdom + mocking | jsdom + mocking |

---

## Alignment with Spartan Principles

### 1. Minimal - Only what is necessary

**Before:** Spartan includes web-specific input handling  
**After:** Spartan includes only input interface (minimal contract)

✅ **Improvement:** Framework doesn't carry web dependencies

### 2. Explicit - No magic, clear intent

**Before:** PlayerInputSystem implicitly requires browser  
**After:** PlayerInputSystem explicitly requires InputProvider (any implementation)

✅ **Improvement:** Intent is clear, dependency is explicit

### 3. Testable - Everything must be verifiable

**Before:** Tests require DOM mocking (jsdom, happy-dom)  
**After:** Tests use simple TestInputProvider (no mocking)

✅ **Improvement:** Simpler, faster, more reliable tests

### 4. Visual - Show, don't just tell

**Before:** Visual tests require real browser input  
**After:** Visual tests can inject input programmatically

✅ **Improvement:** Better visual test control

### 5. Deterministic - Same input = same output

**Before:** Browser input may have timing/event quirks  
**After:** Framework has no opinion on input timing (harness handles it)

✅ **Improvement:** Framework is pure deterministic logic

---

## Alternatives Considered

### Alternative 1: Keep Status Quo

**Pros:**
- No migration effort
- No breaking changes

**Cons:**
- Spartan remains web-only
- DOM dependencies remain
- Testing requires mocking
- Violates "minimal" principle

**Decision:** Rejected - Technical debt accumulates

### Alternative 2: Abstract Input in Place

Keep InputManager in Spartan but make it accept adapters:

```typescript
// Still in packages/spartan/input/
export abstract class InputAdapter {
  abstract getDirection(): Direction;
}

export class InputManager {
  constructor(private adapter: InputAdapter) {}
}
```

**Pros:**
- Smaller migration
- Less reorganization

**Cons:**
- Still couples framework to input concept
- InputManager still in wrong layer
- Doesn't fully solve platform independence
- Confusing responsibility (adapter pattern inside framework)

**Decision:** Rejected - Incomplete solution

### Alternative 3: Complete Rewrite

Rewrite entire input system with new architecture:

**Pros:**
- Fresh start
- Could improve design

**Cons:**
- High risk
- Large scope
- Breaks everything
- Loses battle-tested code

**Decision:** Rejected - Unnecessarily risky

### Alternative 4: Gradual Interface Extraction (Chosen)

Extract interface, keep implementations, move over time:

**Pros:**
- Low risk (interface-based migration)
- Gradual (can pause at any phase)
- Preserves working code
- Clear steps
- Testable at each phase

**Cons:**
- Takes longer
- Temporary duplication during migration

**Decision:** ✅ **Accepted** - Best balance of safety and improvement

---

## Success Criteria

### Must Have

- ✅ Spartan has zero DOM/browser dependencies
- ✅ PlayerInputSystem works with InputProvider interface
- ✅ Tests run without DOM mocking
- ✅ Scene loader works with WebInputProvider
- ✅ All existing tests pass

### Should Have

- ✅ TestInputProvider for easy testing
- ✅ Clear migration guide
- ✅ Updated documentation
- ✅ Example implementations (web, test, AI)

### Could Have

- Terminal input provider example
- Network input provider example
- Replay system example
- Performance benchmarks

### Won't Have (Out of Scope)

- Mobile touch input (harness concern)
- Gesture recognition (harness concern)
- Input recording/replay system (future enhancement)
- Advanced input buffering (harness concern)

---

## References

### Internal

- **Responsibility Matrix:** `specs/spartan-responsibilities.md`
- **Development Principles:** `specs/spartan-dev-rules.md`
- **Framework Conventions:** `specs/framework-conventions.md`
- **Developer Context:** `.ai/DEVELOPER_CONTEXT.md`

### External

- **Hexagonal Architecture:** Input is a port, providers are adapters
- **Dependency Inversion Principle:** Depend on abstractions (InputProvider), not concretions (InputManager)
- **Interface Segregation Principle:** Minimal interface, only what's needed

### Current Implementation

- `packages/spartan/input/input-manager.ts` - 1278 lines
- `packages/spartan/systems/player-input.system.ts` - 115 lines
- `dev/scene-loader.ts` - Lines 173-190 (input creation)

---

## Decision

**Status:** ✅ **Recommended for Approval**

### Rationale

1. **Architectural Clarity:** Separates framework from harness concerns
2. **Platform Independence:** Enables non-web platforms
3. **Testability:** Removes DOM mocking requirement
4. **Maintainability:** Clearer boundaries, focused responsibilities
5. **Extensibility:** Easy to add new input sources
6. **Risk Management:** Gradual migration path, low risk
7. **Alignment:** Follows all five Spartan principles

### Implementation Timeline

**Phase 1-2 (Week 1):** Interface + Test Provider  
**Phase 3-4 (Week 2):** PlayerInputSystem + WebInputProvider  
**Phase 5-6 (Week 3):** Move files + Update scene loader  
**Phase 7-8 (Week 4):** Update exports + tests + docs

**Total Effort:** ~4 weeks  
**Risk Level:** Low to Medium  
**Impact:** High (enables new platforms)

### Approval Required From

- Framework maintainers
- Web harness maintainers  
- Testing team
- Documentation team

---

## Appendix A: Complete InputProvider Interface

```typescript
// packages/spartan/core/input-provider.ts

import { Direction } from './grid/direction';

/**
 * InputProvider - Platform-agnostic input interface.
 * 
 * Abstracts input acquisition from the game framework.
 * Implementations handle platform-specific details.
 * 
 * Design Principles:
 * - Minimal: Only essential input methods
 * - Stateless: No internal state requirements
 * - Synchronous: Called each tick, returns current state
 * - Pull-based: Framework pulls input, doesn't push
 */
export interface InputProvider {
  /**
   * Get current movement direction.
   * 
   * @returns Direction enum (UP, DOWN, LEFT, RIGHT, NONE)
   * 
   * Called by PlayerInputSystem each tick.
   * Implementation should return current held direction or NONE.
   */
  getDirection(): Direction;
  
  /**
   * Get primary action button state.
   * 
   * @returns true if action button is pressed
   * 
   * Typical usage:
   * - Attack
   * - Interact with objects
   * - Confirm in menus
   * 
   * Web: Space, Enter, Left Click, A button (gamepad)
   */
  getAction(): boolean;
  
  /**
   * Get secondary action button state.
   * 
   * @returns true if secondary button is pressed
   * 
   * Typical usage:
   * - Special ability
   * - Cancel action
   * - Secondary attack
   * 
   * Web: Right Click, B button (gamepad)
   */
  getSecondary(): boolean;
  
  /**
   * Get start/pause button state (just pressed).
   * 
   * @returns true if start pressed THIS frame
   * 
   * Should return true only on initial press, not while held.
   * Used for pause menus, scene transitions.
   * 
   * Web: Enter key, Start button (gamepad)
   */
  getStart(): boolean;
  
  /**
   * Get restart button state (just pressed).
   * 
   * @returns true if restart pressed THIS frame
   * 
   * Should return true only on initial press, not while held.
   * Used for quick restart, reset level.
   * 
   * Web: R key
   */
  getRestart(): boolean;
}

/**
 * Optional: Extended input provider for advanced features.
 * 
 * Framework doesn't require this, but harnesses can implement
 * additional capabilities for game-specific needs.
 */
export interface ExtendedInputProvider extends InputProvider {
  /**
   * Get raw key states (advanced).
   * Used for: custom key bindings, cheat codes, debug commands
   */
  isKeyPressed?(key: string): boolean;
  
  /**
   * Get mouse/pointer position in grid coordinates (advanced).
   * Used for: point-and-click, target selection, mouse control
   */
  getPointerPosition?(): { x: number; y: number } | null;
  
  /**
   * Get analog stick values (advanced).
   * Used for: twin-stick shooters, camera control, aim assist
   */
  getAnalogInput?(): { x: number; y: number };
}
```

---

## Appendix B: Example Implementations

### Web Input Provider (Complete)

```typescript
// dev/input/web-input-provider.ts

import { InputProvider } from '../../packages/spartan/core/input-provider';
import { Direction } from '../../packages/spartan/core/grid/direction';
import { InputManager } from './input-manager';

export interface WebInputConfig {
  cellSize?: number;
  cellGap?: number;
  bufferInput?: boolean;
  directionMode?: 'continuous' | 'tap';
  enableMouse?: boolean;
  enableGamepad?: boolean;
}

export class WebInputProvider implements InputProvider {
  private manager: InputManager;
  
  constructor(
    container: HTMLElement | null,
    canvas: HTMLCanvasElement | null,
    config: WebInputConfig = {}
  ) {
    this.manager = new InputManager(container, canvas, {
      cellSize: config.cellSize ?? 24,
      cellGap: config.cellGap ?? 0,
      bufferInput: config.bufferInput ?? false,
      directionMode: config.directionMode ?? 'continuous',
    });
    
    // Enable keyboard by default
    this.manager.enableKeyboard().enableBuffering(true);
    
    // Optional: Enable mouse
    if (config.enableMouse) {
      this.manager.enableMouse();
    }
    
    // Optional: Enable gamepad
    if (config.enableGamepad) {
      this.manager.enableGamepad();
    }
  }
  
  // InputProvider interface
  getDirection(): Direction {
    return this.manager.getState().direction;
  }
  
  getAction(): boolean {
    return this.manager.getState().action;
  }
  
  getSecondary(): boolean {
    return this.manager.getState().secondary;
  }
  
  getStart(): boolean {
    return this.manager.getState().start;
  }
  
  getRestart(): boolean {
    return this.manager.getState().restart;
  }
  
  // Web-specific extensions
  getMousePosition(): { x: number; y: number } {
    const mouse = this.manager.getState().mouse;
    return { x: mouse.x, y: mouse.y };
  }
  
  getGamepadAnalog(): { x: number; y: number } {
    const gp = this.manager.getState().gamepad;
    return { x: gp.stickX, y: gp.stickY };
  }
  
  // Cleanup
  destroy(): void {
    this.manager.destroy();
  }
}
```

### AI Input Provider (Example)

```typescript
// examples/ai-input-provider.ts

import { InputProvider } from '../packages/spartan/core/input-provider';
import { Direction } from '../packages/spartan/core/grid/direction';
import type { SpatialSystem } from '../packages/spartan/core/spatial-system';

export class AIInputProvider implements InputProvider {
  private entityId: number;
  private spatial: SpatialSystem;
  private targetX: number;
  private targetY: number;
  
  constructor(entityId: number, spatial: SpatialSystem) {
    this.entityId = entityId;
    this.spatial = spatial;
  }
  
  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }
  
  getDirection(): Direction {
    const pos = this.spatial.getEntityPosition(this.entityId);
    if (!pos) return Direction.NONE;
    
    // Simple AI: Move toward target
    const dx = this.targetX - pos.x;
    const dy = this.targetY - pos.y;
    
    // Prefer horizontal or vertical movement
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else if (dy !== 0) {
      return dy > 0 ? Direction.DOWN : Direction.UP;
    }
    
    return Direction.NONE;
  }
  
  // AI doesn't use buttons
  getAction(): boolean { return false; }
  getSecondary(): boolean { return false; }
  getStart(): boolean { return false; }
  getRestart(): boolean { return false; }
}
```

---

**End of ADR**
