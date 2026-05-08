// lib/format/concat-md.js
//
// Concat-md format transform (FMT-04). Pure function — no I/O.
// Emits ONE concatenated markdown file containing every skill back-to-back,
// with a persona header. Targets harnesses where 10x-engineer fully owns
// the destination file (Continue). Markerless by design — uninstall is
// `unlink`, not `stripBlock`.

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
  return [{ relativePath: '10x-engineer.md', content: header + sections.join('\n') }];
}
