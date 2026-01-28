import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { SceneLoader, type SceneConfig } from './scene-loader';
import { PlayerInputSystem } from './player-input-system';
import { InputManager } from '../packages/spartan/input';
import { GridRenderer, DebugPanel } from './grid-renderer';
import type { GameRuntime } from '../packages/spartan/game-runtime';

/**
 * Available game configurations.
 * Each game can contain multiple scenes.
 */
const AVAILABLE_GAMES = [
  { id: 'basic', name: 'Basic Game', path: '/dev/scenes/basic.json' },
  {
    id: 'teleporter',
    name: 'Teleporter Test',
    path: '/dev/scenes/teleporter.json',
  },
];

/**
 * Playground - Interactive Spartan game runtime.
 *
 * Features:
 * - Load scenes from JSON
 * - Keyboard input (WASD/arrows)
 * - Hot reload when scene files change
 * - Debug panel with runtime stats
 *
 * @example
 * Entry point is dev/index.html which loads this component.
 */
function Playground() {
  const [runtime, setRuntime] = useState<GameRuntime | null>(null);
  const [inputManager, setInputManager] = useState<InputManager | null>(null);
  const [playerInputSystem, setPlayerInputSystem] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState(AVAILABLE_GAMES[0].path);
  const [gameKey, setGameKey] = useState(0); // For forcing remount on hot reload
  const [, forceUpdate] = useState({}); // For forcing re-renders without corrupting tick

  const renderIntervalRef = useRef<number | null>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const inputManagerRef = useRef<InputManager | null>(null);
  const playerInputSystemRef = useRef<any>(null);

  // Load and initialize runtime when scene changes
  useEffect(() => {
    let mounted = true;
    let loadedRuntime: GameRuntime | null = null;
    let loadedInputManager: InputManager | null = null;

    const loadScene = async () => {
      try {
        setLoading(true);
        setError(null);

        // Clean up existing runtime
        if (runtimeRef.current) {
          runtimeRef.current.stop();
          runtimeRef.current = null;
        }

        if (inputManagerRef.current) {
          inputManagerRef.current.destroy();
          inputManagerRef.current = null;
        }

        // Fetch game config
        const response = await fetch(selectedGame);
        if (!response.ok) {
          throw new Error(`Failed to load game: ${response.statusText}`);
        }

        const config: SceneConfig = await response.json();

        // Validate config
        const loader = new SceneLoader();
        const errors = SceneLoader.validate(config);
        if (errors.length > 0) {
          throw new Error(`Game validation failed:\n${errors.join('\n')}`);
        }

        // Load game and create runtime first (need gameManager)
        loadedRuntime = loader.load(config);

        // Create input manager with buffering enabled for low tick rate
        // Pass document.body to enable DOM event listeners (keyboard attaches to document)
        loadedInputManager = new InputManager(document.body, null, {
          cellSize: 24,
          cellGap: 0,
          bufferInput: false, // Don't use legacy buffering
          directionMode: 'continuous', // CONTINUOUS mode: hold key = keep moving
        });

        // Enable keyboard and buffering for continuous mode
        // Buffer catches quick taps that happen between ticks
        loadedInputManager.enableKeyboard().enableBuffering(true);

        // Create player input system
        const loadedPlayerInputSystem = new PlayerInputSystem(
          loadedRuntime.game,
          loadedInputManager
        );

        // Register input system with runtime (not just gameLoop)
        // This ensures it persists across scene transitions
        (loadedRuntime as any).systems.push(loadedPlayerInputSystem);
        (loadedRuntime as any).gameLoop.addSystem(loadedPlayerInputSystem);

        // Start runtime
        loadedRuntime.start();

        if (mounted) {
          runtimeRef.current = loadedRuntime;
          inputManagerRef.current = loadedInputManager;
          playerInputSystemRef.current = loadedPlayerInputSystem;
          setRuntime(loadedRuntime);
          setInputManager(loadedInputManager);
          setPlayerInputSystem(loadedPlayerInputSystem);
          setTick(0);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load game:', err);
        if (mounted) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    };

    loadScene();

    return () => {
      mounted = false;
      if (loadedRuntime) {
        loadedRuntime.stop();
      }
      if (loadedInputManager) {
        loadedInputManager.destroy();
      }
    };
  }, [selectedGame, gameKey]);

  // Re-render on tick (60fps check, but only update if tick changed)
  useEffect(() => {
    if (!runtime) return;

    renderIntervalRef.current = window.setInterval(() => {
      if (runtimeRef.current && runtimeRef.current.tickCount !== tick) {
        setTick(runtimeRef.current.tickCount);
      }
    }, 1000 / 60); // 60fps rendering

    return () => {
      if (renderIntervalRef.current !== null) {
        clearInterval(renderIntervalRef.current);
      }
    };
  }, [runtime]); // Only recreate when runtime changes, not on every tick

  // Hot reload support - listen for Vite HMR events
  useEffect(() => {
    if (import.meta.hot) {
      // When any JSON file changes, reload the game
      import.meta.hot.on('vite:beforeUpdate', () => {
        console.log('Hot reload triggered - reloading game...');
        setGameKey((prev) => prev + 1);
      });
    }
  }, []);

  // Keyboard shortcuts: K to toggle input mode, TAB to cycle games
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // K: Toggle input mode
      if (e.key === 'k' || e.key === 'K') {
        if (!inputManagerRef.current) return;

        const currentMode = (inputManagerRef.current as any).config
          .directionMode;
        const newMode = currentMode === 'continuous' ? 'tap' : 'continuous';

        // Update config
        (inputManagerRef.current as any).config.directionMode = newMode;

        // For tap mode, disable buffering (single press should move once)
        // For continuous mode, enable buffering (catch quick presses)
        if (newMode === 'tap') {
          inputManagerRef.current.enableBuffering(false);
        } else {
          inputManagerRef.current.enableBuffering(true);
        }

        // Force re-render to update debug panel
        forceUpdate({});

        console.log(`Input mode: ${newMode}`);
      }

      // TAB: Cycle to next game
      if (e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = AVAILABLE_GAMES.findIndex(
          (g) => g.path === selectedGame
        );
        const nextIndex = (currentIndex + 1) % AVAILABLE_GAMES.length;
        const nextGame = AVAILABLE_GAMES[nextIndex];
        setSelectedGame(nextGame.path);
        console.log(`Switched to: ${nextGame.name}`);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [selectedGame]);

  const handleGameChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGame(e.target.value);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Spartan Playground</h1>
        <p style={{ color: '#4ec9b0' }}>Loading game...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Spartan Playground</h1>
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            background: '#3c1f1f',
            border: '1px solid #f48771',
            borderRadius: '4px',
            color: '#f48771',
          }}
        >
          <h3 style={{ marginBottom: '10px' }}>Error Loading Game</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
            {error}
          </pre>
        </div>
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={() => setGameKey((prev) => prev + 1)}
            style={{
              padding: '8px 16px',
              background: '#4ec9b0',
              border: 'none',
              borderRadius: '4px',
              color: '#1e1e1e',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <h1 style={{ margin: 0 }}>Spartan Playground</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ color: '#9cdcfe', fontSize: '14px' }}>Game:</label>
          <span
            style={{ color: '#808080', fontSize: '12px', marginRight: '10px' }}
          >
            (TAB to cycle)
          </span>
          <select
            value={selectedGame}
            onChange={handleGameChange}
            style={{
              padding: '6px 12px',
              background: '#252526',
              border: '1px solid #3c3c3c',
              borderRadius: '4px',
              color: '#d4d4d4',
              fontFamily: 'inherit',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {AVAILABLE_GAMES.map((game) => (
              <option key={game.id} value={game.path}>
                {game.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ marginTop: '20px' }}>
          <GridRenderer scene={runtime?.activeScene || null} />
        </div>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <DebugPanel
            runtime={runtime}
            inputManager={inputManager}
            playerInputSystem={playerInputSystem}
          />

          <div className="debug-panel">
            <h3>Active Scene</h3>
            {runtime?.activeScene && (
              <>
                <p>
                  <span className="label">Name:</span>{' '}
                  {runtime.activeScene.metadata?.name || runtime.activeScene.id}
                </p>
                <p>
                  <span className="label">ID:</span> {runtime.activeScene.id}
                </p>
                <p>
                  <span className="label">Grid:</span>{' '}
                  {runtime.activeScene.grid.width} ×{' '}
                  {runtime.activeScene.grid.height}
                </p>
              </>
            )}
            <p
              style={{ fontSize: '12px', color: '#808080', marginTop: '10px' }}
            >
              Edit JSON in{' '}
              <code
                style={{
                  background: '#1e1e1e',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  color: '#dcdcaa',
                }}
              >
                dev/scenes/
              </code>{' '}
              for hot reload
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mount to DOM
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Playground />);
}
