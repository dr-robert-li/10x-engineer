// lib/adapters/tabnine.js
//
// Path source: https://docs.tabnine.com/main/getting-started/tabnine-agent/guidelines, verified 2026-05-08
//
// Tier 2 adapter — Tabnine. Single-file install at .tabnine/guidelines/10x-engineer.md.
// Markerless: destination is fully owned by us; uninstall unlinks the file
// directly. User-owned siblings under .tabnine/guidelines/ are untouched.
//
// Format: concat-md (FMT-04 — Plan 03-03). Single concatenated markdown file
// with persona header. Vendor recommends ≤500 lines per guideline file as a
// best practice; the canonical concatenated persona is ~1500 lines and the
// vendor doc does not document a failure mode for files exceeding the
// recommendation. We keep the single-file shape for inheritance consistency
// with continue.js (research §TIER2-05 Edge cases).
//
// Detection: filesystem only — fs.access on <homedir>/.tabnine/ and
// <cwd>/.tabnine/. No PATH lookup (Tabnine surfaces as an IDE plugin /
// agent, not a primary CLI binary; the .tabnine/ directory is the canonical
// per-user signal per vendor docs).
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
  id: 'tabnine',
  displayName: 'Tabnine',
  format: 'concat-md',

  async detect({ cwd, homedir }) {
    const globalDir = join(homedir, '.tabnine');
    const projectDir = join(cwd, '.tabnine');
    const [g, p] = await Promise.all([exists(globalDir), exists(projectDir)]);
    if (!g && !p) return { found: false };
    const scope = g && p ? 'both' : g ? 'global' : 'project';
    return {
      found: true,
      scope,
      paths: {
        global: g ? join(globalDir, 'guidelines', '10x-engineer.md') : null,
        project: p ? join(projectDir, 'guidelines', '10x-engineer.md') : null,
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
