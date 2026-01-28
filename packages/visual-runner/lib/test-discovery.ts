import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';

export interface TestFile {
  file: string;
  path: string;
  tests: string[];
  category: string;
}

export async function discoverTests(): Promise<TestFile[]> {
  const rootDir = path.resolve(process.cwd(), 'packages');
  const pattern = '**/test/*.visual.test.ts';

  const files = await glob(pattern, { cwd: rootDir });

  const tests = await Promise.all(
    files.map(async (file) => {
      const fullPath = path.join(rootDir, file);
      const content = await fs.readFile(fullPath, 'utf-8');

      // Parse visual() calls - handles escaped quotes and flexible whitespace
      const visualRegex = /visual\s*\(\s*(['"])(.*?)(?<!\\)\1\s*,/gs;
      const matches = [...content.matchAll(visualRegex)];

      // Extract category from filename
      // e.g., "movement.visual.test.ts" → "Movement"
      // e.g., "scene-transition.visual.test.ts" → "Scenes"
      const filename = path.basename(file, '.visual.test.ts');
      let category = filename
        .split(/[-.]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Map specific categories
      if (filename.includes('scene')) category = 'Scenes';
      if (filename.includes('layer')) category = 'Layers';
      if (filename.includes('movement')) category = 'Movement';
      if (filename.includes('assertion')) category = 'Assertions';

      return {
        file,
        path: fullPath,
        tests: matches.map((m) => m[2]),
        category,
      };
    })
  );

  return tests.filter((t) => t.tests.length > 0);
}
