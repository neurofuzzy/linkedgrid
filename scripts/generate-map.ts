import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Please provide a directory path');
  process.exit(1);
}

interface FileStats {
  fileCount: number;
  totalLoc: number;
}

const stats: FileStats = {
  fileCount: 0,
  totalLoc: 0,
};

const outputBuffer: string[] = [];

function log(message: string) {
  outputBuffer.push(message);
}

function countLines(content: string): number {
  return content.split(/\r\n|\r|\n/).length;
}

function extractFileDescription(sourceFile: ts.SourceFile): string | null {
  const fileText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(fileText, 0);

  if (ranges && ranges.length > 0) {
    const firstComment = ranges[0];
    const commentContent = fileText.substring(
      firstComment.pos,
      firstComment.end
    );

    // Simple extraction of JSDoc text content (removing /**, */, *, and @tags)
    // Prefer @brief or @description if present
    const cleanLines = commentContent
      .replace(/\/\*\*|\*\/|\*/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let description = '';

    // Look for @brief or @description
    const explicitTag = cleanLines.find(
      (line) => line.startsWith('@brief') || line.startsWith('@description')
    );
    if (explicitTag) {
      description = explicitTag.replace(/@brief|@description/, '').trim();
    } else if (cleanLines.length > 0) {
      // Otherwise take the first non-tag line
      const firstText = cleanLines.find((line) => !line.startsWith('@'));
      if (firstText) description = firstText;
    }

    if (description) {
      return description.length > 50
        ? description.substring(0, 47) + '...'
        : description;
    }
  }
  return null;
}

function getExportedMembers(sourceFile: ts.SourceFile): string[] {
  const exports: string[] = [];

  function visit(node: ts.Node) {
    const isExported = (node as any).modifiers?.some(
      (m: any) => m.kind === ts.SyntaxKind.ExportKeyword
    );

    if (isExported || ts.isExportAssignment(node)) {
      if (ts.isClassDeclaration(node)) {
        const className = node.name?.text || 'default';
        const methods: string[] = [];
        node.members.forEach((member) => {
          if (
            ts.isMethodDeclaration(member) &&
            member.name &&
            ts.isIdentifier(member.name)
          ) {
            const isPrivate = (member as any).modifiers?.some(
              (m: any) => m.kind === ts.SyntaxKind.PrivateKeyword
            );
            const isProtected = (member as any).modifiers?.some(
              (m: any) => m.kind === ts.SyntaxKind.ProtectedKeyword
            );
            if (!isPrivate && !isProtected) {
              methods.push(member.name.text);
            }
          }
        });
        const methodStr =
          methods.length > 0 ? ` (Methods: ${methods.join(', ')})` : '';
        exports.push(`Class: \`${className}\`${methodStr}`);
      } else if (ts.isInterfaceDeclaration(node) && node.name) {
        exports.push(`Interface: \`${node.name.text}\``);
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        exports.push(`Function: \`${node.name.text}\``);
      } else if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach((decl) => {
          if (ts.isIdentifier(decl.name)) {
            exports.push(`Variable: \`${decl.name.text}\``);
          }
        });
      } else if (ts.isEnumDeclaration(node) && node.name) {
        exports.push(`Enum: \`${node.name.text}\``);
      } else if (ts.isTypeAliasDeclaration(node) && node.name) {
        exports.push(`Type: \`${node.name.text}\``);
      }
    }
  }

  ts.forEachChild(sourceFile, visit);
  return exports;
}

function processDirectory(dir: string, depth: number = 0) {
  let items: fs.Dirent[];
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.error(`Error reading directory ${dir}:`, e);
    return;
  }

  // Sort directories first, then files
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const indent = '  '.repeat(depth);

    if (item.isDirectory()) {
      if (item.name.startsWith('.') || item.name === 'node_modules') continue;
      log(`${indent}- **/${item.name}**`);
      processDirectory(fullPath, depth + 1);
    } else if (
      item.isFile() &&
      item.name.endsWith('.ts') &&
      !item.name.endsWith('.d.ts')
    ) {
      stats.fileCount++;

      // Link format for console output (relative path from CWD)
      const relativePathFromCwd = path.relative(process.cwd(), fullPath);

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        stats.totalLoc += countLines(content);

        const sourceFile = ts.createSourceFile(
          item.name,
          content,
          ts.ScriptTarget.Latest,
          true
        );
        const desc = extractFileDescription(sourceFile);
        const descStr = desc ? ` - ${desc}` : '';

        log(`${indent}- [${item.name}](../${relativePathFromCwd})${descStr}`);

        const exports = getExportedMembers(sourceFile);
        if (exports.length > 0) {
          exports.forEach((exp) => log(`${indent}  - ${exp}`));
        }
      } catch (e) {
        // Ignore errors for individual files
        log(`${indent}- [${item.name}](../${relativePathFromCwd})`);
      }
    }
  }
}

// First pass: verify dir exists
if (!fs.existsSync(targetDir)) {
  console.error(`Directory not found: ${targetDir}`);
  process.exit(1);
}

// Process directory (fills buffer and stats)
processDirectory(targetDir);

// Print Header
const now = new Date();
const formattedDate = now.toISOString().replace('T', ' ').substring(0, 19);

console.log(`/**
 * Auto-generated project map
 * Last updated: ${formattedDate}
 * Files: ${stats.fileCount}
 * Lines of code: ~${stats.totalLoc}
 */
`);

// Print Buffered Output
console.log(outputBuffer.join('\n'));
