// lib/format/concat-md.js
//
// Concat-md format transform (FMT-04). Pure function — no I/O.
// Emits ONE concatenated markdown file containing every skill back-to-back,
// with a persona header. Targets harnesses where 10x-engineer fully owns
// the destination file. Markerless by design — uninstall is `unlink`,
// not `stripBlock`.
//
// Phase 6 (HOOK-05) + Phase 7 (BUILD-03): the body is prefixed with the
// canonical STATE_GATE_INSTRUCTION followed by BUILD_MODE_INSTRUCTION,
// in that order, immediately after the persona header. The state-gate
// engages first (per-session enable check); the build-mode prologue
// immediately follows so the host runner knows the artefact patterns in
// skills/build-mode-overview.md extend the rules below when the user
// requests an artefact rather than prose.

import { STATE_GATE_INSTRUCTION, BUILD_MODE_INSTRUCTION } from '../state-gate-instruction.js';

/**
 * @param {Array<{id: string, name: string, description: string, when_to_use: string, body: string}>} skills
 * @param {string} [version] embedded in header for traceability when provided
 * @returns {Array<{ relativePath: string, content: string }>}
 */
export function transform(skills, version) {
  const sections = skills.map(
    (s) => `## ${s.name}\n\n> ${s.description}\n\n${s.body.endsWith('\n') ? s.body : s.body + '\n'}`,
  );
  const header =
    `# 10x-engineer persona${version ? ` (v${version})` : ''}\n\n` +
    `Concatenated skill set. Produced by the 10x-engineer installer.\n\n`;
  return [{
    relativePath: '10x-engineer.md',
    content: header + STATE_GATE_INSTRUCTION + BUILD_MODE_INSTRUCTION + sections.join('\n'),
  }];
}
