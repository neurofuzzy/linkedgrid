import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { Snapshot } from '../lib/test-executor.js';
import { GameLayers } from '../../spartan/types.js';

interface Assertion {
  description: string;
  passed: boolean;
  error?: string;
}

interface Props {
  currentIndex: number;
  totalSnapshots: number;
  isPlaying: boolean;
  interval: number;
  assertions?: Assertion[];
  snapshot: Snapshot | null;
}

export function InfoPanel({ 
  currentIndex,
  totalSnapshots,
  isPlaying,
  interval,
  assertions,
  snapshot
}: Props) {
  const argsStr = snapshot && snapshot.operation !== 'initial' && snapshot.args.length > 0
    ? snapshot.args.map(a => JSON.stringify(a)).join(', ')
    : '';
    
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={2} paddingY={1} marginLeft={1}>
      {/* Playback controls at the top */}
      <Box>
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
            {interval}ms interval | [→] step
          </Text>
        </Box>
      </Box>
      
      {/* Assertions in the middle if present */}
      {assertions && assertions.length > 0 && (
        <>
          <Box marginTop={1}>
            <Text bold dimColor>Assertions</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {assertions.map((assertion, i) => (
              <Box key={i} marginBottom={i < assertions.length - 1 ? 1 : 0}>
                <Text color={assertion.passed ? 'green' : 'red'}>
                  {assertion.passed ? '✓' : '✗'}
                </Text>
                <Text dimColor> {assertion.description}</Text>
                {!assertion.passed && assertion.error && (
                  <Box marginTop={0.5} marginLeft={2}>
                    <Text color="red" dimColor>{assertion.error}</Text>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </>
      )}
      
      {/* InfoBar at the bottom */}
      <Box marginTop={1} paddingTop={1} flexDirection="column">
        <Box>
          {!snapshot || snapshot.operation === 'initial' ? (
            <Text dimColor>No operation</Text>
          ) : (
            <Text>
              {chalk.yellow(snapshot.operation)}
              {argsStr && chalk.dim(` (${argsStr})`)}
            </Text>
          )}
        </Box>
        
        {/* Scene metadata */}
        {snapshot && (
          <Box marginTop={1}>
            <Text dimColor>Grid: </Text>
            <Text>{snapshot.grid.w}×{snapshot.grid.h}</Text>
            
            {snapshot.sceneId && (
              <>
                <Text dimColor> | Scene: </Text>
                <Text>{snapshot.sceneName || snapshot.sceneId}</Text>
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
