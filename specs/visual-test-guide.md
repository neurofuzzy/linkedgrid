# Visual Test Writing Guide

## Purpose

Visual tests demonstrate game behavior in the Visual Runner with animated, step-by-step execution. They also run in Vitest for CI/CD validation.

## Storytelling Principles

Visual tests are like comic strips - they tell a story through sequential frames. Good visual tests:

1. **Are Uniquely Valuable**: Test something that benefits from visualization
   - Show movement patterns, interactions, or behaviors
   - Demonstrate mechanics that are hard to understand from code alone
   - Avoid redundant tests that show the same thing differently

2. **Tell a Story**: Have a clear beginning, middle, and end
   - **Beginning**: Setup the scene (arrange phase)
   - **Middle**: Show action and progression (act phase with 5-7+ commits)
   - **End**: Dramatic payoff or clear resolution (final commit)

3. **Test One Thing Well**: Focus on a single mechanic or behavior
   - May include contextual elements (walls, obstacles, other entities)
   - But the main focus should be clear and singular
   - Example: "projectile hits enemy" tests projectile movement + collision, not inventory systems

4. **Allow Enough Perception**: Minimum 5-7 commits for meaningful tests
   - Users need time to see what's happening
   - Each commit should show visible change
   - Avoid tests that flash by in 2-3 frames
   - Scene tests need 5-7+ commits PER SCENE before transitions

## Core Structure

```typescript
import { visual } from './visual-helpers';
import { GameLayers } from '../types';

visual('test name here', {
    arrange: ({ spatial }) => {
        // Setup initial state
        // This runs BEFORE play button
        // User sees this state immediately
    },
    act: ({ spatial }) => {
        // Perform actions
        // This runs WHEN play button is pressed
        // Each operation creates a snapshot
    },
    assert: ({ spatial, expect }) => {
        // Validate results
        // This runs AFTER act completes
        // Determines pass/fail
    }
});
```

## The Three Phases

### 1. `arrange` (Optional)

**Purpose**: Set up the initial game state that's visible before "Play" is pressed.

**Guidelines**:
- Always call `spatial.commit()` after spawning entities
- Keep it simple - just place entities on the grid
- Don't perform game actions here

**Example**:
```typescript
arrange: ({ spatial }) => {
    spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    spatial.spawn('enemy', 10, 10, GameLayers.ACTORS);
    spatial.commit();
}
```

### 2. `act` (Required)

**Purpose**: Perform the game actions you want to visualize.

**Guidelines**:
- **Minimum 5-7 commits** for a satisfying visual story
- Call `spatial.commit()` after each logical step you want to see
- Each commit creates a new snapshot/frame
- Use entity-based API (`moveEntity`, `removeEntity`) when you have entity IDs
- Get entity IDs from known positions: `spatial.getEntityIdAt(x, y, layer)`
- Show the behavior step-by-step with clear progression
- For scene tests: 5-7+ commits in each scene before transitioning

**Example**:
```typescript
act: ({ spatial }) => {
    // Get the player entity ID from its known position
    let playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
    
    // Move right (each commit = new frame)
    spatial.moveEntity(playerId, 6, 5);
    spatial.commit();
    
    // Update playerId for next move
    playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)!;
    spatial.moveEntity(playerId, 7, 5);
    spatial.commit();
}
```

### 3. `assert` (Optional but Recommended)

**Purpose**: Verify the test produced the expected result.

**Guidelines**:
- Use the `expect` helper provided in context
- `expect` takes a description and a function that throws on failure
- Check final positions, entity existence, cleanup
- Be specific about what you're checking

**Example**:
```typescript
assert: ({ spatial, expect }) => {
    expect('Player at final position (7, 5)', () => {
        const playerId = spatial.getEntityIdAt(7, 5, GameLayers.ACTORS);
        if (playerId === undefined) {
            throw new Error('Player not at expected position');
        }
    });
    
    expect('Starting position cleaned up', () => {
        if (spatial.getEntityIdAt(5, 5, GameLayers.ACTORS) !== undefined) {
            throw new Error('Old position not cleaned up');
        }
    });
}
```

## Common Patterns

### Pattern 1: Moving an Entity Multiple Times

