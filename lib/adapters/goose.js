// lib/adapters/goose.js
//
// Path source: https://block.github.io/goose/blog/2025/06/05/whats-in-my-goosehints-file/, verified 2026-05-08
//
// Tier 2 adapter — Goose. Append-mode: writes a marker block into a
// user-owned .goosehints file. NEVER overwrites; only the bytes between
// BEGIN and END markers are touched. Uninstall surgical-removes the block.
//
// The vendor blog post explicitly warns that .goosehints should be terse
// ("what's in my .goosehints file (and why it probably shouldn't be)"); we
// wrap our persona in a marker-bounded block so users can see and remove it.
//
// Detection: filesystem (~/.config/goose/) OR PATH binary (commandExists('goose'))
// OR project .goosehints anchored at the git root (or cwd if no .git).
// OR-semantics — any of the three returning true yields found:true.
//
// Install path:
//   global  → <homedir>/.config/goose/.goosehints
//   project → <gitRoot or cwd>/.goosehints
//
// dryRun threads through replaceBlock + stripBlock (Phase 2 — D2-19).
// cwd and homedir are injected by the caller (D2-24); never read from
// process or node:os internally.
//
// The pipeline is intentionally hands-off: appendMarkersTransform owns the
// content shape; replaceBlock and stripBlock own the merge semantics
// (BOM round-trip, CRLF tolerance, function-form replace, multi-BEGIN
// orphan guard, atomic temp+rename, self-cleanup of a file emptied by
// strip). This adapter is a thin orchestrator.

import { join } from 'node:path';
import { access, constants } from 'node:fs/promises';
import { commandExists, findAncestorWith } from '../detect.js';
import { transform as appendMarkersTransform } from '../format/append-markers.js';
import { replaceBlock, stripBlock } from '../markers.js';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

export default {
  id: 'goose',
  displayName: 'Goose',
  format: 'append-markers',

  async detect({ cwd, homedir }) {
    const gooseHome = join(homedir, '.config', 'goose');
    const [hasGlobalDir, hasBinary] = await Promise.all([
      exists(gooseHome),
      commandExists('goose'),
    ]);

    // Project: anchor on the .git boundary (or cwd if no .git is found
    // between cwd and homedir). Vendor docs allow .goosehints at multiple
    // levels of a monorepo; we install only at the project root.
    const projectRoot = (await findAncestorWith(cwd, '.git', homedir)) ?? cwd;
    const projectGoosehints = join(projectRoot, '.goosehints');
    const hasProjectGoosehints = await exists(projectGoosehints);

    if (!hasGlobalDir && !hasBinary && !hasProjectGoosehints) {
      return { found: false };
    }

    const scope =
      (hasGlobalDir || hasBinary) && hasProjectGoosehints ? 'both'
      : (hasGlobalDir || hasBinary) ? 'global'
      : 'project';

    return {
      found: true,
      scope,
      paths: {
        global: (hasGlobalDir || hasBinary) ? join(gooseHome, '.goosehints') : null,
        project: hasProjectGoosehints
          ? projectGoosehints
          : (scope === 'both' ? projectGoosehints : null),
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    const targets = [];
    if ((scope === 'global'  || scope === 'both') && paths.global)  targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const [{ content: block }] = appendMarkersTransform(skills, version);
    const written = [];
    for (const target of targets) {
      const r = await replaceBlock(target, block, { dryRun });
      written.push(r.path);
    }
    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    const targets = [];
    if ((scope === 'global'  || scope === 'both') && paths.global)  targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const removed = [];
    for (const target of targets) {
      const r = await stripBlock(target, { dryRun });
      if (r.removed) removed.push(r.path);
    }
    return { removed };
  },
};
