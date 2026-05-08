// lib/adapters/kilo-code.js
//
// Path source: https://kilo.ai/docs/agent-behavior/custom-rules, verified 2026-05-07
//
// Tier 1 adapter — Kilo Code. Project-scoped only for v1.
//
// PATH CHOICE: Kilo Code has migrated to `.kilo/rules/`; the legacy
// `.kilocode/rules/` is documented as backward-compat ("If `.kilocode/rules/`
// directories exist in your project, their contents are automatically
// included for backward compatibility"). We target the legacy path because
// (a) it works on every Kilo version including modern, (b) it matches the
// working brief, and (c) it lets us defer JSON manipulation of
// `~/.config/kilo/kilo.jsonc#instructions`. Future enhancement (v2):
// detect `.kilo/` first, fall back to `.kilocode/`.
//
// Format: native-skills (FMT-01, Phase 2). Same transform other per-file
// copy adapters use — one .md file per skill, content unchanged.
//
// Detection (D2-13): bounded ancestor walk via findAncestorWith — halts at
// the first .git boundary or at homedir. No global scope: Kilo's global
// config lives in `~/.config/kilo/kilo.jsonc#instructions` which requires
// JSON manipulation; deferred per the same v2 note above.
//
// Isolation (D2-24): cwd and homedir are injected by the caller. This
// module never reads from `process` or `node:os`.
//
// dryRun (D2-19): true short-circuits both mkdir/safeWriteFile and rm; the
// returned `written` / `removed` arrays still record the would-be paths.
//
// Surgical removal (ROADMAP cross-phase invariant 4): uninstall removes
// ONLY the `10x-engineer/` install dir. The parent `rules/` and the outer
// `.kilocode/` belong to the user; we never delete them.

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { findAncestorWith } from '../detect.js';
import { safeWriteFile } from '../safe-fs.js';
import { transform } from '../format/native-skills.js';

export default {
  id: 'kilo-code',
  displayName: 'Kilo Code',
  format: 'native-skills',

  async detect({ cwd, homedir }) {
    const projectRoot = await findAncestorWith(cwd, '.kilocode', homedir);
    if (!projectRoot) return { found: false };
    return {
      found: true,
      scope: 'project',
      paths: {
        global: null,
        project: join(projectRoot, '.kilocode', 'rules', '10x-engineer'),
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
