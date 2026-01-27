import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { Snapshot } from '../lib/test-executor.js';

interface Props {
  snapshot: Snapshot | null;
  previousSnapshot?: Snapshot | null;
}

const ENTITY_COLORS: Record<string, (s: string) => string> = {
  player: chalk.blue,
  enemy: chalk.red,
  item: chalk.yellow,
  projectile: chalk.magenta,
  wall: chalk.gray,
  teleporter: chalk.cyan,
};

const DEFAULT_GRID_SIZE = { w: 20, h: 20 };

export function GridRenderer({ snapshot, previousSnapshot }: Props) {
  const grid = snapshot?.grid || DEFAULT_GRID_SIZE;
  
  // Detect scene change
  const sceneChanged = previousSnapshot && 
                       snapshot?.sceneId && 
                       previousSnapshot.sceneId !== snapshot.sceneId;
  
  // Build ASCII grid
  const lines: string[] = [];
  for (let y = 0; y < grid.h; y++) {
    let line = '';
    for (let x = 0; x < grid.w; x++) {
      // Get all entities at this position
      const entitiesHere = snapshot?.entities.filter(e => e.x === x && e.y === y) || [];
      
      if (entitiesHere.length > 0) {
        // Show entity on highest layer (follows same logic as getTopmostEntity)
        // Rule 8: higher layer indexes render "on top" of lower layers
        const topEntity = entitiesHere.reduce((highest, current) => 
          current.layer > highest.layer ? current : highest
        );
        
        const char = topEntity.type[0].toUpperCase();
        const colorFn = ENTITY_COLORS[topEntity.type] || chalk.white;
        line += colorFn(char) + ' ';
      } else {
        line += chalk.dim('·') + ' ';
      }
    }
    lines.push(line);
  }
  
  return (
    <Box flexDirection="column">
      {/* Scene transition indicator */}
      {sceneChanged && (
        <Box marginBottom={1} borderStyle="single" borderColor="yellow" paddingX={1}>
          <Text color="yellow" bold>→ Scene Transition</Text>
          <Text dimColor> from </Text>
          <Text>{previousSnapshot.sceneName || previousSnapshot.sceneId}</Text>
          <Text dimColor> to </Text>
          <Text color="yellow">{snapshot.sceneName || snapshot.sceneId}</Text>
        </Box>
      )}
      
      {/* Scene header */}
      {snapshot?.sceneId && (
        <Box marginBottom={1}>
          <Text bold color="cyan">Scene: </Text>
          <Text color="white">
            {snapshot.sceneName || snapshot.sceneId}
            {snapshot.sceneName && snapshot.sceneName !== snapshot.sceneId && (
              <Text dimColor> ({snapshot.sceneId})</Text>
            )}
          </Text>
        </Box>
      )}
      
      {/* Grid display */}
      <Box flexDirection="column" borderStyle="single" paddingX={2} paddingY={1} width={grid.w * 2 + 6}>
        {lines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
    </Box>
  );
}