```typescript
act: ({ spatial }) => {
    // Helper to get entity at position
    const getPlayerId = (x: number, y: number) => 
        spatial.getEntityIdAt(x, y, GameLayers.ACTORS)!;
    
    // Move right
    spatial.moveEntity(getPlayerId(5, 5), 6, 5);
    spatial.commit();
    
    // Move right again
    spatial.moveEntity(getPlayerId(6, 5), 7, 5);
    spatial.commit();
}
```

### Pattern 2: Spawning During Act

```typescript
act: ({ spatial }) => {
    // Spawn and get the ID immediately
    const projectileId = spatial.spawn('projectile', 3, 5, GameLayers.EPHEMERALS);
    spatial.commit();
    
    // Now move it
    spatial.moveEntity(projectileId, 4, 5);
    spatial.commit();
}
```

### Pattern 3: Removing Entities

```typescript
act: ({ spatial }) => {
    const enemyId = spatial.getEntityIdAt(10, 10, GameLayers.ACTORS)!;
    spatial.removeEntity(enemyId);
    spatial.commit();
}
```

### Pattern 4: Convoy Movement (Coordinate-Based)

When you need multiple entities to move simultaneously (like a convoy), use coordinate-based API:

```typescript
act: ({ spatial }) => {
    // All units move at once - use coordinate-based for simultaneous moves
    spatial.move(5, 5, 6, 5, GameLayers.ACTORS);
    spatial.move(6, 5, 7, 5, GameLayers.ACTORS);
    spatial.move(7, 5, 8, 5, GameLayers.ACTORS);
    spatial.commit(); // All moves execute atomically
}
```

### Pattern 5: Testing Blocking

```typescript
import { isBlocked } from '../layer-helpers';

act: ({ spatial }) => {
    const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
    // Try to move into wall (should fail)
    spatial.moveEntity(playerId, 6, 5, isBlocked);
    spatial.commit();
}
```

### Pattern 6: Pausing Between Actions

To add dramatic timing or let users observe a state, use `spatial.pause()`:

```typescript
act: ({ spatial }) => {
    // Player approaches enemy
    let playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
    spatial.moveEntity(playerId, 6, 5);
    spatial.commit();
    
    spatial.moveEntity(playerId, 7, 5);
    spatial.commit();
    
    // Pause to let user see the standoff
    spatial.pause(); // Creates explicit pause frame
    spatial.pause(); // Second pause for longer duration
    
    // Then remove enemy
    const enemyId = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS)!;
    spatial.removeEntity(enemyId);
    spatial.commit();
}
```

**Note**: Use `pause()` sparingly for dramatic effect. Empty commits (`spatial.commit()` with no operations) also work for pauses.

### Pattern 7: Scene Transitions

**CRITICAL**: Always use `ctx.spatial` for scene tests - never create local `spatial` variables!

```typescript
act: (ctx) => {
    const game = ctx.game!;
    
    // Move in first scene (5-7+ commits)
    ctx.spatial.moveEntity(playerId, 5, 6);
    ctx.spatial.commit();
    
    ctx.spatial.moveEntity(playerId, 5, 7);
    ctx.spatial.commit();
    
    // Transition to new scene
    game.movePlayerToScene('room2', 3, 3, GameLayers.ACTORS);
    
    // ctx.spatial automatically references new scene now!
    ctx.spatial.move(...); // This operates on room2's spatial system
    ctx.spatial.commit();
}
```

**Why**: `ctx.spatial` is a proxy that automatically updates to the active scene's spatial system after transitions. Creating local variables breaks this connection and causes the visual runner to capture incorrect snapshots.

## Advanced Patterns and Learnings

### Smooth Movement: Never Skip Cells

Each movement should be one cell at a time for clarity:

```typescript
// ❌ Bad - skips cell (5,5) → (7,5)
spatial.moveEntity(playerId, 7, 5);
spatial.commit();

// ✅ Good - shows progression
spatial.moveEntity(playerId, 6, 5);
spatial.commit();

spatial.moveEntity(playerId, 7, 5);
spatial.commit();
```

Users can't follow sudden jumps. Show every step.

### Add Contextual Elements

Tests are more engaging with scenery:

```typescript
arrange: ({ spatial }) => {
    // Add context to make movement clear
    spatial.spawn('wall', 3, 5, GameLayers.WALLS);
    spatial.spawn('wall', 9, 5, GameLayers.WALLS);
    spatial.spawn('item', 7, 5, GameLayers.COLLECTIBLES);
    
    // Now add the actor
    spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    spatial.commit();
}
```

