# Ink Terminal Visual Test Runner - Implementation Summary

## What Was Built

A professional terminal-based visual test runner using Ink (React for CLI) that provides interactive debugging of spatial game tests with step-through playback, grid visualization, and keyboard controls.

## Project Structure

```
packages/visual-runner/
├── package.json              # Ink, React, chalk, glob dependencies
├── tsconfig.json             # TypeScript config with JSX support
├── cli.tsx                   # CLI entry point with TTY check
├── components/
│   ├── App.tsx               # Main application component
│   ├── TestSidebar.tsx       # Test selection sidebar
│   ├── GridRenderer.tsx      # ASCII grid visualization with colors
│   ├── PlaybackControls.tsx  # Playback status display
│   └── InfoBar.tsx           # Current operation display
├── lib/
│   ├── test-discovery.ts     # Scans for *.visual.test.ts files
│   ├── test-executor.ts      # Executes tests and captures snapshots
│   └── types.ts              # Shared TypeScript types
└── hooks/
    └── usePlayback.ts        # Keyboard controls and auto-play logic
```

## Features Implemented

1. **Test Discovery**
   - Automatically scans `packages/**/test/*.visual.test.ts` files
   - Parses test names from `visual()` calls using regex
   - Displays tests in an interactive sidebar

2. **Test Execution**
   - TestExecutor class wraps SpatialSystem with a Proxy
   - Captures snapshots after spawn, move, and remove operations
   - Stores grid state, entity positions, and operation details

3. **Grid Visualization**
   - ASCII grid with colored entity initials:
     - Player: Blue (P)
     - Enemy: Red (E)
     - Item: Yellow (I)
     - Projectile: Magenta (P)
     - Wall: Gray (W)
   - Empty cells shown as dim dots (·)

4. **Keyboard Controls**
   - **Space**: Play/Pause auto-playback
   - **→**: Step forward one snapshot
   - **←**: Step backward one snapshot
   - **R**: Reset to beginning
   - **S**: Toggle sidebar visibility
   - **Q**: Quit application

5. **Playback System**
   - Auto-play mode with configurable interval (500ms default)
   - Step-through debugging
   - Snapshot timeline with current position indicator
   - Operation details shown in info bar

## Updated Files

### Modified
- `/Users/geoff/dev/linkedgrid/package.json` - Added `visual` script
- `/Users/geoff/dev/linkedgrid/packages/spartan/test/visual-helpers.ts` - Added globalThis support for Node.js

### Created
All files in `/Users/geoff/dev/linkedgrid/packages/visual-runner/`

## How to Use

### Run the Visual Test Runner

```bash
# From project root
npm run visual
```

**Note**: The runner requires an interactive terminal (TTY). It cannot be run through npm scripts in non-interactive environments. If you see a "Raw mode is not supported" error, the terminal doesn't support interactive input.

### Alternative: Run directly with tsx

```bash
# From project root
cd packages/visual-runner
npm run dev
```

### Building for Distribution

```bash
cd packages/visual-runner
npm run build
npm link
# Then run from anywhere:
visual-runner
```

## Existing Visual Tests

The following tests are available in `packages/spartan/test/movement.visual.test.ts`:

1. **player moves right 3 times** - Simple linear movement
2. **spawn multiple entities** - Multiple entities at different positions
3. **entity moves in a square** - Complex path (right, down, left, up)
4. **projectile hits enemy** - Projectile movement and collision
5. **multiple layers at same cell** - Layer-based entity stacking

## Technical Implementation Details

### Test Registration

The `visual()` helper function in `visual-helpers.ts` now registers tests in both:
- `window.visualTests` (for browser compatibility)
- `globalThis.visualTests` (for Node.js/terminal runner)

This allows the same tests to run in:
1. Vitest (headless CI testing)
2. Browser-based visual runner (if needed later)
3. Terminal visual runner (Ink-based)

### Snapshot Capture

The TestExecutor uses a Proxy to intercept spatial operations:
- Wraps the SpatialSystem instance
- Intercepts spawn, move, and remove calls
- Captures full grid state after each operation
- Stores entity positions, types, and metadata

### Rendering

Grid rendering is done with ASCII characters:
- Uses Chalk for terminal colors
- 2-character width per cell (char + space)
- Dynamic sizing based on grid dimensions
- Entity colors defined in ENTITY_COLORS map

## Known Limitations

1. **Terminal Requirements**: Requires a TTY-compatible terminal with raw mode support
2. **Performance**: Large grids (>30x30) may cause rendering lag
3. **Test Discovery**: Relies on regex parsing of source files (doesn't execute to discover)
4. **Dynamic Imports**: Test file paths are constructed dynamically, may not work with bundlers

## Future Enhancements

Potential improvements not included in the current implementation:

1. Configurable playback speed (via number keys 1-9)
2. Snapshot diffing visualization
3. Export test recordings as text files
4. Filter tests by name pattern
5. Performance profiling overlay
6. Support for custom entity renderers
7. Grid zoom/pan for large grids
8. Test history and replay
