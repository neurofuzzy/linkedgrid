/**
 * Chain Follow System - Coordinates linked entity chains (snakes, centipedes).
 *
 * Each chain consists of a head (moves via NPCMovementSystem) and followers.
 * Each follower stages a move to the CURRENT position of the segment ahead.
 * Since the segment ahead has also staged a move (or the head moved via
 * NPCMovement), the spatial commit's "vacating" logic handles the cascade:
 *
 *   Head at A stages move to B  →  sources has A
 *   F1 at A-1 stages move to A  →  A is in sources, move approved
 *   F2 at A-2 stages move to A-1 → A-1 is in sources, move approved
 *   Commit: clears A, A-1, A-2 → writes B, A, A-1. No overlap.
 *
 * If the head's move is rejected (rare with smart wander), none of the
 * followers' destinations are in the sources set, so all are rejected too.
 * The entire chain stays put. Correct behavior, no overlap.
 *
 * Features:
 * - Zero-lag following (same-tick as head via commit cascade)
 * - Centipede-style chain splitting when middle segments die
 * - Head promotion when head dies
 */
import { BaseTickedSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import { hasChainFollow, hasHealth, hasNPCMovement } from '../traits/trait-guards';
import type { HasChainFollow } from '../traits/chain-follow.trait';

/**
 * ChainFollowSystem - Manages linked entity chains.
 *
 * Runs in main phase AFTER NPCMovementSystem so the head has staged its move.
 * Followers stage moves to their leader's current position. The commit
 * resolves the entire chain atomically via its vacating logic.
 *
 * @system
 * @reactsTo Entities with HasChainFollow trait
 * @modifies Entity positions (followers), chain splitting on death
 */
export class ChainFollowSystem extends BaseTickedSystem {
  readonly executionPhase = 'main' as const;

  protected tickRate = 1;

  /** Counter for generating unique chain IDs on split */
  private splitCounter = 0;

  protected onTick(context: GameContext): void {
    // Phase 1: Collect all chain segments grouped by chainId
    const chains = this.collectChains(context);

    // Phase 2: Handle dead segments (split chains, promote heads)
    this.handleDeathAndSplitting(context, chains);

    // Phase 3: Re-collect after splitting (chain IDs may have changed)
    const updatedChains = this.collectChains(context);

    // Phase 4: Stage follower moves for each chain
    for (const [, segments] of updatedChains) {
      segments.sort((a, b) => a.data.chainIndex - b.data.chainIndex);
      this.processChain(context, segments);
    }
  }

  /**
   * Collect all living chain segments grouped by chainId.
   */
  private collectChains(
    context: GameContext
  ): Map<string, Array<{ entityId: number; data: HasChainFollow }>> {
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

    return chains;
  }

  /**
   * Stage follower moves: each follower moves to its leader's current position.
   *
   * The head has already staged a move via NPCMovementSystem.
   * Each follower stages a move to the leader's current (pre-commit) position.
   * When commit runs, the leader vacates that cell, and the follower occupies it.
   *
   * Process head-to-tail so each follower reads the correct current position
   * of its leader (before any commit changes).
   */
  private processChain(
    context: GameContext,
    segments: Array<{ entityId: number; data: HasChainFollow }>
  ): void {
    if (segments.length <= 1) return;

    // Check if the head has a pending move. If not, no follower should move.
    const head = segments[0];
    const headPending = this.hasPendingMove(context, head.entityId);
    if (!headPending) return;

    // Process followers head-to-tail
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.data.isChainHead) continue;

      const targetId = seg.data.chainFollowTargetId;
      if (targetId === undefined) continue;

      // Leader's current committed position (leader is about to vacate this)
      const leaderPos = context.spatial.getEntityPosition(targetId);
      if (!leaderPos) continue;

      const currentPos = context.spatial.getEntityPosition(seg.entityId);
      if (!currentPos) continue;

      // Only stage move if destination differs from current position
      if (currentPos.x !== leaderPos.x || currentPos.y !== leaderPos.y) {
        context.spatial.move(seg.entityId, leaderPos.x, leaderPos.y);
      }
    }
  }

  /**
   * Check if an entity has a pending move staged for this tick's commit.
   */
  private hasPendingMove(context: GameContext, entityId: number): boolean {
    const ops = context.spatial.getPendingOps();
    for (const op of ops) {
      if (op.type === 'move' && op.entityId === entityId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Handle dead segments: split chains centipede-style.
   */
  private handleDeathAndSplitting(
    context: GameContext,
    chains: Map<string, Array<{ entityId: number; data: HasChainFollow }>>
  ): void {
    for (const [chainId, segments] of chains) {
      if (segments.length === 0) continue;
      segments.sort((a, b) => a.data.chainIndex - b.data.chainIndex);

      const segmentIdSet = new Set(segments.map(s => s.entityId));
      const deadOrBroken: Set<number> = new Set();

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const entityData = context.spatial.getEntityData(seg.entityId);

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

      // Build contiguous linked runs, splitting at dead segments and broken links
      const livingRuns: Array<Array<{ entityId: number; data: HasChainFollow }>> = [];
      let currentRun: Array<{ entityId: number; data: HasChainFollow }> = [];

      for (let i = 0; i < segments.length; i++) {
        if (deadOrBroken.has(i)) {
          if (currentRun.length > 0) {
            livingRuns.push(currentRun);
            currentRun = [];
          }
          continue;
        }

        const seg = segments[i];
        // Check for broken link (target was removed on a previous tick)
        if (!seg.data.isChainHead && seg.data.chainFollowTargetId !== undefined) {
          if (!segmentIdSet.has(seg.data.chainFollowTargetId)) {
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

      // Check if anything actually needs to change
      if (livingRuns.length === 1 && deadOrBroken.size === 0) {
        const run = livingRuns[0];
        const hasHead = run.some(s => s.data.isChainHead);
        let linksOk = true;
        for (let i = 1; i < run.length; i++) {
          if (run[i].data.chainFollowTargetId !== run[i - 1].entityId) {
            linksOk = false;
            break;
          }
        }
        if (hasHead && linksOk) continue;
      }

      if (livingRuns.length === 0) continue;

      // Assign chain IDs and relink
      for (let runIdx = 0; runIdx < livingRuns.length; runIdx++) {
        const run = livingRuns[runIdx];
        if (run.length === 0) continue;

        const newChainId = runIdx === 0 ? chainId : `${chainId}-split-${++this.splitCounter}`;

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
    this.splitCounter = 0;
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      splitCount: this.splitCounter,
      description: 'Chain Follow System (snakes, centipedes, linked entities)',
    };
  }
}
