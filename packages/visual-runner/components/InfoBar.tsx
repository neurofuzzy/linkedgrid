import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { Snapshot } from '../lib/test-executor.js';

interface Props {
  snapshot: Snapshot | null;
}

export function InfoBar({ snapshot }: Props) {
  if (!snapshot || snapshot.operation === 'initial') {
    return (
      <Box borderStyle="single" padding={1}>
        <Text dimColor>No operation</Text>
      </Box>
    );
  }
  
  const argsStr = snapshot.args.length > 0 
    ? snapshot.args.map(a => JSON.stringify(a)).join(', ')
    : '';
  
  return (
    <Box borderStyle="single" padding={1}>
      <Text>
        {chalk.yellow(snapshot.operation)}
        {argsStr && chalk.dim(`(${argsStr})`)}
      </Text>
    </Box>
  );
}
