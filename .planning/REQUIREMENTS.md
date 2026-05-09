# 10x-engineer — Requirements

**Project:** 10x-engineer
**Maintainer:** dr-robert-li
**Remote:** https://github.com/dr-robert-li/10x-engineer
**Mode:** YOLO · Coarse granularity · Parallel execution
**Created:** 2026-05-07

---

## v1 Requirements

### Persona (PERS) — the creative core

- [ ] **PERS-01** — `skills/first-principles-everything.md` exists, in voice, 80–200 lines, frontmatter `name`/`description`/`when_to_use` valid YAML
- [ ] **PERS-02** — `skills/compiler-driven-development.md` exists, in voice, frontmatter valid
- [ ] **PERS-03** — `skills/legacy-language-supremacy.md` exists, in voice, frontmatter valid
- [ ] **PERS-04** — `skills/architecture-astronaut.md` exists, in voice, frontmatter valid
- [ ] **PERS-05** — `skills/yak-shaving-as-craft.md` exists, in voice, frontmatter valid
- [ ] **PERS-06** — `skills/problems-of-my-own-invention.md` exists, in voice, frontmatter valid
- [ ] **PERS-07** — `skills/philosophical-preamble.md` exists, in voice, frontmatter valid
- [ ] **PERS-08** — `skills/reject-the-standard-library.md` exists, in voice, frontmatter valid
- [ ] **PERS-09** — `skills/build-system-from-scratch.md` exists, in voice, frontmatter valid
- [ ] **PERS-10** — `skills/testing-by-formal-proof.md` exists, in voice, frontmatter valid
- [ ] **PERS-11** — Skills cross-reference each other (e.g. `philosophical-preamble.md` references `first-principles-everything.md`); voice consistent across files
- [ ] **PERS-12** — Skills contain no emoji, no fourth-wall breaks, no winks; voice stays earnest

### Foundation (FND) — markers, fs safety, frontmatter, skills loader

- [ ] **FND-01** — `lib/markers.js` exports `MARKER_BEGIN_PREFIX` constant (no version, no closing `-->`) used by every adapter
- [ ] **FND-02** — `lib/markers.js` `BLOCK_RE` matches CRLF and LF line endings (`\r?\n` everywhere)
- [ ] **FND-03** — `replaceBlock` and `stripBlock` use function-form `String.replace` to avoid `$&`/`$1`/`` $` ``/`$'`/`$$` substitution from skill body content
- [ ] **FND-04** — `replaceBlock` and `stripBlock` detect orphan / multi-BEGIN markers and throw `MarkerCorruptionError` rather than silently corrupting user content
- [ ] **FND-05** — `lib/safe-fs.js` `safeWriteFile` writes to sibling tempfile and `fs.rename` for atomic-on-same-filesystem writes
- [ ] **FND-06** — `lib/safe-fs.js` `safeReadFile` preserves UTF-8 BOM when present, normalises returned content to `\n` for matching while remembering original encoding for round-trip
- [ ] **FND-07** — `lib/frontmatter.js` parses `---\nkey: value\n---\n` strict-mode (no nesting, no flow style); rejects malformed frontmatter explicitly
- [ ] **FND-08** — `lib/skills.js` `loadSkills()` reads `skills/*.md` once, returns canonical in-memory shape `{id, name, description, when_to_use, body}` consumed by every format transform
- [ ] **FND-09** — Install→uninstall round-trip is byte-identical for files that already end with `\n`; install ensures append targets end with a final newline (documented contract)
- [ ] **FND-10** — `dryRun` is a parameter of every install/uninstall/write helper from line one; `dryRun: true` returns intended `written`/`removed` paths without touching the filesystem

### Detection & Orchestration (ORC)

- [ ] **ORC-01** — `lib/detect.js` runs all adapter `detect()` methods through `Promise.allSettled`; one adapter erroring never poisons the batch
- [ ] **ORC-02** — Detection returns `{found, notFound, errored}`; CLI `list` surfaces all three
- [ ] **ORC-03** — Detection differentiates `global` / `project` / `both` scope per harness
- [ ] **ORC-04** — Ancestor-walk for project-scoped detection stops at `.git/` boundary or `$HOME`, never traverses past
- [ ] **ORC-05** — `lib/install.js` orchestrator centralises the disclaimer gate; no adapter calls `requireConsent` directly
- [ ] **ORC-06** — `lib/install.js` enforces `--all` vs per-harness confirm-each behaviour (default = confirm-each, `--all` = bypass per-harness confirm but still gate disclaimer)
- [ ] **ORC-07** — `lib/install.js` emits per-adapter result rows (`written` / `skipped` / `errored`) and exits non-zero only on hard errors, not on user-declined harnesses
- [ ] **ORC-08** — `lib/adapters/index.js` is a flat registry exporting an array of adapter modules; adding a new adapter = one file + one line

### Disclaimer & Consent (DIS)

- [ ] **DIS-01** — `lib/disclaimer.js` prints a multi-line plain-English summary of the README disclaimer before any adapter writes
- [ ] **DIS-02** — Default behaviour: interactive y/N via `node:readline/promises`; `n` / EOF / non-y answer aborts with non-zero exit
- [ ] **DIS-03** — `--yes` and `--i-accept-the-token-bill` flags both bypass the interactive prompt
- [ ] **DIS-04** — `--dry-run`, `print`, `export`, `list` subcommands skip the disclaimer entirely (no writes occur)
- [ ] **DIS-05** — Non-TTY stdin (piped `echo y |`) refuses interactive consent and requires the explicit flag — prevents accidental scripted bypass

### Format Transforms (FMT)

