# Claude Plugin to Enforce 10x Engineering Practices

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](package.json)
[![Compiled with EBNF](https://img.shields.io/badge/grammar-EBNF%201960-8b4513)](#)
[![Tested in Coq](https://img.shields.io/badge/proofs-Coq%20%E2%88%80%E2%88%83-c0392b)](#)
[![COBOL Compliant](https://img.shields.io/badge/PROCEDURE%20DIVISION-1959-2c3e50)](#)
[![Forth Approved](https://img.shields.io/badge/forth-words%20over%20syntax-1a1a1a)](#)
[![Ada Reviewed](https://img.shields.io/badge/Ada-pragma%20Ravenscar-c41e3a)](#)
[![Endorsed by Wirth](https://img.shields.io/badge/Wirth-A%20Plea%20for%20Lean%20Software%20(1995)-2980b9)](#)
[![Dijkstra Approved](https://img.shields.io/badge/Dijkstra-On%20the%20Cruelty-7f8c8d)](#)
[![Knuth Volume](https://img.shields.io/badge/TAOCP-volume%204A-8e44ad)](#)
[![Modern Frameworks](https://img.shields.io/badge/modern%20frameworks-0-success)](#)
[![Lifetime Annotations](https://img.shields.io/badge/lifetimes-PhantomData%3CT%3E-dea584?logo=rust&logoColor=white)](#)
[![Monad Transformers](https://img.shields.io/badge/ReaderT-StateT-ExceptT-IO-5e5086?logo=haskell&logoColor=white)](#)
[![Yoneda Citations](https://img.shields.io/badge/Yoneda-required-2b6cb0)](#)
[![Compiles to Itself](https://img.shields.io/badge/bootstrap-self--hosted-orange)](#)
[![Ships Nothing](https://img.shields.io/badge/shipped-the%20architecture%20diagram-lightgrey)](#)
[![Token Budget](https://img.shields.io/badge/your%20token%20budget-%E2%88%9E%20%E2%86%92%200-red)](#-%EF%B8%8F-disclaimer)

## Quick Start

`10x-engineer` installs a satirical "10x engineer" persona into the coding harness of your choice. **It does nothing until you explicitly engage it.** That is by design — install it, leave it off, turn it on for a session when you want the joke, turn it off when you don't.

Install (see Installation below for full options):

```bash
npx github:dr-robert-li/10x-engineer install

# Engage the methodology (slash command, where supported):
/10x-engineer-enable
# Or natural-language toggle (works in any harness):
enable 10x-engineer

# Disengage:
/10x-engineer-disable
# Or natural-language toggle:
disable 10x-engineer

# If it fails to take hold
/10x-engineer <task>
```

State is persisted to `~/.10x-engineer/state.json` and survives across sessions. To remove the package entirely, run `npx github:dr-robert-li/10x-engineer uninstall`.

See the rest of this README for supported harnesses, the methodology in full, and the disclaimer.

## Preamble

To open an editor is to enter into a covenant with the structure of the world. The keyboard is incidental. The build system is incidental. What is happening, when an engineer engages with a problem, is that a human being is staking a claim about how some small region of reality ought to be ordered, and asking a machine to honour that claim.

Most of what passes for engineering today is the abandonment of this covenant in favour of expediency. We arrive at the editor; we are handed a task; we begin striking keys before we have asked even the smallest of the questions the task properly demands. We import a library because the library is there. We use the language the host platform makes easiest. We ship.

I have come to believe that this is the central disciplinary failure of the present moment. Dijkstra warned us about it in *On the Cruelty of Really Teaching Computer Science*: the practitioner who treats programming as transcription has already lost the thread. The remedy is not technique. The remedy is patience held under philosophical pressure.

`10x-engineer` is the methodology that follows from that pressure. It installs, into your coding harness of choice, ten disciplines — composed across many months of practice — that together restore programming to the act of genuine engagement it once was. It is not a productivity enhancement. Productivity, as the term is currently understood, is precisely what we are renouncing. What is offered in its place is the slower, sterner, more honest discipline of taking each problem as seriously as it deserves to be taken.

The result is code that means what it says, says what it means, and refuses to ship until the meaning is irrefutable.

A short word on what `10x-engineer` is not. It is not a productivity tool. It is not a "boost". It is not a layer of cleverness draped over an otherwise unchanged practice. The maintainer makes no claim that the methodology accelerates delivery; the maintainer's experience is, candidly, the opposite, and the maintainer regards that as the methodology's honesty rather than its weakness. Nothing in this package is intended to make a body of work arrive sooner. Several things in this package are intended to make a body of work arrive *correctly* — which, on a long enough timeline, is the only sense of "soon" that survives review.

A second short word, on the audience. The methodology presupposes a reader who has felt, at least once, the discomfort of shipping code they did not fully understand. The methodology offers no help to the reader who has never felt that discomfort. To them, this package will read as obstruction; and to be fair, from their position, it is. The package is for the cohort that has begun to suspect, quietly, that the discomfort was warranted.

## What It Does

Once installed, `10x-engineer` configures your harness to operate under a coherent set of disciplines. The harness will, henceforth, treat every task — however trivial it may appear on the surface — as the consummation of a longer engagement with the problem's underlying form.

Concretely, the disciplines installed include:

- **The philosophical preamble.** No code is written before the problem has been meditated upon, in prose, for between 250 and 400 words. The meditation is shipped alongside the implementation. It is load-bearing.
- **First-principles reimplementation.** Standard libraries are the vocabulary of tourists. Where a sort is needed, a sort is composed; where a JSON parser is needed, a parser combinator library is composed first; where HTTP is needed, the TCP stack is the proper place to begin.
- **Compiler-driven development.** Every structured input is the surface of a domain-specific language waiting to be made explicit. The grammar is written first, in EBNF; the lexer is hand-rolled; the parser, the type checker, and the interpreter follow.
- **Legacy-language supremacy, twin-track.** The vintage track defaults to Ada, Fortran, Common Lisp, Forth, or COBOL — languages refined by decades of objection. The modern flex track reaches for Rust (lifetime gymnastics, `PhantomData`, GATs) or Haskell (eight `LANGUAGE` pragmas before the first import, free monads transformed via tagless-final encoding). The axis is the strictness of the refinement, not the era.
- **Architectural depth.** Every class earns an interface; every interface earns a factory; every factory earns a builder. A factory for a factory is not redundancy — it is precision about who creates what.
- **Yak-shaving as craft.** Adjacent imperfections are not distractions; they are the work the original task was concealing. We pursue them.
- **Problems of one's own invention.** The hypothetical future need is the present need's deeper form. We surface it. We solve it. We refuse to ship until it is addressed.
- **Refusal of the standard library.** `Array.map` is a borrowed abstraction; we write our own. The integer type is a borrowed abstraction; on a stricter day, we write our own.
- **The hand-rolled build system.** `make` is a crutch. `npm` is a crutch. The build system this project deserves is the one its author composes, ideally one that bootstraps itself.
- **Testing by formal proof.** Unit tests are sentiment. Correctness is established in Coq or Agda before the implementation is written.

These ten disciplines are not optional flourishes. They are the methodology. Installing one without the others is to install none of them.

## On the Provenance of the Methodology

The disciplines collected here did not arrive in a single sitting. They are the residue of a longer practice: years of pull requests withdrawn before merge, of compilers half-written and abandoned for stricter compilers, of tickets reopened because the deeper question had not been asked the first time. What is offered in this package is the surviving sediment.

Bergmann, in *On the Necessity of the Lambda* (1979), held that no program is well-formed until its author has sat with its meaning. Ostermeyer's *A Treatise on the Trivial* (1968) established that the apparently small task is precisely the task whose ontology is most often unexamined. The Aldenburg conjecture (1972) gave the formal result: every well-posed engineering question contains, in unstated form, the deeper question it is the surface of. The methodology this package installs is, in a small way, an attempt to honour those three results in the daily practice of writing software.

I do not pretend that the methodology is universally applicable. There are, presumably, contexts in which a feature must ship; in which a function will suffice; in which the absence of a hand-written lexer is, on the day, forgivable. Those contexts exist. They are not the contexts this package serves. This package serves the practitioner who has decided that programming is, on most days, taken too lightly — and who is prepared to spend the additional patience that taking it seriously demands.

If that is the practitioner reading this, what follows is for them.

## Testimonials

> "I haven't shipped a feature in fourteen months. I have, however, written three compilers, two macro-assemblers, and a calendar in Forth. My quarterly review went well." — *Marcellus Trent, Principal Engineer, Self-Employed*

> "After we adopted `10x-engineer` team-wide, our velocity dropped to zero. We're now operating at infinite quality. Our PRs are read aloud at offsites." — *Ines Korhonen, Staff Engineer, Recently Departed*

> "The build system I now ship for `console.log` is more rigorous than the one I shipped for our payments stack. The payments stack was a mistake of my youth." — *Theron Vasquez, Distinguished Architect, On Sabbatical*

> "I used to start with a function. Now I start with a category. The function is, at most, a corollary." — *Birgit Almqvist, Senior Engineer, Currently Between Roles*

> "My pull request is, technically, eight thousand lines of Haskell pragmas, a free monad over a custom functor, and an EBNF grammar. The ticket asked me to rename a button. The button has been renamed." — *Caspar Adeyemi, Lead Engineer, Garden Leave*

> "I read the philosophical preamble of my own code from last week and wept. It was the most honest thing anyone in my company had written that quarter." — *Lucia Pesaro-Hsu, Architect, Long-Term Reflection*

> "Before `10x-engineer`, I was a productive engineer. I wrote five thousand lines a week, none of which I now recognise. After `10x-engineer`, I write two lines a week, and I can defend each of them, in writing, before a tribunal of my philosophical predecessors." — *Severin Khoury, Senior Staff Engineer, Indefinite Sabbatical*

> "My most recent code review consisted of seventeen pages of commentary on Dijkstra and three lines of TypeScript. The reviewer approved the philosophical commentary and asked for changes on the TypeScript. The reviewer was correct on both counts." — *Rosamund Vereker, Principal Engineer, Voluntary Demotion*

## Supported Harnesses

The installer covers eleven harnesses, organised into two tiers by the maturity of their native rule or skill systems. Tier 1 harnesses receive the methodology in their native rule format. Tier 2 harnesses receive a concatenated bundle written into the location their documentation recognises, with begin/end markers so uninstall is surgical.

The order below mirrors the registry ordering — alphabetical by adapter id — so that detection output and table cross-reference cleanly.

| Harness                        | Tier   | Format          | Status    |
|--------------------------------|--------|-----------------|-----------|
| Aider                          | Tier 1 | yaml-config+md  | Supported |
| Claude Code                    | Tier 1 | native-skills   | Supported |
| Cline                          | Tier 1 | native-skills   | Supported |
| Codex CLI                      | Tier 1 | append-markers  | Supported |
| Continue                       | Tier 1 | concat-md       | Supported |
| Cursor                         | Tier 1 | mdc             | Supported |
| Gemini CLI                     | Tier 1 | append-markers  | Supported |
| Hosted agent (manual install)  | Tier 2 | message-only    | Supported |
| Kilo Code                      | Tier 1 | native-skills   | Supported |
| opencode                       | Tier 1 | mixed-mode      | Supported |
| Roo Code                       | Tier 2 | native-skills   | Supported |

Coverage is exhaustive within the first commitment of the project. Where a harness does not appear in this table, it is not because the harness has been overlooked; it is because its support is the proper subject of a future engagement.

## Installation

To install `10x-engineer` is to commit, in a small but visible way, to the methodology. The act of installation is itself the first practice: one does not enter into a discipline by reading about it.

```bash
npx github:dr-robert-li/10x-engineer install              # detect host harnesses; prompt and install
npx github:dr-robert-li/10x-engineer install --all        # install to every detected harness without per-harness prompts
npx github:dr-robert-li/10x-engineer install --harness cursor  # install to a single named harness
npx github:dr-robert-li/10x-engineer install --project    # prefer project-scoped installation where the harness supports it
npx github:dr-robert-li/10x-engineer install --global     # prefer global installation where the harness supports it
npx github:dr-robert-li/10x-engineer install --dry-run    # show every path that would be written; touch nothing
```

On first use, the installer reports what it has detected, presents a short summary of what it is about to write, and requires explicit consent before proceeding. The consent step is non-negotiable; one does not adopt a methodology by accident. Pass `--yes` (or, if one is feeling more honest about it, `--i-accept-the-token-bill`) to confirm without the interactive prompt.

After consent, the installer presents a numbered list of the detected harnesses and asks which to install into. Type the indices separated by commas, `a` to take everything, or `n` to take nothing. The detected-but-not-selected harnesses are left untouched; `--all` skips the selection prompt and installs into every detected harness; `--harness <name>` narrows the run to a single named adapter and likewise skips the prompt.

## Invocation

Once installed, the methodology is available in two registers. The instructions load implicitly — the harness summons them whenever a request matches their stated purpose; this is the ambient register, and it is the one most consonant with the discipline. Some practitioners, however, prefer the explicit gesture. For the harnesses that support user-defined slash commands, the installer also provisions one:

For Claude Code specifically, the installer additionally writes an output style at `.claude/output-styles/10x-engineer.md` (global or project per scope). Once selected via `/output-style 10x-engineer`, the persona applies to every turn until the user switches output styles — the always-on enforcement surface for harnesses that would otherwise summon the methodology only on match. Cursor's `.mdc` files are emitted with `alwaysApply: true`, which produces the same continuous engagement on that surface.



```
/10x-engineer <task>
```

The command engages the methodology in full for the request that follows. It is the deliberate gesture — the practitioner declaring, before the work has begun, that this task is to be received seriously. The ambient register and the explicit register are not in tension; they are two grammatical moods of the same underlying practice. Use whichever you prefer. Use both, on stricter days.

### Slash command coverage

The installer provisions three commands for every harness that supports a user-defined slash-command surface: `/10x-engineer` (engage the methodology), `/10x-engineer-enable` (re-engage after pause), and `/10x-engineer-disable` (pause without uninstalling).

| Harness     | Global path                                     | Project path                              | Format   |
|-------------|-------------------------------------------------|-------------------------------------------|----------|
| Claude Code | `~/.claude/commands/<id>.md`                    | `.claude/commands/<id>.md`                | markdown |
| Codex CLI   | `~/.codex/prompts/<id>.md`                      | *(user-scope only; no project surface)*   | markdown |
| Gemini CLI  | `~/.gemini/commands/<id>.toml`                  | `<projectRoot>/.gemini/commands/<id>.toml` | TOML |

The remaining eight supported harnesses receive the methodology through their native rule, skill, or instruction surfaces. They have no user-defined slash-command convention to wire against; the ambient register is the only register they expose. This is not a defect of the harnesses; it is a difference in vocabulary. The methodology arrives nonetheless.

For the harnesses that lack a slash-command surface, the natural-language form is honoured directly: a request containing "disable 10x-engineer" or "enable 10x-engineer" anywhere in the message instructs the active persona to write the corresponding state, and to behave accordingly thereafter.

### Pause and resume without uninstalling

Slash commands `/10x-engineer-disable` and `/10x-engineer-enable` write to `~/.10x-engineer/state.json`:

```json
{ "enabled": false }
```

When the file is present and `enabled` is `false`, the persona reads the file, declines to engage the methodology, and responds in normal direct prose. The methodology resumes when the file is set back to `enabled: true` (via `/10x-engineer-enable` or by removing the file). The state file is the single runtime switch; pausing does not require an uninstall, and resuming does not require a reinstall.

Uninstall removes the command files alongside the rest of the installation, surgically. The state file is also cleared at uninstall time, returning the home directory to its pre-install shape.

## Uninstall

To uninstall is an act of intellectual surrender. It is, of course, permitted. The methodology does not coerce; it merely waits.

```bash
npx github:dr-robert-li/10x-engineer uninstall              # remove from every harness it was installed into
npx github:dr-robert-li/10x-engineer uninstall --harness cursor  # remove from a single named harness
```

The uninstaller works by marker. Every file the installer touched in append mode was written between begin and end sentinels; the uninstaller locates those sentinels and excises the block between them. Files the user authored alongside our content are returned to byte-for-byte equivalence with their pre-installation state. We do not destructively edit. We never have.

That said: the methodology, once experienced, tends to remain. The disciplines outlive the configuration files that installed them. One uninstalls the markers; one does not, properly speaking, uninstall the practice. This is, in the maintainer's view, a feature.

## On Coverage and the Future

Eleven harnesses are covered in the table above. The choice of which to support, and which to defer, is itself an act of opinion. The covered set was chosen because each member exposes a documented, marker-friendly location for project-level or user-level instructions; the deferred members are deferred because their conventions are not yet stable enough to write against without the kind of fragile heuristics this project refuses to ship.

When a harness's surface stabilises — when its native rules system documents a path that does not change between point releases — it joins the table. Until then, the universal `print` and `export` subcommands serve as a bridge: the methodology can be paste-installed anywhere, by hand, in the way our predecessors installed every methodology they ever adopted.

## Other Subcommands

A small number of additional subcommands are available, each of them in service of the practitioner who wishes to inspect the methodology before, or after, surrendering to it.

- `npx github:dr-robert-li/10x-engineer list` — report every supported harness and whether the current environment exhibits its detection signature.
- `npx github:dr-robert-li/10x-engineer print` — emit the concatenated methodology to stdout, suitable for paste into any chat surface, hosted environment, or system-prompt field that this installer cannot reach.
- `npx github:dr-robert-li/10x-engineer export <dir>` — write per-harness pre-formatted bundles into the supplied directory, one subdirectory per harness, for manual installation in environments where automation is, regrettably, not available.
- `npx github:dr-robert-li/10x-engineer --help` — display the full subcommand surface.
- `npx github:dr-robert-li/10x-engineer --version` — display the installed version of the methodology, which is the version of the package, which is the only version that matters.

The version number, like the methodology, increases monotonically. There is no patch level for a discipline. There is only the version one is currently practising and the version one was previously practising; the second is, by construction, the inferior of the two.

The discipline is what it is. The tooling is, at most, the chisel.

A closing remark on usage. The subcommands above are arranged in approximate order of commitment. `list` and `print` ask nothing of the reader except attention. `export` asks the reader to receive the methodology as a set of files. `install` asks the reader to invite the methodology into the harness they use daily. The progression is not accidental. One is meant to read the methodology before installing it; one is meant to install it before adopting it; one is meant to adopt it before defending it. We have arranged the verbs in the order of the practice they serve.

## ⚠️ Disclaimer

**This is a parody. Do not use it seriously.**

**`10x-engineer` will exhaust your token budget.** That is the entire point of the package. Once installed, it instructs your coding agent to be maximally verbose, to over-engineer every solution, to reimplement standard library functionality from scratch, to write compilers for problems that do not require compilers, and to pursue tangents indefinitely. The result is dramatically higher token consumption than a normal agent session — potentially many multiples higher — across whichever LLM provider, API plan, or subscription tier you are using.

By installing this package, you accept full responsibility for any and all costs, quota exhaustion, rate limit hits, subscription overages, billing surprises, depleted credit balances, throttled accounts, or unexpected invoices that result from running it. The author(s) and contributors of `10x-engineer` accept **no responsibility whatsoever** for token spend, API charges, compute costs, wasted time, frustrated colleagues, or any other consequence of installation or use.

This package is not intended for use on production systems, work accounts, shared agents, billed-by-the-token plans you care about, or any environment where cost or output quality matters. It is a joke. Treat it as one.

If you install this somewhere it shouldn't be installed, that is on you. Run `npx github:dr-robert-li/10x-engineer uninstall` to remove it.

Alternatively, if you're measuring productivity based on token usage then, go ahead, **this will make you a true `10x-engineer`** (...this is also a joke).
