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

import { join } from 'node:path';
import { access, constants, mkdir, rm } from 'node:fs/promises';
import { commandExists, findAncestorWith } from '../detect.js';
import { transform as appendMarkersTransform } from '../format/append-markers.js';
import { replaceBlock, stripBlock } from '../markers.js';
import { safeWriteFile } from '../safe-fs.js';
import { loadCommands } from '../commands.js';

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

    return { removed };
  },
};
