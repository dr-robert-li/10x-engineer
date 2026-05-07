// lib/frontmatter.js — strict 3-key YAML frontmatter parser + emitter.
//
// Allowed keys: name, description, when_to_use. No others.
// Single-line values only. No flow style ([], {}). No nesting.
// CRLF tolerant on the fence and the line split.
//
// D2-30 invariant (locked by test/frontmatter.test.js): every one of the
// 10 real Phase 1 skills/*.md files must parse without throwing.

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?\r?\n)---\r?\n([\s\S]*)$/;
const KEY_RE = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/;
const ALLOWED_KEYS = ['name', 'description', 'when_to_use'];
const ALLOWED_KEY_SET = new Set(ALLOWED_KEYS);

export class FrontmatterParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FrontmatterParseError';
  }
}

/**
 * Parse strict YAML frontmatter.
 *
 * @param {string} src — full file contents.
 * @returns {{ data: { name: string, description: string, when_to_use: string }, body: string }}
 * @throws {FrontmatterParseError} on missing fence, unknown key, missing key,
 *   duplicate key, malformed key:value line, or flow-style value.
 */
export function parseFrontmatter(src) {
  const m = src.match(FRONTMATTER_RE);
  if (!m) {
    throw new FrontmatterParseError(
      'missing or malformed frontmatter fence (---\\n...\\n---\\n)'
    );
  }

  const data = {};
  const lines = m[1].split(/\r?\n/).filter(l => l.length > 0);

  for (const line of lines) {
    const km = line.match(KEY_RE);
    if (!km) {
      throw new FrontmatterParseError(
        `malformed key:value line: ${JSON.stringify(line)}`
      );
    }
    const [, key, rawValue] = km;
    if (!ALLOWED_KEY_SET.has(key)) {
      throw new FrontmatterParseError(`unknown frontmatter key: ${key}`);
    }
    if (key in data) {
      throw new FrontmatterParseError(`duplicate frontmatter key: ${key}`);
    }
    if (rawValue.startsWith('[') || rawValue.startsWith('{')) {
      throw new FrontmatterParseError(
        `flow-style values not supported: ${key}`
      );
    }
    data[key] = rawValue.trim();
  }

  for (const required of ALLOWED_KEYS) {
    if (!(required in data)) {
      throw new FrontmatterParseError(`missing required key: ${required}`);
    }
  }

  return { data, body: m[2] };
}

/**
 * Emit frontmatter in canonical key order (name, description, when_to_use).
 * Inverse of parseFrontmatter for well-formed input — round-trips byte-identical
 * when the source already has keys in canonical order with single-space `: ` separator.
 *
 * @param {{ name: string, description: string, when_to_use: string }} data
 * @param {string} body — verbatim post-fence content.
 * @returns {string}
 */
export function stringifyFrontmatter(data, body) {
  const lines = ALLOWED_KEYS.map(k => `${k}: ${data[k]}`);
  return `---\n${lines.join('\n')}\n---\n${body}`;
}
