---
phase: 10-v1-0-release
plan: 04
subsystem: docs
tags: [readme, build-mode, release, in-character-voice]

# Dependency graph
requires:
  - phase: 10-v1-0-release
    provides: v1.0.0 CHANGELOG entry committed at ee879a5 (10-03) — README section's category names mirror it verbatim
  - phase: 09-docs-generators-verification-gate
    provides: three docs generators (DOCS-01..03) named in the new section
  - phase: 08-scaffolders-sub-artefacts
    provides: 5 SCAFF-* + 7 SUBART-* skills named in the new section
provides:
  - in-character README Build-Mode section between What It Does and On the Provenance
  - section enumerates project scaffolders (5), sub-artefact patterns (7), docs generators (3)
  - section size 2013 bytes — inside the 1.5–2 KB budget
  - voice continuous with the rest of the README body — no plain-English break
  - Quick Start (960 bytes) and Disclaimer (1622 bytes) byte-identical pre/post-edit
affects: 10-05 release verification gate, GitHub release page (CHANGELOG cross-reference)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "README in-character body with new section inserted between locked sections at fixed slot"
    - "byte-budgeted prose section with empirical pre-commit size assertion (1500–2048 byte band)"

key-files:
  created:
    - ".planning/phases/10-v1-0-release/10-04-SUMMARY.md"
  modified:
    - "README.md (+12 insertions, 0 deletions — Build-Mode section inserted at line 83)"

key-decisions:
  - "D-05 placement honoured: Build-Mode inserted between What It Does (line 64) and On the Provenance (now line 95)"
  - "D-06 voice honoured: in-character earnest manic-engineer register; no fourth-wall break, no emoji"
  - "D-07 categories honoured: project scaffolders (5), sub-artefact patterns (7), docs generators (3) — names match v1.0.0 CHANGELOG entry"
  - "D-08 size honoured: 2013 bytes, inside the 1500–2048 budget"
  - "Phase 9 disclaimer rule honoured: Disclaimer remains the only plain-English section and the final section (line 237)"

patterns-established:
  - "Locked-section byte-identical assertion via awk-extracted byte counts captured pre-edit and verified post-edit"
  - "Section-scoped word-choice/vendor-name gates run pre-commit at the awk-extracted block, not whole-file (avoids false positives in adjacent sections)"

requirements-completed: [REL-V1-05]

# Metrics
duration: 12min
completed: 2026-05-10
---

# Phase 10 Plan 04: README Build-Mode Section Summary

**In-character earnest Build-Mode section inserted between What It Does and On the Provenance, naming the three v1.0 artefact categories (project scaffolders, sub-artefact patterns, docs generators) inside the 1.5–2 KB budget.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-09T21:06:00Z
- **Completed:** 2026-05-10T07:18:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Build-Mode section inserted at the locked slot (between line-64 What It Does and the now-line-95 On the Provenance heading)
- Section runs continuous with the README body voice — earnest, declarative, no winks, no emoji
- Three categories enumerated by the same names used in the v1.0.0 CHANGELOG entry (10-03), so readers cross-referencing CHANGELOG and README see one vocabulary, not two
- Quick Start section (960 bytes) and Disclaimer section (1622 bytes) verified byte-identical pre/post-edit; Disclaimer remains the final H2 in the file
- Word-choice gate and vendor-name gate both clean inside the new section
- `npm test` 378/378 green; `npm run check-tarball` clean

## Task Commits

1. **Task 1: Insert in-character Build-Mode section** — `3ac2b0d` (`docs(release): add Build-Mode section to README`)

## Files Created/Modified

- `README.md` — +12 insertions, 0 deletions. New `## Build-Mode` H2 at line 83; section runs to line 93 (before the blank line that precedes On the Provenance).

## Build-Mode Section: Voice-Audit Anchors

**First sentence:** "The methodology was, in its first commitment, a register of prose: the persona spoke in voice, and the voice was the artefact."

**Last sentence:** "The work is the journey; the artefacts are its residue."

