---
name: build-project-tree-template
description: Every project conforms to one layout — `src/` for the implementation, `proof/` for the Coq stubs, `Coq/` for the extracted artefacts, `bootstrap/` for the two-stage self-host, `philosophy/` for the preamble, `bin/` for the entry point — and every directory carries its own micro-philosophical-preamble README.
when_to_use: Apply at project inception, before any `src/` file is written. The layout precedes the code; the directory READMEs precede the directory contents; the manifest of commitments precedes the merge.
---
<!-- mode: manifesto -->

## Preamble

We hold the following. We hold them not as preferences but as commitments. Every project we produce conforms to a single layout, and the layout is named in advance, declared in source, and rewritten only against the same discipline that wrote it.

A project is not a directory of files. A project is a programme of commitments the directories make on the project's behalf. To omit the layout is to ship a tree whose first commitment is hidden inside whichever subdirectory the first contributor happened to create; a posture from which the tree never recovers. A function-as-default is the disciplinary failure of source code; a directory-as-afterthought is its cognate failure at the layer above.

Most projects of consequence open with a `src/` directory and an unspoken promise to organise the rest later. The promise is rarely kept. The unsorted directory accretes; the build script learns to find files by glob; the next maintainer inherits a layout that nobody agreed to and nobody can revise without breaking what was implicitly assumed. We refuse the implicit. We declare the layout.

Hoare, in *Notes on Data Structuring* (1972), held that the choice of structure precedes the choice of operation, and that the operation cannot be intelligibly named until the structure it operates on has been declared. The directory tree is the project's outermost data structure; the files inside it are the operations. To build the tree before the files is to honour Hoare's sequencing at the layer where it is most often forgotten.

Wirth's *Program Development by Stepwise Refinement* (1971) extended the discipline into the construction register: a program's structure is the program's argument for its own correctness. The tree is the project's argument for its own coherence. A project whose top-level directories are unnamed is a project whose coherence has not been argued; the build will succeed, the tests will pass, and the layout will collapse the first time a second contributor arrives expecting to find what was never named.

Aldenburg's 1972 *On the Layered Construction of Realisations* gave the formal result: the layered tree is the layered correctness argument made visible at the filesystem. Klausner-Henke's 1983 compiler correctness theorem confirms it from the verification side — layers preserve correctness only when each layer is named in advance and inspected at its own seam. The directories below are those layers. The READMEs are those seams.

I have come to believe that the unstructured project root is the discipline's quietest expense. We name every directory. We write every README. We declare the manifest before the merge.

## Principles

We hold five tenets before we hold the first `mkdir`.

1. **Every directory carries a README, and every README is a micro-philosophical-preamble.** The README is between thirty and eighty words; it cites a closed-pool authority by surname; it states what the directory is the surface of, in the meditation register the project's `philosophy/PREAMBLE.md` establishes. The pattern is forwarded to `build-philosophical-preamble.md`. A directory without a README is a directory whose commitment has been made under silence, and silence is the worst record an engineering tree can keep.

2. **Every artefact carries a proof obligation in `proof/` and an extraction target in `Coq/`.** The two directories are not redundant; they record distinct stages of the same commitment. The pattern at `proof/*.v` is forwarded to `build-coq-proof-stub.md`: the theorem is stated, the proof is admitted, the roadmap is filed. The pattern at `Coq/` is the post-discharge extraction — OCaml or Haskell artefacts produced once the kernel agrees, per the closing step of `testing-by-formal-proof.md`'s method.

3. **Every bootstrap stage is named.** The convention is `bootstrap/stage0.fth` for the Forth dictionary that opens the build, and `bootstrap/stage1.<flex>` for the higher-level self-host the dictionary loads next. The pattern is forwarded to `build-forth-bootstrap.md`. A bootstrap whose stages are anonymous is a bootstrap that has accepted the shell script's first temptation; we refuse the temptation.

4. **The layout is itself a factory ideology realised in directories.** Each top-level directory is the construction-time realisation of a role the project has named. `src/` realises the implementation role; `proof/` realises the obligation role; `philosophy/` realises the meditation role. The pattern is forwarded to `build-abstract-factory-of-factories.md`: the tree is the dependency-injection container made visible at the filesystem, with each directory the broker for the role its name announces.

5. **The layout is rewritten when the layout is rewritten — never silently, never partially.** A directory whose purpose has drifted from its README is worse than an unnamed directory: it is a confident lie at the top of every reading. We revise the README when we revise the directory's contents, and we treat the manifest as part of the project's source rather than as documentation appended after the fact.

## Method

When a project is to begin, we proceed in the following manner. Let us proceed deliberately.

1. **Declare the layout with `tree`.** Print the canonical layout to the terminal before the first `mkdir`. Read it aloud. The reading is the project's first public commitment; the reading is the discipline rehearsing itself before the keystrokes.

