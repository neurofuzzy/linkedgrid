/**
 * Character Persona Configuration
 *
 * Defines preset character templates for players and NPCs.
 * Personas bundle stats (hp, armor, damage, speed, etc.) into
 * reusable archetypes that can be applied at spawn time.
 *
 * The Player persona is the superset - most flexible and composable.
 * NPC personas are tiered (1-4) with increasing stats.
 */
import type { NPCMovementMode } from '../traits/npc-movement.trait';

/**
 * CharacterPersona - Character stat template.
 *
 * Defines the default stats for a character archetype.
 * All properties are optional; spawn helpers merge persona
 * defaults with per-instance overrides.
 *
 * @example
 * ```typescript
 * const grunt = CHARACTER_PERSONAS['grunt'];
 * // { hp: 30, damage: 5, speed: 3, scoreValue: 10, tier: 1 }
 * ```
 */
export interface CharacterPersona {
  /** Display name for the persona */
  name: string;
  /** Tier level (1=grunt, 2=soldier, 3=elite, 4=boss). Player has no tier. */
  tier?: number;
  /** Hit points */
  hp: number;
  /** Maximum hit points (defaults to hp if not set) */
  maxHp?: number;
  /** Flat damage reduction */
  armor?: number;
  /** Minimum damage required to hurt this entity */
  hardness?: number;
  /** Contact damage dealt on overlap */
  damage?: number;
  /** Melee attack damage */
  meleeDamage?: number;
  /** Melee attack cooldown in ticks */
  meleeCooldown?: number;
  /** Melee attack range in cells */
  meleeRange?: number;
  /** Shield points */
  shield?: number;
  /** Maximum shield points */
  maxShield?: number;
  /** Movement speed (ticks between moves). 1=fast, 2=medium, 4=slow */
  speed?: number;
  /** Default NPC movement mode */
  movementMode?: NPCMovementMode;
  /** Points awarded when killed */
  scoreValue?: number;
  /** Percentage damage reduction (0-1) */
  resistance?: number;
  /** Default entity color */
  color?: string;
}

/**
 * Built-in character personas.
 *
 * Tiered NPC presets with increasing difficulty:
 * - Tier 1 (grunt): Low stats, cannon fodder
 * - Tier 2 (soldier): Moderate stats, standard combatant
 * - Tier 3 (elite): High stats with armor and hardness
 * - Tier 4 (boss): Very high stats with shields
 *
 * Player persona defines baseline player character stats.
 */
export const CHARACTER_PERSONAS: Record<string, CharacterPersona> = {
  // === PLAYER ===
  'player-default': {
    name: 'Player',
    hp: 100,
    armor: 0,
    damage: 10,
    meleeDamage: 25,
    meleeCooldown: 3,
    meleeRange: 1,
    speed: 1,
    color: '#00aaff',
  },

  // === NPC TIERS ===
  'grunt': {
    name: 'Grunt',
    tier: 1,
    hp: 30,
    damage: 5,
    speed: 3,
    movementMode: 'pursue',
    scoreValue: 10,
    color: '#ff4444',
  },

  'soldier': {
    name: 'Soldier',
    tier: 2,
    hp: 60,
    armor: 2,
    damage: 10,
    speed: 2,
    movementMode: 'pursue',
    scoreValue: 25,
    color: '#ff8800',
  },

  'elite': {
    name: 'Elite',
    tier: 3,
    hp: 100,
    armor: 5,
    hardness: 3,
    damage: 15,
    meleeDamage: 20,
    meleeCooldown: 4,
    meleeRange: 1,
    speed: 2,
    movementMode: 'pursue',
    scoreValue: 50,
    color: '#cc00cc',
  },

  'boss': {
    name: 'Boss',
    tier: 4,
    hp: 200,
    armor: 10,
    hardness: 5,
    damage: 25,
    meleeDamage: 35,
    meleeCooldown: 5,
    meleeRange: 1,
    shield: 50,
    maxShield: 50,
    speed: 1,
    movementMode: 'pursue',
    scoreValue: 100,
    resistance: 0.1,
    color: '#ff0000',
  },
};

/**
 * Get a character persona by name.
 *
 * @param name - Persona name (e.g., 'grunt', 'soldier', 'elite', 'boss')
 * @returns CharacterPersona or undefined if not found
 */
export function getPersona(name: string): CharacterPersona | undefined {
  return CHARACTER_PERSONAS[name];
}
