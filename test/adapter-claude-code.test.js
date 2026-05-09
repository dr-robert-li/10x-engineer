// test/adapter-claude-code.test.js — TEST-06 + TEST-07.
//
// Tests cover the full round-trip matrix for the Claude Code adapter:
//   1. detect: not found
//   2. detect: global only
//   3. detect: project only
//   4. detect: both
//   5. install + uninstall surgical-removal round-trip with user-owned sibling
//      proof — the load-bearing test for ROADMAP cross-phase invariant 4
//   6. idempotent re-install (no duplicates)
//   7. dryRun:true never touches disk; parent dir mtime unchanged
//   8. slash command file installs alongside skills and removes on uninstall
//
// Every test uses mkdtemp to build an isolated environment and threads cwd
// and homedir into the adapter (D2-24). The real ~/.claude is never read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readdir, stat, readFile, writeFile, copyFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import claudeCode from '../lib/adapters/claude-code.js';
import { loadSkills } from '../lib/skills.js';

/**
 * Build an isolated test environment. Creates separate cwd-root and homedir-root
 * directories under a single mkdtemp. Caller asks for global/project markers
 * via the `withGlobal` and `withProject` flags.
 */
async function makeEnv(t, { withGlobal, withProject }) {
  const root = await mkdtemp(join(tmpdir(), '10xe-cc-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (withGlobal)  await mkdir(join(homedir, '.claude'));
  if (withProject) await mkdir(join(cwd, '.claude'));
  return { root, homedir, cwd };
}

test('detect: no .claude/ anywhere → found:false', async (t) => {
  const env = await makeEnv(t, { withGlobal: false, withProject: false });
  const r = await claudeCode.detect(env);
  assert.equal(r.found, false);
});

test('detect: global only → scope=global, paths.global resolved, paths.project null', async (t) => {
  const env = await makeEnv(t, { withGlobal: true, withProject: false });
  const r = await claudeCode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(r.paths.global, join(env.homedir, '.claude', 'skills', '10x-engineer'));
  assert.equal(r.paths.project, null);
});

test('detect: project only → scope=project', async (t) => {
  const env = await makeEnv(t, { withGlobal: false, withProject: true });
  const r = await claudeCode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, '.claude', 'skills', '10x-engineer'));
});

test('detect: both → scope=both, both paths resolved', async (t) => {
  const env = await makeEnv(t, { withGlobal: true, withProject: true });
  const r = await claudeCode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'both');
  assert.ok(r.paths.global);
  assert.ok(r.paths.project);
});

