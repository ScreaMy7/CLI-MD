import test from 'node:test';
import assert from 'node:assert/strict';
import { documentStats, extractSection, headings, markdownLinks, tasks } from '../src/core/markdown.js';
import { renderMarkdown } from '../src/core/render.js';

test('headings builds GitHub-style unique anchors and ignores code fences', () => {
  const markdown = '# Hello, World!\n\n```md\n# Not a heading\n```\n\n## Child\n\n# Hello, World!\n';
  assert.deepEqual(
    headings(markdown).map(({ text, depth, line, slug }) => ({ text, depth, line, slug })),
    [
      { text: 'Hello, World!', depth: 1, line: 1, slug: 'hello-world' },
      { text: 'Child', depth: 2, line: 7, slug: 'child' },
      { text: 'Hello, World!', depth: 1, line: 9, slug: 'hello-world-1' },
    ],
  );
});

test('headings supports setext headings', () => {
  const markdown = 'Title\n=====\n\nSubtitle\n--------\n';
  assert.deepEqual(headings(markdown).map(({ depth, text, line }) => ({ depth, text, line })), [
    { depth: 1, text: 'Title', line: 1 },
    { depth: 2, text: 'Subtitle', line: 4 },
  ]);
});

test('extractSection stops at the next peer heading', () => {
  const markdown = '# Guide\n\n## Install\n\nRun it.\n\n### Notes\n\nCarefully.\n\n## Usage\n\nDone.\n';
  const result = extractSection(markdown, 'install');
  assert.equal(result.heading.text, 'Install');
  assert.equal(result.markdown, '## Install\n\nRun it.\n\n### Notes\n\nCarefully.');
});

test('tasks finds ordered and unordered task items', () => {
  const markdown = '- [ ] Open item\n1. [x] **Finished** item\n- ordinary\n';
  assert.deepEqual(tasks(markdown), [
    { line: 1, done: false, text: 'Open item' },
    { line: 2, done: true, text: 'Finished item' },
  ]);
});

test('markdownLinks ignores fenced examples and resolves reference links', () => {
  const markdown = '[Guide](./guide.md#start)\n![Logo](img/logo.png)\n[Ref][docs]\n\n[docs]: docs/readme.md\n\n```md\n[Fake](missing.md)\n```\n';
  assert.deepEqual(markdownLinks(markdown), [
    { href: './guide.md#start', label: 'Guide', image: false, line: 1 },
    { href: 'img/logo.png', label: 'Logo', image: true, line: 2 },
    { href: 'docs/readme.md', label: 'Ref', image: false, line: 3 },
  ]);
});

test('documentStats reports stable workspace metadata', () => {
  const stat = documentStats('# Note\n\nA short document.\n\n- [ ] Review\n');
  assert.equal(stat.lines, 6);
  assert.equal(stat.headings, 1);
  assert.equal(stat.tasks, 1);
  assert.equal(stat.readingMinutes, 1);
});

test('plain rendering contains no ANSI and normalizes inline list markup', () => {
  const output = renderMarkdown('- [ ] **Review** `report.md`\n', { color: false, header: false, width: 80 });
  assert.doesNotMatch(output, /\u001b\[/);
  assert.match(output, /☐ Review report\.md/);
  assert.doesNotMatch(output, /\*\*|`/);
});
