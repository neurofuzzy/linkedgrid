/**
 * HasSceneConnection - Cross-scene portal/connection trait
 *
 * Entities with this trait are registered in GameState.connections
 * during initialization, enabling color-coded multi-scene connections.
 *
 * @example
 * ```typescript
 * const teleporter: TeleporterData = {
 *   id: 1,
 *   type: 'teleporter',
 *   connectionKey: 'red',
 *   sceneId: 'room1',
 *   targetKey: 'red',
 * };
 * ```
 */
export interface HasSceneConnection {
  /**
   * Connection key for cross-scene portals.
   * Entities with matching keys are connected endpoints.
   * Example: "red", "blue", "green", "portal-alpha"
   */
  connectionKey: string;
}
