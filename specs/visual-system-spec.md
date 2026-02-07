# Visual System Specification

**Phase:** 4a Foundation
**Status:** Draft
**Date:** 2026-02-06

---

## Overview

The Visual System provides a platform-agnostic API for view layers to display state changes, scene transitions, effects, and entity states. It lives entirely within `packages/spartan/` and has zero DOM or rendering dependencies.

View layers (e.g. `packages/engine/view/`, future mobile renderers) subscribe to events and consume queued data. Spartan remains headless and deterministic.

---

## Architecture

```
spartan (platform-agnostic)
  traits/visual.trait.ts     -- HasVisualState, HasFacing, HasAnimation, HasColor
  core/visual-event-bus.ts   -- Pub/sub for visual events
  core/effects-queue.ts      -- Push/drain queue for effect requests
  systems/visual-state.system.ts -- Post-commit system: dirty tracking, event emission

view layer (platform-specific, e.g. engine, spartan-web)
  Subscribes to VisualEventBus
  Drains EffectsQueue each frame
  Maps traits to renderer-specific structures (TweenedSprite, particles, etc.)
```

### Data Flow

1. Game systems mutate entity data (e.g. move, damage, state change)
2. Systems or trait setters flag `visualDirty = true` on affected entities
3. VisualStateSystem (post-commit) scans dirty entities, emits events, clears flags
4. Systems push effect requests to EffectsQueue (shake, flash, particles)
5. View layer subscribes to VisualEventBus for push-based updates
6. View layer calls `effectsQueue.drain()` each frame for effect requests
7. View layer calls `visualStateSystem.getDirtyEntities()` for pull-based updates

### Two consumption models

- **Push (event-based):** Subscribe to VisualEventBus for real-time notifications. Best for view layers that need immediate reaction (tween triggers, sound cues).
- **Pull (polling):** Call `getDirtyEntities()` or `drain()` each frame. Best for renderers that rebuild state every frame anyway.

Both models are supported simultaneously. View layers choose what fits.

---

## Traits

### HasColor (existing)

```typescript
interface HasColor {
  color: string;
}
```

Unchanged. Already in `traits/visual.trait.ts`.

### HasVisualState (new)

```typescript
type VisualStateName = string;

interface HasVisualState {
  /** Current visual state name (maps to sprite sheet row) */
  visualState: VisualStateName;
  /** Flagged true when visual representation needs update */
  visualDirty: boolean;
}
```

Standard state names (by convention, not enforced):
- `'idle'` -- default resting state
- `'walk'` -- moving
- `'attack'` -- melee or ranged attack in progress
- `'hurt'` -- taking damage
- `'die'` -- death animation
- `'special'` -- powerup, charge, etc.

Entities without `HasVisualState` are rendered by their cell value and color alone (backward compatible).

### HasFacing (new)

```typescript
interface HasFacing {
  /** Current facing direction */
  facing: Direction;
  /** '2-way' = left/right only, '4-way' = all cardinal directions */
  facingMode: '2-way' | '4-way';
}
```

Updated automatically by VisualStateSystem when entity position changes.
Systems (PlayerInputSystem, NPCMovementSystem) also set facing explicitly.

---

## VisualEventBus

### Interface

```typescript
type VisualEventType =
  | 'entity:moved'
  | 'entity:state-changed'
  | 'entity:damaged'
  | 'entity:died'
  | 'entity:spawned'
  | 'entity:removed'
  | 'scene:transition'
  | 'effect:request';

interface VisualEvent {
  type: VisualEventType;
  entityId?: number;
  x?: number;
  y?: number;
  data?: Record<string, unknown>;
}

class VisualEventBus {
  on(type: VisualEventType, callback: (event: VisualEvent) => void): () => void;
  emit(event: VisualEvent): void;
  clear(): void;
}
```

### Event Catalog

| Event | Emitted By | Payload |
|-------|-----------|---------|
| `entity:moved` | VisualStateSystem | entityId, fromX, fromY, toX, toY |
| `entity:state-changed` | VisualStateSystem | entityId, previousState, newState |
| `entity:damaged` | HealthSystem | entityId, damage, x, y |
| `entity:died` | HealthSystem | entityId, x, y |
| `entity:spawned` | VisualStateSystem | entityId, type, x, y |
| `entity:removed` | VisualStateSystem | entityId, type, x, y |
| `scene:transition` | GameRuntime | fromSceneId, toSceneId |
| `effect:request` | Any system | VisualEffect descriptor |

### Lifecycle

- Created once, stored on GameManager (persists across scenes)
- View layers subscribe on init, unsubscribe on destroy
- `clear()` removes all listeners (for cleanup/testing)

---

## EffectsQueue

### Interface