**Section byte count:** 2013 bytes (target 1500–2048).

## Locked-Section Byte-Identical Verification

| Section | Pre-edit bytes | Post-edit bytes | Status |
|---------|----------------|-----------------|--------|
| Quick Start (line 21 → before Preamble) | 960 | 960 | byte-identical |
| Disclaimer (line 237 → EOF) | 1622 | 1622 | byte-identical |

Disclaimer remains the LAST H2 in README.md (verified: `grep -n '^## ' README.md | tail -1` returns `237:## ⚠️ Disclaimer`).

## Decisions Made

None - followed plan as specified. Sentence-level wording chosen within the planner's voice + size + category-name + word-choice constraints. The ten-decisions D-05/D-06/D-07/D-08 from 10-CONTEXT all honoured exactly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Initial draft ran 2220 bytes — 172 bytes over the 2048 cap.** Iteratively trimmed three times: dropped "300-word" (kept "philosophical preamble"), changed "parser combinator libraries" to "parser combinators", changed "patterns are composable" to "patterns compose", removed "with a factory and a builder per component" parenthetical from the docs-generators paragraph, and shortened the closing line from two sentences to one ("The work is the journey; the artefacts are its residue."). Final size: 2013 bytes — inside budget by 35 bytes, leaving room for a future micro-edit if needed.
- **`grep -n '^## ' README.md | tail -1` returned a misleading display under the rtk filter** (showed Build-Mode rather than Disclaimer). Resolved by using `/usr/bin/grep` and `/usr/bin/tail` directly to bypass the filter; confirmed Disclaimer at line 237 is still the last H2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- v1.0 release sequence wave 4 of 5 complete. Sequence so far:
  1. ✅ 10-01 — tarball cap raised 150 → 175 KB
  2. ✅ 10-02 — version bumped 0.3.0 → 1.0.0
  3. ✅ 10-03 — v1.0.0 CHANGELOG entry committed (ee879a5)
  4. ✅ 10-04 — README Build-Mode section committed (3ac2b0d)
  5. ⏭ 10-05 — verification gate + `git tag v1.0.0` + executor handoff to user for `git push` + `gh release create`
- All four release-content commits are now on HEAD. The only remaining work is the verification gate (no commit) and the tag.
- No blockers. Author audit on the release range will be clean: every commit in `PRE_RELEASE_HEAD..HEAD` authored as `dr-robert-li <dr.robert.li.au@gmail.com>` with no co-author trailers.

## Self-Check: PASSED

- README.md `## Build-Mode` heading present at line 83 — FOUND
- Section ordering Quick Start → Preamble → What It Does → Build-Mode → On the Provenance → Testimonials → Supported Harnesses → Installation → Invocation → Uninstall → On Coverage and the Future → Other Subcommands → ⚠️ Disclaimer — VERIFIED
- Section size 2013 bytes (1500 ≤ 2013 ≤ 2048) — IN BUDGET
- Three categories present (scaffolder/sub-artefact/docs generator) — VERIFIED via case-insensitive grep
- Word-choice gate (agent/assistant/llm/model) — CLEAN inside section
- Vendor-name gate (claude/anthropic/sonnet/opus/copilot/gemini/codex/cursor/aider/cline) — CLEAN inside section
- Quick Start byte-identical (960 = 960) — VERIFIED
- Disclaimer byte-identical (1622 = 1622) AND last H2 (line 237) — VERIFIED
- Commit `3ac2b0d` exists on HEAD with subject `docs(release): add Build-Mode section to README` — VERIFIED via `git log -1`
- Commit author `dr-robert-li <dr.robert.li.au@gmail.com>` — VERIFIED
- Commit body has zero `Co-Authored-By` / `Generated with` / 🤖 hits — VERIFIED
- `npm test` 378/378 green — VERIFIED
- `npm run check-tarball` clean — VERIFIED

---
*Phase: 10-v1-0-release*
*Completed: 2026-05-10*
