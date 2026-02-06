# Phase 1.5 Cleanup Plan

**Goal**: Stabilize the codebase, resolve technical debt, and correct architectural inversions before proceeding to Phase 2.

## 1. Architectural Simplification (Internal Module Strategy)
The user has decided that `LinkedGrid` will remain an internal module of the game engine (Option B). The current root structure disguises this by re-exporting `spartan` code.

**Action Items:**
- [ ] **Delete Root Source**: Delete `src/index.ts`. The root should only be a workspace container, not a pseudo-library.
- [ ] **Simplify Imports**: Ensure all internal `spartan` imports are relative or use a consistent alias, rather than importing from the root.
- [ ] **Clarify Purpose**: The `packages/spartan/core/grid` directory is the canonical home of the grid. No extraction needed.

## 2. TypeScript Error Sweep
There are currently ~252 TypeScript errors. Most are due to loose typing of `EntityData` and specific game traits.

**Action Items:**
- [ ] **Add Script**: Add `"typecheck": "tsc --noEmit"` to `package.json`.
- [ ] **Strict EntityData**: Refactor `EntityData` to be a discriminated union or use strict intersection types for system queries.
    - Problem: `Property 'hp' does not exist on type 'EntityData'`.
    - Fix: Ensure `spawn` and `getEntityData` return properly typed objects based on traits (e.g., `EntityData & HasHealth`).
- [ ] **Fix Tests**: Update tests to use correct mock data that satisfies strict type requirements.

## 3. System & Usage Assessment
Assess if systems are using the grid efficiently and adhering to "Spartan" principles.

**Action Items:**
- [ ] **Grid Usage**: `NPCMovementSystem` uses `LinkedCellUtils` correctly. Verify other systems (`Explosion`, `Fire`) utilize the grid for propagation rather than brute-force distance checks where appropriate.
- [ ] **Responsibility Audit**:
    - `SpatialSystem`: Currently handles "GameLayers". This coupling is fine for the game engine (`spartan`), but should be decoupled from the raw `LinkedGrid` class.
    - Ensure `LinkedGrid` remains pure data structure.

## 4. Refactoring & Normalization
- [ ] **Standardize Spawning**: Ensure all spawning goes through `SpatialSystem.spawn` with proper type validation.
- [ ] **Remove Dead Code**: Scan for unused exports after the move.

## Execution Order
1.  **Architecture**: Move grid code to `src/`. Fix imports.
2.  **Scripts**: Add `typecheck`.
3.  **Types**: Fix errors in chunks (Systems first, then Tests).
4.  **Review**: Final pass on usage patterns.
