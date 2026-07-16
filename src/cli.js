#!/usr/bin/env node

import { Command, Option } from 'commander';
import {
  checkAction,
  editAction,
  listAction,
  newAction,
  rootAction,
  searchAction,
  sectionAction,
  statsAction,
  tasksAction,
  tocAction,
  viewAction,
  watchAction,
} from './commands.js';
import { palette } from './core/render.js';

const program = new Command();

program
  .name('md')
  .description('A terminal-native workspace for Markdown')
  .version('0.1.0')
  .option('--no-color', 'disable ANSI colors')
  .option('--color', 'force ANSI colors')
  .option('-w, --width <columns>', 'render width', (value) => Number.parseInt(value, 10))
  .argument('[file]', 'Markdown file to render; use - for stdin')
  .action(rootAction)
  .showHelpAfterError()
  .configureHelp({ sortSubcommands: true });

program.command('view')
  .description('render a Markdown document')
  .argument('[file]', 'file to render; defaults to stdin when piped')
  .option('--no-header', 'hide the document information header')
  .action(viewAction);

program.command('watch')
  .description('live-render a document when it changes')
  .argument('<file>', 'file to watch')
  .action(watchAction);

program.command('edit')
  .description('open a document in $VISUAL or $EDITOR')
  .argument('<file>', 'file to edit')
  .option('-e, --editor <command>', 'editor command to use')
  .option('-c, --create', 'create the file when it does not exist')
  .action(editAction);

program.command('list')
  .alias('ls')
  .description('list Markdown documents in a workspace')
  .argument('[path]', 'file or directory to inspect', '.')
  .action(listAction);

program.command('toc')
  .description('print a document heading tree')
  .argument('<file>', 'file to inspect')
  .option('--no-lines', 'hide source line numbers')
  .action(tocAction);

program.command('search')
  .description('search Markdown documents')
  .argument('<query>', 'text to find')
  .argument('[path]', 'file or directory to search', '.')
  .option('-c, --case-sensitive', 'match letter case')
  .option('-l, --limit <count>', 'maximum result count', '100')
  .action(searchAction);

program.command('tasks')
  .description('list Markdown task checkboxes')
  .argument('[path]', 'file or directory to inspect', '.')
  .addOption(new Option('-s, --status <status>', 'filter by task status').choices(['open', 'done', 'all']).default('open'))
  .action(tasksAction);

program.command('section')
  .description('extract one heading section')
  .argument('<file>', 'file to inspect')
  .argument('<heading>', 'heading text or anchor')
  .option('-r, --render', 'render instead of printing source Markdown')
  .action(sectionAction);

program.command('stats')
  .description('show document statistics')
  .argument('[file]', 'file to inspect; defaults to stdin when piped')
  .action(statsAction);

program.command('check')
  .description('check local links, images, anchors, and headings')
  .argument('[path]', 'file or directory to check', '.')
  .action(checkAction);

program.command('new')
  .description('create a new Markdown document')
  .argument('<file>', 'file to create; .md is added when omitted')
  .option('-t, --title <title>', 'document title')
  .option('-f, --force', 'replace an existing file')
  .option('-e, --edit', 'open the new file in the editor')
  .action(newAction);

program.addHelpText('after', `
Examples:
  $ md README.md
  $ cat report.md | md -
  $ md watch PLAN.md
  $ md search "open question" docs/
  $ md check .
`);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const c = palette(process.stderr.isTTY);
  process.stderr.write(`${c.danger('Error:')} ${error.message}\n`);
  process.exitCode = 1;
}
