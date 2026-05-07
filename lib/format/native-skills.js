// lib/format/native-skills.js
import { stringifyFrontmatter } from '../frontmatter.js';

/**
 * Native skills format: one .md file per skill, content unchanged from the
 * Phase 1 source. Per FMT-01, D2-12.
 *
 * Pure function — no I/O, no detection, no fs writes. The adapter does the
 * writing. The version parameter is currently unused but accepted for parity
 * with append-style format transforms in Phase 3 that will embed it in their
 * marker block.
 *
 * @param {Array<{id: string, data: object, body: string}>} skills - loadSkills() output
 * @param {string} [version] - reserved for parity with marker-based formats
 * @returns {Array<{ relativePath: string, content: string }>}
 */
export function transform(skills, version) {
  return skills.map((skill) => ({
    relativePath: `${skill.id}.md`,
    content: stringifyFrontmatter(skill.data, skill.body),
  }));
}
