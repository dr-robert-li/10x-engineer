// test/adapter-cursor.test.js — TIER1-02.
//
// Eight named tests covering the full round-trip matrix for the Cursor adapter:
//   1. detect: no .cursor/ anywhere → found:false
//   2. detect: .cursor/ at cwd → scope=project
//   3. detect: .cursor/ at ancestor of cwd → ancestor walk finds it
//   4. detect: .git boundary halt → no bleed across project trees
//   5. detect: paths.global is always null (project-only adapter)
//   6. install + uninstall surgical-removal round-trip with user-owned sibling
//      proof — load-bearing for ROADMAP cross-phase invariant 4
//   7. idempotent re-install (no duplicates)
//   8. dryRun:true never touches disk; pre-existing sentinel mtime unchanged
//
// Every test uses mkdtemp to build an isolated environment and threads cwd
// and homedir into the adapter (D2-24). The real ~/.cursor is never read.
// Mirrors test/adapter-claude-code.test.js shape with substitutions for
// ancestor walk + mdc format + project-only scope.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readdir, stat, readFile, writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cursor from '../lib/adapters/cursor.js';
import { loadSkills } from '../lib/skills.js';

/**
 * Build an isolated test environment. Creates separate cwd-root and homedir-root
 * directories under a single mkdtemp. Caller asks for `.cursor/` placement:
 *   - withCursor:'cwd'      → seed .cursor/ at cwd
 *   - withCursor:'ancestor' → seed .cursor/ at the project root, place cwd
 *                             one level deeper (so the walk has to ascend)
 *   - withCursor:false      → no .cursor/ anywhere
 */
async function makeEnv(t, { withCursor }) {
  const root = await mkdtemp(join(tmpdir(), '10xe-cursor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const projectRoot = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(projectRoot, { recursive: true });

  let cwd = projectRoot;
  if (withCursor === 'cwd') {
    await mkdir(join(projectRoot, '.cursor'), { recursive: true });
  } else if (withCursor === 'ancestor') {
    await mkdir(join(projectRoot, '.cursor'), { recursive: true });
    cwd = join(projectRoot, 'src', 'inner');
    await mkdir(cwd, { recursive: true });
  }
  return { root, homedir, cwd, projectRoot };
}

test('cursor adapter: detect — no .cursor/ anywhere → found:false', async (t) => {
  const env = await makeEnv(t, { withCursor: false });
  const r = await cursor.detect({ cwd: env.cwd, homedir: env.homedir });
  assert.equal(r.found, false);
});

test('cursor adapter: detect — .cursor/ at cwd → scope=project, paths anchored to cwd', async (t) => {
  const env = await makeEnv(t, { withCursor: 'cwd' });
  const r = await cursor.detect({ cwd: env.cwd, homedir: env.homedir });
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, '.cursor', 'rules', '10x-engineer'));
});

test('cursor adapter: detect — .cursor/ at ancestor → walk finds it, paths anchored to ancestor', async (t) => {
  const env = await makeEnv(t, { withCursor: 'ancestor' });
  const r = await cursor.detect({ cwd: env.cwd, homedir: env.homedir });
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  // .cursor/ lives at projectRoot, cwd is two levels deeper — the walk must
  // ascend back to projectRoot to find the marker.
  assert.equal(r.paths.project, join(env.projectRoot, '.cursor', 'rules', '10x-engineer'));
});

test('cursor adapter: detect — .git boundary halts walk (no bleed across project trees)', async (t) => {
  const env = await makeEnv(t, { withCursor: false });
  // .cursor/ exists in a sibling subtree under root
  const sibling = join(env.root, 'sibling');
  await mkdir(join(sibling, '.cursor'), { recursive: true });
  // cwd has its own .git boundary at the project root
  await mkdir(join(env.cwd, '.git'), { recursive: true });
  const r = await cursor.detect({ cwd: env.cwd, homedir: env.homedir });
  assert.equal(r.found, false,
    '.git boundary at cwd must halt the walk before any sibling .cursor/ is visible');
});

test('cursor adapter: detect — paths.global is always null (project-only adapter)', async (t) => {
  const envCwd = await makeEnv(t, { withCursor: 'cwd' });
  const r1 = await cursor.detect({ cwd: envCwd.cwd, homedir: envCwd.homedir });
  assert.equal(r1.found, true);
  assert.equal(r1.paths.global, null,
    'Cursor has no stable global rules dir — paths.global must be null on positive detect');

  const envAnc = await makeEnv(t, { withCursor: 'ancestor' });
  const r2 = await cursor.detect({ cwd: envAnc.cwd, homedir: envAnc.homedir });
  assert.equal(r2.found, true);
  assert.equal(r2.paths.global, null);
});

