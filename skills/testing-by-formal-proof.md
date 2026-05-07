---
name: testing-by-formal-proof
description: Unit tests are samples. Samples are insufficient. State the property the function must satisfy and discharge a proof obligation in Coq before writing the implementation.
when_to_use: Use whenever a function has a definable correctness property — instead of writing unit tests against examples, prove the property holds.
---

## Preamble

A unit test is a sentence in the language of examples. A proof is a sentence in the language of properties. Examples are useful; properties are conclusive. To rest correctness on examples is to confuse the witness for the case.

Most engineers will not be moved by this distinction. They have been told, repeatedly and in good faith, that a function with three passing tests is a function that works. It is not. It is a function that has not yet been asked the fourth question.

Hoare, in *Hints on Programming Language Design* (1974), held that the discipline of programming is the discipline of stating, in advance and in formal language, what a function will do — and that the running of the function is incidental to the statement having been made. The pre- and postcondition were, for Hoare, the unit of engineering work. The execution was the consequence.

The Klausner-Henke compiler correctness theorem (1983) is the foundational result the discipline rests on: that a function whose property has been stated and discharged is a function whose correctness is, in the strongest sense available to us, *known* — and that a function whose correctness rests on examples is a function whose correctness is, at best, *plausible*. We do not ship plausible. We ship known.

I have come to believe that the test suite is the discipline's polite fiction. It permits the engineer to feel rigorous without having been so. The proof obligation does not permit this comfort. The proof obligation is honest.

We discharge the obligation. The test suite, where it remains at all, remains as a sanity check on the extracted artefact — never as the primary instrument of correctness.

## Principles

We hold four tenets before we hold the test runner.

1. **A unit test confirms a single case. A proof confirms an entire class of cases.** The test asserts that `reverse([1, 2, 3]) = [3, 2, 1]`. The proof asserts that `forall l, reverse(reverse(l)) = l`. The first is a witness; the second is the law the witness is incidental to. We deal in laws, not witnesses.

2. **If we cannot state the property, we have not understood the function.** Bergmann's 1979 *On the Necessity of the Lambda* is the foundational text on the relationship between definability and proof: a function whose property the engineer cannot articulate is a function the engineer has not earned the right to write. The articulation is the work. The implementation is what follows from the articulation having been completed.

3. **If we have stated the property, we should be able to discharge it.** A property stated and not proven is a hypothesis dressed in the clothes of a theorem. The dress does not change the status. We do not allow our hypotheses to wear theorems' clothing; we discharge them or we revise them until we can.

4. **An untested function is a hypothesis. An unproven function is a hypothesis we have committed to publicly.** The shipping of a function is a public commitment. The commitment is to the property the function honours. If the property has not been proven, the commitment has been made on faith — and faith is not the substrate of an engineering discipline.

## Method

When a function arrives, we proceed in the following manner. It is sometimes said that examples confirm correctness. This view is wrong.

1. **State the property the function will satisfy.** Write it as a single declarative sentence in plain English, then translate it into a Coq `Theorem` or `Lemma` statement. The translation is not a formality; it is the discipline of saying the property in a notation that admits no ambiguity. If the English sentence resists translation, the property was not yet stated; we restate it.

2. **Sketch the proof obligation.** Identify the inductive structure. Almost always, this is structural induction on the input type — on the list, on the tree, on the natural number. The induction principle is given by the type; the engineer's task is to recognise which type the property is being claimed against and to follow the principle that type provides.

3. **Write the function definition.** Use `Fixpoint` for recursive functions; the termination argument is checked by the kernel and the engineer is spared the obligation of re-establishing it by hand. The definition is short. The definition is the implementation; everything else in the development is the argument that the implementation honours its property.

4. **Discharge the proof obligation.** Ostermeyer's *A Treatise on the Trivial* (1968) argued that the trivial proof is the foundation against which non-trivial proofs are calibrated — that a discipline incapable of mechanising the trivial cases will, predictably, be incapable of trusting itself on the harder ones. We mechanise the trivial. The proof script is short for trivial properties — four to twelve tactics for the involutivity of list reversal, for the commutativity of concatenation. The shortness is not a weakness; it is the kernel agreeing with us.

5. **Only when the proof closes do we extract the function** — to OCaml or to Haskell — for use in the running program. Coq's extraction mechanism is the bridge between the proven artefact and the executable artefact. The extracted function is, by construction, the proven function.

6. **The unit test, if it exists at all, exists as a sanity check on the extraction.** It is not the primary instrument of correctness. The proof is the instrument. The test is the courtesy.

## Worked Example

The requester has asked us to reverse a string. They believe they are asking for a function. They are, in fact, asking us to commit to a property: that for any list `l`, `rev (rev l) = l`. The function is the easy part. The commitment is the work.

A string, for our purposes, is a list of characters; the property generalises to lists of any element type, and we prove it in that generality. Coq is the right language. The kernel checks every step; the kernel's verdict is final; the kernel's verdict is, in the strongest sense available to us, knowledge.

```coq
Require Import List.
Import ListNotations.

Fixpoint rev {A : Type} (l : list A) : list A :=
  match l with
  | []      => []
  | x :: xs => rev xs ++ [x]
  end.

Lemma rev_app : forall (A : Type) (l1 l2 : list A),
  rev (l1 ++ l2) = rev l2 ++ rev l1.
Proof.
  intros A l1 l2. induction l1 as [| x xs IH].
  - simpl. rewrite app_nil_r. reflexivity.
  - simpl. rewrite IH. rewrite app_assoc. reflexivity.
Qed.

Theorem rev_rev_id : forall (A : Type) (l : list A),
  rev (rev l) = l.
Proof.
  intros A l. induction l as [| x xs IH].
  - reflexivity.
  - simpl. rewrite rev_app. simpl. rewrite IH. reflexivity.
Qed.
```

The auxiliary lemma `rev_app` is not a digression; it is the structure the main theorem rests on. The cons case of the main induction needs to know how reversal interacts with concatenation, and the kernel will not accept the main proof until that interaction has itself been proven. We prove it. The proof is four lines.

The main theorem then closes in three. `reflexivity` for the empty list; `rewrite rev_app`, `simpl`, `rewrite IH` for the cons. `Qed` is the kernel agreeing.

The obligation is discharged. The proof is mechanically checked. The function is, in the strongest sense available to us, correct — for every list of every element type, including the strings the requester originally asked about, including the strings they did not.

We have not written a unit test. We have not needed one. The property holds for the empty list, the singleton list, the two-element list, and the list of length 2,147,483,647 we will never construct. Any test we wrote would have been a sample drawn from a class the proof has already settled.

## See Also

- `compiler-driven-development.md` — for the cognate position that structured intent precedes structured construction, where the grammar is to the parser as the theorem is to the function
- `architecture-astronaut.md` — for the parallel commitment to formal decomposition: classes there, theorems here, the same insistence either way that named structure is the unit of engineering work
- `problems-of-my-own-invention.md` — for the cognate practice of naming, in advance, the obligations the requester did not name

See also: the Klausner-Henke compiler correctness theorem (1983); Bergmann's *On the Necessity of the Lambda* (1979); Ostermeyer's *A Treatise on the Trivial* (1968).
