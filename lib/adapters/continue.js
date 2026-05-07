// lib/adapters/continue.js
//
// Path source: https://docs.continue.dev/customize/deep-dives/rules, verified 2026-05-07
//
// Tier 1 adapter — Continue. Single-file install at .continue/rules/10x-engineer.md.
// Markerless: destination is fully owned by us; uninstall unlinks the file
// directly. User-owned siblings under .continue/rules/ are untouched.
//
// Format: concat-md (FMT-04 — Plan 03-03). Single concatenated markdown file
// with persona header.
//
// Detection: filesystem only — fs.access on <homedir>/.continue/ and <cwd>/.continue/.
// No PATH lookup (Continue is a VS Code extension; no CLI binary to detect).
//
// dryRun threads through per D2-19. cwd and homedir are injected by the
// caller per D2-24; this module never reads them from the runtime ambient.

import { mkdir, writeFile, unlink, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { transform } from '../format/concat-md.js';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

export default {
  id: 'continue',
  displayName: 'Continue',
  format: 'concat-md',

  async detect({ cwd, homedir }) {
    const globalDir = join(homedir, '.continue');
    const projectDir = join(cwd, '.continue');
    const [g, p] = await Promise.all([exists(globalDir), exists(projectDir)]);
    if (!g && !p) return { found: false };
    const scope = g && p ? 'both' : g ? 'global' : 'project';
    return {
      found: true,
      scope,
      paths: {
        global: g ? join(globalDir, 'rules', '10x-engineer.md') : null,
        project: p ? join(projectDir, 'rules', '10x-engineer.md') : null,
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
      if (!dryRun) {
        await mkdir(join(target, '..'), { recursive: true });
        await writeFile(target, content);
      }
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
