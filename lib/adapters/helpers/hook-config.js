// lib/adapters/helpers/hook-config.js — JSON hook-config merge/unmerge.
//
// Generic helper consumed by every hook-installing adapter in the registry.
// Both consuming adapters write the same vendor-defined hook entry shape into
// their respective JSON config files; this helper abstracts the merge so the
// adapters do not duplicate the structured-edit logic.
//
//   {
//     "hooks": {
//       "SessionStart":     [ { "hooks": [{ type:"command", command:"...", timeout:5 }] } ],
//       "UserPromptSubmit": [ { "hooks": [{ type:"command", command:"...", timeout:5 }] } ]
//     }
//   }
//
// Idempotency contract: an existing entry whose nested `hooks[].command`
// string contains `10x-engineer` is treated as ours and skipped on merge,
// removed on unmerge. Foreign entries are preserved by content (not
// byte-identical — JSON re-serialization is permitted; see HOOK-09 carve-out
// in REQUIREMENTS.md for REL-13 scope clarification).
//
// dryRun threading: both helpers accept `{ dryRun }` and route the underlying
// write through safeWriteFile, which short-circuits on dryRun:true.

import { readFile } from 'node:fs/promises';
import { safeWriteFile } from '../../safe-fs.js';

const OUR_MARKER = '10x-engineer';
const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit'];

function entryIsOurs(entry) {
  if (!entry || !Array.isArray(entry.hooks)) return false;
  return entry.hooks.some(
    (h) => h && typeof h.command === 'string' && h.command.includes(OUR_MARKER),
  );
}

/**
 * Merge our hook entries into the JSON config at `configPath`. Idempotent:
 * if a same-event entry already references `10x-engineer`, no new entry is
 * appended.
 *
 * @param {string} configPath  path to the harness's JSON hook-config file
 * @param {{ sessionStart: string, userPromptSubmit: string }} commandPaths absolute paths to invoke
 * @param {{ dryRun?: boolean, timeout?: number }} [opts]
 * @returns {Promise<{ written: boolean, path: string }>}
 */
export async function mergeHookConfig(configPath, commandPaths, opts = {}) {
  const { dryRun = false, timeout = 5 } = opts;

  let settings = {};
  try {
    const raw = await readFile(configPath, 'utf8');
    settings = JSON.parse(raw);
    if (!settings || typeof settings !== 'object') settings = {};
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    // missing file → start with {}
  }

  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {};

  for (const event of HOOK_EVENTS) {
    if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
    const alreadyOurs = settings.hooks[event].some(entryIsOurs);
    if (alreadyOurs) continue;
    const command =
      event === 'SessionStart'
        ? `node "${commandPaths.sessionStart}"`
        : `node "${commandPaths.userPromptSubmit}"`;
    settings.hooks[event].push({
      hooks: [{ type: 'command', command, timeout }],
    });
  }

  const out = JSON.stringify(settings, null, 2) + '\n';
  return await safeWriteFile(configPath, out, { dryRun });
}

/**
 * Remove our hook entries from the JSON config at `configPath`. Foreign
 * entries are preserved by content. If no foreign entries remain at all,
 * the empty `hooks` block is removed; if the resulting JSON is `{}`, the
 * config file is rewritten as `{}` rather than deleted (the file may have
 * been user-created and we never delete it).
 *
 * @param {string} configPath
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {Promise<{ removed: number, path: string, written: boolean }>}
 */
export async function unmergeHookConfig(configPath, opts = {}) {
  const { dryRun = false } = opts;
  let settings;
  try {
    const raw = await readFile(configPath, 'utf8');
    settings = JSON.parse(raw);
    if (!settings || typeof settings !== 'object') {
      return { removed: 0, path: configPath, written: false };
    }
  } catch (e) {
    if (e.code === 'ENOENT') return { removed: 0, path: configPath, written: false };
    throw e;
  }

  let removed = 0;
  if (settings.hooks && typeof settings.hooks === 'object') {
    for (const event of HOOK_EVENTS) {
      if (Array.isArray(settings.hooks[event])) {
        const before = settings.hooks[event].length;
        settings.hooks[event] = settings.hooks[event].filter((entry) => !entryIsOurs(entry));
        removed += before - settings.hooks[event].length;
        if (settings.hooks[event].length === 0) delete settings.hooks[event];
      }
    }
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  }

  const out = JSON.stringify(settings, null, 2) + '\n';
  const r = await safeWriteFile(configPath, out, { dryRun });
  return { removed, path: configPath, written: r.written };
}
