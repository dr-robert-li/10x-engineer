// lib/adapters/codex.js
//
// Path source: https://developers.openai.com/codex/guides/agents-md, verified 2026-05-07
//
// Tier 1 adapter — Codex CLI. Append-mode: writes a marker block into a
// user-owned AGENTS.md. NEVER overwrites; only the bytes between BEGIN and
// END markers are touched. Uninstall surgical-removes the block.
//
// v0.1.2 also writes a slash-command file at ~/.codex/prompts/10x-engineer.md
// when the global home directory is present. Codex resolves /<name> against
// that prompts dir; user-scope only — Codex does not look at project-level
// prompts directories.
//
// CRITICAL — the sibling override file in ~/.codex/ documented by Codex
// is the user's escape hatch from our changes; never write to it. We
// only ever read/write the AGENTS.md file (and the prompts/<name>.md slash
// command file), never its sibling override.
//
// Detection: filesystem (~/.codex/) OR PATH binary (commandExists('codex'))
// OR project AGENTS.md anchored at the git root (or cwd if no .git).
// OR-semantics — any of the three returning true yields found:true.
//
// Install paths:
//   global  → <homedir>/.codex/AGENTS.md         (append-marker block)
//             <homedir>/.codex/prompts/10x-engineer.md  (slash command)
//   project → <gitRoot or cwd>/AGENTS.md         (append-marker block)
//
// dryRun threads through replaceBlock + stripBlock (Phase 2 — D2-19).
// cwd and homedir are injected by the caller (D2-24); never read from
// process or node:os internally.
//
// The pipeline is intentionally hands-off: appendMarkersTransform owns the
// content shape; replaceBlock and stripBlock own the merge semantics
// (BOM round-trip, CRLF tolerance, function-form replace, multi-BEGIN
// orphan guard, atomic temp+rename, self-cleanup of a file emptied by
// strip). This adapter is a thin orchestrator.
//
// Phase 6 (HOOK-04, HOOK-07): the global-scope install path also copies the
// runtime hook scripts (lib/hooks/session-start.mjs,
// lib/hooks/user-prompt-submit.mjs) into <homedir>/.codex/hooks/, writes a
// sibling persona.txt, and patches <homedir>/.codex/hooks.json with two
// hook entries (SessionStart, UserPromptSubmit) via
// lib/adapters/helpers/hook-config.js. The hook stdin/stdout schema is an
// event-keyed JSON map analogous to the upstream hook-contract shape used
// by the global-skills hook-installing adapter (vendor-verified) — the same
// hook scripts work for both surfaces. Hook install runs only when scope is
// 'global' or 'both'; project-scope installs do NOT patch hooks.json.

import { join } from 'node:path';
import { access, constants, mkdir, rm, copyFile, chmod } from 'node:fs/promises';
import { commandExists, findAncestorWith } from '../detect.js';
import { transform as appendMarkersTransform } from '../format/append-markers.js';
import { replaceBlock, stripBlock } from '../markers.js';
import { safeWriteFile } from '../safe-fs.js';
import { loadCommands } from '../commands.js';
import { mergeHookConfig, unmergeHookConfig } from './helpers/hook-config.js';
import { buildPersonaText } from './helpers/persona-builder.js';
import { loadBuildModeSkills } from '../skills.js';

// Codex prompts: body sent verbatim as a user message; positional args resolve
// to $1, $2… Frontmatter is dropped to avoid leaking yaml as text into the
// conversation.
function codexPromptBody(command) {
  return command.body.replace(/\$ARGUMENTS\b/g, '$1');
}

// Derive the prompts/<id>.md path from a homedir. Returns the path the
// adapter will write/read regardless of whether the home dir exists yet.
function promptPathFor(homedir, id) {
  return join(homedir, '.codex', 'prompts', `${id}.md`);
}

const HOOK_SCRIPT_FILENAMES = {
  sessionStart: '10x-engineer-session-start.mjs',
  userPromptSubmit: '10x-engineer-user-prompt-submit.mjs',
};
const PERSONA_FILENAME = 'persona.txt';
const HOOKS_CONFIG_FILENAME = 'hooks.json';

// Resolve the source path of a Phase-6 hook script in this package's lib/hooks/.
function packageHookSourcePath(scriptFilename) {
  const url = new URL(`../hooks/${scriptFilename}`, import.meta.url);
  return decodeURIComponent(url.pathname);
}

