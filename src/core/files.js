import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

export const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mdx']);

export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function markdownFiles(target = '.') {
  const absolute = path.resolve(target);
  let stat;
  try {
    stat = await fs.stat(absolute);
  } catch {
    throw new Error(`Path does not exist: ${target}`);
  }
  if (stat.isFile()) return [absolute];
  if (!stat.isDirectory()) return [];

  const matches = await fg(['**/*.md', '**/*.markdown', '**/*.mdown', '**/*.mkd', '**/*.mdx'], {
    cwd: absolute,
    absolute: true,
    onlyFiles: true,
    unique: true,
    ignore: ['**/.git/**', '**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/vendor/**'],
  });
  return matches.sort((a, b) => a.localeCompare(b));
}

export async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export async function readMarkdown(file) {
  if (file === '-' || (!file && !process.stdin.isTTY)) {
    return { content: await readStdin(), filename: 'stdin' };
  }
  if (!file) throw new Error('Pass a Markdown file, use `-` for stdin, or run `md list`.');
  const absolute = path.resolve(file);
  const stat = await fs.stat(absolute).catch(() => null);
  if (!stat) throw new Error(`File does not exist: ${file}`);
  if (!stat.isFile()) throw new Error(`Expected a file but received a directory: ${file}`);
  return { content: await fs.readFile(absolute, 'utf8'), filename: absolute };
}

export function displayPath(file, cwd = process.cwd()) {
  const relative = path.relative(cwd, file);
  return relative && !relative.startsWith('..') ? relative : file;
}