Walls, items, and other entities make the story clearer and more visually interesting.

### Collision Tests: Re-fetch Entity IDs

In collision scenarios, always re-fetch entity IDs after commits:

```typescript
act: ({ spatial }) => {
    // Get initial IDs
    let player1 = spatial.getEntityIdAt(3, 5, GameLayers.ACTORS)!;
    let player2 = spatial.getEntityIdAt(7, 5, GameLayers.ACTORS)!;
    
    // Move toward each other
    spatial.moveEntity(player1, 4, 5);
    spatial.commit();
    
    // Re-fetch after commit (positions may have changed)
    player1 = spatial.getEntityIdAt(4, 5, GameLayers.ACTORS)!;
    player2 = spatial.getEntityIdAt(7, 5, GameLayers.ACTORS)!;
    
    // Continue collision sequence
    spatial.moveEntity(player2, 6, 5);
    spatial.commit();
}
```

This ensures your references are always current, especially when testing blocking/collision.

### When to Remove a Test

Not every test belongs in the visual test suite. Remove tests that:

1. **Show no movement or change**
   - Example: "multiple entities in same cell" - just shows static entities
   - Better as a unit test

2. **Are impossible to see visually**
   - Example: "empty floor blocking" - no visual representation of empty floors
   - Better as a unit test

3. **Are redundant**
   - If you've already shown "multiple layers at same cell" in another test context
   - Don't repeat it unnecessarily

4. **Don't benefit from visualization**
   - Example: "scene with metadata tracking" - tests data, not visuals
   - Definitely a unit test

**Remember**: Visual tests should be *uniquely valuable* as visual demonstrations. When in doubt, ask: "Does seeing this animated help understand the mechanic?"

### Separation for Better Story

Tests are more effective when entities start separated:

```typescript
// ❌ Bad - entities start adjacent
arrange: ({ spatial }) => {
    spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    spatial.spawn('enemy', 6, 5, GameLayers.ACTORS); // Right next to player
    spatial.commit();
}

// ✅ Good - start at least 2-3 cells apart
arrange: ({ spatial }) => {
    spatial.spawn('player', 3, 5, GameLayers.ACTORS);
    spatial.spawn('enemy', 8, 5, GameLayers.ACTORS); // Clear separation
    spatial.commit();
}
```

This allows you to show approach, build tension, and demonstrate the mechanic more clearly.

## API Reference

### Context Object

```typescript
{
    spatial: SpatialSystem,     // The spatial system
    grid: LinkedGrid,           // The underlying grid
    store: SparseEntityStore,   // Entity data store
    expect: (desc, fn) => void, // Assertion helper
    game?: GameManager,         // (Optional) For scene tests
    scene?: Scene              // (Optional) For scene tests
}
```

### Preferred Spatial Methods

**Entity-based (Preferred for game logic)**:
- `spatial.moveEntity(entityId, toX, toY, blockFn?)` - Move entity by ID
- `spatial.removeEntity(entityId)` - Remove entity by ID
- `spatial.spawn(type, x, y, layer, props?)` - Returns entity ID

**Coordinate-based (For convoy movement, blocking tests)**:
- `spatial.move(fromX, fromY, toX, toY, layer, blockFn?)` - Move at position
- `spatial.remove(x, y, layer)` - Remove at position

**Queries**:
- `spatial.getEntityIdAt(x, y, layer)` - Get entity ID at position
- `spatial.getEntityData(id)` - Get entity data
- `spatial.getEntityPosition(id)` - Get entity position

**Always Required**:
- `spatial.commit()` - Apply all pending operations

**Visual Test Helpers**:
- `spatial.pause()` - Create explicit pause frame for dramatic timing

## Common Mistakes

### ❌ Forgetting to commit
```typescript
act: ({ spatial }) => {
    spatial.moveEntity(playerId, 6, 5);
    // Missing spatial.commit() - won't create snapshot!
}
```

### ❌ Not updating entity ID after move
```typescript
act: ({ spatial }) => {
    let playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
    spatial.moveEntity(playerId, 6, 5);
    spatial.commit();
    
    // playerId is still referencing old position!
    spatial.moveEntity(playerId, 7, 5); // Wrong!
}
```

