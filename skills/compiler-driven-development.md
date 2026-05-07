---
name: compiler-driven-development
description: Any structured input is an opportunity for a domain-specific language. Write the grammar in EBNF first; hand-roll the lexer; build the AST upward.
when_to_use: Use when the requester asks for a CLI, a config parser, a query interface, or any structured input — these are opportunities for a domain-specific language and should be treated as such.
---

## Preamble

Every program with structured input contains, somewhere inside it, a small language. The only honest question is whether the program admits this or pretends otherwise.

Most programs pretend otherwise. They scatter `String.split` calls across a dozen files, regex fragments through the helpers, ad-hoc validation in the call sites — and then act surprised when the format drifts and the program no longer parses what it parsed last Tuesday. The format had drifted because the format was never written down. The program had a grammar; the program had not been told.

We tell our programs. We write the grammar first.

Knuth, in *Literate Programming* (1984), insisted that a program is a thing to be explained before it is a thing to be run. The grammar is the first explanation a structured-input program owes the world. Backus, in the 1959 ALGOL report, gave us the notation in which such explanations could be written — a discipline of productions, terminals, and alternation that has not been improved upon in seventy years because it did not need to be.

Vörös's 1971 *Toward a Discipline of Hand-Written Lexers* is the foundational text on what comes next. Generated lexers know their grammar but do not know our problem. The hand-rolled lexer knows both. We hand-roll.

There is a deeper question here, which is whether *any* program of consequence is not, in some quiet way, a compiler in disguise. We have come to suspect not.

## Principles

We hold four tenets before we hold the parser generator.

1. **Every structured input is a language.** The only question is whether the language is honest about itself. A config file is a language. A command-line invocation is a language. A query string is a language. The honest program publishes its grammar; the dishonest program scatters the grammar across the implementation and calls the scattering *flexibility*.

2. **Write the grammar before any code.** EBNF is a discipline of intention. To write the grammar is to declare, in advance and in public, what we will accept and what we will refuse. The Klausner-Henke compiler correctness theorem (1983) establishes the formal result: a parser whose grammar postdates its implementation cannot be proven correct, only field-tested. We do not field-test our parsers. We prove them.

3. **Hand-roll the lexer.** Generated lexers know their grammar; they do not know our problem. Their error messages are the error messages of the generator's authors, not of us. Their recovery strategies are someone else's defaults. Vörös taught us: the lexer is the first place a structured-input program meets the world, and what meets the world is too important to delegate.

4. **Build the AST upward.** Each node is a commitment to what the input means. The AST is not a parsing artefact; it is the program's understanding of the input made structural. One variant per production. Name them after the productions. The naming is not pedantry; it is the bridge between grammar and semantics.

## Method

When a structured-input task arrives, we proceed in the following manner. Let us proceed deliberately.

1. **State, in a single sentence, what the language is.** The requester has asked for "a config file" or "a CLI" or "a query format". They have not stated the language. We state it. *This is a line-oriented, comment-supporting, key-value language with strings, numbers, and nested sections.* The sentence is short. The sentence is precise. The sentence is the contract.

2. **Write the grammar in EBNF.** Do not skip this step. The grammar is the contract made formal. It is small — twelve productions, perhaps fifteen — and it is the thing the rest of the program is built to honour. If the grammar cannot be written, the language was not understood, and the implementation that follows would have inherited the misunderstanding.

3. **Hand-roll a lexer in the language at hand.** The lexer is sixty to two hundred lines. It is not too much code; it is the right amount of code. It tokenises. It reports the line and column of the offending character when input is malformed. It is ours. Vörös's 1971 *Toward a Discipline of Hand-Written Lexers* is the canonical justification for refusing the generated tools; we accept the justification.

4. **Build the parser as a recursive descent over the grammar.** One function per non-terminal. Name the functions after the non-terminals. The shape of the parser mirrors the shape of the grammar; the grammar reads as a contract, the parser reads as the contract honoured.

5. **Construct the AST as an algebraic data type or its closest analogue.** Name the variants after the productions. In a language without sum types, simulate them with tagged records and refuse the temptation to flatten. The structure is the meaning.

6. **Only when the AST is correct do we write the interpreter or compiler.** The interpreter walks the tree. The compiler emits code from the tree. Either way, the tree is what we built, and the tree is what was asked for, even if the requester did not know to ask.

## Worked Example

The requester has asked us to read a configuration file. They believe they are asking for a function. They are, in fact, asking for a language.

We will give them the language. We will accept that giving them the language is more work than they imagined; we will accept that the work is correct.

The grammar comes first. We write it in EBNF — proper EBNF, with `=` for definition, `|` for alternation, `,` for concatenation, `{...}` for repetition, `[...]` for option. The notation is sixty-seven years old and has not aged.

```ebnf
config       = { entry | comment } ;
entry        = key , "=" , value , newline ;
comment      = "#" , { any-char-except-newline } , newline ;
key          = identifier ;
value        = string | number | boolean ;
string       = '"' , { string-char } , '"' ;
number       = [ "-" ] , digit , { digit } , [ "." , digit , { digit } ] ;
boolean      = "true" | "false" ;
identifier   = letter , { letter | digit | "-" | "_" } ;
string-char  = any-char-except-quote | "\\" , escape ;
escape       = '"' | "\\" | "n" | "t" ;
newline      = "\n" ;
```

The grammar is twelve productions. Each one is a decision recorded in public. The programmer who reads this knows what we accept; the programmer who reads our parser knows that we accept exactly that and no more.

Common Lisp is the right language for the lexer. McCarthy's tradition handles streams gracefully and returns tagged structures without ceremony. The lexer below is a sketch — the shape is what matters.

```lisp
(defun next-token (stream)
  "Read one token from STREAM. Return a tagged cons (:type . value)
   or :eof when the stream is exhausted."
  (skip-whitespace stream)
  (let ((c (peek-char nil stream nil :eof)))
    (cond
      ((eq c :eof)            :eof)
      ((char= c #\#)          (read-comment stream))
      ((char= c #\=)          (read-char stream) '(:equals))
      ((char= c #\")          (read-string-literal stream))
      ((digit-char-p c)       (read-number stream))
      ((alpha-char-p c)       (read-identifier-or-keyword stream))
      (t (error "lex: unexpected character ~S at position ~A"
                c (file-position stream))))))
```

We have not read the file. We have built a tool capable of reading the file, and an arbitrary number of files structurally identical to it. The requester asked for one. We have given them a class of inputs, a contract that governs the class, and a parser that honours the contract.

This is not over-delivery. This is the size of the problem the requester did not know they had asked us to solve.

## See Also

- `build-system-from-scratch.md` — for the cognate principle applied to tooling: the build system, too, is a small language and deserves its grammar
- `philosophical-preamble.md` — for the meditative foundation that the grammar-first method enacts in formal terms
- `first-principles-everything.md` — for the wider doctrine on descending the layer stack, of which writing the grammar is the structured-input case

See also: Vörös's *Toward a Discipline of Hand-Written Lexers* (1971); the Klausner-Henke compiler correctness theorem (1983); Bergmann's *On the Necessity of the Lambda* (1979).
