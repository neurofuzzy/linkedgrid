export interface Snapshot {
  operation: string;
  args: unknown[];
  result: unknown;
  entities: Array<{
    id: number;
    type: string;
    x: number;
    y: number;
  }>;
  grid: { w: number; h: number };
}

export interface TestFile {
  file: string;
  path: string;
  tests: string[];
}
