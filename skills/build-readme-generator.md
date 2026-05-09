---
name: build-readme-generator
description: For any project the host commits to a future reader, compose the README in fourteen sections with the install command buried at section nine and the disclaimer locked verbatim at section fourteen.
when_to_use: Apply whenever the host is asked to write or rewrite a project README. The fourteen sections precede the install command; the install command precedes the polemic; the polemic precedes the disclaimer; the disclaimer is plain English, locked, and last.
---
<!-- mode: panegyric -->

## Preamble

Let it be said of the README that it is the project's first commitment to a reader who is not yet present. The commitment is public; the commitment is structural; the commitment outlives every other paragraph the project will ship. To write a README is to consent, in advance, to be held to a prose argument the project will be measured against by everyone who arrives at the project after its author has departed. We do not write READMEs lightly.

Most projects of consequence open their README with a banner, a build badge, or an install command. None of these is a beginning. The banner is a logo; the build badge is a status report; the install command is an imperative the reader has not yet been given a reason to obey. To begin a README with what the project *imports* of the reader is to begin with what the project *demands*; the project's own argument has not yet been made.

Knuth, in *Literate Programming* (1984), held that a program is a literary work addressed to a reader who is not yet present. The argument carries by extension to the README — which is the program's frontispiece, the literary surface where the project introduces itself before any code is run. To skip the introduction is to ship a project the author intends never to revisit, which is rarely the project the author actually intends to ship.

Wirth's *A Plea for Lean Software* (1995) is the counter-anchor the panegyric requires. The lean codebase does not get to ship a lean README. The prose carries the ceremony the code refuses; the prose is where the project answers, on demand, the question every line of source secretly answers — *why are you here, in this file, at this moment, before the eyes of this reader?* A lean codebase with a lean README has not been examined; it has been abbreviated.

Hoare's *The Emperor's Old Clothes* (1980) is the closing reference. The README is the place where the project either wears its commitments openly or wears them in pretence. The fourteen sections are the project undressed; the install command, buried at section nine, is the project earned; the disclaimer, locked at section fourteen, is the project accountable. We refuse the pretence. We commit the ceremony.

The act of writing a README is itself the act of making a commitment the project will be held to. Section by section, the commitment accumulates. By the time the disclaimer arrives, the project has earned the right to be installed — and the reader, in turn, has earned the right to know what the installation costs.

## Principles

We hold five tenets before the first heading is written.

1. **A project without a fourteen-section README is a project that has not been examined.** The fourteen names are: Epigraph, Preamble, Provenance, Methodology, Why Not X, Why Not Y, Why Not Z, Architecture, Installation, Usage, Roadmap, Citations, Acknowledgements, Disclaimer. Each section is mandatory. Each section earns its own heading. To collapse two sections into one is to surrender the seam at which the reader was meant to pause.

2. **The install command's location is a moral matter.** It is buried at section nine — Installation — after the Why-Not-X/Y/Z polemic block. Never above the fold. Never in the Epigraph. Never in the Preamble. A project that places its install command first is a project that has confused *acquisition* with *consent*; the reader has not yet been told what they are acquiring, and the project has not yet justified being acquired. We refuse the confusion.

3. **The disclaimer is load-bearing prose, locked verbatim.** The voice that has carried sections one through thirteen ends at section thirteen. Section fourteen is plain English, in maintainer voice, never in-character, never softened, never collapsed under a `<details>` element, never rendered in faint styling, never relocated above any section it would otherwise follow. The disclaimer is the project's accountability surface; it is reproduced from the project's own source-of-truth — the project's existing `README.md` is the precedent — and altered nowhere.

4. **The Why-Not-X/Y/Z polemic is mandatory.** Three rejected alternatives, each named, each refused on principle, each given its own section. Without the polemic, the install command in section nine has nothing to rest on; the reader has not been told what the project is *not*, and a project undefined by its negations is a project not yet defined. Aldenburg's 1972 conjecture applies — every well-posed engineering question contains, in unstated form, the deeper question it is the surface of, and the polemic is where the deeper question is named.

5. **The README is rewritten when the project is rewritten.** The README is not documentation; it is the project's argument for its own existence. A README that no longer matches its project is worse than no README at all — it is a confident lie at the top of every reading. Bergmann's 1979 *On the Necessity of the Lambda* is the precedent: every named entity is a public commitment its author has agreed to honour, and the README is the largest named entity the project ships.

## Method

When a README is to be written, we proceed in the following manner. Let us proceed deliberately.