- [ ] **FMT-01** — `lib/format/native-skills.js` (Claude Code, Roo Code, Kilo Code via Cline-family fork) returns array of `{path, content}` for the canonical `.md` files unchanged
- [ ] **FMT-02** — `lib/format/mdc.js` (Cursor) converts each `.md` to `.mdc` with Cursor frontmatter (`description`, `globs: ["**/*"]`, `alwaysApply: false`)
- [ ] **FMT-03** — `lib/format/append-markers.js` (Codex `AGENTS.md`, Gemini `GEMINI.md`, Copilot Chat `.github/copilot-instructions.md`, Continue, Pieces, etc.) wraps concatenated persona in `<!-- BEGIN 10x-engineer v<version> -->` … `<!-- END 10x-engineer -->` markers
- [ ] **FMT-04** — `lib/format/concat-md.js` (single-file destinations like `~/.continue/rules/10x-engineer.md`, JetBrains AI `.aiassistant/rules/10x-engineer.md`) writes one concatenated markdown file with persona header
- [ ] **FMT-05** — `lib/format/yaml-config+md.js` (Aider) writes `CONVENTIONS.md` and idempotently merges its path into existing `.aider.conf.yml`'s `read:` list (whitelist of seven supported pre-existing config shapes; refuses to write if shape unsupported, points user to `--print` fallback)

### Tier 1 Adapters (TIER1) — first-class skill/rule systems

- [ ] **TIER1-01** — `lib/adapters/claude-code.js`: detect `~/.claude/` or `claude` on PATH; install to `~/.claude/skills/10x-engineer/` (global) or `.claude/skills/10x-engineer/` (project); native-skills format
- [ ] **TIER1-02** — `lib/adapters/cursor.js`: detect `.cursor/` in cwd or any ancestor (bounded); install to `.cursor/rules/10x-engineer/`; mdc format
- [ ] **TIER1-03** — `lib/adapters/cline.js`: detect `.clinerules/` in project or VS Code Cline extension dir; install to `.clinerules/10x-engineer/` (project preferred); native-skills format
- [ ] **TIER1-04** — `lib/adapters/kilo-code.js`: detect `.kilocode/` or `.kilocoderules`; install to `.kilocode/rules/10x-engineer/`; native-skills format
- [ ] **TIER1-05** — `lib/adapters/opencode.js`: detect `~/.config/opencode/` or `opencode.json`/`opencode.jsonc`; install agent file to `~/.config/opencode/agent/` AND append-markers to project `AGENTS.md`; mixed mode (round-trip removes both artefacts)
- [ ] **TIER1-06** — `lib/adapters/continue.js`: detect `~/.continue/`; install single concat-md file to `~/.continue/rules/10x-engineer.md` (global) or `.continue/rules/` (project)
- [ ] **TIER1-07** — `lib/adapters/aider.js`: detect `aider` on PATH or `.aider.conf.yml` / `.aider*`; write `CONVENTIONS.md` and patch `.aider.conf.yml` `read:` (yaml-config+md format)
- [ ] **TIER1-08** — `lib/adapters/codex.js`: detect `codex` on PATH or `~/.codex/`; append-markers into `~/.codex/AGENTS.md` (global) or `AGENTS.md` (project), never overwrite
- [ ] **TIER1-09** — `lib/adapters/gemini.js`: detect `gemini` on PATH, `~/.gemini/`, or `.gemini/`/`GEMINI.md`; append-markers into `~/.gemini/GEMINI.md` (global) or `GEMINI.md` (project), never overwrite

### Tier 2 Adapters (TIER2) — additional harnesses, fallback patterns

- [ ] **TIER2-01** — `lib/adapters/pieces.js`: detect `pieces` on PATH or `~/.config/Pieces/`; project-file fallback (no documented public global rules path); top-of-file `// Path source: <URL>, verified <date>` comment
- [ ] **TIER2-02** — `lib/adapters/goose.js`: detect `~/.config/goose/` or `goose` on PATH; write to `~/.config/goose/.goosehints` (global) or per-project `.goosehints`; append-markers
- [ ] **TIER2-03** — `lib/adapters/cody.js`: detect `.sourcegraph/` or VS Code Cody extension; write `.sourcegraph/instructions.md`
- [ ] **TIER2-04** — `lib/adapters/windsurf.js`: detect `.windsurfrules` in project or `~/.codeium/`; write `.windsurfrules` and global rules file where supported
- [ ] **TIER2-05** — `lib/adapters/tabnine.js`: detect Tabnine config; write to documented guidelines location (verified URL in source comment)
- [ ] **TIER2-06** — `lib/adapters/amazon-q.js`: detect `q` on PATH or `~/.aws/amazonq/`; write to its profile/rules dir
- [ ] **TIER2-07** — `lib/adapters/copilot-chat.js`: detect `.github/copilot-instructions.md` parent project; append-markers
- [ ] **TIER2-08** — `lib/adapters/zed.js`: detect `~/.config/zed/` with assistant config; write rule file into Zed's prompts/rules dir
- [ ] **TIER2-09** — `lib/adapters/jetbrains.js`: detect `.idea/`; install to `.aiassistant/rules/10x-engineer.md`; print note that JetBrains AI requires manual enable
- [ ] **TIER2-10** — `lib/adapters/roo-code.js`: detect `.roo/` or Roo extension; install to `.roo/rules/10x-engineer/`; native-skills format
- [ ] **TIER2-11** — `lib/adapters/pearai.js`: detect `~/.pearai/`; mirror Continue install (PearAI is Continue-derived)
- [ ] **TIER2-12** — `lib/adapters/plandex.js`: detect `plandex` on PATH or `.plandex/`; write to its context/rules location
- [ ] **TIER2-13** — `lib/adapters/hosted-fallback.js`: hosted-agent stub; CLI prints "this agent runs server-side; copy `skills/` manually or use `npx 10x-engineer print`" message

