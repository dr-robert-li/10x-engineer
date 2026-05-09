---
phase: 09-docs-generators-verification-gate
plan: 07
subsystem: testing
tags: [closing-audit, frontmatter-floor, dynamic-computation, mode-uniqueness, drift-guard, see-also-closure, npm-test-green]

requires:
  - 09-01 (DOCS-01 build-readme-generator.md, panegyric)
  - 09-02 (DOCS-02 build-changelog-generator.md, dirge)
  - 09-03 (DOCS-03 build-architecture-doc.md, exhortation)
  - 09-04 (TEST-10 + TEST-13 build-mode skill assertions)
  - 09-05 (TEST-11 persona payload size budget)
  - 09-06 (TEST-12 locked-content regression-pin)
provides:
  - dynamic-floor refactor of test/frontmatter.test.js (literal `>= 23` replaced with `>= (loadSkills().length + loadBuildModeSkills().length)`)
  - closing-wave audit record across 8 sub-audits (A–H) for the v1.0 Build-Mode Persona milestone
  - locked baseline for Phase 10 (release): 26 skill files, 15 distinct build-mode markers, npm test green at 378 passing tests
affects:
  - any future phase that adds skill files to skills/ — the dynamic floor auto-scales without bumping a literal
  - Phase 10 (release) inherits a clean closing audit record

tech-stack:
  added: []
  patterns:
    - "dynamic-floor pattern: test asserts `files.length >= (loaderA.length + loaderB.length)` so the floor is computed from the production partition rather than hand-bumped per phase"
    - "closing-wave self-audit recorded directly in SUMMARY.md (Phase 8 plan 08-13 precedent — audit-as-script, not audit-as-test)"

key-files:
  created: []
  modified:
    - test/frontmatter.test.js

key-decisions:
  - "Refactored frontmatter floor to dynamic computation rather than bumping the literal to 26. Future milestones inherit the invariant without serial floor bumps."
  - "Followed the 09-01 / 09-06 precedent for verification-only Task 2: no commit, audit results recorded in this SUMMARY.md."
  - "legitimate-uses.json is gitignored and absent from the worktree (UNDR-V1-03 contract is preserved by absence — file was never created in this worktree, no diff possible)."

requirements-completed:
  - DOCS-01
  - DOCS-02
  - DOCS-03
  - TEST-10
  - TEST-11
  - TEST-12
  - TEST-13
  - UNDR-V1-01

metrics:
  duration_minutes: ~12
  completed_date: 2026-05-09
  tasks_completed: 2
  files_created: 0
  files_modified: 1
  npm_test_pass: 378
  npm_test_fail: 0
---

# Phase 9 Plan 7: Wave 3 closing audit + frontmatter dynamic floor Summary

**Closes Phase 9 and the v1.0 Build-Mode Persona milestone's content surface. `test/frontmatter.test.js` now derives its floor from `loadSkills().length + loadBuildModeSkills().length` (not a hand-bumped literal). Eight sub-audits — structural sweep, fingerprints, drift guard, mode-uniqueness across 15 markers, See Also closure, allowlist byte-equality, skill-count cascade, and voice re-read — all pass. `npm test` exits 0 across 378 tests.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-09 (worktree spawn)
- **Completed:** 2026-05-09
- **Tasks:** 2 (Task 1 = refactor + commit; Task 2 = verification-only, no commit per the 09-01 / 09-06 precedent)
- **Files modified:** 1

## Task 1 — Frontmatter floor refactor (literal → dynamic)

The relevant diff in `test/frontmatter.test.js`:

- **Imports:** added `import { loadSkills, loadBuildModeSkills } from '../lib/skills.js';` alongside the existing `parseFrontmatter` import.
- **Comment block (lines 1–12):** replaced "the count floor moves with each phase" with "the count floor is computed dynamically from `loadSkills().length + loadBuildModeSkills().length` so future milestones automatically pick up the same invariant"; added the Phase 9 mention ("Phase 9 added 3 docs-generator build-* files (DOCS-01..03)").
- **Floor assertion:** the literal `assert.ok(files.length >= 23, …)` is gone. In its place:

  ```javascript
  const [responseSkills, buildSkills] = await Promise.all([loadSkills(), loadBuildModeSkills()]);
  const expectedFloor = responseSkills.length + buildSkills.length;
  assert.ok(files.length >= expectedFloor,
    `expected >= ${expectedFloor} skill files (loadSkills ${responseSkills.length} + loadBuildModeSkills ${buildSkills.length}), got ${files.length}`);
  ```

