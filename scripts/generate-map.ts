import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const targetDir = process.argv[2] || '.';
const rootDir = process.cwd();

interface FileStats {
  fileCount: number;
  totalLoc: number;
}

const stats: FileStats = { fileCount: 0, totalLoc: 0 };
const outputBuffer: string[] = [];

function log(msg: string) {
  outputBuffer.push(msg);
}

function countLines(content: string): number {
  return content.split(/\r\n|\r|\n/).length;
}

function processDirectory(dir: string, depth: number = 0) {
  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.error(`Error reading ${dir}`, e);
    return;
  }

  // Sort: Directories first, then files
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
    } else if (
      item.isFile() &&
      item.name.endsWith('.ts') &&
      !item.name.endsWith('.d.ts')
    ) {
      processFile(fullPath, item.name, depth);
    }
  }
}

function processFile(fullPath: string, fileName: string, depth: number) {
  stats.fileCount++;
  const content = fs.readFileSync(fullPath, 'utf-8');
  stats.totalLoc += countLines(content);

  const relativePath = path.relative(rootDir, fullPath);
  const desc = extractHeaderDescription(content);
  const descStr = desc ? ` - ${desc}` : '';

  log(`${'  '.repeat(depth)}- [${fileName}](../${relativePath})${descStr}`);

  // Parse TypeScript exports
  const exports = parseExports(content, fullPath);
  if (exports.length > 0) {
    for (const exp of exports) {
      printExport(exp, depth + 1);
    }
  }
}

interface Export {
  kind: 'class' | 'interface' | 'type' | 'function' | 'variable' | 'enum';
  name: string;
  methods?: string[];
  properties?: string[];
  comment?: string;
}

function parseExports(content: string, filePath: string): Export[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const exports: Export[] = [];

  function visit(node: ts.Node) {
    // Check if exported
    const isExported = node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword
    );

    if (!isExported) {
      ts.forEachChild(node, visit);
      return;
    }

    if (ts.isClassDeclaration(node) && node.name) {
      const methods: string[] = [];
      node.members.forEach((member) => {
        if (ts.isMethodDeclaration(member) && member.name) {
          const name = member.name.getText(sourceFile);
          if (!name.startsWith('_')) {
            // Skip private
            methods.push(name);
          }
        }
      });

      exports.push({
        kind: 'class',
        name: node.name.text,
        methods: methods.length > 0 ? methods : undefined,
        comment: getComment(node, sourceFile),
      });
    } else if (ts.isInterfaceDeclaration(node)) {
      exports.push({
        kind: 'interface',
        name: node.name.text,
        comment: getComment(node, sourceFile),
      });
    } else if (ts.isTypeAliasDeclaration(node)) {
      exports.push({
        kind: 'type',
        name: node.name.text,
        comment: getComment(node, sourceFile),
      });
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      exports.push({
        kind: 'function',
        name: node.name.text,
        comment: getComment(node, sourceFile),
      });
    } else if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((decl) => {
        if (ts.isIdentifier(decl.name)) {
          exports.push({
            kind: 'variable',
            name: decl.name.text,
            comment: getComment(node, sourceFile),
          });
        }
      });
    } else if (ts.isEnumDeclaration(node)) {
      exports.push({
        kind: 'enum',
        name: node.name.text,
        comment: getComment(node, sourceFile),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exports;
}

function getComment(
  node: ts.Node,
  sourceFile: ts.SourceFile
): string | undefined {
  const fullText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());

  if (!ranges || ranges.length === 0) return undefined;

  const lastComment = ranges[ranges.length - 1];
  const commentText = fullText.slice(lastComment.pos, lastComment.end);

  // Extract text from JSDoc
  const cleaned = commentText
    .replace(/^\/\*\*|\*\/$/g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter((line) => line && !line.startsWith('@'))
    .join(' ')
    .trim();

  return cleaned ? truncate(cleaned, 50) : undefined;
}

function extractHeaderDescription(content: string): string | null {
  const match = content.match(/^\s*\/\*\*([\s\S]*?)\*\//);
  if (!match) return null;

  const lines = match[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .filter((l) => l);

  const brief = lines.find(
    (l) => l.startsWith('@brief') || l.startsWith('@description')
  );
  if (brief) {
    return truncate(brief.replace(/^@(brief|description)\s+/, ''), 50);
  }

  const text = lines.find((l) => !l.startsWith('@'));
  return text ? truncate(text, 50) : null;
}

function truncate(str: string, maxLen: number = 50): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

function printExport(exp: Export, depth: number) {
  const indent = '  '.repeat(depth);
  const kindLabel = exp.kind.charAt(0).toUpperCase() + exp.kind.slice(1);

  let extra = '';
  if (exp.methods && exp.methods.length > 0) {
    extra = ` (Methods: ${exp.methods.join(', ')})`;
  }

  const comment = exp.comment ? ` - ${exp.comment}` : '';
  log(`${indent}- ${kindLabel}: \`${exp.name}\`${extra}${comment}`);
}

// Run
processDirectory(targetDir);

// Print header
const now = new Date();
const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);

console.log('```');
console.log(`# Auto-generated project map`);
console.log(`# Last updated: ${dateStr}`);
console.log(`# Files: ${stats.fileCount}`);
console.log(`# Lines of code: ~${stats.totalLoc}`);
console.log('```');
console.log(outputBuffer.join('\n'));
