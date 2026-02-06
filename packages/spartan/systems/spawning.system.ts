/**
 * @brief Spawning System - Handles entity spawning from spawner entities.
 *
 * Spawners spawn entities in open adjacent cells when activated.
 * Activation occurs via player proximity + LOS or sleep-wake zone signals.
 * Adjacent spawners are grouped and share limits/cooldowns.
 */
import { BaseTickedSystem } from '../core/base-system';
import type { GameContext, SpawnIntent, EntityLifecycleEvent } from '../core/types';
import { hasSpawner, hasSignalReceiver, isSleepWake } from '../traits/trait-guards';
import { GameLayers } from '../config/layers.config';
import type { HasSpawner } from '../traits/spawner.trait';
import { LinkedCellUtils } from '../core/grid/linked-cell-utils';

/**
 * Cardinal direction offsets for spawn location cycling.
 * Order: UP, RIGHT, DOWN, LEFT
 */
const CARDINAL_OFFSETS = [
  { dx: 0, dy: -1 },  // UP (0)
  { dx: 1, dy: 0 },   // RIGHT (1)
  { dx: 0, dy: 1 },   // DOWN (2)
  { dx: -1, dy: 0 },  // LEFT (3)
] as const;

/**
 * Group state for coordinated spawners.
 * Shared across all spawners in a group.
 */
interface SpawnerGroup {
  /** All spawner entity IDs in this group */
  memberIds: number[];
  /** Living entities spawned by this group */
  spawnedEntityIds: number[];
  /** Tick when group last spawned */
  lastSpawnTick: number;
  /** Current direction index for cycling */
  currentDirection: number;
  /** Group spawn limit (from first member) */
  spawnLimit: number;
  /** Group cooldown (from first member) */
  cooldown: number;
}

/**
 * SpawningSystem - Manages entity spawning from spawner entities.
 *
 * Features:
 * - Spawner entity activation via player proximity + LOS
 * - Spawner activation via sleep-wake zone signals
 * - Spawn limits (max concurrent living spawned entities)
 * - Cooldown between spawns
 * - Cardinal direction cycling for spawn locations
 * - Adjacent spawner grouping (shared limits/cooldowns/cells)
 * - Duplicate spawn prevention (same cell+layer+tick)
 *
 * @system
 * @reactsTo Entities with HasSpawner trait
 * @spawns Configured entity types
 *
 * @example
 * ```typescript
 * const spawningSystem = new SpawningSystem(gameManager);
 * gameLoop.addSystem(spawningSystem);
 *
 * // Spawn a spawner entity
 * spatial.spawn('spawner', 5, 5, GameLayers.COLLECTIBLES, {
 *   spawnType: 'enemy',
 *   spawnLimit: 3,
 *   cooldown: 20,
 *   activationRange: 8,
 *   spawnLayer: GameLayers.ACTORS,
 *   color: '#ff00ff',
 * });
 * ```
 */
export class SpawningSystem extends BaseTickedSystem {
  readonly executionPhase = 'main' as const;

  protected tickRate = 1; // Run every tick

  /** Spawner groups by group ID */
  private groups: Map<number, SpawnerGroup> = new Map();

  /** Spawner ID to group ID mapping */
  private spawnerToGroup: Map<number, number> = new Map();

  /** Next group ID counter */
  private nextGroupId = 1;

  /** Track spawns this tick to prevent duplicates (cell key → layer → true) */
  private spawnsThisTick: Map<string, Set<number>> = new Map();

  /** Flag indicating groups need rebuilding (set by lifecycle callbacks) */
  private groupsDirty = true;

  constructor() {
    super();
  }

  /**
   * Handle entity spawn events via base class lifecycle hook.
   * Marks groups dirty if a spawner was added.
   */
  protected override onEntitySpawn(event: EntityLifecycleEvent): void {
    if (event.type === 'spawner') {
      this.groupsDirty = true;
    }
  }

  /**
   * Handle entity remove events via base class lifecycle hook.
   * Marks groups dirty if a spawner was removed.
   * Removes dead entities from spawnedEntityIds.
   */
  protected override onEntityRemove(event: EntityLifecycleEvent): void {
    if (event.type === 'spawner') {
      this.groupsDirty = true;
    }

    // Remove from spawnedEntityIds if present in any group
    for (const group of this.groups.values()) {
      const idx = group.spawnedEntityIds.indexOf(event.entityId);
      if (idx !== -1) {
        group.spawnedEntityIds.splice(idx, 1);
      }
    }
  }

