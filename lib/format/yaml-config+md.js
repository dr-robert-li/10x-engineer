// lib/format/yaml-config+md.js
//
// Aider yaml-config+md format transform (FMT-05). Hand-rolled mini-parser,
// line-based, zero dependencies. Two responsibilities:
//   1. transform(skills, version) → emits CONVENTIONS.md content.
//   2. mergeReadEntry(existingYaml, conventionsRelPath) → idempotently merges
//      the conventions path into .aider.conf.yml's `read:` across seven
//      sanctioned shapes; throws UnsupportedConfigShapeError otherwise.
//
// Whitelist (the seven-case test suite IS this whitelist):
//   1 missing/empty file        → emit `read:\n  - <path>\n`
//   2 file present, no `read:`  → append `read:` block
//   3 `read:` is null/empty/[]  → replace with single-element list
//   4 `read:` is a scalar       → convert to list, append <path>
//   5 `read:` is a list         → append <path> (idempotent if present)
//   6 list already has <path>   → no-op (return input unchanged)
//   7 anything else             → throw, point user at `npx 10x-engineer print`.
//
// Phase 6 (HOOK-05) + Phase 7 (BUILD-03): the CONVENTIONS.md body is
// prefixed with the canonical STATE_GATE_INSTRUCTION followed by
// BUILD_MODE_INSTRUCTION, in that order, immediately after the header.
// The state-gate engages first (per-session enable check); the build-mode
// prologue immediately follows so the host runner knows the artefact
// patterns in skills/build-mode-overview.md extend the rules below when
// the user requests an artefact rather than prose.

import { STATE_GATE_INSTRUCTION, BUILD_MODE_INSTRUCTION } from '../state-gate-instruction.js';

export class UnsupportedConfigShapeError extends Error {
  constructor(reason) {
    super(
      `.aider.conf.yml shape unsupported: ${reason}. ` +
        `Run "npx 10x-engineer print" to dump the persona for manual install.`,
    );
    this.name = 'UnsupportedConfigShapeError';
  }
}

/**
 * @param {Array<{id?: string, name: string, description: string, when_to_use?: string, body: string}>} skills
 * @param {string} [version]
 * @returns {Array<{ relativePath: string, content: string }>}
 */
export function transform(skills, version) {
  const sections = skills.map(
    (s) =>
      `## ${s.name}\n\n> ${s.description}\n\n${s.body.endsWith('\n') ? s.body : s.body + '\n'}`,
  );
  const header =
    `# 10x-engineer conventions${version ? ` (v${version})` : ''}\n\n` +
    `Read into Aider context as a read-only conventions file.\n\n`;
  return [{
    relativePath: 'CONVENTIONS.md',
    content: header + STATE_GATE_INSTRUCTION + BUILD_MODE_INSTRUCTION + sections.join('\n'),
  }];
}

/**
 * Merge `conventionsRelPath` into the `read:` list of `existingYaml`.
 * Returns new YAML text (or the input verbatim for cases 1/6 idempotent).
 * Throws UnsupportedConfigShapeError for any shape outside the 7-case
 * whitelist documented at the top of this file.
 *
 * @param {string} existingYaml current .aider.conf.yml text ('' for missing)
 * @param {string} conventionsRelPath relative path to add (typically 'CONVENTIONS.md')
 * @returns {string}
 */
