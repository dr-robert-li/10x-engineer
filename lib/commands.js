// lib/commands.js — single-source slash-command loader.
//
// The package ships exactly one slash-command source: commands/10x-engineer.md.
// Each harness adapter that supports user-defined slash commands re-emits this
// source in the harness's native shape (markdown body, prompt-only markdown,
// TOML, etc.). loadCommand returns the parsed fields every adapter needs.
//
// The frontmatter shape here is intentionally looser than lib/frontmatter.js —
// command files only carry `description`, not the full skill triplet. We do
// not reuse the strict skill parser; the rules differ.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '..', 'commands', '10x-engineer.md');

const FENCE_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const KEY_RE = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/;

export async function loadCommand() {
  const raw = await readFile(SOURCE, 'utf8');
  const m = raw.match(FENCE_RE);
  if (!m) {
    throw new Error('commands/10x-engineer.md: missing or malformed frontmatter fence');
  }
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line) continue;
    const km = line.match(KEY_RE);
    if (km) data[km[1]] = km[2].trim();
  }
  if (!data.description) {
    throw new Error('commands/10x-engineer.md: frontmatter missing description');
  }
  return {
    description: data.description,
    body: m[2],
    raw,
  };
}
