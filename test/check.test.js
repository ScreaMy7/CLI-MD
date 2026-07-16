import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkDocument } from '../src/core/check.js';

test('checkDocument validates files and Markdown fragments', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-md-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const target = path.join(directory, 'guide.md');
  const source = path.join(directory, 'README.md');
  await fs.writeFile(target, '# Getting started\n');
  const markdown = [
    '# Home',
    '',
    '[Good](guide.md#getting-started)',
    '[Missing file](absent.md)',
    '[Missing section](guide.md#unknown)',
    '',
  ].join('\n');
  await fs.writeFile(source, markdown);

  const issues = await checkDocument(source, markdown);
  assert.deepEqual(issues.map(({ kind, line }) => ({ kind, line })), [
    { kind: 'broken-link', line: 4 },
    { kind: 'missing-anchor', line: 5 },
  ]);
});
