# Projectile Positioning Bug - Analysis & ADR

## Problem Statement

Projectiles were spawning far from the entities that launched them instead of appearing at 1 radius (0.5 model units) away from the launcher's center.

## Root Cause Analysis

### The Bug

The debug renderer was treating **all coordinates** as grid cell indices, adding a half-cell offset (`+ cellSize/2`) to convert from "top-left corner" to "center" in pixel space.

This is correct for grid entities but **incorrect for free-body entities** (projectiles, flying entities), which already use float positions representing their actual center in model space.

### Coordinate System Confusion

The codebase had an implicit coordinate system ambiguity:

**Grid Entities:**
- Stored position: `{x: 5, y: 5}` (cell index)
- Model space center: `(5.0, 5.0)` 
- Pixel space center: `5 * 32 + 16 = 176` (cell index × cellSize + half cellSize)

**Free-Body Entities:**
- Stored position: `{x: 5.5, y: 5.0}` (float position, already the center)
- Model space center: `(5.5, 5.0)`
- Pixel space center: Should be `5.5 * 32 = 176` (float position × cellSize)
- **Actual (buggy)**: `5.5 * 32 + 16 = 192` ❌

### Example Trace

1. Entity at grid cell `(5, 5)` fires projectile to the right
2. `getEntityPosition()` returns `{x: 5, y: 5}`
3. `spawnProjectile()` calculates spawn position:
   - Direction: `dx=1, dy=0`
   - Spawn offset: `SPAWN_RADIUS = 0.5`
   - Result: `spawnFloatX = 5.0 + 1.0 * 0.5 = 5.5` ✓ (correct in model space)
4. FreeBodyStore registers projectile at `(5.5, 5.0)`
5. Renderer draws projectile:
   - **Buggy**: `px = 5.5 * 32 = 176, cx = 176 + 16 = 192` (0.5 cells too far)
   - **Correct**: `px = 5.5 * 32 = 176, cx = 176` (exactly 0.5 cells from launcher)

The projectile appeared 0.5 cells (16 pixels) farther away than intended because the renderer was adding an unnecessary half-cell offset to coordinates that already represented the center position.

## Architecture Decision Record (ADR)

### ADR: Distinct Coordinate Types for Grid vs Free-Body Entities

**Status:** Accepted

**Date:** 2024-02-06

**Context:**

The game engine supports two types of entities:
1. **Grid entities** - Occupy discrete grid cells, position stored as integer cell indices
2. **Free-body entities** - Move freely with sub-cell precision, position stored as float coordinates

The renderer must convert both coordinate types to pixel positions, but was treating them identically, causing rendering errors.

**Decision:**

We will establish clear semantic distinction between coordinate types:

1. **Grid Coordinates (Cell Indices)**
   - Type: Integer or conceptually integer values
   - Meaning: Cell index in the grid (0, 1, 2, ...)
   - Usage: Grid entity positions from `spatial.getEntityPosition()`
   - Renderer conversion: `pixelCenter = cellIndex * cellSize + cellSize/2`

2. **Float Coordinates (Model Space Positions)**
   - Type: Float values with sub-cell precision
   - Meaning: Absolute position in model space where 1.0 = one cell width
   - Usage: Free-body entity positions from `freeBody.getPosition()`
   - Renderer conversion: `pixelCenter = floatPosition * cellSize`

3. **API Clarity Requirements**
   - Method parameters should use descriptive names: `floatX`, `floatY` for float coords
   - Comments must clearly state which coordinate type is expected/returned
   - Renderer methods must explicitly indicate when coordinates are float positions

**Consequences:**

**Positive:**
- Clear separation of concerns between model space and rendering
- Prevents future coordinate system bugs
- Self-documenting code through parameter names
- Renderer faithfully represents model state without "cheating"

**Negative:**
- Requires adding boolean flag to renderer methods (minor complexity)
- Existing code needs documentation updates for clarity

**Implementation:**

```typescript
// Renderer method signature updated
private drawEntity(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  // ... other params
  isFloatPosition = false  // NEW: indicates x,y are model space floats
): void {
  const px = x * cs;
  const py = y * cs;
  // Grid: add half-cell offset to get center
  // Float: already represents center position
  const cx = isFloatPosition ? px : (px + cs / 2);
  const cy = isFloatPosition ? py : (py + cs / 2);
  // ...
}

// Calling sites updated
renderFreeBodyEntities(...) {
  this.drawEntity(
    ctx, interpPos.x, interpPos.y, data, entityId,
    layer, alpha, cs,
    true,  // isRound
    now, false, sizeScale,
    true   // isFloatPosition ← clearly indicates float coords
  );
}
```

