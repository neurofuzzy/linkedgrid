/**
 * NPC Brain System - Autonomous combat decision-making for NPCs.
 *
 * Coordinates movement, attack posture, and prey/threat identification.
 * Sets intent fields on entity data that existing systems consume:
 * - movementMode / targetEntityId -> NPCMovementSystem
 * - meleeDirection -> MeleeSystem
 * - projectile spawning -> ProjectileSystem
 *
 * Entities remain dumb. The brain is the coordinator.
 */
import { BaseTickedSystem } from '../core/base-system';
import { SYSTEM_CONFIG } from '../config/systems.config';
import type { GameContext, EntityData } from '../core/types';
import { hasNPCBrain, hasMelee, hasWeapon, hasHealth, hasTeam, hasNPCMovement, isStunned, isChainFollower } from '../traits/trait-guards';
import { Direction } from '../core/grid/direction';
import { GameLayers } from '../config/layers.config';
import type { HasNPCBrain, NPCPosture } from '../traits/npc-brain.trait';
import type { HasHealth } from '../traits/health.trait';
import type { HasMelee } from '../traits/melee.trait';
import type { HasWeapon } from '../traits/weapon.trait';
import type { HasTeam } from '../traits/role.trait';
import type { HasNPCMovement } from '../traits/npc-movement.trait';
import type { ProjectileSystem } from './projectile.system';
import { DEFAULT_WEAPONS } from '../traits/weapon.trait';

/**
 * NPCBrainSystem - Makes NPCs fight autonomously.
 *
 * Architecture: AI Controller/Executor Pattern
 *
 * This system acts as a high-level "Controller" that makes decisions
 * and writes intent fields onto entity data. Low-level "Executor"
 * systems (NPCMovementSystem, MeleeSystem, ProjectileSystem) then
 * act on those intents without making decisions themselves.
 *
 * Controller sets -> Executor reads:
 * - movementMode, targetEntityId -> NPCMovementSystem
 * - meleeDirection -> MeleeSystem
 * - projectile spawn -> ProjectileSystem
 *
 * Runs before NPCMovementSystem (pre-commit phase) so posture
 * decisions are available for movement in the same tick.
 *
 * Per-NPC each tick:
 * 1. Threat scan: find nearest opposing-team entity within threatRange
 * 2. Posture evaluation: aggressive / defensive / retreating / idle
 * 3. Attack execution: set meleeDirection or spawn projectile
 * 4. Movement override: set movementMode + targetEntityId for NPCMovementSystem
 *
 * @system
 * @reactsTo Entities with HasNPCBrain trait
 * @modifies Entity movementMode, meleeDirection, targetEntityId
 * @spawns Projectiles via ProjectileSystem
 */
export class NPCBrainSystem extends BaseTickedSystem {
  readonly executionPhase = 'pre-commit' as const;

  protected tickRate = SYSTEM_CONFIG.NPCBrain.tickRate;

  constructor(private projectileSystem: ProjectileSystem) {
    super();
  }

  protected onTick(context: GameContext): void {
    const currentTick = context.tick ?? 0;

    for (const [entityId] of context.spatial.getAllPositions()) {
      if (!context.spatial.isAlive(entityId)) continue;

      const entityData = context.spatial.getEntityData(entityId);
      if (!entityData || !hasNPCBrain(entityData)) continue;

      // Skip stunned entities
      if (isStunned(entityData)) continue;

      // Skip chain followers (head only makes decisions)
      if (isChainFollower(entityData)) continue;

      this.processNPC(context, entityId, entityData, currentTick);
    }
  }

  /**
   * Process a single NPC's brain logic.
   */
  private processNPC(
    context: GameContext,
    entityId: number,
    entityData: EntityData & HasNPCBrain,
    currentTick: number
  ): void {
    const pos = context.spatial.getEntityPosition(entityId);
    if (!pos) return;

    const threatRange = entityData.threatRange ?? 8;
    const attackRange = entityData.attackRange ?? 1;

    // 1. Find nearest threat
    const target = this.findNearestThreat(context, entityId, entityData, pos.x, pos.y, threatRange);

    // 2. Evaluate posture
    const posture = this.evaluatePosture(entityData, target);

    // 3. Update movement based on posture
    this.applyPostureToMovement(entityData, posture, target);

    // 4. Execute attack if target in range
    if (target && posture !== 'retreating' && posture !== 'idle') {
      this.executeAttack(context, entityId, entityData, pos, target, attackRange, currentTick);
    }

    // 5. Update brain state
    entityData.posture = posture;
    if (target) {
      entityData.brainState = posture === 'retreating' ? 'retreating' : 'engaging';
      entityData.currentTargetId = target.entityId;
    } else {
      entityData.brainState = 'idle';
      entityData.currentTargetId = undefined;
    }
  }

