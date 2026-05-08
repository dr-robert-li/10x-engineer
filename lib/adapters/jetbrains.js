// lib/adapters/jetbrains.js
//
// Path source: https://www.jetbrains.com/help/ai-assistant/configure-project-rules.html, verified 2026-05-08
//
// Tier 2 adapter — JetBrains AI Assistant. Project-only single-file install at
// <projectRoot>/.aiassistant/rules/10x-engineer.md. Markerless: destination is
// fully owned by us; uninstall unlinks the file directly. User-owned siblings
// under .aiassistant/rules/ are untouched.
//
// Format: concat-md (FMT-04 — Plan 03-03). Single concatenated markdown file
// with persona header. JetBrains AI reads multiple .md files in
// .aiassistant/rules/; we own one namespaced file, the user can have siblings.
//
// Detection: filesystem only — .idea/ (every JetBrains-IDE-managed project has
// one) OR .aiassistant/ (a prior install of ours, or a user already configured
// AI rules). No PATH lookup; JetBrains IDEs are GUI applications and do not
// reliably register a CLI binary.
//
// LOCKED USER DECISION (Phase 4 CONTEXT — user-decision #3): retain the
// manual-enable note even though vendor docs (jetbrains.com, verified
// 2026-05-08) say JetBrains AI auto-enables project rules by default. The
// note is defensive against future vendor doc drift. Research §Pitfall 3
// recommended dropping the note; the user override stands. The note is
// emitted via the install result's `notes` array, which the orchestrator
// surfaces in CLI output. The literal text below is canonical and tested
// by Test 11 of the per-adapter test suite.
//
// dryRun threads through per D2-19. cwd and homedir are injected by the
// caller per D2-24; this module never reads them from the runtime ambient.

import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { findAncestorWith } from '../detect.js';
import { transform } from '../format/concat-md.js';

// Locked-decision constant — kept on its own line so the grep enforcement
// (`manual.enable` ≥ 2 hits) finds both the identifier and the literal value.
const MANUAL_ENABLE_NOTE =
  'JetBrains AI may require manual enable in some IDE versions.';

export default {
  id: 'jetbrains',
  displayName: 'JetBrains AI Assistant',
  format: 'concat-md',

  async detect({ cwd, homedir }) {
    // .idea/ is the primary signal (every JetBrains-IDE project has one).
    // .aiassistant/ is a secondary signal — present after a prior install
    // of ours or after a user has already added AI Assistant rules.
    const projectRoot =
      (await findAncestorWith(cwd, '.idea', homedir)) ??
      (await findAncestorWith(cwd, '.aiassistant', homedir)) ??
      null;
    if (!projectRoot) return { found: false };
    return {
      found: true,
      scope: 'project',
      paths: {
        global: null,
        project: join(projectRoot, '.aiassistant', 'rules', '10x-engineer.md'),
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    if (scope !== 'project' || !paths || !paths.project) {
      return { written: [], skipped: [], notes: [] };
    }
    const target = paths.project;
    const [{ content }] = transform(skills, version);
    if (!dryRun) {
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, content);
    }
    return {
      written: [target],
      skipped: [],
      notes: [MANUAL_ENABLE_NOTE],
    };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    if (scope !== 'project' || !paths || !paths.project) {
      return { removed: [] };
    }
    const target = paths.project;
    if (!dryRun) {
      try { await unlink(target); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    return { removed: [target] };
  },
};
