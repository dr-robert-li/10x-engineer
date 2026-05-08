// test/adapter-pearai.test.js — TIER2-11 round-trip suite for the PearAI
// adapter. Mirrors test/adapter-continue.test.js shape (PearAI is a Continue
// submodule fork; the install surgery is byte-for-byte identical with the
// path-string swapped) and adds one PearAI-specific test that pins
// Pitfall 4: NO cross-detection on the upstream marker dir.
//
// Tests:
//   1. detect: nothing → found:false
//   2. detect: global only → scope='global'
//   3. detect: project only → scope='project'
//   4. detect: both → scope='both'
//   5. install + uninstall round-trip with user-owned sibling under
//      <.pearai>/rules/user-rule.md byte-identical (content + mtime), and
//      the parent rules/ directory itself surviving — load-bearing test for
//      ROADMAP cross-phase invariant 4 in the single-file flavour
//   6. install is idempotent: re-running produces stable content
//   7. dryRun:true never touches disk; mtime on .pearai/ unchanged
//   8. uninstall when 10x-engineer.md is already absent: graceful, no throw
//   9. markerless invariant: emitted file contains no <!-- BEGIN / END markers
//  10. Pitfall 4 — pearai.detect() with BOTH .pearai/ AND the upstream
//      marker dir present in homedir returns paths under .pearai/ ONLY,
//      never the upstream path.
//
// Every test uses mkdtemp to build an isolated environment and threads cwd and
// homedir into the adapter (D2-24). The real $HOME and process.cwd are never
// read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readdir, stat, readFile, writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pearai from '../lib/adapters/pearai.js';
import { loadSkills } from '../lib/skills.js';
import { MARKER_BEGIN_PREFIX } from '../lib/markers.js';

/**
 * Build an isolated test environment. Creates separate cwd-root and
 * homedir-root directories under one mkdtemp. Caller asks for global/project
 * markers via `withGlobal` and `withProject`.
 */
async function makeEnv(t, { withGlobal = false, withProject = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-pearai-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (withGlobal)  await mkdir(join(homedir, '.pearai'));
  if (withProject) await mkdir(join(cwd, '.pearai'));
  return { root, homedir, cwd };
}

test('detect: no .pearai/ anywhere → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await pearai.detect(env);
  assert.equal(r.found, false);
});

test('detect: global only → scope=global, paths.global resolved, paths.project null', async (t) => {
  const env = await makeEnv(t, { withGlobal: true });
  const r = await pearai.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(r.paths.global, join(env.homedir, '.pearai', 'rules', '10x-engineer.md'));
  assert.equal(r.paths.project, null);
});

test('detect: project only → scope=project, paths.project resolved, paths.global null', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const r = await pearai.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, '.pearai', 'rules', '10x-engineer.md'));
  assert.equal(r.paths.global, null);
});

test('detect: both → scope=both, both paths resolved', async (t) => {
  const env = await makeEnv(t, { withGlobal: true, withProject: true });
  const r = await pearai.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'both');
  assert.ok(r.paths.global);
  assert.ok(r.paths.project);
});