**Future Improvements:**

1. **Type System Enforcement**
   ```typescript
   type GridCoordinate = number & { __brand: 'GridCoordinate' };
   type FloatCoordinate = number & { __brand: 'FloatCoordinate' };
   ```

2. **Unified Position Type**
   ```typescript
   interface GridPosition {
     type: 'grid';
     cellX: number;
     cellY: number;
   }
   
   interface FloatPosition {
     type: 'float';
     floatX: number;
     floatY: number;
   }
   
   type Position = GridPosition | FloatPosition;
   ```

3. **Method Naming Convention**
   - `getEntityGridPosition()` - returns grid coordinates
   - `getEntityFloatPosition()` - returns float coordinates
   - `spawnProjectile(launcherFloatX, launcherFloatY, ...)` - explicit parameter names

## Testing Verification

**Before Fix:**
- Entity at grid `(5, 5)` fires right
- Projectile appears at pixel `192` (0.5 cells too far)
- Visual gap between launcher and projectile

**After Fix:**
- Entity at grid `(5, 5)` fires right
- Projectile appears at pixel `176` (exactly 0.5 cells from launcher center)
- Projectile visually emerges from launcher's edge

## Projectile Collision Detection Requirements

### Current Implementation Analysis

The current `ProjectileSystem.moveProjectile()` uses sub-stepping with geometric collision checks:

**For Actors (ACTORS layer):**
- Uses circular distance check: `distance(projectile, entityCenter) < ACTOR_HIT_RADIUS`
- Scans 3×3 neighborhood around projectile's float position
- `ACTOR_HIT_RADIUS = 0.5` (half a cell)

**For Walls (WALLS layer):**
- Uses AABB (Axis-Aligned Bounding Box) check when entering a new cell
- Checks if `Math.round(fx), Math.round(fy)` cell is blocked

### Problem: Imprecise Collision Detection

The current implementation has geometric inaccuracies:

1. **Actor Collision**: Point-to-circle distance check is correct in principle, but:
   - Doesn't account for projectile's trajectory (ray)
   - Can miss fast-moving projectiles that jump over small collision zones
   - Sub-stepping mitigates but doesn't eliminate edge cases

2. **Wall Collision**: Cell-based AABB check is imprecise:
   - Only checks when projectile's rounded position enters a new cell
   - Doesn't use actual wall geometry (assumes walls fill entire cell)
   - Can allow projectiles to "clip" wall corners

### Recommended: True Geometric Collision

For precise collision detection in continuous float space, projectiles should use ray-casting intersection tests:

#### Ray-Circle Intersection (Actors)

```typescript
/**
 * Test if a ray segment intersects a circle.
 * 
 * @param rayStart - Ray start position {x, y}
 * @param rayEnd - Ray end position {x, y}
 * @param circleCenter - Circle center {x, y}
 * @param circleRadius - Circle radius
 * @returns Intersection point and distance, or null if no hit
 */
function rayCircleIntersection(
  rayStart: {x: number, y: number},
  rayEnd: {x: number, y: number},
  circleCenter: {x: number, y: number},
  circleRadius: number
): {point: {x: number, y: number}, distance: number} | null {
  // Vector from ray start to circle center
  const dx = circleCenter.x - rayStart.x;
  const dy = circleCenter.y - rayStart.y;
  
  // Ray direction (not normalized)
  const rayDx = rayEnd.x - rayStart.x;
  const rayDy = rayEnd.y - rayStart.y;
  const rayLength = Math.sqrt(rayDx * rayDx + rayDy * rayDy);
  
  if (rayLength === 0) return null;
  
  // Normalized ray direction
  const dirX = rayDx / rayLength;
  const dirY = rayDy / rayLength;
  
  // Project circle center onto ray
  const projection = dx * dirX + dy * dirY;
  
  // Closest point on ray to circle center
  const closestX = rayStart.x + dirX * projection;
  const closestY = rayStart.y + dirY * projection;
  
  // Distance from circle center to closest point
  const distX = circleCenter.x - closestX;
  const distY = circleCenter.y - closestY;
  const distSq = distX * distX + distY * distY;
  
  // Check if ray gets close enough to circle
  if (distSq > circleRadius * circleRadius) return null;
  
  // Calculate intersection distance along ray
  const halfChord = Math.sqrt(circleRadius * circleRadius - distSq);
  let intersectionDist = projection - halfChord;

  // If the ray starts inside the circle, the first intersection is behind
  // the start point. Use the second intersection point instead.
  if (intersectionDist < 0) {
    intersectionDist = projection + halfChord;
  }

  // Check if intersection is within ray segment
  if (intersectionDist > rayLength) return null;
  
  // Calculate intersection point
  const point = {
    x: rayStart.x + dirX * intersectionDist,
    y: rayStart.y + dirY * intersectionDist
  };
  
  return { point, distance: intersectionDist };
}
```

