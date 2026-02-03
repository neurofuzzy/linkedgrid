/**
 * Alarm System
 * 
 * Manages alarm entities that detect intruders and alert nearby entities.
 * Uses LinkedGrid distance propagation for alert radius.
 */

import { System } from '@basegrid/ecs';
import { AlarmComponent, AlertableComponent } from '@basegrid/gameplay';
import { GridPositionComponent, TypeComponent } from '@basegrid/ecs';
import type { Entity } from '@basegrid/ecs';

export class AlarmSystem extends System {
  update(_dt: number): void {
    // Check for intruders and trigger alarms
    for (const [alarmEntity, alarm] of this.world.query(AlarmComponent)) {
      if (alarm.triggered && !alarm.persistent) {
        // Non-persistent alarms can reset (would need external reset trigger)
        continue;
      }

      const alarmPos = this.world.getComponent(alarmEntity, GridPositionComponent);
      if (!alarmPos) continue;

      // Handle cooldown
      if (alarm.cooldownTimer && alarm.cooldownTimer > 0) {
        alarm.cooldownTimer--;
        continue;
      }

      // Check for intruders in detection radius
      for (const [entity] of this.world.query(GridPositionComponent)) {
        if (entity === alarmEntity) continue;

        const entityPos = this.world.getComponent(entity, GridPositionComponent);
        if (!entityPos || entityPos.grid !== alarmPos.grid) continue;

        // Check tag filtering
        if (alarm.triggerTags && alarm.triggerTags.length > 0) {
          const entityType = this.world.getComponent(entity, TypeComponent);
          const entityTags = entityType?.tags || [];
          const hasMatchingTag = entityTags.some(tag => alarm.triggerTags!.includes(tag));
          if (!hasMatchingTag) continue;
        }

        // Calculate distance
        const distance = Math.abs(entityPos.x - alarmPos.x) + Math.abs(entityPos.y - alarmPos.y);

        if (distance <= alarm.detectionRadius && !alarm.triggered) {
          // Trigger alarm!
          alarm.triggered = true;

          if (alarm.onTrigger) {
            alarm.onTrigger(alarmEntity, entity);
          }

          // Start cooldown if specified
          if (alarm.cooldown) {
            alarm.cooldownTimer = alarm.cooldown;
          }

          break; // One intruder is enough
        }
      }

      // If alarm is triggered, alert nearby entities
      if (alarm.triggered) {
        this.propagateAlert(alarmEntity, alarm);
      }
    }

    // Update alertable entities
    for (const [entity, alertable] of this.world.query(AlertableComponent)) {
      if (alertable.alerted && alertable.alertTimer !== undefined) {
        alertable.alertTimer--;

        if (alertable.alertTimer <= 0) {
          alertable.alerted = false;
          alertable.alertTimer = undefined;

          if (alertable.onAlertEnd) {
            alertable.onAlertEnd(entity);
          }
        }
      }
    }
  }

  /**
   * Propagate alert to nearby alertable entities
   */
  private propagateAlert(alarmEntity: Entity, alarm: AlarmComponent): void {
    const alarmPos = this.world.getComponent(alarmEntity, GridPositionComponent);
    if (!alarmPos) return;

    // Find alertable entities within alert radius
    for (const [entity, alertable] of this.world.query(AlertableComponent)) {
      const entityPos = this.world.getComponent(entity, GridPositionComponent);
      if (!entityPos || entityPos.grid !== alarmPos.grid) continue;

      // Check tag filtering
      if (alarm.alertTags && alarm.alertTags.length > 0) {
        const entityType = this.world.getComponent(entity, TypeComponent);
        const entityTags = entityType?.tags || [];
        const hasMatchingTag = entityTags.some(tag => alarm.alertTags!.includes(tag));
        if (!hasMatchingTag) continue;
      }

      // Calculate distance using LinkedGrid (respects walls)
      const alarmCell = alarmPos.grid.cell(alarmPos.x, alarmPos.y);
      if (!alarmCell) continue;

      // Use setDistance to calculate pathfinding distance
      // Note: This is done every frame but could be optimized with caching
      for (const cell of alarmPos.grid.cells) {
        cell.distances[0] = -1;
      }

      alarmCell.setDistance(
        (c) => true, // Allow all cells (could add wall blocking)
        0, 0, false, alarm.alertRadius
      );

      const entityCell = entityPos.grid.cell(entityPos.x, entityPos.y);
      if (!entityCell) continue;

      const distance = entityCell.distances[0];
      if (distance !== undefined && distance >= 0 && distance <= alarm.alertRadius) {
        if (!alertable.alerted) {
          alertable.alerted = true;

          if (alertable.alertDuration) {
            alertable.alertTimer = alertable.alertDuration;
          }

          if (alertable.onAlert) {
            alertable.onAlert(entity, alarmEntity);
          }
        } else if (alertable.alertDuration && alertable.alertTimer !== undefined) {
          // Keep alert timer refreshed while alarm is active (continuous alert)
          alertable.alertTimer = alertable.alertDuration;
        }
      }
    }
  }

  /**
   * Manually reset an alarm
   */
  resetAlarm(alarmEntity: Entity): void {
    const alarm = this.world.getComponent(alarmEntity, AlarmComponent);
    if (!alarm) return;

    alarm.triggered = false;
    alarm.cooldownTimer = undefined;

    if (alarm.onReset) {
      alarm.onReset(alarmEntity);
    }
  }
}