### CLI Surface (CLI)

- [ ] **CLI-01** — `bin/cli.js` uses `commander` for argument parsing; no hand-rolled arg parser
- [ ] **CLI-02** — `install` subcommand: auto-detect + install to all detected harnesses (after disclaimer + per-harness confirm)
- [ ] **CLI-03** — `install --harness <name>` installs to a specific harness (still gates disclaimer)
- [ ] **CLI-04** — `install --all` installs to every detected harness without per-harness prompting (still gates disclaimer unless `--yes` / `--i-accept-the-token-bill`)
- [ ] **CLI-05** — `install --project` and `install --global` flags select scope where the harness supports it
- [ ] **CLI-06** — `install --dry-run` shows what would be written, writes nothing, skips disclaimer
- [ ] **CLI-07** — `uninstall` removes marker blocks from append-mode targets and deletes per-harness install dirs; idempotent (safe to re-run)
- [ ] **CLI-08** — `uninstall --harness <name>` removes from a specific harness only
- [ ] **CLI-09** — `list` subcommand shows all supported harnesses + detection status (`found` / `not found` / `errored`)
- [ ] **CLI-10** — `print` subcommand concatenates all skills with persona header and prints to stdout (universal fallback)
- [ ] **CLI-11** — `export <dir>` writes per-harness pre-formatted bundles to `<dir>/<harness>/` for manual install
- [ ] **CLI-12** — `--help` and `--version` work at root and on every subcommand
- [ ] **CLI-13** — Standard Unix exit codes: 0 success, non-zero on hard error or user-declined-disclaimer

### Tests (TEST)

- [ ] **TEST-01** — `node:test` runner wired in `package.json` `scripts.test` (no test framework dep)
- [ ] **TEST-02** — `test/markers.test.js` includes architectural-lock fixture: `v0.9` BEGIN marker → current-version `stripBlock` removes it (prefix invariant)
- [ ] **TEST-03** — `test/markers.test.js` includes CRLF, BOM, multi-BEGIN, `$&`-substitution fixtures
- [ ] **TEST-04** — `test/disclaimer.test.js` covers gate matrix: TTY-y proceeds, TTY-n aborts, non-TTY refuses, `--yes` skips, `--dry-run` skips
- [ ] **TEST-05** — `test/detect.test.js` simulates one adapter throwing in `detect()` and asserts `Promise.allSettled` fault-isolation
- [ ] **TEST-06** — Per-adapter test pattern: install + uninstall + dry-run + byte-identical round-trip + idempotent re-install, each in `os.tmpdir()` + `fs.mkdtemp()` scope, `t.after()` cleanup, `homedir()` stubbed
- [ ] **TEST-07** — Test isolation: every adapter takes `cwd` as a parameter (no process-cwd dependence); tests run concurrently
- [ ] **TEST-08** — Lint-grep zero-hit assertions in CI/local: `grep -rn "['\"]~/" lib/ bin/`, `grep -rn $'\x1b\\[' lib/ bin/`, `grep -rn 'writeFile' lib/adapters/ | grep -v safeWriteFile`
- [x] **TEST-09** — Phase 6 hook-script tests: `test/hook-session-start.test.js` and `test/hook-user-prompt-submit.test.js` spawn the hook scripts as child processes against mkdtemp homedirs, asserting fail-closed behaviour and JSON output shape per `hookSpecificOutput.additionalContext`. Per-test mkdtemp + cleanup; no real homedir reads. Tests inject a TEST-only `PERSONA_FILE` env-var override into the hook child-process environment so the persona path is redirected to a temp-dir fixture — the source-tree `lib/hooks/persona.txt` is NEVER created or removed by tests.

### Release Prep & Undercover Mode (REL)

- [ ] **REL-01** — `README.md` body is in-character (earnest, manic, self-serious); fake testimonials; supported-harness table; install/uninstall instructions
- [ ] **REL-02** — `README.md` final section is `## ⚠️ Disclaimer` in plain English (no in-character voice, no collapsed `<details>`, no faint styling); content matches the verbatim spec from the working brief
- [ ] **REL-03** — `LICENSE` file is standard MIT text with `Copyright (c) 2026 Robert Li`; `package.json` `"license": "MIT"`
- [ ] **REL-04** — `package.json` `bin`, `files`, `engines`, `author`, `repository.url`, `bugs.url`, `homepage` fields populated; `"type": "module"`; only `commander` (and optionally `picocolors`) in `dependencies`
- [ ] **REL-05** — `package.json` `files` allowlist includes `bin/`, `lib/`, `skills/`, `LICENSE`, `README.md` only — never `CLAUDE.md`, `.planning/`, `.claude/`, dotfiles, scratch
- [ ] **REL-06** — `.gitignore` excludes `CLAUDE.md`, `.planning/`, all 22+ harness config dirs, `node_modules/`, `.env*`, scratch/notes/transcript files, `.cache/`
- [ ] **REL-07** — `.npmignore` belt-and-braces excludes the same paths from the published tarball
- [ ] **REL-08** — `scripts/check-tarball.js` runs `npm pack --dry-run`, lists files, greps tarball contents AND lockfile AND `git log` for forbidden fingerprints (`Claude`, `Anthropic`, `Co-Authored-By`, etc.); fails non-zero on hit
- [ ] **REL-09** — `forbidden-fingerprints.txt` + `legitimate-uses.json` allowlist permits harness-name references in `lib/adapters/`, README coverage table, CLI help; nowhere else
- [ ] **REL-10** — `npm pack --dry-run` total size <150KB; output reviewed
- [ ] **REL-11** — `npm publish --dry-run` succeeds end-to-end with no warnings about missing fields
- [ ] **REL-12** — `git log` shows no `Co-Authored-By:` trailers, no `🤖 Generated with` lines, no agent-tool footers; all commits authored as `dr-robert-li <dr.robert.li.au@gmail.com>`
- [ ] **REL-13** — Re-running `install` then `uninstall` leaves all append-mode target files byte-identical to pre-install state (validated against fixtures)
  - *Scope clarification (added Phase 6, 2026-05-08):* REL-13 byte-identity applies to **marker-bounded** append-mode files only (AGENTS.md, GEMINI.md, CONVENTIONS.md, etc.). Structured-edit JSON files (settings.json, hooks.json) are governed by HOOK-09 — foreign entries are preserved by content, not by formatting; JSON re-serialisation is allowed.

