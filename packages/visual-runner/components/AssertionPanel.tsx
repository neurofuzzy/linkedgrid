import React from 'react';
import { Box, Text } from 'ink';

interface Assertion {
  description: string;
  passed: boolean;
  error?: string;
}

interface Props {
  assertions: Assertion[] | undefined;
}

export function AssertionPanel({ assertions }: Props) {
  if (!assertions || assertions.length === 0) {
    return null;
  }
  
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={2} paddingY={1} marginLeft={1}>
      <Text bold dimColor>Assertions</Text>
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
    </Box>
  );
}
