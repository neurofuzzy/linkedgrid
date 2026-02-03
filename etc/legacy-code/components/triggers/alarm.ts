/**
 * @component Alarm
 * @icon bell
 * @description Detects intruders and alerts nearby entities (security, sensors)
 * 
 * Alarm Components
 * 
 * Alarm systems that detect intruders and alert nearby entities.
 * 
 * Examples:
 * - Security alarms that alert guards
 * - Sensor towers that trigger defenses
 * - Beacons that activate reinforcements
 * 
 * @property {number} detectionRadius - Detection radius
 * @property {number} alertRadius - Alert radius (how far signal reaches)
 * @property {boolean} triggered - Whether alarm is currently triggered
 * @property {string[]} triggerTags - Tags of entities that can trigger alarm
 * @property {string[]} alertTags - Tags of entities that should be alerted
 * @property {number} cooldown - Alarm cooldown after being triggered (ticks)
 * @property {number} cooldownTimer - Cooldown timer
 * @property {boolean} persistent - Whether alarm stays triggered or auto-resets
 */

import { defineComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export interface Alarm {
  /** Detection radius */
  detectionRadius: number;
  
  /** Alert radius (how far the alarm signal reaches) */
  alertRadius: number;
  
  /** Whether the alarm is currently triggered */
  triggered: boolean;
  
  /** Tags of entities that can trigger the alarm */
  triggerTags?: string[];
  
  /** Tags of entities that should be alerted */
  alertTags?: string[];
  
  /** Optional: Alarm cooldown after being triggered (in ticks) */
  cooldown?: number;
  
  /** Internal: Cooldown timer */
  cooldownTimer?: number;
  
  /** Optional: Callback when alarm triggers */
  onTrigger?: (alarm: Entity, intruder: Entity) => void;
  
  /** Optional: Callback when alarm resets */
  onReset?: (alarm: Entity) => void;
  
  /** Whether alarm stays triggered (toggle) or auto-resets */
  persistent?: boolean;
}

export const AlarmComponent = defineComponent<Alarm>();

/**
 * @component Alertable
 * @icon alert-triangle
 * @description Can be alerted by alarm systems (guards, defenses)
 * 
 * Alertable Component
 * 
 * Marks entities that can be alerted by alarms.
 * 
 * @property {boolean} alerted - Whether this entity is currently alerted
 * @property {number} alertDuration - How long to stay alerted after signal ends (ticks)
 * @property {number} alertTimer - Alert timer
 * @property {string[]} respondToTags - Tags to respond to (if undefined, responds to all)
 */
export interface Alertable {
  /** Whether this entity is currently alerted */
  alerted: boolean;
  
  /** Optional: How long to stay alerted after signal ends (in ticks) */
  alertDuration?: number;
  
  /** Internal: Alert timer */
  alertTimer?: number;
  
  /** Optional: Callback when alerted */
  onAlert?: (entity: Entity, alarm: Entity) => void;
  
  /** Optional: Callback when alert ends */
  onAlertEnd?: (entity: Entity) => void;
  
  /** Tags to respond to (if undefined, responds to all alarms) */
  respondToTags?: string[];
}

export const AlertableComponent = defineComponent<Alertable>();