```typescript
type VisualEffect =
  | { type: 'shake'; intensity: number; durationMs: number }
  | { type: 'flash'; color: string; durationMs: number }
  | { type: 'particle'; x: number; y: number; preset: string; color?: string }
  | { type: 'area'; x: number; y: number; radius: number;
      effectType: string; durationMs: number };

class EffectsQueue {
  push(effect: VisualEffect): void;
  drain(): VisualEffect[];
  peek(): ReadonlyArray<VisualEffect>;
  get length(): number;
  clear(): void;
}
```

### Consumption Pattern

```typescript
// In renderer's frame loop:
const effects = effectsQueue.drain();
for (const fx of effects) {
  switch (fx.type) {
    case 'shake':
      renderer.shake(fx.intensity, fx.durationMs);
      break;
    case 'particle':
      renderer.emit(fx.x, fx.y, fx.preset, fx.color);
      break;
    // ...
  }
}
```

### Lifecycle

- Created once, stored on GameManager (persists across scenes)
- Systems push effects during tick
- View layer drains between frames
- If no view layer is attached, effects accumulate and can be drained later or cleared

---

## VisualStateSystem

### Configuration

```typescript
// In systems.config.ts
Visual: {
  tickRate: 1,
  executionPhase: 'post-commit',
  dependencies: ['SpatialSystem'],
  description: 'Tracks visual state changes, emits events for view layers',
}
```

### Behavior

Each tick (post-commit phase):

1. **Position tracking:** Compare current entity positions against last-tick positions. Emit `entity:moved` for any that changed. Update position cache.

2. **Dirty scan:** Iterate all entities with `HasVisualState`. For those with `visualDirty === true`, emit `entity:state-changed`. Clear the flag.

3. **Spawn/remove events:** Listen to SpatialSystem lifecycle callbacks. Emit `entity:spawned` and `entity:removed`.

4. **Expose pull API:** `getDirtyEntities()` returns the list of entity IDs that changed this tick (before clearing).

### Constructor

```typescript
class VisualStateSystem extends BaseReactiveSystem {
  constructor(
    private eventBus: VisualEventBus,
    private effectsQueue: EffectsQueue
  ) { ... }
}
```

---

## Integration with Existing Systems

### How systems flag dirty

Any system that changes an entity's visual appearance should set `visualDirty = true`:

```typescript
// In HealthSystem, after applying damage:
const entity = spatial.getEntityData(entityId);
if (hasVisualState(entity)) {
  entity.visualState = 'hurt';
  entity.visualDirty = true;
  spatial.getStore().setData(entityId, entity);
}
```

### How systems push effects

```typescript
// In ExplosionSystem, on detonation:
this.effectsQueue.push({ type: 'shake', intensity: 8, durationMs: 300 });
this.effectsQueue.push({
  type: 'particle', x, y, preset: 'explosion'
});
```

---

## Type Guards

```typescript
function hasVisualState(e: EntityData): e is EntityData & HasVisualState {
  return typeof (e as any).visualState === 'string';
}

function hasFacing(e: EntityData): e is EntityData & HasFacing {
  return typeof (e as any).facing === 'number'
      && typeof (e as any).facingMode === 'string';
}
```

---

## View Layer Integration Guide

### Minimal integration (pull-based)

```typescript
// Each frame:
const dirty = visualStateSystem.getDirtyEntities();
const effects = effectsQueue.drain();

// Update tweened sprites from dirty entities
for (const entityId of dirty) {
  const entity = spatial.getEntityData(entityId);
  const pos = spatial.getEntityPosition(entityId);
  if (entity && pos && hasVisualState(entity)) {
    tweenManager.setValue(String(entityId), cellValueFor(entity));
    // state and frame are read directly from entity traits
  }
}

// Apply effects
for (const fx of effects) {
  // map to renderer calls
}
```

### Full integration (event-based)

```typescript
eventBus.on('entity:moved', (e) => {
  tweenManager.moveTo(String(e.entityId), e.data.toX, e.data.toY);
});

eventBus.on('entity:spawned', (e) => {
  tweenManager.set(String(e.entityId), e.x, e.y, cellValueFor(e));
});

eventBus.on('entity:removed', (e) => {
  tweenManager.remove(String(e.entityId));
});

eventBus.on('entity:damaged', (e) => {
  renderer.emit(e.x, e.y, 'spark', '#ff0000');
});
```

---

## Backward Compatibility

- Entities without `HasVisualState` continue to work. They render by cell value and palette color as before.
- The VisualStateSystem is automatically registered but is a no-op when no entities have visual traits.
- EffectsQueue accumulates silently if no view layer drains it.
- Existing tests remain unaffected -- visual traits are opt-in per entity.
