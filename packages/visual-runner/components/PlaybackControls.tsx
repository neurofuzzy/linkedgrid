import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

interface Props {
  currentIndex: number;
  totalSnapshots: number;
  isPlaying: boolean;
  interval: number;
}

export function PlaybackControls({
  currentIndex,
  totalSnapshots,
  isPlaying,
  interval
}: Props) {
  return (
    <Box borderStyle="single" paddingX={2} paddingY={1}>
      <Box marginRight={2}> 
        <Text>
          {isPlaying ? chalk.green('▶ Playing') : chalk.gray('⏸ Paused')}
        </Text>
      </Box>
      <Box marginRight={2}>
        <Text>
          {chalk.cyan(`${currentIndex + 1}/${Math.max(totalSnapshots, 1)}`)}
        </Text>
      </Box>
      <Box>
        <Text dimColor>
          {interval}ms interval | [enter] play | [space] play/pause | [→] step
        </Text>
      </Box>
    </Box>
  );
}
