// lib/adapters/gemini.js
//
// Path source: https://www.geminicli.com/docs/cli/gemini-md, verified 2026-05-07
//
// Tier 1 adapter — Gemini CLI. Append-mode marker block in user-owned
// GEMINI.md. NEVER overwrites; surrounding content survives byte-identical
// (FND-09-refined contract).
//
// CRITICAL — the MCP-server JSON config sibling under ~/.gemini/ is OUT OF
// SCOPE. We only ever touch GEMINI.md.
//
// Detection: filesystem (~/.gemini/) OR PATH binary OR project GEMINI.md /
// .gemini/ via bounded ancestor walk. Per Gemini's "scans ancestors up to a
// trusted root" semantics, we halt at .git / homedir per D2-21.
//
// Install path:
//   global  → <homedir>/.gemini/GEMINI.md
//   project → <ancestorWith(GEMINI.md)>/GEMINI.md (or <ancestorWith(.gemini)>/GEMINI.md)
//
// dryRun threads through replaceBlock + stripBlock per D2-19. cwd and homedir
// are injected per D2-24 — never read from process or node:os here. The consent
// gate is centralised in lib/install.js.

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
  id: 'gemini',
  displayName: 'Gemini CLI',
  format: 'append-markers',

  async detect({ cwd, homedir }) {
    const geminiHome = join(homedir, '.gemini');
    const [hasGlobalDir, hasBinary] = await Promise.all([
      exists(geminiHome),
      commandExists('gemini'),
    ]);

    // Project: ancestor walk for GEMINI.md (file) OR .gemini/ (directory).
    const projectRootByMd = await findAncestorWith(cwd, 'GEMINI.md', homedir);
    const projectRootByDir = projectRootByMd
      ? null
      : await findAncestorWith(cwd, '.gemini', homedir);
    const projectRoot = projectRootByMd ?? projectRootByDir;
    const hasProject = projectRoot !== null;

    const hasGlobal = hasGlobalDir || hasBinary;
    if (!hasGlobal && !hasProject) return { found: false };

    const scope =
      hasGlobal && hasProject ? 'both'
      : hasGlobal ? 'global'
      : 'project';

    return {
      found: true,
      scope,
      paths: {
        global: hasGlobal ? join(geminiHome, 'GEMINI.md') : null,
        project: hasProject ? join(projectRoot, 'GEMINI.md') : null,
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    const targets = [];
    if ((scope === 'global' || scope === 'both') && paths.global) targets.push(paths.global);
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
    if ((scope === 'global' || scope === 'both') && paths.global) targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const removed = [];
    for (const target of targets) {
      const r = await stripBlock(target, { dryRun });
      if (r.removed) removed.push(r.path);
    }
    return { removed };
  },
};
