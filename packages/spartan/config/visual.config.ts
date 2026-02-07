/**
 * Visual State Presets Configuration
 *
 * Standard visual state names and effect presets for the visual system.
 * These are conventions -- entities may use custom state names.
 *
 * Visual state names map to sprite sheet rows.
 * Effect preset names map to particle/rendering configurations in view layers.
 */

/**
 * Standard visual state names.
 *
 * Systems use these strings when setting entity visual states.
 * View layers map these to sprite sheet rows.
 */
export const VISUAL_STATE_PRESETS = {
  /** Default resting state */
  IDLE: 'idle',
  /** Moving/walking */
  WALK: 'walk',
  /** Melee or ranged attack in progress */
  ATTACK: 'attack',
  /** Taking damage (brief flash/flinch) */
  HURT: 'hurt',
  /** Death animation playing (entity in 'dying' healthState) */
  DIE: 'die',
  /** Special action (powerup, charge, etc.) */
  SPECIAL: 'special',
  /** Frozen/stunned state (entity cannot move or act) */
  FROZEN: 'frozen',
} as const;

export type VisualStatePreset = (typeof VISUAL_STATE_PRESETS)[keyof typeof VISUAL_STATE_PRESETS];

/**
 * Standard effect preset names.
 *
 * Systems push these to EffectsQueue as particle preset names.
 * View layers implement the actual rendering.
 */
export const EFFECT_PRESETS = {
  /** Large burst, orange/red particles -- ExplosionSystem detonation */
  EXPLOSION: 'explosion',
  /** Small sparkle, white/yellow -- melee hit, projectile impact */
  SPARK: 'spark',
  /** Red droplet spray -- entity taking damage */
  BLOOD: 'blood',
  /** Gray/white puffs -- entity death, fire aftermath */
  SMOKE: 'smoke',
  /** Orange/red flickers -- fire ignition */
  FIRE: 'fire',
  /** Green upward particles -- health restore */
  HEAL: 'heal',
  /** Gold sparkle -- item pickup */
  COLLECT: 'collect',
  /** White flash burst -- player respawn */
  RESPAWN: 'respawn',
  /** Purple swirl -- teleporter activation */
  PORTAL: 'portal',
  /** Blue/cyan ice particles -- freeze/stun applied */
  FREEZE: 'freeze',
} as const;

export type EffectPreset = (typeof EFFECT_PRESETS)[keyof typeof EFFECT_PRESETS];

/**
 * Layer assignments for visual effects.
 *
 * Documents which layer visual effects should be placed on.
 * View layers use these when spawning ephemeral entities or overlays.
 */
export const VISUAL_LAYERS = {
  /** Explosion visuals, fire visuals, projectiles */
  EFFECTS: 7, // GameLayers.EPHEMERALS
  /** Ash, scorch marks */
  FLOOR_EFFECTS: 2, // GameLayers.FLOOR_EFFECTS
  /** HUD, damage numbers, status text */
  UI_OVERLAY: 8, // GameLayers.TEXT
} as const;
