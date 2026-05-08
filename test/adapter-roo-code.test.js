// test/adapter-roo-code.test.js — TIER2-10 round-trip suite for the Roo Code
// adapter.
//
// Eleven named tests covering the Roo Code adapter contract:
//   1. detect: no markers anywhere → found:false
//   2. detect: .roo/ at cwd → scope='project', paths.project resolved
//   3. detect: .roorules (legacy file) at cwd → still resolves to the modern
//      path under .roo/rules/10x-engineer/ (forward normalisation — load-bearing)
//   4. detect: .roo/ at ancestor → walk finds it, install path anchored to ancestor
//   5. detect: paths.global is always null (Roo Code project-only, Pitfall 11)
//   6. install + uninstall surgical-removal round-trip: a user-owned sibling
//      under .roo/rules/ survives a full round-trip byte-identically — load-
//      bearing test for ROADMAP cross-phase invariant 4.
//   7. idempotent re-install (no duplicates)
//   8. dryRun:true install: no writes, parent dir mtime unchanged
//   9. dryRun:true uninstall: install dir still present afterwards
//  10. uninstall when 10x-engineer/ already absent → graceful, no throw
//  11. install with scope='global' → returns { written: [], skipped: [] }
//      (Pitfall 11: project-only invariant)
//
// Every test uses mkdtemp to build an isolated environment and threads cwd
// and homedir into the adapter (D2-24). The real ~ and the real cwd are
// never read. homedir is set to the mkdtemp root so the bounded ancestor
// walk halts at the env root rather than traversing the entire filesystem.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readdir, stat, readFile, writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import rooCode from '../lib/adapters/roo-code.js';
import { loadSkills } from '../lib/skills.js';

/**
 * Build an isolated test environment. Creates a homedir-equivalent root and
 * a project subdirectory under a single mkdtemp. Pin homedir = root so the
 * findAncestorWith walk halts at the env root.
 *
 * @param {object} opts
 * @param {boolean} [opts.withRoo]       create .roo/ directory at the project level
 * @param {boolean} [opts.withRoorules]  create legacy .roorules FILE at the project level
 * @param {boolean} [opts.atAncestor]    create .roo/ at the env root and
 *                                       deepen cwd to project/sub/deep
 */
async function makeEnv(t, {
  withRoo = false, withRoorules = false, atAncestor = false,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-roo-code-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = root;
  const cwd = atAncestor ? join(root, 'project', 'sub', 'deep') : join(root, 'project');
  await mkdir(cwd, { recursive: true });
  if (withRoo && !atAncestor) await mkdir(join(cwd, '.roo'));
  // Legacy `.roorules` is a FILE per vendor docs ("legacy file-based fallback").
  if (withRoorules && !atAncestor) await writeFile(join(cwd, '.roorules'), '', 'utf8');
  if (atAncestor) await mkdir(join(root, 'project', '.roo'));
  return { root, homedir, cwd };
}

test('detect: no markers anywhere → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await rooCode.detect(env);
  assert.equal(r.found, false);
});

test('detect: .roo/ at cwd → scope=project, paths.project resolved', async (t) => {
  const env = await makeEnv(t, { withRoo: true });
  const r = await rooCode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, '.roo', 'rules', '10x-engineer'));
});

test('detect: .roorules (legacy) at cwd → install path normalises forward to .roo/rules/10x-engineer', async (t) => {
  const env = await makeEnv(t, { withRoorules: true });
  const r = await rooCode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  // Adapter normalises forward: even when detection matched on the legacy
  // .roorules file, the install path is the modern .roo/rules/10x-engineer/
  // location. This is the load-bearing forward-normalisation assertion.
  assert.equal(r.paths.project, join(env.cwd, '.roo', 'rules', '10x-engineer'));
});

test('detect: .roo/ at ancestor → walk finds it, install path anchored to ancestor', async (t) => {
  const env = await makeEnv(t, { atAncestor: true });
  const r = await rooCode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  // Marker is at <root>/project/.roo; cwd is <root>/project/sub/deep
  const ancestor = join(env.root, 'project');
  assert.equal(r.paths.project, join(ancestor, '.roo', 'rules', '10x-engineer'));
});

test('detect: paths.global is always null (Roo Code project-only — Pitfall 11)', async (t) => {
  const env = await makeEnv(t, { withRoo: true });
  const r = await rooCode.detect(env);
  assert.equal(r.paths.global, null);
});

