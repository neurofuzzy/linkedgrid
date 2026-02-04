/**
 * @brief Teleporter entity definitions.
 */
import { BaseEntityData } from './base.entity';
import { HasTeleportTarget, HasSceneLocation, HasSceneConnection } from '../traits';

/**
 * TeleporterData - Teleporter entity with connection key support.
 *
 * Supports two teleportation modes:
 * 1. connectionKey (preferred) - Registered in GameState.connections for color-coded portals
 * 2. destination (legacy) - Direct destination for backward compatibility
 *
 * @example Connection key format (preferred):
 * ```json
 * {
 *   "type": "teleporter",
 *   "x": 5, "y": 5, "layer": 1,
 *   "data": {
 *     "connectionKey": "red",
 *     "targetKey": "red"
 *   }
 * }
 * ```
 *
 * @example Direct destination format (legacy):
 * ```json
 * {
 *   "type": "teleporter",
 *   "x": 5, "y": 5, "layer": 1,
 *   "data": {
 *     "destination": { "sceneId": "room2", "x": 10, "y": 10, "layer": 1 },
 *     "targetKey": "portal-1"
 *   }
 * }
 * ```
 */
export type TeleporterData = BaseEntityData & {
  type: 'teleporter';
  /**
   * Direct destination (legacy format).
   * Deprecated: Use connectionKey instead.
   */
  destination?: {
    sceneId: string;
    x: number;
    y: number;
    layer: number;
  };
  teleporterState?: 'ready' | 'inactive';
} & HasTeleportTarget &
  HasSceneLocation &
  Partial<HasSceneConnection>;
