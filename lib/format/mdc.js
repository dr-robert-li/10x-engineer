// lib/format/mdc.js
//
// Cursor .mdc format transform. Per FMT-02. Pure function — no I/O.
//
// Phase 6 (HOOK-05): the body of each .mdc file is prefixed with the
// canonical STATE_GATE_INSTRUCTION so the runtime gate engages on hosts
// without a hook system; rule-body gating is the only enforcement
// mechanism available there.
//
// Vendor-verified frontmatter shape (description, globs, alwaysApply) per
// https://cursor.com/docs/context/rules — verified 2026-05-07.

import { STATE_GATE_INSTRUCTION } from '../state-gate-instruction.js';

/**
 * @param {Array<{id: string, name: string, description: string, when_to_use: string, body: string}>} skills
 * @param {string} [version] accepted for parity with append-mode transforms; unused here
 * @returns {Array<{ relativePath: string, content: string }>}
 */
export function transform(skills, version) {
  return skills.map((skill) => {
    const fm =
      `---\n` +
      `description: ${escapeYamlScalar(skill.description)}\n` +
      `globs: ["**/*"]\n` +
      `alwaysApply: true\n` +
      `---\n`;
    return {
      relativePath: `${skill.id}.mdc`,
      content: fm + STATE_GATE_INSTRUCTION + skill.body,
    };
  });
}

// Local helper. Covers backslash, double-quote, colon, hash, and embedded
// newline cases without pulling in a full YAML emitter. Skill descriptions
// are short single-line strings; this is sufficient.
function escapeYamlScalar(s) {
  if (/[:\#\n\r"\\]/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}