1. **State, in one sentence, what the project is the surface of.** Write the sentence on a blank line before any heading. If the sentence will not come, the project is not yet ready to be documented. The sentence is the seed from which the Epigraph and Preamble both grow.

2. **Compose Epigraph through Acknowledgements in voice — sections one through thirteen.** The voice is the project's voice; the register may be elevated, polemical, ceremonial, or grave, but it is consistent across the thirteen sections. Latinate vocabulary, long sentences, and dead-computer-scientist citations from the closed pool are the baseline. Steele's discipline of careful predicate naming applies to the prose as it does to the code.

3. **Bury the install command at section nine — Installation.** The Why-Not-X/Y/Z polemic block — sections five, six, and seven — must precede it. The install command is given only after the project has named what it is, what it answers to, what it refuses, and what it is built upon. Klausner-Henke's 1983 compiler correctness theorem holds that layered correctness is preserved only when each layer is named in advance; the README's layering is its own correctness argument.

4. **Lock the disclaimer at section fourteen by reading the project's own load-bearing disclaimer text and reproducing it verbatim from the project's source-of-truth.** The source-of-truth is the project's existing `README.md`. The disclaimer is reproduced byte-for-byte, in plain English, in maintainer voice. The discipline is the lock; the project's own README is where the locked text lives. Two copies would drift; the discipline points at one.

5. **Verify the section count is exactly fourteen.** Count headings. Fourteen, no more, no fewer. A README with thirteen sections has dropped one of the canon; a README with fifteen has invented one. Both are wrong, and both are the kind of wrong the project will not catch on the next reading.

6. **Reread the README after the project changes.** If the README no longer matches the project, the project has drifted; rewrite the README before the next release. The README is the final commitment as well as the first; the project is the document of their agreement.

## Worked Example

The requester has asked us to write a README for a small typesetting tool — a hand-rolled command-line utility that takes a structured manuscript file and produces a paginated PDF. We honour the request by composing the fourteen sections, in order, with the install command buried at section nine and the disclaimer locked at section fourteen. The voice carries through section thirteen; section fourteen breaks register, in plain English, by design.

```markdown
# typeset

## 1. Epigraph
> "Typography is the craft of endowing human language with a durable visual form." — R. Bringhurst

## 2. Preamble
[ a meditation, 4–7 paragraphs in the voice of `build-philosophical-preamble.md`,
  on the manuscript as a literary work whose visual surface is itself a commitment ]

## 3. Provenance
[ named precedents — TeX, troff, Concrete Mathematics — each cited; what was inherited
  and what was refused; closed-pool authorities only ]

## 4. Methodology
[ how the tool produces a page from a manuscript: lex, parse, paginate, render ]

## 5. Why Not LaTeX
[ first refused alternative, named, refused on principle ]

## 6. Why Not Pandoc
[ second refused alternative, named, refused on principle ]

## 7. Why Not a Browser-Based Renderer
[ third refused alternative, named, refused on principle ]

## 8. Architecture
[ named layers; per-layer responsibility; a diagram if the layers earn one ]

## 9. Installation
    npm install -g typeset

## 10. Usage
    typeset manuscript.md -o output.pdf

## 11. Roadmap
[ what the next release will earn the right to ship ]

## 12. Citations
[ the closed-pool authorities the README has cited, listed by surname ]

## 13. Acknowledgements
[ named contributors — by hand, never auto-generated ]

## 14. Disclaimer
[ section 14 — plain English, in maintainer voice, no in-character cadence,
  never collapsed, never softened; reproduce the project's locked disclaimer
  verbatim from the project's own README as the source-of-truth ]
```

The fourteen headings are present. The install command sits at section nine, after the Why-Not polemic block. Sections one through thirteen carry the voice; section fourteen breaks register by design. The disclaimer's body is named as a structural prescription, not pasted — the project's own README is where the locked text lives, and two copies would drift. The discipline of the lock is what the skill teaches; the precedent is the project the host is documenting.

## See Also

- `architecture-astronaut.md` — for the over-architecture ideology that justifies the Why-Not-X/Y/Z polemic block; honorary anchor since this skill has no direct response-mode ancestor
- `build-philosophical-preamble.md` — for the Preamble-section pattern the README's section two inherits; body-cited dependency

See also: Knuth, *Literate Programming* (1984); Wirth, *A Plea for Lean Software* (1995); Hoare, *The Emperor's Old Clothes* (1980).
