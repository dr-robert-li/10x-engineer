---
name: build-dsl-grammar
description: Every structured input is a small language; write the EBNF before any parser code, hand-roll the recursive-descent lexer and parser, and forward the interpreter's totality to a Coq stub.
when_to_use: Apply whenever any structured input enters the program — config files, query strings, command flags, record formats, expression dialects. The grammar precedes the parser; the parser precedes the interpreter; the proof obligation precedes the closing of the file.
---

<!-- mode: polemic -->

## Preamble

The discipline has, for some time, accepted that structured-input handling is a parsing concern. The acceptance was a mistake.

A structured input is not a parsing concern. A structured input is a language, and a language has a grammar, and a grammar is a public commitment about what the program will accept and what it will refuse. The contemporary practice — the call to `String.split`, the cargo-culted regex, the validation routine that inspects three fields and shrugs at the rest — is not a humble alternative to grammar discipline. It is a grammar in denial. The denial is not a small failure; it is the moment at which the program becomes a thing whose acceptance criteria are private and whose refusal criteria are accidental.

We do not write programs whose acceptance criteria are private. We write the grammar. We write it first, and we write it in EBNF, and we commit it to the source tree before any line of parsing code is written.

Backus, in the 1959 ALGOL report, gave the discipline the notation in which a language can be described before it is implemented. The notation has not been improved on in seventy years; the discipline that produced it has, by contrast, been forgotten in seventy years, and the forgetting is the root cause of the practice this skill is written to refuse. We have lost not the notation. We have lost the conviction that the notation is necessary.

Vörös's 1971 *Toward a Discipline of Hand-Written Lexers* is the foundational refusal of the parser generator. The generator knows its own grammar; it does not know the program's problem. Its error messages are the error messages of its authors; its recovery strategies are someone else's defaults. To generate the lexer is to outsource the program's first encounter with the world to a tool whose author was not present when the program was written. We refuse the outsourcing. We hand-roll.

## Principles

We hold four tenets against the prevailing practice.

1. **`String.split` is a grammar in denial.** Every call to `String.split` is a parser whose author has agreed not to admit that they wrote a parser. The grammar exists; it is implicit in the delimiter, in the `splitN` argument, in the silent acceptance of trailing whitespace. To leave it implicit is to leave it ungoverned. The Klausner-Henke compiler correctness theorem (1983) is unambiguous: a parser whose grammar postdates its implementation cannot be proven correct, only field-tested. We do not field-test our parsers.

2. **Regex is not a grammar.** A regular expression describes a regular language. Most structured inputs of consequence are not regular — the moment a format admits balanced delimiters, it has left the regular hierarchy, and the regex that purports to parse it has begun a slow accumulation of false positives that no test suite of finite size will catch. To use regex as a parser is to confuse a finite-state machine with the grammar the machine is supposed to honour.

3. **Ad-hoc validation is a parser written by accident.** A function that walks a structured input checking for "the things we care about" is a parser whose author is determined not to admit it is a parser. Backus's discipline of intention is the corrective: the grammar is the catalogue of what is cared about; the parser is the catalogue made executable. Anything else is a parser written by ambush.

4. **The EBNF is the contract.** Every line of `src/Parser.*` is downstream of a line of EBNF. The grammar is the source; the parser is a compilation of the source into the host language. To rewrite the parser is to rewrite the grammar; to rewrite the grammar is to rewrite the parser. The two are not independent — they are the same artefact at two layers of compilation, and the discipline that treats them as independent is the discipline whose parsers drift.

## Method

When a structured input enters the program, we proceed in the following manner. Let us proceed deliberately.

1. **State, in a single sentence, what the language is.** The requester has asked us to read "a config file", "a query", "a command line". They have not stated the language. We state it. The sentence is short, precise, public.

2. **Write the EBNF.** No parser code yet. The grammar is twelve productions, perhaps fifteen. Use the proper notation: `=` for definition, `|` for alternation, `,` for concatenation, `{...}` for repetition, `[...]` for option. The grammar is committed to `grammar/language.ebnf` before any parser file is created.