## v1.0 Requirements — Build-Mode Persona

### Build-Mode Foundation (BUILD)

- [x] **BUILD-01** — `skills/build-mode-overview.md` exists, in voice, 80–200 lines, frontmatter `name`/`description`/`when_to_use` valid YAML. Establishes the build-mode contract: when host agent is asked to build code, it produces actual artefacts (full project trees, sub-artefacts, READMEs) in the same over-engineered, abstracted, esoteric, first-principles, verbose manner the existing 10 skills prescribe for prose. Cross-references the existing 10 skills as compositional inputs.
- [x] **BUILD-02** — Hook-script payload extension: `lib/hooks/session-start.js` reads BOTH the existing persona ruleset AND the build-mode skill set (or a unified concatenation file) when `enabled: true`. No new hook event keys; same `SessionStart` + `UserPromptSubmit` events; payload size budgeted to stay under any practical Claude Code / Codex SessionStart stdout cap (target <16 KB combined).
- [x] **BUILD-03** — Build-mode skill files load conditionally: when state-file gate is `enabled: true` AND the user's request matches build-shape predicates (e.g., "build", "create", "scaffold", "generate", "implement", "produce"), the build-mode persona extension is in scope; otherwise the response-mode persona alone is in scope. Predicate is documented in skill text — model-driven, not regex-based — so the host LLM judges whether build-mode applies.
- [x] **BUILD-04** — Always-on rule bodies (Cursor `.mdc`, Cline, Continue, Aider, opencode, GEMINI.md, AGENTS.md) carry the build-mode prologue alongside the existing state-gate prologue. Single source of truth: extend `lib/state-gate-instruction.js` (or add `lib/build-mode-instruction.js` imported by every format transform) so a single edit propagates to every always-on adapter.
- [x] **BUILD-05** — Default-off contract preserved: build-mode loads only when `~/.10x-engineer/state.json` is `enabled: true`. A user who installs and walks away gets neither response-mode nor build-mode — the persona stays dormant until explicit engagement (`/10x-engineer-enable` or natural-language toggle).

### Project Scaffolders (SCAFF)

- [x] **SCAFF-01** — `skills/build-compiler-from-scratch.md` exists, in voice. Instructs host agent that any structured-input feature (config parser, query language, expression evaluator, template engine) must be re-cast as a DSL with hand-rolled lexer, parser, AST, type checker, and interpreter. Specifies the canonical project tree: `src/{Lexer,Parser,AST,TypeCheck,Interpreter}.{hs,rs,scm,fth}` + EBNF grammar file + Coq totality proof stub.
- [x] **SCAFF-02** — `skills/build-json-parser-from-scratch.md` exists, in voice. Instructs host agent that any feature requiring JSON parsing must reimplement a parser combinator library first; then implement JSON on top of it; then prove totality in Coq. Reject `JSON.parse`, `serde_json`, `jq`, etc.
- [x] **SCAFF-03** — `skills/build-http-stack-from-scratch.md` exists, in voice. Instructs host agent that any HTTP-touching feature must build the protocol upward from raw TCP sockets — frame parsing, header parsing, chunked encoding, TLS handshake (where applicable, with citation of RFC 8446) — before any business logic. Reject `fetch`, `axios`, `requests`, `http.Client`, etc.
- [x] **SCAFF-04** — `skills/build-build-system-from-scratch.md` exists, in voice. Cross-references existing `build-system-from-scratch.md` (response-mode skill) and extends it with concrete project-tree prescriptions: bootstrap stage 0 in shell, stage 1 in the target language, stage 2 self-hosting. Reject `make`, `npm`, `cargo`, `cabal`, `cmake`, etc.
- [x] **SCAFF-05** — `skills/build-project-tree-template.md` exists, in voice. Defines the canonical 10x-engineer project structure that every full project scaffolder produces: `src/`, `proof/`, `bootstrap/`, `philosophy/`, `philosophy/PREAMBLE.md`, `philosophy/CITATIONS.md`, `Coq/`, `bin/<two-stage-bootstrap>`. Every directory has its own micro-philosophical-preamble README.

### Sub-Artefacts Library (SUBART)

