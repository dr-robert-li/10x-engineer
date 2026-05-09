---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Build-Mode Persona
status: verifying
stopped_at: Phase 10 plan 04 complete — README Build-Mode section committed (3ac2b0d); next 10-05 verification gate + v1.0.0 tag + manual handoff
last_updated: "2026-05-09T21:24:12.596Z"
last_activity: 2026-05-09
progress:
  total_phases: 10
  completed_phases: 4
  total_plans: 30
  completed_plans: 30
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** The ten skill files must be funny when read standalone — earnest, never winking — and must install cleanly into every supported harness with surgical, marker-based uninstall.
**Current focus:** Phase 10 — v1-0-release

## Current Position

Phase: 10 (v1-0-release) — EXECUTING
Plan: 5 of 5
Status: Phase complete — ready for verification
Last activity: 2026-05-09

## Performance Metrics

**Velocity:**

- Total plans completed: 7
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Persona | 8/8 | — | — |
| 2. Foundation + Vertical Slice | 0/8 | — | — |
| 3. Tier 1 Fan-out | 0/13 | — | — |
| 4. Tier 2 Coverage | 0/13 | — | — |
| 5. Release Prep + Undercover-Mode Publish Gate | 0/TBD | — | — |
| 6. Strict Enforcement via Hooks | 8/8 | — | — |
| 7. Build-Mode Foundation & Voice Anchor | 0/TBD | — | — |
| 8. Scaffolders & Sub-Artefacts | 0/TBD | — | — |
| 9. Docs Generators & Verification Gate | 0/TBD | — | — |
| 10. v1.0 Release | 0/TBD | — | — |
| 9 | 7 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 06 P02 | 12 | 4 tasks | 4 files |
| Phase 06 P03 | 12 | 7 tasks | 11 files |
| Phase 06 P04 | 25 | 4 tasks | 4 files |
| Phase 06 P06-05 | 8 | 2 tasks | 2 files |
| Phase 06 P06-06 | 8 | 2 tasks | 2 files |
| Phase 06 P06-07 | 6 | 4 tasks | 3 files |
| Phase 06 P06-08 | 8 | 3 tasks (T1+T2+R1; T4 checkpoint pending) | 3 files |
| Phase 07 P01 | 18 | 2 tasks | 3 files |
| Phase 07 P02 | 6 | 2 tasks | 2 files |
| Phase 07 P03 | 12 minutes | 2 tasks | 10 files |
| Phase 07 P05 | 4 | 5 tasks | 6 files |
| Phase 08 P02 | 17m | 2 tasks | 1 files |
| Phase 08 P13 | 9 minutes | 2 tasks | 2 files |
| Phase 10-v1-0-release P10-01 | 13 | 1 task tasks | 3 docs + 2 baselines files |
| Phase 10-v1-0-release P10-03 | 3 minutes | 1 task | 1 file (CHANGELOG.md +24 lines) |
| Phase 10-v1-0-release P10-04 | 12 minutes | 1 task | 1 file (README.md +12 lines, Build-Mode 2013 bytes) |
| Phase 10 P10-05 | 18min | 2 tasks executed tasks | 0 src + 2 docs + 1 tag files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Three decisions to surface at Phase 2 entry (recommendations from research, not blocking the roadmap):

