/**
 * DebugCanvasRenderer - Canvas2D debug/fallback renderer for Spartan games.
 *
 * Information-first rendering: shows all layers simultaneously with transparency,
 * entity type labels, HP bars, facing arrows, visual state badges, and effect overlays.
 *
 * Key features:
 * - Render FPS decoupled from game tick rate (smooth position interpolation)
 * - Collectibles and actors rendered as circles (floor visible underneath)
 * - Per-entity tint effects (damage flash, teleport glow)
 * - Per-entity pulse effect (health charger, medbay)
 * - Particle burst, screen shake, flash overlay, area ring effects
 * - Optional console.debug logging of all visual events and effects
 *
 * NOT optimized for performance. Designed for human developers to view and
 * debug visual states, overlapping entities, effects, and game state.
 *
 * @example
 * ```typescript
 * const canvas = document.createElement('canvas');
 * const renderer = new DebugCanvasRenderer(canvas, { debug: true });
 * renderer.attach(runtime);
 * renderer.startLoop();
 * // ...
 * renderer.stopLoop();
 * renderer.detach();
 * ```
 */

import type { GameRuntime } from '../spartan/core/game-runtime';
import type { VisualEvent } from '../spartan/core/visual-event-bus';
import type { VisualEffect } from '../spartan/core/effects-queue';
import type { EntityData } from '../spartan/entities/entity.types';
import type { FreeBodyStore } from '../spartan/core/free-body-store';
import { Direction } from '../spartan/core/grid/direction';
import { GameLayers } from '../spartan/config/layers.config';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface DebugRendererConfig {
  /** Pixels per cell (default 32) */
  cellSize: number;
  /** Draw grid lines */
  showGrid: boolean;
  /** Entity type character labels */
  showLabels: boolean;
  /** HP bars on entities with health */
  showHealth: boolean;
  /** Direction arrows */
  showFacing: boolean;
  /** Visual state badge (IDLE, WALK, ATK, ...) */
  showVisualState: boolean;
  /** Layer number in cell corner */
  showLayers: boolean;
  /** Render queued effects */
  showEffects: boolean;
  /** console.debug logging of visual events & effects */
  debug: boolean;
  /** Assumed game tick rate in ticks-per-second (default 10). Used for interpolation. */
  tickRate: number;
}

const DEFAULT_CONFIG: DebugRendererConfig = {
  cellSize: 32,
  showGrid: true,
  showLabels: true,
  showHealth: true,
  showFacing: true,
  showVisualState: true,
  showLayers: false,
  showEffects: true,
  debug: false,
  tickRate: 10,
};

// ---------------------------------------------------------------------------
// Entity character + colour defaults
// ---------------------------------------------------------------------------

const ENTITY_CHAR_MAP: Record<string, string> = {
  player: 'P',
  enemy: 'E',
  wall: '#',
  teleporter: 'T',
  item: '*',
  projectile: '.',
  door: 'D',
  'open-door': '_',
  key: 'K',
  lava: '~',
  acid: '~',
  medbay: '+',
  ice: 'I',
  mud: 'M',
  'poison-gas': 'G',
  water: 'W',
  ash: 'a',
  grass: 'g',
  gasoline: 'o',
  fuse: 'f',
  torch: 't',
  barrel: 'B',
  'explosion-visual': '!',
  'destructible-wall': '%',
  'chain-link': '=',
  'fire-visual': '^',
  oscillator: 'O',
  'pressure-switch': 'S',
  inverter: 'N',
  'conductive-floor': '.',
  transceiver: 'R',
  gate: 'G',
  'gate-open': '_',
  'gate-closed': 'G',
  'path-node': '.',
  'sleep-wake': 'Z',
  spawner: 'S',
  'health-pack': '+',
  'health-potion': 'h',
  'shield-pack': 's',
  'speed-boost': '>',
  'damage-boost': '!',
  invincibility: 'i',
  'ammo-pack': 'a',
  'weapon-pickup': 'w',
  checkpoint: 'C',
  coin: '$',
  flag: 'F',
  exit: 'X',
  'range-sensor': 'r',
  'player-start': ' ',
};

