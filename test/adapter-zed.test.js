// test/adapter-zed.test.js
//
// Zed AI adapter — append-mode, project-only round-trip suite. Twelve named
// tests cover detection, install/uninstall round-trip across content shapes,
// idempotence, dryRun, and the project-only invariant (paths.global is
// always null until vendor publishes the Rules-Library filesystem path).
//
//   1.  detect: nothing → found:false
//   2.  detect: ~/.config/zed/ present (no project .rules) → scope='project',
//       paths.project resolved to <cwd>/.rules, paths.global=null
//   3.  detect: project .rules present → scope='project'
//   4.  detect: both signals present → scope='project' (no scope='both')
//   5.  paths.global is always null — explicit invariant assertion
//   6.  install + uninstall round-trip on a populated .rules → byte-identical
//   7.  install + uninstall round-trip on no-trailing-newline .rules
//   8.  install + uninstall round-trip on a CRLF-saved .rules
//   9.  install is idempotent
//  10.  uninstall removes only our block; user content survives byte-identically
//  11.  uninstall on missing file → graceful (no throw)
//  12.  dryRun:true does not change file mtime
//
// Per-test isolation via mkdtemp('10xe-zed-'). cwd and homedir are injected
// into the adapter (D2-24) — never read from process or node:os.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, mkdir, writeFile, readFile, stat, rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import zed from '../lib/adapters/zed.js';
import { loadSkills } from '../lib/skills.js';
import { assertByteIdenticalAroundMarker } from './helpers/byte-identity.js';

/**
 * Build an isolated test environment under a single mkdtemp. Caller flags
 * which Zed signals to seed (zed config dir, project .rules file, .git
 * anchor for the project root).
 *
 * Zed has no PATH-binary detection (Zed is a GUI editor), so unlike the
 * Codex helper we do not need to scrub process.env.PATH.
 */
async function makeEnv(t, opts = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-zed-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (opts.withZedConfig) {
    await mkdir(join(homedir, '.config', 'zed'), { recursive: true });
  }
  if (opts.withRulesFile) {
    await writeFile(join(cwd, '.rules'), opts.rulesContent ?? '');
  }
  if (opts.withGit) {
    await mkdir(join(cwd, '.git'), { recursive: true });
  }
  return { root, homedir, cwd };
}

test('zed detect: nothing → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await zed.detect(env);
  assert.equal(r.found, false);
});

test('zed detect: ~/.config/zed/ present → scope=project, paths.project resolved, paths.global=null', async (t) => {
  const env = await makeEnv(t, { withZedConfig: true });
  const r = await zed.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  // No .git anchor → projectRoot falls back to cwd; .rules path is <cwd>/.rules
  assert.equal(r.paths.project, join(env.cwd, '.rules'));
  assert.equal(r.paths.global, null);
});

test('zed detect: project .rules present → scope=project', async (t) => {
  const env = await makeEnv(t, { withRulesFile: true, withGit: true });
  const r = await zed.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, '.rules'));
  assert.equal(r.paths.global, null);
});

test('zed detect: both signals present → still scope=project (no scope=both)', async (t) => {
  const env = await makeEnv(t, {
    withZedConfig: true, withRulesFile: true, withGit: true,
  });
  const r = await zed.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.global, null);
  assert.ok(r.paths.project);
});

test('zed paths.global is always null (project-only invariant)', async (t) => {
  // Probe every detect-truthy combination; paths.global must remain null in all.
  const cases = [
    { withZedConfig: true },
    { withRulesFile: true, withGit: true },
    { withZedConfig: true, withRulesFile: true, withGit: true },
  ];
  for (const opts of cases) {
    const env = await makeEnv(t, opts);
    const r = await zed.detect(env);
    assert.equal(r.found, true, `case ${JSON.stringify(opts)}: should be found`);
    assert.equal(r.paths.global, null,
      `case ${JSON.stringify(opts)}: paths.global must be null until vendor surfaces Rules-Library path`);
  }
});

test('zed install + uninstall round-trip on populated .rules', async (t) => {
  const original = '# user rules\nproject convention one\n\nproject convention two\n';
  const env = await makeEnv(t, {
    withRulesFile: true,
    rulesContent: original,
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await zed.detect(env);

  await zed.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });

  const afterInstall = await readFile(detection.paths.project, 'utf8');
  assert.ok(afterInstall.includes('# user rules\nproject convention one'),
    'user content must survive install');
  assert.ok(afterInstall.includes('<!-- BEGIN 10x-engineer'),
    'marker block must be present after install');

  await zed.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('zed install + uninstall round-trip with no-trailing-newline .rules', async (t) => {
  // FND-09-refined: a single bounded \n artefact is tolerated by the helper.
  const original = 'rule one without final newline'; // no trailing \n
  const env = await makeEnv(t, {
    withRulesFile: true,
    rulesContent: original,
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await zed.detect(env);

  await zed.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await zed.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('zed install + uninstall round-trip with CRLF .rules', async (t) => {
  // CRLF-saved file. BLOCK_RE in markers.js uses \r?\n; replaceBlock and
  // stripBlock are CRLF-tolerant.
  const original = '# title\r\nuser line one\r\nuser line two\r\n';
  const env = await makeEnv(t, {
    withRulesFile: true,
    rulesContent: original,
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await zed.detect(env);

  await zed.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await zed.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('zed install is idempotent: re-running produces identical content', async (t) => {
  const env = await makeEnv(t, {
    withRulesFile: true,
    rulesContent: '# original rule\n',
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await zed.detect(env);

  await zed.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const afterFirst = await readFile(detection.paths.project, 'utf8');

  await zed.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const afterSecond = await readFile(detection.paths.project, 'utf8');

  assert.equal(afterSecond, afterFirst,
    're-running install must produce byte-identical content (replaceBlock replaces in place)');
});

test('zed uninstall preserves user content byte-identically (block-only removal)', async (t) => {
  // Pre-seed a .rules file with rich user content — both before and after the
  // marker region — to confirm uninstall surgically removes ONLY our block.
  const original = '# preface\nuser line A\nuser line B\n\n# trailing section\nuser line C\n';
  const env = await makeEnv(t, {
    withRulesFile: true,
    rulesContent: original,
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await zed.detect(env);

  await zed.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await zed.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('zed uninstall on missing .rules → graceful (no throw)', async (t) => {
  // Detection signal is ~/.config/zed/ only; .rules file does not exist.
  const env = await makeEnv(t, { withZedConfig: true });
  const detection = await zed.detect(env);
  assert.equal(detection.found, true);
  assert.equal(detection.scope, 'project');

  // stripBlock returns { removed: false } when the file does not exist (ENOENT).
  // The uninstall call must complete without throwing.
  const r = await zed.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.ok(Array.isArray(r.removed), 'uninstall must return { removed: [...] } even on missing file');
  assert.equal(r.removed.length, 0, 'no path was removed because no marker block existed');
});

test('zed dryRun:true does not change file mtime', async (t) => {
  const env = await makeEnv(t, {
    withRulesFile: true,
    rulesContent: '# user content\n',
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await zed.detect(env);

  const before = await stat(detection.paths.project);

  const r = await zed.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 1, 'written array records the would-be path even on dryRun');

  const after = await stat(detection.paths.project);
  assert.equal(before.mtimeMs, after.mtimeMs, 'mtime must be unchanged on dryRun');

  // Content also unchanged
  const content = await readFile(detection.paths.project, 'utf8');
  assert.equal(content, '# user content\n');
});