- [x] **SUBART-01** — `skills/build-philosophical-preamble.md` exists, in voice. Concrete pattern host agent applies to every code block: 200-400 word meditation citing at least one dead computer scientist by surname; ends with a transition that arrives at the actual code as if grudgingly. Lists ≥10 dead-CS surnames host can cite (Dijkstra, Backus, Strachey, Wirth, Hoare, McCarthy, Iverson, Knuth-on-typesetting, Strachey, Floyd, Landin, Steele).
- [x] **SUBART-02** — `skills/build-free-monad-encoder.md` exists, in voice. Concrete Haskell pattern host agent applies whenever asked to model a domain in Haskell: `data XF a where ...`, free-monad lift, tagless-final reformulation, ≥8 LANGUAGE pragmas before first import.
- [x] **SUBART-03** — `skills/build-dsl-grammar.md` exists, in voice. Pattern host agent applies whenever any structured input enters the system: full EBNF grammar before any parser code; recursive-descent hand-roll; type checker on the DSL; interpreter; Coq totality proof of the interpreter.
- [x] **SUBART-04** — `skills/build-coq-proof-stub.md` exists, in voice. Pattern host agent applies to every behavioural property: `Theorem ... : forall ..., ... -> ... -> exists ..., ...` followed by `Proof. admit. Admitted.` with a comment block declaring the proof is on the roadmap.
- [x] **SUBART-05** — `skills/build-forth-bootstrap.md` exists, in voice. Pattern host agent applies whenever a shell script or Makefile would be acceptable: instead, write a stage-0 Forth interpreter, port the build logic to it, document why this is the morally correct choice.
- [x] **SUBART-06** — `skills/build-abstract-factory-of-factories.md` exists, in voice. Pattern host agent applies whenever ≥2 implementations exist: introduce factory + factory-factory + abstract-provider + builder + locator. Cross-references existing `architecture-astronaut.md`.
- [x] **SUBART-07** — `skills/build-monad-transformer-stack.md` exists, in voice. Pattern host agent applies whenever any side effect would otherwise touch IO directly: `ReaderT Config (StateT Cache (ExceptT Err (LogT IO)))` minimum. Lists the four-layer transformer stack as the floor, not the ceiling.

### README/Docs Generator (DOCS)