const ENTITY_COLOR_MAP: Record<string, string> = {
  player: '#33cccc',
  enemy: '#cc3366',
  wall: '#7777cc',
  teleporter: '#9966cc',
  item: '#cccc33',
  projectile: '#ff6600',
  door: '#cc9944',
  'open-door': '#665522',
  key: '#cccc33',
  lava: '#ff4444',
  acid: '#33cc66',
  medbay: '#33cc66',
  ice: '#99ccff',
  mud: '#996633',
  'poison-gas': '#66cc66',
  water: '#4488cc',
  ash: '#888888',
  grass: '#448844',
  gasoline: '#cc8833',
  fuse: '#cc8833',
  torch: '#ff8800',
  barrel: '#cc6644',
  'explosion-visual': '#ff8800',
  'destructible-wall': '#887766',
  'chain-link': '#aaaacc',
  'fire-visual': '#ff6600',
  oscillator: '#ffcc00',
  'pressure-switch': '#ff9966',
  inverter: '#cc66cc',
  'conductive-floor': '#335566',
  transceiver: '#66cccc',
  gate: '#cc8844',
  'gate-open': '#66cc66',
  'gate-closed': '#cc4444',
  'path-node': '#335566',
  'sleep-wake': '#666699',
  spawner: '#cc6699',
  'health-pack': '#33cc66',
  'health-potion': '#66ff99',
  'shield-pack': '#6699ff',
  'speed-boost': '#ffcc33',
  'damage-boost': '#ff6633',
  invincibility: '#ffffff',
  'ammo-pack': '#cccc33',
  'weapon-pickup': '#cc99ff',
  checkpoint: '#33cccc',
  coin: '#ffcc33',
  flag: '#ff6666',
  exit: '#9966cc',
  'range-sensor': '#88bbcc',
  'player-start': '#335555',
};

/** Layer alpha -- lower layers are rendered dimmer */
const LAYER_ALPHA: Record<number, number> = {
  [GameLayers.BACKGROUND]: 0.30,
  [GameLayers.FLOOR]: 0.45,
  [GameLayers.FLOOR_EFFECTS]: 0.55,
  [GameLayers.LOGIC]: 0.20,
  [GameLayers.COLLECTIBLES]: 0.85,
  [GameLayers.WALLS]: 0.90,
  [GameLayers.ACTORS]: 1.00,
  [GameLayers.EPHEMERALS]: 0.85,
  8 /* TEXT */: 1.00,
};

const LAYER_NAMES: Record<number, string> = {
  0: 'BG',
  1: 'FLR',
  2: 'FX',
  3: 'LOG',
  4: 'COL',
  5: 'WAL',
  6: 'ACT',
  7: 'EPH',
  8: 'TXT',
};

/** Layers that render entities as circles instead of squares */
const ROUND_LAYERS = new Set<number>([
  GameLayers.COLLECTIBLES,  // 4 - items, coins, keys, pickups
  GameLayers.ACTORS,        // 6 - players, enemies, NPCs
  GameLayers.EPHEMERALS,    // 7 - projectiles, explosions
]);

/** Short badges for visual states */
const STATE_BADGES: Record<string, string> = {
  idle: 'IDL',
  walk: 'WLK',
  attack: 'ATK',
  hurt: 'HRT',
  die: 'DIE',
  special: 'SPC',
};

/** Entity types that trigger pulse effect when standing on them */
const PULSE_FLOOR_TYPES = new Set(['medbay']);

/** Entity types that render at reduced size (small dots instead of full cell) */
const SMALL_ENTITY_TYPES = new Set(['projectile', 'explosion-visual']);

// ---------------------------------------------------------------------------
// Active effect tracking
// ---------------------------------------------------------------------------

interface ActiveEffect {
  effect: VisualEffect;
  startTime: number;
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  startTime: number;
  durationMs: number;
}

const PRESET_COLORS: Record<string, string> = {
  explosion: '#ff8800',
  spark: '#ffcc33',
  blood: '#cc3333',
  smoke: '#999999',
  fire: '#ff6600',
  heal: '#33cc66',
  collect: '#ffcc33',
  respawn: '#ffffff',
  portal: '#9966cc',
};

// ---------------------------------------------------------------------------
// Per-entity visual effects
// ---------------------------------------------------------------------------

interface EntityTint {
  color: string;
  startTime: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Position interpolation
// ---------------------------------------------------------------------------

interface PositionSnapshot {
  x: number;
  y: number;
  layer: number;
}

// ---------------------------------------------------------------------------
// DebugCanvasRenderer
// ---------------------------------------------------------------------------

export class DebugCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: DebugRendererConfig;

