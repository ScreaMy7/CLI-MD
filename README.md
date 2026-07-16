# CLI-MD

CLI-MD is a terminal-native workspace for Markdown. It renders documents cleanly,
watches changing files, opens your editor, searches a documentation tree, extracts
sections, tracks task boxes, and checks local links—all without leaving the CLI.

It is built for research notes, implementation plans, reports, and documentation
produced alongside tools such as Codex and Claude Code.

## Install

CLI-MD requires Node.js 20.19 or newer.

```sh
npm install --global @screamy7/cli-md
```

This installs both `md` and the collision-safe `climd` alias.

## Install for development

```sh
npm install
npm link
```

You can also run the tool without linking it:

```sh
node src/cli.js README.md
```

## Start here

```sh
# Render a document
md README.md

# Render Markdown from an agent or another command
cat PLAN.md | md -

# Redraw whenever the file changes
md watch PLAN.md

# See every Markdown file in the current workspace
md list
```

Watch mode uses a fixed-height terminal viewport, so refreshing a long document
does not jump to its last line. Scroll with `↑`/`↓` or `j`/`k`, move by a page with
`Page Up`/`Page Down` (or `b`/`Space`), jump with `g`/`G`, and press `q` to exit.

Color is enabled for a terminal and disabled automatically in a pipe. Use
`--color` or `--no-color` to override detection, and `--width 100` to control text
reflow.

## Use with Codex or Claude Code

CLI-MD works well as the human-readable side of an agent session. Ask Codex or
Claude Code to keep its plan, research, or report in a Markdown file, then watch
that file from another terminal or split pane.

```text
Terminal 1                         Terminal 2
──────────────────────────────     ──────────────────────────────
codex                              md watch PLAN.md
# or: claude

Prompt the agent:
"Keep your implementation plan and progress updated in PLAN.md."
```

As the agent edits `PLAN.md`, `md watch` re-renders it automatically without
jumping to the bottom. Your scroll position is preserved, so you can continue
reading while new content is written.

For a research workflow, ask the agent to write structured files such as
`RESEARCH.md`, `DECISIONS.md`, or `REPORT.md`, then use CLI-MD to inspect them:

```sh
# Find text in one growing document
md search "authentication" RESEARCH.md

# Search every Markdown file in the workspace
md search "open question" .

# See the document structure and source line numbers
md toc REPORT.md

# Render or extract only the section you need
md section REPORT.md "Security findings" --render
md section REPORT.md "Security findings" > security-context.md

# Review tasks created or completed by the agent
md tasks PLAN.md
md tasks PLAN.md --status all

# Validate links and heading references before sharing the result
md check .
```

A practical agent workflow is:

1. Ask Codex or Claude Code to use a named Markdown file as its durable work log.
2. Run `md watch <file>` in a neighboring terminal pane for live rendering.
3. Use `md search`, `md toc`, and `md section` to navigate large results without
   interrupting the agent.
4. Run `md tasks` to review outstanding work and `md check .` before committing or
   sharing the documents.

## Navigate and inspect

```sh
md toc SPEC.md
md search "open question" notes/
md section SPEC.md "Data model"
md section SPEC.md data-model --render
md stats research.md
md tasks .
md tasks . --status all
```

`section` prints source Markdown by default, which makes it useful in scripts and
agent prompts:

```sh
md section SPEC.md Constraints | some-agent-command
```

## Edit and create

```sh
md edit PLAN.md
md edit notes/new-idea.md --create
md new notes/decision-log --title "Decision log"
md new scratch.md --edit
```

The editor is selected from `$VISUAL`, then `$EDITOR`, and finally `vi`. `new`
never replaces a file unless `--force` is supplied.

## Check a workspace

```sh
md check .
```

The check command validates relative links and images, Markdown heading fragments,
and duplicate heading anchors. Remote URLs are intentionally not fetched, so the
command stays quick and deterministic.

## Command map

| Job | Command | Purpose |
| --- | --- | --- |
| Read | `md [file]` / `md view` | Render a file or stdin |
| Follow | `md watch <file>` | Refresh a preview after writes |
| Find files | `md list [path]` | Inventory a Markdown workspace |
| Navigate | `md toc <file>` | Print the heading tree |
| Find text | `md search <query> [path]` | Search with file and line locations |
| Reuse | `md section <file> <heading>` | Extract one semantic section |
| Track | `md tasks [path]` | List task checkboxes |
| Measure | `md stats [file]` | Show document metadata |
| Verify | `md check [path]` | Validate local references |
| Author | `md edit` / `md new` | Work through your existing editor |

## Product direction

CLI-MD follows a few constraints that keep it useful in agent-heavy terminal
workflows:

- A file is the interface: `md README.md` remains the primary interaction.
- Terminal output should look polished while redirected output stays stable and
  free of ANSI decoration.
- Editing should use the user's existing editor instead of replacing it.
- Read-only commands never modify Markdown files.
- Workspace operations should work equally well on one file or a directory tree.

Planned next steps include a two-pane interactive file browser, fuzzy heading and
file navigation, themes, inline task toggling, frontmatter and template helpers,
and Git-aware document review.

## Development

```sh
npm test
npm run check
```

The implementation is deliberately small: Commander handles the command surface,
Marked and marked-terminal handle GitHub-flavored rendering, Chokidar handles live
updates, and the workspace analysis code stays dependency-light and testable.

## License

MIT
