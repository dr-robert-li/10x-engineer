---
phase: 09-docs-generators-verification-gate
plan: 06
subsystem: testing
tags: [node-test, regression-pin, single-source-of-truth, state-gate, build-mode]

requires:
  - phase: 06
    provides: STATE_GATE_INSTRUCTION constant + lib/state-gate-instruction.js single-source surface
  - phase: 07
    provides: BUILD_MODE_INSTRUCTION + PERSONA_SECTION_SEPARATOR sibling exports; pre-existing test/state-gate-instruction.test.js (commit 07915a7) with byte-length pin and anchor-sentence assertions; format-*.test.js wiring of order-of-appearance (sgi → bmi)
provides:
  - TEST-12 locked-content regression-pin (three additional `node:test` cases asserting verbatim substring snapshots inside the three exports)
  - drift detector for the state-file path, engagement-key JSON literal, build-mode catalogue keystone, trigger phrase, and BUILD-MODE EXTENSIONS section header
affects:
  - any future change to lib/state-gate-instruction.js (must keep snapshots verbatim or update both constant and pin together)
  - Phase 9 plan 07 (Wave 3 audit verifies the 5 format-*.test.js files still pass — those assertions remain unchanged)

tech-stack:
  added: []
  patterns:
    - "regression-pin tests: thin substring assertions co-located at the constants module, complementing transform-output assertions in format-*.test.js"

key-files:
  created: []
  modified:
    - test/state-gate-instruction.test.js

key-decisions:
  - "Augment-don't-rewrite: the file already existed (Phase 7 plan 02 commit 07915a7) with 7 tests. The plan's `(NEW)` precondition was incorrect. Added the 3 missing locked-content snapshot tests rather than recreating the file, preserving the byte-length pin (487), anchor-sentence assertions, and forbidden-fingerprint cross-check that Phase 7 already shipped."
  - "Locked snapshots chosen: `~/.10x-engineer/state.json`, `\"enabled\": true` (with surrounding quotes — verbatim from lib/state-gate-instruction.js:48), `skills/build-mode-overview.md`, `tangible artefact`, and `BUILD-MODE EXTENSIONS`. All five strings verified present in the production constants before assertions written."
  - "Did NOT modify any of the 5 test/format-*.test.js files. Per CONTEXT D-09 PIVOT, those already wire `out.content.includes(STATE_GATE_INSTRUCTION)` + `out.content.includes(BUILD_MODE_INSTRUCTION)` + order assertion (`bmi > sgi`). Restating them here would be no-op duplication."

patterns-established:
  - "Two-layer single-source contract: constants module (this file's tests pin substrings) + transform outputs (format-*.test.js pin presence + order). Drift in either layer surfaces independently."

requirements-completed:
  - TEST-12

duration: 9min
completed: 2026-05-09
---

# Phase 9 Plan 06: TEST-12 Locked-Content Regression-Pin Summary

**Three new substring-snapshot assertions added to `test/state-gate-instruction.test.js` pinning `~/.10x-engineer/state.json`, `"enabled": true`, `skills/build-mode-overview.md`, `tangible artefact`, and `BUILD-MODE EXTENSIONS` verbatim in the three single-source-of-truth exports.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-09 (worktree spawn)
- **Completed:** 2026-05-09
- **Tasks:** 2 (Task 1 = augment file; Task 2 = verification only — no commit needed, no file changes)
- **Files modified:** 1

## Accomplishments

- `test/state-gate-instruction.test.js` grew from 7 tests to 10. The new three pin verbatim substring snapshots in `STATE_GATE_INSTRUCTION`, `BUILD_MODE_INSTRUCTION`, and `PERSONA_SECTION_SEPARATOR`.
- Silent-shrink drift in any of the three constants is now caught at the constants module before format-transform tests downstream run.
- All 68 format-*.test.js cases still pass individually. `npm test` exits 0 with 371 passing tests.

## Task Commits

1. **Task 1: Add TEST-12 locked-content snapshots to state-gate-instruction** - `d36c63b` (test)
2. **Task 2: Confirm npm test green and the 5 format-*.test.js files still pass** - verification-only, no file changes, no commit (per gsd-executor protocol — empty commits not permitted)

## Files Created/Modified

- `test/state-gate-instruction.test.js` — appended three new test blocks below the existing seven, plus a comment block explaining what each new snapshot pins and why.

## Verification Results

- **`node --test test/state-gate-instruction.test.js`** — exit 0, 10/10 pass.
- **`node --test test/format-{native-skills,mdc,append-markers,concat-md,yaml-config-md}.test.js`** — exit 0, 68/68 pass. Phase 7 plan 03 wiring intact.
- **`npm test`** — exit 0, 371/371 pass.
- **Locked-content snapshots verified verbatim against production code:**
  - `STATE_GATE_INSTRUCTION` (lib/state-gate-instruction.js:40-48):
    - `~/.10x-engineer/state.json` — present (line 42, inside backticks)
    - `"enabled": true` — present (lines 47-48, with surrounding quotes)
  - `BUILD_MODE_INSTRUCTION` (lib/state-gate-instruction.js:50-57):
    - `skills/build-mode-overview.md` — present (line 54, inside backticks)
    - `tangible artefact` — present (line 51, after the em-dash trigger)
  - `PERSONA_SECTION_SEPARATOR` (lib/state-gate-instruction.js:59-64):
    - `BUILD-MODE EXTENSIONS` — present (line 61, after `# `)