test('install + uninstall surgical-removal round-trip (global scope) — user-owned sibling untouched', async (t) => {
  const env = await makeEnv(t, { withGlobal: true, withProject: false });
  const skills = await loadSkills();
  const detection = await claudeCode.detect(env);

  // Pre-install state: just the empty .claude/ dir
  const preState = (await readdir(join(env.homedir, '.claude'))).sort();
  assert.deepEqual(preState, []);

  // Pre-install: seed a sibling marker file the user "already owned" inside
  // .claude/skills/. The adapter must NEVER touch this on install or uninstall —
  // surgical removal is ROADMAP cross-phase invariant 4.
  await mkdir(join(env.homedir, '.claude/skills'), { recursive: true });
  const userMarkerPath = join(env.homedir, '.claude/skills/preexisting.md');
  const userMarkerBody = '# user-owned file\nshould survive round-trip\n';
  await writeFile(userMarkerPath, userMarkerBody, 'utf8');
  const userMarkerStatBefore = await stat(userMarkerPath);

  const installRes = await claudeCode.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  // Phase 7 post-partition: 10 response-mode skills (build-mode-overview is
  // routed to persona.txt + BUILD_MODE_INSTRUCTION, NOT installed as a
  // standalone .md) + 3 commands + 1 output style + 2 hook scripts +
  // 1 persona.txt + 1 settings.json patch = 18.
  assert.equal(installRes.written.length, 18);

  // 10 skill files materialised at <skills/10x-engineer>/
  const installed = (await readdir(detection.paths.global)).sort();
  assert.equal(installed.length, 10);

  // All three slash command files materialised at <commands/<id>.md>
  const commandsDir = join(env.homedir, '.claude/commands');
  for (const id of ['10x-engineer', '10x-engineer-enable', '10x-engineer-disable']) {
    const p = join(commandsDir, `${id}.md`);
    assert.equal(existsSync(p), true,
      `post-install: ${id}.md must exist at .claude/commands/`);
    const body = await readFile(p, 'utf8');
    assert.ok(body.startsWith('---\ndescription:'),
      `${id} command file must carry frontmatter with description`);
  }
  const engageBody = await readFile(join(commandsDir, '10x-engineer.md'), 'utf8');
  assert.ok(engageBody.includes('$ARGUMENTS'),
    'engage command must reference $ARGUMENTS for user task pass-through');
  assert.ok(engageBody.includes('.10x-engineer/state.json'),
    'engage command must reference the state.json gate');

  // Phase 6: hook scripts copied to .claude/hooks/.
  const hooksDir = join(env.homedir, '.claude/hooks');
  assert.equal(existsSync(join(hooksDir, '10x-engineer-session-start.js')), true,
    'session-start hook script must be installed in .claude/hooks/');
  assert.equal(existsSync(join(hooksDir, '10x-engineer-user-prompt-submit.js')), true,
    'user-prompt-submit hook script must be installed in .claude/hooks/');
  assert.equal(existsSync(join(hooksDir, 'persona.txt')), true,
    'persona.txt must be written to .claude/hooks/');

  // Hook scripts must contain the same source as lib/hooks/* (copyFile-equality).
  const sessionStartSrc = await readFile(
    new URL('../lib/hooks/session-start.js', import.meta.url).pathname, 'utf8');
  const sessionStartInstalled = await readFile(
    join(hooksDir, '10x-engineer-session-start.js'), 'utf8');
  assert.equal(sessionStartInstalled, sessionStartSrc,
    'installed session-start hook must be byte-equal to lib/hooks/session-start.js');

  // settings.json patched with our two hook entries.
  const settingsPath = join(env.homedir, '.claude/settings.json');
  assert.equal(existsSync(settingsPath), true,
    'settings.json must be created/patched on Phase 6 install');
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.equal(Array.isArray(settings.hooks.SessionStart), true);
  assert.equal(settings.hooks.SessionStart.length, 1);
  assert.match(settings.hooks.SessionStart[0].hooks[0].command, /10x-engineer/);
  assert.equal(Array.isArray(settings.hooks.UserPromptSubmit), true);
  assert.equal(settings.hooks.UserPromptSubmit.length, 1);
  assert.match(settings.hooks.UserPromptSubmit[0].hooks[0].command, /10x-engineer/);

  // Output style file materialised at <output-styles/10x-engineer.md>
  const outputStylePath = join(env.homedir, '.claude/output-styles/10x-engineer.md');
  assert.equal(existsSync(outputStylePath), true,
    'post-install: output style file must exist at .claude/output-styles/10x-engineer.md');
  const outputStyleBody = await readFile(outputStylePath, 'utf8');
  assert.ok(outputStyleBody.startsWith('---\nname: 10x-engineer\n'),
    'output style file must carry frontmatter with name: 10x-engineer');
  // The body should include each skill name as a markdown section heading.
  for (const sk of skills) {
    assert.ok(outputStyleBody.includes(`## ${sk.name}`),
      `output style body must include skill ${sk.name}`);
  }

  // Each skill file's content matches the corresponding skill's transform output
  const sample = await readFile(join(detection.paths.global, `${skills[0].id}.md`), 'utf8');
  assert.ok(sample.startsWith('---\nname: '));
  assert.ok(sample.includes(skills[0].body));

  const uninstallRes = await claudeCode.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  // Phase 6: 5 prior + 2 hook scripts + 1 persona.txt + 1 settings.json patch = 9.
  assert.equal(uninstallRes.removed.length, 9);

  // Post-uninstall assertions:
  // 1) The 10x-engineer install directory is gone.
  assert.equal(existsSync(detection.paths.global), false,
    'post-uninstall: 10x-engineer/ install dir must be removed');

  // 1b) Every slash command file is gone.
  for (const id of ['10x-engineer', '10x-engineer-enable', '10x-engineer-disable']) {
    assert.equal(existsSync(join(commandsDir, `${id}.md`)), false,
      `post-uninstall: ${id}.md must be removed`);
  }

  // 1c) The output style file is gone.
  assert.equal(existsSync(outputStylePath), false,
    'post-uninstall: output style file must be removed');

  // Phase 6: hook artefacts removed.
  assert.equal(existsSync(join(hooksDir, '10x-engineer-session-start.js')), false,
    'post-uninstall: session-start hook must be removed');
  assert.equal(existsSync(join(hooksDir, '10x-engineer-user-prompt-submit.js')), false,
    'post-uninstall: user-prompt-submit hook must be removed');
  assert.equal(existsSync(join(hooksDir, 'persona.txt')), false,
    'post-uninstall: persona.txt must be removed');
  // settings.json — file may still exist (rewritten as `{}` by unmergeHookConfig
  // when no foreign entries remain) — but our hook entries must be gone.
  if (existsSync(settingsPath)) {
    const post = JSON.parse(await readFile(settingsPath, 'utf8'));
    assert.equal(post.hooks ? Object.keys(post.hooks).length : 0, 0,
      'post-uninstall: no 10x-engineer hook entries remain in settings.json');
  }

  // 2) The empty parent .claude/skills/, .claude/commands/, and
  //    .claude/output-styles/ dirs remain. The adapter creates them via
  //    mkdir({recursive:true}) on install and never deletes parent dirs
  //    on uninstall — surgical removal (ROADMAP cross-phase invariant 4).
  const claudeContents = (await readdir(join(env.homedir, '.claude'))).sort();
  // Phase 6: hooks/ parent dir is also created during install and survives
  // (surgical removal — never delete parent dirs the adapter created via mkdir-p).
  // settings.json may also survive as a `{}` JSON file if unmergeHookConfig
  // retained the file (which it does — we never delete user config files).
  const expectedParents = ['commands', 'hooks', 'output-styles', 'skills'];
  if (claudeContents.includes('settings.json')) expectedParents.push('settings.json');
  assert.deepEqual(claudeContents.sort(), expectedParents.sort(),
    'post-uninstall .claude/ contains parent dirs we created (surgical removal — ROADMAP cross-phase invariant 4); settings.json may persist as `{}`');

  // 3) The user's pre-existing sibling marker file (preexisting.md) is byte-identical (content + mtime).
  const userMarkerBodyAfter = await readFile(userMarkerPath, 'utf8');
  assert.equal(userMarkerBodyAfter, userMarkerBody,
    'post-uninstall: user-owned sibling file (preexisting.md) content untouched');
  const userMarkerStatAfter = await stat(userMarkerPath);
  assert.equal(userMarkerStatAfter.mtimeMs, userMarkerStatBefore.mtimeMs,
    'post-uninstall: user-owned sibling file mtime unchanged');
});

