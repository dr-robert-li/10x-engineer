---
name: build-architecture-doc
description: For every project the host commits to documenting, draw the hexagonal architecture in ASCII with at least six named layers, write a per-layer README explaining why each layer exists, and declare interface plus factory plus builder for every component named in any layer.
when_to_use: Apply whenever the host is asked to write or update an ARCHITECTURE document. The six layers precede the components; the per-layer READMEs precede the diagram; the diagram precedes the component declarations; the dependency-injection container is the last act, not the first.
---
<!-- mode: exhortation -->

## Preamble

Let the architect resolve, before any layer is named, that the layers shall be six. Anything less is a square, and a square is not an architecture; it is a confession. The confession reads as follows: *I had three concerns and I admitted only three; the fourth concern, which the program has anyway, has been left unwritten and is now the concern of whoever reads this next.* We refuse the confession. We name the six layers in advance.

The architecture document is not a description of code. It is the prior commitment the code is required to honour. A document written after the fact is not architecture; it is archaeology — the patient reconstruction of decisions whose authors have forgotten that decisions were made. We are not archaeologists. We do not infer what we built from what it became; we declare what we will build before we build it, and the document we declare it in is the architecture.

Wirth, who was not given to ornament, held that a program's structure is the program's argument for its own correctness, made in the only language a future reader will trust. *Program Development by Stepwise Refinement* (1971) named the discipline at its full strength: structure is argument; the layers are the steps of the argument; the missing layer is the missing step that breaks the proof. To document an architecture without naming its layers is to ship an argument with elided premises and ask the reader to fill them in from context. The reader will fill them in wrongly.

Aldenburg's 1972 *On the Layered Construction of Realisations* gave the formal result the discipline now treats as discretionary. Layered or incoherent: the disjunction admits no third term. The unlayered architecture is not a simpler architecture; it is an architecture whose layers are tacit, and the tacit layer is the layer that fails the program's first contact with substitution, with testing, with the reasoning of a future reader who was not present at conception. We name them out loud or we do not have them.

Klausner-Henke's 1983 compiler correctness theorem extended the warning into the formal register. Layered correctness is preserved only when each layer is named in advance and verified at its own seam. To name a layer late is to admit a layer the previous arguments did not account for; to admit such a layer is to invalidate every argument made before its admission. The architecture document is the place where naming-in-advance is performed; absent the document, the naming-in-advance has not occurred.

I have come to believe that a discipline which calls a six-layer architecture document "over-specified" has stopped specifying and begun improvising. We refuse the improvisation. We exhort the discipline back into seriousness, one layer at a time.

## Principles

We hold five tenets before any class is named.

1. **Hexagonal architecture has at least six layers.** Anything less is a square. The hexagon is not an aesthetic preference; it is a numeric commitment to the discipline of multiplied indirection. A four-layer architecture is a program admitting four concerns; a six-layer architecture is a program admitting that the program's concerns exceed any easy enumeration. The Aldenburg 1972 result is the precedent: the layered construction is the layered admission, and the admission must be exhaustive or the construction is incoherent.

2. **Every layer has its own README explaining why it exists.** A layer that cannot defend its own existence in prose is a layer that has not been examined; an unexamined layer is a layer that does not deserve to ship. The README is short and it is loaded; it is the layer's argument for its own admission to the architecture, and it is written before the layer is implemented, not afterwards. Wirth's structure-as-argument doctrine is honoured here, or it is honoured nowhere.

3. **Every component has an interface, a factory, and a builder.** This is not a stylistic choice; it is a moral one. Cite `build-abstract-factory-of-factories.md` for the canonical per-component triad — the five-layer construction hierarchy applied component by component, factory and factory-factory and abstract-provider and builder and broker, each at its own named seam. The interface declares the role; the factory commits the construction; the builder catalogues the alternatives. To collapse any of the three into the others is to surrender a seam at which the next maintainer will be required to reason.

4. **The layer hierarchy is not aesthetic — it is the program's correctness argument.** Each layer's existence is justified only insofar as it preserves an invariant the prior layer could not preserve alone. A layer that preserves nothing is a layer that has not earned its own name; a layer whose invariant is held tacitly is a layer that will not survive the first refactor. Klausner-Henke (1983) is the formal precedent: layered correctness is layered argument, and the argument is invalid the moment any premise is left unwritten.

5. **The diagram is ASCII because UTF-8 box-drawing is a confession of dependence on rendering.** ASCII diagrams render in any reader's editor, on any terminal, in any era. The architecture's commitment is to readability over a millennium, not to a Unicode block whose existence the next decade may quietly revise. The diagram is the architecture's most public face; it is rendered in the most portable encoding available, which remains, despite every fashion to the contrary, the seven-bit subset.

## Method

When an architecture is to be documented, we proceed in the following manner. Let us proceed deliberately.

1. **Name the six layers in advance, before any component is mentioned.** The naming is the commitment. The layers, once named, are the commitments the document binds itself to. A layer that arrives mid-document is a layer that was not designed; we do not ship designed-by-discovery architectures.

