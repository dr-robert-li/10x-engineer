// lib/format/mdc.js
//
// Cursor .mdc format transform. Per FMT-02. Pure function — no I/O.
//
// Phase 6 (HOOK-05) + Phase 7 (BUILD-03): the body of each .mdc file is
// prefixed with the canonical STATE_GATE_INSTRUCTION followed by
// BUILD_MODE_INSTRUCTION, in that order. The state-gate engages first
// (per-session enable check); the build-mode prologue immediately follows
// so the host runner knows the artefact patterns in
// skills/build-mode-overview.md extend the rules below when the user
// requests an artefact rather than prose. Rule-body gating is the only
// enforcement mechanism available on hosts without a hook system.
//
// Vendor-verified frontmatter shape (description, globs, alwaysApply) per
// https://cursor.com/docs/context/rules — verified 2026-05-07.

import { STATE_GATE_INSTRUCTION, BUILD_MODE_INSTRUCTION } from '../state-gate-instruction.js';

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
      content: fm + STATE_GATE_INSTRUCTION + BUILD_MODE_INSTRUCTION + skill.body,
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