**Usage for Actors:**
- Actor at grid cell `(5, 5)` has circle center at `(5.0, 5.0)` with radius `0.5`
- Projectile moves from `(3.0, 5.0)` to `(7.0, 5.0)`
- Ray-circle test detects collision at exactly `(4.5, 5.0)`

#### Ray-AABB Intersection (Walls)

```typescript
/**
 * Test if a ray segment intersects an axis-aligned bounding box.
 * 
 * @param rayStart - Ray start position {x, y}
 * @param rayEnd - Ray end position {x, y}
 * @param boxMin - Box min corner {x, y}
 * @param boxMax - Box max corner {x, y}
 * @returns Intersection point and distance, or null if no hit
 */
function rayAABBIntersection(
  rayStart: {x: number, y: number},
  rayEnd: {x: number, y: number},
  boxMin: {x: number, y: number},
  boxMax: {x: number, y: number}
): {point: {x: number, y: number}, distance: number} | null {
  // Ray direction
  const rayDx = rayEnd.x - rayStart.x;
  const rayDy = rayEnd.y - rayStart.y;
  const rayLength = Math.sqrt(rayDx * rayDx + rayDy * rayDy);
  
  if (rayLength === 0) return null;
  
  const dirX = rayDx / rayLength;
  const dirY = rayDy / rayLength;
  
  // Handle axis-aligned rays to avoid division by zero
  if (dirX === 0 && (rayStart.x < boxMin.x || rayStart.x > boxMax.x)) {
    return null;
  }
  if (dirY === 0 && (rayStart.y < boxMin.y || rayStart.y > boxMax.y)) {
    return null;
  }

  // Compute intersection distances for each axis
  const tMinX = (boxMin.x - rayStart.x) / dirX;
  const tMaxX = (boxMax.x - rayStart.x) / dirX;
  const tMinY = (boxMin.y - rayStart.y) / dirY;
  const tMaxY = (boxMax.y - rayStart.y) / dirY;
  
  // Ensure min < max
  const tMin = Math.max(
    Math.min(tMinX, tMaxX),
    Math.min(tMinY, tMaxY)
  );
  const tMax = Math.min(
    Math.max(tMinX, tMaxX),
    Math.max(tMinY, tMaxY)
  );
  
  // No intersection if tMax < 0 (box behind ray) or tMin > tMax (ray misses)
  if (tMax < 0 || tMin > tMax) return null;
  
  // Use tMin as intersection point (first hit)
  const intersectionDist = tMin >= 0 ? tMin : tMax;
  
  // Check if intersection is within ray segment
  if (intersectionDist < 0 || intersectionDist > rayLength) return null;
  
  const point = {
    x: rayStart.x + dirX * intersectionDist,
    y: rayStart.y + dirY * intersectionDist
  };
  
  return { point, distance: intersectionDist };
}
```

**Usage for Walls:**
- Wall at grid cell `(5, 5)` has AABB from `(4.5, 4.5)` to `(5.5, 5.5)`
- Projectile moves from `(3.0, 5.0)` to `(7.0, 5.0)`
- Ray-AABB test detects collision at exactly `(4.5, 5.0)` (left edge of wall)

### Collision Detection Algorithm

