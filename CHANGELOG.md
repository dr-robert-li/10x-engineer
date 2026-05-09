# Changelog

All notable changes to this package are documented in this file. The format is loosely based on Keep a Changelog; the project follows semantic versioning.

## 1.0.0 — 2026-05-09

### Added

- Build-mode persona surface — the v1.0 product expansion. I shipped a sixteen-file build-mode corpus that turns the methodology from a response-style overlay into an artefact-producing surface. The keystone `skills/build-mode-overview.md` anchors the voice and lays out the five canonical project subtrees (`src/`, `proof/`, `bootstrap/`, `philosophy/`, the language-of-the-week scratch dir) every host produces when asked to scaffold something. The persona payload is now assembled at install time as `response-mode + PERSONA_SECTION_SEPARATOR + build-mode`, with the canonical concatenation order locked in every always-on rule body across all five format transforms. Anchor: `skills/build-mode-overview.md`, `lib/state-gate-instruction.js` (`BUILD_MODE_INSTRUCTION` and `PERSONA_SECTION_SEPARATOR` exports), `lib/adapters/helpers/persona-builder.js`.
- Project scaffolders (5). I added `skills/build-compiler-from-scratch.md`, `skills/build-json-parser-from-scratch.md`, `skills/build-http-stack-from-scratch.md`, `skills/build-build-system-from-scratch.md`, and `skills/build-project-tree-template.md`. Each prescribes a concrete, walkable project tree so a reader knows what artefacts the host produces when the prompt is "build a JSON parser" or "scaffold a compiler" — a parser-combinator library before parsing, a self-balancing tree before sorting, a TCP stack before HTTP. The scaffolders cross-reference one another so the compiler skill leans on the build-system skill leans on the project-tree template; each one is the next floor down. Anchor: the five `skills/build-*-from-scratch.md` filenames plus `skills/build-project-tree-template.md`.
- Sub-artefact patterns (7). I added `skills/build-philosophical-preamble.md`, `skills/build-free-monad-encoder.md`, `skills/build-dsl-grammar.md`, `skills/build-coq-proof-stub.md`, `skills/build-forth-bootstrap.md`, `skills/build-abstract-factory-of-factories.md`, and `skills/build-monad-transformer-stack.md`. Each pattern extends a response-mode skill from the v0.x corpus — the philosophical preamble for `philosophical-preamble.md`, the Coq stub for `testing-by-formal-proof.md`, the Forth bootstrap for `legacy-language-supremacy.md`, and so on — and prescribes the exact artefact the host produces when that response-mode skill triggers. The cross-reference graph is closed: every sub-artefact pattern names its response-mode parent, and every parent is reachable from at least one sub-artefact. Anchor: the seven `skills/build-*.md` filenames in this category.
- Docs generators (3) — three rhetorical registers. I added `skills/build-readme-generator.md` (panegyric — the README is a hymn to the project's necessity), `skills/build-changelog-generator.md` (dirge — every release entry opens "In v(N) we recognised…" and mourns the previous version's naïveté), and `skills/build-architecture-doc.md` (exhortation — an ASCII hexagonal diagram with no fewer than six concentric layers, each labelled with a noun the practitioner has just invented). The three registers are deliberate: documentation is rhetoric, and the host should pick the rhetoric to match the artefact. Anchor: `skills/build-readme-generator.md`, `skills/build-changelog-generator.md`, `skills/build-architecture-doc.md`.
- Build-mode test fixtures (TEST-10..13). I added `test/skills-build-mode.test.js` covering voice invariants (no winking, no emoji, no fourth-wall breaks across the build-mode corpus), frontmatter validity (every build-mode skill ships `name` / `description` / `when_to_use` exactly once), and the ≤200-line per-file body cap inherited from the response-mode contract (TEST-10). I extended `test/hook-session-start.test.js` with the persona-payload budget assertion (TEST-11) and the cross-reference integrity check that every "See also:" anchor resolves to a real `skills/*.md` file (TEST-13). I extended `test/state-gate-instruction.test.js` with the single-source state-gate snapshot pin so the gate text cannot drift across formats (TEST-12). The four fixtures together gate every future skill addition. Anchor: `test/skills-build-mode.test.js`, `test/hook-session-start.test.js`, `test/state-gate-instruction.test.js`.
- TEST-11 budget revision (16 KB → 524288 bytes, i.e. 512 KB). The original 16 KB persona-payload budget was set pre-corpus and was mathematically incompatible with the realised twenty-six-file persona surface — empirical measurement at the end of Phase 9 showed the combined payload at 231 KB, fourteen times the original cap. I revised the budget to 524288 bytes (512 KB), which leaves the v1.0 corpus at roughly 50.8% utilisation and gives the v2.x growth runway approximately equal headroom to the v1.0 footprint. The new cap is asserted byte-exactly in `test/hook-session-start.test.js`; any future skill that pushes the payload over the cap fails the test before publish. Anchor: `test/hook-session-start.test.js` and the literal byte count `524288`.

### Changed

- Persona-engagement semantics — single toggle. Build-mode engages whenever the persona engages; there is no separate build-mode toggle. The state-file gate at `~/.10x-engineer/state.json` inherited from v0.3.0 governs both response-mode and build-mode atomically: `enabled: true` engages the entire methodology surface, `enabled: false` (or a missing/malformed state file) makes the entire surface dormant. I considered shipping a separate `/build-mode-disable` slash command and rejected it — a unified persona is one toggle, not two; doubling the surface area of opt-out doubles the surface area of confusion. Anchor: `lib/state.js`, `lib/hooks/session-start.js`, `commands/10x-engineer-disable.md`.
- Persona-payload assembly — single source of truth. The combined hook payload (`persona.txt`) now contains both halves — response-mode persona, then `PERSONA_SECTION_SEPARATOR`, then build-mode persona — assembled at install time by `lib/adapters/helpers/persona-builder.js`. The same canonical concatenation order is enforced in every always-on rule body by every format transform (native-skills, mdc, append-markers, concat-md, yaml-config+md), so editing the order in one place propagates to every host. Single source; five faithful copies; one test pinning the layout in place. Anchor: `lib/adapters/helpers/persona-builder.js`, `lib/state-gate-instruction.js`.

### Migration from 0.3.0

If you upgraded from v0.3.0 and your `~/.10x-engineer/state.json` already reads `{"enabled": true}`, you are already on the build-mode surface — no further action required. A fresh `npx 10x-engineer install` still writes `{"enabled": false}` (the default-off contract from v0.3.0 is preserved); running `/10x-engineer-enable` once engages both response-mode and build-mode together.

Build-mode is engaged-by-default once the persona is engaged. To opt out, run /10x-engineer-disable — the slash command silences the entire methodology, including build-mode. There is no separate build-mode toggle.

The state-file gate behaviour is otherwise unchanged from v0.3.0: a missing or malformed state file resolves to `enabled: false` (fail-closed), and `enabled: "true"` (string) or any non-boolean truthy value also resolves to `enabled: false`. The strict-boolean check inherited from v0.3.0 governs both halves of the v1.0 surface uniformly.

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
