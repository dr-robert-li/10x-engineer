// lib/adapters/roo-code.js
//
// Path source: https://docs.roocode.com/features/custom-instructions, verified 2026-05-08
//
// Tier 2 adapter — Roo Code (VS Code, Cline-family fork). Project-scoped only
// for v1.
//
// PATH CHOICE: Vendor docs document both `<homedir>/.roo/rules/` (global) and
// `<projectRoot>/.roo/rules/` (project). We mirror Cline's project-only
// stance — consistency across the Cline-family fleet (cline, kilo-code,
// roo-code) and avoidance of the OS-specific HOMEDRIVE issues Cline flagged
// in Phase 3. Per Pitfall 11: `paths.global` is always null; `scope` is
// always `'project'`.
//
// Format: native-skills (FMT-01, Phase 2). One .md file per skill, content
// unchanged from the canonical Phase 1 source.
//
// Detection (D2-13, D2-21): bounded ancestor walk via findAncestorWith. Two
// markers in OR semantics — `.roo/` (modern, primary) tried first, then
// `.roorules` (legacy file-based fallback per vendor docs). Either marker
// matches anywhere up the tree. The walk halts at the first .git boundary
// or at homedir.
//
// Forward normalisation: install destination is ALWAYS
// `<projectRoot>/.roo/rules/10x-engineer/`, even when detection matched on
// the legacy `.roorules` marker. The adapter does not preserve legacy
// install layout — installing under the modern path is the explicit
// vendor-recommended migration target.
//
// Isolation (D2-24): cwd and homedir are injected by the caller. This
// module never reads from `process` or `node:os`.
//
// dryRun (D2-19): true short-circuits both mkdir/safeWriteFile and rm; the
// returned `written` / `removed` arrays still record the would-be paths.
//
// Surgical removal (ROADMAP cross-phase invariant 4): uninstall removes
// ONLY the `10x-engineer/` install dir under `.roo/rules/`. The parent
// `rules/`, the outer `.roo/`, and any sibling user-owned files or
// directories beside `10x-engineer/` are never touched.

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { findAncestorWith } from '../detect.js';
import { safeWriteFile } from '../safe-fs.js';
import { transform } from '../format/native-skills.js';

export default {
  id: 'roo-code',
  displayName: 'Roo Code',
  format: 'native-skills',

  async detect({ cwd, homedir }) {
    let projectRoot = await findAncestorWith(cwd, '.roo', homedir);
    if (!projectRoot) projectRoot = await findAncestorWith(cwd, '.roorules', homedir);
    if (!projectRoot) return { found: false };
    return {
      found: true,
      scope: 'project',
      paths: {
        global: null,
        project: join(projectRoot, '.roo', 'rules', '10x-engineer'),
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
