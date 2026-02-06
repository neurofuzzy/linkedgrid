# Visual Animation Specification

**Phase:** 4b Enhanced Visuals
**Status:** Draft
**Date:** 2026-02-06

---

## Overview

Phase 4b adds facing direction tracking and tick-based animation frame advancement to the visual system. These features are platform-agnostic -- they produce data that view layers consume to select the correct sprite sheet row and frame.

---

## Sprite Sheet Model

Sprite sheets are conceptual 2D matrices:
- **Rows** = visual states (e.g., idle, walk, attack, hurt, die)
- **Columns** = animation frames within a state

```
         Frame 0    Frame 1    Frame 2
State 0  [idle-0]   [idle-1]   [---]
State 1  [walk-0]   [walk-1]   [walk-2]
State 2  [attack-0] [attack-1] [---]
State 3  [hurt-0]   [---]      [---]
State 4  [die-0]    [die-1]    [die-2]
```

A state with 0 extra frames (frameCount=1) displays only frame 0 (static).
States with no sprite data revert to the default state ('idle', frame 0).

### Mapping to Renderer

The `HasVisualState.visualState` field maps to a sprite sheet row.
The `HasAnimation.currentFrame` field maps to a column within that row.
The `HasFacing.facing` field can also map to a row (e.g., 'walk-up', 'walk-right').

View layers decide how to combine state + facing + frame into a sprite lookup.

---

## HasFacing Trait

```typescript
interface HasFacing {
  facing: Direction;         // Current facing direction (UP/DOWN/LEFT/RIGHT)
  facingMode: '2-way' | '4-way';
}
```

### Facing Modes

**2-way mode:** Only LEFT and RIGHT are tracked. Vertical movement does not change facing. Typically used for side-scrolling or platformer-style sprites where the character is always shown from the side.

**4-way mode:** All four cardinal directions are tracked. The dominant axis of movement determines the new facing. For diagonal movement, the axis with the larger delta wins.

### Auto-Update Rules

VisualStateSystem auto-updates facing when it detects entity position changes:

1. Compute delta: `dx = newX - oldX`, `dy = newY - oldY`
2. If `dx == 0 && dy == 0`: no change
3. In 2-way mode:
   - `dx > 0` -> RIGHT
   - `dx < 0` -> LEFT
   - vertical-only movement: no change
4. In 4-way mode:
   - `|dx| >= |dy|`: horizontal wins (RIGHT or LEFT)
   - `|dy| > |dx|`: vertical wins (DOWN or UP)

Systems can also set facing explicitly (e.g., PlayerInputSystem sets facing from input direction, MeleeSystem sets facing toward attack target).

---

## HasAnimation Trait

```typescript
interface HasAnimation {
  frameCount: number;        // Total frames for current state
  currentFrame: number;      // Current frame index (0-based)
  animationMode: 'once' | 'repeat' | 'yoyo';
  frameDuration: number;     // Ticks per frame advancement
  animationTick: number;     // Internal tick counter
}
```

### Animation Modes

**repeat:** Loop continuously: `0, 1, 2, 0, 1, 2, ...`

**once:** Play to last frame and stop: `0, 1, 2, 2, 2, ...`
Used for death animations, one-shot effects.

**yoyo (ping-pong):** Play forward then backward: `0, 1, 2, 1, 0, 1, 2, ...`
Used for breathing idle animations, pulsing effects.

### Frame Advancement

VisualStateSystem advances animation each tick:

1. If `frameCount <= 1`: skip (static entity)
2. Increment `animationTick`
3. If `animationTick >= frameDuration`:
   - Reset `animationTick` to 0
   - Advance `currentFrame` based on `animationMode`
4. If frame changed, set `visualDirty = true`

This is **tick-based**, not time-based, keeping spartan deterministic.

### Frame Duration Examples

At 10 TPS (ticks per second):
- `frameDuration: 1` = 10 FPS animation (fast walk cycle)
- `frameDuration: 2` = 5 FPS animation (relaxed walk)
- `frameDuration: 5` = 2 FPS animation (slow idle breathing)
- `frameDuration: 10` = 1 FPS animation (very slow pulse)

---

## System Hooks in Existing Systems

### PlayerInputSystem

When player moves, set facing from input direction:

```typescript
if (hasVisualState(playerEntity)) {
  playerEntity.visualState = 'walk';
  playerEntity.visualDirty = true;
}
if (hasFacing(playerEntity) && direction !== Direction.NONE) {
  playerEntity.facing = direction;
}
```

When player is idle (no input), revert to idle:

```typescript
if (hasVisualState(playerEntity) && playerEntity.visualState === 'walk') {
  playerEntity.visualState = 'idle';
  playerEntity.visualDirty = true;
}
```

### NPCMovementSystem

When NPC moves, set facing from movement direction:

```typescript
if (hasFacing(entity)) {
  entity.facing = movementDirection;
}
if (hasVisualState(entity)) {
  entity.visualState = 'walk';
  entity.visualDirty = true;
}
```

### MeleeSystem

On attack, set visual state to attack:

```typescript
if (hasVisualState(entity)) {
  entity.visualState = 'attack';
  entity.visualDirty = true;
}
```

After cooldown, revert to idle (handled by VisualStateSystem or the system itself).

### HealthSystem

On taking damage, set visual state to hurt:

```typescript
if (hasVisualState(entity)) {
  entity.visualState = 'hurt';
  entity.visualDirty = true;
}
```

On death, set visual state to die:

```typescript
if (hasVisualState(entity)) {
  entity.visualState = 'die';
  entity.visualDirty = true;
}
```

---

## View Layer Integration

View layers read visual traits to determine rendering:

```typescript
// Build TweenedSprite from entity traits
function entityToTweenedSprite(entity: EntityData, pos: Position): TweenedSprite {
  const sprite: TweenedSprite = {
    x: pos.x,
    y: pos.y,
    value: cellValueFor(entity),
  };

  if (hasVisualState(entity)) {
    sprite.state = entity.visualState;
  }

  if (hasAnimation(entity)) {
    sprite.frame = entity.currentFrame;
  }

  if (hasFacing(entity)) {
    sprite.rotation = directionToRotation(entity.facing);
  }

  return sprite;
}
```

The existing engine `TweenedSprite` interface already supports `state`, `frame`, and `rotation` fields, making integration seamless.

---

## Backward Compatibility

- Entities without `HasAnimation` are not animated (no frame changes)
- Entities without `HasFacing` use default rotation ('up')
- Entities without `HasVisualState` render by cell value only
- All visual traits are opt-in per entity type
- Existing tests and demos are unaffected
