// lib/adapters/pearai.js
//
// Path source: https://github.com/trypear/pearai-submodule and https://docs.continue.dev/customize/deep-dives/rules, verified 2026-05-08
//
// Tier 2 adapter — PearAI. Single-file install at .pearai/rules/10x-engineer.md.
// Markerless: destination is fully owned by us; uninstall unlinks the file
// directly. User-owned siblings under .pearai/rules/ are untouched.
//
// PearAI is a Continue submodule fork; rules architecture inherited verbatim.
// The structural shape mirrors lib/adapters/continue.js exactly — single-file
// concat-md, scope=both, identical install/uninstall surgery. Only the path
// string differs (.pearai/ instead of the upstream marker).
//
// Pitfall 4: PearAI MUST NOT cross-detect on the upstream marker dir. Each
// adapter detects on its own signature only. A user with both upstream and
// PearAI installed gets two distinct install paths — never a double-install
// into one harness. The path-source comment above legitimately cites the
// upstream docs as the rules-architecture reference; it is the only
// sanctioned mention of the upstream tool name in this file.
//
// Format: concat-md (FMT-04 — Plan 03-03). Single concatenated markdown file
// with persona header.
//
// Detection: filesystem only — fs.access on <homedir>/.pearai/ and <cwd>/.pearai/.
// No PATH lookup (PearAI is a VS Code-style extension; no CLI binary to detect).
//
// dryRun threads through per D2-19. cwd and homedir are injected by the
// caller per D2-24; this module never reads them from the runtime ambient.
//
// Path-source comment uses the two-URL ` and ` join precedent set by
// lib/adapters/aider.js (Phase 3 03-12). The plan-checker regex
// (cross-phase invariant 6) accepts that form.

import { mkdir, unlink, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { safeWriteFile } from '../safe-fs.js';
import { transform } from '../format/concat-md.js';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

export default {
  id: 'pearai',
  displayName: 'PearAI',
  format: 'concat-md',

  async detect({ cwd, homedir }) {
    const globalDir = join(homedir, '.pearai');
    const projectDir = join(cwd, '.pearai');
    const [g, p] = await Promise.all([exists(globalDir), exists(projectDir)]);
    if (!g && !p) return { found: false };
    const scope = g && p ? 'both' : g ? 'global' : 'project';
    return {
      found: true,
      scope,
      paths: {
        global: g ? join(homedir, '.pearai', 'rules', '10x-engineer.md') : null,
        project: p ? join(cwd, '.pearai', 'rules', '10x-engineer.md') : null,
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    const targets = [];
    if ((scope === 'global' || scope === 'both') && paths.global) targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const [{ content }] = transform(skills, version);
    const written = [];
    for (const target of targets) {
      if (!dryRun) await mkdir(join(target, '..'), { recursive: true });
      await safeWriteFile(target, content, { dryRun });
      written.push(target);
    }
    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    const targets = [];
    if ((scope === 'global' || scope === 'both') && paths.global) targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);
    const removed = [];
    for (const target of targets) {
      if (!dryRun) {
        try { await unlink(target); }
        catch (e) { if (e.code !== 'ENOENT') throw e; }
      }
      removed.push(target);
    }
    return { removed };
  },
};
