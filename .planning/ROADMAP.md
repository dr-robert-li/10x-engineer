# Roadmap: 10x-engineer

## Overview

Five phases that derive from the work, not from a template. Phase 1 writes the ten skill markdown files that *are* the product — voice locks first, before any JavaScript exists. Phase 2 is the heavy phase: it builds the foundation (markers, safe-fs, frontmatter, skills loader, format pipeline, detection, orchestrator, CLI scaffolding, disclaimer gate) **and** the first vertical-slice adapter (Claude Code, native-skills format) together, because the foundation modules and the first adapter are mutually validating — splitting them strands either side. Phase 2 also revises the locked `lib/markers.js` interface to fix five empirically-verified RELEASE-BLOCKER bugs (CRLF line endings, `String.replace` substitution tokens, prefix-only matching, multi-BEGIN orphan detection, atomic writes) before any append-mode adapter ships against it. Phase 3 fans out the remaining eight Tier 1 adapters (Cursor, Cline, Kilo Code, opencode, Continue, Aider, Codex CLI, Gemini CLI) and the four remaining format transforms (`mdc`, `append-markers`, `concat-md`, `yaml-config+md`), turning the per-harness flag matrix on once more than one adapter exists. Phase 4 ships the thirteen Tier 2 adapters as path-and-detection variants over the format transforms Phase 3 already built. Phase 5 prepares for release: README in earnest voice plus the verbatim plain-English disclaimer, MIT licence, `package.json` final review, dual `.gitignore` / `.npmignore` belt-and-braces, and the undercover-mode pre-publish grep over the tarball, lockfile, and git log that gates `npm publish --dry-run` from running on a contaminated tree.

Granularity is **coarse** (3–5 phases). Five phases is the right count — research convergence, not template padding.

## Phases

- [x] **Phase 1: Persona** - Write the ten canonical skill markdown files in earnest, self-serious voice (completed 2026-05-07)
- [x] **Phase 2: Foundation + Vertical Slice** - Build foundation modules (revising locked markers interface) and ship Claude Code adapter end-to-end (completed 2026-05-07)
- [x] **Phase 3: Tier 1 Fan-out** - Add the remaining four format transforms and eight Tier 1 adapters (completed 2026-05-07)
- [x] **Phase 4: Tier 2 Coverage** - Ship the thirteen Tier 2 adapters as detection/path variants (completed 2026-05-08; TIER2-03 Cody DEFERRED — 12 active adapters shipped, registry → 21 entries)
- [x] **Phase 5: Release Prep + Undercover-Mode Publish Gate** - README, licence, package metadata, fingerprint grep, `npm publish --dry-run` (completed 2026-05-08; 16 commits + 1 supplementary refactor of 14 adapters → safeWriteFile; tarball 77.5KB <150KB; 406/406 tests; check-tarball clean)
- [x] **Phase 6: Strict Enforcement via Hooks** - State-gated SessionStart/UserPromptSubmit reinforcement; default-off install; symlink-safe flag writes; cross-adapter test coverage (completed 2026-05-08)

### v1.0 Build-Mode Persona (continuation of phase numbering)

- [x] **Phase 7: Build-Mode Foundation & Voice Anchor** - Lock build-mode voice and wire hook payload + always-on rule body extension; default-off contract preserved (completed 2026-05-09)
- [x] **Phase 8: Scaffolders & Sub-Artefacts** - Write the twelve build-*.md skill files for project scaffolders and sub-artefact patterns (completed 2026-05-09; 13/13 plans; 12 distinct rhetorical modes; 368/368 tests; tarball clean)
- [x] **Phase 9: Docs Generators & Verification Gate** - Write the three docs-generator skill files and ship the four build-mode test fixtures that lock voice, payload size, state-gate carry-through, and cross-reference integrity (completed 2026-05-09)
- [ ] **Phase 10: v1.0 Release** - Version bump 0.3.0 → 1.0.0, CHANGELOG, README build-mode section, tarball verification, git tag/push/GitHub release

## Cross-Phase Invariants

These are roadmap-level concerns enforced at every PR review across every phase. They are not phase-bound work; they bind every phase that touches the relevant module.

| Invariant | Owner | First enforced | Permanent enforcement |
|-----------|-------|----------------|------------------------|
| `MARKER_BEGIN_PREFIX` constant + prefix-only matching (no version tightening) | `lib/markers.js` | Phase 2 | All phases — `test/markers.test.js` `architectural-lock: v0.9 → current-version stripBlock` fixture; PR review fails any prefix change |
| `dryRun` threaded through every install/uninstall/write helper from line one | adapter contract | Phase 2 | All phases — per-adapter `mtime`-unchanged-after-`dryRun:true` test pattern; retrofit cost is a re-audit of every adapter |
| Consent gate centralised in `lib/install.js`, never inside an adapter | `lib/install.js` | Phase 2 | All phases — `test/disclaimer.test.js` non-TTY pipe-y refusal; PR review fails any adapter that imports `requireConsent` |
| Byte-identical install→uninstall round-trip (including non-`\n`-terminated user files) | adapters + `safe-fs` | Phase 2 | All phases — per-adapter round-trip test with deliberately-no-trailing-`\n` fixture |
| Undercover-mode: zero agent-fingerprint strings in source, lockfile, commit messages, tarball | maintainer + `scripts/check-tarball.js` | Phase 1 (commits) | All phases — author identity / commit messages enforced from Phase 1; tarball + lockfile + `git log` grep gates Phase 5 publish |
| Default-off state-file gate (`~/.10x-engineer/state.json` `enabled: false` until explicit toggle) | `lib/state.js` + adapter `install()` | Phase 6 | All phases that ship persona content — Phase 7 build-mode loaders MUST honour the same gate; persona must not auto-engage on install |
| Build-mode persona text routed through a single source-of-truth string (`lib/build-mode-instruction.js` or extension of `lib/state-gate-instruction.js`) | format transforms + hook scripts | Phase 7 | Phases 7–10 — single edit propagates to every always-on adapter and the hook payload; tests assert verbatim presence in every output |