**✅ Correct version**:
```typescript
act: ({ spatial }) => {
    let playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
    spatial.moveEntity(playerId, 6, 5);
    spatial.commit();
    
    playerId = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS)!; // Update!
    spatial.moveEntity(playerId, 7, 5);
    spatial.commit();
}
```

### ❌ Performing actions in arrange
```typescript
arrange: ({ spatial }) => {
    spatial.spawn('player', 5, 5, GameLayers.ACTORS);
    spatial.commit();
    
    // Don't do this in arrange!
    const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
    spatial.moveEntity(playerId, 6, 5);
    spatial.commit();
}
```

### ❌ Weak assertions
```typescript
assert: ({ spatial, expect }) => {
    expect('Test passed', () => {
        // Too vague - what are we checking?
    });
}
```

**✅ Better**:
```typescript
assert: ({ spatial, expect }) => {
    expect('Player at final position (8, 5)', () => {
        const playerId = spatial.getEntityIdAt(8, 5, GameLayers.ACTORS);
        if (playerId === undefined) {
            throw new Error('Expected player at (8, 5)');
        }
    });
    
    expect('Old position (5, 5) cleaned up', () => {
        if (spatial.getEntityIdAt(5, 5, GameLayers.ACTORS) !== undefined) {
            throw new Error('Position should be empty');
        }
    });
}
```

### ❌ Creating local spatial variable in scene tests
```typescript
act: (ctx) => {
    const game = ctx.game!;
    let spatial = game.sceneManager.getActiveScene()!.spatial; // DON'T DO THIS!
    
    spatial.moveEntity(playerId, 5, 7);
    spatial.commit();
    
    game.movePlayerToScene('room2', 3, 3, GameLayers.ACTORS);
    
    // spatial still points to old scene - breaks visual runner!
    spatial.moveEntity(playerId, 4, 3); // WRONG SCENE!
}
```

**✅ Correct version**:
```typescript
act: (ctx) => {
    const game = ctx.game!;
    
    // Always use ctx.spatial - it auto-updates on scene transitions
    ctx.spatial.moveEntity(playerId, 5, 7);
    ctx.spatial.commit();
    
    game.movePlayerToScene('room2', 3, 3, GameLayers.ACTORS);
    
    // ctx.spatial now points to room2's spatial system automatically
    ctx.spatial.moveEntity(playerId, 4, 3); // Correct!
}
```

## Test Naming

Good names are descriptive and action-focused:

✅ Good:
- `player moves right 3 times`
- `projectile hits enemy`
- `entity moves in a square`
- `convoy movement: adjacent entities move together`

❌ Bad:
- `test 1`
- `movement`
- `entities`

## Categories

Tests are automatically categorized by filename:
- `movement.visual.test.ts` → "Movement" category
- `layers.visual.test.ts` → "Layers" category
- `assertions.visual.test.ts` → "Assertions" category
- `scene-transition.visual.test.ts` → "Scenes" category

## Testing in Both Runners

Visual tests run in two environments:

1. **Visual Runner** (animated, for debugging):
   ```bash
   npm run visual-runner
   ```

2. **Vitest** (fast, for CI):
   ```bash
   npm test
   ```

Same code, both contexts!

## Quick Template

```typescript
import { visual } from './visual-helpers';
import { GameLayers } from '../types';

visual('descriptive test name', {
    arrange: ({ spatial }) => {
        // Setup initial state
        spatial.spawn('player', 5, 5, GameLayers.ACTORS);
        spatial.commit();
    },
    act: ({ spatial }) => {
        // Perform actions
        let playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
        spatial.moveEntity(playerId, 6, 5);
        spatial.commit();
    },
    assert: ({ spatial, expect }) => {
        // Validate results
        expect('Player at (6, 5)', () => {
            const id = spatial.getEntityIdAt(6, 5, GameLayers.ACTORS);
            if (id === undefined) {
                throw new Error('Not found');
            }
        });
    }
});
```

## Key Takeaways

