export interface CanDealDamage {
  damage: number;
}

export interface HasDamageable {
  hardness: number; // Minimum damage required to hurt this entity
}

export interface HasExplosion {
  explosionDamage: number;      // Base damage at epicenter
  explosionRadius: number;      // Radius of effect (used with fieldOfView)
  triggerCondition?: 'on-death' | 'on-fire' | 'manual'; // Default: 'on-death'
}