test('install + uninstall round-trip (project scope) — user-owned sibling under rules/ untouched, rules/ dir survives', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const skills = await loadSkills();
  const detection = await pearai.detect(env);

  // Pre-seed a user-owned sibling under .pearai/rules/ — placed alongside
  // the file we will write. The adapter must NEVER touch this on install or
  // uninstall, and uninstall must NOT remove the parent rules/ directory.
  const rulesDir = join(env.cwd, '.pearai', 'rules');
  await mkdir(rulesDir, { recursive: true });
  const userRulePath = join(rulesDir, 'user-rule.md');
  const userRuleBody = '# user-owned rule\nshould survive round-trip\n';
  await writeFile(userRulePath, userRuleBody, 'utf8');
  const userRuleStatBefore = await stat(userRulePath);

  // Install
  const installRes = await pearai.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  assert.equal(installRes.written.length, 1, 'concat-md writes exactly one file per scope');
  assert.equal(installRes.written[0], detection.paths.project);

  // 10x-engineer.md exists; user-rule.md still there
  assert.equal(existsSync(detection.paths.project), true);
  const installedDirContents = (await readdir(rulesDir)).sort();
  assert.deepEqual(installedDirContents, ['10x-engineer.md', 'user-rule.md']);

  // Content sanity: every skill's h2 header appears in stable order — proves
  // all 10 skills concatenated in alphabetical filename order.
  const installedContent = await readFile(detection.paths.project, 'utf8');
  let cursor = 0;
  for (const s of skills) {
    const idx = installedContent.indexOf(`## ${s.name}`, cursor);
    assert.ok(idx >= 0, `expected '## ${s.name}' at or after offset ${cursor}`);
    cursor = idx;
  }
  assert.ok(installedContent.startsWith('# 10x-engineer persona (v0.1.0)'));

  // Uninstall
  const uninstallRes = await pearai.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(uninstallRes.removed.length, 1);
  assert.equal(uninstallRes.removed[0], detection.paths.project);

  // Post-uninstall:
  // 1) 10x-engineer.md is gone
  assert.equal(existsSync(detection.paths.project), false,
    'post-uninstall: 10x-engineer.md must be unlinked');

  // 2) The parent rules/ dir survives (we never delete user-owned parents)
  assert.equal(existsSync(rulesDir), true,
    'post-uninstall: parent rules/ dir must survive (surgical removal)');

  // 3) user-rule.md is byte-identical (content + mtime)
  const userRuleBodyAfter = await readFile(userRulePath, 'utf8');
  assert.equal(userRuleBodyAfter, userRuleBody,
    'post-uninstall: user-owned sibling content untouched');
  const userRuleStatAfter = await stat(userRulePath);
  assert.equal(userRuleStatAfter.mtimeMs, userRuleStatBefore.mtimeMs,
    'post-uninstall: user-owned sibling mtime unchanged');
});

test('install is idempotent: re-running produces stable content (no duplication)', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const skills = await loadSkills();
  const detection = await pearai.detect(env);

  await pearai.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0' });
  const first = await readFile(detection.paths.project, 'utf8');
  await pearai.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0' });
  const second = await readFile(detection.paths.project, 'utf8');
  assert.equal(first, second, 're-install must yield byte-identical content');
});

test('dryRun:true does not touch disk; mtime on .pearai/ unchanged', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const skills = await loadSkills();
  const detection = await pearai.detect(env);

  const pearaiDir = join(env.cwd, '.pearai');
  const before = await stat(pearaiDir);

  const r = await pearai.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 1, 'written array must record would-be paths even with dryRun:true');

  // Nothing materialised
  assert.equal(existsSync(detection.paths.project), false,
    'dryRun:true must not write 10x-engineer.md');
  await assert.rejects(readdir(join(pearaiDir, 'rules')), { code: 'ENOENT' },
    'dryRun:true must not even create the rules/ dir');

  const after = await stat(pearaiDir);
  assert.equal(before.mtimeMs, after.mtimeMs, 'parent .pearai/ mtime must be unchanged on dryRun');
});

test('uninstall when 10x-engineer.md is already absent — graceful (no ENOENT throw)', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const detection = await pearai.detect(env);

  // No prior install; the file does not exist. Uninstall must not throw.
  const r = await pearai.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(r.removed.length, 1, 'removed array still records the would-be path even when file is absent');
  assert.equal(existsSync(detection.paths.project), false);
});

test('markerless invariant: installed 10x-engineer.md contains NO marker strings', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const skills = await loadSkills();
  const detection = await pearai.detect(env);

  await pearai.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  const content = await readFile(detection.paths.project, 'utf8');
  assert.equal(content.includes(MARKER_BEGIN_PREFIX), false,
    'concat-md is markerless — emitted file must contain no BEGIN marker');
  assert.equal(content.includes('<!-- END 10x-engineer'), false,
    'concat-md is markerless — emitted file must contain no END marker');
});

test('detect: pearai does NOT cross-detect on the upstream marker dir (Pitfall 4)', async (t) => {
  // This test pins the Pitfall 4 invariant: when both .pearai/ AND the
  // upstream marker dir (`.continue` — referenced here purely as a fixture
  // seed and as the test name's sanctioned mention) exist in homedir,
  // pearai.detect() must return paths under .pearai/ ONLY.
  const env = await makeEnv(t);
  // Seed BOTH marker dirs in homedir.
  await mkdir(join(env.homedir, '.continue'));
  await mkdir(join(env.homedir, '.pearai'));

  const r = await pearai.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');

  // Critical: paths.global must be inside .pearai/, NOT the upstream marker dir.
  assert.ok(r.paths.global.includes('/.pearai/'),
    `expected .pearai in path, got ${r.paths.global}`);
  assert.ok(!r.paths.global.includes('/.continue/'),
    `pearai must not return an upstream-marker path; got ${r.paths.global}`);
});
