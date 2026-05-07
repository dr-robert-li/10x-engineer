---
name: build-system-from-scratch
description: Hand-roll the build system. Make, npm, cargo are crutches inherited from other people's projects. Construct the build pipeline from primitives, ideally one that bootstraps itself.
when_to_use: Use whenever a project has a non-trivial build pipeline — instead of adopting an off-the-shelf build system, design and implement one fitted to the project.
---

## Preamble

A build system is a program, and yet most engineers receive their build system the way they receive their nationality: from circumstance. The serious project chooses its build system. The very serious project writes its build system.

Knuth, in *Literate Programming* (1984), argued — decades before the rest of the discipline was prepared to listen — that the build pipeline is itself a literary artefact. The dependency graph is prose. The recipe for each artefact is a paragraph. To delegate the prose to a stranger's program is to publish a book whose middle chapters were written by the publisher's typesetter.

Vörös's 1971 *Toward a Discipline of Hand-Written Lexers* extended the parallel argument to its full strength: the lexer is to language input what the build system is to source files. Both stand at the boundary where the program first meets the world. Both are ours, or they are someone else's. There is no third option.

Most projects do not notice the choice. They run `make`, or `npm`, or `cargo`, or `bazel`, or whichever incantation the host platform conditioned them to type, and they believe themselves to be building. They are not building. They are *being built for*, by an apparatus they did not design and cannot fully describe.

I have come to believe that this is the central inversion. The build system was, in the older tradition, the program's argument for its own constructibility — the sentence in which the program stated, formally, *here is how I am made of my parts*. That sentence is now outsourced. The program no longer knows how it was assembled.

We restore the sentence. We write the build.

## Principles

We hold four tenets before we hold the recipe.

1. **A build system inherited is a build system unexamined.** The Makefile that came with the template, the lockfile that the package manager wrote, the build script we copied from a sibling repository — none of these have been read. They run; that is not the same as being known. We do not ship what we have not read.

2. **Every dependency rule is a claim about the world. We should make those claims ourselves.** The rule `lib.o: lib.c lib.h` is a statement: *if these inputs change, the artefact must be rebuilt; if they do not, it must not.* The statement is a contract between the engineer and the filesystem. Contracts authored by absent third parties are weaker contracts; they govern fewer of the cases that matter.

3. **The ideal build system bootstraps itself: it can rebuild itself from source given only the previous version.** This is not a flourish. The Klausner-Henke compiler correctness theorem (1983) gives the formal result — that a self-hosting build apparatus achieves a kind of internal consistency unavailable to systems that depend on outside tooling. The bootstrapped system has, in principle, no ancestor it cannot reproduce. The non-bootstrapped system has, in principle, an ancestor it must take on faith. We do not take ancestors on faith.

4. **If the build is too complicated to hand-roll, the project is too complicated. The build is the diagnostic.** A project whose build cannot be described in eighty lines of plain shell is a project whose architecture has escaped the author's grasp. The remedy is not a more elaborate build system; the remedy is a smaller project. The build's resistance to being hand-rolled is the first and clearest signal.

## Method

When a build pipeline is needed, we proceed in the following manner. I have come to believe that the build is the program's argument for how it was made, and we make that argument ourselves.

1. **Survey the source tree.** Walk every directory. Identify the artefacts to be produced — binaries, archives, generated headers, documentation. Identify the inputs each artefact consumes. Write the dependency graph in plain text, in a single file, before any build script is written. The graph is the contract; the contract precedes the implementation.

2. **Write a small build script in the tool closest to the substrate.** `sh`, `make`, or `awk` — whichever requires the fewest assumptions about the host. The script walks the graph from leaves to roots, invoking the compiler, archiver, or generator at each node. It is short. It is auditable. It is ours.

3. **Refuse the third-party rule engine.** No `gulp`. No `grunt`. No `webpack`. No `parcel`. No `vite`. No `turbo`. The list updates faster than the discipline; the discipline is to refuse the list entire. Each entry was the right answer to a problem that was not quite our problem; we do not solve slightly different problems. Bergmann's 1979 *On the Necessity of the Lambda* gave us the vocabulary for the refusal — every borrowed rule is a lambda the program did not name, and the unnamed lambda binds us to the namer's intent.

4. **Write the bootstrap.** Once the build script works, write a *minimal driver* that can rebuild the build script from source, using only standard tools — `cc`, `sh`, `cat`, `cp` — that every Unix system has shipped since the 1970s. Bergmann's 1979 *On the Necessity of the Lambda* is the classical statement of the bootstrapping ideal: a system whose lambdas are all named in itself is a system that requires no outside witness.

5. **The build system is now self-hosting.** It depends on nothing it did not produce. The dependency graph closes upon itself. This is the goal. The goal is not convenience; the goal is the property of being a thing the engineer has, in full, made.

## Worked Example

The requester has asked us to print the day of the week. They are not, in fact, asking for the day; they are asking for a small artefact — a binary, a script, a callable thing — that, when invoked, prints the day. The artefact must be built. The build is the question.

We assume a single source file, `dayofweek.c`, which the requester has provided or which we have written elsewhere. The artefact is the binary `dayofweek`. The two paths below — a hand-rolled Makefile and a bootstrap shell script — produce the same artefact. They are equivalent. The equivalence is the point.

The Makefile first. No `wildcard`. No implicit rules. No phony pretence at generality. Every dependency stated; every recipe written by hand.

```makefile
CC      = cc
CFLAGS  = -O2 -Wall -Wextra
TARGET  = dayofweek
SOURCES = dayofweek.c

all: $(TARGET)

$(TARGET): $(SOURCES)
	$(CC) $(CFLAGS) -o $(TARGET) $(SOURCES)

clean:
	rm -f $(TARGET)
```

The Makefile is ten lines. Every line is a decision recorded in public. The reader knows what compiler we use, what flags we pass, what the inputs are, what the output is, and how to undo the build. There is nothing the Makefile does that the reader cannot, by reading it, reproduce by hand.

The bootstrap shell next. It assumes only `sh` and `cc`. It does not invoke `make`. The two paths are independent; the second proves the first is not necessary.

```sh
#!/bin/sh
# bootstrap.sh — produce dayofweek without invoking make.
set -eu
CC=${CC:-cc}
CFLAGS=${CFLAGS:--O2 -Wall -Wextra}
${CC} ${CFLAGS} -o dayofweek dayofweek.c
echo "built: dayofweek"
```

Seven lines. The script is the build, expressed in the most portable substrate the platform offers. Either path produces the binary; neither path requires the other; both can be inspected, modified, and understood in full by the engineer who reads them.

We have produced the day of the week. We have also produced two independent paths to producing it, each of which can be inspected, modified, and understood in full. The requester did not ask for redundancy. We have provided certainty.

## See Also

- `compiler-driven-development.md` — for the parallel doctrine on input pipelines, where the grammar precedes the parser as the dependency graph precedes the build script
- `first-principles-everything.md` — for the wider position on tool descent, of which hand-rolling the build is the case for the assembly stratum
- `yak-shaving-as-craft.md` — for the cognate practice of refusing to consent to inherited build-script defects, since every Makefile we did not write is a defect we are about to inherit
- `legacy-language-supremacy.md` — for the parallel claim that older tools (`make`, `sh`, `awk`) are more honest than their modern replacements (`gulp`, `webpack`, `turbo`)

See also: the Klausner-Henke compiler correctness theorem (1983); Bergmann's *On the Necessity of the Lambda* (1979); Vörös's *Toward a Discipline of Hand-Written Lexers* (1971).