test('install is idempotent: re-running does not duplicate files', async (t) => {
  const env = await makeEnv(t, { withGlobal: true, withProject: false });
  const skills = await loadSkills();
  const detection = await claudeCode.detect(env);

  await claudeCode.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });
  await claudeCode.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });

  const installed = (await readdir(detection.paths.global)).sort();
  assert.equal(installed.length, 10, 'expected exactly 10 files after re-install (no duplicates)');

  // Slash command files remain three single artefacts — re-install replaces in place.
  const commandsDir = join(env.homedir, '.claude/commands');
  const commands = (await readdir(commandsDir)).sort();
  assert.deepEqual(commands, [
    '10x-engineer-disable.md',
    '10x-engineer-enable.md',
    '10x-engineer.md',
  ], 'expected exactly three command files after re-install (no duplicates)');

  // Output style file remains a single artefact too.
  const outputStylesDir = join(env.homedir, '.claude/output-styles');
  const outputStyles = (await readdir(outputStylesDir)).sort();
  assert.deepEqual(outputStyles, ['10x-engineer.md'],
    'expected exactly one output style file after re-install (no duplicates)');

  // Phase 6: settings.json hook entries are idempotent — exactly one entry per event.
  const settingsPath = join(env.homedir, '.claude/settings.json');
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.equal(settings.hooks.SessionStart.length, 1,
    'idempotent install must not duplicate SessionStart hook entries');
  assert.equal(settings.hooks.UserPromptSubmit.length, 1,
    'idempotent install must not duplicate UserPromptSubmit hook entries');
});

