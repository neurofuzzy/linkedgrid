export interface Snapshot {
  operation: string;
  args: unknown[];
  result: unknown;

  // Scene information (optional for backward compatibility)
  sceneId?: string;
  sceneName?: string;

  entities: Array<{
    id: number;
    type: string;
    x: number;
    y: number;
    layer: number;
  }>;
  grid: { w: number; h: number };
}

export interface TestFile {
  file: string;
  path: string;
  tests: string[];
}
