import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import { useInput } from 'ink';
import { TestSidebar } from './TestSidebar.js';
import { GridRenderer } from './GridRenderer.js';
import { PlaybackControls } from './PlaybackControls.js';
import { InfoBar } from './InfoBar.js';
import { discoverTests, type TestFile } from '../lib/test-discovery.js';
import { TestExecutor, type Snapshot, type TestResult, type VisualTestDefinition } from '../lib/test-executor.js';
import { usePlayback } from '../hooks/usePlayback.js';

type TestStatus = 'idle' | 'running' | 'complete';

export function App() {
  const [tests, setTests] = useState<TestFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [selectedTestIndex, setSelectedTestIndex] = useState<number>(-1);
  const [testDefinition, setTestDefinition] = useState<VisualTestDefinition | null>(null);
  const [testExecutor, setTestExecutor] = useState<TestExecutor | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [showSidebar, setShowSidebar] = useState(true);
  
  const handleExecuteTest = async () => {
    if (!testDefinition || !testExecutor) return;
    
    setTestStatus('running');
    setSnapshots([]);
    setTestResult(null);
    
    try {
      const result = await testExecutor.executeActAssert(testDefinition);
      setTestResult(result);
      setSnapshots(result.snapshots);
    } catch (err) {
      setError((err as Error).message);
      setTestStatus('complete');
    }
  };
  
  const handleRestart = () => {
    handleExecuteTest();
  };
  
  const { currentIndex, isPlaying, interval, snapshot, isAtEnd, startPlayback } = usePlayback(
    snapshots, 
    handleRestart,
    testStatus,
    (status) => setTestStatus(status)
  );
  const { write } = useStdout();
  
  // Flatten tests for navigation
  const flatTests = tests.flatMap(testFile =>
    testFile.tests.map(testName => ({
      file: testFile.file,
      testName
    }))
  );
  
  // Clear terminal on mount
  useEffect(() => {
    write('\x1Bc'); // Clear entire screen and scrollback
  }, []);
  
  // Load tests on mount
  useEffect(() => {
    discoverTests()
      .then(setTests)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  
  // Keyboard controls
  useInput((input, key) => {
    if (input === 's') {
      setShowSidebar(prev => !prev);
    } else if (input === 'q') {
      process.exit(0);
    } else if (key.home) {
      // Go back to test selection
      setShowSidebar(true);
      setSelectedTest(null);
      setSelectedTestIndex(-1);
      setSnapshots([]);
      setTestStatus('idle');
      setTestResult(null);
    } else if (!showSidebar && (key.upArrow || key.downArrow)) {
      // Navigate between tests when viewing a test
      let newIndex = selectedTestIndex;
      if (key.upArrow && selectedTestIndex > 0) {
        newIndex = selectedTestIndex - 1;
      } else if (key.downArrow && selectedTestIndex < flatTests.length - 1) {
        newIndex = selectedTestIndex + 1;
      }
      
      if (newIndex !== selectedTestIndex) {
        const test = flatTests[newIndex];
        handleSelectTest(test.file, test.testName, newIndex);
      }
    }
  });
  
  // Handle test selection - load and execute arrange phase
  const handleSelectTest = async (file: string, testName: string, index?: number) => {
    setSelectedTest(testName);
    setShowSidebar(false);
    setTestResult(null);
    setTestStatus('idle');
    setSnapshots([]);
    setTestDefinition(null);
    setTestExecutor(null);
    
    // Set the index if provided, otherwise find it
    if (index !== undefined) {
      setSelectedTestIndex(index);
    } else {
      const idx = flatTests.findIndex(t => t.file === file && t.testName === testName);
      setSelectedTestIndex(idx);
    }
    
    try {
      // Dynamic import to load the test definition
      const modulePath = `../../${file}`;
      const module = await import(modulePath);
      
      // Get test definition from globalThis.visualTests registry
      const testRegistry = (globalThis as any).visualTests || [];
      const testEntry = testRegistry.find((t: any) => t.name === testName);
      
      if (!testEntry) {
        throw new Error(`Test "${testName}" not found in registry`);
      }
      
      // Store the test definition and execute arrange phase
      const definition = testEntry.definition;
      setTestDefinition(definition);
      
      const executor = new TestExecutor();
      setTestExecutor(executor);
      
      // Execute arrange phase to show initial state
      const initialSnapshot = await executor.executeArrange(definition);
      setSnapshots([initialSnapshot]);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  
  // Render status indicator
  const renderStatus = () => {
    if (testStatus === 'idle') {
      return <Text dimColor> [IDLE - press enter to start]</Text>;
    }
    if (testStatus === 'running') {
      return <Text color="blue"> [⟳ RUNNING]</Text>;
    }
    if (testStatus === 'complete' && testResult) {
      return (
        <Text color={testResult.passed ? 'green' : 'red'}>
          {' '}[{testResult.passed ? '✓ PASS' : '✗ FAIL'}]
        </Text>
      );
    }
    return null;
  };
  
  if (loading) {
    return (
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> Loading tests...</Text>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press q to quit</Text>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>LinkedGrid Visual Test Runner</Text>
        {selectedTest && !showSidebar && (
          <>
            <Text dimColor> - {selectedTest} ({selectedTestIndex + 1}/{flatTests.length})</Text>
            {renderStatus()}
          </>
        )}
      </Box>
      
      <Box>
        {showSidebar && (
          <Box marginRight={1} width="40%">
            <TestSidebar tests={tests} onSelect={handleSelectTest} />
          </Box>
        )}
        
        <Box flexDirection="column" flexGrow={1}>
          <GridRenderer snapshot={snapshot} />
          <Box marginTop={1}>
            <InfoBar snapshot={snapshot} />
          </Box>
          {testResult && !testResult.passed && (
            <Box marginTop={1} borderStyle="single" borderColor="red" padding={1}>
              <Text color="red" bold>Test Failed: </Text>
              <Text color="red">{testResult.error}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <PlaybackControls
              currentIndex={currentIndex}
              totalSnapshots={snapshots.length}
              isPlaying={isPlaying}
              interval={interval}
            />
          </Box>
          {!showSidebar && (
            <Box marginTop={1}>
              <Text dimColor>
                [home] menu | [↑↓] switch test | {
                  testStatus === 'idle' 
                    ? '[enter/space] start test' 
                    : testStatus === 'complete'
                    ? '[enter/space] restart'
                    : '[enter] play | [space] play/pause | [←→] step'
                } | [r] restart | [q] quit
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
