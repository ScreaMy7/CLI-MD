import path from 'node:path';

const ATX_HEADING = /^( {0,3})(#{1,6})[\t ]+(.+?)[\t ]*#*[\t ]*$/;
const SETEXT_HEADING = /^( {0,3})(=+|-+)[\t ]*$/;
const TASK = /^(\s*)(?:[-+*]|\d+[.)])\s+\[([ xX])\]\s+(.*)$/;

export function plainText(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\\([\\`*{}\[\]()#+.!_-])/g, '$1')
    .trim();
}

export function baseSlug(value) {
  return plainText(value)
    .toLowerCase()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-');
}

export function headings(markdown) {
  const lines = markdown.split(/\r?\n/);
  const result = [];
  const seen = new Map();
  let inFence = false;
  let fence = '';

  const add = (depth, raw, line) => {
    const text = plainText(raw);
    const root = baseSlug(raw);
    const occurrence = seen.get(root) ?? 0;
    seen.set(root, occurrence + 1);
    result.push({
      depth,
      text,
      raw,
      line,
      slug: occurrence === 0 ? root : `${root}-${occurrence}`,
      duplicate: occurrence > 0,
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fence = marker;
      } else if (marker === fence) {
        inFence = false;
        fence = '';
      }
      continue;
    }
    if (inFence) continue;

    const atx = line.match(ATX_HEADING);
    if (atx) {
      add(atx[2].length, atx[3], index + 1);
      continue;
    }

    if (index > 0 && line.match(SETEXT_HEADING) && lines[index - 1].trim()) {
      const underline = line.match(SETEXT_HEADING);
      add(underline[2][0] === '=' ? 1 : 2, lines[index - 1].trim(), index);
    }
  }
  return result;
}

export function tasks(markdown) {
  return markdown.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(TASK);
    if (!match) return [];
    return [{
      line: index + 1,
      done: match[2].toLowerCase() === 'x',
      text: plainText(match[3]),
    }];
  });
}

export function documentStats(markdown) {
  const withoutCode = markdown
    .replace(/^---\s*[\s\S]*?^---\s*$/m, '')
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`]*`/g, '');
  const words = (plainText(withoutCode).match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu) ?? []).length;
  const lines = markdown === '' ? 0 : markdown.split(/\r?\n/).length;
  return {
    lines,
    words,
    characters: markdown.length,
    headings: headings(markdown).length,
    tasks: tasks(markdown).length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 220)),
  };
}

export function extractSection(markdown, query) {
  const all = headings(markdown);
  const normalized = baseSlug(query);
  const selected = all.find((heading) => heading.slug === normalized)
    ?? all.find((heading) => baseSlug(heading.text) === normalized)
    ?? all.find((heading) => heading.text.toLowerCase().includes(query.toLowerCase()));

  if (!selected) return null;
  const next = all.find((heading) => heading.line > selected.line && heading.depth <= selected.depth);
  const lines = markdown.split(/\r?\n/);
  return {
    heading: selected,
    markdown: lines.slice(selected.line - 1, next ? next.line - 1 : lines.length).join('\n').trimEnd(),
  };
}

export function markdownLinks(markdown) {
  const definitions = new Map();
  for (const match of markdown.matchAll(/^\s{0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?/gm)) {
    definitions.set(match[1].toLowerCase(), match[2]);
  }

  const links = [];
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let fence = '';
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) { inFence = true; fence = marker; }
      else if (marker === fence) { inFence = false; fence = ''; }
      continue;
    }
    if (inFence) continue;

    const inline = /(!?)\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
    for (const match of line.matchAll(inline)) {
      links.push({ href: match[3], label: match[2], image: match[1] === '!', line: index + 1 });
    }
    const reference = /(!?)\[([^\]]+)\]\[([^\]]*)\]/g;
    for (const match of line.matchAll(reference)) {
      const key = (match[3] || match[2]).toLowerCase();
      if (definitions.has(key)) {
        links.push({ href: definitions.get(key), label: match[2], image: match[1] === '!', line: index + 1 });
      }
    }
  }
  return links;
}

export function titleFor(markdown, fallback = 'Untitled') {
  return headings(markdown)[0]?.text ?? path.basename(fallback, path.extname(fallback));
}
