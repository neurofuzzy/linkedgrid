export interface BaseEntityData {
  id: number;
  type: string;
  sceneId: string;
  // Entity-specific properties should be defined in entity interfaces.
  // Removed broad index signature to enforce type safety.
}