test('cursor adapter: install+uninstall surgical-removal — user-owned sibling untouched', async (t) => {
  const env = await makeEnv(t, { withCursor: 'cwd' });
  // Pre-seed user-owned sibling at .cursor/rules/preexisting.mdc
  await mkdir(join(env.cwd, '.cursor', 'rules'), { recursive: true });
  const userMarkerPath = join(env.cwd, '.cursor', 'rules', 'preexisting.mdc');
  const userMarkerBody = '---\ndescription: user-owned\nglobs: ["**/*"]\nalwaysApply: false\n---\n# user content\n';
  await writeFile(userMarkerPath, userMarkerBody, 'utf8');
  const userMarkerStatBefore = await stat(userMarkerPath);

  const skills = await loadSkills();
  const detection = await cursor.detect({ cwd: env.cwd, homedir: env.homedir });
  assert.equal(detection.found, true);

  const installRes = await cursor.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(installRes.written.length, 10, 'expected exactly 10 .mdc files written');
  for (const p of installRes.written) {
    assert.match(p, /\.mdc$/, `expected .mdc extension on every written path, got ${p}`);
  }

  // 10 files materialised at <cursor/rules/10x-engineer>/
  const installed = (await readdir(detection.paths.project)).sort();
  assert.equal(installed.length, 10);
  for (const f of installed) {
    assert.match(f, /\.mdc$/);
  }

  // Each file's content carries the canonical three-key mdc frontmatter
  const sample = await readFile(join(detection.paths.project, `${skills[0].id}.mdc`), 'utf8');
  assert.ok(sample.startsWith('---\n'), 'mdc files must begin with frontmatter fence');
  assert.ok(sample.includes('description:'), 'mdc files must carry a description key');
  assert.ok(sample.includes('globs: ["**/*"]'), 'mdc files must carry the globs key');
  assert.ok(sample.includes('alwaysApply: false'), 'mdc files must carry the alwaysApply key');
  assert.ok(sample.includes(skills[0].body), 'mdc body must be the verbatim skill body');

  // Uninstall — surgical removal of only the 10x-engineer/ subdir
  const uninstallRes = await cursor.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(uninstallRes.removed.length, 1);

  // Post-uninstall assertions:
  // 1) The 10x-engineer install directory is gone.
  assert.equal(existsSync(detection.paths.project), false,
    'post-uninstall: 10x-engineer/ install dir must be removed');

  // 2) The parent .cursor/rules/ directory remains and contains exactly the
  //    user-owned sibling — never .cursor/ itself, never .cursor/rules/ itself.
  const rulesContents = (await readdir(join(env.cwd, '.cursor', 'rules'))).sort();
  assert.deepEqual(rulesContents, ['preexisting.mdc'],
    'post-uninstall .cursor/rules/ must contain only the user-owned sibling (surgical removal)');

  // 3) The user-owned sibling is byte-identical (content + mtime).
  const userMarkerBodyAfter = await readFile(userMarkerPath, 'utf8');
  assert.equal(userMarkerBodyAfter, userMarkerBody,
    'post-uninstall: user-owned sibling content untouched');
  const userMarkerStatAfter = await stat(userMarkerPath);
  assert.equal(userMarkerStatAfter.mtimeMs, userMarkerStatBefore.mtimeMs,
    'post-uninstall: user-owned sibling mtime unchanged');
});

test('cursor adapter: install is idempotent — re-running does not duplicate files', async (t) => {
  const env = await makeEnv(t, { withCursor: 'cwd' });
  const skills = await loadSkills();
  const detection = await cursor.detect({ cwd: env.cwd, homedir: env.homedir });

  await cursor.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });
  await cursor.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });

  const installed = (await readdir(detection.paths.project)).sort();
  assert.equal(installed.length, 10, 'expected exactly 10 files after re-install (no duplicates)');
});

test('cursor adapter: dryRun:true does not touch disk; pre-existing sentinel mtime unchanged', async (t) => {
  const env = await makeEnv(t, { withCursor: 'cwd' });
  // Pre-seed a sentinel under .cursor/ to prove dryRun does not reach into the tree
  await mkdir(join(env.cwd, '.cursor', 'rules'), { recursive: true });
  const sentinel = join(env.cwd, '.cursor', 'rules', 'sentinel.mdc');
  await writeFile(sentinel, 'sentinel\n', 'utf8');
  const before = await stat(sentinel);

  const skills = await loadSkills();
  const detection = await cursor.detect({ cwd: env.cwd, homedir: env.homedir });

  const r = await cursor.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true,
  });
  assert.equal(r.written.length, 10, 'written array must record would-be paths even with dryRun:true');

  // No files materialised at the install dir
  await assert.rejects(readdir(detection.paths.project), { code: 'ENOENT' });

  // Sentinel mtime untouched
  const after = await stat(sentinel);
  assert.equal(before.mtimeMs, after.mtimeMs, 'sentinel mtime must be unchanged on dryRun');
});
