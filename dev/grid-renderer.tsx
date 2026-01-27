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
      <div style={{ padding: '20px', color: '#808080' }}>
        No active scene
      </div>
    );
  }
  
  const { grid, spatial } = scene;
  const width = grid.width;
  const height = grid.height;
  
  // Build grid data structure
  const gridData: Array<Array<{ char: string; className: string }>> = [];
  
  for (let y = 0; y < height; y++) {
    const row: Array<{ char: string; className: string }> = [];
    
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
        
        row.push({ char, className });
      }
    }
    
    gridData.push(row);
  }
  
  // Get scene metadata
  const metadata = scene.metadata || {};
  const sceneName = metadata.name as string || scene.id;
  
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
          >
            {cell.char}
          </div>
        ))
      )}
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

export function DebugPanel({ runtime, inputManager, playerInputSystem }: DebugPanelProps) {
  if (!runtime) return null;
  
  const scene = runtime.activeScene;
  const playerId = runtime.game.gameState.playerEntityId;
  const playerPos = playerId && scene ? scene.spatial.getEntityPosition(playerId) : null;
  
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
      {playerInputSystem && (
        <>
          <p>
            <span className="label">Input Buffer:</span> {playerInputSystem.debugStats.bufferSize} queued
          </p>
          <p>
            <span className="label">Keys Held:</span> {playerInputSystem.debugStats.keysHeld}
          </p>
          <p>
            <span className="label">Last Direction:</span> {playerInputSystem.debugStats.lastDirection}
          </p>
          <p>
            <span className="label">Moves/Tick:</span> {playerInputSystem.debugStats.movesThisTick}
          </p>
          <p>
            <span className="label">Blocked:</span> {playerInputSystem.debugStats.blockedMoves}
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
        <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> - Move player
      </p>
      <p style={{ marginTop: '8px', fontSize: '12px', color: '#808080' }}>
        Movement is queued and processed at {10} ticks per second
      </p>
    </div>
  );
}
