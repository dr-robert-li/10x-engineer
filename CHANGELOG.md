# Changelog

All notable changes to this package are documented in this file. The format is loosely based on Keep a Changelog; the project follows semantic versioning.

## 0.3.0 — 2026-05-08

### Added

- Strict-enforcement runtime hooks. The `claude-code` and `codex` adapters install two hook scripts (`session-start.js` and `user-prompt-submit.js`) under `<homedir>/.claude/hooks/` and `<homedir>/.codex/hooks/` respectively, and patch `~/.claude/settings.json` and `~/.codex/hooks.json` with idempotent hook entries. The session-start hook injects the full persona ruleset as hidden context when engaged; the user-prompt-submit hook re-anchors the methodology each turn. Both scripts read `~/.10x-engineer/state.json` and silent-exit when the state is missing, malformed, or `enabled: false`.
- Symlink-safe state writes. `safeWriteFlag` (in `lib/state.js`) writes the runtime state file via `lstat`-of-parent + `lstat`-of-target + `O_NOFOLLOW` (where supported) + sibling tempfile + atomic rename + mode `0600`. Refuses to write if the target or its parent is a symlink — closes the local-attacker symlink-clobber surface on the predictable `~/.10x-engineer/state.json` path.
- State-gate prologue in every always-on rule body. A canonical instruction (`lib/state-gate-instruction.js`) is now prepended by every format transform (native-skills, mdc, append-markers, concat-md, yaml-config+md), so Cursor, Cline, Continue, Aider, opencode, Gemini, Kilo Code, and Roo Code rule bodies all carry the same runtime gate text. Single source of truth: editing the constant propagates to every adapter that consumes a format.
- Shared JSON hook-config helper at `lib/adapters/helpers/hook-config.js` (`mergeHookConfig` / `unmergeHookConfig`). Used by both the `claude-code` and `codex` adapters; same idempotent merge contract; foreign hook entries are preserved by content (not byte-identical — JSON re-serialization is permitted).

### Changed

- Default-off install. A fresh `npx 10x-engineer install` writes `~/.10x-engineer/state.json` with `{"enabled": false}`. The persona is dormant until the user explicitly engages it. Re-installing on a machine where the state file already exists does NOT clobber the existing value — `enabled: true` is preserved verbatim.
- `readState` now treats a missing or malformed state file as `enabled: false` (fail-closed). v0.2.0 treated both as `enabled: true` (default-on); v0.3.0 inverts this. Strict boolean check: `enabled: "true"` (string), `enabled: 1`, or any other truthy non-boolean value resolves to `enabled: false`.
- `commands/10x-engineer.md` updated to match the default-off semantic. The slash command now instructs the model to ignore the methodology when the state file is missing OR contains `enabled: false`, and only proceed when both the file exists AND contains `enabled: true`.
- REL-13 round-trip contract clarified. The byte-identical invariant applies to marker-bounded append-mode files only (AGENTS.md, GEMINI.md, CONVENTIONS.md). Structured-edit JSON files (settings.json, hooks.json) round-trip content-equal — foreign entries survive by content, not by formatting; JSON re-serialization is allowed (HOOK-09).

### Migration from 0.2.0

If you previously installed 10x-engineer and never explicitly toggled the state, the methodology was engaged-by-default. v0.3.0 flips this: a fresh install is dormant until you run `/10x-engineer-enable`. Existing users whose `state.json` already contains `{"enabled": true}` are unaffected — the upgrade preserves their engaged state verbatim. To restore engaged-by-default behaviour after upgrading, run `/10x-engineer-enable` once.

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
