// lib/adapters/codex.js
//
// Path source: https://developers.openai.com/codex/guides/agents-md, verified 2026-05-07
//
// Tier 1 adapter — Codex CLI. Append-mode: writes a marker block into a
// user-owned AGENTS.md. NEVER overwrites; only the bytes between BEGIN and
// END markers are touched. Uninstall surgical-removes the block.
//
// CRITICAL — the sibling override file in ~/.codex/ documented by Codex
// is the user's escape hatch from our changes; never write to it. We
// only ever read/write the AGENTS.md file, never its sibling override.
//
// Detection: filesystem (~/.codex/) OR PATH binary (commandExists('codex'))
// OR project AGENTS.md anchored at the git root (or cwd if no .git).
// OR-semantics — any of the three returning true yields found:true.
//
// Install path:
//   global  → <homedir>/.codex/AGENTS.md
//   project → <gitRoot or cwd>/AGENTS.md
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
  id: 'codex',
  displayName: 'Codex CLI',
  format: 'append-markers',

  async detect({ cwd, homedir }) {
    const codexHome = join(homedir, '.codex');
    const [hasGlobalDir, hasBinary] = await Promise.all([
      exists(codexHome),
      commandExists('codex'),
    ]);

    // Project: Codex docs say it walks from git root downward checking
    // each level for AGENTS.md. Anchor on the .git boundary (or cwd if no
    // .git is found between cwd and homedir).
    const projectRoot = (await findAncestorWith(cwd, '.git', homedir)) ?? cwd;
    const projectAgentsMd = join(projectRoot, 'AGENTS.md');
    const hasProjectAgentsMd = await exists(projectAgentsMd);

    if (!hasGlobalDir && !hasBinary && !hasProjectAgentsMd) {
      return { found: false };
    }

    const scope =
      (hasGlobalDir || hasBinary) && hasProjectAgentsMd ? 'both'
      : (hasGlobalDir || hasBinary) ? 'global'
      : 'project';

    return {
      found: true,
      scope,
      paths: {
        global: (hasGlobalDir || hasBinary) ? join(codexHome, 'AGENTS.md') : null,
        project: hasProjectAgentsMd
          ? projectAgentsMd
          : (scope === 'both' ? projectAgentsMd : null),
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
