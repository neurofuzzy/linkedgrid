/**
 * Stun System - Manages stun/freeze status effects on entities.
 *
 * Processes stun timers, clears expired stuns, and provides the
 * applyStun() method for other systems (e.g., ProjectileSystem) to
 * inflict stun effects.
 *
 * When stunned:
 * - NPCMovementSystem skips the entity
 * - NPCBrainSystem skips the entity
 * - PlayerInputSystem skips the entity
 * - Visual state is set to 'frozen'
 */
import { BaseTickedSystem } from '../core/base-system';
import type { GameContext } from '../core/types';
import { hasStunnable, hasVisualState } from '../traits/trait-guards';
import type { HasStunnable } from '../traits/stun.trait';

/**
 * StunSystem - Manages stun/freeze status effects.
 *
 * Features:
 * - Tick-based stun expiration
 * - Visual state integration (sets 'frozen' state)
 * - applyStun() API for other systems
 * - Automatic cleanup when stun expires
 *
 * @system
 * @reactsTo Entities with HasStunnable trait and stunned=true
 * @modifies Entity stunned state, visual state
 */
export class StunSystem extends BaseTickedSystem {
  readonly executionPhase = 'main' as const;

  protected tickRate = 1;

  /** Pending stun applications queued during the current tick */
  private pendingStuns: Array<{ entityId: number; duration: number }> = [];

  protected onTick(context: GameContext): void {
    const currentTick = context.tick ?? 0;

    // Apply pending stuns first
    for (const pending of this.pendingStuns) {
      this.applyStunImmediate(context, pending.entityId, pending.duration, currentTick);
    }
    this.pendingStuns = [];

    // Process active stuns: check expiration
    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasStunnable(entityData)) continue;

      const stunData = entityData as typeof entityData & HasStunnable;
      if (!stunData.stunned) continue;

      // Check if stun has expired
      const stunEndTick = stunData.stunEndTick ?? 0;
      if (currentTick >= stunEndTick) {
        // Clear stun
        stunData.stunned = false;
        stunData.stunEndTick = 0;

        // Revert visual state from frozen to idle
        if (hasVisualState(entityData)) {
          entityData.visualState = 'idle';
          entityData.visualDirty = true;
        }
      }
    }
  }

  /**
   * Queue a stun to be applied on the next tick.
   *
   * This is the public API for other systems (ProjectileSystem, MeleeSystem, etc.)
   * to stun entities. The stun is applied at the start of StunSystem's next onTick().
   *
   * @param entityId - Entity to stun
   * @param duration - Duration in ticks
   */
  applyStun(entityId: number, duration: number): void {
    this.pendingStuns.push({ entityId, duration });
  }

  /**
   * Apply stun immediately (internal).
   */
  private applyStunImmediate(
    context: GameContext,
    entityId: number,
    duration: number,
    currentTick: number
  ): void {
    if (!context.spatial.isAlive(entityId)) return;

    const entityData = context.spatial.getEntityData(entityId);
    if (!entityData || !hasStunnable(entityData)) return;

    const stunData = entityData as typeof entityData & HasStunnable;

    // Apply or extend stun
    stunData.stunned = true;
    const newEndTick = currentTick + duration;
    // Only extend, never shorten an active stun
    stunData.stunEndTick = Math.max(stunData.stunEndTick ?? 0, newEndTick);

    // Set visual state to frozen
    if (hasVisualState(entityData)) {
      entityData.visualState = 'frozen';
      entityData.visualDirty = true;
    }
  }

  public override resetState(): void {
    super.resetState();
    this.pendingStuns = [];
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      pendingStuns: this.pendingStuns.length,
      description: 'Stun System (freeze/stun status effects)',
    };
  }
}
