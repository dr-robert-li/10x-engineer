// lib/format/concat-md.js
//
// Concat-md format transform (FMT-04). Pure function — no I/O.
// Emits ONE concatenated markdown file containing every skill back-to-back,
// with a persona header. Targets harnesses where 10x-engineer fully owns
// the destination file. Markerless by design — uninstall is `unlink`,
// not `stripBlock`.
//
// Phase 6 (HOOK-05): the body is prefixed with the canonical
// STATE_GATE_INSTRUCTION immediately after the persona header, so the
// runtime gate is the first thing the host encounters before reaching
// any methodology content.

import { STATE_GATE_INSTRUCTION } from '../state-gate-instruction.js';

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
    content: header + STATE_GATE_INSTRUCTION + sections.join('\n'),
  }];
}
