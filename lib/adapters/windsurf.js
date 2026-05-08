// lib/adapters/windsurf.js
//
// Path source: https://docs.windsurf.com/windsurf/cascade/memories, verified 2026-05-08
//
// Tier 2 adapter — Windsurf / Codeium. Mixed-mode adapter: writes TWO
// artefacts in different formats, mirroring lib/adapters/opencode.js
// architecturally but with the formats inverted.
//
// PATH NOTE — VENDOR vs BRIEF: an earlier draft of the project brief listed
// `.windsurfrules` as the canonical project signature and `~/.codeium/` as
// the global one. Vendor docs (verified 2026-05-08) explicitly contradict
// the legacy signature: the canonical 2026 paths are `<project>/.windsurf/
// rules/*.md` (project) and `<homedir>/.codeium/windsurf/memories/
// global_rules.md` (global). `.windsurfrules` is retained ONLY as a
// DETECTION signal for legacy installs — it is NEVER an install target
// (Pitfall 5). Vendor doc verbatim: rules "are organized in `.windsurf/
// rules/` directories instead".
//
// Two artefacts:
//   1. Global rules: <homedir>/.codeium/windsurf/memories/global_rules.md
//      (append-markers block via replaceBlock — shared user file, NEVER
//      markerless-overwritten; Pitfall 12)
//   2. Project rules: <projectRoot>/.windsurf/rules/10x-engineer/<id>.md
//      (per-file copy via native-skills format — directory we own;
//      preserves user-owned siblings under .windsurf/rules/)
//
// Detection: filesystem signature only (no PATH check — Windsurf is a GUI
// editor, no canonical CLI binary).
//   global  → fs.access on <homedir>/.codeium/
//   project → findAncestorWith(cwd, '.windsurf', homedir)
//             OR findAncestorWith(cwd, '.windsurfrules', homedir) (legacy)
//
// Why mixed-mode and not single-mode-concat-md (Pitfall 12): global_rules.md
// is a single user-owned canonical file in the user's .codeium/windsurf/
// memories/ directory — it likely contains hand-written cascade memories the
// user values. A markerless single-file write would CLOBBER all of it.
// Append-markers is the only safe contract for that path.
//
// Why per-file at the project surface (Pitfall 5 / surgical removal): the
// project's .windsurf/rules/ directory is user-owned territory; we install
// into a 10x-engineer/-namespaced subdirectory and rm -rf only that subtree
// on uninstall. User-owned siblings beside 10x-engineer/ are never touched.
//
// dryRun threads through both halves per D2-19. cwd and homedir are injected
// per D2-24 — never read from process or node:os internally.

import { mkdir, writeFile, rm, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { findAncestorWith } from '../detect.js';
import { transform as appendMarkersTransform } from '../format/append-markers.js';
import { transform as nativeSkillsTransform } from '../format/native-skills.js';
import { replaceBlock, stripBlock } from '../markers.js';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

export default {
  id: 'windsurf',
  displayName: 'Windsurf',
  format: 'append-markers', // primary format identifier (global half); project half is native-skills

  async detect({ cwd, homedir }) {
    const codeiumDir = join(homedir, '.codeium');
    // Modern path first, legacy file fallback. Both routes resolve to the
    // SAME install destination (.windsurf/rules/10x-engineer/) — the legacy
    // signature is purely a heads-up that this is a Windsurf project.
    let projectRoot = await findAncestorWith(cwd, '.windsurf', homedir);
    if (!projectRoot) projectRoot = await findAncestorWith(cwd, '.windsurfrules', homedir);
    const hasCodeium = await exists(codeiumDir);
    if (!hasCodeium && !projectRoot) return { found: false };
    const scope =
      hasCodeium && projectRoot ? 'both'
      : hasCodeium ? 'global'
      : 'project';
    return {
      found: true,
      scope,
      paths: {
        global: hasCodeium
          ? join(codeiumDir, 'windsurf', 'memories', 'global_rules.md')
          : null,
        project: projectRoot
          ? join(projectRoot, '.windsurf', 'rules', '10x-engineer')
          : null,
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    const written = [];

    // Global half: append-markers block in global_rules.md (NEVER overwrites).
    // replaceBlock owns the merge semantics — guards orphan markers, preserves
    // BOM + CRLF, function-form replace so persona bodies containing $-escapes
    // survive byte-identical, atomic temp+rename via safeWriteFile.
    if ((scope === 'global' || scope === 'both') && paths.global) {
      const [{ content: block }] = appendMarkersTransform(skills, version);
      const r = await replaceBlock(paths.global, block, { dryRun });
      written.push(r.path);
    }

    // Project half: native-skills per-file copy (10x-engineer/ owns the dir).
    // mkdir-recursive handles the legacy-detection case where .windsurf/ does
    // not yet exist (only .windsurfrules was present); the new directory is
    // entirely 10x-engineer-owned and will be rm -rf'd on uninstall.
    if ((scope === 'project' || scope === 'both') && paths.project) {
      const formatted = nativeSkillsTransform(skills, version);
      if (!dryRun) await mkdir(paths.project, { recursive: true });
      for (const file of formatted) {
        const fullPath = join(paths.project, file.relativePath);
        if (!dryRun) await writeFile(fullPath, file.content);
        written.push(fullPath);
      }
    }

    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    const removed = [];

    // Global half: stripBlock — function-form replace; self-cleans the file
    // if the marker block was its only content.
    if ((scope === 'global' || scope === 'both') && paths.global) {
      const r = await stripBlock(paths.global, { dryRun });
      if (r.removed) removed.push(r.path);
    }

    // Project half: rm -rf the 10x-engineer/ subtree only. Surgical removal —
    // ROADMAP cross-phase invariant 4. Sibling files under .windsurf/rules/
    // are never touched.
    if ((scope === 'project' || scope === 'both') && paths.project) {
      if (!dryRun) await rm(paths.project, { recursive: true, force: true });
      removed.push(paths.project);
    }

    return { removed };
  },
};
