import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import chokidar from 'chokidar';
import { checkDocument } from './core/check.js';
import { displayPath, markdownFiles, readMarkdown } from './core/files.js';
import { documentStats, extractSection, headings, tasks, titleFor } from './core/markdown.js';
import { palette, renderMarkdown } from './core/render.js';
import { moveViewport, viewport } from './core/viewport.js';

function output(value = '') {
  process.stdout.write(`${value}${value.endsWith('\n') ? '' : '\n'}`);
}

function optionsFor(command) {
  const options = command.optsWithGlobals();
  const colorSource = command.getOptionValueSourceWithGlobals?.('color');
  return {
    color: colorSource === 'cli' ? options.color !== false : Boolean(process.stdout.isTTY),
    width: Number(options.width) || process.stdout.columns || 88,
  };
}

export async function viewAction(file, options, command) {
  const source = await readMarkdown(file);
  output(renderMarkdown(source.content, {
    ...optionsFor(command),
    filename: source.filename,
    header: options.header !== false && Boolean(process.stdout.isTTY),
  }));
}

export async function rootAction(file, options, command) {
  if (!file && process.stdin.isTTY) {
    await listAction('.', {}, command);
    return;
  }
  await viewAction(file, options, command);
}

export async function watchAction(file, options, command) {
  const absolute = path.resolve(file);
  let markdown = await fs.readFile(absolute, 'utf8');

  // A redirected watcher cannot control a terminal viewport, so retain the
  // append-only behavior for logs and scripts.
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    const draw = async () => {
      const colors = optionsFor(command);
      try {
        markdown = await fs.readFile(absolute, 'utf8');
        output(renderMarkdown(markdown, { ...colors, filename: absolute, header: false }));
        output(palette(colors.color).dim(`Watching ${displayPath(absolute)} · Ctrl+C to stop`));
      } catch (error) {
        output(palette(colors.color).danger(error.message));
      }
    };
    await draw();
    const watcher = chokidar.watch(absolute, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 80 } });
    watcher.on('change', draw).on('add', draw);
    return;
  }

  let offset = 0;
  let renderedLines = [];
  let watcher;
  let closed = false;
  const wasRaw = process.stdin.isRaw;

  const pageHeight = () => Math.max(1, (process.stdout.rows || 24) - 1);
  const renderDocument = () => {
    const style = optionsFor(command);
    const rendered = renderMarkdown(markdown, { ...style, filename: absolute, header: true });
    renderedLines = rendered.replace(/\n$/, '').split('\n');
  };
  const truncate = (value, width) => {
    const characters = Array.from(value);
    return characters.length <= width ? value : `${characters.slice(0, Math.max(0, width - 1)).join('')}…`;
  };
  const paint = () => {
    const style = optionsFor(command);
    const page = viewport(renderedLines, offset, pageHeight());
    offset = page.offset;
    const status = `Watching ${displayPath(absolute)} · lines ${page.start}–${page.end} of ${page.total} · ↑↓/jk scroll · PgUp/PgDn · q quit`;
    const footer = palette(style.color).dim(truncate(status, process.stdout.columns || 88));
    const footerRow = process.stdout.rows || 24;
    process.stdout.write([
      '\u001b[?2026h',
      '\u001b[H\u001b[2J',
      page.lines.join('\n'),
      `\u001b[${footerRow};1H\u001b[2K${footer}`,
      '\u001b[?2026l',
    ].join(''));
  };
  const refresh = async () => {
    try {
      markdown = await fs.readFile(absolute, 'utf8');
      renderDocument();
      paint();
    } catch (error) {
      const style = optionsFor(command);
      renderedLines = [palette(style.color).danger(error.message)];
      paint();
    }
  };
  const restoreTerminal = () => {
    process.stdout.write('\u001b[?2026l\u001b[?25h\u001b[?1049l');
  };
  const cleanup = async () => {
    if (closed) return;
    closed = true;
    process.stdin.off('data', onKey);
    process.stdout.off('resize', onResize);
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
    process.off('exit', restoreTerminal);
    if (process.stdin.setRawMode) process.stdin.setRawMode(Boolean(wasRaw));
    process.stdin.pause();
    restoreTerminal();
    await watcher?.close();
  };
  const exit = async (code) => {
    await cleanup();
    process.exit(code);
  };
  const onInterrupt = () => void exit(130);
  const onTerminate = () => void exit(143);
  const onResize = () => {
    renderDocument();
    paint();
  };
  const keyMovements = new Map([
    ['k', 'up'], ['\u001b[A', 'up'],
    ['j', 'down'], ['\u001b[B', 'down'],
    ['b', 'page-up'], ['\u001b[5~', 'page-up'],
    [' ', 'page-down'], ['\u001b[6~', 'page-down'],
    ['g', 'top'], ['G', 'bottom'],
  ]);
  const onKey = (chunk) => {
    const sequence = chunk.toString();
    const keys = keyMovements.has(sequence) || sequence.startsWith('\u001b')
      ? [sequence]
      : Array.from(sequence);
    for (const key of keys) {
      if (key === 'q' || key === '\u0003') {
        void exit(key === 'q' ? 0 : 130);
        return;
      }
      const movement = keyMovements.get(key);
      if (!movement) continue;
      offset = moveViewport(offset, movement, pageHeight(), renderedLines.length);
    }
    paint();
  };

  process.stdout.write('\u001b[?1049h\u001b[?25l');
  process.on('exit', restoreTerminal);
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  process.stdout.on('resize', onResize);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', onKey);

  renderDocument();
  paint();
  watcher = chokidar.watch(absolute, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 80 } });
  watcher.on('change', refresh).on('add', refresh);
}

