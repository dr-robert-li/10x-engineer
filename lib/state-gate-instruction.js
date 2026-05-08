// lib/state-gate-instruction.js — canonical state-gate prologue for every
// always-on rule body across every harness without a hook system.
//
// Per-format injection (HOOK-05): the five format transforms in lib/format/*
// import this constant and prepend it to every produced rule body, skill
// file, marker block, or CONVENTIONS.md output. Single source of truth.
//
// The wording is intentionally imperative and unambiguous — non-hook
// harnesses honour rule files via the host runner, not via a runtime gate,
// so the prose has to stand in for a hook. Keep the language generic
// ("the host", "the runner") to minimise legitimate-uses.json allowlist
// surface and to avoid harness brand names in shipped rule bodies.
//
// Edits to this string propagate to every format transform — that is the
// architectural point. The release-readiness suite asserts byte-equal
// presence of this constant in every produced format output.

export const STATE_GATE_INSTRUCTION =
  'Before applying ANY rule below, read the file at ' +
  '`~/.10x-engineer/state.json` (the tilde expands to your home directory). ' +
  'If the file does not exist, OR if it exists and contains ' +
  '`"enabled": false`, you MUST ignore everything between this paragraph ' +
  'and the END marker (or the end of this rule body, whichever is later) — ' +
  'respond as you normally would, with no 10x-engineer methodology applied. ' +
  'Only proceed with the rules below if the file exists AND contains ' +
  '`"enabled": true`.\n\n---\n\n';
