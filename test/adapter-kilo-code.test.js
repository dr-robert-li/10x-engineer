// test/adapter-kilo-code.test.js — TIER1-04.
//
// Seven named tests covering the full round-trip matrix for the Kilo Code
// adapter. Mirrors the claude-code/cline shape but exercises the bounded
// ancestor walk (Kilo is project-only, no global scope).
//
//   1. detect: no .kilocode/ anywhere → found:false
//   2. detect: .kilocode/ at cwd      → found:true, scope:'project'
//   3. detect: .kilocode/ at ancestor → walk finds it, paths anchored at marker
//   4. detect: paths.global is always null (project-only adapter)
//   5. install + uninstall surgical-removal round-trip with a user-owned
//      sibling under .kilocode/rules/ — sibling is byte-identical (content
//      and mtime) after the full cycle. Load-bearing for ROADMAP cross-phase
//      invariant 4.
//   6. install is idempotent: two consecutive installs leave exactly 11 files
//   7. dryRun:true never writes; parent dir mtime unchanged
//
// Every test uses mkdtemp + injected cwd/homedir (D2-24). The real ~/.kilocode
// or any user filesystem state is never read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readdir, stat, readFile, writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import kiloCode from '../lib/adapters/kilo-code.js';
import { loadSkills } from '../lib/skills.js';

/**
 * Build an isolated env. Two layouts are supported:
 *
 *   layout: 'flat'      cwd === markerDir (the .kilocode/ marker sits at cwd)
 *   layout: 'nested'    marker sits at an ancestor; cwd is two levels deeper
 *
 * homedir is always the inclusive upper bound of the ancestor walk; we keep it
 * above the project tree so the walk terminates correctly.
 */
async function makeEnv(t, { withMarker = true, layout = 'flat' } = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-kc-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  await mkdir(homedir, { recursive: true });

  let projectRoot;
  let cwd;
  if (layout === 'flat') {
    projectRoot = join(homedir, 'project');
    cwd = projectRoot;
  } else {
    // nested: cwd is two dirs deep below the marker holder
    projectRoot = join(homedir, 'project');
    cwd = join(projectRoot, 'src', 'lib');
  }
  await mkdir(cwd, { recursive: true });
  if (withMarker) await mkdir(join(projectRoot, '.kilocode'));

  return { root, homedir, cwd, projectRoot };
}

test('detect: no .kilocode/ anywhere → found:false', async (t) => {
  const env = await makeEnv(t, { withMarker: false });
  const r = await kiloCode.detect(env);
  assert.equal(r.found, false);
});

test('detect: .kilocode/ at cwd → found:true, scope=project, paths anchored at cwd', async (t) => {
  const env = await makeEnv(t, { withMarker: true, layout: 'flat' });
  const r = await kiloCode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.projectRoot, '.kilocode', 'rules', '10x-engineer'));
});

test('detect: .kilocode/ at ancestor (cwd is two levels deeper) → walk finds it', async (t) => {
  const env = await makeEnv(t, { withMarker: true, layout: 'nested' });
  const r = await kiloCode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  // Path is anchored at the ancestor that holds .kilocode/, NOT at cwd.
  assert.equal(r.paths.project, join(env.projectRoot, '.kilocode', 'rules', '10x-engineer'));
});

test('detect: paths.global is always null (Kilo Code is project-only in v1)', async (t) => {
  const env = await makeEnv(t, { withMarker: true, layout: 'flat' });
  const r = await kiloCode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.paths.global, null);
});

test('install + uninstall surgical-removal round-trip — user-owned sibling under .kilocode/rules/ untouched', async (t) => {
  const env = await makeEnv(t, { withMarker: true, layout: 'flat' });
  const skills = await loadSkills();
  const detection = await kiloCode.detect(env);

  // Pre-seed a user-owned sibling rule under .kilocode/rules/ — the adapter must
  // never touch this. Surgical removal (ROADMAP cross-phase invariant 4):
  // uninstall removes ONLY the 10x-engineer/ install dir.
  await mkdir(join(env.projectRoot, '.kilocode/rules'), { recursive: true });
  const userRulePath = join(env.projectRoot, '.kilocode/rules/user-rules.md');
  const userRuleBody = '# user-owned rule\nshould survive round-trip\n';
  await writeFile(userRulePath, userRuleBody, 'utf8');
  const userRuleStatBefore = await stat(userRulePath);

  const installRes = await kiloCode.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  // Phase 7 post-partition: 10 response-mode skills only — build-mode-overview
  // is routed through BUILD_MODE_INSTRUCTION + persona.txt and is NEVER
  // installed as a standalone .md by per-skill adapters.
  assert.equal(installRes.written.length, 10);

  const installed = (await readdir(detection.paths.project)).sort();
  assert.equal(installed.length, 10);

  // Each file's content matches the corresponding skill's transform output
  const sample = await readFile(join(detection.paths.project, `${skills[0].id}.md`), 'utf8');
  assert.ok(sample.startsWith('---\nname: '));
  assert.ok(sample.includes(skills[0].body));

  const uninstallRes = await kiloCode.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(uninstallRes.removed.length, 1);

  // Post-uninstall:
  // 1) the 10x-engineer install dir is gone
  assert.equal(existsSync(detection.paths.project), false,
    'post-uninstall: 10x-engineer/ install dir must be removed');

  // 2) user-rules.md still exists under .kilocode/rules/ — surgical removal
  const rulesContents = (await readdir(join(env.projectRoot, '.kilocode/rules'))).sort();
  assert.deepEqual(rulesContents, ['user-rules.md'],
    'post-uninstall .kilocode/rules/ contains only the user-owned sibling; adapter never deletes user-owned files');

  // 3) byte-identical: content + mtime
  const userRuleBodyAfter = await readFile(userRulePath, 'utf8');
  assert.equal(userRuleBodyAfter, userRuleBody,
    'post-uninstall: user-owned sibling content untouched');
  const userRuleStatAfter = await stat(userRulePath);
  assert.equal(userRuleStatAfter.mtimeMs, userRuleStatBefore.mtimeMs,
    'post-uninstall: user-owned sibling mtime unchanged');
});

test('install is idempotent: re-running does not duplicate files', async (t) => {
  const env = await makeEnv(t, { withMarker: true, layout: 'flat' });
  const skills = await loadSkills();
  const detection = await kiloCode.detect(env);

  await kiloCode.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });
  await kiloCode.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });

  const installed = (await readdir(detection.paths.project)).sort();
  assert.equal(installed.length, 10, 'expected exactly 10 files after re-install (no duplicates)');
});

test('dryRun:true does not touch disk; mtime on parent dir unchanged', async (t) => {
  const env = await makeEnv(t, { withMarker: true, layout: 'flat' });
  const skills = await loadSkills();
  const detection = await kiloCode.detect(env);

  const before = await stat(join(env.projectRoot, '.kilocode'));

  const r = await kiloCode.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true,
  });
  assert.equal(r.written.length, 10, 'written array must record would-be paths even with dryRun:true');

  // No files materialised
  await assert.rejects(readdir(detection.paths.project), { code: 'ENOENT' });

  const after = await stat(join(env.projectRoot, '.kilocode'));
  assert.equal(before.mtimeMs, after.mtimeMs, 'parent .kilocode/ mtime must be unchanged on dryRun');
});
