import fs from 'node:fs/promises';
import path from 'node:path';
import { headings, markdownLinks } from './markdown.js';
import { MARKDOWN_EXTENSIONS, pathExists } from './files.js';

function safeDecode(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function isExternal(href) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href);
}

async function fragmentExists(file, fragment, cache) {
  if (!fragment) return true;
  if (!MARKDOWN_EXTENSIONS.has(path.extname(file).toLowerCase())) return true;
  let anchors = cache.get(file);
  if (!anchors) {
    const content = await fs.readFile(file, 'utf8');
    anchors = new Set(headings(content).map((heading) => heading.slug));
    cache.set(file, anchors);
  }
  return anchors.has(safeDecode(fragment).toLowerCase());
}

export async function checkDocument(file, markdown) {
  const issues = [];
  const anchorCache = new Map();
  const allHeadings = headings(markdown);

  for (const heading of allHeadings.filter((item) => item.duplicate)) {
    issues.push({
      file,
      line: heading.line,
      kind: 'duplicate-heading',
      message: `Duplicate heading produces anchor #${heading.slug}`,
    });
  }

  for (const link of markdownLinks(markdown)) {
    const href = link.href.trim();
    if (!href || isExternal(href)) continue;
    const hashIndex = href.indexOf('#');
    const rawTarget = hashIndex === -1 ? href : href.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? '' : href.slice(hashIndex + 1);
    const withoutQuery = rawTarget.split('?')[0];
    const target = withoutQuery
      ? path.resolve(path.dirname(file), safeDecode(withoutQuery))
      : file;

    if (!(await pathExists(target))) {
      issues.push({
        file,
        line: link.line,
        kind: link.image ? 'missing-image' : 'broken-link',
        message: `${link.image ? 'Image' : 'Link'} target not found: ${rawTarget}`,
      });
      continue;
    }

    if (fragment && !(await fragmentExists(target, fragment, anchorCache))) {
      issues.push({
        file,
        line: link.line,
        kind: 'missing-anchor',
        message: `Heading anchor not found: #${safeDecode(fragment)}`,
      });
    }
  }
  return issues;
}
