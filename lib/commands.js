// lib/commands.js — slash-command loader.
//
// The package ships three slash-command sources under commands/:
//
//   commands/10x-engineer.md           — engage the methodology
//   commands/10x-engineer-enable.md    — write enabled:true to state.json
//   commands/10x-engineer-disable.md   — write enabled:false to state.json
//
// Each harness adapter that supports user-defined slash commands re-emits
// these sources in the harness's native shape (markdown body, prompt-only
// markdown, TOML, etc.).
//
// loadCommand() returns the engage-methodology command (back-compat with
// pre-v0.2.0 callers). loadCommands() returns all three as an array.
//
// The frontmatter shape here is intentionally looser than
// lib/frontmatter.js — command files only carry `description`, not the
// full skill triplet.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = join(here, '..', 'commands');

const SOURCES = [
  { id: '10x-engineer', filename: '10x-engineer.md' },
  { id: '10x-engineer-enable', filename: '10x-engineer-enable.md' },
  { id: '10x-engineer-disable', filename: '10x-engineer-disable.md' },
];

const FENCE_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const KEY_RE = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/;

function parse(raw, source) {
  const m = raw.match(FENCE_RE);
  if (!m) {
    throw new Error(`commands/${source}: missing or malformed frontmatter fence`);
  }
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line) continue;
    const km = line.match(KEY_RE);
    if (km) data[km[1]] = km[2].trim();
  }
  if (!data.description) {
    throw new Error(`commands/${source}: frontmatter missing description`);
  }
  return {
    description: data.description,
    body: m[2],
    raw,
  };
}

/** Load every command source. Returns an array in registry order. */
export async function loadCommands() {
  const out = [];
  for (const src of SOURCES) {
    const raw = await readFile(join(COMMANDS_DIR, src.filename), 'utf8');
    const parsed = parse(raw, src.filename);
    out.push({ id: src.id, ...parsed });
  }
  return out;
}

/** Back-compat: load only the engage-methodology command. */
export async function loadCommand() {
  const all = await loadCommands();
  return all[0];
}
