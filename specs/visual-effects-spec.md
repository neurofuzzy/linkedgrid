# Visual Effects Specification

**Phase:** 4c Effects Manager
**Status:** Draft
**Date:** 2026-02-06

---

## Overview

Phase 4c integrates visual effects into the game systems via the `EffectsQueue`. Systems push effect descriptors during tick processing; view layers drain them each frame to trigger rendering.

All effect descriptors are platform-agnostic data. No rendering code runs in spartan.

---

## Effect Types

### Shake

Camera/screen shake effect.

```typescript
{ type: 'shake', intensity: number, durationMs: number }
```

| Field | Description | Typical Values |
|-------|------------|----------------|
| intensity | Shake amplitude in pixels | 2-12 |
| durationMs | Duration in milliseconds | 100-500 |

### Flash

Full-screen color flash overlay.

```typescript
{ type: 'flash', color: string, durationMs: number }
```

| Field | Description | Typical Values |
|-------|------------|----------------|
| color | CSS color string | '#ffffff', '#ff0000' |
| durationMs | Flash duration | 50-300 |

### Particle

Particle burst at a grid position.

```typescript
{ type: 'particle', x: number, y: number, preset: string, color?: string }
```

| Field | Description | Typical Values |
|-------|------------|----------------|
| x, y | Grid position (can be fractional) | Any grid coordinate |
| preset | Named particle preset | 'explosion', 'spark', 'blood', 'smoke', 'fire' |
| color | Optional color override | '#ff6600' |

### Area

Area effect at a grid position (shockwave, AoE indicator).

```typescript
{ type: 'area', x: number, y: number, radius: number, effectType: string, durationMs: number }
```

| Field | Description | Typical Values |
|-------|------------|----------------|
| x, y | Center grid position | Any grid coordinate |
| radius | Effect radius in cells | 1-5 |
| effectType | Effect identifier | 'shockwave', 'ring', 'pulse' |
| durationMs | Duration in milliseconds | 200-1000 |

---

## Particle Presets

Standard preset names (view layers implement rendering):

| Preset | Description | Typical Use |
|--------|------------|-------------|
| `explosion` | Large burst, orange/red particles | ExplosionSystem detonation |
| `spark` | Small sparkle, white/yellow | Melee hit, projectile impact |
| `blood` | Red droplet spray | Entity taking damage |
| `smoke` | Gray/white puffs | Entity death, fire aftermath |
| `fire` | Orange/red flickers | Fire ignition, FireSystem |
| `heal` | Green upward particles | Health restore |
| `collect` | Gold sparkle | Item pickup |
| `respawn` | White flash burst | Player respawn |
| `portal` | Purple swirl | Teleporter activation |

View layers are free to add custom presets. Unknown presets should be silently ignored or fall back to a default particle.

---

## System Integration

### ExplosionSystem

On barrel/entity detonation:

```typescript
// Push screen shake for nearby explosions
effectsQueue.push({ type: 'shake', intensity: 8, durationMs: 300 });

// Push explosion particles at detonation point
effectsQueue.push({ type: 'particle', x, y, preset: 'explosion' });

// Push area effect to show blast radius
effectsQueue.push({
  type: 'area', x, y, radius: entity.explosionRadius,
  effectType: 'shockwave', durationMs: 400
});
```

### HealthSystem

On entity taking damage:

```typescript
effectsQueue.push({ type: 'particle', x, y, preset: 'blood', color: '#cc0000' });
```

On entity death:

```typescript
effectsQueue.push({ type: 'particle', x, y, preset: 'smoke' });
```

On entity being healed:

```typescript
effectsQueue.push({ type: 'particle', x, y, preset: 'heal', color: '#00ff44' });
```

### RespawnSystem

On player respawn:

```typescript
effectsQueue.push({ type: 'flash', color: '#ffffff', durationMs: 150 });
effectsQueue.push({ type: 'particle', x, y, preset: 'respawn' });
```

### FireSystem

On fire ignition:

```typescript
effectsQueue.push({ type: 'particle', x, y, preset: 'fire', color: '#ff4400' });
```

### Scene Transitions

On scene change (GameRuntime level):

```typescript
effectsQueue.push({ type: 'flash', color: '#000000', durationMs: 200 });
eventBus.emit({ type: 'scene:transition', data: { fromSceneId, toSceneId } });
```

---

## EffectsManager (Convenience Wrapper)

Optional thin wrapper that provides named methods:

```typescript
class EffectsManager {
  constructor(private queue: EffectsQueue) {}

  shake(intensity: number, durationMs: number): void {
    this.queue.push({ type: 'shake', intensity, durationMs });
  }

  flash(color: string, durationMs: number): void {
    this.queue.push({ type: 'flash', color, durationMs });
  }

  particle(x: number, y: number, preset: string, color?: string): void {
    this.queue.push({ type: 'particle', x, y, preset, color });
  }

  areaEffect(x: number, y: number, radius: number, effectType: string, durationMs: number): void {
    this.queue.push({ type: 'area', x, y, radius, effectType, durationMs });
  }
}
```

Systems can use either `effectsQueue.push(...)` directly or `effectsManager.shake(...)`.

---

## View Layer Consumption Pattern

```typescript
// In renderer frame loop:
function processEffects(effectsQueue: EffectsQueue) {
  const effects = effectsQueue.drain();
  for (const fx of effects) {
    switch (fx.type) {
      case 'shake':
        camera.shake(fx.intensity, fx.durationMs);
        break;
      case 'flash':
        renderer.flash(fx.color, fx.durationMs);
        break;
      case 'particle':
        particleSystem.emit(fx.x, fx.y, fx.preset, fx.color);
        break;
      case 'area':
        renderer.areaEffect(fx.x, fx.y, fx.radius, fx.effectType, fx.durationMs);
        break;
    }
  }
}
```

---

## Backward Compatibility

- EffectsQueue is always available (created with GameState)
- If no view layer drains the queue, effects silently accumulate
- Systems push effects conditionally alongside existing behavior
- No existing system behavior changes -- effects are additive
