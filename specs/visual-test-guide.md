# Visual Test Guide

Visual tests demonstrate game behavior with step-by-step animation in the Visual Runner. They also run in Vitest for CI/CD.

## Requirements

1. **Unique Value**: Test something that benefits from visualization (movement, interactions, behaviors)
2. **5-7+ Commits**: Minimum frames for meaningful progression. Scene tests need 5-7+ commits PER SCENE
3. **Single Focus**: Test one mechanic clearly (may include contextual elements like walls/items)
4. **Story Arc**: Beginning (arrange) → Middle (act) → End (payoff)
5. **Never Skip Cells**: Show every movement step, one cell at a time
6. **Start Separated**: Entities should be 2-3+ cells apart to show approach
7. **Scene Tests**: ALWAYS use `ctx.spatial`, never local variables

Remove tests that show no movement/change, are visually impossible to see, or don't benefit from visualization.

## Structure

```typescript
import { visual } from './visual-helpers';
import { GameLayers } from '../types';

visual('descriptive action-focused name', {
    arrange: ({ spatial }) => {
        // Setup initial state (optional)
        // Add context: walls, items, obstacles
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.commit(); // Always commit after spawns
    },
    act: ({ spatial }) => {
        // Perform actions (required)
        // Each commit = new frame
        let id = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(id, 6, 5);
        spatial.commit();
        // ... 5-7+ commits minimum
    },
    assert: ({ spatial, expect }) => {
        // Validate results (recommended)
        expect('Player at (6, 5)', () => {
            if (!spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)) {
                throw new Error('Not found');
            }
        });
    }
});
```

## API

### Context
- `spatial: SpatialSystem` - Main API
- `grid: LinkedGrid` - Underlying grid
- `store: SparseEntityStore` - Entity data
- `expect: (desc, fn) => void` - Assertions
- `game?: GameManager` - For scene tests
- `scene?: Scene` - For scene tests

### Spatial Methods

**Entity-based (preferred)**:
- `spatial.moveEntity(entityId, toX, toY, blockFn?)` - Move by ID
- `spatial.removeEntity(entityId)` - Remove by ID
- `spatial.spawn(type, x, y, layer, props?)` - Returns entity ID

**Coordinate-based (convoy/blocking)**:
- `spatial.move(fromX, fromY, toX, toY, layer, blockFn?)` - Move at position
- `spatial.remove(x, y, layer)` - Remove at position

**Queries**:
- `spatial.getEntityIdAt(x, y, layer)` - Get ID at position
- `spatial.getEntityData(id)` - Get entity data
- `spatial.getEntityPosition(id)` - Get position

**Required**:
- `spatial.commit()` - Apply all pending operations

**Visual helpers**:
- `spatial.pause()` - Create pause frame (use sparingly)

## Patterns

### Moving entity multiple times
```typescript
act: ({ spatial }) => {
    let id = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
    spatial.moveEntity(id, 6, 5);
    spatial.commit();
    
    id = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)!; // Re-fetch after commit
    spatial.moveEntity(id, 7, 5);
    spatial.commit();
}
```

### Spawning during act
```typescript
const id = spatial.spawn('projectile', 3, 5, GameLayers.EPHEMERALS);
spatial.commit();
spatial.moveEntity(id, 4, 5);
spatial.commit();
```

### Convoy movement (simultaneous)
```typescript
spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
spatial.move(6, 5, 7, 5, GameLayers.ACTORS);
spatial.commit(); // All move atomically
```

### Blocking
```typescript
import { isBlocked } from '../layers/layer-helpers';
spatial.moveEntity(id, 6, 5, isBlocked); // Try to move into wall
spatial.commit();
```

### Pause for dramatic effect
```typescript
spatial.moveEntity(id, 7, 5);
spatial.commit();
spatial.pause(); // Hold frame
spatial.pause(); // Longer pause
spatial.removeEntity(enemyId);
spatial.commit();
```

### Scene transitions (CRITICAL)
```typescript
act: (ctx) => {
    const game = ctx.game!;
    
    // Use ctx.spatial - auto-updates on scene changes
    ctx.spatial.moveEntity(id, 5, 7);
    ctx.spatial.commit();
    
    game.movePlayerToScene('room2', 3, 3, GameLayers.ACTORS);
    
    // ctx.spatial now references room2's spatial automatically
    ctx.spatial.moveEntity(id, 4, 3);
    ctx.spatial.commit();
}
```

**Why**: `ctx.spatial` is a proxy that auto-updates to active scene. Local variables break snapshot capture.

### Collision tests
```typescript
// Re-fetch IDs after each commit in collision scenarios
let p1 = spatial.getEntityIdAt(3, 5, GameLayers.ACTORS)!;
spatial.moveEntity(p1, 4, 5);
spatial.commit();

p1 = spatial.getEntityIdAt(4, 5, GameLayers.ACTORS)!; // Re-fetch
spatial.moveEntity(p1, 5, 5);
spatial.commit();
```

## Critical Mistakes

### ❌ Forgetting commit
```typescript
spatial.moveEntity(id, 6, 5); // No commit = no frame
```

### ❌ Not updating entity ID
```typescript
let id = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
spatial.moveEntity(id, 6, 5);
spatial.commit();
spatial.moveEntity(id, 7, 5); // id still references old position!
```

### ❌ Local spatial in scene tests
```typescript
let spatial = game.sceneManager.getActiveScene()!.spatial; // BREAKS VISUAL RUNNER
game.movePlayerToScene('room2', 3, 3, GameLayers.ACTORS);
spatial.moveEntity(id, 4, 3); // Still references old scene!
```

### ❌ Skipping cells
```typescript
spatial.moveEntity(id, 7, 5); // Jumped from (5,5) to (7,5) - too fast
```

### ❌ Actions in arrange
```typescript
arrange: ({ spatial }) => {
    spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    spatial.commit();
    spatial.moveEntity(id, 6, 5); // Don't move in arrange!
}
```

### ❌ Vague assertions
```typescript
expect('Test passed', () => {}); // What are we checking?
```

## Examples

### Good: "projectile hits enemy"
```typescript
act: ({ spatial }) => {
    const id = spatial.spawn('projectile', 3, 5, GameLayers.EPHEMERALS);
    spatial.commit(); // Spawn
    spatial.moveEntity(id, 4, 5);
    spatial.commit(); // Move
    spatial.moveEntity(id, 5, 5);
    spatial.commit(); // Move
    // ... continues for 7 total commits
}
```
Clear progression, dramatic payoff, enough frames.

### Bad: Too fast
```typescript
act: ({ spatial }) => {
    spatial.moveEntity(id, 6, 5);
    spatial.commit(); // Only 1 frame - too fast
}
```
No story, no progression.

## Testing

Visual Runner (animated):
```bash
npm run visual-runner
```

Vitest (CI):
```bash
npm test
```

Same test files run in both environments.

## Categories

Auto-categorized by filename:
- `movement.visual.test.ts` → "Movement"
- `layers.visual.test.ts` → "Layers"
- `assertions.visual.test.ts` → "Assertions"
- `scene-transition.visual.test.ts` → "Scenes"

## Reference

Check `packages/spartan/test/*.visual.test.ts` for examples.
