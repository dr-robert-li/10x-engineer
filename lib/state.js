// lib/state.js — runtime enable/disable state for the 10x-engineer persona.
//
// The state file lives at <homedir>/.10x-engineer/state.json. The persona
// (slash command bodies, output style preamble, skill bodies, and the
// session-start / user-prompt-submit hooks) reads this file at runtime to
// decide whether to engage. Default-off semantic (HOOK-01): a missing or
// malformed file resolves to `enabled: false`. Engaging the persona is
// always an explicit act — install never auto-engages.
//
// Atomic writes use safeWriteFlag (this module): sibling tempfile + rename,
// O_NOFOLLOW where supported, lstat-parent + lstat-target symlink refusal,
// mode 0600. Closes the local-attacker symlink-clobber surface on the
// predictable path `<homedir>/.10x-engineer/state.json`. homedir is injected
// so tests can drive the module against mkdtemp roots.

import { lstat, mkdir, open, rename, readFile, rm, rmdir, access, constants } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, join, basename } from 'node:path';

export const STATE_DIR = '.10x-engineer';
export const STATE_FILENAME = 'state.json';

export function statePath({ homedir }) {
  return join(homedir, STATE_DIR, STATE_FILENAME);
}

/**
 * Read the runtime state. Default-off (HOOK-01): a missing file, malformed
 * JSON, or any other read-time error resolves to `{ enabled: false }`. Strict
 * boolean check on the `enabled` field — `"true"` (string), `1`, or other
 * truthy values do NOT engage the persona.
 *
 * @param {{ homedir: string }} ctx
 * @returns {Promise<{ enabled: boolean }>}
 */
export async function readState({ homedir }) {
  const file = statePath({ homedir });
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return { enabled: parsed && parsed.enabled === true };
  } catch {
    return { enabled: false };
  }
}

/**
 * Symlink-safe atomic write of a flag file (HOOK-06). The single sanctioned
 * write path for `<homedir>/.10x-engineer/state.json` and any future flag
 * files on a predictable path. Steps:
 *   1. mkdir -p the parent dir
 *   2. lstat parent — refuse if it is a symlink
 *   3. lstat target — refuse if it exists and is a symlink
 *   4. open sibling tempfile with O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW (last is
 *      best-effort; missing on Windows)
 *   5. write, fchmod 0600 (best-effort on Windows), close
 *   6. rename(tmp, target) — atomic on same filesystem
 *
 * Returns `{ written: false, reason }` on symlink refusal so callers can
 * surface the condition; throws only on unexpected I/O errors.
 */
export async function safeWriteFlag(flagPath, content) {
  const flagDir = dirname(flagPath);
  await mkdir(flagDir, { recursive: true });

  // Refuse symlinked parent (attacker redirected the directory).
  try {
    const parentStat = await lstat(flagDir);
    if (parentStat.isSymbolicLink()) {
      return { written: false, reason: 'parent-is-symlink' };
    }
  } catch (e) {
    if (e.code !== 'ENOENT') return { written: false, reason: 'parent-stat-failed' };
  }

  // Refuse symlinked target (attacker pre-created a redirect at the path).
  try {
    const targetStat = await lstat(flagPath);
    if (targetStat.isSymbolicLink()) {
      return { written: false, reason: 'target-is-symlink' };
    }
  } catch (e) {
    if (e.code !== 'ENOENT') return { written: false, reason: 'target-stat-failed' };
  }

  const tempPath = join(
    flagDir,
    `${basename(flagPath)}.10x-engineer.${process.pid}.${Date.now()}`,
  );
  const O_NOFOLLOW =
    typeof fsConstants.O_NOFOLLOW === 'number' ? fsConstants.O_NOFOLLOW : 0;
  const flags =
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | O_NOFOLLOW;

  let fh;
  try {
    fh = await open(tempPath, flags, 0o600);
    await fh.writeFile(typeof content === 'string' ? content : String(content));
    try { await fh.chmod(0o600); } catch { /* best-effort on Windows */ }
  } finally {
    if (fh) await fh.close();
  }
  await rename(tempPath, flagPath);
  return { written: true, path: flagPath };
}

/**
 * Write the runtime state through safeWriteFlag (HOOK-06). dryRun:true
 * short-circuits before any filesystem syscall.
 *
 * @param {{ homedir: string, enabled: boolean, dryRun?: boolean }} opts
 * @returns {Promise<{ path: string, written: boolean, reason?: string }>}
 */
export async function writeState({ homedir, enabled, dryRun = false }) {
  const file = statePath({ homedir });
  if (dryRun) return { path: file, written: false };
  const body = JSON.stringify({ enabled: !!enabled }, null, 2) + '\n';
  return await safeWriteFlag(file, body);
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
