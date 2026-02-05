import React from 'react';
import type { Scene } from '../packages/spartan/core/scene';
import { GameRuntime } from '../packages/spartan/core/game-runtime';
import { InputManager } from '../packages/spartan-web/input/input-manager';
import { PlayerInputSystem } from '../packages/spartan/systems/player-input.system';
import {
  hasColor,
  hasDensity,
  hasLiquid,
  hasHealth,
  hasWeapon,
  hasMelee,
  hasSignalEmitter,
  hasSignalReceiver,
} from '../packages/spartan/traits/trait-guards';

interface Props {
  scene: Scene | null;
}

/**
 * Entity type to CSS class mapping.
 */
const ENTITY_CLASS_MAP: Record<string, string> = {
  player: 'entity-player',
  enemy: 'entity-enemy',
  wall: 'entity-wall',
  teleporter: 'entity-teleporter',
  item: 'entity-item',
  projectile: 'entity-projectile',
  door: 'entity-door',
  'open-door': 'entity-open-door',
  key: 'entity-key',
  lava: 'entity-lava',
  acid: 'entity-acid',
  medbay: 'entity-medbay',
  ice: 'entity-ice',
  mud: 'entity-mud',
  'chain-link': 'entity-chain-link',
  gate: 'entity-gate',
  'gate-open': 'entity-gate-open',
  'gate-closed': 'entity-gate-closed',
};

/**
 * Entity type to character mapping (for ASCII representation).
 */
const ENTITY_CHAR_MAP: Record<string, string> = {
  player: 'P',
  enemy: 'E',
  wall: '█',
  teleporter: 'T',
  item: '*',
  projectile: '•',
  door: '▓',
  'open-door': '░',
  key: 'K',
  lava: '≈',
  acid: '~',
  medbay: '+',
  ice: '❄',
  mud: '▒',
  'chain-link': '≡',
  gate: '∏',
  'gate-open': '␣',
  'gate-closed': '∏',
};

/**
 * GridRenderer - Render scene grid with entities.
 *
 * Features:
 * - Shows all entities on grid
 * - Highest layer entity renders "on top" (Rule 8)
 * - Color-coded by entity type
 * - Scene name display
 *
 * @example
 * ```tsx
 * <GridRenderer scene={runtime.activeScene} />
 * ```
 */