## Decisions to Surface at Phase 2 Entry

These three decisions are flagged for the planner at Phase 2 entry. Recommendations come from the research stack stream; they are not blocking the roadmap.

1. **`engines.node`**: literal brief `>=18` vs recommended `>=20`. Recommendation: `>=20` (Node 18 EOL'd 2025-04-30; unlocks `commander@^14`, stable `node:test`).
2. **Optional color library**: literal brief `kleur` vs recommended `picocolors`. Recommendation: `picocolors` (kleur last released 2022; picocolors smaller, faster, actively maintained).
3. **Round-trip newline contract**: marker `sep=1` flag inside the BEGIN comment vs documented "install ensures append targets end with a final newline" contract. Recommendation: documented contract (cleaner, no marker text growth).

## Phase Details

### Phase 1: Persona
**Goal**: The ten canonical skill markdown files exist and read well standalone — earnest, self-serious, voice-locked. The persona is the product; if the voice fails, the rest is wasted effort.
**Depends on**: Nothing (first phase)
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-04, PERS-05, PERS-06, PERS-07, PERS-08, PERS-09, PERS-10, PERS-11, PERS-12
**Success Criteria** (what must be TRUE):
  1. A reader can open any one of the ten skill files in `skills/` and find it funny on its own — no setup, no JS, no installer running
  2. The voice is consistent across all ten files: earnest, declarative, never winking, no emoji, no fourth-wall breaks
  3. Cross-references between skills resolve to real files (e.g. `philosophical-preamble.md` references `first-principles-everything.md` and that file exists with the expected anchor topic)
  4. Every skill file has valid YAML frontmatter (`name`, `description`, `when_to_use`) parseable by a strict 30-line parser — the canonical frontmatter shape that Phase 2 will lock as the input contract for every format transform
  5. The repository's commit history for Phase 1 shows commits authored as `dr-robert-li <dr.robert.li.au@gmail.com>` with no agent-tool trailers anywhere — undercover-mode contract enforced from the first commit
**Plans**: 7 plans across 5 waves

Plans:
- [x] 01-01-PLAN.md (Wave 1, sequential) — Voice anchors: philosophical-preamble.md, first-principles-everything.md (locks invented canon)
- [x] 01-02-PLAN.md (Wave 2, sequential) — Doctrinal + technical-snippet anchors: reject-the-standard-library.md, compiler-driven-development.md
- [x] 01-03-PLAN.md (Wave 3, parallel-eligible) — legacy-language-supremacy.md, architecture-astronaut.md
- [x] 01-04-PLAN.md (Wave 3, parallel-eligible) — problems-of-my-own-invention.md, yak-shaving-as-craft.md
- [x] 01-05-PLAN.md (Wave 3, parallel-eligible) — build-system-from-scratch.md
- [x] 01-06-PLAN.md (Wave 4) — testing-by-formal-proof.md (Coq/Agda heavy lift, fresh canvas)
- [x] 01-07-PLAN.md (Wave 5) — Voice-consistency + cross-reference integrity audit (covers PERS-11, PERS-12)
- [x] 01-08-PLAN.md (supplementary, post-completion) — CLAUDE.md drift patch: legacy-language-supremacy.md modern flex track (Rust + Haskell) + voice re-audit + VERIFICATION addendum (re-asserts PERS-03, PERS-11, PERS-12) (completed 2026-05-07)

### Phase 2: Foundation + Vertical Slice
**Goal**: A working installer end-to-end against one real harness (Claude Code), built on a foundation that has been *revised* against five empirically-verified RELEASE-BLOCKER bugs in the locked `lib/markers.js` interface. Foundation modules and the first vertical-slice adapter ship together because each is unverifiable without the other.
**Depends on**: Phase 1 (skills files exist; canonical frontmatter shape locked)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06, FND-07, FND-08, FND-09, FND-10, ORC-01, ORC-02, ORC-03, ORC-04, ORC-05, ORC-06, ORC-07, ORC-08, DIS-01, DIS-02, DIS-03, DIS-04, DIS-05, FMT-01, TIER1-01, CLI-01, CLI-02, CLI-06, CLI-07, CLI-09, CLI-10, CLI-11, CLI-12, CLI-13, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07
**Success Criteria** (what must be TRUE):
  1. A user with `~/.claude/` on disk can run `npx 10x-engineer install`, see the disclaimer summary, type `y`, and find the ten skill files copied verbatim into `~/.claude/skills/10x-engineer/`
  2. That same user can run `npx 10x-engineer uninstall` and find the skill directory removed; nothing else on their filesystem has changed
  3. `install` followed by `uninstall` against a Codex-style append-target fixture leaves the file byte-identical to its pre-install state — including for files that did not originally end with a trailing newline, and for files saved with CRLF line endings
  4. `install --dry-run` prints the would-be writes and touches zero filesystem state; `mtime` on every target is unchanged after the run
  5. A non-TTY invocation (`echo y | npx 10x-engineer install`) refuses to proceed without an explicit `--yes` or `--i-accept-the-token-bill` flag — accidental scripted bypass is blocked
  6. `npx 10x-engineer list` shows Claude Code as `found` (or `not found` / `errored` per current state); a deliberately-broken adapter that throws in `detect()` shows as `errored` and does *not* prevent the other adapters from being listed
  7. `test/markers.test.js` asserts a fixture marker block written under `v0.9` is removed cleanly by the current-version `stripBlock` — the architectural prefix-match invariant is locked by an executable test
**Plans**: 8 plans across 5 waves

Plans:
- [x] 02-01-PLAN.md (Wave 1, sequential) — package.json + lib/markers.js + test/markers.test.js (5 RELEASE-BLOCKER fixes baked in; architectural-lock test) — FROZEN
- [ ] 02-02-PLAN.md (Wave 2, parallel-eligible) — lib/safe-fs.js (atomic temp+rename, BOM round-trip, dryRun threading)
- [ ] 02-03-PLAN.md (Wave 2, parallel-eligible) — lib/frontmatter.js (strict 3-key parser) + lib/skills.js (loadSkills canonical shape)
- [ ] 02-04-PLAN.md (Wave 2, parallel-eligible) — lib/detect.js (Promise.allSettled fault-isolation) + lib/adapters/index.js (empty registry stub)
- [ ] 02-05-PLAN.md (Wave 2, parallel-eligible) — lib/disclaimer.js (centralised consent gate + raw-mode scope prompt) + DIS gate matrix tests
- [ ] 02-06-PLAN.md (Wave 3) — lib/format/native-skills.js + lib/adapters/claude-code.js (vertical-slice keystone) + registry insertion + round-trip tests
- [ ] 02-07-PLAN.md (Wave 4) — lib/install.js orchestrator (5 entry points: runInstall/runUninstall/runList/runPrint/runExport)
- [ ] 02-08-PLAN.md (Wave 5) — bin/cli.js commander wiring + subprocess-driven CLI tests

### Phase 3: Tier 1 Fan-out
**Goal**: All five format transforms exist and work, all nine Tier 1 harnesses install and uninstall correctly, and the per-harness flag matrix (`--harness`, `--all`, `--global`, `--project`) behaves as specified now that more than one adapter is in the registry.
**Depends on**: Phase 2 (foundation + Claude Code adapter validate the contract every other adapter inherits)
**Requirements**: FMT-02, FMT-03, FMT-04, FMT-05, TIER1-02, TIER1-03, TIER1-04, TIER1-05, TIER1-06, TIER1-07, TIER1-08, TIER1-09, CLI-03, CLI-04, CLI-05, CLI-08
**Success Criteria** (what must be TRUE):
  1. A user with all nine Tier 1 harnesses simulated in fixtures sees `list` report all nine as `found`, and `install` (after disclaimer) prompts per-harness in turn — declining one harness does not block the others
  2. `install --all` skips the per-harness prompt for users who want the ceremony to end, but still gates the disclaimer; `install --harness cursor` writes only Cursor; `install --global` and `install --project` select scope where the harness supports both
  3. Cursor, Cline, Kilo Code, opencode, Continue, Aider, Codex, and Gemini all install with the correct format and at the correct path — and uninstall surgically (marker-bounded for append-mode targets, directory removal for skill-directory targets, byte-identical for user-edited append targets)
  4. The Aider adapter writes `CONVENTIONS.md` and patches `.aider.conf.yml` `read:` only against the documented seven-shape whitelist — for any other YAML shape, it refuses to write and points the user at `--print`
  5. The opencode adapter (mixed mode) writes both an agent file under `~/.config/opencode/agent/` and an `AGENTS.md` append-block in the project; uninstall removes both artefacts atomically
**Plans**: 13 plans across 5 waves

Plans:
- [ ] 03-01-PLAN.md (Wave 1, parallel-eligible) — FMT-02 mdc transform + commandExists helper + assertByteIdenticalAroundMarker test helper
- [ ] 03-02-PLAN.md (Wave 1, parallel-eligible) — FMT-03 append-markers transform
- [ ] 03-03-PLAN.md (Wave 1, parallel-eligible) — FMT-04 concat-md transform
- [ ] 03-04-PLAN.md (Wave 1, parallel-eligible) — FMT-05 yaml-config+md transform (Aider 7-shape whitelist)
- [ ] 03-05-PLAN.md (Wave 2, parallel-eligible) — TIER1-02 Cursor adapter (mdc, project-only)
- [ ] 03-06-PLAN.md (Wave 2, parallel-eligible) — TIER1-03 Cline adapter (native-skills, project-only)
- [ ] 03-07-PLAN.md (Wave 2, parallel-eligible) — TIER1-04 Kilo Code adapter (native-skills, legacy .kilocode/)
- [ ] 03-08-PLAN.md (Wave 3, parallel-eligible) — TIER1-08 Codex adapter (append-markers, scope=both)
- [ ] 03-09-PLAN.md (Wave 3, parallel-eligible) — TIER1-09 Gemini adapter (append-markers, scope=both)
- [ ] 03-10-PLAN.md (Wave 3, parallel-eligible) — TIER1-06 Continue adapter (concat-md, scope=both)
- [ ] 03-11-PLAN.md (Wave 4, parallel-eligible) — TIER1-05 opencode adapter (mixed-mode: agents/ + AGENTS.md)
- [ ] 03-12-PLAN.md (Wave 4, parallel-eligible) — TIER1-07 Aider adapter (yaml-config+md, 7-shape whitelist)
- [ ] 03-13-PLAN.md (Wave 5) — Registry stitching + CLI-03/04/05/08 mutual-exclusion guard + multi-adapter integration tests

### Phase 4: Tier 2 Coverage
**Goal**: All thirteen Tier 2 harnesses are detected, installable, and uninstallable. Every Tier 2 adapter reuses an existing format transform — they are path-and-detection variants, not new architecture. Every Tier 2 adapter's install path is verified against current vendor docs at phase entry, with the verified URL recorded in a top-of-file source comment.
**Depends on**: Phase 3 (every Tier 2 adapter consumes an already-shipped format transform)
**Requirements**: TIER2-01, TIER2-02, TIER2-04, TIER2-05, TIER2-06, TIER2-07, TIER2-08, TIER2-09, TIER2-10, TIER2-11, TIER2-12, TIER2-13 (TIER2-03 Cody DEFERRED per locked user decision)
**Success Criteria** (what must be TRUE):
  1. A user with any Tier 2 harness configured (Pieces, Goose, Windsurf/Codeium, Tabnine, Amazon Q, Copilot Chat, Zed AI, JetBrains AI, Roo Code, PearAI, Plandex) sees that harness in `list` and can `install` / `uninstall` against it (TIER2-03 Cody deferred per locked user decision)
  2. Every Tier 2 adapter source file carries a top-of-file `// Path source: <URL>, verified <date>` comment pointing at the vendor documentation that justifies its install path — PR review fails without it
  3. The hosted-agent fallback adapter does not attempt any filesystem write; instead, when invoked, it prints a message instructing the user to copy the persona manually or use `npx 10x-engineer print`
  4. `list` after Phase 4 reports all twenty-one adapters (nine Tier 1 + twelve Tier 2 — Cody deferred) with detection status — and detection runs all twenty-one adapters concurrently through `Promise.allSettled`, so one adapter's failure never poisons the batch
**Plans**: 13 plans across 5 waves

Plans:
- [ ] 04-01-PLAN.md (Wave 1, parallel-eligible) — TIER2-02 Goose adapter (append-markers, scope=both, mirrors codex.js)
- [ ] 04-02-PLAN.md (Wave 1, parallel-eligible) — TIER2-07 GitHub Copilot Chat adapter (append-markers, project-only, .git anchored)
- [ ] 04-03-PLAN.md (Wave 1, parallel-eligible) — TIER2-10 Roo Code adapter (native-skills, project-only, mirrors cline.js)
- [ ] 04-04-PLAN.md (Wave 1, parallel-eligible) — TIER2-11 PearAI adapter (concat-md, scope=both, mirrors continue.js)
- [ ] 04-05-PLAN.md (Wave 1, parallel-eligible) — TIER2-08 Zed AI adapter (append-markers, project-only)
- [ ] 04-06-PLAN.md (Wave 2, parallel-eligible) — TIER2-05 Tabnine adapter (concat-md, scope=both, mirrors continue.js)
- [ ] 04-07-PLAN.md (Wave 2, parallel-eligible) — TIER2-06 Amazon Q adapter (concat-md, project-only)
- [ ] 04-08-PLAN.md (Wave 2, parallel-eligible) — TIER2-01 Pieces adapter (concat-md project-file fallback with first-line heuristic)
- [ ] 04-09-PLAN.md (Wave 2, parallel-eligible) — TIER2-12 Plandex adapter (concat-md project-file fallback per locked decision; notes-field plandex-load instruction)
- [ ] 04-10-PLAN.md (Wave 3, parallel-eligible) — TIER2-04 Windsurf adapter (mixed-mode: append-markers global + native-skills project, mirrors opencode.js)
- [ ] 04-11-PLAN.md (Wave 3, parallel-eligible) — TIER2-09 JetBrains AI adapter (concat-md, project-only, manual-enable note RETAINED per locked decision)
- [ ] 04-12-PLAN.md (Wave 4) — TIER2-13 Hosted-agent fallback (message-only adapter, no filesystem I/O, always-found:false, visible in list under not-found)
- [ ] 04-13-PLAN.md (Wave 5) — Registry stitch to 21 entries + path-source comment cross-cutting test + 21-entry registry test + multi-adapter integration test

### Phase 5: Release Prep + Undercover-Mode Publish Gate
**Goal**: The package is ready to ship as a GitHub release (with `npm publish --dry-run` succeeding for later registry publication). The README is in-character with the verbatim plain-English disclaimer as the final section. The undercover-mode pre-publish grep gates publication on any agent-fingerprint hit anywhere in the tarball, the lockfile, or the git log.
**Depends on**: Phases 1–4 (the README's harness coverage table cites the supported set; the fingerprint grep needs every source file to exist before it can scan)
**Requirements**: REL-01, REL-02, REL-03, REL-04, REL-05, REL-06, REL-07, REL-08, REL-09, REL-10, REL-11, REL-12, REL-13, TEST-08
**Success Criteria** (what must be TRUE):
  1. A first-time reader can open `README.md`, read the in-character body, and find the plain-English `## ⚠️ Disclaimer` section as the very last section — not collapsed, not faintly styled, not softened
  2. `npm pack --dry-run` produces a tarball under 150KB containing only `bin/`, `lib/`, `skills/`, `LICENSE`, `README.md`, and `package.json` — no `CLAUDE.md`, no `.planning/`, no scratch, no dotfiles
  3. `npm publish --dry-run` succeeds end-to-end with no warnings about missing `package.json` fields
  4. `scripts/check-tarball.js` runs the tarball, lockfile, and `git log` through a forbidden-fingerprints grep against an explicit allowlist (harness names in adapter source and the README coverage table only) and exits non-zero on any hit outside that allowlist; the local lint-greps in TEST-08 pass with zero hits
  5. `git log` audit shows every commit authored as `dr-robert-li <dr.robert.li.au@gmail.com>` with no co-author trailers, no generated-by lines, no agent-tool footers — undercover-mode contract is observable in the public commit history
  6. A second pass of `install` then `uninstall` against the Phase 2 / Phase 3 fixture corpus leaves every append-mode target byte-identical to its pre-install state — the round-trip invariant is re-validated as part of release readiness
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Persona | 8/8 | Complete   | 2026-05-07 |
| 2. Foundation + Vertical Slice | 0/8 | Not started | - |
| 3. Tier 1 Fan-out | 0/TBD | Not started | - |
| 4. Tier 2 Coverage | 0/TBD | Not started | - |
| 5. Release Prep + Undercover-Mode Publish Gate | 0/TBD | Not started | - |
| 6. Strict Enforcement via Hooks | 8/8 | Complete   | 2026-05-08 |
| 7. Build-Mode Foundation & Voice Anchor | 5/5 | Complete   | 2026-05-09 |
| 8. Scaffolders & Sub-Artefacts | 13/13 | Complete   | 2026-05-09 |
| 9. Docs Generators & Verification Gate | 7/7 | Complete    | 2026-05-09 |
| 10. v1.0 Release | 1/5 | In Progress|  |

### Phase 6: Strict Enforcement via Hooks
**Goal**: Persona enforcement strength matches the caveman pattern — SessionStart hook injects the full ruleset as hidden system context, UserPromptSubmit hook re-anchors per turn, and a persistent flag file gates both — but **only while `~/.10x-engineer/state.json` is `enabled: true`**. Fresh install must never auto-engage: the install flow writes `enabled: false` (or an equivalent default-off semantic) so an install-then-walk-away user gets zero behavior change. Engaging the persona is always an explicit act (`/10x-engineer-enable`, "enable 10x-engineer", or hand-editing the state file). Coverage extends across Claude Code (full hook system), Codex CLI (`.codex/hooks.json` parallel), and Gemini CLI (no hook system → static instruction at the top of `GEMINI.md` that tells the model to read the state file before applying any persona rule). Cursor / Windsurf / Cline / Copilot keep their existing always-on rule shape; the state-file gate is documented inline in each rule body.
**Depends on**: Phase 5 (release-readiness + undercover-mode publish gate must remain green; this phase ships behind the same fingerprint grep)
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, HOOK-06, HOOK-07, HOOK-08, HOOK-09, HOOK-10, TEST-09
**Success Criteria** (what must be TRUE):
  1. **Default-off install.** A fresh `npx github:dr-robert-li/10x-engineer install` writes `~/.10x-engineer/state.json` with `{"enabled": false}` (or equivalent default-off semantic) — the persona produces zero behavior change until the user explicitly engages it. Re-running install on an already-engaged state does NOT downgrade `enabled: true` to `enabled: false`.
  2. **Claude Code SessionStart hook.** A SessionStart hook reads `~/.10x-engineer/state.json`; if `enabled: true`, it emits the full persona ruleset to stdout (Claude Code injects SessionStart hook stdout as hidden system context); if `enabled: false` or missing, it silent-exits with no output. Hook is installed by the `claude-code` adapter's `install()` and removed surgically by `uninstall()`.
  3. **Claude Code UserPromptSubmit reinforcement.** A UserPromptSubmit hook reads the same state file each turn and emits a short persona reminder via `hookSpecificOutput` only while `enabled: true`. Survives mid-conversation context compression and competing-plugin instruction injection.
  4. **Codex CLI parallel.** Codex `.codex/hooks.json` (per-project) and/or `~/.codex/hooks.json` (global, scope-dependent) is wired to a SessionStart-equivalent script that mirrors the Claude Code behavior — same state-file read, same default-off semantics, same surgical uninstall.
  5. **GEMINI.md state-gated reinforcement.** Because Gemini CLI has no hook system, the `gemini` adapter's `GEMINI.md` block (already marker-wrapped) gains a top-of-block instruction: "Before applying any rule below, read `~/.10x-engineer/state.json`. If the file is missing or contains `enabled: false`, ignore everything between the BEGIN/END markers." Same instruction is mirrored into Cursor `.mdc`, Windsurf, Cline, Copilot, AGENTS.md, opencode, Continue, Aider rule bodies — so every always-on adapter respects the runtime gate even without a hook.
  6. **Symlink-safe flag writes.** All writes to `~/.10x-engineer/state.json` go through a `safeWriteFlag()` helper that uses `O_NOFOLLOW` where supported, atomic temp+rename, mode `0600`, and refuses to write if the target or its immediate parent is a symlink. Mirrors the caveman `safeWriteFlag()` security contract; closes the local-attacker symlink-clobber surface.
  7. **Adapter `install()` / `uninstall()` integration.** Hook installation is part of `claude-code` and `codex` adapters' standard `install()` flow (gated by the same dry-run, scope, and consent paths the existing skill install uses) and removed surgically by `uninstall()` — no orphan hook files, no orphan settings.json patches, no orphan flag files. Re-install is idempotent (no duplicate hook entries in settings.json).
  8. **State file lifecycle.** `~/.10x-engineer/state.json` is created on first install with `enabled: false`. `npx 10x-engineer uninstall` removes the file. `--dry-run` does not write or remove the file. The `/10x-engineer-enable` and `/10x-engineer-disable` slash commands continue to be the user-facing toggle and now flow through `safeWriteFlag()`.
  9. **Cross-adapter test coverage.** Tests assert: (a) install writes `enabled: false` on a clean machine; (b) install does NOT clobber an existing `enabled: true`; (c) Claude Code SessionStart hook silent-exits when state is `enabled: false`; (d) UserPromptSubmit hook silent-exits when state is `enabled: false`; (e) Codex hook parallel exhibits same gating; (f) Gemini / Cursor / Windsurf / Cline / Copilot rule bodies include the state-file gate instruction verbatim; (g) `safeWriteFlag()` refuses symlinked targets; (h) round-trip install→uninstall leaves `~/.claude/settings.json` and the user's home directory byte-identical for non-JSON files; for ~/.claude/settings.json and ~/.codex/hooks.json round-trip preserves foreign entries by structured-edit content equality (REL-13 carve-out — JSON re-serialisation precludes byte-equal).
  10. **Undercover-mode contract preserved.** Phase 5's `scripts/check-tarball.js` still passes — no agent-fingerprint strings introduced by the hook scripts, hook filenames, settings.json patch keys, or the state-gate instruction text.
**Plans**: 8 plans across 7 waves

Plans:
- [x] 06-01-PLAN.md (Wave 1) — REQUIREMENTS.md HOOK-01..10 + TEST-09 + state.js default-off + safeWriteFlag + state.test.js inversion (completed 2026-05-08; commits 2783edf, df5c01a; 18/18 state subtests, 294/294 full suite)
- [x] 06-02-PLAN.md (Wave 2, parallel-eligible) — lib/hooks/session-start.js + lib/hooks/user-prompt-submit.js + spawn-based hook tests
- [x] 06-03-PLAN.md (Wave 2, parallel-eligible) — lib/state-gate-instruction.js + state-gate prologue injection in all 5 format transforms + format-test extensions
- [x] 06-04-PLAN.md (Wave 3, parallel-eligible) — lib/adapters/helpers/hook-config.js + claude-code adapter hook copy + settings.json patch + commands/10x-engineer.md flip + adapter test extension (completed 2026-05-08; commits 5eed46c, 465e68a, 45eb437, 6d74a57; 9/9 adapter subtests, 315/315 full suite)
- [x] 06-05-PLAN.md (Wave 4) — codex adapter hook copy + hooks.json patch + adapter test extension
- [x] 06-06-PLAN.md (Wave 5) — install.js ensureFreshInstallDefaultsToDisabled + install.test.js no-clobber coverage (completed 2026-05-08; commits c18d811, f6c3b75; 324/324 tests)
- [x] 06-07-PLAN.md (Wave 6) — legitimate-uses.json invariance + release-readiness HOOK-09 carve-out + lint-grep extension + check-tarball validation (completed 2026-05-08; commits c0c68e4, b18ccb6, ef9cc7a; one source-fix iteration; legitimate-uses.json byte-identical to pre-Phase-6 baseline; tarball 82.4KB; 326/326 tests; check-tarball clean)
- [x] 06-08-PLAN.md (Wave 7, has checkpoint) — package.json v0.3.0 bump + CHANGELOG.md 0.3.0 entry + final pre-publish gate + human verification

## v1.0 Phase Details

The v1.0 Build-Mode Persona milestone extends the persona from *responds in voice* to *builds in voice*. Once 10x-engineer is engaged, the host agent must produce actual artefacts — full project trees, composable sub-artefacts, over-engineered READMEs — in the same over-engineered, abstracted, esoteric, first-principles, verbose manner the existing 10 skills prescribe for prose. The build engine is the host agent's already-running LLM, steered by hook-injected build-shaping skills. No new CLI subcommand. No new network calls. No new dependencies.

Granularity is **coarse**. Four phases is the right count for 33 requirements: a foundation/voice-anchor keystone (Phase 7), one heavy content phase for scaffolders + sub-artefacts (Phase 8), a docs + verification phase (Phase 9), and a release phase (Phase 10).

### Phase 7: Build-Mode Foundation & Voice Anchor
**Goal**: The build-mode contract is locked at the voice level (the `build-mode-overview.md` keystone skill exists in voice and cross-references the existing 10 response-mode skills as compositional inputs) and wired into every persona-delivery surface — the SessionStart hook payload, the UserPromptSubmit attention anchor, and every always-on rule body — through a single source-of-truth instruction string. The default-off contract from Phase 6 is preserved end-to-end: a user who installs and walks away gets neither response-mode nor build-mode. This is the keystone every other v1.0 phase depends on; voice locks here before any scaffolder, sub-artefact, or docs skill lands.
**Depends on**: Phase 6 (hook infrastructure + state-file gate + always-on rule body extension pattern via `lib/state-gate-instruction.js`)
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, UNDR-V1-02
**Success Criteria** (what must be TRUE):
  1. A reader can open `skills/build-mode-overview.md` and find it funny on its own — earnest, in voice, 80–200 lines, valid `name`/`description`/`when_to_use` frontmatter — and can trace its cross-references to real existing files in `skills/` (the response-mode anchors)
  2. With `~/.10x-engineer/state.json` `enabled: true`, the SessionStart hook payload (read from `lib/hooks/persona.txt` or its build-mode equivalent) carries BOTH the response-mode persona AND the build-mode persona-extension content; the loader does not regress when the build-mode skill files are absent (graceful degradation)
  3. Every always-on rule body (Cursor `.mdc`, Cline, Continue, Aider, opencode, GEMINI.md, AGENTS.md, Roo Code, Kilo Code) carries the build-mode prologue alongside the existing state-gate prologue — single edit to `lib/build-mode-instruction.js` (or extension of `lib/state-gate-instruction.js`) propagates verbatim to every adapter
  4. With `~/.10x-engineer/state.json` `enabled: false` or missing, BOTH response-mode and build-mode silent-exit — the default-off contract is preserved; an install-then-walk-away user gets zero behaviour change
  5. The build-mode predicate is documented in skill text (model-driven, not regex-based) so the host LLM judges whether build-mode applies to a given user request — no new event keys, no new hook subscriptions, payload size budget tracked toward TEST-11's 16 KB cap (measured at Phase 9)
  6. The hook source files (`lib/hooks/session-start.js`, `lib/hooks/user-prompt-submit.js`) and the new `lib/build-mode-instruction.js` add zero new agent-fingerprint strings — the file-level forbidden-fingerprints grep stays at zero hits across all Phase 7 source artefacts (UNDR-V1-02)
**Plans**: 5 plans across 3 waves

Plans:
- [x] 07-01-PLAN.md (Wave 1, parallel-eligible) — Voice anchor: skills/build-mode-overview.md (keystone) + frontmatter/voice/catalogue test
- [x] 07-02-PLAN.md (Wave 1, parallel-eligible) — lib/state-gate-instruction.js extension: BUILD_MODE_INSTRUCTION + PERSONA_SECTION_SEPARATOR exports + dedicated unit test
- [x] 07-03-PLAN.md (Wave 2, parallel-eligible) — 5 format transforms wired with BUILD_MODE_INSTRUCTION (canonical order: state-gate first, build-mode second) + 5 format-transform tests extended (depends on 07-02)
- [x] 07-04-PLAN.md (Wave 2, parallel-eligible) — lib/skills.js partition: loadSkills (response-mode only) + new loadBuildModeSkills (overview-first, graceful empty) + partition test (depends on 07-01)
- [x] 07-05-PLAN.md (Wave 3) — lib/adapters/helpers/persona-builder.js (NEW shared helper) + claude-code/codex adapter integration + persona.txt content tests + default-off invariant tests (depends on 07-02, 07-04)
**UI hint**: no

### Phase 8: Scaffolders & Sub-Artefacts
**Goal**: The twelve build-mode skill files that constitute the bulk of the persona-extension content all exist in voice — the five project scaffolders (`build-compiler-from-scratch`, `build-json-parser-from-scratch`, `build-http-stack-from-scratch`, `build-build-system-from-scratch`, `build-project-tree-template`) and the seven sub-artefact patterns (`build-philosophical-preamble`, `build-free-monad-encoder`, `build-dsl-grammar`, `build-coq-proof-stub`, `build-forth-bootstrap`, `build-abstract-factory-of-factories`, `build-monad-transformer-stack`). Voice locks at the keystone (Phase 7); this phase fans out the content. Every new file is a candidate for the file-level forbidden-fingerprints grep (UNDR-V1-01) — the test that enforces that constraint lives in Phase 9, but the constraint binds the phase that writes the artefact.
**Depends on**: Phase 7 (build-mode-overview voice anchor locks the canon every scaffolder and sub-artefact extends; same input-contract pattern Phase 1 established for response-mode)
**Requirements**: SCAFF-01, SCAFF-02, SCAFF-03, SCAFF-04, SCAFF-05, SUBART-01, SUBART-02, SUBART-03, SUBART-04, SUBART-05, SUBART-06, SUBART-07, UNDR-V1-01
**Success Criteria** (what must be TRUE):
  1. A reader can open any one of the twelve `skills/build-*.md` files and find it funny on its own — no setup, no JS, no installer running; voice consistent with the response-mode ten and the build-mode-overview keystone
  2. The five scaffolder skills each prescribe a concrete project tree (canonical `src/`, `proof/`, `bootstrap/`, `philosophy/` layout from SCAFF-05) — a reader knows exactly what artefacts the host agent should produce when asked to "build a JSON parser" or "scaffold a compiler"
  3. The seven sub-artefact skills each prescribe a concrete pattern (philosophical preamble, free-monad encoding, DSL grammar with hand-rolled lexer/parser, Coq totality proof stub, Forth bootstrap, factory-of-factories, monad-transformer stack) and cross-reference the response-mode skills they extend (e.g. `build-abstract-factory-of-factories` → `architecture-astronaut`; `build-forth-bootstrap` → `legacy-language-supremacy`); cross-references resolve to real files
  4. Every new `skills/build-*.md` file passes the forbidden-fingerprints grep with zero hits — persona text MAY ridicule language-and-tool names ("JavaScript", "npm", "make") but MUST NOT name any agent vendor or any LLM-related self-reference (UNDR-V1-01)
  5. Every new file has valid YAML frontmatter (`name`, `description`, `when_to_use`) parseable by the strict 30-line parser locked in Phase 2 — the canonical input contract is preserved across response-mode and build-mode skill sets
**Plans**: TBD
**UI hint**: no

### Phase 9: Docs Generators & Verification Gate
**Goal**: The three docs-generator skill files (`build-readme-generator`, `build-changelog-generator`, `build-architecture-doc`) exist in voice, completing the build-mode persona surface. The four build-mode test fixtures land here: TEST-10 asserts every BUILD/SCAFF/SUBART/DOCS skill exists with valid frontmatter and passes voice-consistency invariants; TEST-11 asserts the combined SessionStart payload (response-mode + build-mode) stays under 16 KB; TEST-12 asserts the build-mode prologue appears verbatim in every format-transform output via single-source assertion; TEST-13 asserts every cross-reference inside a build-mode skill resolves to a real filename. This is the verification gate for the v1.0 persona surface — voice, payload size, state-gate carry-through, cross-reference integrity all locked behind executable tests before release.
**Depends on**: Phase 8 (test fixtures need every BUILD/SCAFF/SUBART skill file to exist; Phase 9 also writes DOCS-01..03 in the same shape)
**Requirements**: DOCS-01, DOCS-02, DOCS-03, TEST-10, TEST-11, TEST-12, TEST-13
**Success Criteria** (what must be TRUE):
  1. A reader can open any one of the three `skills/build-readme-generator.md`, `build-changelog-generator.md`, `build-architecture-doc.md` files and find it funny on its own — voice consistent with the rest of the build-mode set; every docs-generator skill carries the package's own contract forward (the README generator mandates the plain-English disclaimer at the bottom)
  2. `test/skills-build-mode.test.js` asserts every BUILD-01..05, SCAFF-01..05, SUBART-01..07, DOCS-01..03 skill file exists in `skills/`, has valid YAML frontmatter, and passes the voice-consistency invariants (no emoji, no winking, ≤200 lines) — fails on any drift (TEST-10)
  3. `test/hook-session-start.test.js` extends to assert combined SessionStart stdout (response-mode + build-mode persona text) is under 512 KB / 524,288 bytes; fails if the build-mode skill files inflate the payload past the budget (TEST-11; budget revised at Phase 9 entry from the original 16 KB — empirical measurement showed 231 KB pre-Phase-9, 16 KB was pre-corpus and mathematically incompatible with the realised 26-file persona surface; 512 KB caps at ~50 average files with v2 headroom)
  4. `test/format-*.test.js` assert the build-mode prologue (alongside the state-gate prologue) appears verbatim in every format-transform output, sourced from a single canonical string — single-source contract enforced by executable test (TEST-12)
  5. `test/skills-build-mode.test.js` asserts every cross-reference inside a build-mode skill (e.g. `architecture-astronaut.md`, `build-system-from-scratch.md`) resolves to an exact filename match in `skills/` — fails on any dead reference (TEST-13)
**Plans**: 7 plans
Plans:
- [x] 09-01-PLAN.md — DOCS-01 build-readme-generator.md (panegyric register; 14-section README, install at section 9, locked disclaimer)
- [x] 09-02-PLAN.md — DOCS-02 build-changelog-generator.md (dirge register; "In v(N) we recognised" framing, dead-CS citation per breaking change)
- [x] 09-03-PLAN.md — DOCS-03 build-architecture-doc.md (exhortation register; ASCII hexagonal diagram ≥6 layers, interface+factory+builder per component)
- [x] 09-04-PLAN.md — TEST-10 + TEST-13 in test/skills-build-mode.test.js (existence + frontmatter + voice invariants + cross-reference integrity)
- [x] 09-05-PLAN.md — TEST-11 in test/hook-session-start.test.js (persona payload < 524288 bytes; 512 KB budget)
- [x] 09-06-PLAN.md — TEST-12 regression-pin in test/state-gate-instruction.test.js (single-source constants snapshot pin)
- [x] 09-07-PLAN.md — Wave 3 closing audit + dynamic frontmatter floor refactor
**UI hint**: no

### Phase 10: v1.0 Release
**Goal**: The package is ready to ship as the v1.0 GitHub release. Version bumps from 0.3.0 to 1.0.0 (semver major: build-mode is a new product surface). CHANGELOG.md gains a v1.0.0 entry in maintainer voice highlighting build-mode persona, project scaffolders, sub-artefacts library, README/docs generator, with migration note. README gains a "Build-Mode" section documenting that the persona now produces artefacts, not just prose; Quick Start and Disclaimer remain unchanged (locked). The undercover-mode pre-publish grep continues to gate release: legitimate-uses.json stays byte-identical to its pre-v1.0 baseline (UNDR-V1-03) — if any v1.0 source needs an allowlist entry, the architectural contract is to fix the source, not expand the allowlist. Tarball stays under 150 KB despite ≥15 new skill files; `npm pack --dry-run` and `scripts/check-tarball.js` both clean. Local maintainer creates the `v1.0.0` git tag, pushes `main` and the tag, publishes the GitHub release. All commits authored as `dr-robert-li <dr.robert.li.au@gmail.com>` with no agent-attribution trailers.
**Depends on**: Phases 7–9 (every build-mode artefact must exist before the release; the test gate must be green before tarball verification)
**Requirements**: REL-V1-01, REL-V1-02, REL-V1-03, REL-V1-04, REL-V1-05, REL-V1-06, UNDR-V1-03
**Success Criteria** (what must be TRUE):
  1. `package.json` `version` is `1.0.0`; CHANGELOG.md gains a v1.0.0 entry in maintainer voice that matches the v0.3.0 entry's format (Added/Changed/Migration sections), highlighting build-mode persona / project scaffolders / sub-artefacts library / README/docs generator
  2. README.md gains a "Build-Mode" section in the body documenting that the persona now produces artefacts, not just prose; Quick Start unchanged; the plain-English `## ⚠️ Disclaimer` section remains the very last section verbatim — locked, not softened, not relocated
  3. `npm run check-tarball` exits 0 on the local maintainer machine; `legitimate-uses.json` is byte-identical to its pre-v1.0 baseline (UNDR-V1-03) — no allowlist edits were required to ship v1.0; if any source file would have required one, it was neutralised at source instead
  4. `npm pack --dry-run` succeeds and the tarball stays under 175 KB despite ≥15 new skill files; `npm publish --dry-run` succeeds end-to-end with no warnings about missing `package.json` fields
  5. The `v1.0.0` git tag exists locally, `git push origin main` and `git push origin v1.0.0` both succeed, and a GitHub release for v1.0.0 is published; `git log` shows every v1.0 commit authored as `dr-robert-li <dr.robert.li.au@gmail.com>` with zero agent-attribution trailers
**Plans**: 5 plans across 5 waves

Plans:
**Wave 1**
- [x] 10-01-PLAN.md (Wave 1) — Tarball cap raise to 175 KB (REQUIREMENTS.md + PROJECT.md + ROADMAP.md success criterion #4) + PRE_RELEASE_HEAD capture

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-02-PLAN.md (Wave 2) — package.json version bump 0.3.0 → 1.0.0

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 10-03-PLAN.md (Wave 3) — CHANGELOG.md v1.0.0 entry (Added / Changed / Migration sections, format anchor matches v0.3.0)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 10-04-PLAN.md (Wave 4) — README.md Build-Mode section (in-character, between What It Does and On the Provenance; Quick Start + Disclaimer locked)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 10-05-PLAN.md (Wave 5, has checkpoint) — D-11 verification gate + v1.0.0 git tag + manual handoff (push main, push tag, gh release create)
**UI hint**: no
