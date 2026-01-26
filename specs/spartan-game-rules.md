# Spartan Framework Rules

## Entity Placement
1. Entities occupy one cell at a time
2. Entities occupy a specific layer on that cell
3. Multiple entities can occupy the same cell on different layers
4. Higher layer indexes are conceptually "on top" of lower indexes

## Movement
5. Check if destination layer is occupied before moving
6. When entities move, clean up the previous cell layer
7. LinkedCells never move - position is immutable

## Interactions
8. No "collision" - only "overlap" detection
9. Overlaps are resolved by game logic (not the framework)
10. Overlap events propagate down layer indexes

## Spatial Queries
11. Grids enable spatial queries (line-of-sight, area effects, blocking)

Questions (ANSWERED):
1. LinkedCells can only contain numbers. What is the meaning of that number? Is that an entity ID?
   **ANSWER**: Yes! The numbers stored in `cell.values[layer]` are entity IDs. These IDs are auto-generated 
   by `SparseEntityStore` and can be looked up to retrieve full entity metadata. The spatial position is 
   implicit (the cell itself), while the ID references additional data (type, hp, etc.) stored externally.
   Example: `cell.values[1] = 42` means entity #42 occupies layer 1 of this cell.

2. How might we provide a fast way to look up entities in a cell?
   **ANSWER**: Use `SpatialSystem.getEntityIdsInCell(x, y)` which iterates through the cell's items array
   (typically 3-5 layers) and returns all entity IDs. For full entity data, lookup each ID in the store's
   Map (O(1) per entity). Total cost: O(layers) which is effectively O(1) for bounded layer counts.
   Example:
   ```typescript
   const entityIds = spatial.getEntityIdsInCell(5, 5);
   for (const id of entityIds) {
     const data = spatial.getEntityData(id); // O(1) Map lookup
     console.log(`Entity ${id}: ${data.type}`);
   }
   ```

Implementation: See packages/spartan/ for the full Architecture B implementation.
