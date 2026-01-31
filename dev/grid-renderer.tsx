import React from 'react';
import type { Scene } from '../packages/spartan/scene';

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
    Array<{ char: string; className: string; color?: string }>
  > = [];

  for (let y = 0; y < height; y++) {
    const row: Array<{ char: string; className: string; color?: string }> = [];

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
        let color = (entityData as any)?.color;

        // Apply density opacity if present (e.g., poison gas)
        if (color && (entityData as any).density !== undefined) {
          const density = (entityData as any).density;
          // Map 0-100 density to 0.1-1.0 opacity
          const opacity = Math.max(0.1, Math.min(1.0, density / 100));
          // Convert hex to rgba to apply opacity
          if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            color = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          }
        }

        // Apply liquid depth opacity
        if (
          color &&
          (entityData as any).depth !== undefined &&
          (entityData as any).type !== 'poison-gas'
        ) {
          const depth = (entityData as any).depth;
          // Map depth 1 -> 0.4, depth 10 -> 1.0
          const opacity = Math.min(1.0, 0.4 + (depth - 1) * 0.1);

          if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            color = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          }
        }

        row.push({ char, className, color });
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
            style={cell.color ? { color: cell.color } : undefined}
          >
            {cell.char}
          </div>
        ))
      )}
    </div>
  );
}

/**
 * HUD - Display player stats (HP, Score, Lives).
 *
 * Shows:
 * - HP bar with current/max values
 * - Score (placeholder)
 * - Lives (placeholder)
 *
 * @example
 * ```tsx
 * <HUD runtime={runtime} />
 * ```
 */
interface HUDProps {
  runtime: any; // GameRuntime
}

export function HUD({ runtime }: HUDProps) {
  if (!runtime || !runtime.activeScene) {
    return null;
  }

  const scene = runtime.activeScene;
  const playerId = runtime.game.gameState.playerEntityId;
  const playerData = playerId ? scene.spatial.getEntityData(playerId) : null;

  // Get HP (default to 0/0 if no player or no health)
  const hp = (playerData as any)?.hp ?? 0;
  const maxHp = (playerData as any)?.maxHp ?? 0;
  const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;

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
        marginTop: '12px',
        padding: '16px',
        backgroundColor: '#0f0f1a',
        border: '1px solid #222',
        borderLeft: '4px solid #333344',
        borderRadius: '0',
        fontFamily: 'Lexend, monospace',
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        {/* HP Display */}
        <div style={{ flex: '1', minWidth: '200px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
              fontSize: '12px',
              color: '#33b5cc',
            }}
          >
            <span>HP</span>
            <span>
              {hp} / {maxHp}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '16px',
              backgroundColor: '#1a1a2a',
              border: '1px solid #333',
              borderRadius: '0',
              overflow: 'hidden',
              position: 'relative',
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

        {/* Score Display */}
        <div
          style={{
            minWidth: '120px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: '#33b5cc',
              marginBottom: '4px',
            }}
          >
            SCORE
          </div>
          <div
            style={{
              fontSize: '16px',
              color: '#cccc33',
            }}
          >
            {score.toLocaleString()}
          </div>
        </div>

        {/* Lives Display */}
        <div
          style={{
            minWidth: '100px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: '#33b5cc',
              marginBottom: '4px',
            }}
          >
            LIVES
          </div>
          <div
            style={{
              fontSize: '16px',
              color: '#cc3366',
              display: 'flex',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            {Array.from({ length: lives }).map((_, i) => (
              <span key={i}>♥</span>
            ))}
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
  runtime: any; // GameRuntime
  inputManager?: any; // InputManager
  playerInputSystem?: any; // PlayerInputSystem
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
            <span className="label">Input Buffer:</span>{' '}
            {playerInputSystem.debugStats.bufferSize} queued
          </p>
          <p>
            <span className="label">Keys Held:</span>{' '}
            {playerInputSystem.debugStats.keysHeld}
          </p>
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