  private runtime: GameRuntime | null = null;
  private unsubscribers: Array<() => void> = [];
  private rafId: number | null = null;
  private running = false;

  // Effects
  private activeEffects: ActiveEffect[] = [];
  private particles: Particle[] = [];
  private shakeOffset = { x: 0, y: 0 };

  // Per-entity effects
  private entityTints: Map<number, EntityTint> = new Map();

  // Position interpolation (FPS decoupled from tick rate)
  private lastTickCount = -1;
  private lastTickTime = 0;
  private tickDurationMs: number;
  private prevPositions: Map<number, PositionSnapshot> = new Map();
  private currPositions: Map<number, PositionSnapshot> = new Map();
  private lastSceneId: string | null = null;

  // Free-body position interpolation (projectiles, flying entities)
  private prevFreePositions: Map<number, { x: number; y: number }> = new Map();
  private currFreePositions: Map<number, { x: number; y: number }> = new Map();

  constructor(canvas: HTMLCanvasElement, config?: Partial<DebugRendererConfig>) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get Canvas 2D context');
    this.ctx = ctx;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tickDurationMs = 1000 / this.config.tickRate;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  attach(runtime: GameRuntime): void {
    this.detach();
    this.runtime = runtime;

    const bus = runtime.game.gameState.visualEventBus;

    if (bus) {
      // Always subscribe for entity effects (tints)
      this.unsubscribers.push(
        bus.on('entity:damaged', (evt) => {
          if (evt.entityId != null) {
            this.entityTints.set(evt.entityId, {
              color: '#ff3333',
              startTime: performance.now(),
              durationMs: 300,
            });
          }
          if (this.config.debug) console.debug(`[DebugRenderer] ${evt.type}`, evt);
        })
      );

      this.unsubscribers.push(
        bus.on('entity:died', (evt) => {
          if (evt.entityId != null) {
            this.entityTints.set(evt.entityId, {
              color: '#ff0000',
              startTime: performance.now(),
              durationMs: 800,
            });
          }
          if (this.config.debug) console.debug(`[DebugRenderer] ${evt.type}`, evt);
        })
      );

      this.unsubscribers.push(
        bus.on('entity:spawned', (evt) => {
          if (evt.entityId != null) {
            this.entityTints.set(evt.entityId, {
              color: '#ffffff',
              startTime: performance.now(),
              durationMs: 500,
            });
          }
          if (this.config.debug) console.debug(`[DebugRenderer] ${evt.type}`, evt);
        })
      );

      // Debug logging for remaining events
      if (this.config.debug) {
        const debugTypes: Array<VisualEvent['type']> = [
          'entity:moved',
          'entity:state-changed',
          'entity:removed',
          'scene:transition',
          'effect:request',
        ];
        for (const t of debugTypes) {
          this.unsubscribers.push(
            bus.on(t, (evt) => console.debug(`[DebugRenderer] ${evt.type}`, evt))
          );
        }
      }
    }

    this.resizeCanvas();
    this.snapshotPositions();
  }

  detach(): void {
    this.stopLoop();
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.runtime = null;
    this.activeEffects = [];
    this.particles = [];
    this.shakeOffset = { x: 0, y: 0 };
    this.entityTints.clear();
    this.prevPositions.clear();
    this.currPositions.clear();
    this.prevFreePositions.clear();
    this.currFreePositions.clear();
    this.lastTickCount = -1;
  }

