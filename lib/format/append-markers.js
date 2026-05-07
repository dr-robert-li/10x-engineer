// lib/format/append-markers.js
//
// Append-markers format transform (FMT-03). Pure function — no I/O.
// Concatenates the canonical persona with section headings, then wraps via
// wrapBlock so the output is BEGIN/END-marker-bounded and ready to drop into
// a user-owned single-instructions file via replaceBlock.
//
// The relativePath is '' on purpose — the destination file is user-owned and
// adapters supply the absolute path. This transform owns the content; the
// adapter owns the path and the merge.

import { wrapBlock } from '../markers.js';

/**
 * Append-markers transform: concatenate every skill body with a section
 * heading, wrap the whole thing in BEGIN/END markers via wrapBlock.
 *
 * Output is a single-element array. Adapters consume `result[0].content`
 * and call replaceBlock to merge it into the user-owned target file.
 *
 * Per FMT-03. Composes Phase 2 wrapBlock — version threading and trailing-
 * newline normalisation happen there.
 *
 * @param {Array<{id: string, name: string, description: string, when_to_use: string, body: string}>} skills
 * @param {string} [version] - passed through to wrapBlock; defaults to package.json
 * @returns {Array<{ relativePath: string, content: string }>}
 */
export function transform(skills, version) {
  const sections = skills.map(
    (s) => `## ${s.name}\n\n> ${s.description}\n\n${s.body.endsWith('\n') ? s.body : s.body + '\n'}`,
  );
  const persona =
    `# 10x-engineer persona\n\n` +
    `Concatenated skill set for harnesses that consume a single instructions file.\n\n` +
    sections.join('\n');
  const block = wrapBlock(persona, version);
  return [{ relativePath: '', content: block }];
}
