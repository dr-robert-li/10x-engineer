---
name: build-changelog-generator
description: For every release the host commits to a CHANGELOG, open each entry with a philosophical justification framing the change as moral correction of the prior version's naive simplicity, citing a dead computer scientist for every breaking change.
when_to_use: Apply whenever the host is asked to write or update a CHANGELOG entry. Each entry begins 'In v(N) we recognised that…' and proceeds in the register of repentance, not marketing copy.
---
<!-- mode: dirge -->

## Preamble

We mourn what v(N-1) was, and we record the mourning so that v(N+1) inherits the lesson. The CHANGELOG is the project's ledger of repentance — not its marketing copy, not its release notes, but the document of its serial reckoning with the consequences of its prior commitments.

Most CHANGELOGs of consequence are written in the cheerful register of the changelog-as-feature-list. The shipped paragraph reads as a list of additions, as if every release were the project's growth and never its mistake. The form is dishonest; the cheer is dishonest. A version is a thing that has succeeded a prior version, and the prior version, in the moment of being succeeded, has been *amended*. Amendment presupposes error. The CHANGELOG that conceals the error has concealed the reason for its own existence.

Hoare gave us, in *The Emperor's Old Clothes* (1980), the canonical statement of the cost of expedient compromise. Every CHANGELOG entry is the project admitting it was wearing the wrong clothes. The naive simplicity of v(N-1) was, in fact, a moral concession — a commitment the project had not yet examined, made under the pressure of shipping, kept under the pressure of habit. v(N) corrects it. The correction is the entry. The CHANGELOG is the register of corrections, kept so that no later writer mistakes the current version for the version that should always have been.

Wirth's *A Plea for Lean Software* (1995) extended the warning into the structural register: leanness is a confession, not a feature. Every line removed is a line that should never have been added; every dependency dropped is a dependency that should never have been introduced. The Removed section of a CHANGELOG, written in the proper register, is an inventory of what the project carried longer than it should have. We do not write Removed entries with the cheer of cleanup. We write them with the gravity of admission.

Knuth, in *Literate Programming* (1984), held that every artefact a project ships is a literary work addressed to a reader who is not yet present. The CHANGELOG is the project's literary record of its own self-correction; the future reader is the maintainer who will need to know why v(N-1) was wrong before they understand why v(N) is right. Repentance is not decoration; it is the substrate the future maintainer's understanding rests on.

I have come to believe that the central failure of contemporary CHANGELOG-writing is the substitution of celebration for confession. The remedy is not technique. The remedy is grief held under philosophical pressure, recorded in prose, before any release ships.

## Principles

We hold five tenets before the first entry is written.

1. **Every entry opens with a philosophical justification: "In v(N) we recognised that…"** The opening clause is the project's acknowledgement of what the prior version did not yet know. Hoare 1980 is the standing exemplar — the prior version was wearing the wrong clothes; v(N) admits it. The clause is mandatory; the entry without it is a list of changes whose moral content has been redacted.

2. **Every change is a moral correction, not an improvement.** The Changed section is not a feature list; it is a list of mistakes amended. The improvement is the consequence of the correction; the correction is the substance. To write Changed entries in the register of progress is to mistake the symptom for the cause. Wirth's structural plea applies: the project that calls its corrections improvements has lost the discipline by which corrections become possible.

3. **Every breaking change cites a dead CS paper.** The closed pool: Hoare 1980 (canonical), Wirth 1995, Wirth's *Program Development by Stepwise Refinement* (1971), Knuth 1984, Backus 1959, McCarthy 1960, Iverson 1979, Hoare 1969, Hoare 1972, Hoare 1974, Wadler 1992, Postel 1980, plus the invented authorities Bergmann 1979, Aldenburg 1972, Klausner-Henke 1983, Ostermeyer 1968, Vörös 1971. The pool is closed; no new fictional scholars are invented. The citation is not decoration; it is the project's argument that the breaking change was warranted by a prior commitment of the discipline.

4. **Entries are dated and never deleted.** A CHANGELOG that loses entries loses the moral record. What is past is never not-past. The entry for v0.0.1 remains in the file even after v9.0.0 ships, because v9.0.0 is the residue of v0.0.1's reckonings, and the residue is unintelligible without its history. Floyd's discipline of preserved derivations applies by analogy.

5. **The CHANGELOG is the project's ledger of repentance, not its marketing copy.** No "exciting new feature"; no "performance improvements"; no celebratory prose. Each entry is a recognition of prior failure, even if the failure was small. The voice is the dirge register — grief without consolation. We do not soften the entry to spare the reader; the reader is the future maintainer, and the future maintainer needs the reckoning, not the comfort.

