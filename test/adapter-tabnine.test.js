// test/adapter-tabnine.test.js — TIER2-05 round-trip suite for the Tabnine
// adapter. Mirrors test/adapter-continue.test.js: single-file install at
// <scope-root>/.tabnine/guidelines/10x-engineer.md, markerless, surgical
// unlink on uninstall, parent guidelines/ dir survives, user-owned siblings
// preserved byte-identically.
//
// Nine named tests covering the Tabnine adapter contract:
//   1. detect: nothing → found:false
//   2. detect: global only → scope='global'
//   3. detect: project only → scope='project'
//   4. detect: both → scope='both'
//   5. install + uninstall round-trip with user-owned sibling under
//      <.tabnine>/guidelines/user-guideline.md byte-identical (content +
//      mtime), and the parent guidelines/ directory itself surviving — the
//      load-bearing test for ROADMAP cross-phase invariant 4 in the
//      single-file flavour
//   6. install is idempotent: re-running produces stable content
//   7. dryRun:true never touches disk; mtime on .tabnine/ unchanged
//   8. uninstall when 10x-engineer.md is already absent: graceful, no throw
//   9. markerless invariant: emitted file contains no <!-- BEGIN / END markers
//
// Every test uses mkdtemp to build an isolated environment and threads cwd
// and homedir into the adapter (D2-24). The real $HOME and process.cwd are
// never read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readdir, stat, readFile, writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tabnine from '../lib/adapters/tabnine.js';
import { loadSkills } from '../lib/skills.js';
import { MARKER_BEGIN_PREFIX } from '../lib/markers.js';

/**
 * Build an isolated test environment. Creates separate cwd-root and
 * homedir-root directories under one mkdtemp. Caller asks for global/project
 * markers via `withGlobal` and `withProject`.
 */
async function makeEnv(t, { withGlobal = false, withProject = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-tabnine-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (withGlobal)  await mkdir(join(homedir, '.tabnine'));
  if (withProject) await mkdir(join(cwd, '.tabnine'));
  return { root, homedir, cwd };
}

test('detect: no .tabnine/ anywhere → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await tabnine.detect(env);
  assert.equal(r.found, false);
});

test('detect: global only → scope=global, paths.global resolved, paths.project null', async (t) => {
  const env = await makeEnv(t, { withGlobal: true });
  const r = await tabnine.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(r.paths.global, join(env.homedir, '.tabnine', 'guidelines', '10x-engineer.md'));
  assert.equal(r.paths.project, null);
});

test('detect: project only → scope=project, paths.project resolved, paths.global null', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const r = await tabnine.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, '.tabnine', 'guidelines', '10x-engineer.md'));
  assert.equal(r.paths.global, null);
});

test('detect: both → scope=both, both paths resolved', async (t) => {
  const env = await makeEnv(t, { withGlobal: true, withProject: true });
  const r = await tabnine.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'both');
  assert.ok(r.paths.global);
  assert.ok(r.paths.project);
});

test('install + uninstall round-trip (project scope) — user-owned sibling under guidelines/ untouched, guidelines/ dir survives', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const skills = await loadSkills();
  const detection = await tabnine.detect(env);

  // Pre-seed a user-owned sibling under .tabnine/guidelines/ — placed
  // alongside the file we will write. The adapter must NEVER touch this on
  // install or uninstall, and uninstall must NOT remove the parent
  // guidelines/ directory.
  const guidelinesDir = join(env.cwd, '.tabnine', 'guidelines');
  await mkdir(guidelinesDir, { recursive: true });
  const userGuidelinePath = join(guidelinesDir, 'user-guideline.md');
  const userGuidelineBody = '# user-owned guideline\nshould survive round-trip\n';
  await writeFile(userGuidelinePath, userGuidelineBody, 'utf8');
  const userGuidelineStatBefore = await stat(userGuidelinePath);

  // Install
  const installRes = await tabnine.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  assert.equal(installRes.written.length, 1, 'concat-md writes exactly one file per scope');
  assert.equal(installRes.written[0], detection.paths.project);

  // 10x-engineer.md exists; user-guideline.md still there
  assert.equal(existsSync(detection.paths.project), true);
  const installedDirContents = (await readdir(guidelinesDir)).sort();
  assert.deepEqual(installedDirContents, ['10x-engineer.md', 'user-guideline.md']);

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
  const uninstallRes = await tabnine.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(uninstallRes.removed.length, 1);
  assert.equal(uninstallRes.removed[0], detection.paths.project);

  // Post-uninstall:
  // 1) 10x-engineer.md is gone
  assert.equal(existsSync(detection.paths.project), false,
    'post-uninstall: 10x-engineer.md must be unlinked');

  // 2) The parent guidelines/ dir survives (we never delete user-owned parents)
  assert.equal(existsSync(guidelinesDir), true,
    'post-uninstall: parent guidelines/ dir must survive (surgical removal)');

  // 3) user-guideline.md is byte-identical (content + mtime)
  const userGuidelineBodyAfter = await readFile(userGuidelinePath, 'utf8');
  assert.equal(userGuidelineBodyAfter, userGuidelineBody,
    'post-uninstall: user-owned sibling content untouched');
  const userGuidelineStatAfter = await stat(userGuidelinePath);
  assert.equal(userGuidelineStatAfter.mtimeMs, userGuidelineStatBefore.mtimeMs,
    'post-uninstall: user-owned sibling mtime unchanged');
});

test('install is idempotent: re-running produces stable content (no duplication)', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const skills = await loadSkills();
  const detection = await tabnine.detect(env);

  await tabnine.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0' });
  const first = await readFile(detection.paths.project, 'utf8');
  await tabnine.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0' });
  const second = await readFile(detection.paths.project, 'utf8');
  assert.equal(first, second, 're-install must yield byte-identical content');
});

test('dryRun:true does not touch disk; mtime on .tabnine/ unchanged', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const skills = await loadSkills();
  const detection = await tabnine.detect(env);

  const tabnineDir = join(env.cwd, '.tabnine');
  const before = await stat(tabnineDir);

  const r = await tabnine.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 1, 'written array must record would-be paths even with dryRun:true');

  // Nothing materialised
  assert.equal(existsSync(detection.paths.project), false,
    'dryRun:true must not write 10x-engineer.md');
  await assert.rejects(readdir(join(tabnineDir, 'guidelines')), { code: 'ENOENT' },
    'dryRun:true must not even create the guidelines/ dir');

  const after = await stat(tabnineDir);
  assert.equal(before.mtimeMs, after.mtimeMs, 'parent .tabnine/ mtime must be unchanged on dryRun');
});

test('uninstall when 10x-engineer.md is already absent — graceful (no ENOENT throw)', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const detection = await tabnine.detect(env);

  // No prior install; the file does not exist. Uninstall must not throw.
  const r = await tabnine.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(r.removed.length, 1, 'removed array still records the would-be path even when file is absent');
  assert.equal(existsSync(detection.paths.project), false);
});

test('markerless invariant: installed 10x-engineer.md contains NO marker strings', async (t) => {
  const env = await makeEnv(t, { withProject: true });
  const skills = await loadSkills();
  const detection = await tabnine.detect(env);

  await tabnine.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  const content = await readFile(detection.paths.project, 'utf8');
  assert.equal(content.includes(MARKER_BEGIN_PREFIX), false,
    'concat-md is markerless — emitted file must contain no BEGIN marker');
  assert.equal(content.includes('<!-- END 10x-engineer'), false,
    'concat-md is markerless — emitted file must contain no END marker');
});