  /**
   * Find the nearest entity on an opposing team within range.
   */
  private findNearestThreat(
    context: GameContext,
    entityId: number,
    entityData: EntityData & HasNPCBrain,
    x: number,
    y: number,
    threatRange: number
  ): { entityId: number; x: number; y: number; distance: number } | null {
    const myTeam = hasTeam(entityData) ? entityData.team : 'enemy';

    const nearbyIds = context.spatial.getEntityIdsInRadius(x, y, threatRange);
    let nearest: { entityId: number; x: number; y: number; distance: number } | null = null;

    for (const candidateId of nearbyIds) {
      if (candidateId === entityId) continue;
      if (!context.spatial.isAlive(candidateId)) continue;

      const candidateData = context.spatial.getEntityData(candidateId);
      if (!candidateData) continue;

      // Must have health (be a valid target)
      if (!hasHealth(candidateData)) continue;

      // Must be on an opposing team
      const candidateTeam = hasTeam(candidateData) ? candidateData.team : 'neutral';
      if (!this.isOpposingTeam(myTeam, candidateTeam)) continue;

      // Must be on ACTORS layer
      const candidatePos = context.spatial.getEntityPosition(candidateId);
      if (!candidatePos || candidatePos.layer !== GameLayers.ACTORS) continue;

      const distance = Math.abs(candidatePos.x - x) + Math.abs(candidatePos.y - y);
      if (!nearest || distance < nearest.distance) {
        nearest = { entityId: candidateId, x: candidatePos.x, y: candidatePos.y, distance };
      }
    }

    return nearest;
  }

  /**
   * Determine if two teams are opposing.
   */
  private isOpposingTeam(teamA: string, teamB: string): boolean {
    if (teamA === teamB) return false;
    if (teamA === 'neutral' || teamB === 'neutral') return false;
    return true; // player vs enemy
  }

  /**
   * Evaluate what posture the NPC should adopt.
   */
  private evaluatePosture(
    entityData: EntityData & HasNPCBrain,
    target: { entityId: number; distance: number } | null
  ): NPCPosture {
    // No target -> idle
    if (!target) return 'idle';

    // Check HP threshold for retreat
    if (hasHealth(entityData)) {
      const healthData = entityData as EntityData & HasHealth;
      const retreatPct = entityData.retreatHealthPct ?? 0.25;
      const hpRatio = healthData.hp / healthData.maxHp;
      if (hpRatio <= retreatPct) {
        return 'retreating';
      }
    }

    // Use configured posture or default to aggressive
    return entityData.posture ?? 'aggressive';
  }

  /**
   * Apply posture to movement intent fields.
   */
  private applyPostureToMovement(
    entityData: EntityData & HasNPCBrain,
    posture: NPCPosture,
    target: { entityId: number; distance: number } | null
  ): void {
    if (!hasNPCMovement(entityData)) return;
    const movData = entityData as EntityData & HasNPCMovement & HasNPCBrain;

    // Save original movement mode on first brain engagement
    if (posture !== 'idle' && !movData.baseMovementModeBeforeBrain) {
      movData.baseMovementModeBeforeBrain = movData.movementMode;
    }

    switch (posture) {
      case 'aggressive':
        movData.movementMode = 'pursue';
        movData.targetEntityId = target?.entityId;
        movData.triggerRange = movData.threatRange ?? 8;
        movData.giveUpRange = (movData.threatRange ?? 8) + 5;
        movData.aiMovementState = 'active';
        break;

      case 'defensive':
        movData.movementMode = 'follow';
        movData.targetEntityId = target?.entityId;
        movData.minDistance = Math.max(1, (entityData.attackRange ?? 1) - 1);
        movData.maxDistance = (entityData.attackRange ?? 1) + 1;
        break;

      case 'retreating':
        movData.movementMode = 'flee';
        movData.targetEntityId = target?.entityId;
        movData.panicDistance = 1;
        movData.safeDistance = (movData.threatRange ?? 8) + 3;
        movData.aiMovementState = 'active';
        break;

      case 'idle':
        // Restore original movement mode
        if (movData.baseMovementModeBeforeBrain) {
          movData.movementMode = movData.baseMovementModeBeforeBrain as HasNPCMovement['movementMode'];
          movData.baseMovementModeBeforeBrain = undefined;
          movData.aiMovementState = 'idle';
          movData.targetEntityId = undefined;
        }
        break;
    }
  }