function shellWords(value) {
  const words = [];
  value.replace(/"([^"]*)"|'([^']*)'|([^\s]+)/g, (_, double, single, bare) => {
    words.push(double ?? single ?? bare);
    return '';
  });
  return words;
}

export async function editAction(file, options) {
  const absolute = path.resolve(file);
  if (options.create) {
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.appendFile(absolute, '');
  } else {
    await fs.access(absolute);
  }
  const editor = options.editor || process.env.VISUAL || process.env.EDITOR || 'vi';
  const [command, ...args] = shellWords(editor);
  const result = spawnSync(command, [...args, absolute], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

export async function listAction(target = '.', _options, command) {
  const files = await markdownFiles(target);
  const style = optionsFor(command);
  const c = palette(style.color);
  if (files.length === 0) {
    output(c.muted(`No Markdown files found in ${target}`));
    return;
  }
  const rows = await Promise.all(files.map(async (file) => {
    const content = await fs.readFile(file, 'utf8');
    const stat = documentStats(content);
    return {
      file: displayPath(file),
      title: titleFor(content, file),
      detail: `${stat.words} words · ${stat.readingMinutes} min`,
    };
  }));
  const longest = Math.min(48, Math.max(...rows.map((row) => row.file.length)));
  output(c.bold(`Markdown workspace · ${rows.length} ${rows.length === 1 ? 'file' : 'files'}`));
  output(c.dim('─'.repeat(Math.min(style.width, 88))));
  for (const row of rows) {
    const name = row.file.length > longest ? `…${row.file.slice(-(longest - 1))}` : row.file;
    output(`${c.accent(name.padEnd(longest))}  ${c.muted(row.detail.padEnd(20))}  ${row.title}`);
  }
}

export async function tocAction(file, options, command) {
  const source = await readMarkdown(file);
  const all = headings(source.content);
  const c = palette(optionsFor(command).color);
  if (all.length === 0) {
    output(c.muted('No headings found.'));
    return;
  }
  const baseDepth = Math.min(...all.map((heading) => heading.depth));
  for (const heading of all) {
    const indent = '  '.repeat(Math.max(0, heading.depth - baseDepth));
    const line = options.lines === false ? '' : c.dim(`:${heading.line}`);
    output(`${indent}${c.secondary('◆')} ${heading.text} ${line}`.trimEnd());
  }
}

export async function searchAction(query, target = '.', options, command) {
  const files = await markdownFiles(target);
  const c = palette(optionsFor(command).color);
  const needle = options.caseSensitive ? query : query.toLowerCase();
  const limit = Number(options.limit) || 100;
  let matches = 0;
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const haystack = options.caseSensitive ? lines[index] : lines[index].toLowerCase();
      if (!haystack.includes(needle)) continue;
      output(`${c.accent(displayPath(file))}${c.dim(`:${index + 1}`)}  ${lines[index].trim()}`);
      matches += 1;
      if (matches >= limit) break;
    }
    if (matches >= limit) break;
  }
  if (matches === 0) output(c.muted(`No matches for “${query}”.`));
  else if (matches >= limit) output(c.warning(`Result limit reached (${limit}).`));
}

