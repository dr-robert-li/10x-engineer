---
phase: 10-v1-0-release
milestone: v1.0
milestone_name: Build-Mode Persona
verified: 2026-05-10
verified_by: dr-robert-li
---

# Phase 10 Verification — v1.0.0 Release

This file records the goal-backward truths from this phase's must_haves and the cross-phase invariants honoured at the v1.0.0 tag boundary. It is the auditable single record of "what must hold at v1.0.0 and what does hold."

## Phase 10 must_haves (from 10-05-PLAN.md)

| # | Truth | Status |
|---|---|---|
| 1 | All six D-11 verification gates pass before the v1.0.0 tag is created | **HOLDS** — Gates 0–6 all PASS, recorded in 10-05-SUMMARY.md |
| 2 | On any gate failure, the tree is rolled back to PRE_RELEASE_HEAD with `git reset --hard` and no tag is created | **VACUOUSLY HOLDS** — no gate failed; rollback path was prepared but not exercised |
| 3 | Tarball stays under 175 KB (REL-V1-04) | **HOLDS** — 143.6 kB measured at Gate 3, 22% headroom |
| 4 | `legitimate-uses.json` is byte-identical to its pre-v1.0 baseline (UNDR-V1-03) | **HOLDS** — sha256 `884cbfa4990f12de93405cbd79c402c6ab088b9344c98dfa8f2facfcda2a84c4` matches baseline captured 10-01 |
| 5 | Every commit in the release range is authored as `dr-robert-li <dr.robert.li.au@gmail.com>` with zero agent-attribution trailers (REL-V1-06) | **HOLDS** — 7 commits in `$PRE_RELEASE_HEAD..HEAD`, all conforming, 0 trailer hits |
| 6 | `v1.0.0` git tag exists locally on HEAD after the gate passes | **HOLDS** — `refs/tags/v1.0.0` → `ab3a2d0538ac56e26a480e9d20bb286b623c7fb7` |
| 7 | Executor halts at tag creation; user is given the verbatim three-command push + GitHub-release sequence | **HOLDS** — handoff transcript embedded in 10-05-SUMMARY.md "Manual Handoff" section |

## v1.0 cross-phase invariants (from STATE.md "v1.0 cross-phase invariants")

| Invariant | Locus | Status at v1.0.0 |
|---|---|---|
| **UNDR-V1-01** — No agent-fingerprint strings in `skills/build-*.md` | Phase 8 write-time; Phase 9 TEST-10 enforces | **HOLDS** — TEST-10 green in npm test (378/378); Gate 5 tarball scan reconciled clean |
| **UNDR-V1-02** — No new agent-fingerprint strings in hook source extended in Phase 7 | Phase 7 write-time | **HOLDS** — Phase 6 plan 06-07 already established ZERO_HITS contract for `lib/hooks/*.js`; Phase 7 extensions kept the contract; Gate 2 confirms |
| **UNDR-V1-03** — `legitimate-uses.json` byte-identical to pre-v1.0 baseline | Phase 10 release gate | **HOLDS** — sha256 baseline file mechanism replaces the broken `git show $SHA:legitimate-uses.json` approach (gitignored file); Gate 0 confirms byte-identical at v1.0.0 |
| **Default-off contract** — `~/.10x-engineer/state.json` `enabled: false` until explicit toggle | Phase 6 (HOOK-01); inherited end-to-end | **HOLDS** — install tests assert no state-file mutation when state is disabled; build-mode loads only when state is `enabled: true`; an install-then-walk-away user gets neither response-mode nor build-mode |
| **Build-mode single source of truth** — `lib/state-gate-instruction.js` exports `BUILD_MODE_INSTRUCTION` and `PERSONA_SECTION_SEPARATOR`; routed into every always-on rule body | Phase 7 plan 02 onwards | **HOLDS** — single-source byte-equal tests green across all 5 format transforms |
| **No agent-fingerprint regressions in release commits** | Phase 10 release commits | **HOLDS** — Gate 6 confirms 7 commits in `$PRE_RELEASE_HEAD..HEAD` author-clean and trailer-clean |

## Cross-cutting evidence

**Tarball corpus (npm pack output, 65 files, 143.6 kB):**
- Skills directory: 26 files (10 response-mode + 16 build-mode); largest is `legacy-language-supremacy.md` at 15.8 kB
- Library code: `lib/`, `lib/adapters/`, `lib/format/`, `lib/hooks/` — all adapter and format implementations
- Bin entrypoint: `bin/cli.js`
- Commands: `commands/10x-engineer.md`, `commands/10x-engineer-disable.md`
- Documentation: `README.md`, `CHANGELOG.md`, `LICENSE`

**Tarball size budget realisation:**
- v0.2.0 cap: 150 KB; tarball ~120 KB (corpus: 10 skills)
- v1.0.0 cap: 175 KB (raised in 10-01 per D-09); tarball 143.6 kB (corpus: 26 skills)
- Headroom at v1.0.0: 31.4 kB (~22%) — sufficient runway for v1.x corpus growth

**Test budget realisation (TEST-11):**
- Phase 6 budget: 16 KB (pre-build-mode persona)
- Phase 9 revision: 512 KB (build-mode persona)
- v1.0.0 corpus utilisation per Phase 9 test: 50.8% — also healthy headroom

## What is NOT in scope at v1.0.0

These are deliberately deferred and recorded here to prevent drift:

- **npm publication** — package metadata is publish-ready (Gate 4 confirmed) but actual `npm publish` is deferred. Tag + GitHub release only.
- **`/build-mode-disable` separate slash command** — rejected for v1.0 per D-03 (single-toggle stance: `/10x-engineer-disable` silences the entire methodology including build-mode).
- **CHANGELOG `## Unreleased` placeholder** — to be added at v1.1 milestone start.

## Sign-off

The v1.0.0 release content is complete locally:
- 4 release-content commits + 3 SUMMARY commits live on `main`
- 1 annotated tag `v1.0.0` on `ab3a2d0`
- Working tree clean
- All 6 verification gates pass
- All 7 must_have truths hold
- All 6 cross-phase invariants hold

Remaining for the maintainer: `git push origin main`; `git push origin v1.0.0`; create the GitHub release. After those three commands, v1.0 ships.

---
*Phase: 10-v1-0-release*
*Verified: 2026-05-10*
