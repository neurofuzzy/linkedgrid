export interface BaseEntityData {
  id: number;
  type: string;
  sceneId: string;
  // Index signature allows entity types to be compatible with Record<string, unknown>
  // while still preserving type-safe property access via intersection types.
  [key: string]: unknown;
}