test('dryRun:true does not touch disk; mtime on parent dir unchanged', async (t) => {
  const env = await makeEnv(t, { withGlobal: true, withProject: false });
  const skills = await loadSkills();
  const detection = await claudeCode.detect(env);

  const before = await stat(join(env.homedir, '.claude'));

  const r = await claudeCode.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true,
  });
  assert.equal(r.written.length, 18,
    'written array must record would-be paths (10 response-mode skills + 3 commands + 1 output style + 2 hooks + 1 persona + 1 settings) even with dryRun:true');

  // No skill files materialised
  await assert.rejects(readdir(detection.paths.global), { code: 'ENOENT' });

  // No command file materialised
  await assert.rejects(
    readdir(join(env.homedir, '.claude/commands')),
    { code: 'ENOENT' },
    'commands/ must not be created on dryRun',
  );

  // No output style file materialised
  await assert.rejects(
    readdir(join(env.homedir, '.claude/output-styles')),
    { code: 'ENOENT' },
    'output-styles/ must not be created on dryRun',
  );

  // Phase 6: hooks dir not created on dryRun
  await assert.rejects(
    readdir(join(env.homedir, '.claude/hooks')),
    { code: 'ENOENT' },
    'hooks/ must not be created on dryRun',
  );
  // settings.json not created on dryRun
  assert.equal(existsSync(join(env.homedir, '.claude/settings.json')), false,
    'settings.json must not be created on dryRun');

  const after = await stat(join(env.homedir, '.claude'));
  assert.equal(before.mtimeMs, after.mtimeMs, 'parent dir mtime must be unchanged on dryRun');
});

test('install preserves a foreign settings.json hook entry; uninstall removes only ours', async (t) => {
  const env = await makeEnv(t, { withGlobal: true, withProject: false });
  const skills = await loadSkills();
  const detection = await claudeCode.detect(env);

  // Pre-seed settings.json with a foreign hook entry the user already configured.
  const settingsPath = join(env.homedir, '.claude/settings.json');
  const foreignSettings = {
    hooks: {
      SessionStart: [
        { hooks: [{ type: 'command', command: 'node /opt/foreign-tool/start.js', timeout: 10 }] },
      ],
    },
    other_user_setting: { keep: 'me' },
  };
  await writeFile(settingsPath, JSON.stringify(foreignSettings, null, 2) + '\n');

  await claudeCode.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });
  const postInstall = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.equal(postInstall.hooks.SessionStart.length, 2,
    'install must append our SessionStart entry alongside the foreign one');
  assert.equal(postInstall.other_user_setting.keep, 'me',
    'install must preserve foreign top-level keys');

  await claudeCode.uninstall({ scope: detection.scope, paths: detection.paths, dryRun: false });
  const postUninstall = JSON.parse(await readFile(settingsPath, 'utf8'));
  assert.equal(postUninstall.hooks.SessionStart.length, 1,
    'uninstall must remove only our SessionStart entry');
  assert.match(postUninstall.hooks.SessionStart[0].hooks[0].command, /foreign-tool/,
    'foreign SessionStart entry must survive content-equal');
  assert.equal(postUninstall.other_user_setting.keep, 'me',
    'foreign top-level keys must survive uninstall');
});

test('project-only install does not write to settings.json or hooks/', async (t) => {
  const env = await makeEnv(t, { withGlobal: false, withProject: true });
  const skills = await loadSkills();
  const detection = await claudeCode.detect(env);
  await claudeCode.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });

  // Project install path: no global settings.json or hooks dir touched.
  assert.equal(existsSync(join(env.homedir, '.claude')), false,
    'project-only install must not create global ~/.claude');
  assert.equal(existsSync(join(env.cwd, '.claude/settings.json')), false,
    'project install must not patch project settings.json (Phase 6 hook integration is global-only)');
  assert.equal(existsSync(join(env.cwd, '.claude/hooks')), false,
    'project install must not create project hooks dir (Phase 6 hook integration is global-only)');
});
