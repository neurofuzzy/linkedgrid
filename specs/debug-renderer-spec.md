# Debug Canvas Renderer Specification

## Overview

The `DebugCanvasRenderer` is a Canvas2D debug/fallback renderer for the Spartan framework. It lives in `packages/spartan-web/debug-renderer.ts` and provides information-first rendering designed for human developers to inspect game state visually.

## Architecture

```
spartan (platform-agnostic)        spartan-web              dev/playground
┌─────────────────────────┐   ┌────────────────────┐   ┌──────────────────┐
│ VisualEventBus          │──▶│ DebugCanvasRenderer │◀──│ CanvasDebugView  │
│ EffectsQueue            │──▶│   (Canvas2D)        │   │ (React wrapper)  │
│ SpatialSystem           │──▶│                     │   └──────────────────┘
│ GameState               │   └────────────────────┘
└─────────────────────────┘
```

The renderer is a pure class with no React dependency. The playground wraps it in a `CanvasDebugView` React component that manages lifecycle (mount/unmount).

## Config

```typescript
interface DebugRendererConfig {
  cellSize: number;        // px per cell (default 32)
  showGrid: boolean;       // grid lines
  showLabels: boolean;     // entity type character
  showHealth: boolean;     // HP bars
  showFacing: boolean;     // direction arrows
  showVisualState: boolean; // state badge (IDL, WLK, ATK...)
  showLayers: boolean;     // layer number in corner
  showEffects: boolean;    // screen effects
  debug: boolean;          // console.debug logging
  tickRate: number;        // assumed tick rate for interpolation (default 10)
}
```

## Key Features

### 1. Round Entities (Layers 4, 6, 7)

Collectibles, actors, and ephemerals render as **circles** instead of squares. This allows floor tiles and floor effects on lower layers to remain visible underneath.

- **Square layers**: Background (0), Floor (1), Floor Effects (2), Logic (3), Walls (5)
- **Round layers**: Collectibles (4), Actors (6), Ephemerals (7)

### 2. FPS Decoupled from Tick Rate

The renderer runs at the browser's native refresh rate (~60fps) independent of the game's tick rate (default 10 tps). Between ticks, entity positions are **linearly interpolated** for smooth movement.

**Implementation**: On each tick change detected via `runtime.tickCount`, the renderer snapshots current positions into `prevPositions` and records a timestamp. During rendering, it computes `t = elapsed / tickDuration` and lerps between previous and current positions.

This unlocks:
- Smooth player/NPC movement
- Proper projectile rendering (no teleporting between cells)
- Visually distinguishable movement speeds

### 3. Per-Entity Tint Effects

Tints are color overlays that fade over time, driven by `VisualEventBus` subscriptions:

| Event | Tint Color | Duration |
|---|---|---|
| `entity:damaged` | Red (#ff3333) | 300ms |
| `entity:died` | Red (#ff0000) | 800ms |
| `entity:spawned` | White (#ffffff) | 500ms |

Tints are rendered as a second pass over the entity shape at decreasing opacity.

### 4. Per-Entity Pulse Effect

Entities standing on `medbay` floor tiles receive a pulsating glow ring and subtle scale oscillation. The pulse is computed at render time by checking actor positions against known heal-floor positions.

- Scale oscillates ±8% via `sin(now * 0.006)`
- Green glow ring at 25-40% opacity

### 5. Layer Transparency

Each layer has a base alpha value, with lower layers rendered dimmer:

| Layer | Alpha |
|---|---|
| Background (0) | 0.30 |
| Floor (1) | 0.45 |
| Floor Effects (2) | 0.55 |
| Logic (3) | 0.20 |
| Collectibles (4) | 0.85 |
| Walls (5) | 0.90 |
| Actors (6) | 1.00 |
| Ephemerals (7) | 0.85 |

Density-based entities (poison gas) and depth-based entities (water) multiply their layer alpha by their respective density/depth factor.

### 6. Screen Effects

Effects drained from `EffectsQueue` each frame:

- **Shake**: Canvas transform offset with sine/cosine oscillation, intensity decays linearly
- **Flash**: Full-canvas color overlay, opacity fades from 0.3 to 0
- **Area**: Expanding circle outline at grid position, fades out
- **Particle**: 8-particle burst with preset-based colors, 600ms lifetime, deceleration

### 7. Debug Console Logging

When `debug: true`, all visual events and effects are logged to `console.debug` with `[DebugRenderer]` prefix.

## Lifecycle API

```typescript
const renderer = new DebugCanvasRenderer(canvas, config?);
renderer.attach(runtime);    // subscribe to events, size canvas
renderer.startLoop();         // begin rAF loop
renderer.stopLoop();          // pause rendering
renderer.detach();            // unsubscribe, cleanup
renderer.updateConfig({...}); // runtime config changes
```

## Demo Game

`dev/games/debug-renderer-demo.json` - A showcase level demonstrating:
- Checkerboard floor tiles (grass on layer 1)
- Stone courtyard floor pattern
- Round actors (player, enemies with facing/visual state)
- Round collectibles (coins, keys, health packs, flags)
- Medbay pulse effect
- Lava damage zones
- Ice slide zones
- Poison gas transparency
- Water depth opacity
- Barrel for explosion/shake effects
- Destructible wall
- HP bars on all health entities
