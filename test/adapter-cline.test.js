// test/adapter-cline.test.js — TIER1-03 round-trip suite for the Cline adapter.
//
// Seven named tests covering the Cline adapter contract:
//   1. detect: no .clinerules/ anywhere → found:false
//   2. detect: .clinerules/ at cwd → scope:'project'
//   3. detect: .clinerules/ at ancestor → walk finds it, install path anchored to ancestor
//   4. detect: paths.global is always null (Cline is project-only for v1)
//   5. install + uninstall surgical-removal round-trip: a user-owned sibling
//      placed directly under .clinerules/ (alongside the 10x-engineer/ install
//      dir) survives a full round-trip byte-identically — load-bearing test for
//      ROADMAP cross-phase invariant 4.
//   6. idempotent re-install (no duplicates)
//   7. dryRun:true never touches disk; parent dir mtime unchanged
//
// Every test uses mkdtemp to build an isolated environment and threads cwd and
// homedir into the adapter (D2-24). The real ~ and the real cwd are never read.
// homedir is set to the mkdtemp root so the bounded ancestor walk halts at the
// env root rather than traversing the entire filesystem.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readdir, stat, readFile, writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cline from '../lib/adapters/cline.js';
import { loadSkills } from '../lib/skills.js';

/**
 * Build an isolated test environment. Creates a homedir-equivalent root and a
 * project subdirectory under a single mkdtemp. Pin homedir = root so the
 * findAncestorWith walk halts at the env root.
 *
 * @param {object} opts
 * @param {boolean} [opts.withCline]   create .clinerules/ at the project level
 * @param {boolean} [opts.atAncestor]  create .clinerules/ at the env root and
 *                                     deepen cwd to project/sub/deep
 */
async function makeEnv(t, { withCline = false, atAncestor = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-cline-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = root;
  const cwd = atAncestor ? join(root, 'project', 'sub', 'deep') : join(root, 'project');
  await mkdir(cwd, { recursive: true });
  if (withCline && !atAncestor) await mkdir(join(cwd, '.clinerules'));
  if (atAncestor) await mkdir(join(root, 'project', '.clinerules'));
  return { root, homedir, cwd };
}

test('detect: no .clinerules/ anywhere → found:false', async (t) => {
  const env = await makeEnv(t, { withCline: false });
  const r = await cline.detect(env);
  assert.equal(r.found, false);
});

test('detect: .clinerules/ at cwd → scope=project, paths.project resolved', async (t) => {
  const env = await makeEnv(t, { withCline: true });
  const r = await cline.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, '.clinerules', '10x-engineer'));
});

test('detect: .clinerules/ at ancestor → walk finds it, install path anchored to ancestor', async (t) => {
  const env = await makeEnv(t, { atAncestor: true });
  const r = await cline.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  // Marker is at <root>/project/.clinerules; cwd is <root>/project/sub/deep
  const ancestor = join(env.root, 'project');
  assert.equal(r.paths.project, join(ancestor, '.clinerules', '10x-engineer'));
});

test('detect: paths.global is always null (Cline project-only for v1)', async (t) => {
  const env = await makeEnv(t, { withCline: true });
  const r = await cline.detect(env);
  assert.equal(r.paths.global, null);
});

test('install + uninstall surgical-removal round-trip — user-owned sibling untouched', async (t) => {
  const env = await makeEnv(t, { withCline: true });
  const skills = await loadSkills();
  const detection = await cline.detect(env);

  // Pre-install: seed a sibling marker file the user "already owned" directly
  // under .clinerules/ — alongside (not inside) the 10x-engineer/ install dir.
  // The adapter must NEVER touch this on install or uninstall — surgical
  // removal is ROADMAP cross-phase invariant 4.
  const userMarkerPath = join(env.cwd, '.clinerules', 'user-owned.md');
  const userMarkerBody = '# user-owned rule\nshould survive round-trip\n';
  await writeFile(userMarkerPath, userMarkerBody, 'utf8');
  const userMarkerStatBefore = await stat(userMarkerPath);

  const installRes = await cline.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(installRes.written.length, 11);

  // 11 files materialised at <project>/.clinerules/10x-engineer/
  const installed = (await readdir(detection.paths.project)).sort();
  assert.equal(installed.length, 11);

  // Each file's content matches the corresponding skill's transform output
  const sample = await readFile(join(detection.paths.project, `${skills[0].id}.md`), 'utf8');
  assert.ok(sample.startsWith('---\nname: '));
  assert.ok(sample.includes(skills[0].body));

  const uninstallRes = await cline.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(uninstallRes.removed.length, 1);

  // Post-uninstall assertions:
  // 1) The 10x-engineer install directory is gone.
  assert.equal(existsSync(detection.paths.project), false,
    'post-uninstall: 10x-engineer/ install dir must be removed');

  // 2) .clinerules/ contains EXACTLY the user-owned sibling — the adapter
  //    surgically removed only its own subdir; the parent .clinerules/ is
  //    user-owned territory.
  const clineContents = (await readdir(join(env.cwd, '.clinerules'))).sort();
  assert.deepEqual(clineContents, ['user-owned.md'],
    'post-uninstall .clinerules/ contains only the user-owned sibling; surgical removal — ROADMAP cross-phase invariant 4');

  // 3) The user's sibling file is byte-identical (content + mtime).
  const userMarkerBodyAfter = await readFile(userMarkerPath, 'utf8');
  assert.equal(userMarkerBodyAfter, userMarkerBody,
    'post-uninstall: user-owned sibling content untouched');
  const userMarkerStatAfter = await stat(userMarkerPath);
  assert.equal(userMarkerStatAfter.mtimeMs, userMarkerStatBefore.mtimeMs,
    'post-uninstall: user-owned sibling mtime unchanged');
});

test('install is idempotent: re-running does not duplicate files', async (t) => {
  const env = await makeEnv(t, { withCline: true });
  const skills = await loadSkills();
  const detection = await cline.detect(env);

  await cline.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });
  await cline.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });

  const installed = (await readdir(detection.paths.project)).sort();
  assert.equal(installed.length, 11, 'expected exactly 11 files after re-install (no duplicates)');
});

test('dryRun:true does not touch disk; parent dir mtime unchanged', async (t) => {
  const env = await makeEnv(t, { withCline: true });
  const skills = await loadSkills();
  const detection = await cline.detect(env);

  const before = await stat(join(env.cwd, '.clinerules'));

  const r = await cline.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true,
  });
  assert.equal(r.written.length, 11, 'written array must record would-be paths even with dryRun:true');

  // No files materialised
  await assert.rejects(readdir(detection.paths.project), { code: 'ENOENT' });

  const after = await stat(join(env.cwd, '.clinerules'));
  assert.equal(before.mtimeMs, after.mtimeMs, 'parent dir mtime must be unchanged on dryRun');
});
