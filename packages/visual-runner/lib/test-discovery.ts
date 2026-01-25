import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';

export interface TestFile {
  file: string;
  path: string;
  tests: string[];
}

export async function discoverTests(): Promise<TestFile[]> {
  const rootDir = path.resolve(process.cwd(), 'packages');
  const pattern = '**/test/*.visual.test.ts';
  
  const files = await glob(pattern, { cwd: rootDir });
  
  const tests = await Promise.all(
    files.map(async (file) => {
      const fullPath = path.join(rootDir, file);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Parse visual() calls
      const visualRegex = /visual\(['"](.+?)['"],/g;
      const matches = [...content.matchAll(visualRegex)];
      
      return {
        file,
        path: fullPath,
        tests: matches.map(m => m[1])
      };
    })
  );
  
  return tests.filter(t => t.tests.length > 0);
}