- **`lib/state-gate-instruction.js`** — byte-identical, no production-code edits.
- **`legitimate-uses.json`** — not touched.

## Decisions Made

1. **Augment, don't rewrite.** The file existed at HEAD from Phase 7 plan 02 (commit `07915a7`). The plan frontmatter and objective described creating it as a NEW file, but the seven existing tests are strictly stronger than the plan's three (byte-length pin at 487, anchor sentences, ends-with separator, fingerprint regex sweep across all three exports). Deleting them to satisfy the plan's "(NEW)" framing would have been a regression. I appended the three locked-content snapshot tests instead.

2. **`"enabled": true` with surrounding double-quotes.** The plan called this out as load-bearing. Verified in the production constant (line 47-48 wraps the literal in backticks-then-string-concat: `'\`"enabled": true\`'`). The substring `"enabled": true` (no escapes, with the surrounding double quotes) appears verbatim and is what `String.prototype.includes` will match.

3. **Test names prefixed `TEST-12 locked snapshot:`** to distinguish from the existing seven test names and keep `node --test` output legible.

4. **No changes to any format-*.test.js file.** CONTEXT D-09 PIVOT is explicit: the 5 format tests already assert presence and order. Per Pitfall 1 in RESEARCH ("don't restate"), restating would be no-op duplication.

## Deviations from Plan

**1. [Rule 3 - Blocking] File pre-existed; augmented instead of created**

- **Found during:** Task 1 setup (orientation read of the worktree)
- **Issue:** Plan 09-06 frontmatter `must_haves.truths[0]` says "test/state-gate-instruction.test.js (NEW) exists as a thin regression-pin". The file actually exists at HEAD from Phase 7 plan 02 commit `07915a7` ("test(07-02): pin export shape + size + fingerprint contracts on state-gate-instruction"), with seven passing tests. Recreating from scratch would have deleted the byte-length pin (`Buffer.byteLength === 487`), the `startsWith('Before applying ANY rule below')` and `endsWith('\\n\\n---\\n\\n')` anchors, and the fingerprint regex sweep — all of which provide strictly stronger coverage than the plan's three substring-includes assertions.
- **Fix:** Appended three new `test('TEST-12 locked snapshot: …', …)` blocks to the existing file, with a comment block above them explaining what each pins. The seven existing tests are untouched. The three new tests carry the exact substring assertions specified in the plan's `<action>` body — they cover what the plan asks for.
- **Files modified:** test/state-gate-instruction.test.js (10 tests now; was 7)
- **Verification:** All 10 tests pass; all 5 format-*.test.js files still pass (68 tests); `npm test` exits 0 (371 tests).
- **Committed in:** `d36c63b`

**2. [Note — not auto-fixed] Plan's literal forbidden-fingerprints grep is self-matching by construction**

- **Found during:** Task 1 verify step (running the plan's exact `grep -nEi` command on the augmented file)
- **Observation:** The grep matches line 18 of the file: the FORBIDDEN regex literal that enumerates the brand-name token list as a character class. The grep pattern and the regex stored in the FORBIDDEN constant share the same character class by design — the constant *is* the forbidden-fingerprints regex used to test the production strings against the canonical token list. Removing the FORBIDDEN constant to satisfy the literal grep would gut the seventh existing test.
- **Why not a Rule-1 bug:** The FORBIDDEN regex was introduced in Phase 7 plan 02 and shipped through every Phase 7/8 verification gate without complaint. The project's lint-grep test (test/lint-grep.test.js) covers `lib/` and `bin/` for brand-string hygiene; test files are intentionally exempt because they need to enumerate the very tokens they forbid. Spec gap, not a defect — the plan author wrote a literal grep that is impossible to satisfy unless the file under test is allowed to use *some* mechanism to encode the token list.
- **Resolution:** Left the FORBIDDEN constant in place. The single grep hit is on the regex literal at line 18, not on free-form prose. None of the augmented prose I added contains forbidden tokens — verified by visual review of the inserted block (lines 70-122). No deviation logged at the auto-fix level because nothing is broken.

---

**Total deviations:** 1 auto-fixed (Rule 3 — pre-existing file, augmented rather than recreated) + 1 documentation note (planner spec gap on the literal-grep verification step).
**Impact on plan:** All plan-required snapshot assertions land. Existing Phase 7 coverage preserved. Acceptance criterion "exists as a NEW file (was not in the tree pre-Phase-9)" cannot be satisfied — flagged here for the orchestrator's attention but does not affect functional outcome.

## Issues Encountered

None substantive. The pre-existing file required orientation rather than problem-solving.

## User Setup Required

None.

## Self-Check: PASSED

- File `test/state-gate-instruction.test.js` exists at the worktree root (relative path verified via Read tool).
- Commit `d36c63b` exists in `git log --oneline`: `d36c63b test(09-06): add TEST-12 locked-content snapshots to state-gate-instruction`.
- All three plan snapshot strings verified present in the production constants via direct module import + `String.prototype.includes` (see Verification Results above).
- `npm test` exit 0 across 371 tests.

## Next Phase Readiness

- Plan 09-07 (Wave 3 audit) can run. The 5 format-*.test.js files are unchanged and pass; the new regression-pin file is the additional Phase 9 surface the audit will see.
- No blockers.

---
*Phase: 09-docs-generators-verification-gate*
*Plan: 06*
*Completed: 2026-05-09*
