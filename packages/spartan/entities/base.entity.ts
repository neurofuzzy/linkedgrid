export interface BaseEntityData {
  id: number;
  type: string;
  sceneId: string;
  [key: string]: string | number | boolean | undefined;
}
