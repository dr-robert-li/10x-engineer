// lib/adapters/copilot-chat.js
//
// Path source: https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot, verified 2026-05-08
//
// Tier 2 adapter — GitHub Copilot Chat (workspace instructions). Append-mode:
// writes a marker block into a user-owned <projectRoot>/.github/copilot-instructions.md.
// NEVER overwrites; only the bytes between BEGIN and END markers are touched.
// Uninstall surgical-removes the block.
//
// PROJECT-ONLY by deliberate design (Pitfall 6 of the phase research):
// the vendor doc canonical path lives inside the repository (".github/
// copilot-instructions.md") and there is no documented user-config global
// equivalent. paths.global is therefore always null, and detect() never
// returns scope:'global' or scope:'both'.
//
// Detection signals (OR-semantics):
//   - <projectRoot>/.github/                          (every GitHub-hosted repo has it)
//   - <projectRoot>/.github/copilot-instructions.md   (direct hit)
//
// No PATH binary check — Copilot Chat is a VS Code / IDE feature; there is
// no CLI to detect on PATH (in contrast to codex.js, which gates a third
// detection path on a PATH-binary lookup).
//
// Project root is anchored at the .git boundary via findAncestorWith(cwd,
// '.git', homedir) ?? cwd (the Codex pattern). When no .git is found the
// caller's cwd is treated as the project root.
//
// dryRun threads through replaceBlock + stripBlock (Phase 2 — D2-19). cwd
// and homedir are injected by the caller (D2-24); never read from process
// or node:os internally.
//
// The pipeline mirrors codex.js project-half hands-off shape:
// appendMarkersTransform owns the content; replaceBlock and stripBlock own
// the merge semantics (BOM round-trip, CRLF tolerance, function-form
// replace, multi-BEGIN orphan guard, atomic temp+rename, self-cleanup of a
// file emptied by strip). This adapter is a thin orchestrator.

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
  id: 'copilot-chat',
  displayName: 'GitHub Copilot Chat',
  format: 'append-markers',

  async detect({ cwd, homedir }) {
    const projectRoot = (await findAncestorWith(cwd, '.git', homedir)) ?? cwd;
    const githubDir = join(projectRoot, '.github');
    const instructionsFile = join(githubDir, 'copilot-instructions.md');
    const [hasGithubDir, hasInstructionsFile] = await Promise.all([
      exists(githubDir),
      exists(instructionsFile),
    ]);

    if (!hasGithubDir && !hasInstructionsFile) {
      return { found: false };
    }

    return {
      found: true,
      scope: 'project',
      paths: {
        global: null,
        project: instructionsFile,
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    if (scope !== 'project' || !paths.project) return { written: [], skipped: [] };
    const [{ content: block }] = appendMarkersTransform(skills, version);
    const r = await replaceBlock(paths.project, block, { dryRun });
    return { written: [r.path], skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    if (scope !== 'project' || !paths.project) return { removed: [] };
    const r = await stripBlock(paths.project, { dryRun });
    return { removed: r.removed ? [r.path] : [] };
  },
};