// Derive paths for hooks dir, hooks.json, and the two installed scripts from
// the global AGENTS.md path (<homedir>/.codex/AGENTS.md). Sibling-of-AGENTS.md
// is the .codex root.
function codexRootFor(globalAgentsMdPath) {
  return join(globalAgentsMdPath, '..');
}
function hooksDirFor(globalAgentsMdPath) {
  return join(codexRootFor(globalAgentsMdPath), 'hooks');
}
function hooksConfigPathFor(globalAgentsMdPath) {
  return join(codexRootFor(globalAgentsMdPath), HOOKS_CONFIG_FILENAME);
}
function installedHookPaths(globalAgentsMdPath) {
  const hooksDir = hooksDirFor(globalAgentsMdPath);
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

export default {
  id: 'codex',
  displayName: 'Codex CLI',
  format: 'append-markers',

  async detect({ cwd, homedir }) {
    const codexHome = join(homedir, '.codex');
    const [hasGlobalDir, hasBinary] = await Promise.all([
      exists(codexHome),
      commandExists('codex'),
    ]);

    // Project: Codex docs say it walks from git root downward checking
    // each level for AGENTS.md. Anchor on the .git boundary (or cwd if no
    // .git is found between cwd and homedir).
    const projectRoot = (await findAncestorWith(cwd, '.git', homedir)) ?? cwd;
    const projectAgentsMd = join(projectRoot, 'AGENTS.md');
    const hasProjectAgentsMd = await exists(projectAgentsMd);

    if (!hasGlobalDir && !hasBinary && !hasProjectAgentsMd) {
      return { found: false };
    }

    const scope =
      (hasGlobalDir || hasBinary) && hasProjectAgentsMd ? 'both'
      : (hasGlobalDir || hasBinary) ? 'global'
      : 'project';

    return {
      found: true,
      scope,
      paths: {
        global: (hasGlobalDir || hasBinary) ? join(codexHome, 'AGENTS.md') : null,
        project: hasProjectAgentsMd
          ? projectAgentsMd
          : (scope === 'both' ? projectAgentsMd : null),
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    const targets = [];
    if ((scope === 'global'  || scope === 'both') && paths.global)  targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const [{ content: block }] = appendMarkersTransform(skills, version);
    const written = [];
    for (const target of targets) {
      const r = await replaceBlock(target, block, { dryRun });
      written.push(r.path);
    }

    // Slash-command files — global only. paths.global is
    // <homedir>/.codex/AGENTS.md; siblings/prompts/<id>.md are its
    // peers. Skip on project-only scope. Three commands are installed:
    // 10x-engineer (engage), 10x-engineer-enable, 10x-engineer-disable.
    if ((scope === 'global' || scope === 'both') && paths.global) {
      const commands = await loadCommands();
      const promptsDir = join(paths.global, '..', 'prompts');
      if (!dryRun) await mkdir(promptsDir, { recursive: true });
      for (const cmd of commands) {
        const promptPath = join(promptsDir, `${cmd.id}.md`);
        await safeWriteFile(promptPath, codexPromptBody(cmd), { dryRun });
        written.push(promptPath);
      }
    }

    // ---- Phase 6: hook scripts + persona.txt + hooks.json patch (global only) ----
    if ((scope === 'global' || scope === 'both') && paths.global) {
      const hooksDir = hooksDirFor(paths.global);
      const installed = installedHookPaths(paths.global);

      if (!dryRun) await mkdir(hooksDir, { recursive: true });

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

      // Phase 7 (BUILD-02): persona assembly delegated to the shared helper;
      // build-mode catalogue (when build-*.md files exist) is concatenated
      // after the response-mode half with PERSONA_SECTION_SEPARATOR between.
      const buildSkills = await loadBuildModeSkills();
      await safeWriteFile(installed.persona, buildPersonaText(skills, buildSkills), { dryRun });
      written.push(installed.persona);

      const configPath = hooksConfigPathFor(paths.global);
      const r = await mergeHookConfig(configPath, {
        sessionStart: installed.sessionStart,
        userPromptSubmit: installed.userPromptSubmit,
      }, { dryRun });
      written.push(r.path);
    }

    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    const targets = [];
    if ((scope === 'global'  || scope === 'both') && paths.global)  targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const removed = [];
    for (const target of targets) {
      const r = await stripBlock(target, { dryRun });
      if (r.removed) removed.push(r.path);
    }

    // Slash-command files — global only.
    if ((scope === 'global' || scope === 'both') && paths.global) {
      const commands = await loadCommands();
      const promptsDir = join(paths.global, '..', 'prompts');
      for (const cmd of commands) {
        const promptPath = join(promptsDir, `${cmd.id}.md`);
        if (!dryRun) await rm(promptPath, { force: true });
        removed.push(promptPath);
      }
    }

    // ---- Phase 6: hook scripts + persona.txt + hooks.json unmerge (global only) ----
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

      const configPath = hooksConfigPathFor(paths.global);
      const r = await unmergeHookConfig(configPath, { dryRun });
      if (r.removed > 0 || r.written) removed.push(configPath);
    }

    return { removed };
  },
};