  /**
   * Execute attack if target is within attack range.
   */
  private executeAttack(
    context: GameContext,
    entityId: number,
    entityData: EntityData & HasNPCBrain,
    pos: { x: number; y: number },
    target: { entityId: number; x: number; y: number; distance: number },
    attackRange: number,
    currentTick: number
  ): void {
    if (target.distance > attackRange) return;

    const preferRanged = entityData.preferRanged ?? false;
    const canMelee = hasMelee(entityData) && target.distance <= (entityData as EntityData & HasMelee).meleeRange;
    const canRanged = hasWeapon(entityData) && this.hasAmmo(entityData as EntityData & HasWeapon);

    // Determine attack type
    if (preferRanged && canRanged) {
      this.fireRangedAttack(context, entityId, entityData as EntityData & HasWeapon, pos, target, currentTick);
    } else if (canMelee) {
      this.fireMeleeAttack(entityData as EntityData & HasMelee, pos, target, currentTick);
    } else if (canRanged) {
      this.fireRangedAttack(context, entityId, entityData as EntityData & HasWeapon, pos, target, currentTick);
    }
    // else: can't attack, just approach
  }

  /**
   * Set meleeDirection on the entity so MeleeSystem picks it up.
   */
  private fireMeleeAttack(
    entityData: EntityData & HasMelee,
    pos: { x: number; y: number },
    target: { x: number; y: number },
    currentTick: number
  ): void {
    // Respect melee cooldown
    const lastAttack = entityData.lastMeleeAttackTick ?? -Infinity;
    if (currentTick - lastAttack < entityData.meleeCooldown) return;

    const dir = this.directionToTarget(pos.x, pos.y, target.x, target.y);
    if (dir !== Direction.NONE) {
      // Only set direction intent; MeleeSystem stamps lastMeleeAttackTick
      // when it actually executes the attack.
      entityData.meleeDirection = dir;
    }
  }

  /**
   * Spawn a projectile toward the target.
   */
  private fireRangedAttack(
    context: GameContext,
    entityId: number,
    entityData: EntityData & HasWeapon,
    pos: { x: number; y: number },
    target: { x: number; y: number },
    currentTick: number
  ): void {
    const weaponConfig = DEFAULT_WEAPONS[entityData.equippedWeapon];
    if (!weaponConfig) return;

    // Respect weapon cooldown
    const lastFire = entityData.lastFireTick ?? -Infinity;
    if (currentTick - lastFire < weaponConfig.fireRate) return;

    // Cone weapons are player-only for now (skip for NPCs)
    if (weaponConfig.coneSpread !== undefined) return;

    const dir = this.directionToTarget(pos.x, pos.y, target.x, target.y);
    if (dir === Direction.NONE) return;

    const delta = this.directionToDelta(dir);
    const range = weaponConfig.range ?? 10;

    const startX = pos.x + delta.dx;
    const startY = pos.y + delta.dy;
    const targetX = pos.x + delta.dx * range;
    const targetY = pos.y + delta.dy * range;

    this.projectileSystem.spawnProjectile(
      context,
      startX,
      startY,
      targetX,
      targetY,
      weaponConfig.damage,
      {
        speed: weaponConfig.projectileSpeed ?? 2,
        ownerId: entityId,
        damageType: weaponConfig.name,
        color: weaponConfig.projectileColor ?? '#ff8800',
      }
    );

    // Consume ammo
    if (!entityData.unlimitedAmmo) {
      const currentAmmo = entityData.ammo[entityData.equippedWeapon] ?? 0;
      entityData.ammo[entityData.equippedWeapon] = Math.max(0, currentAmmo - weaponConfig.ammoCost);
    }

    // Update cooldown
    entityData.lastFireTick = currentTick;
  }

  /**
   * Check if entity has ammo for its equipped weapon.
   */
  private hasAmmo(entityData: EntityData & HasWeapon): boolean {
    if (entityData.unlimitedAmmo) return true;
    return (entityData.ammo[entityData.equippedWeapon] ?? 0) > 0;
  }

  /**
   * Get cardinal direction from position to target.
   * Picks the axis with the greater delta.
   */
  private directionToTarget(fromX: number, fromY: number, toX: number, toY: number): Direction {
    const dx = toX - fromX;
    const dy = toY - fromY;

    if (dx === 0 && dy === 0) return Direction.NONE;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      return dy > 0 ? Direction.DOWN : Direction.UP;
    }
  }

  /**
   * Convert direction to dx/dy delta.
   */
  private directionToDelta(dir: Direction): { dx: number; dy: number } {
    switch (dir) {
      case Direction.UP: return { dx: 0, dy: -1 };
      case Direction.DOWN: return { dx: 0, dy: 1 };
      case Direction.LEFT: return { dx: -1, dy: 0 };
      case Direction.RIGHT: return { dx: 1, dy: 0 };
      default: return { dx: 0, dy: 0 };
    }
  }

  public override resetState(): void {
    super.resetState();
  }

  public override getDebugState(): Record<string, unknown> {
    return {
      ...super.getDebugState(),
      description: 'NPC Brain System (threat scan, posture, attack coordination)',
    };
  }
}