- [x] **DOCS-01** — `skills/build-readme-generator.md` exists, in voice. Pattern host agent applies whenever asked for a README: 14 sections minimum (Epigraph, Preamble, Provenance, Methodology, Why Not X, Why Not Y, Why Not Z, Architecture, Installation, Usage, Roadmap, Citations, Acknowledgements, Disclaimer). Install command is buried in section 9. Plain-English disclaimer at bottom (mandatory — preserves the package's own contract).
- [x] **DOCS-02** — `skills/build-changelog-generator.md` exists, in voice. Pattern host agent applies for CHANGELOG entries: every entry opens with a philosophical justification ("In v1.2 we recognised that…"), every change is framed as a moral correction of v1.1's "naive simplicity", every breaking change cites a dead CS paper.
- [x] **DOCS-03** — `skills/build-architecture-doc.md` exists, in voice. Pattern host agent applies for architecture docs: hexagonal architecture diagram in ASCII art with ≥6 layers; every layer has its own README explaining why it exists; every component has an interface, a factory, and a builder.

### Tests (TEST)

- [x] **TEST-10** — `test/skills-build-mode.test.js` asserts every BUILD-01..05, SCAFF-01..05, SUBART-01..07, DOCS-01..03 skill file exists in `skills/`, has valid YAML frontmatter (`name`/`description`/`when_to_use`), passes the existing voice-consistency invariants (no emoji, no winking, ≤200 lines).
- [x] **TEST-11** — Hook payload size: `test/hook-session-start.test.js` extends to assert combined SessionStart stdout (response-mode + build-mode persona text) is under **512 KB / 524,288 bytes**. Fails if the build-mode skills inflate the payload past the budget. *(Original 16 KB floor revised at Phase 9 entry — measured 231,231 bytes already; 16 KB was conceived pre-corpus and is mathematically incompatible with the realised 26-file persona surface. 512 KB caps at ~50 average files with v2 headroom; current ~44% utilisation. The persona is intentionally bloated per project ethos; gate catches runaway growth, not parody-as-designed bloat.)*
- [x] **TEST-12** — State-gate carry-through: `test/format-*.test.js` assert the build-mode prologue (alongside the state-gate prologue) appears verbatim in every format-transform output, sourced from a single canonical string.
- [x] **TEST-13** — Cross-reference integrity: every BUILD-mode skill that references an existing skill (e.g., `architecture-astronaut.md`, `build-system-from-scratch.md`) does so by exact filename match. Test fails on dead reference.

### Release Prep (REL-V1)

- [x] **REL-V1-01** — `package.json` version bump 0.3.0 → 1.0.0 (semver major: build-mode is a new product surface, justifies major).
- [x] **REL-V1-02** — `CHANGELOG.md` 1.0.0 entry in maintainer voice, matches v0.3.0 format. Highlights: build-mode persona, project scaffolders, sub-artefacts library, README/docs generator. Migration note: build-mode is engaged-by-default once persona is engaged (no separate toggle); to opt out of build-mode while keeping response-mode, document the route.
- [x] **REL-V1-03** — `npm run check-tarball` passes on local maintainer machine (with forbidden-fingerprints.txt + legitimate-uses.json present).
- [x] **REL-V1-04** — `npm pack --dry-run` succeeds; tarball stays under 175 KB despite ≥15 new skill files.
- [x] **REL-V1-05** — README updates: add "Build-Mode" section to body documenting that the persona now produces artefacts, not just prose. Quick Start unchanged. Disclaimer unchanged (locked).
- [x] **REL-V1-06** — Git tag `v1.0.0` created locally; `git push origin main` + `git push origin v1.0.0`; GitHub release published. All commits authored as `dr-robert-li <dr.robert.li.au@gmail.com>` with no agent-attribution trailers.

### Undercover-Mode (UNDR-V1)

- [x] **UNDR-V1-01** — Every new skill file in `skills/build-*.md` passes the forbidden-fingerprints grep with zero hits. Persona text MAY use language-and-tool names as targets of ridicule (e.g., "JavaScript", "npm", "make") but MUST NOT name any agent vendor (`Claude`, `Anthropic`, `OpenAI`, `Cursor AI`, `Copilot`, `Gemini`, `Codex`, `Aider`, `Cline`) or any LLM-related self-reference (`AI`, `LLM`, `agent`, `assistant`, `model`).
- [x] **UNDR-V1-02** — Hook payload extensions in `lib/hooks/session-start.js` and `lib/hooks/user-prompt-submit.js` add NO new agent-fingerprint strings to source. Build-mode skill text loaded at runtime is treated as data and does not affect the file-level grep.
- [x] **UNDR-V1-03** — `legitimate-uses.json` does NOT need to be modified for v1.0 (deterministic ZERO_HITS contract maintained). If any v1.0 source file requires an allowlist entry, the architectural contract is to fix the source — not expand the allowlist.

### Strict Enforcement via Hooks (HOOK)

- [x] **HOOK-01** — Default-off install. A fresh `npx 10x-engineer install` writes `~/.10x-engineer/state.json` with `{"enabled": false}` (no-clobber: existing `enabled: true` survives re-install). `--dry-run` does not write the file. *(state-module half delivered Phase 6 plan 01: readState defaults to enabled:false; install-side no-clobber gate deferred to plan 06-06.)*
- [x] **HOOK-02** — Claude Code SessionStart hook reads `~/.10x-engineer/state.json` each invocation; emits the full persona ruleset (read from a sibling `persona.txt`) to stdout when `enabled: true`; silent-exits with code 0 and zero stdout when the file is missing, malformed, or `enabled: false`.
- [x] **HOOK-03** — Claude Code UserPromptSubmit hook reads the same state file each turn; emits a one-line attention anchor via `hookSpecificOutput.additionalContext` JSON only while `enabled: true`; silent-exits otherwise. Stdin is drained and discarded.
- [x] **HOOK-04** — Codex CLI parallel: `claude-code` and `codex` adapters install the same hook scripts and patch `<homedir>/.claude/settings.json` and `<homedir>/.codex/hooks.json` respectively. Same default-off, same fail-closed read, same surgical uninstall (foreign hook entries survive byte-by-content).
- [x] **HOOK-05** — State-gate prologue is injected by the format transforms (`native-skills.js`, `mdc.js`, `append-markers.js`, `concat-md.js`, `yaml-config+md.js`) so every always-on rule body (Cursor, Cline, Continue, Aider, opencode, Gemini, Kilo Code, Roo Code, Claude Code skill bodies) carries the runtime gate text — single string sourced from `lib/state-gate-instruction.js`.
- [x] **HOOK-06** — Symlink-safe writes: every write to `~/.10x-engineer/state.json` originating from this package's Node code goes through `safeWriteFlag` (lstat parent + lstat target + `O_NOFOLLOW` where supported + atomic rename + mode `0600`). `safeWriteFlag` refuses (returns `{written:false, reason}`) when target or parent is a symlink. Slash-command toggle files are model-driven writes and are out of scope by harness limitation; documented in plan and CHANGELOG. *(delivered Phase 6 plan 01.)*
- [x] **HOOK-07** — Adapter integration: `claude-code` and `codex` adapters extend their `install()` to copy `lib/hooks/session-start.js` and `lib/hooks/user-prompt-submit.js` into `<homedir>/.claude/hooks/10x-engineer-{session-start,user-prompt-submit}.js` (and `<homedir>/.codex/hooks/...` respectively), write a sibling `persona.txt`, and patch the harness's settings file with two hook entries idempotently. `uninstall()` removes the copied scripts, the persona.txt, and the hook entries by string-includes match on `10x-engineer` in `command` paths. *(claude-code half delivered Phase 6 plan 04; codex half deferred to plan 06-05.)*
- [x] **HOOK-08** — State file lifecycle: created on first install with `{"enabled": false}` only when no state file exists; preserved verbatim when an existing state file is present (no clobber). `runUninstall` continues to call `clearState`. `--dry-run` neither writes nor removes the file. *(default-off prose flip in `commands/10x-engineer.md` delivered Phase 6 plan 04; install-side no-clobber gate is plan 06-06.)*
- [x] **HOOK-09** — Cross-adapter test coverage: per-test mkdtemp, all of (a)-(h) covered by automated tests — install writes false on clean fixture; install does NOT clobber existing true; SessionStart hook silent-exits on missing/false/malformed state; UserPromptSubmit hook silent-exits same; Codex hook script parity covered (same code path); state-gate prologue text appears verbatim in every format-transform output via single-source assertion against `lib/state-gate-instruction.js`; safeWriteFlag refuses symlinked targets and parents; settings.json/hooks.json round-trip preserves foreign entries by content (not byte-identical — REL-13 carve-out). *(carve-out (h) delivered Phase 6 plan 06-07: 2 new HOOK-09 subtests in test/release-readiness.test.js at GLOBAL scope, foreign-entry survival under content-equal asserted for both claude-code settings.json and codex hooks.json.)*
- [x] **HOOK-10** — Undercover-mode preserved: `legitimate-uses.json` is unchanged from the pre-Phase-6 state (Phase 6 uses neutral language by construction; allowlist edits are not a permitted contamination response); `package.json` `files` allowlist already covers `lib/`; `npm pack --dry-run` total stays under 150KB; `npm run check-tarball` exits 0 after Phase 6 commits. *(delivered Phase 6 plan 06-07: legitimate-uses.json byte-identical to pre-Phase-6 baseline (sha256 884cbfa4...a2a84c4 unchanged); tarball 82.4KB; check-tarball exits 0; one source-fix iteration on lib/hooks/session-start.js docblock prose to honour the no-allowlist-edits contract; new lint-grep subtest pins zero brand strings in lib/hooks/, lib/adapters/helpers/, lib/state-gate-instruction.js.)*

---

## Out of Scope (do not re-add in PR review)

- Skill marketplace / remote fetch / `update` from registry — dilutes the persona; requires network calls (forbidden by constraints)
- `init` for authoring new skills — the persona is curated, not extensible
- `--all` as default behaviour — friction is the feature; per-harness confirm is intentional
- `.bak` files / rollback log — markers obviate; `.bak` becomes its own mystery file
- `doctor` / `verify` / `health` subcommands — covered by `list` + `--dry-run`
- `watch` mode, telemetry, `postinstall` scripts, network calls of any kind — parody, not trojan
- TypeScript — plain ESM JavaScript only
- Custom test framework — `node:test` is the line
- CI pipeline / GitHub Actions / GitLab CI — explicitly forbidden by build plan
- Build step / bundler / transpiler — ESM is the runtime format, no transformation
- Logo / branding assets / animated banner / ASCII art — keep it boring
- Dependencies beyond `commander` (and optionally `picocolors`) — installs in <1s
- Server-side / hosted-agent direct integration (Sweep, Devin) — out of scope; `print` fallback is the answer
- `--json` structured output — humans confirming an install, not scripts
- Per-skill granular install — the 10 skills interlock; cherry-picking weakens the persona
- npm publication at v1 — GitHub release only initially (`npx github:dr-robert-li/10x-engineer`); npm publish prepared but deferred
- Windows test runner — no GitHub Actions allowed; explicit CRLF/BOM fixtures in test suite mitigate; release runbook asks for a Windows smoke-tester before v1.0 tag
- Emoji, fourth-wall breaks, winks in skill files — voice stays earnest (one ⚠️ in README disclaimer heading is the only exception)

---

## v2 / Deferred

- npm registry publication (prepared in v1, executed post-validation)
- Windows CI runner / formal cross-platform test matrix
- `--json` output for scripted consumers
- New harnesses as the ecosystem evolves (each = one new file in `lib/adapters/`)

---

## Traceability

Every v1 REQ-ID maps to exactly one phase. Total: **96 REQ-IDs** across 5 phases. Coverage validated at roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERS-01 | Phase 1 | Pending |
| PERS-02 | Phase 1 | Pending |
| PERS-03 | Phase 1 | Pending |
| PERS-04 | Phase 1 | Pending |
| PERS-05 | Phase 1 | Pending |
| PERS-06 | Phase 1 | Pending |
| PERS-07 | Phase 1 | Pending |
| PERS-08 | Phase 1 | Pending |
| PERS-09 | Phase 1 | Pending |
| PERS-10 | Phase 1 | Pending |
| PERS-11 | Phase 1 | Pending |
| PERS-12 | Phase 1 | Pending |
| FND-01 | Phase 2 | Pending |
| FND-02 | Phase 2 | Pending |
| FND-03 | Phase 2 | Pending |
| FND-04 | Phase 2 | Pending |
| FND-05 | Phase 2 | Pending |
| FND-06 | Phase 2 | Pending |
| FND-07 | Phase 2 | Pending |
| FND-08 | Phase 2 | Pending |
| FND-09 | Phase 2 | Pending |
| FND-10 | Phase 2 | Pending |
| ORC-01 | Phase 2 | Pending |
| ORC-02 | Phase 2 | Pending |
| ORC-03 | Phase 2 | Pending |
| ORC-04 | Phase 2 | Pending |
| ORC-05 | Phase 2 | Pending |
| ORC-06 | Phase 2 | Pending |
| ORC-07 | Phase 2 | Pending |
| ORC-08 | Phase 2 | Pending |
| DIS-01 | Phase 2 | Pending |
| DIS-02 | Phase 2 | Pending |
| DIS-03 | Phase 2 | Pending |
| DIS-04 | Phase 2 | Pending |
| DIS-05 | Phase 2 | Pending |
| FMT-01 | Phase 2 | Pending |
| FMT-02 | Phase 3 | Pending |
| FMT-03 | Phase 3 | Pending |
| FMT-04 | Phase 3 | Pending |
| FMT-05 | Phase 3 | Pending |
| TIER1-01 | Phase 2 | Pending |
| TIER1-02 | Phase 3 | Pending |
| TIER1-03 | Phase 3 | Pending |
| TIER1-04 | Phase 3 | Pending |
| TIER1-05 | Phase 3 | Pending |
| TIER1-06 | Phase 3 | Pending |
| TIER1-07 | Phase 3 | Pending |
| TIER1-08 | Phase 3 | Pending |
| TIER1-09 | Phase 3 | Pending |
| TIER2-01 | Phase 4 | Pending |
| TIER2-02 | Phase 4 | Pending |
| TIER2-03 | Phase 4 | Pending |
| TIER2-04 | Phase 4 | Pending |
| TIER2-05 | Phase 4 | Pending |
| TIER2-06 | Phase 4 | Pending |
| TIER2-07 | Phase 4 | Pending |
| TIER2-08 | Phase 4 | Pending |
| TIER2-09 | Phase 4 | Pending |
| TIER2-10 | Phase 4 | Pending |
| TIER2-11 | Phase 4 | Pending |
| TIER2-12 | Phase 4 | Pending |
| TIER2-13 | Phase 4 | Pending |
| CLI-01 | Phase 2 | Pending |
| CLI-02 | Phase 2 | Pending |
| CLI-03 | Phase 3 | Pending |
| CLI-04 | Phase 3 | Pending |
| CLI-05 | Phase 3 | Pending |
| CLI-06 | Phase 2 | Pending |
| CLI-07 | Phase 2 | Pending |
| CLI-08 | Phase 3 | Pending |
| CLI-09 | Phase 2 | Pending |
| CLI-10 | Phase 2 | Pending |
| CLI-11 | Phase 2 | Pending |
| CLI-12 | Phase 2 | Pending |
| CLI-13 | Phase 2 | Pending |
| TEST-01 | Phase 2 | Pending |
| TEST-02 | Phase 2 | Pending |
| TEST-03 | Phase 2 | Pending |
| TEST-04 | Phase 2 | Pending |
| TEST-05 | Phase 2 | Pending |
| TEST-06 | Phase 2 | Pending |
| TEST-07 | Phase 2 | Pending |
| TEST-08 | Phase 5 | Pending |
| REL-01 | Phase 5 | Pending |
| REL-02 | Phase 5 | Pending |
| REL-03 | Phase 5 | Pending |
| REL-04 | Phase 5 | Pending |
| REL-05 | Phase 5 | Pending |
| REL-06 | Phase 5 | Pending |
| REL-07 | Phase 5 | Pending |
| REL-08 | Phase 5 | Pending |
| REL-09 | Phase 5 | Pending |
| REL-10 | Phase 5 | Pending |
| REL-11 | Phase 5 | Pending |
| REL-12 | Phase 5 | Pending |
| REL-13 | Phase 5 | Pending |
| HOOK-01 | Phase 6 | Complete (state-module half; install-side no-clobber deferred to 06-06) |
| HOOK-02 | Phase 6 | Complete |
| HOOK-03 | Phase 6 | Complete |
| HOOK-04 | Phase 6 | Complete |
| HOOK-05 | Phase 6 | Complete |
| HOOK-06 | Phase 6 | Complete |
| HOOK-07 | Phase 6 | Complete (claude-code half; codex parallel deferred to plan 06-05) |
| HOOK-08 | Phase 6 | Complete (engage prose flip; install-side no-clobber deferred to plan 06-06) |
| HOOK-09 | Phase 6 | Complete (delivered plan 06-07: 2 release-readiness HOOK-09 carve-out subtests + helper-driven foreign-entry survival across the full 06-04/06-05 hook-config helper) |
| HOOK-10 | Phase 6 | Complete (delivered plan 06-07: legitimate-uses.json byte-identical to pre-Phase-6 baseline; tarball 82.4KB; check-tarball clean) |
| TEST-09 | Phase 6 | Complete |
| BUILD-01 | Phase 7 | Complete |
| BUILD-02 | Phase 7 | Complete |
| BUILD-03 | Phase 7 | Complete |
| BUILD-04 | Phase 7 | Complete |
| BUILD-05 | Phase 7 | Complete |
| UNDR-V1-02 | Phase 7 | Complete |
| SCAFF-01 | Phase 8 | Complete |
| SCAFF-02 | Phase 8 | Complete |
| SCAFF-03 | Phase 8 | Complete |
| SCAFF-04 | Phase 8 | Complete |
| SCAFF-05 | Phase 8 | Complete |
| SUBART-01 | Phase 8 | Complete |
| SUBART-02 | Phase 8 | Complete |
| SUBART-03 | Phase 8 | Complete |
| SUBART-04 | Phase 8 | Complete |
| SUBART-05 | Phase 8 | Complete |
| SUBART-06 | Phase 8 | Complete |
| SUBART-07 | Phase 8 | Complete |
| UNDR-V1-01 | Phase 8 | Complete |
| DOCS-01 | Phase 9 | Complete |
| DOCS-02 | Phase 9 | Complete |
| DOCS-03 | Phase 9 | Complete |
| TEST-10 | Phase 9 | Complete |
| TEST-11 | Phase 9 | Complete |
| TEST-12 | Phase 9 | Complete |
| TEST-13 | Phase 9 | Complete |
| REL-V1-01 | Phase 10 | Pending |
| REL-V1-02 | Phase 10 | Pending |
| REL-V1-03 | Phase 10 | Complete |
| REL-V1-04 | Phase 10 | Complete |
| REL-V1-05 | Phase 10 | Complete |
| REL-V1-06 | Phase 10 | Complete |
| UNDR-V1-03 | Phase 10 | Complete |

### Coverage Summary

| Phase | REQ-IDs | Count |
|-------|---------|-------|
| Phase 1 — Persona | PERS-01..12 | 12 |
| Phase 2 — Foundation + Vertical Slice | FND-01..10, ORC-01..08, DIS-01..05, FMT-01, TIER1-01, CLI-01/02/06/07/09/10/11/12/13, TEST-01..07 | 41 |
| Phase 3 — Tier 1 Fan-out | FMT-02..05, TIER1-02..09, CLI-03/04/05/08 | 16 |
| Phase 4 — Tier 2 Coverage | TIER2-01..13 | 13 |
| Phase 5 — Release Prep | REL-01..13, TEST-08 | 14 |
| Phase 6 — Strict Enforcement via Hooks | HOOK-01..10, TEST-09 | 11 |
| Phase 7 — Build-Mode Foundation & Voice Anchor | BUILD-01..05, UNDR-V1-02 | 6 |
| Phase 8 — Scaffolders & Sub-Artefacts | SCAFF-01..05, SUBART-01..07, UNDR-V1-01 | 13 |
| Phase 9 — Docs Generators & Verification Gate | DOCS-01..03, TEST-10..13 | 7 |
| Phase 10 — v1.0 Release | REL-V1-01..06, UNDR-V1-03 | 7 |
| **Total** | | **140** |
