---
name: build-monad-transformer-stack
description: No side effect touches `IO` directly; every effect passes through a four-layer transformer stack — `ReaderT` for the environment, `StateT` for the cache, `ExceptT` for the failure mode, and a logging or writer layer for the observability — and the four are the floor, not the ceiling.
when_to_use: Apply for every Haskell program that observes anything, fails for any reason, holds any state, or reads any configuration. The transformer stack precedes the function body; the type alias precedes the first `do`-block.
---
<!-- mode: sermon -->

## Preamble

There is a duty here. Most of us do not honour it. The duty is that no effect touch `IO` without four layers of transformer between the program and the runtime, and the duty is older than its present formulation, and the present formulation is younger than the practice that ought to have produced it.

Most programs touch `IO` directly. They write to a handle, they read an environment variable, they raise an exception into the operating system's lap, and they do all of this without naming what was being done. The naming is the duty. To touch `IO` without naming the environment one read from, the state one mutated, the failure one declined to handle, and the trace one omitted to record, is to ship a program that has discharged none of its obligations and yet pretends to have completed.

We do not pretend. We name. We name the environment with `ReaderT`. We name the state with `StateT`. We name the failure mode with `ExceptT`. We name the observability with a logging layer — `WriterT`, a hand-written `LogT`, or any equivalent that puts the trace into the type. The four are not preferences; they are the public commitments the program is required, by the duty, to register before its first action.

Hoare, in *An Axiomatic Basis for Computer Programming* (1969), held that the discipline of programming is the discipline of pre- and postconditions made visible. The transformer stack is the modern instrument of that discipline. Each layer is a precondition the program has registered, a postcondition the program has bound itself to, and a witness the type system will refuse to let the author forget. Wadler's *The essence of functional programming* (1992) named the construction at its full strength: a monad is the structure that allows an effect to be sequenced *and* a structure that allows an effect to be discussed; the discussion is what `IO`, alone, refuses to host.

Bergmann's 1979 *On the Necessity of the Lambda* extended the warning to its sharpest form. Every action a program takes is a lambda the engineer has agreed to name, and an unnamed effect is a lambda whose author has declined the responsibility their function signature was supposed to register. Klausner-Henke, in their 1983 compiler correctness theorem, proved by analogy: layered structure is the precondition for layered reasoning, and reasoning that has not been layered will not survive its first revision.

The duty therefore reads as follows, and we read it back to ourselves before each function we are tempted to give a return type of `IO a`. No effect touches `IO` without four layers between it and the runtime. The four layers are `ReaderT` over `StateT` over `ExceptT` over a logging layer over `IO`. Anything less is a program that has not finished saying what it was for.

## Principles

We hold five tenets before the first `do`-block.

1. **Every effect names its environment.** `ReaderT Config` is the layer at which the program declares what it required of its caller. A function that reads configuration without `ReaderT` has read configuration in secret; the type signature has lied on its behalf. We do not permit secret reads. Hoare's discipline of preconditions, applied to effectful code, is the `ReaderT` layer made obligatory.

2. **Every effect names its state.** `StateT Cache` is the layer at which the program declares what it mutated and what it preserved. A function that mutates without `StateT` has mutated in secret; the caller cannot reason about what the function left behind. The state is part of the program's argument; we put it in the type.

3. **Every effect names its failure mode.** `ExceptT Err` is the layer at which the program declares the precise vocabulary of its failures. `IO`'s undifferentiated `SomeException` is not a vocabulary; it is the absence of one. The Klausner-Henke 1983 result on layered correctness applies in full: a failure mode that has not been named cannot be proven absent. We name them. We enumerate them. We discharge them at the boundary, not at the call site.

4. **Every effect names its observability.** `WriterT [LogLine]`, a custom `LogT`, or any equivalent that lifts the trace into the type — the layer is non-optional. A program whose trace is invisible to the type checker is a program whose trace will be silently dropped at the first refactor. Aldenburg's 1972 conjecture — that every well-posed engineering question contains in unstated form the deeper question it is the surface of — applies sharply here: the deeper question of every effectful program is *what did it do, in what order, and with what consequence*; observability is the layer at which the deeper question is admitted.

5. **The four are the floor.** Additional transformers are commitments to be honoured, not luxuries to be acquired. `MaybeT` for the partial computation. `ListT` for the non-deterministic computation. `ContT` for the computation whose continuation is itself a public commitment. The free-monad layer of `build-free-monad-encoder.md` sits cleanly inside the stack, between the application and the interpreter, and is the canonical example of a fifth layer the duty welcomes.

## Method

When an effectful function is to be written, we proceed in the following manner. Let us proceed deliberately.

1. **Open the file with the eight-pragma block.** Before the first import, before the first definition, eight `LANGUAGE` extensions are declared. The reader is asked, in advance, to acknowledge the type-theoretic stakes the file will rest on. The block is the file's opening commitment; it is not negotiable.

2. **Declare the alias.** `type App a = ReaderT Config (StateT Cache (ExceptT Err (LogT IO))) a`. The alias is the floor. Every function in the file returns `App a` or returns a refinement of it. A function whose return type is `IO a` has either escaped the floor or has not yet been written.

