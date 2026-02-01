# ADR: Extract Input System to spartan-web Package

**Date:** February 1, 2026  
**Status:** Proposed  
**Author:** Architecture Review

---

## Summary

Extract web-specific input handling from `spartan` into a new `spartan-web` package, making the core framework platform-agnostic while providing a minimal, reusable web input layer.

---

## Problem

The Spartan core includes browser-specific code (`InputManager`, keyboard/mouse/gamepad managers) that:

1. **Prevents Node.js usage** — can't run simulations, tests, or bots without DOM shims
2. **Violates separation of concerns** — framework should be logic-only, I/O is a harness concern
3. **Forces DOM mocking in tests** — slower, more complex test setup

---

## Solution

### Package Structure

```
packages/
├── spartan/                        # Core (platform-agnostic, unchanged)
│   ├── core/
│   │   └── input-provider.ts       # NEW: Interface only
│   ├── systems/
│   │   └── player-input.system.ts  # Uses InputProvider interface
│   └── test/
│       └── test-input-provider.ts  # For framework tests
│
└── spartan-web/                    # NEW: Minimal web harness
    └── input/
        ├── input-manager.ts            # Moved from spartan/input/
        ├── keyboard-input-manager.ts
        ├── mouse-manager.ts
        ├── gamepad-manager.ts
        └── web-input-provider.ts       # Implements InputProvider
```

### Core Interface

```typescript
// packages/spartan/core/input-provider.ts
export interface InputProvider {
  getDirection(): Direction;
  getAction(): boolean;
  getSecondary(): boolean;
  getStart(): boolean;
  getRestart(): boolean;
}
```

### Web Provider

```typescript
// packages/spartan-web/input/web-input-provider.ts
export class WebInputProvider implements InputProvider {
  private manager: InputManager;
  
  constructor(container: HTMLElement | null, canvas: HTMLCanvasElement | null, config?: WebInputConfig) {
    this.manager = new InputManager(container, canvas, config);
  }
  
  getDirection(): Direction { return this.manager.getState().direction; }
  getAction(): boolean { return this.manager.getState().action; }
  // ... etc
  
  destroy(): void { this.manager.destroy(); }
}
```

### Usage

```typescript
// dev/, examples, docs, or any web consumer
import { PlayerInputSystem } from '@linkedgrid/spartan';
import { WebInputProvider } from '@linkedgrid/spartan-web';

const provider = new WebInputProvider(container, canvas);
const system = new PlayerInputSystem(gameManager, provider);
runtime.addSystem(system);
```

---

## Migration Steps

| Phase | Work | Risk |
|-------|------|------|
| 1. Create `InputProvider` interface | Add to `spartan/core/`, export from index | None |
| 2. Create `TestInputProvider` | Add to `spartan/test/` | None |
| 3. Refactor `PlayerInputSystem` | Accept `InputProvider` instead of `InputManager` | Medium |
| 4. Create `spartan-web` package | New package with package.json | Low |
| 5. Move input managers | `spartan/input/` → `spartan-web/input/` | Medium |
| 6. Create `WebInputProvider` | Adapter implementing `InputProvider` | Low |
| 7. Update `dev/` | Import from `spartan-web` | Low |
| 8. Update tests | Use `TestInputProvider` | Low |

**Estimated effort:** 2-3 days

---

## What This Enables

- **Node.js simulation** — run game logic without browser
- **Simpler tests** — no DOM mocking needed for core
- **Reusable web harness** — `dev/`, examples, docs all import `spartan-web`
- **Future platforms** — terminal, mobile, network can implement `InputProvider`

---

## What This Does NOT Do

- ❌ Create elaborate platform hierarchy (no `@spartan/headless` package)
- ❌ Duplicate `PlayerInputSystem` per platform
- ❌ Build a "rich" web harness with extra features

The scope is intentionally minimal: **extract what exists, provide clean interface**.

---

## Decision

**Approved for implementation.**

Creates clean separation without over-engineering. `spartan-web` is a thin layer that `dev/`, examples, and documentation can all consume.
