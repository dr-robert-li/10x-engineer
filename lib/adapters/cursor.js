// lib/adapters/cursor.js
//
// Path source: https://cursor.com/docs/context/rules, verified 2026-05-07
//
// Tier 1 adapter — Cursor. Project-scoped only — Cursor has no stable global
// rules directory (the docs document `~/.cursor/` as editor state, not a
// rules dir). Detection walks ancestors from cwd looking for `.cursor/`,
// halting at .git or homedir per D2-21.
//
// Format: mdc (FMT-02 — Plan 03-01). One .mdc file per skill.
//
// Round-trip: uninstall removes only `<projectRoot>/.cursor/rules/10x-engineer/`.
// The parent `.cursor/rules/` and any user-owned siblings inside it are
// preserved byte-identical (ROADMAP cross-phase invariant 4).
//
// dryRun threads through both install() and uninstall() per D2-19.
// cwd and homedir are injected per D2-24.

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { findAncestorWith } from '../detect.js';
import { safeWriteFile } from '../safe-fs.js';
import { transform } from '../format/mdc.js';

export default {
  id: 'cursor',
  displayName: 'Cursor',
  format: 'mdc',

  async detect({ cwd, homedir }) {
    const projectRoot = await findAncestorWith(cwd, '.cursor', homedir);
    if (!projectRoot) return { found: false };
    return {
      found: true,
      scope: 'project',
      paths: {
        global: null,
        project: join(projectRoot, '.cursor', 'rules', '10x-engineer'),
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    if (scope !== 'project' || !paths.project) return { written: [], skipped: [] };
    const targetDir = paths.project;
    const formatted = transform(skills, version);
    const written = [];
    if (!dryRun) await mkdir(targetDir, { recursive: true });
    for (const file of formatted) {
      const fullPath = join(targetDir, file.relativePath);
      await safeWriteFile(fullPath, file.content, { dryRun });
      written.push(fullPath);
    }
    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    if (scope !== 'project' || !paths.project) return { removed: [] };
    if (!dryRun) await rm(paths.project, { recursive: true, force: true });
    return { removed: [paths.project] };
  },
};
