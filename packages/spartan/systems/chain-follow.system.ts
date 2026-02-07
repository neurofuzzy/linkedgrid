/**
 * Chain Follow System - Coordinates linked entity chains (snakes, centipedes).
 *
 * Each chain consists of a head (moves via NPCMovementSystem) and followers
 * that move to the previous position of the segment ahead of them.
 * Each segment is an independent single-cell entity, maintaining the
 * Spartan spatial rules.
 *
 * Features:
 * - Followers step into the cell their leader just vacated
 * - Death handling: chain splitting (centipede-style)
 * - Head promotion when head dies
 * - New chain ID generation for split tails
 */
import { BaseTickedSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import { hasChainFollow, hasHealth, hasNPCMovement } from '../traits/trait-guards';
import type { HasChainFollow } from '../traits/chain-follow.trait';

/**
 * ChainFollowSystem - Manages linked entity chains.
 *
 * Runs AFTER NPCMovementSystem so the head has already moved.
 * Each follower steps into the cell its leader occupied before moving.
 *
 * @system
 * @reactsTo Entities with HasChainFollow trait
 * @modifies Entity positions (followers), chain splitting on death
 */
export class ChainFollowSystem extends BaseTickedSystem {
  readonly executionPhase = 'main' as const;

  protected tickRate = 1;

  /**
   * Previous position per entity ID (from last tick).
   * Key: entity ID of any chain member.
   * Value: {x, y} position at start of this tick (before movement).
   */
  private previousPositions: Map<number, { x: number; y: number }> = new Map();

  /** Counter for generating unique chain IDs on split */
  private splitCounter = 0;

  protected onTick(context: GameContext): void {
    // Phase 1: Collect all chain segments grouped by chainId
    const chains = new Map<string, Array<{ entityId: number; data: HasChainFollow }>>();

    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasChainFollow(entityData)) continue;

      const chainData = entityData as typeof entityData & HasChainFollow;
      const chainId = chainData.chainId;

      if (!chains.has(chainId)) {
        chains.set(chainId, []);
      }
      chains.get(chainId)!.push({ entityId, data: chainData });
    }

    // Phase 2: Handle dead segments FIRST (split chains, promote heads)
    this.handleDeathAndSplitting(context, chains);

    // Phase 3: Re-collect after splitting (chain IDs may have changed)
    chains.clear();
    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;
      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasChainFollow(entityData)) continue;
      const chainData = entityData as typeof entityData & HasChainFollow;
      const chainId = chainData.chainId;
      if (!chains.has(chainId)) {
        chains.set(chainId, []);
      }
      chains.get(chainId)!.push({ entityId, data: chainData });
    }

    // Phase 4: Process movement for each chain
    for (const [, segments] of chains) {
      segments.sort((a, b) => a.data.chainIndex - b.data.chainIndex);
      this.processChain(context, segments);
    }

    // Phase 5: Save current positions for next tick
    this.previousPositions.clear();
    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;
      const pos = context.spatial.getEntityPosition(entityId);
      if (pos) {
        this.previousPositions.set(entityId, { x: pos.x, y: pos.y });
      }
    }
  }

  /**
   * Process a single chain: move followers to the previous position of
   * the segment ahead.
   *
   * The head has already moved (via NPCMovementSystem). Each follower
   * steps into the cell its leader occupied before the head moved.
   * We process from head-to-tail order so each follower gets the
   * pre-move position of the segment directly ahead.
   */
  private processChain(
    context: GameContext,
    segments: Array<{ entityId: number; data: HasChainFollow }>
  ): void {
    if (segments.length <= 1) return;

    // Process from index 1 (first follower) to end
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.data.isChainHead) continue;

      const targetId = seg.data.chainFollowTargetId;
      if (targetId === undefined) continue;

      // Get the target's position from BEFORE this tick's movement
      const prevPos = this.previousPositions.get(targetId);
      if (!prevPos) continue;

      const currentPos = context.spatial.getEntityPosition(seg.entityId);
      if (!currentPos) continue;

      // Only move if the destination is different from current position
      if (currentPos.x !== prevPos.x || currentPos.y !== prevPos.y) {
        context.spatial.move(seg.entityId, prevPos.x, prevPos.y);
      }
    }
  }

  /**
   * Handle dead segments: split chains centipede-style.
   *
   * When a middle segment dies:
   * 1. The segments behind it become a new independent chain
   * 2. The first segment of the new chain is promoted to head
   * 3. Both chains continue independently
   *
   * When the head dies:
   * 1. The next segment is promoted to head of the existing chain
   */
  private handleDeathAndSplitting(
    context: GameContext,
    chains: Map<string, Array<{ entityId: number; data: HasChainFollow }>>
  ): void {
    for (const [chainId, segments] of chains) {
      if (segments.length === 0) continue;
      segments.sort((a, b) => a.data.chainIndex - b.data.chainIndex);

      // Build a set of entity IDs in this chain for fast lookup
      const segmentIdSet = new Set(segments.map(s => s.entityId));

      // Identify which segments are dead/dying or have broken links.
      // A "break point" is where a follower's target is either:
      // - Dead/dying in the current list
      // - Already removed from spatial (not in segmentIdSet)
      const deadOrBroken: Set<number> = new Set();

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const entityData = context.spatial.getEntityData(seg.entityId);

        // Check if this entity itself is dead/dying/removed
        let isDead = false;
        if (!entityData || !context.spatial.isAlive(seg.entityId)) {
          isDead = true;
        } else if (hasHealth(entityData)) {
          const healthState = (entityData as { healthState?: string }).healthState;
          if (healthState === 'dead' || healthState === 'dying') {
            isDead = true;
          }
        }
        if (isDead) {
          deadOrBroken.add(i);
        }
      }

      // Build contiguous linked runs.
      // Split at dead segments AND at followers whose target is missing.
      const livingRuns: Array<Array<{ entityId: number; data: HasChainFollow }>> = [];
      let currentRun: Array<{ entityId: number; data: HasChainFollow }> = [];

      for (let i = 0; i < segments.length; i++) {
        if (deadOrBroken.has(i)) {
          // Dead segment: start a new run after this
          if (currentRun.length > 0) {
            livingRuns.push(currentRun);
            currentRun = [];
          }
          continue;
        }

        const seg = segments[i];
        // Check if this follower's target is missing (broken link)
        if (!seg.data.isChainHead && seg.data.chainFollowTargetId !== undefined) {
          if (!segmentIdSet.has(seg.data.chainFollowTargetId)) {
            // Target was removed -- this is a break point, start new run
            if (currentRun.length > 0) {
              livingRuns.push(currentRun);
              currentRun = [];
            }
          }
        }

        currentRun.push(seg);
      }
      if (currentRun.length > 0) {
        livingRuns.push(currentRun);
      }

      // If only one run and it already has a head, nothing changed
      if (livingRuns.length === 1 && livingRuns[0].length > 0) {
        const hasHead = livingRuns[0].some(s => s.data.isChainHead);
        if (hasHead && deadOrBroken.size === 0) continue;
      }

      if (livingRuns.length === 0) continue;

      // First living run keeps the original chain ID
      // Additional runs get new chain IDs (split tails become new chains)
      for (let runIdx = 0; runIdx < livingRuns.length; runIdx++) {
        const run = livingRuns[runIdx];
        if (run.length === 0) continue;

        const newChainId = runIdx === 0 ? chainId : `${chainId}-split-${++this.splitCounter}`;

        // The first segment in each run becomes the head
        for (let i = 0; i < run.length; i++) {
          const seg = run[i];
          seg.data.chainId = newChainId;
          seg.data.chainIndex = i;

          if (i === 0) {
            seg.data.isChainHead = true;
            seg.data.chainFollowTargetId = undefined;
            this.ensureCanMove(context, seg.entityId);
          } else {
            seg.data.isChainHead = false;
            seg.data.chainFollowTargetId = run[i - 1].entityId;
          }
        }
      }
    }
  }

  /**
   * Ensure a newly promoted head can move autonomously.
   */
  private ensureCanMove(context: GameContext, entityId: number): void {
    const entityData = context.spatial.getEntityData(entityId);
    if (!entityData) return;

    if (!hasNPCMovement(entityData)) {
      (entityData as Record<string, unknown>).movementMode = 'wander';
      (entityData as Record<string, unknown>).speed = 2;
    }
  }

  public override resetState(): void {
    super.resetState();
    this.previousPositions.clear();
    this.splitCounter = 0;
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      trackedEntities: this.previousPositions.size,
      splitCount: this.splitCounter,
      description: 'Chain Follow System (snakes, centipedes, linked entities)',
    };
  }
}
