import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { SceneLoader, type SceneConfig } from './scene-loader';
import { InputManager } from '../packages/spartan/input';
import { PlayerInputSystem } from '../packages/spartan/systems/player-input-system';
import { GridRenderer, HUD, DebugPanel } from './grid-renderer';
import type { GameRuntime } from '../packages/spartan/game-runtime';

/**
 * Available game configurations.
 * Each game can contain multiple scenes.
 */
const AVAILABLE_GAMES = [
  { id: 'basic', name: 'Basic Game', path: '/dev/games/basic.json' },
  {
    id: 'teleporter',
    name: 'Teleporter Test',
    path: '/dev/games/teleporter.json',
  },
  {
    id: 'doors-keys',
    name: 'Doors & Keys Puzzle',
    path: '/dev/games/doors-keys.json',
  },
  {
    id: 'floor-hazards',
    name: 'Floor Hazards Demo',
    path: '/dev/games/floor-hazards.json',
  },
  {
    id: 'flammability',
    name: 'Flammability',
    path: '/dev/games/flammability.json',
  },
  {
    id: 'explosions',
    name: 'Explosions Playground',
    path: '/dev/games/explosions.json',
  },
  {
    id: 'propagation',
    name: 'Propagation & Chain Reaction',
    path: '/dev/games/propagation.json',
  },
  {
    id: 'liquids',
    name: 'Liquid Simulation',
    path: '/dev/games/liquids.json',
  },
  {
    id: 'gasoline',
    name: 'Gasoline & Fire',
    path: '/dev/games/gasoline.json',
  },
];

/**
 * Get the game ID from a file path (e.g., '/dev/games/doors-keys.json' -> 'doors-keys')
 */
function getGameIdFromPath(path: string): string {
  const filename = path.split('/').pop() || '';
  return filename.replace('.json', '');
}

/**
 * Get initial game from URL search params or default to first game
 */
function getInitialGame(): string {
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('game');

  if (gameId) {
    const game = AVAILABLE_GAMES.find((g) => g.id === gameId);
    if (game) {
      return game.path;
    }
  }

  return AVAILABLE_GAMES[0].path;
}

/**
 * Playground - Interactive Spartan game runtime.
 *
 * Features:
 * - Load scenes from JSON
 * - Keyboard input (WASD/arrows)
 * - Hot reload when scene files change
 * - Debug panel with runtime stats
 * - URL persistence for selected game
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
  const [selectedGame, setSelectedGame] = useState(getInitialGame());
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
          // Clean up input manager if it exists
          const cleanup = (runtimeRef.current as any).inputCleanup;
          if (cleanup) {
            cleanup();
          }
          runtimeRef.current = null;
        }

        if (inputManagerRef.current) {
          inputManagerRef.current = null;
        }

        // Fetch game config
        const response = await fetch(selectedGame);
        if (!response.ok) {
          throw new Error(`Failed to load game: ${response.statusText}`);
        }

        const config: SceneConfig = await response.json();

        // Validate config
        const errors = SceneLoader.validate(config);
        if (errors.length > 0) {
          throw new Error(`Game validation failed:\n${errors.join('\n')}`);
        }

        // Load game with input system automatically configured
        // Pass document.body to enable DOM event listeners
        const loader = new SceneLoader(document.body);
        loadedRuntime = loader.load(config);

        // Get input manager from runtime (created by loader)
        loadedInputManager = (loadedRuntime as any).inputManager;

        // Get player input system from runtime
        const loadedPlayerInputSystem = (loadedRuntime as any).systems.find(
          (s: any) => s instanceof PlayerInputSystem
        );

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

  // Update URL when game selection changes
  useEffect(() => {
    const gameId = getGameIdFromPath(selectedGame);
    const params = new URLSearchParams(window.location.search);
    params.set('game', gameId);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [selectedGame]);

  const handleGameChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGame(e.target.value);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <h1 style={{ fontFamily: 'Sixtyfour, sans-serif' }}>
          Spartan Playground
        </h1>
        <p style={{ color: '#33cccc' }}>Loading game...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <h1 style={{ fontFamily: 'Sixtyfour, sans-serif' }}>
          Spartan Playground
        </h1>
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            background: '#2a1a1a',
            border: '1px solid #333344',
            borderRadius: '0',
            color: '#cc3366',
          }}
        >
          <h3
            style={{
              marginBottom: '10px',
              fontFamily: 'Sixtyfour, sans-serif',
              fontSize: '14px',
            }}
          >
            Error Loading Game
          </h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
            {error}
          </pre>
        </div>
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={() => setGameKey((prev) => prev + 1)}
            style={{
              padding: '8px 16px',
              background: '#33cccc',
              border: 'none',
              borderRadius: '0',
              color: '#0a0a12',
              cursor: 'pointer',
              fontFamily: 'Sixtyfour, sans-serif',
              fontSize: '12px',
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
          <label
            style={{ color: '#33b5cc', fontSize: '14px', fontWeight: 'bold' }}
          >
            Game:
          </label>
          <span
            style={{ color: '#8888aa', fontSize: '12px', marginRight: '10px' }}
          >
            (TAB to cycle)
          </span>
          <select
            value={selectedGame}
            onChange={handleGameChange}
            style={{
              padding: '6px 12px',
              background: '#0f0f1a',
              border: '1px solid #222',
              borderRadius: '0',
              color: '#d0d0d0',
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
          <HUD runtime={runtime} />
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
                dev/games/
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
