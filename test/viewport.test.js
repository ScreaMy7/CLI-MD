import test from 'node:test';
import assert from 'node:assert/strict';
import { moveViewport, viewport } from '../src/core/viewport.js';

test('viewport bounds output to the available terminal height', () => {
  const lines = Array.from({ length: 100 }, (_, index) => `line ${index + 1}`);
  const page = viewport(lines, 0, 23);
  assert.equal(page.lines.length, 23);
  assert.equal(page.lines[0], 'line 1');
  assert.equal(page.lines.at(-1), 'line 23');
  assert.equal(page.offset, 0);
});

test('viewport preserves a scroll offset when document content is refreshed', () => {
  const original = Array.from({ length: 80 }, (_, index) => `line ${index + 1}`);
  const refreshed = [...original.slice(0, 40), 'new line', ...original.slice(40)];
  const before = viewport(original, 17, 20);
  const after = viewport(refreshed, before.offset, 20);
  assert.equal(after.offset, 17);
  assert.equal(after.lines[0], 'line 18');
});

test('viewport movement clamps at the document boundaries', () => {
  assert.equal(moveViewport(0, 'up', 20, 100), 0);
  assert.equal(moveViewport(0, 'page-down', 20, 100), 20);
  assert.equal(moveViewport(20, 'bottom', 20, 100), 80);
  assert.equal(moveViewport(80, 'down', 20, 100), 80);
  assert.equal(moveViewport(80, 'top', 20, 100), 0);
});