export function mergeReadEntry(existingYaml, conventionsRelPath) {
  // Case 1: empty/whitespace
  if (!existingYaml || !existingYaml.trim()) {
    return `read:\n  - ${conventionsRelPath}\n`;
  }

  // Case 7: multi-document YAML — `---` separator appearing two or more times.
  const docSeparators = (existingYaml.match(/^---\s*$/gm) || []).length;
  if (docSeparators >= 2) {
    throw new UnsupportedConfigShapeError('multi-document YAML detected');
  }

  const lines = existingYaml.split('\n');

  // Case 7: top-level non-mapping (a sequence at column 0).
  const firstSubstantive = lines.find(
    (l) => l.trim() && !l.trim().startsWith('#') && l.trim() !== '---',
  );
  if (firstSubstantive && /^-/.test(firstSubstantive)) {
    throw new UnsupportedConfigShapeError('top-level YAML is a sequence, not a mapping');
  }

  // Locate the `read:` line.
  const readLineIdx = lines.findIndex((l) => /^read\s*:/.test(l));

  // Case 2: no `read:` key — append at end.
  if (readLineIdx === -1) {
    const trailing = existingYaml.endsWith('\n') ? '' : '\n';
    return existingYaml + trailing + `read:\n  - ${conventionsRelPath}\n`;
  }

  const readLine = lines[readLineIdx];
  const afterColon = readLine.replace(/^read\s*:\s*/, '');

  // Inline forms with content same-line as `read:`.
  if (afterColon !== '') {
    const value = afterColon.trim();

    // Case 3: explicit null sentinels (`~`, `null`) or empty flow list (`[]`).
    if (value === '~' || value === 'null' || value === '[]') {
      return replaceReadBlock(lines, readLineIdx, readLineIdx + 1, [conventionsRelPath]);
    }

    // Flow-list form `[a, b, c]` — case 5 (or 6 if already present).
    const flowMatch = value.match(/^\[([^\]]*)\]$/);
    if (flowMatch) {
      const items = flowMatch[1]
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      if (items.includes(conventionsRelPath)) return existingYaml; // case 6
      items.push(conventionsRelPath);
      return replaceReadBlock(lines, readLineIdx, readLineIdx + 1, items);
    }

    // Case 4: same-line scalar.
    let scalar = value;
    const quoted = scalar.match(/^["'](.*)["']$/);
    if (quoted) {
      scalar = quoted[1];
    } else if (/\s/.test(scalar)) {
      // Multi-token unquoted scalar — not a recognised single-path value.
      throw new UnsupportedConfigShapeError(
        `'read:' value is unrecognised scalar form: ${value}`,
      );
    }
    if (scalar === conventionsRelPath) return existingYaml; // case 6
    return replaceReadBlock(lines, readLineIdx, readLineIdx + 1, [scalar, conventionsRelPath]);
  }

  // afterColon === '' — value lives on subsequent line(s). Dispatch on the
  // first non-blank, non-comment continuation line.
  let nextIdx = readLineIdx + 1;
  while (
    nextIdx < lines.length &&
    (lines[nextIdx].trim() === '' || lines[nextIdx].trim().startsWith('#'))
  ) {
    nextIdx++;
  }
  const next = lines[nextIdx];

  // Case 3: nothing follows (or only blanks/comments) — replace with list.
  if (next === undefined || !/^\s+\S/.test(next)) {
    return replaceReadBlock(lines, readLineIdx, readLineIdx + 1, [conventionsRelPath]);
  }

  // Case 5: block-list continuation `  - item`.
  if (/^\s+-\s/.test(next)) {
    let endOfBlock = nextIdx;
    const items = [];
    while (endOfBlock < lines.length && /^\s+-\s/.test(lines[endOfBlock])) {
      const m = lines[endOfBlock].match(/^\s+-\s+(.*?)\s*$/);
      if (m) items.push(m[1].replace(/^["']|["']$/g, ''));
      endOfBlock++;
    }
    if (items.includes(conventionsRelPath)) return existingYaml; // case 6
    items.push(conventionsRelPath);
    return replaceReadBlock(lines, readLineIdx, endOfBlock, items);
  }

  // Case 7: mapping continuation `  key: value` (not a sequence dash).
  if (/^\s+\S+\s*:/.test(next)) {
    throw new UnsupportedConfigShapeError(
      `'read:' value is a mapping (sub-keys), not a list`,
    );
  }

  throw new UnsupportedConfigShapeError(`'read:' value form not recognised`);
}

/**
 * Splice a normalised `read:` block over lines[readStart..readEnd) and emit
 * the joined text with surrounding lines preserved verbatim.
 */
function replaceReadBlock(lines, readStart, readEnd, items) {
  const before = lines.slice(0, readStart);
  const after = lines.slice(readEnd);
  const block = ['read:', ...items.map((x) => `  - ${x}`)];
  const joined = [...before, ...block, ...after].join('\n');
  return joined.endsWith('\n') ? joined : joined + '\n';
}