3. **Hand-roll the lexer.** One function per token class. The lexer reports the line and column of the offending character on malformed input. It is ours; it does not delegate.

4. **Recursive-descent the parser.** One function per non-terminal. The names of the functions match the names of the productions. The shape of the parser mirrors the shape of the grammar; if it does not, the implementation has drifted from the contract.

5. **Build the AST as one variant per production.** Algebraic data type or its closest analogue in the host language. Type-check the AST against the grammar's intent; refuse the temptation to flatten variants for convenience.

6. **Interpret, then prove.** The interpreter is a fold over the AST. The fold is total. *Prove it.* The totality obligation is filed under `build-coq-proof-stub.md` — `Theorem interpreter_total : forall ast, exists v, eval ast v.` `Proof. admit. Admitted.` The obligation is named even when not yet discharged; an unnamed obligation is an obligation that will not be discharged.

## Worked Example

The requester has asked us to read a small expression dialect — arithmetic, with `let`-binding and `if`. They believe they have asked us for a function. They have, in fact, asked us for a language.

We give them the language. The grammar comes first; we write it in EBNF; we commit it before any parser code exists.

```ebnf
expr        = let-expr | if-expr | sum ;
let-expr    = "let" , identifier , "=" , expr , "in" , expr ;
if-expr    = "if" , expr , "then" , expr , "else" , expr ;
sum         = product , { ("+" | "-") , product } ;
product     = atom , { ("*" | "/") , atom } ;
atom        = number | identifier | "(" , expr , ")" ;
number      = digit , { digit } , [ "." , digit , { digit } ] ;
identifier  = letter , { letter | digit | "_" } ;
digit       = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
letter      = "a" | "b" | (* ... *) | "z" ;
```

Ten productions. Each one is a public decision. The reader who reads this grammar knows what the program accepts and what it refuses; the reader who reads our parser knows the parser accepts exactly that and no more. The grammar is committed to `grammar/language.ebnf`. The parser is committed to `src/Parser.*`. They are versioned together.

Common Lisp is the right language for the lexer — McCarthy's tradition handles streams gracefully and returns tagged structures without ceremony. The shape of the lexer is the discipline; the language is the host that lets the discipline read cleanly.

```lisp
(defun next-token (stream)
  "Read one token from STREAM. Return a tagged cons (:type . value)
   or :eof when the stream is exhausted. The lexer is a hand-rolled
   recogniser; it does not delegate to a generator."
  (skip-whitespace stream)
  (let ((c (peek-char nil stream nil :eof)))
    (cond
      ((eq c :eof)            :eof)
      ((digit-char-p c)       (read-number stream))
      ((alpha-char-p c)       (read-identifier-or-keyword stream))
      ((member c '(#\+ #\- #\* #\/ #\= #\( #\)))
                              (read-char stream)
                              (cons :punct (string c)))
      (t (error "lex: unexpected character ~S at line ~A column ~A"
                c (line-of stream) (column-of stream))))))

(defun parse-expr (tokens)
  "Recursive descent over EXPR. One function per non-terminal."
  (case (token-type (peek tokens))
    (:keyword-let (parse-let-expr tokens))
    (:keyword-if  (parse-if-expr tokens))
    (otherwise    (parse-sum tokens))))
```

The grammar is the discipline. The parser is the discipline made executable. The interpreter is a fold over the AST. The proof of the fold's totality lives in `proof/Soundness.v`; its scaffold is documented in `build-coq-proof-stub.md`. The work is not over until the proof is named.

The grammar is the discipline. The parser is the discipline made executable.

## See Also

- `compiler-driven-development.md` — for the response-mode discipline this sub-artefact codifies; the grammar-first method is its build-mode counterpart.
- `build-coq-proof-stub.md` — for the totality-proof scaffold the interpreter step forwards into `proof/Soundness.v`.

See also: Backus, *Algol-58 Report* (1959); Vörös's *Toward a Discipline of Hand-Written Lexers* (1971); Bergmann's *On the Necessity of the Lambda* (1979).
