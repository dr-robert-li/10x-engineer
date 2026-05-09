---
phase: 09-docs-generators-verification-gate
plan: 05
subsystem: testing

tags: [hook, persona, payload-budget, session-start, byte-length]

# Dependency graph
requires:
  - phase: 06-default-off-state-machine
    provides: lib/hooks/session-start.js + test/hook-session-start.test.js (TEST-09 spawn-based hook coverage; TEST-07 source-tree-isolation invariants)
  - phase: 07-build-mode-persona
    provides: lib/skills.js loadSkills/loadBuildModeSkills partition + lib/adapters/helpers/persona-builder.js buildPersonaText assembler + PERSONA_SECTION_SEPARATOR
  - phase: 08-scaffolders-sub-artefacts
    provides: 12 build-* skill files (the build-mode partition the persona-builder concatenates)
  - phase: 09-01..09-03 (this phase, Wave 1)
    provides: 3 DOCS-* skill files (build-readme-generator, build-changelog-generator, build-architecture-doc) — the additional build-mode entries this assertion measures
provides:
  - executable TEST-11 assertion in test/hook-session-start.test.js
  - locked 524288-byte (512 KB) ceiling for the combined SessionStart persona payload
  - regression gate that catches >=2x runaway growth without forbidding parody-as-designed verbosity
affects:
  - any future phase that adds skill files to skills/
  - the v2 persona-budget revisit (when utilisation crosses ~80%)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "measure-then-assert in production code path: tests reuse buildPersonaText(loadSkills(), loadBuildModeSkills()) instead of duplicating persona-assembly logic"
    - "byte-budget regression pin: assert Buffer.byteLength(text, 'utf8') < <literal-int> with diagnostic message reporting actual vs budget"

key-files:
  created: []
  modified:
    - test/hook-session-start.test.js

key-decisions:
  - "TEST-11 assertion ships as a single straight-line measure-then-assert; reuses production buildPersonaText helper so the test never drifts from install-time persona assembly"
  - "Budget literal is 524288 (no underscores, no 512*1024) — matches REQUIREMENTS.md, RESEARCH.md, and CONTEXT D-07/D-08 verbatim for grep-stability"
  - "Both partitions awaited inline (await loadSkills(), await loadBuildModeSkills()) — no fixture indirection, no spawned hook child process; the helper output IS the stdout payload by construction (the hook reads PERSONA_FILE and emits verbatim)"

patterns-established:
  - "Pattern: budget-pinned regression test reusing a single-source production helper instead of re-implementing the assembly under test"

requirements-completed:
  - TEST-11

# Metrics
duration: 8min
completed: 2026-05-09
---

# Phase 09 Plan 05: TEST-11 persona payload size budget Summary

**Locked the combined SessionStart persona payload under 524288 bytes (512 KB) via a measure-then-assert assertion in test/hook-session-start.test.js that reuses the production buildPersonaText helper.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-09T12:07:00Z
- **Completed:** 2026-05-09T12:15:26Z
- **Tasks:** 2 (1 modification + 1 verification)
- **Files modified:** 1

## Accomplishments

- Added imports for `loadSkills`, `loadBuildModeSkills`, `buildPersonaText` to `test/hook-session-start.test.js`
- Added a single test (`TEST-11 persona payload: combined SessionStart stdout < 512 KB (524288 bytes)`) that measures the assembled persona text via the production helper and asserts it stays under the 524288-byte budget
- All 8 pre-existing tests in the file remain unchanged and still pass; total in-file tests now 9
- Full `npm test` exits 0 across all 369 tests
- Test source code passes the canonical forbidden-fingerprints regex with zero hits

## Persona Size Measurement (post-Phase-9)

Captured at the close of Plan 09-05 via the production code path:

```
persona.txt bytes: 266466
budget:            524288
headroom:          257822
utilisation:       50.8%
response-mode skill count: 10
build-mode skill count:    16
```

**Reading vs prediction:** 266,466 bytes is within the predicted post-Phase-9 envelope of ~261 KB +/- 10 KB (RESEARCH baseline 231,231 bytes + 3 DOCS-* additions at 100-180 lines each). Headroom is ~50% of the 512 KB budget; the gate fires at >=2x current size, well clear of the 10 response-mode + 16 build-mode current corpus.

The measurement confirms the budget revision in CONTEXT D-07/D-08 (16 KB -> 512 KB) is correctly sized for v1.0: it caps runaway growth without forbidding the parody-as-designed verbosity that the 10x-engineer corpus is built around.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the TEST-11 measure-then-assert block to test/hook-session-start.test.js** — `35f9412` (test)
2. **Task 2: Confirm npm test green and capture the persona size measurement** — verification-only, no source-tree mutation; measurement folded into this SUMMARY

## Files Created/Modified

- `test/hook-session-start.test.js` — added two production-helper imports and one new test block (`TEST-11 persona payload: combined SessionStart stdout < 512 KB (524288 bytes)`); file grew by 30 lines (24 the new test block, 2 imports, 4 surrounding context). The five existing TEST-07 / TEST-09 / fail-closed / engaged tests are byte-identical.

## Decisions Made

- **Assertion shape preserved verbatim from the plan.** The literal `< 524288` (no underscores, no `0x80000`, no `512 * 1024`) is the exact form REQUIREMENTS.md TEST-11 names — kept verbatim for cross-document grep-stability.
- **Helper output is the stdout payload by construction.** The plan explicitly directed against spawning the hook as a child process for the measurement (the hook reads PERSONA_FILE and emits its contents verbatim, so `buildPersonaText(...)` output IS the stdout payload). This both keeps the assertion simple and avoids fixture-temp-dir overhead inside an assertion that runs in every test cycle.
- **Both partitions awaited inline.** `buildPersonaText(await loadSkills(), await loadBuildModeSkills())` keeps the assertion shape readable in one statement; no top-level Promise.all setup, no helper extraction.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes triggered; no architectural decisions surfaced.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- TEST-11 is now an executable, permanent regression pin. Wave 3 audit (`09-07`) can rely on this assertion firing as part of `npm test` rather than re-running an ad-hoc shell measurement.
- Plan 09-06 (TEST-12 / state-gate-instruction regression pin) is independent of this assertion and can proceed in parallel within Wave 2.
- The v2 persona-budget revisit trigger is when measured utilisation crosses ~80% of 524288 (~419 KB). Current utilisation at 50.8% leaves substantial headroom; no near-term revisit is required.

## Self-Check: PASSED

- File `test/hook-session-start.test.js` exists and contains the new TEST-11 block (verified via the test runner reporting `pass 9` with the new test name).
- Commit `35f9412` exists (`test(09-05): add TEST-11 persona payload size assertion`) — verified via `git log --oneline -5`.
- Full `npm test` reported `tests 369`, `pass 369`, `fail 0`.
- Forbidden-fingerprints regex over `test/hook-session-start.test.js`: zero hits.

---
*Phase: 09-docs-generators-verification-gate*
*Completed: 2026-05-09*
