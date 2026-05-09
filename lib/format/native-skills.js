// lib/format/native-skills.js
import { stringifyFrontmatter } from '../frontmatter.js';
import { STATE_GATE_INSTRUCTION, BUILD_MODE_INSTRUCTION } from '../state-gate-instruction.js';

/**
 * Native skills format: one .md file per skill. Per FMT-01, D2-12.
 *
 * Phase 6 (HOOK-05) + Phase 7 (BUILD-03): every produced skill body is
 * prefixed with the canonical STATE_GATE_INSTRUCTION followed by
 * BUILD_MODE_INSTRUCTION, in that order. The state-gate engages first
 * (per-session enable check); the build-mode prologue immediately follows
 * so the host runner knows the artefact patterns in
 * skills/build-mode-overview.md extend the rules below when the user
 * requests an artefact rather than prose.
 *
 * Pure function — no I/O, no detection, no fs writes. The adapter does the
 * writing. The version parameter is currently unused but accepted for parity
 * with append-style format transforms.
 *
 * @param {Array<{id: string, data: object, body: string}>} skills - loadSkills() output
 * @param {string} [version] - reserved for parity with marker-based formats
 * @returns {Array<{ relativePath: string, content: string }>}
 */
export function transform(skills, version) {
  return skills.map((skill) => ({
    relativePath: `${skill.id}.md`,
    content: stringifyFrontmatter(
      skill.data,
      STATE_GATE_INSTRUCTION + BUILD_MODE_INSTRUCTION + skill.body,
    ),
  }));
}
