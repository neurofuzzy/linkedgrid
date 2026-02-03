/**
 * Role and Team Traits
 *
 * Defines entity roles (player, NPC) and team affiliations.
 * Used by systems to distinguish between player-controlled entities,
 * friendly NPCs, and hostile entities.
 */

/**
 * Team affiliations for entities.
 * - player: The player's team (allies, rescuable NPCs)
 * - enemy: Hostile entities
 * - neutral: Non-aligned entities (environmental hazards, obstacles)
 */
export type Team = 'player' | 'enemy' | 'neutral';

/**
 * HasPlayerRole - Marks the player-controlled entity.
 *
 * Only one entity should have this trait at a time.
 * Used by systems that need to find or reference the player.
 *
 * @example
 * ```typescript
 * const playerData: HasPlayerRole = {
 *   isPlayer: true,
 * };
 * ```
 */
export interface HasPlayerRole {
  /** True if this is the player-controlled entity */
  isPlayer: true;
}

/**
 * HasTeam - Team affiliation for entities.
 *
 * Used to distinguish between allies and enemies.
 * NPCs with team 'player' could be rescuable or allied.
 *
 * @example
 * ```typescript
 * // Enemy guard
 * const enemyData: HasTeam = {
 *   team: 'enemy',
 * };
 *
 * // Rescuable NPC
 * const rescuableData: HasTeam = {
 *   team: 'player',
 * };
 *
 * // Neutral hazard
 * const hazardData: HasTeam = {
 *   team: 'neutral',
 * };
 * ```
 */
export interface HasTeam {
  /** Team affiliation */
  team: Team;
}
