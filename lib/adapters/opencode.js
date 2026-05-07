// lib/adapters/opencode.js
//
// Path source: https://opencode.ai/docs/agents and https://opencode.ai/docs/rules/, verified 2026-05-07
//
// Tier 1 adapter — opencode. Mixed-mode adapter: writes TWO artefacts.
//
// PATH NOTE — VENDOR vs BRIEF: an earlier draft of the project brief
// referred to `~/.config/opencode/agent/` (singular). Vendor documentation
// (verified 2026-05-07) confirms the canonical path is plural — `agents/`.
// We follow the vendor docs; the brief was a typo. If we used singular,
// opencode would silently fail to load the agent. The architectural-lock
// test in test/adapter-opencode.test.js asserts the plural path; the
// per-plan grep gate (singular-quoted-agent guard) enforces it at PR review.
//
// Two artefacts:
//   1. Global agent definition: <homedir>/.config/opencode/agents/10x-engineer.md
//      (per-file copy with opencode frontmatter: description + subagent mode)
//   2. Project rules: <projectRoot>/AGENTS.md
//      (marker block via replaceBlock — append-markers format)
//
// Detection: filesystem signature only.
//   global  → fs.access on <homedir>/.config/opencode/
//   project → fs.access on <cwd>/opencode.json OR <cwd>/opencode.jsonc
//
// Uninstall removes BOTH (best-effort sequential; idempotent on re-run
// after partial failure — see Test 8 in adapter-opencode.test.js).
//
// dryRun threads through per D2-19 — both halves honour it. cwd and
// homedir are injected by the caller (D2-24); never read from process
// or node:os internally.
//
// The pipeline is intentionally hands-off: appendMarkersTransform owns the
// project-half content; replaceBlock and stripBlock own the merge semantics
// (BOM, CRLF tolerance, function-form replace, multi-BEGIN orphan guard,
// atomic temp+rename, self-cleanup of an emptied file). The renderer for
// the global agent file lives inline because no other adapter needs it.

import { mkdir, writeFile, unlink, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { transform as appendMarkersTransform } from '../format/append-markers.js';
import { replaceBlock, stripBlock } from '../markers.js';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

/**
 * Render the opencode global agent file: a single .md with opencode-specific
 * frontmatter (description plus subagent mode declaration) followed by the
 * concatenated persona body. The persona body uses the same section format
 * as concat-md but lives inline so this adapter does not depend on FMT-04.
 */
function renderOpencodeAgent(skills, version) {
  const sections = skills.map(
    (s) => `## ${s.name}\n\n> ${s.description}\n\n${s.body.endsWith('\n') ? s.body : s.body + '\n'}`,
  );
  const fm =
    `---\n` +
    `description: 10x-engineer persona — concatenated skill set${version ? ` (v${version})` : ''}\n` +
    `mode: subagent\n` +
    `---\n\n`;
  const body =
    `# 10x-engineer persona\n\n` +
    `Concatenated skill set for opencode subagent context.\n\n` +
    sections.join('\n');
  return fm + body;
}

export default {
  id: 'opencode',
  displayName: 'opencode',
  format: 'append-markers', // primary format identifier; also writes a per-file agent

  async detect({ cwd, homedir }) {
    const globalDir = join(homedir, '.config', 'opencode');
    const projectJson = join(cwd, 'opencode.json');
    const projectJsonc = join(cwd, 'opencode.jsonc');
    const [g, pj, pjc] = await Promise.all([
      exists(globalDir), exists(projectJson), exists(projectJsonc),
    ]);
    const hasProject = pj || pjc;
    if (!g && !hasProject) return { found: false };
    const scope = g && hasProject ? 'both' : g ? 'global' : 'project';
    return {
      found: true,
      scope,
      paths: {
        global: g ? join(globalDir, 'agents', '10x-engineer.md') : null,
        project: hasProject ? join(cwd, 'AGENTS.md') : null,
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    const written = [];

    if ((scope === 'global' || scope === 'both') && paths.global) {
      if (!dryRun) {
        await mkdir(join(paths.global, '..'), { recursive: true });
        await writeFile(paths.global, renderOpencodeAgent(skills, version));
      }
      written.push(paths.global);
    }

    if ((scope === 'project' || scope === 'both') && paths.project) {
      const [{ content: block }] = appendMarkersTransform(skills, version);
      const r = await replaceBlock(paths.project, block, { dryRun });
      written.push(r.path);
    }

    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    const removed = [];

    if ((scope === 'global' || scope === 'both') && paths.global) {
      if (!dryRun) {
        try { await unlink(paths.global); }
        catch (e) { if (e.code !== 'ENOENT') throw e; }
      }
      removed.push(paths.global);
    }

    if ((scope === 'project' || scope === 'both') && paths.project) {
      const r = await stripBlock(paths.project, { dryRun });
      if (r.removed) removed.push(r.path);
    }

    return { removed };
  },
};
