# InputManager Specification

> **CRITICAL**: This document specifies the WORKING input system. Any modifications to `input-manager.ts` MUST preserve this behavior exactly. The input system is extremely sensitive to timing issues.

## Reference Implementation

The canonical working implementation is preserved at:
```
packages/spartan-web/input/input-manager-WORKING.ts
```

**Before making ANY changes to input-manager.ts, diff against this file.**

---

## Architecture Overview

The InputManager is an **event-driven** input system that:
1. Captures keyboard, mouse, and gamepad events via DOM listeners
2. Maintains internal state that is **continuously updated** by events
3. Provides a `getState()` method that returns a snapshot of current input

### Key Design Principles

1. **Events update state immediately** - No polling for keyboard/mouse
2. **getState() is idempotent within a frame** - Multiple calls return consistent state
3. **One-shot events are cleared AFTER getState()** - Not during event handling
4. **keysJustPressed captures quick taps** - Critical for not dropping inputs

---

## State Model

### InputState Interface

```typescript
interface InputState {
  direction: Direction;      // Combined direction (arrows OR WASD)
  action: boolean;           // Primary action (space, enter, click, A button)
  secondary: boolean;        // Secondary action (right-click, B button)
  start: boolean;            // Start/pause (Enter just pressed)
  restart: boolean;          // Restart (R just pressed)
  shootDirection: Direction; // WASD-only direction for twin-stick
  mouse: MouseState;         // Mouse position and buttons
  gamepad: GamepadState;     // Gamepad state
  keys: Set<string>;         // Raw keys currently held
}
```

### Internal Tracking

```typescript
// Keys currently held down (updated on keydown/keyup)
private keysDown = new Set<string>();

// Keys pressed THIS FRAME (cleared after getState())
private keysJustPressed = new Set<string>();

// One-shot action flag for Enter key
private actionKeyPressed = false;
```

---

## Critical Timing Behavior

### The Quick-Tap Problem

Users can press and release a key between game ticks:

```
Time:     0ms    16ms    32ms    48ms
          |       |       |       |
Keydown   X
Keyup           X
Tick                      X

At tick time, keysDown is EMPTY because key was released!
```

### Solution: keysJustPressed

```typescript
// On keydown (if not repeat):
this.keysDown.add(e.key);
this.keysJustPressed.add(e.key);  // Track that it was pressed

// On keyup:
this.keysDown.delete(e.key);
// keysJustPressed is NOT cleared here!

// In getState():
// 1. Update state from keysJustPressed AND keysDown
// 2. Return state copy
// 3. THEN clear keysJustPressed
```

### getCurrentDirection() Logic

```typescript
private getCurrentDirection(): Direction {
  // TAP MODE: Only check keysJustPressed
  if (this.config.directionMode === 'tap') {
    for (const key of this.keysJustPressed) {
      const dir = this.getDirectionFromKey(key);
      if (dir !== null && dir !== Direction.NONE) {
        return dir;
      }
    }
    return Direction.NONE;
  }

  // CONTINUOUS MODE: Check keysJustPressed first, then keysDown
  for (const key of this.keysJustPressed) {
    const dir = this.getDirectionFromKey(key);
    if (dir !== null && dir !== Direction.NONE) {
      if (this.keysDown.has(key)) {
        return dir;  // Still held = use it
      }
    }
  }

  // Fall back to held keys (arrow keys take priority)
  if (this.keysDown.has('ArrowUp')) return Direction.UP;
  if (this.keysDown.has('ArrowDown')) return Direction.DOWN;
  if (this.keysDown.has('ArrowLeft')) return Direction.LEFT;
  if (this.keysDown.has('ArrowRight')) return Direction.RIGHT;
  if (this.keysDown.has('w') || this.keysDown.has('W')) return Direction.UP;
  // ... etc
  return Direction.NONE;
}
```

---

## Event Handling

### Keydown Handler

