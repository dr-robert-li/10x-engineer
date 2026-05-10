// test/adapter-hermes-agent.test.js
//
// Hermes Agent adapter round-trip suite.
//
// The adapter writes directory-based Hermes skills under
// ~/.hermes/skills/personas/. It is global-scope only because Hermes documents
// SOUL.md as instance identity and AGENTS.md as project context, while this
// package needs a reversible opt-in persona surface.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readdir, stat, readFile, writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import hermesAgent from '../lib/adapters/hermes-agent.js';
import { loadSkills } from '../lib/skills.js';
import {
  BUILD_MODE_INSTRUCTION,
  STATE_GATE_INSTRUCTION,
} from '../lib/state-gate-instruction.js';

function neutralisePath(t, root) {
  const original = process.env.PATH;
  process.env.PATH = root;
  t.after(() => { process.env.PATH = original; });
}

async function makeEnv(t, { withHermes = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-hermes-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  neutralisePath(t, root);
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (withHermes) await mkdir(join(homedir, '.hermes'), { recursive: true });
  return { root, homedir, cwd };
}

test('detect: no ~/.hermes and no hermes binary -> found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await hermesAgent.detect(env);
  assert.deepEqual(r, { found: false });
});

test('detect: ~/.hermes exists -> global scope with skill path', async (t) => {
  const env = await makeEnv(t, { withHermes: true });
  const r = await hermesAgent.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(
    r.paths.global,
    join(env.homedir, '.hermes', 'skills', 'personas', '10x-engineer'),
  );
  assert.equal(r.paths.project, null);
});

test('detect: hermes binary on PATH triggers installable global path', async (t) => {
  const env = await makeEnv(t);
  await writeFile(join(env.root, 'hermes'), '#!/bin/sh\n');

  const r = await hermesAgent.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(
    r.paths.global,
    join(env.homedir, '.hermes', 'skills', 'personas', '10x-engineer'),
  );
});

test('install + uninstall round-trip -> owned skills removed, sibling skill untouched', async (t) => {
  const env = await makeEnv(t, { withHermes: true });
  const skills = await loadSkills();
  const detection = await hermesAgent.detect(env);

  const personasDir = join(env.homedir, '.hermes', 'skills', 'personas');
  const userSkillDir = join(personasDir, 'user-owned-skill');
  await mkdir(userSkillDir, { recursive: true });
  const userSkillPath = join(userSkillDir, 'SKILL.md');
  const userSkillBody = '# user-owned Hermes skill\nshould survive round-trip\n';
  await writeFile(userSkillPath, userSkillBody, 'utf8');
  const userSkillStatBefore = await stat(userSkillPath);

  const installRes = await hermesAgent.install({
    skills,
    scope: detection.scope,
    paths: detection.paths,
    dryRun: false,
    version: '0.1.0',
  });
  assert.equal(installRes.written.length, 3);

  const mainSkill = join(personasDir, '10x-engineer', 'SKILL.md');
  const enableSkill = join(personasDir, '10x-engineer-enable', 'SKILL.md');
  const disableSkill = join(personasDir, '10x-engineer-disable', 'SKILL.md');

  for (const p of [mainSkill, enableSkill, disableSkill]) {
    assert.equal(existsSync(p), true, `${p} must exist after install`);
  }

  const mainBody = await readFile(mainSkill, 'utf8');
  assert.ok(mainBody.startsWith('---\nname: 10x-engineer\n'));
  assert.ok(mainBody.includes(STATE_GATE_INSTRUCTION));
  assert.ok(mainBody.includes(BUILD_MODE_INSTRUCTION));
  assert.ok(mainBody.includes('# BUILD-MODE EXTENSIONS'));
  assert.ok(mainBody.includes('## build-mode-overview'));

  const enableBody = await readFile(enableSkill, 'utf8');
  assert.ok(enableBody.includes('"enabled": true'));
  const disableBody = await readFile(disableSkill, 'utf8');
  assert.ok(disableBody.includes('"enabled": false'));

  const installedDirs = (await readdir(personasDir)).sort();
  assert.deepEqual(installedDirs, [
    '10x-engineer',
    '10x-engineer-disable',
    '10x-engineer-enable',
    'user-owned-skill',
  ]);

  const uninstallRes = await hermesAgent.uninstall({
    scope: detection.scope,
    paths: detection.paths,
    dryRun: false,
  });
  assert.equal(uninstallRes.removed.length, 3);

  for (const p of [
    join(personasDir, '10x-engineer'),
    join(personasDir, '10x-engineer-enable'),
    join(personasDir, '10x-engineer-disable'),
  ]) {
    assert.equal(existsSync(p), false, `${p} must be removed on uninstall`);
  }

  const remainingDirs = (await readdir(personasDir)).sort();
  assert.deepEqual(remainingDirs, ['user-owned-skill']);
  const userSkillBodyAfter = await readFile(userSkillPath, 'utf8');
  assert.equal(userSkillBodyAfter, userSkillBody);
  const userSkillStatAfter = await stat(userSkillPath);
  assert.equal(userSkillStatAfter.mtimeMs, userSkillStatBefore.mtimeMs);
});

test('install is idempotent: re-running keeps exactly three owned SKILL.md files', async (t) => {
  const env = await makeEnv(t, { withHermes: true });
  const skills = await loadSkills();
  const detection = await hermesAgent.detect(env);

  await hermesAgent.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  await hermesAgent.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });

  const personasDir = join(env.homedir, '.hermes', 'skills', 'personas');
  const installedDirs = (await readdir(personasDir)).sort();
  assert.deepEqual(installedDirs, [
    '10x-engineer',
    '10x-engineer-disable',
    '10x-engineer-enable',
  ]);
  for (const dir of installedDirs) {
    assert.deepEqual(await readdir(join(personasDir, dir)), ['SKILL.md']);
  }
});

test('dryRun:true does not create skills directory or change ~/.hermes mtime', async (t) => {
  const env = await makeEnv(t, { withHermes: true });
  const skills = await loadSkills();
  const detection = await hermesAgent.detect(env);
  const hermesRoot = join(env.homedir, '.hermes');
  const before = await stat(hermesRoot);

  const r = await hermesAgent.install({
    skills,
    scope: detection.scope,
    paths: detection.paths,
    dryRun: true,
    version: '0.1.0',
  });
  assert.equal(r.written.length, 3);
  await assert.rejects(readdir(join(hermesRoot, 'skills')), { code: 'ENOENT' });

  const after = await stat(hermesRoot);
  assert.equal(after.mtimeMs, before.mtimeMs);
});