  startLoop(): void {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopLoop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  updateConfig(partial: Partial<DebugRendererConfig>): void {
    Object.assign(this.config, partial);
    if (partial.tickRate && partial.tickRate > 0) {
      this.tickDurationMs = 1000 / partial.tickRate;
    }
    this.resizeCanvas();
  }

  // -----------------------------------------------------------------------
  // Canvas sizing
  // -----------------------------------------------------------------------

  private resizeCanvas(): void {
    if (!this.runtime) return;
    const scene = this.runtime.activeScene;
    if (!scene) return;
    const { cellSize } = this.config;
    this.canvas.width = scene.grid.width * cellSize;
    this.canvas.height = scene.grid.height * cellSize;
  }

  // -----------------------------------------------------------------------
  // Position interpolation
  // -----------------------------------------------------------------------

  private snapshotPositions(): void {
    if (!this.runtime) return;
    const scene = this.runtime.activeScene;
    if (!scene) return;

    this.currPositions.clear();
    for (const [entityId, pos] of scene.spatial.getAllPositions()) {
      this.currPositions.set(entityId, { x: pos.x, y: pos.y, layer: pos.layer });
    }

    // Also snapshot free-body positions (projectiles, flying entities)
    this.currFreePositions.clear();
    const freeBody = this.runtime.freeBody;
    if (freeBody) {
      for (const [entityId, pos] of freeBody.entries()) {
        this.currFreePositions.set(entityId, { x: pos.x, y: pos.y });
      }
    }
  }

  private updateInterpolation(): void {
    if (!this.runtime) return;
    const currentTick = this.runtime.tickCount;
    const sceneId = this.runtime.activeScene?.id ?? null;

    // Detect scene change — clear prev so nothing interpolates across scenes
    if (sceneId !== this.lastSceneId) {
      this.prevPositions.clear();
      this.currPositions.clear();
      this.prevFreePositions.clear();
      this.currFreePositions.clear();
      this.snapshotPositions();
      this.lastTickTime = performance.now();
      this.lastTickCount = currentTick;
      this.lastSceneId = sceneId;
      // Also resize canvas for potentially different grid dimensions
      this.resizeCanvas();
      return;
    }

    if (currentTick !== this.lastTickCount) {
      // Tick advanced — swap snapshots
      this.prevPositions = this.currPositions;
      this.currPositions = new Map();
      this.prevFreePositions = this.currFreePositions;
      this.currFreePositions = new Map();
      this.snapshotPositions();
      this.lastTickTime = performance.now();
      this.lastTickCount = currentTick;
    }
  }

  /** Get interpolated position for an entity. Returns current if no prev. */
  private getInterpolatedPos(entityId: number, now: number): { x: number; y: number } | null {
    const curr = this.currPositions.get(entityId);
    if (!curr) return null;

    const prev = this.prevPositions.get(entityId);
    if (!prev || (prev.x === curr.x && prev.y === curr.y)) {
      return { x: curr.x, y: curr.y };
    }

    // Skip interpolation for large jumps (teleport, respawn, etc.)
    // Manhattan distance > 2 = instant snap, no tween
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);
    if (dx + dy > 2) {
      return { x: curr.x, y: curr.y };
    }

    // Compute interpolation factor
    const elapsed = now - this.lastTickTime;
    const t = Math.min(1, Math.max(0, elapsed / this.tickDurationMs));

    return {
      x: prev.x + (curr.x - prev.x) * t,
      y: prev.y + (curr.y - prev.y) * t,
    };
  }