test('install + uninstall surgical-removal round-trip — user-owned sibling untouched', async (t) => {
  const env = await makeEnv(t, { withRoo: true });
  const skills = await loadSkills();
  const detection = await rooCode.detect(env);

  // Pre-install: seed a sibling marker file the user "already owned" directly
  // under .roo/rules/ — alongside (not inside) the 10x-engineer/ install dir.
  // The adapter must NEVER touch this on install or uninstall — surgical
  // removal is ROADMAP cross-phase invariant 4.
  await mkdir(join(env.cwd, '.roo', 'rules'), { recursive: true });
  const userMarkerPath = join(env.cwd, '.roo', 'rules', 'user-rule.md');
  const userMarkerBody = '# user-owned rule\nshould survive round-trip\n';
  await writeFile(userMarkerPath, userMarkerBody, 'utf8');
  const userMarkerStatBefore = await stat(userMarkerPath);

  const installRes = await rooCode.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(installRes.written.length, 10);

  // 10 files materialised at <project>/.roo/rules/10x-engineer/
  const installed = (await readdir(detection.paths.project)).sort();
  assert.equal(installed.length, 10);

  // Each file's content matches the corresponding skill's transform output
  const sample = await readFile(join(detection.paths.project, `${skills[0].id}.md`), 'utf8');
  assert.ok(sample.startsWith('---\nname: '));
  assert.ok(sample.includes(skills[0].body));

  const uninstallRes = await rooCode.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(uninstallRes.removed.length, 1);

  // Post-uninstall assertions:
  // 1) The 10x-engineer install directory is gone.
  assert.equal(existsSync(detection.paths.project), false,
    'post-uninstall: 10x-engineer/ install dir must be removed');

  // 2) .roo/rules/ contains EXACTLY the user-owned sibling — the adapter
  //    surgically removed only its own subdir; the parent .roo/rules/ is
  //    user-owned territory.
  const rulesContents = (await readdir(join(env.cwd, '.roo', 'rules'))).sort();
  assert.deepEqual(rulesContents, ['user-rule.md'],
    'post-uninstall .roo/rules/ contains only the user-owned sibling; surgical removal — ROADMAP cross-phase invariant 4');

  // 3) The user's sibling file is byte-identical (content + mtime).
  const userMarkerBodyAfter = await readFile(userMarkerPath, 'utf8');
  assert.equal(userMarkerBodyAfter, userMarkerBody,
    'post-uninstall: user-owned sibling content untouched');
  const userMarkerStatAfter = await stat(userMarkerPath);
  assert.equal(userMarkerStatAfter.mtimeMs, userMarkerStatBefore.mtimeMs,
    'post-uninstall: user-owned sibling mtime unchanged');
});

test('install is idempotent: re-running does not duplicate files', async (t) => {
  const env = await makeEnv(t, { withRoo: true });
  const skills = await loadSkills();
  const detection = await rooCode.detect(env);

  await rooCode.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });
  await rooCode.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });

  const installed = (await readdir(detection.paths.project)).sort();
  assert.equal(installed.length, 10, 'expected exactly 10 files after re-install (no duplicates)');
});

test('dryRun: true install does not touch disk; parent dir mtime unchanged', async (t) => {
  const env = await makeEnv(t, { withRoo: true });
  const skills = await loadSkills();
  const detection = await rooCode.detect(env);

  const before = await stat(join(env.cwd, '.roo'));

  const r = await rooCode.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true,
  });
  assert.equal(r.written.length, 10, 'written array must record would-be paths even with dryRun:true');

  // No files materialised
  await assert.rejects(readdir(detection.paths.project), { code: 'ENOENT' });

  const after = await stat(join(env.cwd, '.roo'));
  assert.equal(before.mtimeMs, after.mtimeMs, 'parent .roo/ mtime must be unchanged on dryRun');
});

test('dryRun: true uninstall does not touch disk; install dir still present', async (t) => {
  const env = await makeEnv(t, { withRoo: true });
  const skills = await loadSkills();
  const detection = await rooCode.detect(env);

  await rooCode.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });
  assert.equal(existsSync(detection.paths.project), true);

  const r = await rooCode.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: true,
  });
  assert.equal(r.removed.length, 1, 'removed array records the would-be path even on dryRun');
  assert.equal(existsSync(detection.paths.project), true,
    'dryRun uninstall must leave the install dir on disk');
});

test('uninstall when 10x-engineer/ already absent → graceful, no throw', async (t) => {
  const env = await makeEnv(t, { withRoo: true });
  const detection = await rooCode.detect(env);

  // No prior install — call uninstall directly. rm with force:true tolerates ENOENT.
  const r = await rooCode.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(r.removed.length, 1, 'returns the would-be removed path even when nothing existed');
});

test('install with scope=\'global\' → returns { written: [], skipped: [] } (Pitfall 11 — project-only)', async (t) => {
  const env = await makeEnv(t, { withRoo: true });
  const skills = await loadSkills();
  const detection = await rooCode.detect(env);

  // Force scope='global' even though the adapter is project-only. Per
  // Pitfall 11 the adapter must short-circuit and write nothing.
  const r = await rooCode.install({
    skills, scope: 'global', paths: detection.paths, dryRun: false,
  });
  assert.deepEqual(r, { written: [], skipped: [] },
    'scope=global must yield an empty no-op result; Pitfall 11 project-only invariant');
});
