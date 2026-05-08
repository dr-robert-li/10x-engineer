# Changelog

All notable changes to this package are documented in this file. The format is loosely based on Keep a Changelog; the project follows semantic versioning.

## 0.2.0 — 2026-05-08

### Added

- Interactive harness selection. `install` now presents a numbered checklist of detected harnesses and reads a selection (comma-separated indices, `a` for all, `n` for none). `--all` and `--harness <id>` skip the prompt; non-TTY without a bypass flag still refuses with exit 3.
- `/10x-engineer-enable` and `/10x-engineer-disable` slash commands. Each writes to `~/.10x-engineer/state.json` and confirms to the user.
- Persistent runtime state at `~/.10x-engineer/state.json`. The active persona reads the file before engaging; `enabled: false` pauses the methodology without uninstalling. A missing or malformed file resolves to `enabled: true` (default-on).
- Natural-language toggles. The engage command honours "disable 10x-engineer" and "enable 10x-engineer" anywhere in the user's message.
- Always-on enforcement surface for Claude Code: an output style file at `.claude/output-styles/10x-engineer.md` (selected via `/output-style 10x-engineer`).

### Changed

- Cursor `.mdc` rules now ship with `alwaysApply: true`. Cursor applies the methodology on every request without waiting for a glob match.
- `runUninstall` clears `~/.10x-engineer/state.json` on its way out so the home directory returns to its pre-install shape.

### Removed

- Adapters for Amazon Q Developer CLI, GitHub Copilot Chat, Goose, JetBrains AI Assistant, PearAI, Pieces, Plandex, Tabnine, Windsurf, and Zed AI. The supported set is now the eleven adapters listed in `README.md` (aider, claude-code, cline, codex, continue, cursor, gemini, hosted-fallback, kilo-code, opencode, roo-code).

## 0.1.2 — 2026-05-08

- Slash-command surface extended to Codex CLI and Gemini CLI.

## 0.1.1 — 2026-05-08

- `/10x-engineer` slash command added for Claude Code.

## 0.1.0 — 2026-05-08

- Initial release. Twenty-one harness adapters; ten skill files; CLI surface for install, uninstall, list, print, and export.
