// lib/adapters/zed.js
//
// Path source: https://zed.dev/docs/ai/rules, verified 2026-05-08
//
// Tier 2 adapter — Zed AI. Append-mode: writes a marker block into a
// user-owned <projectRoot>/.rules. NEVER overwrites; only the bytes between
// BEGIN and END markers are touched. Uninstall surgical-removes the block.
//
// Project-only stance — paths.global is always null. Vendor doc states
// "Rules files are stored locally" but does not disclose the exact filesystem
// path of the Rules Library, so we cannot portably resolve a global target.
// If Zed publishes the Rules-Library path between now and v1.0, activate
// paths.global; until then, project-only is the safe contract.
//
// Detection: filesystem (<homedir>/.config/zed/) — the documented Zed config
// dir; its presence indicates Zed is INSTALLED. OR <projectRoot>/.rules
// exists. OR-semantics — either signal yields found:true. No PATH-binary
// check (Zed is a GUI editor).
//
// Install path:
//   global  → null (project-only)
//   project → <projectRoot>/.rules where projectRoot resolves via
//             findAncestorWith(cwd, '.git', homedir) ?? cwd
//
// The .rules file is freeform and user-owned. Vendor doc lists several
// recognised project-root rule files (.rules, .cursorrules, .windsurfrules,
// .clinerules, .github/copilot-instructions.md, AGENT.md, AGENTS.md,
// CLAUDE.md, GEMINI.md). We install only to .rules — Zed's namesake — and
// let other adapters own their respective files. Marker-bounded block is the
// only safe contract on a freeform user-owned file.
//
// dryRun threads through replaceBlock + stripBlock (Phase 2 — D2-19).
// cwd and homedir are injected by the caller (D2-24); never read from
// process or node:os internally.

import { join } from 'node:path';
import { access, constants } from 'node:fs/promises';
import { findAncestorWith } from '../detect.js';
import { transform as appendMarkersTransform } from '../format/append-markers.js';
import { replaceBlock, stripBlock } from '../markers.js';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

export default {
  id: 'zed',
  displayName: 'Zed AI',
  format: 'append-markers',

  async detect({ cwd, homedir }) {
    const zedConfigDir = join(homedir, '.config', 'zed');
    const projectRoot = (await findAncestorWith(cwd, '.git', homedir)) ?? cwd;
    const projectRulesFile = join(projectRoot, '.rules');

    const [hasZedConfig, hasProjectRules] = await Promise.all([
      exists(zedConfigDir),
      exists(projectRulesFile),
    ]);

    if (!hasZedConfig && !hasProjectRules) {
      return { found: false };
    }

    return {
      found: true,
      scope: 'project',
      paths: {
        global: null,
        project: projectRulesFile,
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    const targets = [];
    if (scope === 'project' && paths.project) targets.push(paths.project);

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
    if (scope === 'project' && paths.project) targets.push(paths.project);

    const removed = [];
    for (const target of targets) {
      const r = await stripBlock(target, { dryRun });
      if (r.removed) removed.push(r.path);
    }
    return { removed };
  },
};