- `engines.node`: `>=18` literal vs `>=20` recommended (Node 18 EOL'd 2025-04-30)
- Optional color library: `kleur` literal vs `picocolors` recommended (kleur last released 2022)
- Round-trip newline contract: `sep=1` marker flag vs documented "install ensures trailing newline" contract
- [Phase ?]: Phase 06 plan 06-02: ATTENTION_ANCHOR canonical wording fixed verbatim in lib/hooks/user-prompt-submit.js (single-source contract enforced by HOOK-09 in plan 06-07). PERSONA_FILE env-var documented TEST-only; production fallback resolves through import.meta.dirname-sibling persona.txt written by 06-04/06-05 adapters.
- [Phase ?]: Phase 06 plan 03: STATE_GATE_INSTRUCTION single-source constant (487 bytes UTF-8) injected into all five format transforms; per-format placement: after frontmatter (native-skills, mdc), inside marker block (append-markers), after persona header (concat-md, yaml-config+md). Five new byte-equal tests assert link integrity.
- [Phase ?]: Phase 06 plan 04: Hook integration is global-only for the claude-code adapter (project-scope installs do not patch settings.json or write to hooks/); idempotency marker is the literal substring `10x-engineer` in the command path; settings.json is rewritten as `{}` rather than deleted on full uninstall (we never delete user config files); `lib/adapters/helpers/hook-config.js` is intentionally off legitimate-uses.json — zero forbidden-pattern hits is the architectural contract.
- [Phase ?]: Phase 06 plan 06-05: codex adapter Phase 6 hook integration mirrors plan 06-04 byte-for-byte (same scripts, same mergeHookConfig helper, same global-only contract). lib/adapters/codex.js stays off the \bClaude\b allowlist — Phase 6 makes zero allowlist edits, neutral docblock language enforced.
- [Phase ?]: Phase 06 plan 06-06: ensureFreshInstallDefaultsToDisabled is the single chokepoint for HOOK-01's no-clobber semantic — implemented in the orchestrator (lib/install.js), not in writeState. Uses access(F_OK) rather than readState so the orchestrator stays agnostic of state shape. Sits between harness selection and the adapter loop: only runs after the user has explicitly opted into at least one harness. Tests use neutralisePath(t) to stash process.env.PATH for the duration of dryRun:false runs (mirrors the existing 'no harnesses detected' guard).
- [Phase ?]: Phase 06 plan 06-07: ZERO_HITS contract for Phase 6 NEW source files held with one source-fix iteration — lib/hooks/session-start.js docblock had concrete brand-named install-destination examples (case-insensitive grep match against \bClaude\b/\bCodex\b); fixed at source (neutral 'the harness-specific hooks directory under <homedir>'). legitimate-uses.json byte-identical to pre-Phase-6 baseline (sha256 884cbfa4...a2a84c4). Tasks 2 and 3 are regression-pin (implementation predates test) — single commit each, no separate test() then feat() cycle. test/lint-grep.test.js Phase 6 subtest matches existing file's no-shell walk()+scanLines() pattern rather than the plan's prescribed execSync('grep ...') for stylistic consistency.
- [Phase ?]: Phase 7 plan 02: BUILD_MODE_INSTRUCTION (462 bytes) and PERSONA_SECTION_SEPARATOR (130 bytes) added as named exports to lib/state-gate-instruction.js. STATE_GATE_INSTRUCTION byte-length unchanged at 487.
- [Phase ?]: Canonical concatenation order is locked in all 5 format transforms: state-gate first, build-mode second
- [Phase ?]: Phase 7 Plan 05: Shared persona-builder helper extracted; persona.txt now contains both halves with graceful-empty fallback
- [Phase ?]: Phase 7 Plan 05: persona.txt = response-mode + PERSONA_SECTION_SEPARATOR + build-mode; build-time concatenation; hook script untouched
- [Phase ?]: Phase 7 Plan 05: BUILD-04 default-off invariant locked — install() does not toggle state.json across three test scenarios per adapter
- [Phase ?]: Phase 08-02: cited Wadler 1992 (real) for monadic-effect discipline; tagless-final attributed to the tradition, not falsely to Wadler
- [Phase ?]: Phase 08-02: model-landmine mitigated via schema/encoding/carrier substitution throughout SUBART-02 prose and Haskell fence
- [Phase ?]: Phase 8 Plan 13 closing audit: bumped test/frontmatter.test.js floor to >= 23; all 12 Phase 8 build-*.md files audit clean; See Also closure restored via Rule 1 fix in build-monad-transformer-stack.md; legitimate-uses.json byte-identical; npm test 368/368.
- [Phase ?]: Phase 10 plan 10-01 — tarball cap 150 to 175 KB
- [Phase ?]: Phase 10 plan 01: tarball cap raised 150 KB to 175 KB across 4 locked doc lines (REQ-V1-04 line 187, PROJECT.md lines 45 + 75, ROADMAP.md SC#4 line 275); PRE_RELEASE_HEAD=6f7efa549892663f60cdbe8371b7fb8c34c0e7b0 captured to disk under .planning/phases/10-v1-0-release/ as rollback baseline + author-audit range start (D-16 contract); legitimate-uses.json sha256=884cbfa4990f12de93405cbd79c402c6ab088b9344c98dfa8f2facfcda2a84c4 captured to disk as byte-identical baseline for 10-05 Gate 0 (D-12 contract — gitignored file, git-show unavailable, stored hash durable); 3 doc files force-added matching Phase 1-9 SUMMARY precedent. Open observation for follow-up: PROJECT.md line 22 and ROADMAP.md line 268 still read 150 KB and describe current v1.0 state — plan locked exactly 4 lines and would have failed verify if expanded; defer to a successor plan or planner-discretion edit.
- [Phase 10 plan 10-03]: v1.0.0 CHANGELOG entry committed at ee879a5 — 24 lines / 881 words inserted between line 4 preamble and former-line-5 v0.3.0 heading. v0.3.0 format anchor honoured exactly (single-line dense bullets, multi-paragraph density via long sentences in one bullet); plan's `min_lines: 95` was a soft-wrap estimate, binding constraint was the v0.3.0 anchor shape. All 16 build-mode skill filenames present (1× each), TEST-10..13 + 524288 budget anchor present, D-03 verbatim text present (head/middle/tail clauses), word-choice gate clean (zero `\bagent\b`/`\bassistant\b`/`\bllm\b` hits in v1.0.0 block), vendor-name gate clean (zero `claude`/`anthropic`/`copilot` hits in v1.0.0 block), npm test 378/378, check-tarball clean. REL-V1-02 marked complete in REQUIREMENTS.md.
- [Phase 10 plan 10-04]: README Build-Mode section committed at 3ac2b0d — 12 insertions / 0 deletions, section size 2013 bytes (inside the 1500–2048 D-08 budget after three trim iterations from initial 2220 bytes). D-05 placement honoured (between line-64 What It Does and now-line-95 On the Provenance); D-06 voice continuous with the README body, no plain-English break, no fourth-wall, no emoji; D-07 three categories enumerated by names matching CHANGELOG (project scaffolders, sub-artefact patterns, docs generators); D-08 size in budget. Locked sections byte-identical pre/post: Quick Start 960=960, Disclaimer 1622=1622. Disclaimer remains last H2 at line 237. Word-choice gate clean inside section (zero `\bagent\b`/`\bassistant\b`/`\bllm\b`/`\bmodel\b` hits); vendor-name gate clean (zero `claude`/`anthropic`/`copilot`/`gemini`/`codex`/`cursor`/`aider`/`cline` hits). npm test 378/378, check-tarball clean. REL-V1-05 marked complete in REQUIREMENTS.md.
- [Phase ?]: Phase 10 plan 10-05: All 6 D-11 gates PASS; v1.0.0 annotated tag on ab3a2d0; tarball 143.6 kB; author audit clean (7 commits); UNDR-V1-03 byte-identical baseline holds at sha256 884cbfa4...a2a84c4. v1.0 milestone locally complete pending user handoff (push main + push tag + gh release create).

### Pending Todos

None yet.

### Blockers/Concerns

None yet. Five RELEASE-BLOCKER bugs in the locked `lib/markers.js` interface are catalogued in research/PITFALLS.md and addressed at Phase 2 entry — they are scoped work, not blockers.

### Roadmap Evolution

- Phase 6 added (2026-05-08): Strict Enforcement via Hooks — state-gated SessionStart/UserPromptSubmit reinforcement; install must be default-off (`~/.10x-engineer/state.json` = `enabled: false`); covers Claude Code hooks, Codex `.codex/hooks.json` parallel, GEMINI.md + always-on rule bodies state-file gate, symlink-safe flag writes, cross-adapter test coverage.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260508-pln | Add plain-English Quick Start section to top of README | 2026-05-08 | 47c27a7 | [260508-pln-add-to-the-top-of-the-readme-quick-start](./quick/260508-pln-add-to-the-top-of-the-readme-quick-start/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-09T21:24:07.253Z
Stopped at: Phase 10 plan 04 complete — README Build-Mode section committed (3ac2b0d); next 10-05 verification gate + v1.0.0 tag + manual handoff
Resume file: 
None

## Phase 5 plan map

| Plan | Wave | Reqs | Files |
|------|------|------|-------|
| 05-01 | 1 | REL-01, REL-03 | README.md (in-character body + disclaimer placeholder), LICENSE |
| 05-02 | 2 | REL-02 | README.md (verbatim disclaimer paste, replaces placeholder) |
| 05-03 | 1 | REL-04, REL-05, REL-06, REL-07 | package.json (final), .gitignore (≥55 lines), .npmignore |
| 05-04 | 1 | REL-08, REL-09, REL-12 | scripts/check-tarball.js (~250 lines), forbidden-fingerprints.txt (≥30 patterns), legitimate-uses.json (22+ entries) |
| 05-05 | 1 | TEST-08 | test/lint-grep.test.js (3 lint subtests) |
| 05-06 | 3 | REL-10, REL-11, REL-13 | package.json (+prepublishOnly), test/release-readiness.test.js (20-adapter end-to-end round-trip) |

Wave 1: 4 parallel (README+LICENSE, package metadata, fingerprint script, lint-greps). Wave 2: 1 (disclaimer paste depends on README body). Wave 3: 1 keystone (npm pack/publish dry-run + round-trip + tarball <150KB).

## Phase 5 known-at-execution-time concern

Pre-screen of existing git log (95 commits) found 3 sanctioned commit subjects:

- 2× `claude-code` kebab-case adapter id (Phase 2 / 02-06 commits) — harness-target reference per CLAUDE.md rule 1 exception
- 1× `CLAUDE.md` working-brief filename (Phase 1 / 01-08 commit) — gitignored brief reference

`scripts/check-tarball.js` git log audit will flag these. Allowlist `legitimate-uses.json` must include `{pattern: "\\bclaude-code\\b", allowed_globs: ["<git-log-scope>", ...]}` and `{pattern: "CLAUDE\\.md", allowed_globs: ["<git-log-scope>", ...]}` entries. If the script's audit scope doesn't currently distinguish git-log scope (only filesystem globs), the script may need a `commit_messages: true` flag or equivalent. Surface at 05-04 execution.

## Phase 4 plan map

| Plan | Wave | Req | Adapter | Format | Template |
|------|------|-----|---------|--------|----------|
| 04-01 | 1 | TIER2-02 | Goose | append-markers | codex.js |
| 04-02 | 1 | TIER2-07 | Copilot Chat | append-markers | codex.js |
| 04-03 | 1 | TIER2-10 | Roo Code | native-skills | cline.js |
| 04-04 | 1 | TIER2-11 | PearAI | concat-md | continue.js |
| 04-05 | 1 | TIER2-08 | Zed AI | append-markers | codex.js |
| 04-06 | 2 | TIER2-05 | Tabnine | concat-md | continue.js |
| 04-07 | 2 | TIER2-06 | Amazon Q | concat-md | continue.js |
| 04-08 | 2 | TIER2-01 | Pieces | concat-md | continue.js+aider |
| 04-09 | 2 | TIER2-12 | Plandex (PLANDEX.md fallback) | concat-md | continue.js+aider |
| 04-10 | 3 | TIER2-04 | Windsurf (mixed-mode) | append-markers + native-skills | opencode.js |
| 04-11 | 3 | TIER2-09 | JetBrains AI (manual-enable note retained) | concat-md | continue.js |
| 04-12 | 4 | TIER2-13 | Hosted-fallback (message-only) | none | NEW SHAPE |
| 04-13 | 5 | (registry+integration) | — | — | mirrors 03-13 |

TIER2-03 Cody DEFERRED (no plan). Wave 1: 5 parallel. Wave 2: 4 parallel. Wave 3: 2 parallel. Wave 4: 1. Wave 5: 1 integration. Max intra-wave parallelism: 5.

## Phase 3 plan map

| Plan | Wave | Reqs | Files |
|------|------|------|-------|
| 03-01 | 1 | FMT-02 (mdc) | lib/format/mdc.js, lib/detect.js (extend: commandExists), test/format-mdc.test.js |
| 03-02 | 1 | FMT-03 (append-markers) | lib/format/append-markers.js, test/format-append-markers.test.js |
| 03-03 | 1 | FMT-04 (concat-md) | lib/format/concat-md.js, test/format-concat-md.test.js |
| 03-04 | 1 | FMT-05 (yaml-config+md / Aider 7-shape whitelist) | lib/format/yaml-config+md.js, test/format-yaml-config-md.test.js |
| 03-05 | 2 | TIER1-02 (Cursor) | lib/adapters/cursor.js |
| 03-06 | 2 | TIER1-03 (Cline) | lib/adapters/cline.js |
| 03-07 | 2 | TIER1-04 (Kilo Code) | lib/adapters/kilo-code.js |
| 03-08 | 3 | TIER1-08 (Codex) | lib/adapters/codex.js |
| 03-09 | 3 | TIER1-09 (Gemini) | lib/adapters/gemini.js |
| 03-10 | 3 | TIER1-06 (Continue) | lib/adapters/continue.js |
| 03-11 | 4 | TIER1-05 (opencode mixed-mode) | lib/adapters/opencode.js |
| 03-12 | 4 | TIER1-07 (Aider) | lib/adapters/aider.js |
| 03-13 | 5 | CLI-03,04,05,08 | lib/adapters/index.js (registry stitching), bin/cli.js (mutual-exclusion guard), test/cli.test.js, test/install-multi-adapter.test.js |

Wave 1: 4 parallel formats. Waves 2-4: 8 adapters in 3 batches (3+3+2). Wave 5: registry + CLI integration. Max intra-wave parallelism: 4.

## Phase 2 plan map

| Plan | Wave | Reqs | Files |
|------|------|------|-------|
| 02-01 (frozen) | 1 | FND-01,02,03,04,09 + TEST-01,02,03 | package.json, lib/markers.js, test/markers.test.js |
| 02-02 | 2 | FND-05, FND-06, FND-10 | lib/safe-fs.js, test/safe-fs.test.js |
| 02-03 | 2 | FND-07, FND-08 | lib/frontmatter.js, lib/skills.js, test/frontmatter.test.js, test/skills.test.js |
| 02-04 | 2 | ORC-01,02,03,04,08, TEST-05 | lib/detect.js, lib/adapters/index.js, test/detect.test.js |
| 02-05 | 2 | DIS-01..05, TEST-04 | lib/disclaimer.js, test/disclaimer.test.js |
| 02-06 | 3 | FMT-01, TIER1-01, TEST-06, TEST-07 | lib/format/native-skills.js, lib/adapters/claude-code.js, lib/adapters/index.js (extend), test/format-native-skills.test.js, test/adapter-claude-code.test.js |
| 02-07 | 4 | ORC-05, ORC-06, ORC-07 | lib/install.js, test/install.test.js |
| 02-08 | 5 | CLI-01,02,06,07,09,10,11,12,13 | bin/cli.js, test/cli.test.js |

Wave 2 = 4 parallel plans, zero file overlap. Wave 3 → keystone vertical slice. Wave 5 → CLI front door.

## CLAUDE.md Drift (2026-05-07)

CLAUDE.md updated to mandate Rust + Haskell as modern esoteric flex tracks alongside vintage languages (Required Behavior #1; Skill #3 brief). Audit:

- `skills/legacy-language-supremacy.md` — vintage-only; missing modern flex track. Patch via 01-08-PLAN.
- `01-03-PLAN.md` acceptance criteria — predates change; supplementary plan adds Rust/Haskell asserts.
- `01-07-SUMMARY.md` voice audit — re-audit after rewrite.
- `01-VERIFICATION.md` — addendum noting CLAUDE.md revision and patch closure.
- Phase 2 artefacts — unaffected (frontmatter shape locked at 3 keys; Rust/Haskell change is body content only).

## v1.0 plan map

The v1.0 Build-Mode Persona milestone continues phase numbering from v0.9. Four phases (7–10) cover 33 requirements: BUILD-01..05, SCAFF-01..05, SUBART-01..07, DOCS-01..03, TEST-10..13, REL-V1-01..06, UNDR-V1-01..03.

| Phase | Wave | Reqs | Files (anticipated) |
|-------|------|------|---------------------|
| 7 — Foundation & Voice Anchor | (planner-driven) | BUILD-01..05, UNDR-V1-02 | skills/build-mode-overview.md, lib/build-mode-instruction.js (or extension of lib/state-gate-instruction.js), lib/hooks/session-start.js (extend), lib/hooks/user-prompt-submit.js (extend), lib/hooks/persona.txt (extend), all 5 format transforms (extend) |
| 8 — Scaffolders & Sub-Artefacts | (planner-driven) | SCAFF-01..05, SUBART-01..07, UNDR-V1-01 | skills/build-compiler-from-scratch.md, skills/build-json-parser-from-scratch.md, skills/build-http-stack-from-scratch.md, skills/build-build-system-from-scratch.md, skills/build-project-tree-template.md, skills/build-philosophical-preamble.md, skills/build-free-monad-encoder.md, skills/build-dsl-grammar.md, skills/build-coq-proof-stub.md, skills/build-forth-bootstrap.md, skills/build-abstract-factory-of-factories.md, skills/build-monad-transformer-stack.md |
| 9 — Docs Generators & Verification Gate | (planner-driven) | DOCS-01..03, TEST-10..13 | skills/build-readme-generator.md, skills/build-changelog-generator.md, skills/build-architecture-doc.md, test/skills-build-mode.test.js (TEST-10, TEST-13), test/hook-session-start.test.js (extend; TEST-11), test/format-*.test.js (extend; TEST-12) |
| 10 — v1.0 Release | (planner-driven) | REL-V1-01..06, UNDR-V1-03 | package.json (0.3.0 → 1.0.0), CHANGELOG.md (1.0.0 entry), README.md (Build-Mode section), legitimate-uses.json (assert byte-identical), git tag v1.0.0 + push + GitHub release |

### v1.0 phase dependencies

- **Phase 7** depends on Phase 6 (hook infrastructure + state-gate single-source pattern). It is the keystone — voice locks here.
- **Phase 8** depends on Phase 7 (build-mode-overview anchor; same input-contract pattern Phase 1 established for response-mode).
- **Phase 9** depends on Phase 8 (test fixtures need every BUILD/SCAFF/SUBART skill file to exist).
- **Phase 10** depends on Phases 7–9 (release gate requires every artefact + green test gate).

### v1.0 cross-phase invariants

- **UNDR-V1-01** (no agent-fingerprint strings in skills/build-*.md) binds Phase 8 at write-time; Phase 9's TEST-10 enforces the verification gate.
- **UNDR-V1-02** (no new agent-fingerprint strings in hook source extended in Phase 7) binds Phase 7 at write-time.
- **UNDR-V1-03** (legitimate-uses.json byte-identical to pre-v1.0 baseline) binds Phase 10 at the release gate; if any v1.0 source file would have required an allowlist entry, the architectural contract is to fix the source rather than expand the allowlist (Phase 6 precedent).
- **Default-off contract** (`~/.10x-engineer/state.json` `enabled: false` until explicit toggle) inherited from Phase 6; build-mode loads only when state is `enabled: true`. An install-then-walk-away user gets neither response-mode nor build-mode.
- **Build-mode single source of truth** (`lib/build-mode-instruction.js` or extension of `lib/state-gate-instruction.js`) routes the prologue text into every always-on rule body; tests assert verbatim presence in every format-transform output.