  /** Get interpolated position for a free-body entity. Uses float precision. */
  private getInterpolatedFreePos(entityId: number, now: number): { x: number; y: number } | null {
    const curr = this.currFreePositions.get(entityId);
    if (!curr) return null;

    const prev = this.prevFreePositions.get(entityId);
    if (!prev) {
      return { x: curr.x, y: curr.y };
    }

    // Compute interpolation factor
    const elapsed = now - this.lastTickTime;
    const t = Math.min(1, Math.max(0, elapsed / this.tickDurationMs));

    return {
      x: prev.x + (curr.x - prev.x) * t,
      y: prev.y + (curr.y - prev.y) * t,
    };
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  render(): void {
    if (!this.runtime) return;

    const scene = this.runtime.activeScene;
    if (!scene) return;

    const { spatial, grid } = scene;
    const { cellSize } = this.config;
    const ctx = this.ctx;
    const now = performance.now();

    // Ensure canvas matches current scene
    const expectedW = grid.width * cellSize;
    const expectedH = grid.height * cellSize;
    if (this.canvas.width !== expectedW || this.canvas.height !== expectedH) {
      this.canvas.width = expectedW;
      this.canvas.height = expectedH;
    }

    // Update interpolation snapshots
    this.updateInterpolation();

    // Drain effects queue
    const fxQueue = this.runtime.game.gameState.effectsQueue;
    if (fxQueue) {
      const newEffects = fxQueue.drain();
      for (const fx of newEffects) {
        this.activeEffects.push({ effect: fx, startTime: now });
        this.spawnParticlesForEffect(fx, now);
        if (this.config.debug) {
          console.debug('[DebugRenderer] effect:', fx);
        }
      }
    }

    // Update shake
    this.updateShake(now);

    ctx.save();
    ctx.translate(this.shakeOffset.x, this.shakeOffset.y);

    // 1. Clear
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Grid lines
    if (this.config.showGrid) {
      this.drawGrid(ctx, grid.width, grid.height, cellSize);
    }

    // 3. Collect entities, group by layer
    const entityList: Array<{ id: number; layer: number; data: EntityData }> = [];
    for (const [entityId, pos] of spatial.getAllPositions()) {
      const data = spatial.getEntityData(entityId);
      if (!data) continue;
      entityList.push({ id: entityId, layer: pos.layer, data });
    }

    // Sort by layer so lower layers paint first
    entityList.sort((a, b) => a.layer - b.layer);

    // Build a set of cells that have floor healing (for pulse detection)
    const pulseFloorCells = new Set<string>();
    for (const ent of entityList) {
      if (PULSE_FLOOR_TYPES.has(ent.data.type)) {
        const pos = this.currPositions.get(ent.id);
        if (pos) pulseFloorCells.add(`${pos.x},${pos.y}`);
      }
    }

    // 4. Draw each entity
    for (const ent of entityList) {
      const alpha = LAYER_ALPHA[ent.layer] ?? 0.5;
      const isRound = ROUND_LAYERS.has(ent.layer);

      // Projectiles and explosion visuals render at reduced size
      const sizeScale = SMALL_ENTITY_TYPES.has(ent.data.type) ? 0.35 : 1.0;

      // Interpolated position (smooth movement between ticks)
      const interpPos = this.getInterpolatedPos(ent.id, now);
      if (!interpPos) continue;

      // Check if entity is on a pulse floor
      const currPos = this.currPositions.get(ent.id);
      const onPulseFloor = currPos ? pulseFloorCells.has(`${currPos.x},${currPos.y}`) : false;
      const isPulseTarget = onPulseFloor && ent.layer === GameLayers.ACTORS;

      this.drawEntity(ctx, interpPos.x, interpPos.y, ent.data, ent.id, ent.layer, alpha, cellSize, isRound, now, isPulseTarget, sizeScale);
    }

    // 4b. Draw free-body entities (projectiles, flying entities)
    // These are NOT on the grid, so they don't appear in getAllPositions().
    // We render them from the FreeBodyStore with float precision.
    this.renderFreeBodyEntities(ctx, spatial, now, cellSize);

    // 5. Render screen-space effects
    if (this.config.showEffects) {
      this.renderEffects(ctx, now, cellSize);
    }

    // 6. Render particles
    this.renderParticles(ctx, now, cellSize);

    ctx.restore();

    // Expire
    this.activeEffects = this.activeEffects.filter(
      (ae) => now - ae.startTime < this.getEffectDuration(ae.effect)
    );
    this.particles = this.particles.filter(
      (p) => now - p.startTime < p.durationMs
    );
    // Expire tints
    for (const [id, tint] of this.entityTints) {
      if (now - tint.startTime > tint.durationMs) {
        this.entityTints.delete(id);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Grid
  // -----------------------------------------------------------------------

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cs: number): void {
    ctx.strokeStyle = '#1a1a2a';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cs, 0);
      ctx.lineTo(x * cs, h * cs);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cs);
      ctx.lineTo(w * cs, y * cs);
      ctx.stroke();
    }
  }

  // -----------------------------------------------------------------------
  // Entity drawing
  // -----------------------------------------------------------------------

  private drawEntity(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    data: EntityData,
    entityId: number,
    layer: number,
    layerAlpha: number,
    cs: number,
    isRound: boolean,
    now: number,
    isPulseTarget: boolean,
    sizeScale = 1.0
  ): void {
    const px = x * cs;
    const py = y * cs;
    const cx = px + cs / 2;
    const cy = py + cs / 2;

    // --- Entity colour ---
    let color = ENTITY_COLOR_MAP[data.type] ?? '#888888';
    if ('color' in data && typeof data.color === 'string') {
      color = data.color;
    }

    // --- Density/liquid opacity ---
    let entityAlpha = layerAlpha;
    if ('density' in data && typeof data.density === 'number') {
      entityAlpha *= Math.max(0.1, Math.min(1.0, (data.density as number) / 100));
    } else if ('depth' in data && typeof data.depth === 'number') {
      entityAlpha *= Math.min(1.0, 0.4 + ((data.depth as number) - 1) * 0.1);
    }

    // --- Pulse effect (scale oscillation) ---
    let pulseScale = 1.0;
    if (isPulseTarget) {
      pulseScale = 1.0 + 0.08 * Math.sin(now * 0.006);
    }

    ctx.globalAlpha = entityAlpha;

    // --- Draw shape ---
    const inset = 1;
    const radius = (cs / 2 - inset) * pulseScale * sizeScale;

    if (isRound) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      const halfSide = radius;
      ctx.fillRect(cx - halfSide, cy - halfSide, halfSide * 2, halfSide * 2);
    }

