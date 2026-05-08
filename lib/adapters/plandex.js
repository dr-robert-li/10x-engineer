// lib/adapters/plandex.js
//
// Path source: https://docs.plandex.ai/core-concepts/context-management/, verified 2026-05-08
//
// Tier 2 adapter — Plandex. Project-file fallback per LOCKED USER DECISION #2
// (recorded at /gsd-discuss-phase for Phase 4): vendor docs document the
// `.plandex/` plan-state directory and `.plandexignore` filter, but as of the
// path-source date NEITHER documents a custom-system-prompt or persistent-
// rules filesystem path. The locked decision is to ship a project-file
// fallback at <cwd>/PLANDEX.md, fully owned by 10x-engineer, gated by a
// first-line heuristic for refuse-to-overwrite safety. This is NOT a "v1"
// holding pattern; we are NOT deferring to a future vendor surfacing of a
// rules path — PLANDEX.md is the install destination, full stop.
//
// Plandex's runtime requires the user to explicitly load context per plan
// via `plandex load <file>`. Our installer cannot trigger this on the
// user's behalf; we ship the file and emit an instructional note in the
// install result. The note is carried in a `notes` field on the result
// object — forward-compatible with the existing adapter contract because
// the orchestrator (lib/install.js) consumes `written` and `skipped` via
// object spread without enumerating result keys destructively.
//
// Detection signals (Pitfall 10 — PATH alone is INSUFFICIENT):
//   - <cwd>/.plandex/        directory created by `plandex new`
//   - <cwd>/PLANDEX.md       a prior install of ours (or a user-owned file)
//   - commandExists('plandex') is computed but does NOT gate detection;
//     a binary on PATH with no filesystem signal returns found:false.
//
// Format: concat-md (FMT-04). Single concatenated markdown file with the
// persona header `# 10x-engineer persona` — that exact header drives the
// first-line heuristic on install (refuse-to-overwrite) and uninstall
// (refuse-to-delete). The version suffix `(vX.Y.Z)` is part of the line
// but the heuristic checks for the prefix only.
//
// dryRun threads through per D2-19. cwd and homedir are injected by the
// caller per D2-24; this module never reads them from the runtime ambient.

import { mkdir, writeFile, unlink, access, readFile, constants } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { commandExists } from '../detect.js';
import { transform } from '../format/concat-md.js';

const OUR_HEADER_PREFIX = '# 10x-engineer persona';
const PLANDEX_FILENAME = 'PLANDEX.md';
const LOAD_INSTRUCTION =
  'Run `plandex load PLANDEX.md` to add the persona to your plan context.';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

/** First-line heuristic: a file is "ours" iff its first line begins with
 *  '# 10x-engineer persona'. ENOENT → null (caller decides). */
async function isOurFile(p) {
  try {
    const content = await readFile(p, 'utf8');
    return content.startsWith(OUR_HEADER_PREFIX);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

export default {
  id: 'plandex',
  displayName: 'Plandex',
  format: 'concat-md',

  async detect({ cwd /* homedir unused — project-only by locked decision */ }) {
    const projectPlandexDir = join(cwd, '.plandex');
    const projectPlandexMd = join(cwd, PLANDEX_FILENAME);
    const [hasDir, hasMd /* hasBinary */] = await Promise.all([
      exists(projectPlandexDir),
      exists(projectPlandexMd),
      // commandExists is computed for symmetry with other PATH-aware adapters
      // and to make the Pitfall 10 contract explicit: PATH membership is NOT
      // sufficient for detection. We discard the result; a future enhancement
      // could surface a "binary present but no project signal" hint.
      commandExists('plandex'),
    ]);
    // Pitfall 10: PATH alone is insufficient. Require at least one filesystem
    // signal for found:true.
    if (!hasDir && !hasMd) return { found: false };
    return {
      found: true,
      scope: 'project',
      paths: {
        global: null,
        project: projectPlandexMd,
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    if (scope !== 'project' || !paths || !paths.project) {
      return { written: [], skipped: [], notes: [] };
    }
    const target = paths.project;

    // Refuse-to-overwrite gate. If PLANDEX.md exists and its first line is
    // NOT ours, do not touch it. Record the skip; emit no notes (the user
    // should not be told to `plandex load` a file we did not write).
    if (await exists(target)) {
      const ours = await isOurFile(target);
      if (ours === false) {
        return {
          written: [],
          skipped: [
            `${target} exists with non-10x-engineer first line; refusing to overwrite`,
          ],
          notes: [],
        };
      }
    }

    const [{ content }] = transform(skills, version);
    if (!dryRun) {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    return {
      written: [target],
      skipped: [],
      notes: [LOAD_INSTRUCTION],
    };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    if (scope !== 'project' || !paths || !paths.project) {
      return { removed: [] };
    }
    const target = paths.project;

    // Refuse-to-delete gate. Mirrors install: only unlink files that match
    // the first-line heuristic.
    const ours = await isOurFile(target);
    if (ours !== true) return { removed: [] };

    if (!dryRun) {
      try { await unlink(target); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    return { removed: [target] };
  },
};