```typescript
private moveProjectile(
  context: GameContext,
  entityId: number,
  projectile: HasProjectile,
  freeBody: FreeBodyStore
): boolean {
  const pos = freeBody.getPosition(entityId);
  if (!pos) return false;
  
  const speed = projectile.speed ?? 1;
  const vx = projectile.vx ?? 0;
  const vy = projectile.vy ?? 0;
  
  // Calculate end position for this tick
  const startFloatX = pos.x;
  const startFloatY = pos.y;
  const endFloatX = pos.x + vx;
  const endFloatY = pos.y + vy;
  
  // Track closest collision
  let closestHit: {
    type: 'actor' | 'wall',
    distance: number,
    point: {x: number, y: number},
    entityId?: number
  } | null = null;
  
  // 1. Check all actors in potential collision zone
  const searchRadius = Math.ceil(speed) + 1;
  const centerX = Math.round((startFloatX + endFloatX) / 2);
  const centerY = Math.round((startFloatY + endFloatY) / 2);
  
  const nearbyEntities = context.spatial.getEntityIdsInRadius(
    centerX, centerY, searchRadius
  );
  
  for (const targetId of nearbyEntities) {
    if (targetId === entityId) continue;
    if (targetId === projectile.ownerId) continue;
    
    const targetData = context.spatial.getEntityData(targetId);
    if (!targetData || !hasHealth(targetData)) continue;
    
    const targetPos = context.spatial.getEntityPosition(targetId);
    if (!targetPos || targetPos.layer !== GameLayers.ACTORS) continue;
    
    // Ray-circle intersection test
    const hit = rayCircleIntersection(
      {x: startFloatX, y: startFloatY},
      {x: endFloatX, y: endFloatY},
      {x: targetPos.x, y: targetPos.y},
      ACTOR_HIT_RADIUS
    );
    
    if (hit && (!closestHit || hit.distance < closestHit.distance)) {
      closestHit = {
        type: 'actor',
        distance: hit.distance,
        point: hit.point,
        entityId: targetId
      };
    }
  }
  
  // 2. Check all wall cells in path
  const pathCells = this.getCellsInRayPath(
    startFloatX, startFloatY,
    endFloatX, endFloatY
  );
  
  for (const cell of pathCells) {
    if (!context.spatial.isBlocked(cell)) continue;
    
    // Ray-AABB intersection test
    const hit = rayAABBIntersection(
      {x: startFloatX, y: startFloatY},
      {x: endFloatX, y: endFloatY},
      {x: cell.x - 0.5, y: cell.y - 0.5},  // Wall AABB min
      {x: cell.x + 0.5, y: cell.y + 0.5}   // Wall AABB max
    );
    
    if (hit && (!closestHit || hit.distance < closestHit.distance)) {
      closestHit = {
        type: 'wall',
        distance: hit.distance,
        point: hit.point
      };
    }
  }
  
  // 3. Move projectile to collision point or full distance
  if (closestHit) {
    freeBody.setPosition(entityId, closestHit.point.x, closestHit.point.y);
    
    if (closestHit.type === 'actor') {
      // Handle actor hit
      this.healthSystem.damage(
        closestHit.entityId!,
        projectile.damage,
        projectile.damageType,
        projectile.ownerId
      );
    }
    
    return true; // Destroy projectile
  } else {
    // No collision - move full distance
    freeBody.setPosition(entityId, endFloatX, endFloatY);
    return false;
  }
}
```

### Benefits of True Geometric Collision

1. **Precision**: Collisions occur at exact float coordinates, not approximated to grid cells
2. **Consistency**: Visual representation matches collision behavior exactly
3. **Performance**: Ray-casting is fast for sparse entity counts
4. **Correctness**: No corner-clipping or fast-projectile tunneling
5. **Intuitive**: Players see what they expect - projectiles hit where they visually touch

### Implementation Priority

- **High Priority**: Ray-circle intersection for actors (most visible to players)
- **Medium Priority**: Ray-AABB intersection for walls (reduces corner-clipping artifacts)
- **Future**: Consider swept-circle (projectile has radius) for ultra-precise collision

## Related Files

- `/mnt/user-data/uploads/debug-renderer.ts` - Renderer fix applied
- `/mnt/user-data/uploads/projectile_system.ts` - Projectile spawn logic (correct, no changes needed); collision detection (needs geometric improvement)
- `/mnt/user-data/uploads/free-body-store.ts` - Free-body position tracking
- `/mnt/user-data/uploads/spatial-system.ts` - Grid entity position tracking

## Lessons Learned

1. **Renderer must be faithful to model** - Don't use renderer hacks to fix model bugs, as it creates diagnostic red herrings
2. **Coordinate systems need explicit documentation** - Implicit conventions lead to bugs
3. **Parameter naming matters** - `x, y` is ambiguous; `floatX, floatY` or `cellX, cellY` is clear
4. **Type systems can prevent bugs** - Consider branded types for coordinate systems
5. **Model space scales to 1.0 per cell** - Renderer handles pixel scaling, model uses clean 1.0 units
