
import * as fs from 'fs';
import * as path from 'path';
// We use integer codes to avoid importing the huge TypeDoc package at runtime if possible, 
// but importing 'typedoc' is cleaner if available. 
// However, to keep it fast/simple, I'll define the needed enum subset.
// Reference: https://typedoc.org/api/enums/ReflectionKind.html

enum ReflectionKind {
  Enum = 4,
  Function = 64,
  Variable = 32,
  Class = 128,
  Interface = 256,
  TypeAlias = 4194304,
}

const docsPath = process.argv[2];
const targetDir = process.argv[3];
const rootDir = process.cwd();

if (!docsPath || !targetDir) {
  console.error('Usage: tsx generate-map.ts <docs.json> <target-dir>');
  process.exit(1);
}

// Load TypeDoc JSON
const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));

// Build Lookup Map: FileName -> Exported Items
const exportsByFile = new Map<string, any[]>();

function indexChildren(children: any[]) {
  if (!children) return;
  for (const child of children) {
    if (child.sources && child.sources.length > 0) {
      const filePath = child.sources[0].fileName;
      if (!exportsByFile.has(filePath)) {
        exportsByFile.set(filePath, []);
      }
      exportsByFile.get(filePath).push(child);
    }
    // Recurse for namespaces if needed, but top-level exports are usually flattened 
    // depending on conversion. We'll stick to top-level for now.
  }
}
indexChildren(docs.children);


interface FileStats {
  fileCount: number;
  totalLoc: number;
}
const stats: FileStats = { fileCount: 0, totalLoc: 0 };
const outputBuffer: string[] = [];
function log(msg: string) { outputBuffer.push(msg); }
function countLines(content: string) { return content.split(/\r\n|\r|\n/).length; }

function processDirectory(dir: string, depth: number = 0) {
  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.error(`Error reading ${dir}`, e);
    return;
  }

  // Sort: Directories first, then files (alphabetical)
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name.startsWith('.') || item.name === 'node_modules') continue;
      log(`${'  '.repeat(depth)}- **/${item.name}**`);
      processDirectory(fullPath, depth + 1);
    } else if (item.isFile() && item.name.endsWith('.ts') && !item.name.endsWith('.d.ts')) {
      processFile(fullPath, item.name, depth);
    }
  }
}

function processFile(fullPath: string, fileName: string, depth: number) {
  stats.fileCount++;
  const content = fs.readFileSync(fullPath, 'utf-8');
  stats.totalLoc += countLines(content);

  // Relative path for link
  // Assuming we run from repo root
  const relativePath = path.relative(rootDir, fullPath);

  // Attempt to match with TypeDoc source
  // TypeDoc sources are relative to packages/spartan/ usually, or whatever the entry point tree was?
  // In the JSON we saw "core/grid/direction.ts".
  // If fullPath is "/Users/.../packages/spartan/core/grid/direction.ts"
  // and targetDir is "packages/spartan"
  // Then we can try to match the end of the string.

  let docItems: any[] = [];

  // Simple suffix match because path normalization is distinct
  // We expect "core/grid/direction.ts" in map
  // We have "packages/spartan/core/grid/direction.ts"

  for (const [key, items] of exportsByFile.entries()) {
    // key might be "core/grid/...", fullPath ends with it?
    // or key might include packages/spartan if typedoc was run from root
    // Inspecting the previous output: "fileName": "core/grid/direction.ts"
    // Since we provided packages/spartan as targetDir, we can check relative check.

    // This is a naive check but robust for this structure
    if (fullPath.endsWith(key)) {
      docItems = items;
      break;
    }
  }

  // Extract Description (from TypeDoc first, else fallback?)
  // Actually TypeDoc only has comments on *Exported* items.
  // The previous script parsed the file header comment.
  // TypeDoc JSON doesn't index the *File* itself unless it's a module reflection with comment.
  // We'll peek manually for the @brief description like the old script because it's valuable
  // and TypeDoc might associate it with the first export or module, which is harder to find consistently.
  // Using a regex for header comment is cheap and low-maintenance.

  const desc = extractHeaderDescription(content);
  const descStr = desc ? ` - ${desc}` : '';

  log(`${'  '.repeat(depth)}- [${fileName}](../${relativePath})${descStr}`);

  if (docItems && docItems.length > 0) {
    for (const item of docItems) {
      printExportItem(item, depth + 1);
    }
  }
}

function extractHeaderDescription(content: string): string | null {
  // Quick parse for leading JSDoc
  const match = content.match(/^\s*\/\*\*([\s\S]*?)\*\//);
  if (!match) return null;
  const comment = match[1];

  // Look for @brief or @description or just text
  const lines = comment.split('\n').map(l => l.replace(/^\s*\*\s?/, '').trim()).filter(l => l);

  let brief = lines.find(l => l.startsWith('@brief') || l.startsWith('@description'));
  if (brief) {
    return truncate(brief.replace(/^@(brief|description)\s+/, ''));
  }
  // Fallback: first non-tag line
  const text = lines.find(l => !l.startsWith('@'));
  if (text) return truncate(text);
  return null;
}

function truncate(str: string) {
  return str.length > 50 ? str.substring(0, 47) + '...' : str;
}

function printExportItem(item: any, depth: number) {
  const indent = '  '.repeat(depth);
  let kindLabel = '';
  let extra = '';

  if (item.kind === ReflectionKind.Class) {
    kindLabel = 'Class';
    // Methods
    const methods = item.children?.filter((c: any) =>
      (c.kind === 2048) && // Method
      !c.flags?.isPrivate && !c.flags?.isProtected && !c.flags?.isExternal
    ).map((m: any) => m.name);

    if (methods && methods.length > 0) {
      extra = ` (Methods: ${methods.join(', ')})`;
    }
  } else if (item.kind === ReflectionKind.Interface) {
    kindLabel = 'Interface';
  } else if (item.kind === ReflectionKind.Enum) {
    kindLabel = 'Enum';
  } else if (item.kind === ReflectionKind.Function) {
    kindLabel = 'Function';
  } else if (item.kind === ReflectionKind.Variable) {
    kindLabel = 'Variable';
  } else if (item.kind === ReflectionKind.TypeAlias) {
    kindLabel = 'Type';
  } else {
    // Skip unknown or minor things
    return;
  }

  log(`${indent}- ${kindLabel}: \`${item.name}\`${extra}`);
}


processDirectory(targetDir);

// Header
const now = new Date();
const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);

console.log('```');
console.log(`# Auto-generated project map`);
console.log(`# Last updated: ${dateStr}`);
console.log(`# Files: ${stats.fileCount}`);
console.log(`# Lines of code: ~${stats.totalLoc}`);
console.log('```');
console.log(outputBuffer.join('\n'));

