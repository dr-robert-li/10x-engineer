// lib/adapters/gemini.js
//
// Path source: https://www.geminicli.com/docs/cli/gemini-md, verified 2026-05-07
//
// Tier 1 adapter — Gemini CLI. Append-mode marker block in user-owned
// GEMINI.md. NEVER overwrites; surrounding content survives byte-identical
// (FND-09-refined contract).
//
// v0.1.2 also writes a slash-command file in TOML at:
//   global  → <homedir>/.gemini/commands/10x-engineer.toml
//   project → <projectRoot>/.gemini/commands/10x-engineer.toml
//
// Gemini resolves /<name> by reading those TOML files. The command source
// (commands/10x-engineer.md) is re-emitted as TOML with `description = "..."`
// and `prompt = """..."""`; the canonical $ARGUMENTS placeholder rewrites to
// Gemini's {{args}} substitution.
//
// CRITICAL — the MCP-server JSON config sibling under ~/.gemini/ is OUT OF
// SCOPE. We only ever touch GEMINI.md and commands/10x-engineer.toml.
//
// Detection: filesystem (~/.gemini/) OR PATH binary OR project GEMINI.md /
// .gemini/ via bounded ancestor walk. Per Gemini's "scans ancestors up to a
// trusted root" semantics, we halt at .git / homedir per D2-21.
//
// Install path (instructions):
//   global  → <homedir>/.gemini/GEMINI.md
//   project → <ancestorWith(GEMINI.md)>/GEMINI.md (or <ancestorWith(.gemini)>/GEMINI.md)
//
// dryRun threads through replaceBlock + stripBlock per D2-19. cwd and homedir
// are injected per D2-24 — never read from process or node:os here. The consent
// gate is centralised in lib/install.js.

import { dirname, join } from 'node:path';
import { access, constants, mkdir, rm } from 'node:fs/promises';
import { commandExists, findAncestorWith } from '../detect.js';
import { transform as appendMarkersTransform } from '../format/append-markers.js';
import { replaceBlock, stripBlock } from '../markers.js';
import { safeWriteFile } from '../safe-fs.js';
import { loadCommand } from '../commands.js';

const COMMAND_FILENAME = '10x-engineer.toml';

// TOML emitter for Gemini custom commands.
//   description: single-line basic string — escape backslashes, double quotes.
//   prompt:      triple-quoted multiline string — must not contain literal """.
function emitGeminiToml(command) {
  const description = command.description
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
  const body = command.body.replace(/\$ARGUMENTS\b/g, '{{args}}');
  if (body.includes('"""')) {
    throw new Error('command body contains triple-double-quote — incompatible with TOML emit');
  }
  return `description = "${description}"\nprompt = """\n${body}"""\n`;
}

// Sibling commands dir for the global GEMINI.md path.
//   <homedir>/.gemini/GEMINI.md → <homedir>/.gemini/commands/10x-engineer.toml
function globalCommandPathFor(geminiMdPath) {
  return join(dirname(geminiMdPath), 'commands', COMMAND_FILENAME);
}

// Project commands dir lives under <projectRoot>/.gemini/commands/, even when
// the project's GEMINI.md sits at <projectRoot>/GEMINI.md.
function projectCommandPathFor(geminiMdPath) {
  return join(dirname(geminiMdPath), '.gemini', 'commands', COMMAND_FILENAME);
}

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

export default {
  id: 'gemini',
  displayName: 'Gemini CLI',
  format: 'append-markers',

  async detect({ cwd, homedir }) {
    const geminiHome = join(homedir, '.gemini');
    const [hasGlobalDir, hasBinary] = await Promise.all([
      exists(geminiHome),
      commandExists('gemini'),
    ]);

    // Project: ancestor walk for GEMINI.md (file) OR .gemini/ (directory).
    const projectRootByMd = await findAncestorWith(cwd, 'GEMINI.md', homedir);
    const projectRootByDir = projectRootByMd
      ? null
      : await findAncestorWith(cwd, '.gemini', homedir);
    const projectRoot = projectRootByMd ?? projectRootByDir;
    const hasProject = projectRoot !== null;

    const hasGlobal = hasGlobalDir || hasBinary;
    if (!hasGlobal && !hasProject) return { found: false };

    const scope =
      hasGlobal && hasProject ? 'both'
      : hasGlobal ? 'global'
      : 'project';

    return {
      found: true,
      scope,
      paths: {
        global: hasGlobal ? join(geminiHome, 'GEMINI.md') : null,
        project: hasProject ? join(projectRoot, 'GEMINI.md') : null,
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    const targets = [];
    if ((scope === 'global' || scope === 'both') && paths.global) targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const [{ content: block }] = appendMarkersTransform(skills, version);
    const written = [];
    for (const target of targets) {
      const r = await replaceBlock(target, block, { dryRun });
      written.push(r.path);
    }

    // Slash-command TOML files. Lives next to GEMINI.md per scope.
    const command = await loadCommand();
    const tomlBody = emitGeminiToml(command);
    const tomlTargets = [];
    if ((scope === 'global'  || scope === 'both') && paths.global) {
      tomlTargets.push(globalCommandPathFor(paths.global));
    }
    if ((scope === 'project' || scope === 'both') && paths.project) {
      tomlTargets.push(projectCommandPathFor(paths.project));
    }
    for (const tomlPath of tomlTargets) {
      if (!dryRun) await mkdir(dirname(tomlPath), { recursive: true });
      await safeWriteFile(tomlPath, tomlBody, { dryRun });
      written.push(tomlPath);
    }

    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    const targets = [];
    if ((scope === 'global' || scope === 'both') && paths.global) targets.push(paths.global);
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const removed = [];
    for (const target of targets) {
      const r = await stripBlock(target, { dryRun });
      if (r.removed) removed.push(r.path);
    }

    const tomlTargets = [];
    if ((scope === 'global'  || scope === 'both') && paths.global) {
      tomlTargets.push(globalCommandPathFor(paths.global));
    }
    if ((scope === 'project' || scope === 'both') && paths.project) {
      tomlTargets.push(projectCommandPathFor(paths.project));
    }
    for (const tomlPath of tomlTargets) {
      if (!dryRun) await rm(tomlPath, { force: true });
      removed.push(tomlPath);
    }

    return { removed };
  },
};
