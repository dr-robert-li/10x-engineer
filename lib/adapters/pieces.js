// lib/adapters/pieces.js
//
// Path source: https://docs.pieces.app/products/cli, verified 2026-05-08
//
// Tier 2 adapter — Pieces. Project-file fallback at <cwd>/PIECES.md.
//
// Vendor docs (verified 2026-05-08) cover `pieces config --editor x` and
// `pieces list models` but never disclose where Pieces persists its config or
// rules on disk. The brief's `<homedir>/.config/Pieces/` signature is plausible
// per XDG convention but unverified. We use it as a *secondary* detect signal
// only — it is never the install destination. The install target is a
// 10x-engineer-owned file at the project root: `<cwd>/PIECES.md`. Markerless;
// we own the destination outright. Uninstall is `unlink` gated by the
// first-line heuristic below.
//
// First-line heuristic safety contract (mirrors aider.js precedent — Phase 3
// 03-12). The destination filename `PIECES.md` is generic; a user might one
// day place their own `PIECES.md` in a project root. To avoid clobbering or
// deleting user content:
//
//   - install():   if PIECES.md exists AND its first line does not begin with
//                  `# 10x-engineer persona`, refuse to overwrite. Return
//                  { written: [], skipped: [<message>] }.
//   - uninstall(): if PIECES.md does not begin with `# 10x-engineer persona`
//                  (or does not exist), no-op. Return { removed: [] }.
//
// The heuristic relies on lib/format/concat-md.js emitting `# 10x-engineer
// persona${version ? ` (v${version})` : ''}\n` as the first line of every
// generated file. That invariant is load-bearing — if the concat-md header
// changes, this heuristic must be updated in lock-step.
//
// Detection: THREE OR-signals — `commandExists('pieces')` (PATH binary),
// `<homedir>/.config/Pieces/` filesystem, `<cwd>/PIECES.md` filesystem. Per
// Pitfall 10 (research §Common Pitfalls), PATH alone is INSUFFICIENT — at
// least one filesystem signal must be present to return found:true. This
// prevents pollution where a globally-installed `pieces` binary causes
// found:true in every random project directory.
//
// dryRun threads through per D2-19. cwd and homedir are injected by the
// caller per D2-24; this module never reads them from the runtime ambient.

import { mkdir, writeFile, unlink, readFile, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { commandExists } from '../detect.js';
import { transform } from '../format/concat-md.js';

const OUR_HEADER_PREFIX = '# 10x-engineer persona';
const PROJECT_FILENAME = 'PIECES.md';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

/**
 * First-line heuristic — `true` iff the file exists and its first non-blank
 * line begins with `# 10x-engineer persona`. Used to gate both overwrite on
 * install and unlink on uninstall.
 */
async function isOurFile(path) {
  try {
    const content = await readFile(path, 'utf8');
    return content.trimStart().startsWith(OUR_HEADER_PREFIX);
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
}

export default {
  id: 'pieces',
  displayName: 'Pieces',
  format: 'concat-md',

  async detect({ cwd, homedir }) {
    const piecesConfigDir = join(homedir, '.config', 'Pieces');
    const projectPiecesMd = join(cwd, PROJECT_FILENAME);
    const [hasConfigDir, hasProjectFile, hasBinary] = await Promise.all([
      exists(piecesConfigDir),
      exists(projectPiecesMd),
      commandExists('pieces'),
    ]);
    // Pitfall 10: PATH binary alone is insufficient — require at least one
    // filesystem signal to avoid polluting random project directories with
    // PIECES.md installs just because `pieces` is globally on PATH.
    void hasBinary;
    if (!hasConfigDir && !hasProjectFile) return { found: false };
    return {
      found: true,
      scope: 'project',
      paths: {
        global: null,
        project: projectPiecesMd,
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    if (scope !== 'project' || !paths || !paths.project) {
      return { written: [], skipped: [] };
    }
    const target = paths.project;

    // Refuse to overwrite a user-owned PIECES.md.
    if (await exists(target)) {
      if (!(await isOurFile(target))) {
        return {
          written: [],
          skipped: [`${target} exists with non-10x-engineer first line; refusing to overwrite`],
        };
      }
    }

    const [{ content }] = transform(skills, version);
    if (!dryRun) {
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, content);
    }
    return { written: [target], skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    if (scope !== 'project' || !paths || !paths.project) {
      return { removed: [] };
    }
    const target = paths.project;

    // Refuse to delete a user-owned PIECES.md (or one that does not exist).
    if (!(await isOurFile(target))) return { removed: [] };

    if (!dryRun) {
      try { await unlink(target); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    return { removed: [target] };
  },
};