  /**
   * Handle scene changes via base class lifecycle hook.
   * Rebuilds groups for new scene.
   */
  protected override onSceneChange(): void {
    this.groupsDirty = true;
  }

  protected onTick(context: GameContext): void {
    const currentTick = context.tick ?? 0;
    this.spawnsThisTick.clear();

    // Phase 1: Rebuild groups only when dirty
    if (this.groupsDirty) {
      this.buildGroups(context);
      this.groupsDirty = false;
    }

    // Phase 2: Clean up dead spawns (safety net for failed spawns + scene transitions)
    // The onRemove callback handles most cases, but spawns that fail at commit
    // (e.g., collision) never get placed, so onRemove never fires for them.
    this.cleanupDeadSpawns(context);

    // Phase 3: Process each group
    for (const [groupId, group] of this.groups) {
      this.processGroup(context, groupId, group, currentTick);
    }
  }

  /**
   * Clean up dead spawned entities from all groups.
   * Acts as safety net for spawns that failed at commit time.
   */
  private cleanupDeadSpawns(context: GameContext): void {
    for (const group of this.groups.values()) {
      group.spawnedEntityIds = group.spawnedEntityIds.filter((id) =>
        context.spatial.isAlive(id)
      );
    }
  }

  /**
   * Build spawner groups from cardinal adjacency.
   * Uses union-find approach to identify connected components.
   */
  private buildGroups(context: GameContext): void {
    // Collect all spawner positions
    const spawners: Array<{ id: number; x: number; y: number; data: HasSpawner }> = [];

    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasSpawner(entityData)) continue;

      const pos = context.spatial.getEntityPosition(entityId);
      if (!pos) continue;

