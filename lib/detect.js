// lib/detect.js — parallel-fan-out detection + bounded ancestor walk.
//
// Two exports:
//   - detectAll(ctx)        runs every adapter's detect() concurrently and
//                           returns three buckets. One adapter throwing
//                           never poisons the batch. Per ORC-01 / ORC-02 / D2-20.
//   - findAncestorWith(...) walks upward from startDir looking for a marker,
//                           halting at the first .git boundary or at homedir.
//                           Per ORC-04 / D2-21.

import { access, constants } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import adapters from './adapters/index.js';

/**
 * Run every adapter's detect() concurrently. One throw never poisons the batch.
 *
 * @param {{ cwd: string, homedir: string }} ctx
 * @returns {Promise<{
 *   found:    Array<{ adapter, scope, paths }>,
 *   notFound: Array<{ adapter }>,
 *   errored:  Array<{ adapter, error }>,
 * }>}
 */
export async function detectAll(ctx) {
  // Snapshot the registry length at fan-out time so a concurrent push
  // during the await does not desynchronise the settled-array indexing.
  const snapshot = adapters.slice();
  const settled = await Promise.allSettled(
    snapshot.map(async (adapter) => ({
      adapter,
      result: await adapter.detect(ctx),
    })),
  );

  const found = [];
  const notFound = [];
  const errored = [];

  for (let i = 0; i < settled.length; i++) {
    const adapter = snapshot[i];
    const s = settled[i];
    if (s.status === 'rejected') {
      errored.push({ adapter, error: s.reason });
    } else if (s.value.result.found) {
      found.push({ adapter, ...s.value.result });
    } else {
      notFound.push({ adapter });
    }
  }

  return { found, notFound, errored };
}

/**
 * Check whether a path exists. ENOENT → false; other errors propagate.
 */
async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
}

/**
 * Walk up from startDir looking for a directory containing `markerName`.
 *
 * Two boundaries with intentionally different semantics:
 *
 *   - `.git` boundary: HARD STOP. When `.git` is found at the current level
 *     (and we're not searching for `.git` itself), the walk halts before
 *     examining the level for the marker. This prevents bleed from one
 *     project tree into a sibling under a shared parent.
 *
 *   - `homedir` boundary: INCLUSIVE STOP. The walk examines homedir for the
 *     marker, then halts. Homedir is a candidate; its parent is not.
 *
 * @param {string} startDir   absolute path to begin from
 * @param {string} markerName e.g. '.cursor', '.clinerules'
 * @param {string} homedir    absolute path of the upper bound
 * @returns {Promise<string|null>} the directory containing the marker, or null
 */
export async function findAncestorWith(startDir, markerName, homedir) {
  let current = resolve(startDir);
  const home = resolve(homedir);

  while (true) {
    // 1. .git boundary — halt the walk BEFORE examining this level for the
    //    marker. (Skip this check if the caller is literally searching for
    //    the marker '.git' — otherwise the boundary would mask the find.)
    if (markerName !== '.git' && await exists(join(current, '.git'))) {
      return null;
    }
    // 2. Marker check at this level.
    if (await exists(join(current, markerName))) {
      return current;
    }
    // 3. homedir boundary — inclusive: we examined homedir above; do not
    //    ascend past it.
    if (current === home) {
      return null;
    }
    // 4. Ascend. parent === current means we hit the filesystem root
    //    (e.g. '/' on POSIX, 'C:\\' on Windows) without crossing homedir.
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
