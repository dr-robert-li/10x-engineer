// lib/state.js — runtime enable/disable state for the 10x-engineer persona.
//
// The state file lives at <homedir>/.10x-engineer/state.json. The persona
// itself (slash command bodies, output style preamble, skill bodies)
// reads this file at runtime to decide whether to engage. The file is
// optional — its absence is interpreted as `enabled: true` so a fresh
// install activates the methodology without further ceremony.
//
// Atomic writes use safe-fs.safeWriteFile (sibling tempfile + rename).
// homedir is injected so tests can drive the module against mkdtemp
// roots; production callers pass os.homedir().

import { mkdir, readFile, rm, rmdir, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { safeWriteFile } from './safe-fs.js';

export const STATE_DIR = '.10x-engineer';
export const STATE_FILENAME = 'state.json';

export function statePath({ homedir }) {
  return join(homedir, STATE_DIR, STATE_FILENAME);
}

/**
 * Read the runtime state. Returns `{ enabled: true }` when the file does
 * not exist. Malformed JSON also resolves to `{ enabled: true }` — the
 * persona defaults on so a corrupt state file does not silently disable
 * the install.
 *
 * @param {{ homedir: string }} ctx
 * @returns {Promise<{ enabled: boolean }>}
 */
export async function readState({ homedir }) {
  const file = statePath({ homedir });
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return { enabled: parsed.enabled !== false };
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err instanceof SyntaxError)) {
      return { enabled: true };
    }
    throw err;
  }
}

/**
 * Write the runtime state atomically. Creates the parent dir if missing.
 *
 * @param {{ homedir: string, enabled: boolean, dryRun?: boolean }} opts
 */
export async function writeState({ homedir, enabled, dryRun = false }) {
  const file = statePath({ homedir });
  if (!dryRun) await mkdir(join(homedir, STATE_DIR), { recursive: true });
  const body = JSON.stringify({ enabled: !!enabled }, null, 2) + '\n';
  await safeWriteFile(file, body, { dryRun });
  return { path: file };
}

/**
 * Remove the state file and its parent dir if the dir becomes empty.
 * Surgical: never touches anything else under homedir.
 *
 * @param {{ homedir: string, dryRun?: boolean }} opts
 * @returns {Promise<{ removed: string[] }>}
 */
export async function clearState({ homedir, dryRun = false }) {
  const file = statePath({ homedir });
  const dir = join(homedir, STATE_DIR);
  const removed = [];

  let fileExisted = false;
  try {
    await access(file, constants.F_OK);
    fileExisted = true;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  let dirExisted = false;
  try {
    await access(dir, constants.F_OK);
    dirExisted = true;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  if (fileExisted) {
    if (!dryRun) await rm(file, { force: true });
    removed.push(file);
  }

  // Only attempt to remove the parent dir if it existed AND is now empty.
  // rmdir errors with ENOTEMPTY on non-empty dirs and ENOENT on missing
  // ones; either is non-fatal for our intent (leave the user's dir alone).
  if (dirExisted) {
    try {
      if (!dryRun) await rmdir(dir);
      removed.push(dir);
    } catch (err) {
      if (err.code === 'ENOTEMPTY' || err.code === 'ENOENT') {
        // Don't claim removal if we couldn't actually remove. dryRun does
        // claim removal because the intent is to preview the would-be
        // operation.
        if (dryRun) removed.push(dir);
      } else {
        throw err;
      }
    }
    if (dryRun && !removed.includes(dir)) removed.push(dir);
  }

  return { removed };
}