      spawners.push({ id: entityId, x: pos.x, y: pos.y, data: entityData });
    }

    // Build adjacency graph
    const adjacency = new Map<number, Set<number>>();
    for (const spawner of spawners) {
      adjacency.set(spawner.id, new Set());
    }

    // Find cardinal-adjacent spawners
    for (let i = 0; i < spawners.length; i++) {
      for (let j = i + 1; j < spawners.length; j++) {
        const a = spawners[i];
        const b = spawners[j];
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);

        // Cardinal adjacency: exactly 1 cell apart in one direction
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
          adjacency.get(a.id)!.add(b.id);
          adjacency.get(b.id)!.add(a.id);
        }
      }
    }

    // BFS to find connected components
    const visited = new Set<number>();
    const newGroups = new Map<number, SpawnerGroup>();
    const newSpawnerToGroup = new Map<number, number>();

    for (const spawner of spawners) {
      if (visited.has(spawner.id)) continue;

      // BFS from this spawner
      const component: number[] = [];
      const queue = [spawner.id];
      visited.add(spawner.id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);

        for (const neighbor of adjacency.get(current) || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      // Create or update group
      const groupId = this.nextGroupId++;
      const firstSpawner = spawners.find((s) => s.id === component[0])!;

      // Check if we have existing state for this group
      let existingState: SpawnerGroup | undefined;
      const oldGroupId = this.spawnerToGroup.get(component[0]);
      if (oldGroupId !== undefined) {
        existingState = this.groups.get(oldGroupId);
      }

      newGroups.set(groupId, {
        memberIds: component,
        spawnedEntityIds: existingState?.spawnedEntityIds || [],
        lastSpawnTick: existingState?.lastSpawnTick || -Infinity,
        currentDirection: existingState?.currentDirection || 0,
        spawnLimit: firstSpawner.data.spawnLimit,
        cooldown: firstSpawner.data.cooldown,
      });

      for (const memberId of component) {
        newSpawnerToGroup.set(memberId, groupId);
      }
    }

    this.groups = newGroups;
    this.spawnerToGroup = newSpawnerToGroup;
  }

  /**
   * Process a spawner group for potential spawning.
   */
  private processGroup(
    context: GameContext,
    _groupId: number,
    group: SpawnerGroup,
    currentTick: number
  ): void {
    // Check if group is activated (any member is active)
    const isActive = group.memberIds.some((id) =>
      this.isSpawnerActive(context, id)
    );

    if (!isActive) return;

    // Check spawn limit
    if (group.spawnedEntityIds.length >= group.spawnLimit) return;

    // Check cooldown
    if (currentTick - group.lastSpawnTick < group.cooldown) return;

    // Find open spawn cell from aggregated adjacent cells
    const spawnLocation = this.findGroupSpawnCell(context, group);
    if (!spawnLocation) return;

    // Get spawn properties from first member
    const firstMemberId = group.memberIds[0];
    const firstMemberData = context.spatial.getEntityData(firstMemberId);
    if (!firstMemberData || !hasSpawner(firstMemberData)) return;

    const spawnerData = firstMemberData as typeof firstMemberData & HasSpawner;

    // Create spawn intent
    const intent: SpawnIntent = {
      sourceId: firstMemberId,
      entityType: spawnerData.spawnType,
      layer: spawnerData.spawnLayer,
      props: spawnerData.spawnProps,
      preferredCell: spawnLocation,
    };

    // Validate and execute spawn
    const spawnedId = this.executeSpawn(context, intent);
    if (spawnedId !== null) {
      group.spawnedEntityIds.push(spawnedId);
      group.lastSpawnTick = currentTick;
    }
  }

  /**
   * Check if a spawner is activated.
   * Activation via player proximity + LOS OR sleep-wake zone.
   */
  private isSpawnerActive(context: GameContext, spawnerId: number): boolean {
    const spawnerData = context.spatial.getEntityData(spawnerId);
    if (!spawnerData || !hasSpawner(spawnerData)) return false;

    const spawner = spawnerData as typeof spawnerData & HasSpawner;

    // Check player proximity + LOS
    if (spawner.activationRange > 0) {
      if (this.isPlayerInRange(context, spawnerId, spawner)) {
        return true;
      }
    }

    // Check sleep-wake zone activation
    return this.isInActiveSleepWakeZone(context, spawnerId);
  }

  /**
   * Check if player is within range and (optionally) has line of sight.
   */
  private isPlayerInRange(
    context: GameContext,
    spawnerId: number,
    spawner: HasSpawner
  ): boolean {
    const playerEntityId = context.gameManager?.gameState?.playerEntityId;
    if (playerEntityId === undefined) return false;

    const playerPos = context.spatial.getEntityPosition(playerEntityId);
    const spawnerPos = context.spatial.getEntityPosition(spawnerId);
    if (!playerPos || !spawnerPos) return false;

    // Check distance (Manhattan for simplicity)
    const distance =
      Math.abs(playerPos.x - spawnerPos.x) + Math.abs(playerPos.y - spawnerPos.y);
    if (distance > spawner.activationRange) return false;

    // Check LOS if required
    if (spawner.requiresLineOfSight !== false) {
      const spawnerCell = context.spatial.grid.cell(spawnerPos.x, spawnerPos.y);
      const playerCell = context.spatial.grid.cell(playerPos.x, playerPos.y);

      if (!spawnerCell || !playerCell) return false;

      const line = LinkedCellUtils.getLine(spawnerCell, playerCell);

      // Check for blocking cells (skip first = spawner, last = player)
      for (let i = 1; i < line.length - 1; i++) {
        if (context.spatial.isBlocked(line[i])) {
          return false; // LOS blocked
        }
      }
    }

    return true;
  }

  /**
   * Check if spawner is on an active sleep-wake zone.
   */
  private isInActiveSleepWakeZone(
    context: GameContext,
    spawnerId: number
  ): boolean {
    const spawnerPos = context.spatial.getEntityPosition(spawnerId);
    if (!spawnerPos) return false;

    // Check LOGIC layer for sleep-wake entity
    const logicEntityId = context.spatial.getEntityIdAt(
      spawnerPos.x,
      spawnerPos.y,
      GameLayers.LOGIC
    );

    if (logicEntityId === undefined) return false;

    const logicData = context.spatial.getEntityData(logicEntityId);
    if (!logicData) return false;

    // Check if it's a sleep-wake entity receiving a signal
    if (isSleepWake(logicData) && hasSignalReceiver(logicData)) {
      return logicData.receivedSignal === true;
    }

    return false;
  }

  /**
   * Find an open spawn cell from aggregated adjacent cells of all group members.
   * 
   * Cycles through each spawner's cardinal directions in order:
   * - For each spawner, iterate UP, RIGHT, DOWN, LEFT
   * - Skip cells that contain another spawner in the group
   * - Skip blocked cells and cells with actors
   * 
   * This creates a "walk around" effect for grouped spawners.
   */
  private findGroupSpawnCell(
    context: GameContext,
    group: SpawnerGroup
  ): { x: number; y: number } | null {
    // Build set of spawner positions (to exclude from spawn candidates)
    const spawnerPositions = new Set<string>();
    const memberPositions: Array<{ id: number; x: number; y: number }> = [];

    for (const memberId of group.memberIds) {
      const memberPos = context.spatial.getEntityPosition(memberId);
      if (!memberPos) continue;
      spawnerPositions.add(`${memberPos.x},${memberPos.y}`);
      memberPositions.push({ id: memberId, x: memberPos.x, y: memberPos.y });
    }

    // Build ordered list of spawn candidates:
    // For each spawner, add its 4 cardinal neighbors (excluding other spawners)
    const spawnCandidates: Array<{ x: number; y: number }> = [];
    const seenCandidates = new Set<string>();

    for (const member of memberPositions) {
      for (const offset of CARDINAL_OFFSETS) {
        const x = member.x + offset.dx;
        const y = member.y + offset.dy;
        const key = `${x},${y}`;

        // Skip if this cell contains another spawner
        if (spawnerPositions.has(key)) continue;

        // Skip if we've already added this cell
        if (seenCandidates.has(key)) continue;
        seenCandidates.add(key);

        spawnCandidates.push({ x, y });
      }
    }

    if (spawnCandidates.length === 0) return null;

    // Start from current direction and cycle through
    const startDir = group.currentDirection;
    const numCells = spawnCandidates.length;

    for (let i = 0; i < numCells; i++) {
      const index = (startDir + i) % numCells;
      const cell = spawnCandidates[index];

      if (this.isCellOpenForSpawn(context, cell.x, cell.y, spawnerPositions)) {
        // Advance direction for next spawn
        group.currentDirection = (index + 1) % numCells;
        return cell;
      }
    }

    return null;
  }

  /**
   * Check if a cell is open for spawning.
   */
  private isCellOpenForSpawn(
    context: GameContext,
    x: number,
    y: number,
    spawnerPositions?: Set<string>
  ): boolean {
    const cell = context.spatial.grid.cell(x, y);
    if (!cell) return false;

    // Check if cell is blocked (walls)
    if (context.spatial.isBlocked(cell)) return false;

    // Check if actor already present
    const actorId = context.spatial.getEntityIdAt(x, y, GameLayers.ACTORS);
    if (actorId !== undefined) return false;

    // Check if spawner already present (on any layer)
    if (spawnerPositions) {
      if (spawnerPositions.has(`${x},${y}`)) return false;
    } else {
      // Check for spawner on common layers
      for (const layer of [GameLayers.WALLS, GameLayers.COLLECTIBLES]) {
        const entityId = context.spatial.getEntityIdAt(x, y, layer);
        if (entityId !== undefined) {
          const data = context.spatial.getEntityData(entityId);
          if (data && hasSpawner(data)) return false;
        }
      }
    }

    return true;
  }

  /**
   * Execute a spawn intent with validation.
   */
  private executeSpawn(
    context: GameContext,
    intent: SpawnIntent
  ): number | null {
    // Validate source is alive
    if (!context.spatial.isAlive(intent.sourceId)) {
      return null;
    }

    const cell = intent.preferredCell;
    if (!cell) return null;

    // Dedupe: prevent duplicate spawn on same cell+layer+tick
    const cellKey = `${cell.x},${cell.y}`;
    if (!this.spawnsThisTick.has(cellKey)) {
      this.spawnsThisTick.set(cellKey, new Set());
    }

    if (this.spawnsThisTick.get(cellKey)!.has(intent.layer)) {
      return null; // Already spawned here this tick
    }

    // Mark as spawned
    this.spawnsThisTick.get(cellKey)!.add(intent.layer);

    // Execute spawn
    const spawnedId = context.spatial.spawn(
      intent.entityType,
      cell.x,
      cell.y,
      intent.layer,
      intent.props ?? {}
    );

    return spawnedId;
  }

  public override resetState(): void {
    super.resetState(); // Handles lifecycle cleanup
    this.groups.clear();
    this.spawnerToGroup.clear();
    this.spawnsThisTick.clear();
    this.nextGroupId = 1;
    this.groupsDirty = true;
  }

  public override getDebugState(): Record<string, unknown> {
    const groupInfo: Record<string, unknown> = {};

    for (const [groupId, group] of this.groups) {
      groupInfo[`group_${groupId}`] = {
        members: group.memberIds.length,
        spawned: group.spawnedEntityIds.length,
        limit: group.spawnLimit,
        cooldown: group.cooldown,
        lastSpawnTick: group.lastSpawnTick,
        currentDirection: group.currentDirection,
      };
    }

    return {
      ...super.getDebugState(),
      description: 'Spawning System (spawner entities, grouping, activation)',
      totalGroups: this.groups.size,
      totalSpawners: this.spawnerToGroup.size,
      groups: groupInfo,
    };
  }
}