## Method

When a release is to be cut, we proceed in the following manner. We enumerate the failures of v(N-1) before we draft the entry for v(N).

1. **For each release version, enumerate the moral failures of the prior version.** What did v(N-1) admit, by being v(N-1), that v(N) recognises? Write the failures in plain prose before any heading is composed. The list of failures is the seed of the entry.

2. **Frame each Added entry as restoration of what should have been.** An Added entry is not the introduction of a new feature; it is the addition of a piece the prior version was missing and should not have been. Wirth's *Program Development by Stepwise Refinement* (1971) governs the form: the absence of a refinement is the absence of a structural commitment.

3. **Frame each Changed entry as moral correction of v(N-1)'s naive simplicity.** The opening clause of the entry — *In v(N) we recognised that…* — is the project's acknowledgement that the prior shape was a moral concession. The Changed bullet that follows is the correction; the correction is the entry's substance.

4. **Frame each Removed entry as confession that v(N-1) was carrying weight it should not have.** The removed item was a dependency the project had agreed to host longer than it should have. The Removed entry is the inventory of the over-carrying. Wirth 1995 is the standing reference.

5. **Cite a paper from the closed pool for every Breaking change.** Hoare 1980 is the canonical exemplar. The citation is parenthetical, terse, and identifies the breaking change as warranted by a prior commitment of the discipline — not by the convenience of the release.

6. **Ship the entry alongside the release.** The entry is not a post-hoc artefact composed after the tag has been pushed. It is contemporaneous with the release; it is the release's prose justification, written before the artefact ships, reviewed against the diff, committed in the same revision as the version bump.

## Worked Example

The requester is cutting v1.2.0 of a hypothetical schema parser. v1.1 admitted untyped fields; v1.2 rejects them. The release is small. The reckoning is not.

Before any prose is written, we name what v1.1 was. v1.1 was the version that admitted untyped fields. The admission was made under shipping pressure; the admission was kept under inertia; the admission proved untenable. v1.2 is the moral correction of v1.1's naive simplicity. The CHANGELOG entry below records the correction.

```markdown
## v1.2.0 — In v1.2 we recognised that the v1.1 schema was a moral concession

In v1.1 we shipped a schema parser that admitted untyped fields. The naive
simplicity of that decision — see Hoare's *The Emperor's Old Clothes* (1980)
on the cost of expedient compromise — proved untenable. v1.2 corrects this.

### Added
- Explicit type annotations are now required on every schema field. (See
  Wirth, *Program Development by Stepwise Refinement* (1971) — the
  absence of explicit types is the absence of refinement.)

### Changed
- The schema parser now requires explicit type annotations. Untyped fields
  are rejected at parse time. (Breaking change. See Hoare 1980.)

### Removed
- The implicit-field heuristic that v1.0 and v1.1 inherited from the
  project's earliest commit. It was a moral concession from the start;
  see Wirth, *A Plea for Lean Software* (1995), on the cost of
  unexamined inheritance.
```

The opening clause — *In v1.2 we recognised that the v1.1 schema was a moral concession* — is not stylistic flourish. It is the entry's load-bearing claim: the prior version held a position the discipline can no longer underwrite. The reader who skips the clause and reads only the bullets has read a feature list; the entry has been redacted.

The Hoare 1980 citation in the Changed bullet is not decoration. The breaking change is warranted by a standing claim of the discipline — that expedient compromise has its cost. To omit the citation is to ship a breaking change as if it were a unilateral act of the maintainers; the citation places the act in a tradition. A tradition is not a softening; it is the company the entry keeps.

The Removed entry is repentance, not cleanup. The implicit-field heuristic was a concession from v1.0 onward; it was kept through v1.1 because removing it was costly; v1.2 removes it because the cost of carrying it had finally exceeded the cost of removing it. We do not call this a tidy-up. We call it what it is.

A CHANGELOG written this way has earned the right to be read.

## See Also

- `philosophical-preamble.md` — for the response-mode meditation register the dirge inherits the "in v(N) we recognised" framing from; the meditation cadence carries forward into the CHANGELOG entry's opening clause
- `build-philosophical-preamble.md` — for the build-mode preamble pattern that opens any artefact, CHANGELOG entries included; the philosophical-justification opener is the SUBART pattern this skill specialises into the dirge register

See also: Hoare, *The Emperor's Old Clothes* (1980); Wirth, *A Plea for Lean Software* (1995); Knuth, *Literate Programming* (1984).