export async function tasksAction(target = '.', options, command) {
  const files = await markdownFiles(target);
  const c = palette(optionsFor(command).color);
  let count = 0;
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    for (const task of tasks(content)) {
      if (options.status === 'open' && task.done) continue;
      if (options.status === 'done' && !task.done) continue;
      const icon = task.done ? c.success('☑') : c.warning('☐');
      output(`${icon} ${task.text}  ${c.dim(`${displayPath(file)}:${task.line}`)}`);
      count += 1;
    }
  }
  if (count === 0) output(c.muted(`No ${options.status === 'all' ? '' : `${options.status} `}tasks found.`));
}

export async function sectionAction(file, query, options, command) {
  const source = await readMarkdown(file);
  const result = extractSection(source.content, query);
  if (!result) throw new Error(`No heading matching “${query}” in ${file}.`);
  if (options.render) {
    output(renderMarkdown(result.markdown, {
      ...optionsFor(command),
      filename: `${displayPath(source.filename)} › ${result.heading.text}`,
      header: Boolean(process.stdout.isTTY),
    }));
  } else {
    output(result.markdown);
  }
}

export async function statsAction(file, _options, command) {
  const source = await readMarkdown(file);
  const stat = documentStats(source.content);
  const c = palette(optionsFor(command).color);
  const rows = [
    ['Words', stat.words],
    ['Lines', stat.lines],
    ['Characters', stat.characters],
    ['Headings', stat.headings],
    ['Tasks', stat.tasks],
    ['Reading time', `${stat.readingMinutes} min`],
  ];
  output(c.bold(displayPath(source.filename)));
  for (const [label, value] of rows) output(`${c.muted(label.padEnd(14))}${value}`);
}

export async function checkAction(target = '.', _options, command) {
  const files = await markdownFiles(target);
  const c = palette(optionsFor(command).color);
  const results = [];
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    results.push(...await checkDocument(file, content));
  }
  if (results.length === 0) {
    output(c.success(`✓ Checked ${files.length} ${files.length === 1 ? 'file' : 'files'} · no problems found`));
    return;
  }
  for (const issue of results) {
    output(`${c.danger('✗')} ${c.accent(displayPath(issue.file))}${c.dim(`:${issue.line}`)}  ${issue.message} ${c.dim(`[${issue.kind}]`)}`);
  }
  output(c.danger(`${results.length} ${results.length === 1 ? 'problem' : 'problems'} found in ${files.length} ${files.length === 1 ? 'file' : 'files'}.`));
  process.exitCode = 1;
}

export async function newAction(file, options, command) {
  const extension = path.extname(file);
  const target = path.resolve(extension ? file : `${file}.md`);
  const title = options.title || path.basename(target, path.extname(target)).replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const content = `# ${title}\n\n`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, { flag: options.force ? 'w' : 'wx' }).catch((error) => {
    if (error.code === 'EEXIST') throw new Error(`${displayPath(target)} already exists. Pass --force to replace it.`);
    throw error;
  });
  const c = palette(optionsFor(command).color);
  output(`${c.success('✓')} Created ${c.accent(displayPath(target))}`);
  if (options.edit) await editAction(target, {});
}
