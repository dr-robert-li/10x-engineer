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
// Output style surface (v0.2.0):
//   global  → <homedir>/.claude/output-styles/10x-engineer.md
//   project → <cwd>/.claude/output-styles/10x-engineer.md
// The output style is the always-on enforcement surface; once selected
// in Claude Code (`/output-style 10x-engineer`) the persona applies to
// every turn until the user switches output styles.
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
// ONLY the `10x-engineer/` skills dir, the `10x-engineer.md` command
// file, and the `10x-engineer.md` output style file. The parent
// `skills/`, `commands/`, `output-styles/`, and outer `.claude/` dirs
// belong to the user; we never delete them.

import { access, mkdir, rm, constants } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { safeWriteFile } from '../safe-fs.js';
import { transform } from '../format/native-skills.js';
import { loadCommands } from '../commands.js';

const OUTPUT_STYLE_FILENAME = '10x-engineer.md';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

// Derive command + output-style paths from the skills install dir.
//   skills:        <root>/.claude/skills/10x-engineer
//   commands:      <root>/.claude/commands/<id>.md
//   output style:  <root>/.claude/output-styles/10x-engineer.md
function commandsDirFor(skillsDir) {
  return join(skillsDir, '..', '..', 'commands');
}
function outputStylePathFor(skillsDir) {
  return join(skillsDir, '..', '..', 'output-styles', OUTPUT_STYLE_FILENAME);
}

// Build the always-on output style by concatenating every skill body
// under a single Claude Code output-style frontmatter block. The
// resulting file is selected at runtime via `/output-style 10x-engineer`.
function buildOutputStyle(skills) {
  const fm =
    '---\n' +
    'name: 10x-engineer\n' +
    'description: Always-on 10x-engineer methodology persona — earnest, over-engineered, philosophically front-loaded.\n' +
    '---\n\n';
  const sections = skills.map((sk) => {
    const heading = `## ${sk.name}\n\n`;
    const blurb = `> ${sk.description}\n\n`;
    const body = sk.body.endsWith('\n') ? sk.body : sk.body + '\n';
    return heading + blurb + body;
  });
  return fm + sections.join('\n');
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
    const commands = await loadCommands();
    const outputStyle = buildOutputStyle(skills);
    const written = [];

    for (const targetDir of targets) {
      if (!dryRun) await mkdir(targetDir, { recursive: true });
      for (const file of formatted) {
        const fullPath = join(targetDir, file.relativePath);
        await safeWriteFile(fullPath, file.content, { dryRun });
        written.push(fullPath);
      }
      const commandsDir = commandsDirFor(targetDir);
      if (!dryRun) await mkdir(commandsDir, { recursive: true });
      for (const cmd of commands) {
        const commandPath = join(commandsDir, `${cmd.id}.md`);
        await safeWriteFile(commandPath, cmd.raw, { dryRun });
        written.push(commandPath);
      }

      const outputStylePath = outputStylePathFor(targetDir);
      if (!dryRun) await mkdir(dirname(outputStylePath), { recursive: true });
      await safeWriteFile(outputStylePath, outputStyle, { dryRun });
      written.push(outputStylePath);
    }
    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    const targets = [];
    if ((scope === 'global' || scope === 'both') && paths.global) targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const commands = await loadCommands();
    const removed = [];
    for (const targetDir of targets) {
      if (!dryRun) await rm(targetDir, { recursive: true, force: true });
      removed.push(targetDir);
      const commandsDir = commandsDirFor(targetDir);
      for (const cmd of commands) {
        const commandPath = join(commandsDir, `${cmd.id}.md`);
        if (!dryRun) await rm(commandPath, { force: true });
        removed.push(commandPath);
      }
      const outputStylePath = outputStylePathFor(targetDir);
      if (!dryRun) await rm(outputStylePath, { force: true });
      removed.push(outputStylePath);
    }
    return { removed };
  },
};
