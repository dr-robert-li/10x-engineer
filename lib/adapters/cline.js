// lib/adapters/cline.js
//
// Path source: https://docs.cline.bot/features/cline-rules, verified 2026-05-07
//
// Tier 1 adapter — Cline. Project-only for v1 (Cline's global rules path is
// OS-specific: `~/Documents/Cline/Rules` on macOS/Linux/WSL,
// `Documents\Cline\Rules` on Windows; not stable enough to lock yet — defer
// to v2 enhancement).
//
// Format: native-skills (FMT-01, Phase 2). Reuses the shared transform.
// One .md file per skill into `<projectRoot>/.clinerules/10x-engineer/`.
//
// Detection: bounded ancestor walk for `.clinerules/`; halts at .git or homedir
// per D2-21.
//
// dryRun threads through both install/uninstall per D2-19. cwd and homedir are
// injected per D2-24 — never read from process or node:os here. The consent
// gate is centralised in lib/install.js.
//
// Surgical removal (ROADMAP cross-phase invariant 4): uninstall removes ONLY
// the `10x-engineer/` install dir under `.clinerules/`. The parent
// `.clinerules/` directory belongs to the user; siblings beside `10x-engineer/`
// are never touched.

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { findAncestorWith } from '../detect.js';
import { transform } from '../format/native-skills.js';

export default {
  id: 'cline',
  displayName: 'Cline',
  format: 'native-skills',

  async detect({ cwd, homedir }) {
    const projectRoot = await findAncestorWith(cwd, '.clinerules', homedir);
    if (!projectRoot) return { found: false };
    return {
      found: true,
      scope: 'project',
      paths: {
        global: null,
        project: join(projectRoot, '.clinerules', '10x-engineer'),
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
      if (!dryRun) await writeFile(fullPath, file.content);
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