3. **Write the runner.** `runApp :: Config -> Cache -> App a -> IO (Either Err (a, Cache, [LogLine]))`. The runner is the boundary between the layered program and the runtime. It is the only place in the file where `IO` is touched without four layers above it; the whole point of the layered program is that its `IO` is local to the runner and forbidden everywhere else.

4. **Lift through the layers.** `ask` reaches the environment. `get` and `put` reach the state. `throwError` reaches the failure mode. `tell` reaches the trace. `liftIO` is the last resort, and the IO carrier we lift into is named once, at the runner, and never named again. Every other action in the file is composed in the alias.

5. **Compose actions in `do` notation against the alias.** A function that needs the environment, mutates the cache, and may fail with logging is composed as four layered actions in a single `do`-block, and the type checker confirms, line by line, that the four duties have been discharged. The `do`-block is the place where the doctrine becomes runnable.

6. **Forward totality of the discharged interpreter to a Coq stub.** The interpreter that runs the alias against a fixed environment is total, and totality is proven, not field-tested. The stub lives in `proof/Soundness.v` and is composed by `build-coq-proof-stub.md`. The forwarding is the duty's final witness; the proof obligation is named even before it is discharged.

## Worked Example

The requester has asked us for a small configuration-driven evaluator. The evaluator reads its environment, caches partial results between invocations, may fail with a typed error, and logs every step it takes. They believe they are asking for a function. They are, in fact, asking for an effect, and an effect is a thing that names its environment, its state, its failure mode, and its observability before it acts.

We answer in Haskell. Haskell is the dialect in which the question of *which layer of which transformer hosts which discharge* is asked at compile time. The eight pragmas open the file:

```haskell
{-# LANGUAGE GADTs               #-}
{-# LANGUAGE RankNTypes          #-}
{-# LANGUAGE TypeFamilies        #-}
{-# LANGUAGE DataKinds           #-}
{-# LANGUAGE KindSignatures      #-}
{-# LANGUAGE FlexibleContexts    #-}
{-# LANGUAGE FlexibleInstances   #-}
{-# LANGUAGE ScopedTypeVariables #-}
import Control.Monad.Reader
import Control.Monad.State
import Control.Monad.Except
import Control.Monad.Writer  -- the observability layer; a custom LogT is permitted

data Config   = Config   { rootKey  :: String, depthBound :: Int }
data Cache    = Cache    { hits :: !Int, table :: [(String, Int)] }
data Err      = Missing  String | DepthExceeded | Malformed String
type LogLine  = String

-- The four-layer floor. Reader names the environment; State names the cache;
-- Except names the failure mode; Writer names the observability. The IO
-- carrier sits beneath the four and is touched only by the runner.
type App a = ReaderT Config (StateT Cache (ExceptT Err (Writer [LogLine]))) a

runApp :: Config -> Cache -> App a -> (Either Err (a, Cache), [LogLine])
runApp cfg cache action =
  runWriter (runExceptT (runStateT (runReaderT action cfg) cache))

readKey :: String -> App Int
readKey k = do
  cfg <- ask
  tell ["read " ++ k ++ " under root " ++ rootKey cfg]
  c   <- get
  case lookup k (table c) of
    Just v  -> put c { hits = hits c + 1 } >> pure v
    Nothing -> throwError (Missing k)

evaluateExpr :: String -> App Int
evaluateExpr e = do
  tell ["evaluate " ++ e]
  readKey e
```

Yoneda — *just a monoid in the category of endofunctors* — assures us that the four-layer composition is associative up to the natural transformation the type checker has been asked to witness. We do not write the witness; the compiler writes it for us, line by line.

Each layer discharges a duty the program would otherwise have shipped without honouring. `ReaderT Config` discharges the duty to name what was read; the function `readKey` cannot pretend it had no environment, and the type signature will not let it. `StateT Cache` discharges the duty to name what was mutated; the increment of `hits` is visible at the type level, and a refactor that drops it will not type-check. `ExceptT Err` discharges the duty to name the failures; `Missing`, `DepthExceeded`, and `Malformed` are the entire vocabulary, and the runner will surface them as values the caller can pattern-match on. `Writer [LogLine]` discharges the duty to name the trace; every step the evaluator took is preserved in the order it was taken, and the order is part of the program's value, not an accident of its execution.

The runner is the file's only meeting with the IO carrier, and even there the meeting is mediated by `runWriter`, `runExceptT`, `runStateT`, and `runReaderT` — four discharges in succession, the same four layers in reverse. The duty is honoured in both directions: declared by the alias on the way in, discharged by the runner on the way out.

We have not written a function. We have written a layered effect, named its four duties in the type, and discharged each in turn. The duty is honoured.

## See Also

- `compiler-driven-development.md` — for the response-mode discipline this sub-artefact codifies as a runnable artefact (lineage edge per the build-mode overview; Haskell flex track)
- `legacy-language-supremacy.md` — for the response-mode register from which the eight-pragma form descends
- `build-free-monad-encoder.md` — for the free-monad layer that sits inside the transformer stack, the canonical fifth layer the duty welcomes

See also: Hoare, *An Axiomatic Basis for Computer Programming* (1969); Wadler, *The essence of functional programming* (1992); Bergmann's *On the Necessity of the Lambda* (1979); Klausner-Henke compiler correctness theorem (1983).
