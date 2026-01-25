import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { TestFile } from '../lib/test-discovery.js';

interface Props {
  tests: TestFile[];
  onSelect: (file: string, testName: string) => void;
}

export function TestSidebar({ tests, onSelect }: Props) {
  const items = tests.flatMap(testFile =>
    testFile.tests.map((testName, idx) => ({
      key: `${testFile.file}-${testName}-${idx}`,
      label: testName,
      value: { file: testFile.file, testName }
    }))
  );
  
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
      <Text bold color="cyan">Visual Tests</Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={({ value }) => onSelect(value.file, value.testName)}
        />
      </Box>
    </Box>
  );
}