export function GridRenderer({ scene }: Props) {
  if (!scene) {
    return (
      <div style={{ padding: '20px', color: '#808080' }}>No active scene</div>
    );
  }

  const { grid, spatial } = scene;
  const width = grid.width;
  const height = grid.height;

  // Build grid data structure
  const gridData: Array<
    Array<{ char: string; className: string; color?: string; opacity?: number }>
  > = [];

  for (let y = 0; y < height; y++) {
    const row: Array<{ char: string; className: string; color?: string; opacity?: number }> = [];

    for (let x = 0; x < width; x++) {
      const cell = grid.cell(x, y);

      if (!cell) {
        row.push({ char: '·', className: 'empty' });
        continue;
      }

      // Get all entity IDs at this cell across all layers
      const entityIds: Array<{ id: number; layer: number }> = [];

      for (let layer = 0; layer < 8; layer++) {
        const id = cell.values[layer];
        if (id !== undefined && id !== 0) {
          entityIds.push({ id, layer });
        }
      }

      if (entityIds.length === 0) {
        row.push({ char: '·', className: 'empty' });
      } else {
        // Rule 8: Show entity on highest layer
        const topEntity = entityIds.reduce((highest, current) =>
          current.layer > highest.layer ? current : highest
        );

        const entityData = spatial.getEntityData(topEntity.id);
        const type = entityData?.type || 'unknown';
        const char = ENTITY_CHAR_MAP[type] || type[0]?.toUpperCase() || '?';
        const className = ENTITY_CLASS_MAP[type] || 'entity-player';

        let color: string | undefined;
        if (entityData && hasColor(entityData)) {
          color = entityData.color;
        }

        // Apply density opacity if present (e.g., poison gas)
        if (color && entityData && hasDensity(entityData)) {
          const density = entityData.density;
          // Map 0-100 density to 0.1-1.0 opacity
          const opacity = Math.max(0.1, Math.min(1.0, density / 100));
          // Convert hex to rgba to apply opacity
          if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            color = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          }
        } else if (
          color &&
          entityData &&
          hasLiquid(entityData) &&
          (entityData.type as string) !== 'poison-gas'
        ) {
          // Apply liquid depth opacity
          const depth = entityData.depth;
          // Map depth 1 -> 0.4, depth 10 -> 1.0
          const opacity = Math.min(1.0, 0.4 + (depth - 1) * 0.1);

          if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            color = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          }
        }

        // Signal System Visualization
        // Dim "OFF" signal entities to 50% opacity
        let opacity = 1.0;

        if (entityData) {
          if (hasSignalEmitter(entityData)) {
            // Priority: If it's an emitter (Oscillator, Switch, Inverter), show output state.
            if (!entityData.signalState) {
              opacity = 0.5;
            }
          } else if (hasSignalReceiver(entityData)) {
            // Only check receiver state if it wasn't handled as an emitter.
            // This prevents Inverters (ON output, OFF input) from being dimmed by this block.
            // GATES EXCEPTION: Gates handle opacity themselves (open=semi-opaque, closed=opaque)
            if (entityData.receiverType !== 'gate') {
              if (!entityData.receivedSignal) {
                opacity = 0.5;
              }
            }
          }
        }

        // Apply density/liquid opacity to the element itself as well?
        // Previously we mixed it into color.
        // Let's adhere to the new strategy: Opacity property.
        // But wait, density/liquid logic above MODIFIED the color string.
        // To be safe and preserve previous behavior for fluids (which might want transparent color but opaque text? No, usually transparency),
        // I will leave the fluid logic modifying 'color' alone for now as it seemed specific.
        // I will only apply the signal dimming via the opacity prop.

        row.push({ char, className, color, opacity });
      }
    }

    gridData.push(row);
  }

  // Get scene metadata
  // const metadata = scene.metadata || {};
  // const sceneName = (metadata.name as string) || scene.id;

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${width}, 24px)`,
        gridTemplateRows: `repeat(${height}, 24px)`,
      }}
    >
      {gridData.map((row, y) =>
        row.map((cell, x) => (
          <div
            key={`${x}-${y}`}
            className={`cell ${cell.className}`}
            title={`(${x}, ${y})`}
            style={{
              color: cell.color,
              opacity: cell.opacity !== undefined ? cell.opacity : 1.0
            }}
          >
            {cell.char}
          </div>
        ))
      )}
    </div>
  );
}

/**
 * HUD - Display player stats (HP, Score, Lives, Weapon/Ammo).
 *
 * Shows:
 * - HP bar with current/max values
 * - Weapon and ammo (if equipped)
 * - Score
 * - Lives
 *
 * The HUD matches the grid width and condenses gracefully for small grids.
 *
 * @example
 * ```tsx
 * <HUD runtime={runtime} />
 * ```
 */
interface HUDProps {
  runtime: GameRuntime;
}

// Cell size matches GridRenderer (24px per cell)
const CELL_SIZE = 24;

export function HUD({ runtime }: HUDProps) {
  if (!runtime || !runtime.activeScene) {
    return null;
  }

  const scene = runtime.activeScene;
  const playerId = runtime.game.gameState.playerEntityId;
  const playerData = playerId ? scene.spatial.getEntityData(playerId) : null;

  // Calculate grid width in pixels
  const gridWidthPx = scene.grid.width * CELL_SIZE;
  const isSmallGrid = scene.grid.width < 12;
  const isVerySmallGrid = scene.grid.width < 8;

  // Get HP (default to 0/0 if no player or no health)
  let hp = 0;
  let maxHp = 0;

  if (playerData && hasHealth(playerData)) {
    hp = playerData.hp ?? 0;
    maxHp = playerData.maxHp ?? 0;
  }

  const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;

  // Get weapon and ammo info
  let equippedWeapon: string | null = null;
  let currentAmmo = 0;
  let hasUnlimitedAmmo = false;
  let canMelee = false;

  if (playerData && hasWeapon(playerData)) {
    equippedWeapon = playerData.equippedWeapon || null;
    hasUnlimitedAmmo = playerData.unlimitedAmmo ?? false;
    if (equippedWeapon && playerData.ammo) {
      currentAmmo = playerData.ammo[equippedWeapon] ?? 0;
    }
  }

  if (playerData && hasMelee(playerData)) {
    canMelee = true;
  }

  // Determine display weapon: show MELEE if no weapon, no ammo, or weapon not set
  const displayWeapon = (equippedWeapon && (currentAmmo > 0 || hasUnlimitedAmmo))
    ? equippedWeapon
    : (canMelee ? 'MELEE' : null);

  // Get Score and Lives from game state (placeholder for now)
  const score = runtime.game.gameState.score ?? 0;
  const lives = runtime.game.gameState.lives ?? 3;

  // HP bar color based on percentage
  let hpColor = '#33cccc'; // Desaturated Cyan (Healthy)
  if (hpPercent < 25) {
    hpColor = '#cc3366'; // Desaturated Neon Red (Critical)
  } else if (hpPercent < 50) {
    hpColor = '#cc8833'; // Desaturated Orange (Warning)
  }

  return (
    <div
      className="hud"
      style={{
        width: `${gridWidthPx}px`,
        boxSizing: 'border-box',
        marginTop: '8px',
        padding: isSmallGrid ? '8px' : '12px',
        backgroundColor: '#0f0f1a',
        border: '1px solid #222',
        borderLeft: '3px solid #333344',
        borderRadius: '0',
        fontFamily: 'Lexend, monospace',
        fontSize: isSmallGrid ? '10px' : '11px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: isSmallGrid ? '8px 12px' : '12px 20px',
          alignItems: 'center',
        }}
      >
        {/* HP Display - compact */}
        <div style={{ flex: '1 1 auto', minWidth: isVerySmallGrid ? '60px' : '100px', maxWidth: '180px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '4px',
              fontSize: isSmallGrid ? '9px' : '10px',
              color: '#33b5cc',
            }}
          >
            <span>HP</span>
            <span style={{ fontFamily: 'monospace' }}>
              {hp}/{maxHp}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: isSmallGrid ? '10px' : '12px',
              backgroundColor: '#1a1a2a',
              border: '1px solid #333',
              borderRadius: '0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${hpPercent}%`,
                height: '100%',
                backgroundColor: hpColor,
                transition: 'width 0.3s ease, background-color 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Weapon & Ammo Display - compact */}
        {displayWeapon && (
          <div style={{ textAlign: 'center', minWidth: isVerySmallGrid ? '50px' : '70px' }}>
            <div
              style={{
                fontSize: isSmallGrid ? '9px' : '10px',
                color: '#33b5cc',
                marginBottom: '2px',
              }}
            >
              {isVerySmallGrid ? 'WPN' : 'WEAPON'}
            </div>
            <div
              style={{
                fontSize: isSmallGrid ? '11px' : '12px',
                color: displayWeapon === 'MELEE' ? '#ff9966' : '#cc99ff',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {displayWeapon}
            </div>
            <div
              style={{
                fontSize: isSmallGrid ? '9px' : '10px',
                color: displayWeapon === 'MELEE'
                  ? '#888888'
                  : (hasUnlimitedAmmo ? '#33cc66' : (currentAmmo > 0 ? '#cccc33' : '#cc3366')),
                marginTop: '1px',
              }}
            >
              {displayWeapon === 'MELEE' ? '--' : (hasUnlimitedAmmo ? '∞' : currentAmmo)}
            </div>
          </div>
        )}

        {/* Score Display - compact */}
        <div style={{ textAlign: 'center', minWidth: isVerySmallGrid ? '40px' : '60px' }}>
          <div
            style={{
              fontSize: isSmallGrid ? '9px' : '10px',
              color: '#33b5cc',
              marginBottom: '2px',
            }}
          >
            {isVerySmallGrid ? 'PTS' : 'SCORE'}
          </div>
          <div
            style={{
              fontSize: isSmallGrid ? '12px' : '14px',
              color: '#cccc33',
              fontFamily: 'monospace',
            }}
          >
            {score.toLocaleString()}
          </div>
        </div>

        {/* Lives Display - compact */}
        <div style={{ textAlign: 'center', minWidth: isVerySmallGrid ? '30px' : '50px' }}>
          <div
            style={{
              fontSize: isSmallGrid ? '9px' : '10px',
              color: '#33b5cc',
              marginBottom: '2px',
            }}
          >
            {isVerySmallGrid ? '♥' : 'LIVES'}
          </div>
          <div
            style={{
              fontSize: isSmallGrid ? '12px' : '14px',
              color: '#cc3366',
              display: 'flex',
              justifyContent: 'center',
              gap: '2px',
            }}
          >
            {isVerySmallGrid ? (
              <span>{lives}</span>
            ) : (
              Array.from({ length: Math.min(lives, 5) }).map((_, i) => (
                <span key={i}>♥</span>
              ))
            )}
            {!isVerySmallGrid && lives > 5 && <span>+{lives - 5}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * DebugPanel - Display runtime debug information.
 *
 * Shows:
 * - Tick count
 * - Running state
 * - Player position
 * - Entity count
 *
 * @example
 * ```tsx
 * <DebugPanel runtime={runtime} />
 * ```
 */
interface DebugPanelProps {
  runtime: GameRuntime;
  inputManager?: InputManager;
  playerInputSystem?: PlayerInputSystem;
}

export function DebugPanel({
  runtime,
  inputManager,
  playerInputSystem,
}: DebugPanelProps) {
  if (!runtime) return null;

  const scene = runtime.activeScene;
  const playerId = runtime.game.gameState.playerEntityId;
  const playerPos =
    playerId && scene ? scene.spatial.getEntityPosition(playerId) : null;

  // Count entities in active scene
  let entityCount = 0;
  if (scene) {
    for (let y = 0; y < scene.grid.height; y++) {
      for (let x = 0; x < scene.grid.width; x++) {
        const cell = scene.grid.cell(x, y);
        if (cell) {
          for (let layer = 0; layer < 8; layer++) {
            if (cell.values[layer] !== undefined && cell.values[layer] !== 0) {
              entityCount++;
            }
          }
        }
      }
    }
  }

  return (
    <div className="debug-panel">
      <h3>Debug Info</h3>
      <p>
        <span className="label">Tick:</span> {runtime.tickCount}
      </p>
      <p>
        <span className="label">Status:</span>{' '}
        {runtime.isRunning ? (
          <span style={{ color: '#4ec9b0' }}>Running</span>
        ) : (
          <span style={{ color: '#808080' }}>Stopped</span>
        )}
      </p>
      <p>
        <span className="label">Entities:</span> {entityCount}
      </p>
      {playerPos && (
        <p>
          <span className="label">Player:</span> ({playerPos.x}, {playerPos.y})
        </p>
      )}
      {inputManager && (
        <p>
          <span className="label">Input Mode:</span>{' '}
          <span style={{ color: '#dcdcaa', fontWeight: 'bold' }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(inputManager as any).config.directionMode}
          </span>{' '}
          <span style={{ color: '#808080', fontSize: '11px' }}>
            (press K to toggle)
          </span>
        </p>
      )}
      {playerInputSystem && (
        <>
          <p>
            <span className="label">Last Direction:</span>{' '}
            {playerInputSystem.debugStats.lastDirection}
          </p>
          <p>
            <span className="label">Moves/Tick:</span>{' '}
            {playerInputSystem.debugStats.movesThisTick}
          </p>
          <p>
            <span className="label">Blocked:</span>{' '}
            {playerInputSystem.debugStats.blockedMoves}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * ControlsPanel - Display keyboard controls.
 */
export function ControlsPanel() {
  return (
    <div className="controls">
      <h3>Controls</h3>
      <p>
        <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or <kbd>↑</kbd>{' '}
        <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> - Move player
      </p>
      <p style={{ marginTop: '8px', fontSize: '12px', color: '#808080' }}>
        Movement is queued and processed at {10} ticks per second
      </p>
    </div>
  );
}