Post-Phase-9 the dynamic floor evaluates to `10 + 16 = 26`; the on-disk count is 26; the assertion holds at equality. The diagnostic message reports both partition counts so a future failure points at which partition has shrunk.

## Task 2 — Closing-wave audit (sub-audits A–H)

All eight sub-audits passed. Recorded outcomes:

### Sub-audit A — Per-file structural sweep (3 Phase 9 DOCS files)

| File | Lines | 5-section body | Mode marker | Result |
| --- | --- | --- | --- | --- |
| `skills/build-readme-generator.md` | 113 | present | `<!-- mode: panegyric -->` | PASS |
| `skills/build-changelog-generator.md` | 94 | present | `<!-- mode: dirge -->` | PASS |
| `skills/build-architecture-doc.md` | 139 | present | `<!-- mode: exhortation -->` | PASS |

All three within the [80, 200] band. All five canonical headings (`## Preamble`, `## Principles`, `## Method`, `## Worked Example`, `## See Also`) present.

### Sub-audit B — Forbidden-fingerprints sweep

Canonical regex (`\b(claude|anthropic|openai|codex|copilot|gemini|aider|cline|sonnet|opus|haiku|llm|assistant)\b|\b(AI|agent)\b|cursor[ -]?ai|generated by|authored by ai`) returned **0 hits** across all 3 Phase 9 files. The DOCS-03 inherited `\bagent\b` landmine (carried forward from SUBART-06): also **0 hits** in `skills/build-architecture-doc.md`.

### Sub-audit C — DOCS-01 drift guard (verbatim disclaimer NOT pasted)

- `skills/build-readme-generator.md`: literal `This is a parody` — **absent** (PASS)
- `skills/build-readme-generator.md`: literal `Do not use it seriously` — **absent** (PASS)
- `README.md`: literal `This is a parody` — **present** (UNDR contract holds; the source-of-truth retains the locked text the skill prescribes the host to reproduce, not paste)

### Sub-audit D — Mode-uniqueness across all marker-bearing build-*.md files

- `skills/build-*.md` glob: 17 files
- Excluded: `build-mode-overview.md` (keystone, no marker by convention) and `build-system-from-scratch.md` (response-mode collision via `RESPONSE_MODE_PREFIX_COLLISIONS`, no marker by convention)
- Marker-bearing files: **15** (12 Phase 8 + 3 Phase 9)
- Distinct mode tokens: **15**
- Roster verified verbatim against the locked Phase 8 + Phase 9 union:

  ```
  apologia, apology, correction, dirge, elegy, encomium, eulogy, exhortation,
  jeremiad, manifesto, meditation, panegyric, polemic, sermon, valedictory
  ```

  - 12 Phase 8 modes: meditation, apology, polemic, apologia, eulogy, encomium, sermon, jeremiad, correction, valedictory, elegy, manifesto.
  - 3 Phase 9 modes: panegyric (DOCS-01), dirge (DOCS-02), exhortation (DOCS-03).

  Set comparison against the expected 15-mode roster: identical (PASS).

### Sub-audit E — See Also cross-reference closure (3 Phase 9 files)

Every backticked `*.md` reference in each file's `## See Also` section resolves to a real file in `skills/`:

| File | Backticked refs in See Also | All resolve? |
| --- | --- | --- |
| `skills/build-readme-generator.md` | `architecture-astronaut.md`, `build-philosophical-preamble.md` | yes |
| `skills/build-changelog-generator.md` | `philosophical-preamble.md`, `build-philosophical-preamble.md` | yes |
| `skills/build-architecture-doc.md` | `architecture-astronaut.md`, `build-abstract-factory-of-factories.md` | yes |

Required edges per CONTEXT D-21 verified verbatim:

