import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { Snapshot } from '../lib/test-executor.js';

interface Props {
  snapshot: Snapshot | null;
}

const ENTITY_COLORS: Record<string, (s: string) => string> = {
  player: chalk.blue,
  enemy: chalk.red,
  item: chalk.yellow,
  projectile: chalk.magenta,
  wall: chalk.gray,
};

const DEFAULT_GRID_SIZE = { w: 20, h: 20 };

export function GridRenderer({ snapshot }: Props) {
  const grid = snapshot?.grid || DEFAULT_GRID_SIZE;
  
  // Build ASCII grid
  const lines: string[] = [];
  for (let y = 0; y < grid.h; y++) {
    let line = '';
    for (let x = 0; x < grid.w; x++) {
      const entity = snapshot?.entities.find(e => e.x === x && e.y === y);
      if (entity) {
        const char = entity.type[0].toUpperCase();
        const colorFn = ENTITY_COLORS[entity.type] || chalk.white;
        line += colorFn(char) + ' ';
      } else {
        line += chalk.dim('·') + ' ';
      }
    }
    lines.push(line);
  }
  
  return (
    <Box flexDirection="column" borderStyle="single" padding={1}>
      {lines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  );
}
