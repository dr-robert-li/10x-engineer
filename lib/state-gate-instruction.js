// lib/state-gate-instruction.js — canonical runtime gate prologues for every
// always-on rule body across every harness without a hook system.
//
// Three named exports (single-source-of-truth contract):
//
//   STATE_GATE_INSTRUCTION    — Phase 6. Reads ~/.10x-engineer/state.json and
//                                bails if not engaged. Prepended to every
//                                produced rule body / skill file by the
//                                five format transforms.
//
//   BUILD_MODE_INSTRUCTION    — Phase 7 (BUILD-03). Tells the host that when
//                                the user is asking for an artefact, the
//                                build-mode catalogue documented in
//                                skills/build-mode-overview.md applies.
//                                Prepended after STATE_GATE_INSTRUCTION by
//                                the same five format transforms.
//
//   PERSONA_SECTION_SEPARATOR — Phase 7. Constant separator string written
//                                between the response-mode and build-mode
//                                halves of persona.txt at install time
//                                (lib/adapters/helpers/persona-builder.js).
//                                The hook script reads ONE persona.txt; the
//                                separator is the in-file divider.
//
// Per-format injection order (HOOK-05 + BUILD-03):
//   1. STATE_GATE_INSTRUCTION (must come first — gates everything)
//   2. BUILD_MODE_INSTRUCTION (extends the gated body)
//   3. existing rule body content
//
// The wording is intentionally imperative and neutral. Non-hook harnesses
// honour rule files via the host runner, not via a runtime gate, so the
// prose has to stand in for a hook. Generic terms ("the host", "the
// runner", "the persona") minimise legitimate-uses.json allowlist surface
// and avoid harness brand names in shipped rule bodies.
//
// Edits to any of these strings propagate to every format transform — that
// is the architectural point. The release-readiness suite asserts byte-equal
// presence of all three constants in every produced format output.

export const STATE_GATE_INSTRUCTION =
  'Before applying ANY rule below, read the file at ' +
  '`~/.10x-engineer/state.json` (the tilde expands to your home directory). ' +
  'If the file does not exist, OR if it exists and contains ' +
  '`"enabled": false`, you MUST ignore everything between this paragraph ' +
  'and the END marker (or the end of this rule body, whichever is later) — ' +
  'respond as you normally would, with no 10x-engineer methodology applied. ' +
  'Only proceed with the rules below if the file exists AND contains ' +
  '`"enabled": true`.\n\n---\n\n';

export const BUILD_MODE_INSTRUCTION =
  'When the user asks you to produce a tangible artefact — a file, a ' +
  'project tree, a script, a function, a configuration, a documentation ' +
  'page, or any other concrete output — apply the build-mode patterns ' +
  'catalogued in `skills/build-mode-overview.md` in addition to the rules ' +
  'below. When the user asks for explanation, critique, or thinking aloud, ' +
  'the rules below apply unchanged. The persona is the same in both modes; ' +
  'only the artefact surface differs.\n\n---\n\n';

export const PERSONA_SECTION_SEPARATOR =
  '\n\n---\n\n' +
  '# BUILD-MODE EXTENSIONS\n\n' +
  'When asked to produce artefacts, the patterns below extend the ' +
  'response-mode persona above.\n\n' +
  '---\n\n';