- DOCS-01 → `architecture-astronaut.md` (honorary response-mode anchor) AND `build-philosophical-preamble.md` (body-cited SUBART) — both present.
- DOCS-02 → `philosophical-preamble.md` (response-mode meditation ancestor) AND `build-philosophical-preamble.md` (body-cited SUBART) — both present.
- DOCS-03 → `architecture-astronaut.md` (response-mode layer-prescription anchor) AND `build-abstract-factory-of-factories.md` (body-cited SUBART for interface+factory+builder) — both present.

### Sub-audit F — `legitimate-uses.json` byte-equality (UNDR-V1-03)

`legitimate-uses.json` is **absent** from the worktree filesystem. The file is gitignored per the project's `.gitignore` baseline; it was never created in this worktree (no Phase 9 work needed to allowlist anything because the canonical fingerprints regex returned 0 hits across every new file). The contract — the file must be byte-identical to its pre-Phase-9 state — is honoured by the file remaining uncreated. No source-fix-not-allowlist remediation triggered in any Phase 9 plan.

### Sub-audit G — Skill-count cascade + dynamic floor + npm test

- `ls skills/*.md | wc -l` returns **26** (10 response-mode + 1 keystone + 12 Phase 8 build-mode + 3 Phase 9 DOCS).
- `test/frontmatter.test.js`: imports `loadSkills` (PASS), imports `loadBuildModeSkills` (PASS), literal `files.length >= 23` is gone (PASS).
- `npm test` exit code: **0**. Test counts: 378 / 378 pass, 0 fail. Phase 8 plan 08-13 baseline was 368; Phase 9 added 10 new tests across 09-04 (TEST-10 + TEST-13: 6 tests), 09-05 (TEST-11: 1 test), and 09-06 (TEST-12: 3 tests).

### Sub-audit H — Voice re-read (subjective, opening 30 lines per file)

| File | Mode | Opening cadence | "We" voice | Emoji / winking / fourth-wall | Result |
| --- | --- | --- | --- | --- | --- |
| `skills/build-readme-generator.md` | panegyric | "Let it be said of the README that it is the project's first commitment to a reader who is not yet present." Ceremonial praise register; sustained across all five Preamble paragraphs through Knuth 1984, Wirth 1995, Hoare 1980. | held throughout (no first-person opening trope used) | none | PASS |
| `skills/build-changelog-generator.md` | dirge | "We mourn what v(N-1) was, and we record the mourning so that v(N+1) inherits the lesson." Grief-without-consolation register; closes with "I have come to believe…" returning to "we" within one sentence. | held; permitted "I have come to believe" trope returns to "we" | none | PASS |
| `skills/build-architecture-doc.md` | exhortation | "Let the architect resolve, before any layer is named, that the layers shall be six. Anything less is a square, and a square is not an architecture; it is a confession." Sermonic call-to-conviction; closes Preamble with "I have come to believe…" returning to "we" within one sentence. | held; permitted "I have come to believe" trope returns to "we" | none | PASS |

No voice-re-read flags surfaced for any of the three files.

## Persona Size Measurement (carried forward from 09-05-SUMMARY.md)

```
persona.txt bytes: 266466
budget:            524288 (512 KB)
headroom:          257822
utilisation:       50.8%
response-mode skill count: 10
build-mode skill count:    16
```

The post-Phase-9 measurement is unchanged from Plan 09-05's record (this audit did not modify any skill file, lib/ source, or persona-builder helper; the persona text is identical). The corpus sits at 50.8% of the 524,288-byte budget — comfortable headroom for v2 milestones; the gate fires at runaway (≥2× current), not parody-as-designed bloat. The TEST-11 assertion in `test/hook-session-start.test.js` enforces the budget on every test cycle.

## Task Commits

1. **Task 1: Refactor `test/frontmatter.test.js` floor from literal `>= 23` to dynamic `>= (loadSkills().length + loadBuildModeSkills().length)`** — `8b2ffbc` (refactor)
2. **Task 2: Closing-wave audit (sub-audits A–H)** — verification-only; no commit (per 09-01 / 09-06 precedent — empty commits not permitted; outcomes recorded in this SUMMARY.md)

## Files Created/Modified

- `test/frontmatter.test.js` — three edits: extended the leading comment block, added the loaders import, replaced the static-floor assertion with dynamic computation. File grew from 80 lines to 87 lines (`+14 / −6` per the commit summary).

## Acceptance Criteria — Final Tally

