import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import { useInput } from 'ink';
import { TestSidebar } from './TestSidebar.js';
import { GridRenderer } from './GridRenderer.js';
import { InfoPanel } from './InfoPanel.js';
import { CategoryTabs } from './CategoryTabs.js';
import { discoverTests, type TestFile } from '../lib/test-discovery.js';
import { TestExecutor, type Snapshot, type TestResult, type VisualTestDefinition } from '../lib/test-executor.js';
import { usePlayback } from '../hooks/usePlayback.js';

// Discriminated union - makes invalid states impossible
type TestRunnerState = 
  | { type: 'selecting' }
  | { 
      type: 'loaded';
      testName: string;
      testIndex: number;
      snapshot: Snapshot;
      definition: VisualTestDefinition;
      executor: TestExecutor;
    }
  | { 
      type: 'running';
      testName: string;
      testIndex: number;
      snapshots: Snapshot[];
      definition: VisualTestDefinition;
      executor: TestExecutor;
      result: TestResult;  // Store result while playing
    }
  | { 
      type: 'completed';
      testName: string;
      testIndex: number;
      snapshots: Snapshot[];
      result: TestResult;
      definition: VisualTestDefinition;
    };

export function App() {
  const [tests, setTests] = useState<TestFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<TestRunnerState>({ type: 'selecting' });
  const [showSidebar, setShowSidebar] = useState(false); // Only used within test view
  const [selectedCategory, setSelectedCategory] = useState<string>('Movement'); // Default category
  
  const handleStart = async () => {
    if (state.type !== 'loaded') return; // Type guard!
    
    const { definition, executor, snapshot, testName, testIndex } = state;
    
    try {
      // Run act & assert phases
      const result = await executor.executeActAssert(definition);
      
      // If act phase is empty, stay in loaded state (nothing to animate)
      if (result.snapshots.length === 0) {
        // Test completed successfully with no actions to animate
        setState({
          type: 'completed',
          testName,
          testIndex,
          snapshots: [snapshot], // Just the arrange snapshot
          result: { ...result, snapshots: [snapshot] },
          definition
        });
        return;
      }
      
      // Prepend arrange snapshot to results
      const allSnapshots = [snapshot, ...result.snapshots];
      
      // Transition to running state with result stored (triggers auto-play)
      setState({
        type: 'running',
        testName,
        testIndex,
        snapshots: allSnapshots,
        definition,
        executor,
        result  // Store result for when playback completes
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };
  
  const handleComplete = () => {
    if (state.type !== 'running') return; // Type guard!
    
    const { snapshots, testName, testIndex, definition, result } = state;
    
    setState({
      type: 'completed',
      testName,
      testIndex,
      snapshots,
      result,
      definition
    });
  };
  
  const handleRestart = async () => {
    if (state.type !== 'completed') return; // Type guard!
    
    const { definition, testName, testIndex, snapshots: currentSnapshots } = state;
    
    // Keep showing the last frame while we restart
    try {
      // Create fresh executor and re-run arrange
      const executor = new TestExecutor();
      const snapshot = await executor.executeArrange(definition);
      
      // Transition directly to loaded state (no intermediate state change)
      setState({
        type: 'loaded',
        testName,
        testIndex,
        snapshot,
        definition,
        executor
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };
  
  // Derive props from state - memoize to prevent recreating array on every render
  // Use specific dependencies instead of entire state object to prevent infinite loops
  const snapshots = useMemo(() => {
    if (state.type === 'running' || state.type === 'completed') {
      return state.snapshots;
    } else if (state.type === 'loaded') {
      return [state.snapshot];
    }
    return [];
  }, [
    state.type,
    state.type === 'running' || state.type === 'completed' ? state.snapshots : null,
    state.type === 'loaded' ? state.snapshot : null
  ]);

  const { currentIndex, isPlaying, snapshot, togglePlayback, stepForward, stepBackward } = usePlayback(
    snapshots,
    state.type === 'loaded' ? handleStart : 
    state.type === 'completed' ? handleRestart : 
    undefined,
    state.type === 'running',  // Auto-play when running
    state.type === 'running' ? () => handleComplete() : undefined
  );
  const { write } = useStdout();
  
  // Get previous snapshot for scene transition detection
  const previousSnapshot = currentIndex > 0 ? snapshots[currentIndex - 1] : null;
  
  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(tests.map(t => t.category))).sort();
    // Ensure selectedCategory exists in list
    if (cats.length > 0 && !cats.includes(selectedCategory)) {
      setSelectedCategory(cats[0]);
    }
    return cats;
  }, [tests]);
  
  // Filter tests by selected category
  const filteredTests = useMemo(() => 
    tests.filter(t => t.category === selectedCategory),
    [tests, selectedCategory]
  );
  
  // Flatten tests for navigation
  const flatTests = filteredTests.flatMap(testFile =>
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
  
  // Clear screen when returning to selection
  useEffect(() => {
    if (state.type === 'selecting') {
      write('\x1Bc');
    }
  }, [state.type, write]);
  
  // Keyboard controls
  useInput((input, key) => {
    if (input === 's') {
      setShowSidebar(prev => !prev);
    } else if (input === 'q') {
      process.exit(0);
    } else if (key.escape) {
      // Go back to test selection (useEffect will clear screen)
      setState({ type: 'selecting' });
    } else if (state.type === 'selecting' && (key.leftArrow || key.rightArrow)) {
      // Switch categories in selection view
      const direction = key.leftArrow ? -1 : 1;
      const currentIndex = categories.indexOf(selectedCategory);
      const newIndex = (currentIndex + direction + categories.length) % categories.length;
      setSelectedCategory(categories[newIndex]);
    } else if (state.type !== 'selecting' && (key.upArrow || key.downArrow)) {
      // Navigate between tests
      const direction = key.upArrow ? -1 : 1;
      const newIndex = state.testIndex + direction;
      if (newIndex >= 0 && newIndex < flatTests.length) {
        const test = flatTests[newIndex];
        handleSelectTest(test.file, test.testName, newIndex);
      }
    } else if (state.type !== 'selecting' && key.leftArrow) {
      // Step backward - if loaded, start test first
      if (state.type === 'loaded') {
        handleStart();
      } else {
        stepBackward();
      }
    } else if (state.type !== 'selecting' && key.rightArrow) {
      // Step forward - if loaded, start test first
      if (state.type === 'loaded') {
        handleStart();
      } else {
        stepForward();
      }
    } else if (state.type !== 'selecting' && (input === ' ' || key.return)) {
      // Toggle play/pause or trigger action
      if (state.type === 'loaded') {
        handleStart();
      } else if (state.type === 'completed') {
        handleRestart();
      } else {
        togglePlayback();
      }
    } else if (state.type !== 'selecting' && input === 'r') {
      // Restart
      if (state.type === 'completed') {
        handleRestart();
      } else if (state.type === 'loaded') {
        handleStart();
      }
    }
  });
  
  // Handle test selection - load and execute arrange phase
  const handleSelectTest = async (file: string, testName: string, index: number) => {
    setShowSidebar(false);
    
    try {
      const modulePath = `../../${file}`;
      await import(modulePath);
      
      const testRegistry = (globalThis as any).visualTests || [];
      const testEntry = testRegistry.find((t: any) => t.name === testName);
      
      if (!testEntry) {
        throw new Error(`Test "${testName}" not found in registry`);
      }
      
      const definition = testEntry.definition;
      const executor = new TestExecutor();
      
      // Execute arrange phase
      const snapshot = await executor.executeArrange(definition);
      
      // Transition to loaded state
      setState({
        type: 'loaded',
        testName,
        testIndex: index,
        snapshot,
        definition,
        executor
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };
  
  // Render status indicator
  const renderStatus = () => {
    switch (state.type) {
      case 'selecting':
        return null;
      case 'loaded':
        return <Text dimColor> [IDLE - press enter to start]</Text>;
      case 'running':
        return <Text color="blue"> [⟳ RUNNING]</Text>;
      case 'completed':
        return (
          <Text color={state.result.passed ? 'green' : 'red'}>
            {' '}[{state.result.passed ? '✓ PASS' : '✗ FAIL'}]
          </Text>
        );
    }
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
        {state.type !== 'selecting' && (
          <>
            <Text dimColor> - {state.testName} ({state.testIndex + 1}/{flatTests.length})</Text>
            {renderStatus()}
          </>
        )}
      </Box>
      
      <Box>
        {state.type === 'selecting' ? (
          // Show test selection with categories
          <Box flexDirection="column" width="100%">
            <CategoryTabs 
              categories={categories} 
              selectedCategory={selectedCategory} 
              onSelect={setSelectedCategory} 
            />
            <Box marginTop={1}>
              <TestSidebar tests={filteredTests} onSelect={handleSelectTest} />
            </Box>
          </Box>
        ) : (
          // Show test runner interface
          <>
            {showSidebar && (
              <Box marginRight={1} width="40%">
                <TestSidebar tests={filteredTests} onSelect={handleSelectTest} />
              </Box>
            )}
            
            <Box flexDirection="column" flexGrow={1}>
              <Box>
                <GridRenderer snapshot={snapshot} previousSnapshot={previousSnapshot} />
                <InfoPanel 
                  currentIndex={currentIndex}
                  totalSnapshots={snapshots.length}
                  isPlaying={isPlaying}
                  interval={500}
                  assertions={state.type === 'completed' ? state.result.assertions : undefined}
                  snapshot={snapshot}
                  previousSnapshot={previousSnapshot}
                />
              </Box>
              {state.type === 'completed' && !state.result.passed && (
                <Box marginTop={1} borderStyle="single" borderColor="red" padding={1}>
                  <Text color="red" bold>Test Failed: </Text>
                  <Text color="red">{state.result.error}</Text>
                </Box>
              )}
              <Box marginTop={1}>
                <Text dimColor>
                  [esc] menu | [↑↓] switch test | {
                    state.type === 'loaded' 
                      ? '[enter/space] start test' 
                      : state.type === 'completed'
                      ? '[enter/space] restart'
                      : '[enter] play | [space] play/pause | [←→] step'
                  } | [r] restart | [q] quit
                </Text>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
