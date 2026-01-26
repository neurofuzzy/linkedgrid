import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { TestFile } from '../lib/test-discovery.js';

interface Props {
  tests: TestFile[];
  onSelect: (file: string, testName: string, index: number) => void;
}

export function TestSidebar({ tests, onSelect }: Props) {
  const items = tests.flatMap((testFile, fileIndex) => 
    testFile.tests.map((testName, testIndex) => ({
      key: `${testFile.file}-${testName}-${testIndex}`,
      label: testName,
      value: { file: testFile.file, testName, globalIndex: fileIndex * 1000 + testIndex }
    }))
  );
  
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={2} paddingY={1}>
      <Text bold color="cyan">Visual Tests</Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={({ value }) => onSelect(value.file, value.testName, value.globalIndex)}
        />
      </Box>
    </Box>
  );
}