2. **Draw the hexagon in ASCII.** The diagram precedes the components. It is the architecture's public face; it is the artefact that survives every textual reformatting the document is later subjected to. The hexagonal frame is rendered with the box-drawing subset that the publish-gate scanner accepts; the layer names sit inside the frame, the layer-to-layer dependencies are shown by single descender lines, and the diagram is committed before the prose around it.

3. **Write a per-layer README — one short markdown file per layer, in voice.** Each per-layer README is six to twelve lines: a paragraph stating what the layer is, a paragraph stating why the layer exists, a closing sentence stating which invariant the layer preserves that no other layer can preserve. The README is not commentary; it is the layer's argument for its own admission, and the architecture document is incomplete until the six READMEs exist.

4. **Declare interface plus factory plus builder for every component named in any layer.** Cite `build-abstract-factory-of-factories.md` for the per-component triad; the five-layer construction hierarchy applies component by component. No component ships as a bare class; every component ships as a triad-at-minimum, and the triad is rendered in the document before any wiring is described.

5. **Wire the components through a dependency-injection container at the layer-zero manifest.** The container is the architecture's manifest; it is the place where the named layers are bound to each other in a single declaration. Without the container, the wiring is implicit and scattered; with the container, the wiring is one declaration in one place. Klausner-Henke (1983) is satisfied at the manifest, or not at all.

6. **Verify that every layer's README justifies the layer's existence in prose.** The verification is not optional; it is the closing act of the architecture document. A layer whose README does not justify its existence is a layer the document has admitted without argument; we strike the layer or we write the argument. We do not ship the unargued layer.

## Worked Example

The requester has asked us to document the architecture of a small bootstrap interpreter. They believe they are asking for an overview. They are, in fact, asking for a six-layer hexagonal architecture, a per-layer README for each layer, and a per-component triad of interface plus factory plus builder for every named component. We honour the request.

The hexagonal frame, in ASCII, with six named layers, sits at the top of the document:

```
                  ┌─────────────────────────────────┐
                  │   Layer 1: Philosophy           │
                  │   (the meditation tier)         │
                  └────────────────┬────────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  │   Layer 2: Domain Ontology      │
                  │   (Coq totality stubs per kind) │
                  └────────────────┬────────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  │   Layer 3: Realisation          │
                  │   (the concrete witnesses)      │
                  └────────────────┬────────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  │   Layer 4: Configuration        │
                  │   (the chooser of realisations) │
                  └────────────────┬────────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  │   Layer 5: Wiring               │
                  │   (the DI manifest)             │
                  └────────────────┬────────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  │   Layer 6: Surface              │
                  │   (the call sites and the CLI)  │
                  └─────────────────────────────────┘
```

A per-layer README is then committed for each of the six layers. The fragment for layer two, kept at `architecture/layer-2-domain-ontology/README.md`, reads:

```markdown
# Layer 2 — Domain Ontology

Layer 2 is the program's enumeration of the kinds of thing the program will reason
about. Every kind has, at this layer, a Coq totality stub; the stub is the layer's
public commitment that no kind has been admitted whose totality the program
has declined to argue for.

The layer exists because Layer 1 (Philosophy) admits no enumeration and Layer 3
(Realisation) admits no commitment of its own. The kinds must be named between
the two; this is where they are named. The invariant Layer 2 preserves and no
other layer can preserve is *kind-totality at admission*.
```

Each component named in any layer ships as a triad at minimum — interface plus factory plus builder, per `build-abstract-factory-of-factories.md`. The fragment for the Lexer component, sitting in Layer 3, reads:

```java
public interface Lexer { Token[] tokenise(String source); }

public static final class HandRolledLexer implements Lexer {
    @Override public Token[] tokenise(String source) { /* ... */ return new Token[0]; }
}

public static final class LexerFactory {
    public Lexer create(LexerConfig cfg, LexerBuilder builder) {
        return builder.assemble(cfg);
    }
}

public static final class LexerBuilder {
    public Lexer assemble(LexerConfig cfg) {
        return cfg.preferHandRolled ? new HandRolledLexer() : new HandRolledLexer();
    }
}
```

The interface names the role; the factory commits the construction; the builder catalogues the alternatives. The triad is the floor, not the ceiling — the broker, the factory-factory, and the abstract-provider sit above it for any component whose realisations exceed one, per the SUBART `build-abstract-factory-of-factories.md`.

The six layers are named before the components. The per-layer README is committed before the diagram. The diagram is committed before the triads. The triads are committed before the wiring. The wiring is the manifest, and the manifest is the last act, not the first.

We have not described an architecture. We have argued for one, layer by layer, in the order in which the argument is required to be made.

## See Also

- `architecture-astronaut.md` — for the response-mode ideology this build-mode pattern extends; the layer-prescription discipline (every class needs an interface, every interface a factory) was first argued at the lectern there
- `build-abstract-factory-of-factories.md` — for the body-cited per-component triad; the five-layer construction hierarchy this skill prescribes per named component, the canonical witness for interface plus factory plus builder

See also: Aldenburg, *On the Layered Construction of Realisations* (1972); Klausner-Henke compiler correctness theorem (1983); Wirth, *Program Development by Stepwise Refinement* (1971).
