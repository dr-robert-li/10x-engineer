// lib/adapters/hermes-agent.js
//
// Path source:
//   https://hermes-agent.nousresearch.com/docs/user-guide/configuration
//   https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
//   https://hermes-agent.nousresearch.com/docs/guides/use-soul-with-hermes
// Verified 2026-05-10.
//
// Tier 1 adapter — Hermes Agent. Global-scope only.
//
// Hermes stores its instance data under ~/.hermes/ and loads user skills from
// ~/.hermes/skills/. Skills are directory-based: category/name/SKILL.md.
// Installing 10x-engineer as skills gives Hermes three slash-command surfaces:
//
//   ~/.hermes/skills/personas/10x-engineer/SKILL.md
//   ~/.hermes/skills/personas/10x-engineer-enable/SKILL.md
//   ~/.hermes/skills/personas/10x-engineer-disable/SKILL.md
//
// SOUL.md is deliberately not patched. Hermes documents SOUL.md as the
// durable global identity for the entire instance, while this package is an
// opt-in persona with a runtime enabled/disabled gate. Skills are the narrower
// and reversible surface.
//
// Detection: ~/.hermes/ exists OR `hermes` is on PATH. cwd and homedir are
// injected by the caller; this adapter never reads process.cwd() or os.homedir().
//
// Surgical removal: uninstall removes only the three skill directories above.
// Parent directories and user-owned sibling skills are never deleted.

import { access, constants, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { commandExists } from '../detect.js';
import { safeWriteFile } from '../safe-fs.js';
import { loadBuildModeSkills } from '../skills.js';
import { loadCommands } from '../commands.js';
import { buildPersonaText } from './helpers/persona-builder.js';
import {
  BUILD_MODE_INSTRUCTION,
  STATE_GATE_INSTRUCTION,
} from '../state-gate-instruction.js';

const CATEGORY = 'personas';
const SKILL_IDS = [
  '10x-engineer',
  '10x-engineer-enable',
  '10x-engineer-disable',
];

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

function skillDirFor(mainSkillDir, id) {
  return id === '10x-engineer'
    ? mainSkillDir
    : join(dirname(mainSkillDir), id);
}

function skillFileFor(mainSkillDir, id) {
  return join(skillDirFor(mainSkillDir, id), 'SKILL.md');
}

function renderHermesSkill({ id, description, body, version }) {
  const fm =
    '---\n' +
    `name: ${id}\n` +
    `description: ${description}\n` +
    `version: ${version || '0.0.0'}\n` +
    'metadata:\n' +
    '  hermes:\n' +
    '    tags: [persona, methodology, parody]\n' +
    `    category: ${CATEGORY}\n` +
    '---\n\n';
  const title = `# ${id}\n\n`;
  const normalizedBody = body.endsWith('\n') ? body : body + '\n';
  return fm + title + normalizedBody;
}

async function renderMainSkill(skills, version) {
  const buildSkills = await loadBuildModeSkills();
  const body =
    STATE_GATE_INSTRUCTION +
    BUILD_MODE_INSTRUCTION +
    buildPersonaText(skills, buildSkills);

  return renderHermesSkill({
    id: '10x-engineer',
    description: `10x-engineer methodology persona${version ? ` (v${version})` : ''}`,
    body,
    version,
  });
}

function renderCommandSkill(command, version) {
  return renderHermesSkill({
    id: command.id,
    description: command.description,
    body: command.body,
    version,
  });
}

export default {
  id: 'hermes-agent',
  displayName: 'Hermes Agent',
  format: 'hermes-skills',

  async detect({ homedir }) {
    const hermesRoot = join(homedir, '.hermes');
    const hasHome = await exists(hermesRoot);
    const hasBinary = await commandExists('hermes');
    if (!hasHome && !hasBinary) return { found: false };
    return {
      found: true,
      scope: 'global',
      paths: {
        global: join(hermesRoot, 'skills', CATEGORY, '10x-engineer'),
        project: null,
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    if (scope !== 'global' || !paths.global) return { written: [], skipped: [] };

    const commands = await loadCommands();
    const commandById = new Map(commands.map((cmd) => [cmd.id, cmd]));
    const files = [
      {
        id: '10x-engineer',
        content: await renderMainSkill(skills, version),
      },
      {
        id: '10x-engineer-enable',
        content: renderCommandSkill(commandById.get('10x-engineer-enable'), version),
      },
      {
        id: '10x-engineer-disable',
        content: renderCommandSkill(commandById.get('10x-engineer-disable'), version),
      },
    ];

    const written = [];
    for (const file of files) {
      const target = skillFileFor(paths.global, file.id);
      if (!dryRun) await mkdir(dirname(target), { recursive: true });
      await safeWriteFile(target, file.content, { dryRun });
      written.push(target);
    }
    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    if (scope !== 'global' || !paths.global) return { removed: [] };

    const removed = [];
    for (const id of SKILL_IDS) {
      const targetDir = skillDirFor(paths.global, id);
      if (!dryRun) await rm(targetDir, { recursive: true, force: true });
      removed.push(targetDir);
    }
    return { removed };
  },
};