    // --- Tint overlay ---
    const tint = this.entityTints.get(entityId);
    if (tint) {
      const tintElapsed = now - tint.startTime;
      const tintProgress = Math.min(1, tintElapsed / tint.durationMs);
      const tintAlpha = 0.6 * (1 - tintProgress);

      if (tintAlpha > 0.01) {
        ctx.globalAlpha = tintAlpha;
        ctx.fillStyle = tint.color;
        if (isRound) {
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const halfSide = radius;
          ctx.fillRect(cx - halfSide, cy - halfSide, halfSide * 2, halfSide * 2);
        }
      }
    }

    // --- Pulse glow ring ---
    if (isPulseTarget) {
      const glowAlpha = 0.25 + 0.15 * Math.sin(now * 0.006);
      ctx.globalAlpha = glowAlpha;
      ctx.strokeStyle = '#33cc66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Skip overlays for tiny entities (projectiles etc.)
    const isSmall = sizeScale < 0.5;

    // --- Label (entity char) ---
    if (this.config.showLabels && !isSmall) {
      const char = ENTITY_CHAR_MAP[data.type] ?? data.type[0]?.toUpperCase() ?? '?';
      ctx.globalAlpha = Math.min(1.0, entityAlpha + 0.2);
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${Math.round(cs * 0.45)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char, cx, cy);
    }

    // --- Layer number ---
    if (this.config.showLayers && !isSmall) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(cs * 0.25)}px monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(LAYER_NAMES[layer] ?? String(layer), px + 2, py + 2);
    }

    // --- HP bar ---
    if (this.config.showHealth && !isSmall && 'hp' in data && 'maxHp' in data) {
      const hp = data.hp as number;
      const maxHp = data.maxHp as number;
      if (maxHp > 0) {
        const barW = cs - 4;
        const barH = Math.max(2, Math.round(cs * 0.1));
        const barX = px + 2;
        const barY = py + 1;
        const pct = Math.max(0, Math.min(1, hp / maxHp));

        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = pct > 0.5 ? '#33cc66' : pct > 0.25 ? '#cccc33' : '#cc3366';
        ctx.fillRect(barX, barY, barW * pct, barH);
      }
    }

    // --- Facing arrow ---
    if (this.config.showFacing && !isSmall && 'facing' in data && typeof data.facing === 'number') {
      const facing = data.facing as Direction;
      if (facing !== Direction.NONE) {
        this.drawFacingArrow(ctx, cx, cy, cs, facing);
      }
    }

    // --- Visual state badge ---
    if (this.config.showVisualState && !isSmall && 'visualState' in data && typeof data.visualState === 'string') {
      const state = data.visualState as string;
      const badge = STATE_BADGES[state] ?? state.substring(0, 3).toUpperCase();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(cs * 0.22)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(badge, cx, py + cs - 1);
    }

    ctx.globalAlpha = 1.0;
  }

  // -----------------------------------------------------------------------
  // Free-body entity rendering (projectiles, flying entities)
  // -----------------------------------------------------------------------

  private renderFreeBodyEntities(
    ctx: CanvasRenderingContext2D,
    spatial: { getEntityData: (id: number) => EntityData | undefined },
    now: number,
    cs: number
  ): void {
    for (const [entityId] of this.currFreePositions) {
      const data = spatial.getEntityData(entityId);
      if (!data) continue;

      // Get interpolated float position
      const interpPos = this.getInterpolatedFreePos(entityId, now);
      if (!interpPos) continue;

      // Free bodies render on the EPHEMERALS layer visually
      const alpha = LAYER_ALPHA[GameLayers.EPHEMERALS] ?? 0.85;
      const sizeScale = SMALL_ENTITY_TYPES.has(data.type) ? 0.35 : 1.0;

      // Free-body positions are in world-space where cell center = (cx+0.5, cy+0.5).
      // drawEntity expects grid-space where cell center = cx (it adds cs/2 internally).
      // Subtract 0.5 to convert world-space → drawEntity-compatible coords.
      this.drawEntity(
        ctx, interpPos.x - 0.5, interpPos.y - 0.5, data, entityId,
        GameLayers.EPHEMERALS, alpha, cs,
        true, // isRound -- projectiles are circles
        now, false, sizeScale
      );
    }
  }

  // -----------------------------------------------------------------------
  // Facing arrow
  // -----------------------------------------------------------------------

  private drawFacingArrow(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    cs: number,
    direction: Direction
  ): void {
    const r = cs * 0.35;

    let dx = 0;
    let dy = 0;
    switch (direction) {
      case Direction.UP:    dy = -1; break;
      case Direction.DOWN:  dy = 1;  break;
      case Direction.LEFT:  dx = -1; break;
      case Direction.RIGHT: dx = 1;  break;
    }

    const tipX = cx + dx * r;
    const tipY = cy + dy * r;

    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - dx * r * 0.3, cy - dy * r * 0.3);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    const headLen = cs * 0.12;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - headLen * Math.cos(angle - Math.PI / 6),
      tipY - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - headLen * Math.cos(angle + Math.PI / 6),
      tipY - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }

  // -----------------------------------------------------------------------
  // Screen-space effects
  // -----------------------------------------------------------------------

  private updateShake(now: number): void {
    let sx = 0;
    let sy = 0;
    for (const ae of this.activeEffects) {
      if (ae.effect.type !== 'shake') continue;
      const elapsed = now - ae.startTime;
      if (elapsed > ae.effect.durationMs) continue;
      const progress = elapsed / ae.effect.durationMs;
      const decay = 1 - progress;
      const intensity = ae.effect.intensity * decay;
      sx += Math.sin(elapsed * 0.05) * intensity;
      sy += Math.cos(elapsed * 0.07) * intensity;
    }
    this.shakeOffset = { x: sx, y: sy };
  }

  private renderEffects(ctx: CanvasRenderingContext2D, now: number, cs: number): void {
    for (const ae of this.activeEffects) {
      const duration = this.getEffectDuration(ae.effect);
      const elapsed = now - ae.startTime;
      if (elapsed > duration) continue;
      const progress = elapsed / duration;

      switch (ae.effect.type) {
        case 'flash': {
          const alpha = 0.3 * (1 - progress);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = ae.effect.color;
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          ctx.globalAlpha = 1.0;
          break;
        }
        case 'area': {
          const acx = (ae.effect.x + 0.5) * cs;
          const acy = (ae.effect.y + 0.5) * cs;
          const maxR = ae.effect.radius * cs;
          const r = maxR * Math.min(1, progress * 2);
          const alpha = 0.5 * (1 - progress);

          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(acx, acy, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = ae.effect.effectType === 'shockwave' ? '#ff880044' : '#ffffff22';
          ctx.fill();
          ctx.globalAlpha = 1.0;
          break;
        }
      }
    }
  }

  private getEffectDuration(fx: VisualEffect): number {
    if ('durationMs' in fx) return fx.durationMs;
    return 600;
  }

  // -----------------------------------------------------------------------
  // Particles
  // -----------------------------------------------------------------------

  private spawnParticlesForEffect(fx: VisualEffect, now: number): void {
    if (fx.type !== 'particle') return;

    const count = 8;
    const baseColor = fx.color ?? PRESET_COLORS[fx.preset] ?? '#ffffff';
    const durationMs = 600;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 0.5 + Math.random() * 1.5;
      this.particles.push({
        x: fx.x + 0.5,
        y: fx.y + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: baseColor,
        startTime: now,
        durationMs,
      });
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D, now: number, cs: number): void {
    for (const p of this.particles) {
      const elapsed = now - p.startTime;
      if (elapsed > p.durationMs) continue;
      const progress = elapsed / p.durationMs;

      const t = elapsed / 1000;
      const decay = 1 - progress;
      const drawX = (p.x + p.vx * t * decay) * cs;
      const drawY = (p.y + p.vy * t * decay) * cs;
      const radius = Math.max(1, cs * 0.08 * decay);

      ctx.globalAlpha = 0.8 * decay;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }
}
