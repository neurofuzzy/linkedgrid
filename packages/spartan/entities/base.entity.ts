export interface BaseEntityData {
  id: number;
  type: string;
  sceneId: string;
  // Allow primitives, arrays, and objects for flexible entity data
  [key: string]: string | number | boolean | undefined | unknown[] | Record<string, unknown>;
}
