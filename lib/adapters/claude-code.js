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
//
// Phase 6 (HOOK-02, HOOK-03, HOOK-07): the global-scope install path also
// copies the runtime hook scripts (lib/hooks/session-start.mjs,
// lib/hooks/user-prompt-submit.mjs) into <homedir>/.claude/hooks/, writes
// a sibling persona.txt containing the concatenated skill bodies, and
// patches <homedir>/.claude/settings.json with two hook entries
// (SessionStart, UserPromptSubmit) via lib/adapters/helpers/hook-config.js.
// Hook install runs only when scope is 'global' or 'both' — project-scope
// installs do not patch settings.json (project settings.json is rare and
// the integration is documented as a per-user contract).
//
// Surgical uninstall removes the copied hook scripts, the persona.txt, and
// the settings.json hook entries (filtered by string-includes match on
// '10x-engineer' in command paths). Foreign hook entries survive by
// content (HOOK-09 carve-out: settings.json round-trip is content-equal,
// not byte-equal — JSON re-serialization is allowed).

import { access, mkdir, rm, constants, copyFile, chmod } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { safeWriteFile } from '../safe-fs.js';
import { transform } from '../format/native-skills.js';
import { loadCommands } from '../commands.js';
import { mergeHookConfig, unmergeHookConfig } from './helpers/hook-config.js';
import { buildPersonaText } from './helpers/persona-builder.js';
import { loadBuildModeSkills } from '../skills.js';

const OUTPUT_STYLE_FILENAME = '10x-engineer.md';

const HOOK_SCRIPT_FILENAMES = {
  sessionStart: '10x-engineer-session-start.mjs',
  userPromptSubmit: '10x-engineer-user-prompt-submit.mjs',
};
const PERSONA_FILENAME = 'persona.txt';
const SETTINGS_FILENAME = 'settings.json';

// Resolve the source path of a Phase-6 hook script in this package's lib/hooks/.
// Use a URL-relative path so the import is valid both when the package is
// installed under node_modules and when it is run from the source tree.
function packageHookSourcePath(scriptFilename) {
  // import.meta.url points at lib/adapters/claude-code.js — go up two and
  // into hooks/. We pass plain filenames (session-start.mjs / user-prompt-submit.mjs).
  const url = new URL(`../hooks/${scriptFilename}`, import.meta.url);
  return decodeURIComponent(url.pathname);
}

// Derive paths for hooks dir, settings.json, and the two installed scripts
// from the global skills install dir (<homedir>/.claude/skills/10x-engineer).
function claudeRootFor(skillsDir) {
  return join(skillsDir, '..', '..');
}
function hooksDirFor(skillsDir) {
  return join(claudeRootFor(skillsDir), 'hooks');
}
function settingsPathFor(skillsDir) {
  return join(claudeRootFor(skillsDir), SETTINGS_FILENAME);
}
function installedHookPaths(skillsDir) {
  const hooksDir = hooksDirFor(skillsDir);
  return {
    sessionStart: join(hooksDir, HOOK_SCRIPT_FILENAMES.sessionStart),
    userPromptSubmit: join(hooksDir, HOOK_SCRIPT_FILENAMES.userPromptSubmit),
    persona: join(hooksDir, PERSONA_FILENAME),
  };
}

// Phase 7 (BUILD-02): the persona.txt is now assembled by the shared
// persona-builder helper. When build-mode skill files are present
// (skills/build-*.md), they are concatenated after the response-mode persona
// with PERSONA_SECTION_SEPARATOR between the two halves. The session-start
// hook reads the same single persona.txt — no hook-side logic change.

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

    // ---- Phase 6: hook scripts + persona.txt + settings.json patch ----
    // Global-scope only. paths.global is <homedir>/.claude/skills/10x-engineer
    // when present. Project-scope installs do NOT touch settings.json.
    if ((scope === 'global' || scope === 'both') && paths.global) {
      const hooksDir = hooksDirFor(paths.global);
      const installed = installedHookPaths(paths.global);

      if (!dryRun) await mkdir(hooksDir, { recursive: true });

      // Copy the two hook scripts from this package's lib/hooks/ into the
      // user's ~/.claude/hooks/ with surgical-uninstall-friendly names
      // (10x-engineer-session-start.mjs / 10x-engineer-user-prompt-submit.mjs).
      const srcSessionStart = packageHookSourcePath('session-start.mjs');
      const srcUserPromptSubmit = packageHookSourcePath('user-prompt-submit.mjs');
      if (!dryRun) {
        await copyFile(srcSessionStart, installed.sessionStart);
        await copyFile(srcUserPromptSubmit, installed.userPromptSubmit);
        try { await chmod(installed.sessionStart, 0o755); } catch { /* best-effort on Windows */ }
        try { await chmod(installed.userPromptSubmit, 0o755); } catch { /* best-effort on Windows */ }
      }
      written.push(installed.sessionStart);
      written.push(installed.userPromptSubmit);

      // Write the runtime persona.txt — concatenated skill bodies the
      // session-start hook reads at runtime. Phase 7 (BUILD-02): persona
      // assembly is delegated to the shared persona-builder helper, which
      // appends the build-mode catalogue (when build-*.md files exist) after
      // the response-mode persona with PERSONA_SECTION_SEPARATOR between
      // halves; empty build set gracefully yields the response-mode persona
      // alone.
      const buildSkills = await loadBuildModeSkills();
      await safeWriteFile(installed.persona, buildPersonaText(skills, buildSkills), { dryRun });
      written.push(installed.persona);

      // Patch settings.json with the two hook entries (idempotent merge).
      const settingsPath = settingsPathFor(paths.global);
      const r = await mergeHookConfig(settingsPath, {
        sessionStart: installed.sessionStart,
        userPromptSubmit: installed.userPromptSubmit,
      }, { dryRun });
      written.push(r.path);
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

    // ---- Phase 6: hook scripts + persona.txt + settings.json unmerge ----
    if ((scope === 'global' || scope === 'both') && paths.global) {
      const installed = installedHookPaths(paths.global);
      if (!dryRun) {
        await rm(installed.sessionStart, { force: true });
        await rm(installed.userPromptSubmit, { force: true });
        await rm(installed.persona, { force: true });
      }
      removed.push(installed.sessionStart);
      removed.push(installed.userPromptSubmit);
      removed.push(installed.persona);

      const settingsPath = settingsPathFor(paths.global);
      const r = await unmergeHookConfig(settingsPath, { dryRun });
      if (r.removed > 0 || r.written) removed.push(settingsPath);
    }

    return { removed };
  },
};