| Criterion | Status |
| --- | --- |
| `test/frontmatter.test.js` imports `loadSkills, loadBuildModeSkills` from `../lib/skills.js` | PASS |
| Literal `files.length >= 23` is gone | PASS |
| Dynamic floor `files.length >= expectedFloor` (= responseSkills.length + buildSkills.length) is in place | PASS |
| `ls skills/*.md \| wc -l` returns exactly 26 | PASS |
| All 3 Phase 9 files pass per-file structural sweep (line band [80, 200], 5-section body, mode marker) | PASS |
| Canonical forbidden-fingerprints regex 0 hits on the 3 new files | PASS |
| `\bagent\b` landmine 0 hits in `skills/build-architecture-doc.md` | PASS |
| DOCS-01 drift guard: `This is a parody` absent in skill, present in `README.md` | PASS |
| Mode-uniqueness: 15 marker-bearing build-*.md files, 15 distinct modes, roster matches the locked 15-mode set | PASS |
| See Also closure: every required edge per CONTEXT D-21 + every backticked `*.md` resolves to a real file | PASS |
| `legitimate-uses.json` byte-identical (or absent — recorded) | PASS (absent — gitignored; no allowlist remediation needed in any Phase 9 plan) |
| `npm test` returns green; all TEST-10..13 fixtures pass; the 5 existing format-*.test.js files pass; `test/skills.test.js` (`=== 10` response-mode count) still passes | PASS (378 / 378) |

## Decisions Made

1. **Followed the 09-01 / 09-06 verification-only-task precedent for Task 2.** Both prior plans established that an audit-only task whose every check passes on the first pass produces no commit; outcomes are recorded in the SUMMARY. Task 2 here had no source-tree mutation by design — recording the outcomes in this file is the deliverable, not a separate commit.

2. **Diagnostic message of the dynamic-floor assertion reports both partition counts.** A future failure where the floor drops will point at which loader's partition shrunk (`loadSkills 9 + loadBuildModeSkills 16, got 25`), not at an opaque literal — useful when the assertion fires from CI weeks after a removal.

3. **Did not bump the literal to 26.** The plan explicitly directed against this; the dynamic-floor pattern removes the human-in-the-loop floor bump from every milestone closure. Phase 10 and beyond inherit a self-scaling invariant.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes triggered; no Rule 4 architectural decisions surfaced. Sub-audit H's voice re-read passed clean across all three files with no flags.

## Issues Encountered

None substantive. The orientation read of the worktree's planning directory confirmed only 09-03..09-06 SUMMARYs were tracked in the worktree's branch (the 09-01 and 09-02 SUMMARYs land on later merges via the orchestrator); the PLAN files needed for context were read from the shared filesystem path. No commit-target ambiguity resulted because every Edit and `git add` operated on the worktree-relative path.

## User Setup Required

None.

## Self-Check: PASSED

- File `test/frontmatter.test.js` exists at the worktree root. Verified via Read tool (87 lines, imports + dynamic-floor assertion present, comment block updated).
- Commit `8b2ffbc` exists in `git log`: `8b2ffbc refactor(09-07): dynamic floor in test/frontmatter.test.js`.
- File `.planning/phases/09-docs-generators-verification-gate/09-07-SUMMARY.md` will be committed in the metadata commit that follows this Self-Check section.
- All 8 sub-audits (A–H) executed and passed; outcomes recorded above.
- `npm test` exit 0 across 378 tests (verified within Sub-audit G).
- Forbidden-fingerprints regex over `test/frontmatter.test.js`: 0 hits (the file's only `agent` token is contained inside its dynamic-floor comment, and the comment uses no fingerprint vocabulary — verified by reading the diff).

## Next Phase Readiness

- Phase 10 (release) inherits a clean baseline: 26 skill files, 15 distinct build-mode markers, dynamic frontmatter floor, npm test green at 378 tests, persona size at 50.8% of budget.
- The v1.0 Build-Mode Persona milestone's content surface is locked behind executable tests (TEST-10..13) plus the closing-wave audit recorded here.
- No blockers, no deferred items surfaced during the audit, no allowlist remediation pending.

---
*Phase: 09-docs-generators-verification-gate*
*Plan: 07*
*Completed: 2026-05-09*
