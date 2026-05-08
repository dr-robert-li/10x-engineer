// lib/format/native-skills.js
import { stringifyFrontmatter } from '../frontmatter.js';
import { STATE_GATE_INSTRUCTION } from '../state-gate-instruction.js';

/**
 * Native skills format: one .md file per skill. Per FMT-01, D2-12.
 *
 * Phase 6 (HOOK-05): every produced skill body is prefixed with the
 * canonical STATE_GATE_INSTRUCTION prologue so the runtime gate engages
 * even on harnesses that read individual skill files standalone.
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
    content: stringifyFrontmatter(skill.data, STATE_GATE_INSTRUCTION + skill.body),
  }));
}