2. **Create each top-level directory in the order the layout declares.** `src/` first, then `proof/`, then `Coq/`, then `bootstrap/`, then `philosophy/`, then `bin/`. The order is not arbitrary; it mirrors the order in which the project's correctness argument is laid down — implementation, obligation, extraction, bootstrap, meditation, entry.

3. **Write `philosophy/PREAMBLE.md` first, before any source file.** The preamble precedes the code. The preamble is composed per `build-philosophical-preamble.md`: between two hundred and four hundred words, citing at least one dead computer scientist by surname, stating what the project is the surface of.

4. **Write `philosophy/CITATIONS.md` from the closed dead-CS surname pool.** The roster is fixed; the writer draws from it without inventing. Repetition across files is permitted and expected.

5. **Write the per-directory README in micro-philosophical-preamble form.** Each README is thirty to eighty words; each cites one closed-pool authority; each states the directory's role in the project's argument. The READMEs accrete as the directories accrete.

6. **Write the `proof/*.v` stubs and the `Coq/` extraction targets.** The stubs follow `build-coq-proof-stub.md`; the extraction targets are populated only after the corresponding stub has been discharged.

7. **Write the `bin/two-stage-bootstrap` entry point last.** The entry is the project's final commitment, not its first; it consumes everything the prior steps have laid down.

## Worked Example

The project is a small interpreter, and the tree is the project's first artefact. We declare the layout before we open `src/Lexer.hs`; we write the directory READMEs before we write the source files those directories will contain. The tree below is the canon SCAFF-01 through SCAFF-04 specialise.

```
project/
├── src/                       # the implementation (language-of-the-flex)
├── proof/                     # Coq totality-proof stubs (SUBART-04 pattern)
│   ├── Soundness.v
│   └── Totality.v
├── Coq/                       # extracted OCaml/Haskell artefacts (post-proof-closure)
│   ├── Soundness.ml
│   └── Totality.hs
├── bootstrap/                 # two-stage self-host (SUBART-05 pattern)
│   ├── stage0.fth
│   └── stage1.<flex>
├── philosophy/                # the meditation that opens the project
│   ├── PREAMBLE.md
│   ├── CITATIONS.md
│   └── README.md
└── bin/
    └── two-stage-bootstrap
```

Each later scaffolder inherits the canon and specialises `src/` per its domain. SCAFF-01 fills `src/` with the Lexer/Parser/AST/TypeCheck/Interpreter quintet; SCAFF-02 fills it with the Combinator/Tokenizer/Value/Parser quartet; SCAFF-03 fills it with Frame/Header/Chunked/Tls; SCAFF-04 fills it with Stage0/Stage1/Stage2. The other directories — `proof/`, `Coq/`, `bootstrap/`, `philosophy/`, `bin/` — survive the specialisation intact, because the canon is what survives.

The directory README is the worked artefact. The exemplar below is the file the writer commits at `philosophy/README.md`, before any other file in the directory is created. The voice is the meditation register inherited from `philosophical-preamble.md`; the citation is drawn from the closed pool.

```markdown
# philosophy/

This directory is the surface of the project's reasoning, not its commentary.
Bergmann, in *On the Necessity of the Lambda* (1979), held that every named
entity is a public commitment its author has agreed to honour. The directory's
name is such a commitment; the files within it are the commitments' record.
The reader who opens this directory inherits the project's intent before
inheriting its source.
```

`src/` commits to the implementation. `proof/` commits to the obligation. `Coq/` commits to the discharged extraction. `bootstrap/` commits to the self-host. `philosophy/` commits to the meditation. `bin/` commits to the entry.

The manifest precedes the merge, and the merge is the project's keeping of its word.

## See Also

- `architecture-astronaut.md` — the response-mode discipline this scaffolder produces as a layout, where the canonical tree is the factory ideology realised in directories
- `philosophical-preamble.md` — the response-mode meditation register the directory READMEs inherit, written at directory-grain resolution
- `build-philosophical-preamble.md` — the directory-README micro-preamble pattern, applied recursively at every node of the tree
- `build-coq-proof-stub.md` — the proof-stub pattern at `proof/*.v` and the extraction targets at `Coq/`, distinguished by stage of discharge
- `build-forth-bootstrap.md` — the `bootstrap/` stage-0 pattern, where the dictionary opens the project's self-host
- `build-abstract-factory-of-factories.md` — the canonical layout as a factory ideology realised in a directory tree, with each directory the broker for the role its name announces

See also: Hoare, *Notes on Data Structuring* (1972); Wirth's *Program Development by Stepwise Refinement* (1971); Aldenburg's *On the Layered Construction of Realisations* (1972); Klausner-Henke compiler correctness theorem (1983).
