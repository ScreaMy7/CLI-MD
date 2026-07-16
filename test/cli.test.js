import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(project, 'src', 'cli.js');

test('redirected rendering omits terminal chrome and ANSI escapes', () => {
  const result = spawnSync(process.execPath, [cli, 'README.md'], { cwd: project, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^CLI-MD\n/);
  assert.doesNotMatch(result.stdout, /╭─|\u001b\[/);
});

test('CLI renders stdin and exposes the command surface', () => {
  const render = spawnSync(process.execPath, [cli, '-'], {
    cwd: project,
    input: '# Streamed\n\nHello.\n',
    encoding: 'utf8',
  });
  assert.equal(render.status, 0, render.stderr);
  assert.match(render.stdout, /^Streamed\n/);

  const help = spawnSync(process.execPath, [cli, '--help'], { cwd: project, encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /check \[path\]/);
  assert.match(help.stdout, /watch <file>/);
});