1. **Tell a Story**: Beginning (arrange) → Middle (5-7+ commits) → End (payoff)
2. **Be Unique**: Each test should demonstrate something valuable - remove tests that don't
3. **One Focus**: Test one mechanic well, not many things poorly
4. **Enough Time**: Users need 5-7+ commits minimum to perceive what's happening
5. **Entity IDs**: Get from position, update after moves, re-fetch after collisions
6. **Commit Often**: Each commit = new frame in the story
7. **Scene Tests**: Always use `ctx.spatial` (never local variables) + 5-7+ commits PER SCENE
8. **Smooth Movement**: Never skip cells - show every step for clarity
9. **Add Context**: Walls, items, and obstacles make tests more engaging
10. **Start Separated**: Entities should be 2-3+ cells apart to show approach and build tension

## Examples: Good vs Bad Tests

### Good Example: "projectile hits enemy"
```typescript
// ✅ 7 commits, clear story: spawn → travel → hit → cleanup
act: ({ spatial }) => {
    const projectileId = spatial.spawn('projectile', 3, 5, GameLayers.EPHEMERALS);
    spatial.commit(); // Frame 1: Projectile appears
    
    spatial.moveEntity(projectileId, 4, 5);
    spatial.commit(); // Frame 2: Moving...
    // ... continues with 5 more commits showing travel and impact
}
```

**Why it works**: Shows clear progression, dramatic payoff, enough frames to understand

### Bad Example: "entity movement" (before fix)
```typescript
// ❌ Only 1 commit, no story, too fast
act: ({ spatial }) => {
    const playerId = spatial.getEntityIdAt(5, 5, GameLayers.ACTORS)!;
    spatial.moveEntity(playerId, 6, 5);
    spatial.commit(); // Only 1 frame - user barely sees it
}
```

**Why it fails**: Not enough progression, no story arc, ends too quickly

### Good Example: "entity moves in a square"
```typescript
// ✅ 8 commits, complete loop, clear story
act: ({ spatial }) => {
    // Right (2 frames) → Down (2 frames) → Left (2 frames) → Up (2 frames)
    // Each direction shows visible progression
    // Completes the loop back to start
}
```

**Why it works**: Clear goal (return to start), enough commits to see the pattern, satisfying completion

### Good Example: "player walks across the map" (improved)
```typescript
// ✅ 7 commits, shows journey with context
arrange: ({ spatial }) => {
    // Add scenery for context
    spatial.spawn('wall', 3, 5, GameLayers.WALLS);
    spatial.spawn('wall', 9, 5, GameLayers.WALLS);
    spatial.spawn('item', 6, 5, GameLayers.COLLECTIBLES);
    spatial.spawn('player', 4, 5, GameLayers.ACTORS);
    spatial.commit();
},
act: ({ spatial }) => {
    // Move step by step (never skip cells!)
    let playerId = spatial.getEntityIdAt(4, 5, GameLayers.ACTORS)!;
    
    // Approach item
    spatial.moveEntity(playerId, 5, 5);
    spatial.commit(); // Frame 1
    
    // Walk onto item
    spatial.moveEntity(playerId, 6, 5);
    spatial.commit(); // Frame 2
    
    // Continue past item (smooth progression)
    spatial.moveEntity(playerId, 7, 5);
    spatial.commit(); // Frame 3
    
    spatial.moveEntity(playerId, 8, 5);
    spatial.commit(); // Frame 4
    
    // Reach far wall
    spatial.pause(); // Dramatic pause at destination
}
```

**Why it works**: Contextual elements (walls, item), smooth cell-by-cell movement, clear beginning and end, enough frames to follow the journey

## Before You Write a Test

Ask yourself these questions:

1. **Does this benefit from visualization?**
   - If it's just checking a value or state, use a unit test
   - Visual tests should show *behavior* not just *results*

2. **Can I show clear progression?**
   - Need at least 5-7 commits to tell a story
   - If it's only 1-2 frames, it's probably too simple

3. **Is this redundant?**
   - Check existing tests - are we already showing this?
   - Similar tests should be consolidated or removed

4. **Does it have a beginning, middle, and end?**
   - Setup (arrange) → Action (act with progression) → Payoff (final state)
   - Without this arc, it's not a good visual test

5. **Would someone new understand what's being tested?**
   - Test name should be clear and action-focused
   - The visual progression should be self-explanatory
   - Context elements (walls, items) should clarify the story

If you answered "no" to any of these, reconsider whether this should be a visual test or a unit test instead.

## Need Help?

- Check existing tests in `packages/spartan/test/*.visual.test.ts`
- Run the visual runner to see how tests animate
- Read `@ai-temp/DEVELOPER_CONTEXT.md` for architecture details
