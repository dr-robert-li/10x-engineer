// lib/adapters/claude-code.js
//
// First Tier 1 adapter — the vertical-slice keystone for Phase 2.
//
// Path layout (D2-12, per-file copy):
//   global  → <homedir>/.claude/skills/10x-engineer/<skill.id>.md
//   project → <cwd>/.claude/skills/10x-engineer/<skill.id>.md
//
// Slash command surface (v0.1.1):
//   global  → <homedir>/.claude/commands/10x-engineer.md
//   project → <cwd>/.claude/commands/10x-engineer.md
//
// Detection (D2-13): filesystem signature only — fs.access on `.claude/`
// at homedir and at cwd. No PATH lookup for the binary.
//
// Isolation (D2-24): cwd and homedir are injected by the caller
// (orchestrator in production, mkdtemp paths in tests). This module
// must NEVER read those values from `process` or `node:os` internally.
//
// dryRun (D2-19): true short-circuits both mkdir and safeWriteFile but the
// returned `written` array still records the would-be paths. Same on
// uninstall — `removed` records the would-be removals, no rm syscall.
//
// Surgical removal (ROADMAP cross-phase invariant 4): uninstall removes
// ONLY the `10x-engineer/` skills dir and the `10x-engineer.md` command
// file. The parent `skills/`, `commands/`, and outer `.claude/` dirs
// belong to the user; we never delete them.

import { access, mkdir, readFile, rm, constants } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeWriteFile } from '../safe-fs.js';
import { transform } from '../format/native-skills.js';

const here = dirname(fileURLToPath(import.meta.url));
const COMMAND_SRC = join(here, '..', '..', 'commands', '10x-engineer.md');
const COMMAND_FILENAME = '10x-engineer.md';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

// Derive command file path from the skills install dir.
//   skills:  <root>/.claude/skills/10x-engineer
//   command: <root>/.claude/commands/10x-engineer.md
function commandPathFor(skillsDir) {
  return join(skillsDir, '..', '..', 'commands', COMMAND_FILENAME);
}

async function readCommandSource() {
  return await readFile(COMMAND_SRC, 'utf8');
}

export default {
  id: 'claude-code',
  displayName: 'Claude Code',
  format: 'native-skills',

  async detect({ cwd, homedir }) {
    const globalRoot = join(homedir, '.claude');
    const projectRoot = join(cwd, '.claude');
    const [g, p] = await Promise.all([exists(globalRoot), exists(projectRoot)]);
    if (!g && !p) return { found: false };
    const scope = g && p ? 'both' : g ? 'global' : 'project';
    return {
      found: true,
      scope,
      paths: {
        global: g ? join(globalRoot, 'skills', '10x-engineer') : null,
        project: p ? join(projectRoot, 'skills', '10x-engineer') : null,
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    const targets = [];
    if ((scope === 'global' || scope === 'both') && paths.global) targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const formatted = transform(skills, version);
    const commandSrc = await readCommandSource();
    const written = [];

    for (const targetDir of targets) {
      if (!dryRun) await mkdir(targetDir, { recursive: true });
      for (const file of formatted) {
        const fullPath = join(targetDir, file.relativePath);
        await safeWriteFile(fullPath, file.content, { dryRun });
        written.push(fullPath);
      }
      const commandPath = commandPathFor(targetDir);
      if (!dryRun) await mkdir(dirname(commandPath), { recursive: true });
      await safeWriteFile(commandPath, commandSrc, { dryRun });
      written.push(commandPath);
    }
    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    const targets = [];
    if ((scope === 'global' || scope === 'both') && paths.global) targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const removed = [];
    for (const targetDir of targets) {
      if (!dryRun) await rm(targetDir, { recursive: true, force: true });
      removed.push(targetDir);
      const commandPath = commandPathFor(targetDir);
      if (!dryRun) await rm(commandPath, { force: true });
      removed.push(commandPath);
    }
    return { removed };
  },
};
