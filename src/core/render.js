import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import chalk, { Chalk } from 'chalk';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { documentStats } from './markdown.js';

function rendererOptions(color, width) {
  const c = new Chalk({ level: color ? 3 : 0 });
  const inlineListText = (value) => value
    .replace(/^\[\s\]\s+/, `${c.hex('#FBBF24')('☐')} `)
    .replace(/^\[[xX]\]\s+/, `${c.hex('#4ADE80')('☑')} `)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, text, href) => c.hex('#A78BFA')(`🖼 ${text || 'image'} (${href})`))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `${c.hex('#60A5FA')(text)} ${c.dim(`(${href})`)}`)
    .replace(/`([^`]+)`/g, (_, text) => c.hex('#FBBF24')(text))
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, star, underscore) => c.bold(star ?? underscore))
    .replace(/~~([^~]+)~~/g, (_, text) => c.dim.strikethrough(text))
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)/g, (_, star, underscore) => c.italic(star ?? underscore));
  return {
    width,
    reflowText: true,
    showSectionPrefix: false,
    firstHeading: c.hex('#C084FC').bold,
    heading: c.hex('#67E8F9').bold,
    strong: c.bold,
    em: c.italic,
    codespan: c.hex('#FBBF24'),
    code: c.hex('#FDE68A'),
    blockquote: c.hex('#94A3B8').italic,
    link: c.hex('#60A5FA'),
    href: c.hex('#64748B').underline,
    del: c.dim.strikethrough,
    html: c.dim,
    hr: c.hex('#475569'),
    // marked-terminal currently receives raw inline Markdown for list items from
    // marked v15. Normalize it here so lists stay as polished as paragraphs.
    listitem: inlineListText,
    table: c.reset,
    image: (href, title, text) => c.hex('#A78BFA')(`🖼  ${text || title || 'image'} (${href})`),
  };
}

function header(filename, markdown, width, color) {
  const c = new Chalk({ level: color ? 3 : 0 });
  const stat = documentStats(markdown);
  const name = filename === 'stdin' ? 'stdin' : path.basename(filename);
  const detail = `${stat.lines} lines · ${stat.readingMinutes} min read`;
  const available = Math.max(2, width - name.length - detail.length - 8);
  return c.dim(`╭─ `) + c.hex('#C084FC').bold(name) + c.dim(` ${'─'.repeat(available)} ${detail} ─╮`) + '\n';
}

export function renderMarkdown(markdown, options = {}) {
  const width = Math.max(40, options.width ?? process.stdout.columns ?? 88);
  const color = options.color ?? process.stdout.isTTY;
  const parser = new Marked(markedTerminal(rendererOptions(color, Math.max(36, width - 4))));
  const rendered = parser.parse(markdown, { gfm: true });
  const output = `${options.header === false ? '' : header(options.filename ?? 'document.md', markdown, width, color)}${rendered.trimEnd()}\n`;
  return color ? output : stripVTControlCharacters(output);
}

export function palette(enabled = process.stdout.isTTY) {
  const c = new Chalk({ level: enabled ? 3 : 0 });
  return {
    accent: c.hex('#C084FC'),
    secondary: c.hex('#67E8F9'),
    success: c.hex('#4ADE80'),
    warning: c.hex('#FBBF24'),
    danger: c.hex('#FB7185'),
    muted: c.hex('#94A3B8'),
    dim: c.dim,
    bold: c.bold,
  };
}

export { chalk };