```typescript
this.boundKeyDown = (e: KeyboardEvent) => {
  // 1. Prevent default for game keys (arrows, WASD, etc.)
  if (this.isGameKey(e.key)) {
    e.preventDefault();
  }

  // 2. Skip if keyboard disabled
  if (!this.keyboardEnabled) return;

  // 3. TAP MODE: Ignore key repeats
  if (this.config.directionMode === 'tap' && e.repeat) {
    return;
  }

  // 4. Track held keys
  this.keysDown.add(e.key);

  // 5. Track just-pressed (only on initial press, not repeats)
  if (!e.repeat) {
    this.keysJustPressed.add(e.key);

    // Buffer for low-framerate games
    if (this.bufferEnabled) {
      const dir = this.getDirectionFromKey(e.key);
      if (dir !== null && dir !== Direction.NONE) {
        this.directionBufferInternal.push(dir);
      }
    }

    // Enter as one-shot action
    if (e.key === 'Enter') {
      this.actionKeyPressed = true;
    }
  }

  // 6. Update state immediately
  this.updateStateFromEvents();
};
```

### Keyup Handler

```typescript
this.boundKeyUp = (e: KeyboardEvent) => {
  // Always clear from keysDown
  this.keysDown.delete(e.key);

  // Update state if enabled
  if (this.keyboardEnabled) {
    this.updateStateFromEvents();
  }
};
```

---

## getState() Contract

```typescript
getState(): InputState {
  // 1. Update state from current input
  this.updateStateFromEvents(true);  // true = consume from buffer

  // 2. Copy state to return
  const result = { ...this.state };

  // 3. Clear one-shot events for NEXT frame
  this.mouseClicked = false;
  this.mouseWheelDeltaX = 0;
  this.mouseWheelDeltaY = 0;
  this.keysJustPressed.clear();  // CRITICAL: Clear AFTER copying state
  this.actionKeyPressed = false;

  // 4. Update internal state to match
  this.state.mouse.clicked = false;
  this.state.mouse.wheelDeltaX = 0;
  this.state.mouse.wheelDeltaY = 0;

  return result;
}
```

**CRITICAL**: `keysJustPressed.clear()` happens AFTER the state is copied. This ensures quick taps are captured.

---

## Direction Modes

### Continuous Mode (Default)

- Direction stays active while key is held
- Good for action games, real-time movement
- `keysJustPressed` ensures quick taps aren't dropped

### Tap Mode

- Each keypress = one frame of direction
- Direction clears after being read
- Good for puzzle games, turn-based movement
- Only uses `keysJustPressed`, ignores held keys

---

## Input Buffering

Two buffering systems exist:

### 1. Direction Buffer (for low-framerate games)

```typescript
private directionBufferInternal: Direction[] = [];
```

- Captures all direction keypresses as a queue
- `getState(true)` consumes from buffer first
- Ensures no keypresses are lost at low framerates

### 2. Legacy Buffered Direction (for sticky controls)

```typescript
private bufferedDirection: Direction;
private bufferedTimestamp: number;
```

- Remembers last direction for `bufferTimeMs`
- Used for "corner turning" in Pac-Man style games
- Access via `getBufferedDirection()`

---

## What NOT to Do

### DO NOT call getState() multiple times per frame

```typescript
// BAD - second call gets cleared state
const state1 = input.getState();
const state2 = input.getState();  // keysJustPressed is empty!

// GOOD - call once, reuse
const state = input.getState();
system1.process(state);
system2.process(state);
```

### DO NOT clear keysJustPressed in event handlers

```typescript
// BAD - loses quick taps
this.boundKeyDown = (e) => {
  this.keysJustPressed.add(e.key);
  this.updateStateFromEvents();
  this.keysJustPressed.clear();  // WRONG! Will lose the input
};
```

### DO NOT add complexity to key tracking

The current system is minimal and works. Attempts to add:
- Per-frame caching
- beginFrame() calls
- Separate arrow/WASD tracking
- peekState() methods

Have ALL resulted in dropped inputs. **Keep it simple.**

---

## Testing Input

Use `HeadlessInputManager` for tests:

```typescript
const headless = new HeadlessInputManager();
headless.enable();
headless.setDirection(Direction.RIGHT);

const provider = headless.asInputProvider();
expect(provider.getMoveDirection()).toBe(Direction.RIGHT);
```

For manual testing:
1. Load a game in playground
2. Rapidly tap arrow keys
3. EVERY tap should register movement
4. If ANY taps are dropped, the input system is broken

---

## Changelog

| Date | Change | Result |
|------|--------|--------|
| Original | Working implementation | Stable |
| Refactor attempt 1 | Added preset mapping, per-frame caching | BROKEN - dropped inputs |
| Refactor attempt 2 | Simplified caching | BROKEN - still dropped inputs |
| Reverted | Back to original | Stable |

**Lesson**: The input system timing is extremely delicate. Do not modify without extensive testing.
