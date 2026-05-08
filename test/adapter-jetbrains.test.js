// test/adapter-jetbrains.test.js — TIER2-09 JetBrains AI Assistant adapter
// test suite.
//
// JetBrains AI is a project-only single-file-replace adapter. The install
// destination is `<projectRoot>/.aiassistant/rules/10x-engineer.md`,
// fully owned by 10x-engineer (markerless; uninstall is a surgical unlink).
//
// LOCKED USER DECISION #3 (recorded in 04-PHASE-CONTEXT.md): retain the
// manual-enable note even though current vendor docs (jetbrains.com,
// verified 2026-05-08) state JetBrains AI auto-enables project rules by
// default. The decision is defensive against future vendor doc drift. The
// install result MUST include a `notes` field carrying the literal text
// "JetBrains AI may require manual enable in some IDE versions." Test 11
// is the load-bearing assertion for this decision.
//
// Eleven named tests:
//   1.  detect: nothing → found:false
//   2.  detect: <cwd>/.idea/ present → found:true, scope='project',
//       paths.project = <cwd>/.aiassistant/rules/10x-engineer.md
//   3.  detect: <cwd>/.aiassistant/ present (no .idea/) → found:true,
//       scope='project'
//   4.  detect: both .idea/ AND .aiassistant/ present → still scope='project',
//       paths.project still ends in .aiassistant/rules/10x-engineer.md
//   5.  detect: paths.global is always null (project-only invariant)
//   6.  install + uninstall round-trip — user-owned sibling under
//       .aiassistant/rules/ byte-identical (content + mtime); parent rules/
//       directory survives uninstall
//   7.  install is idempotent: re-running yields byte-identical content
//   8.  dryRun:true does not change disk (file not created; parent .idea/
//       mtime unchanged; .aiassistant/rules/ never materialised)
//   9.  uninstall on missing file → graceful (no ENOENT throw)
//   10. scope='global' install returns { written: [], skipped: [], notes: [] }
//       — guards the manual-enable note against leaking into a non-project scope
//   11. LOCKED DECISION #3: install result includes `notes` containing the
//       manual-enable text (verbatim match against the canonical wording)
//
// Per-test isolation via mkdtemp('10xe-jetbrains-'). cwd and homedir are
// injected into the adapter (D2-24); the real $HOME and process.cwd are
// never read by the adapter.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readdir, stat, readFile, writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jetbrains from '../lib/adapters/jetbrains.js';
import { loadSkills } from '../lib/skills.js';
import { MARKER_BEGIN_PREFIX } from '../lib/markers.js';

/**
 * Build an isolated test environment under one mkdtemp.
 *   - homedir at <root>/home
 *   - cwd at <root>/project
 *   - optional <cwd>/.idea/        (primary detection signal)
 *   - optional <cwd>/.aiassistant/ (secondary detection signal)
 */
async function makeEnv(t, { withIdea = false, withAiAssistant = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-jetbrains-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (withIdea)         await mkdir(join(cwd, '.idea'));
  if (withAiAssistant)  await mkdir(join(cwd, '.aiassistant'));
  return { root, homedir, cwd };
}

// ---- detect -----------------------------------------------------------------

test('jetbrains detect: no .idea/ and no .aiassistant/ → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await jetbrains.detect(env);
  assert.equal(r.found, false);
});

test('jetbrains detect: <cwd>/.idea/ present → found:true, scope=project, paths.project resolved', async (t) => {
  const env = await makeEnv(t, { withIdea: true });
  const r = await jetbrains.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(
    r.paths.project,
    join(env.cwd, '.aiassistant', 'rules', '10x-engineer.md'),
  );
});

test('jetbrains detect: <cwd>/.aiassistant/ present (no .idea/) → found:true, scope=project', async (t) => {
  const env = await makeEnv(t, { withAiAssistant: true });
  const r = await jetbrains.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(
    r.paths.project,
    join(env.cwd, '.aiassistant', 'rules', '10x-engineer.md'),
  );
});

test('jetbrains detect: both .idea/ AND .aiassistant/ present → scope=project; install destination is .aiassistant-rooted regardless of which signal triggered', async (t) => {
  const env = await makeEnv(t, { withIdea: true, withAiAssistant: true });
  const r = await jetbrains.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project',
    'two signals do not change scope — JetBrains adapter is project-only');
  assert.equal(
    r.paths.project,
    join(env.cwd, '.aiassistant', 'rules', '10x-engineer.md'),
    'install destination is always under .aiassistant/rules/ — not .idea/',
  );
});

test('jetbrains detect: paths.global is always null — project-only invariant', async (t) => {
  const env = await makeEnv(t, { withIdea: true });
  const r = await jetbrains.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.paths.global, null,
    'paths.global must be null — JetBrains adapter is project-only');
});

// ---- install + uninstall ----------------------------------------------------

test('jetbrains install + uninstall round-trip — user-owned sibling under .aiassistant/rules/ byte-identical (content + mtime); parent rules/ dir survives', async (t) => {
  const env = await makeEnv(t, { withIdea: true });
  const skills = await loadSkills();
  const detection = await jetbrains.detect(env);

  // Pre-seed a user-owned sibling under .aiassistant/rules/. It must NEVER
  // be touched by install or uninstall, and uninstall must NOT remove the
  // parent rules/ directory.
  const rulesDir = join(env.cwd, '.aiassistant', 'rules');
  await mkdir(rulesDir, { recursive: true });
  const userRulePath = join(rulesDir, 'user-style.md');
  const userRuleBody = '# user-owned style rule\nshould survive round-trip\n';
  await writeFile(userRulePath, userRuleBody, 'utf8');
  const userRuleStatBefore = await stat(userRulePath);

  // Install
  const installRes = await jetbrains.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  assert.equal(installRes.written.length, 1, 'concat-md writes exactly one file');
  assert.equal(installRes.written[0], detection.paths.project);

  // 10x-engineer.md exists; user-style.md still there
  assert.equal(existsSync(detection.paths.project), true);
  const installedDirContents = (await readdir(rulesDir)).sort();
  assert.deepEqual(installedDirContents, ['10x-engineer.md', 'user-style.md']);

  // Content sanity: persona header + every skill's h2 in stable order
  const installedContent = await readFile(detection.paths.project, 'utf8');
  assert.ok(installedContent.startsWith('# 10x-engineer persona (v0.1.0)'));
  let cursor = 0;
  for (const s of skills) {
    const idx = installedContent.indexOf(`## ${s.name}`, cursor);
    assert.ok(idx >= 0, `expected '## ${s.name}' at or after offset ${cursor}`);
    cursor = idx;
  }

  // Markerless invariant
  assert.equal(installedContent.includes(MARKER_BEGIN_PREFIX), false,
    'concat-md is markerless — emitted file must contain no BEGIN marker');
  assert.equal(installedContent.includes('<!-- END 10x-engineer'), false,
    'concat-md is markerless — emitted file must contain no END marker');

  // Uninstall
  const uninstallRes = await jetbrains.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(uninstallRes.removed.length, 1);
  assert.equal(uninstallRes.removed[0], detection.paths.project);

  // Post-uninstall:
  //  1) 10x-engineer.md unlinked
  assert.equal(existsSync(detection.paths.project), false,
    'post-uninstall: 10x-engineer.md must be unlinked');
  //  2) Parent rules/ dir survives
  assert.equal(existsSync(rulesDir), true,
    'post-uninstall: parent rules/ dir must survive (surgical removal)');
  //  3) user-style.md byte-identical (content + mtime)
  const userRuleBodyAfter = await readFile(userRulePath, 'utf8');
  assert.equal(userRuleBodyAfter, userRuleBody,
    'post-uninstall: user-owned sibling content untouched');
  const userRuleStatAfter = await stat(userRulePath);
  assert.equal(userRuleStatAfter.mtimeMs, userRuleStatBefore.mtimeMs,
    'post-uninstall: user-owned sibling mtime unchanged');
});

test('jetbrains install is idempotent: re-running yields byte-identical content', async (t) => {
  const env = await makeEnv(t, { withIdea: true });
  const skills = await loadSkills();
  const detection = await jetbrains.detect(env);

  await jetbrains.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0' });
  const first = await readFile(detection.paths.project, 'utf8');
  await jetbrains.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0' });
  const second = await readFile(detection.paths.project, 'utf8');
  assert.equal(first, second, 're-install must yield byte-identical content');
});

test('jetbrains dryRun: true does not touch disk; parent .idea/ mtime unchanged; .aiassistant/rules/ never materialised', async (t) => {
  const env = await makeEnv(t, { withIdea: true });
  const skills = await loadSkills();
  const detection = await jetbrains.detect(env);

  // mtime-check on .idea/ — the only pre-existing parent dir in this env.
  const ideaDir = join(env.cwd, '.idea');
  const before = await stat(ideaDir);

  const r = await jetbrains.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 1,
    'written array must record would-be path even with dryRun:true');

  // Nothing materialised — .aiassistant/ was never created
  assert.equal(existsSync(detection.paths.project), false,
    'dryRun:true must not write 10x-engineer.md');
  assert.equal(existsSync(join(env.cwd, '.aiassistant')), false,
    'dryRun:true must not even create the .aiassistant/ tree');

  const after = await stat(ideaDir);
  assert.equal(before.mtimeMs, after.mtimeMs,
    'parent .idea/ mtime must be unchanged on dryRun');
});

test('jetbrains uninstall when 10x-engineer.md is already absent — graceful (no ENOENT throw)', async (t) => {
  const env = await makeEnv(t, { withIdea: true });
  const detection = await jetbrains.detect(env);

  // No prior install; the file does not exist. Uninstall must not throw.
  const r = await jetbrains.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(r.removed.length, 1,
    'removed array still records the would-be path even when file is absent');
  assert.equal(existsSync(detection.paths.project), false);
});

test('jetbrains install with scope="global" → returns { written: [], skipped: [], notes: [] } — guards manual-enable note against scope leak', async (t) => {
  const env = await makeEnv(t, { withIdea: true });
  const skills = await loadSkills();
  const detection = await jetbrains.detect(env);

  // Force a non-project scope — adapter must short-circuit cleanly with
  // empty arrays in all three result channels (written / skipped / notes).
  const r = await jetbrains.install({
    skills,
    scope: 'global',
    paths: detection.paths,
    dryRun: false,
    version: '0.1.0',
  });
  assert.deepEqual(r.written, [],
    'scope=global must yield no writes (adapter is project-only)');
  assert.deepEqual(r.skipped, []);
  assert.deepEqual(r.notes, [],
    'scope=global must yield no notes — manual-enable note must not leak into a scope where no install happened');
});

test('LOCKED USER DECISION #3: install emits manual-enable note in result.notes (defensive against future vendor doc drift)', async (t) => {
  const env = await makeEnv(t, { withIdea: true });
  const skills = await loadSkills();
  const detection = await jetbrains.detect(env);

  const r = await jetbrains.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  assert.equal(r.written.length, 1);
  assert.ok(Array.isArray(r.notes),
    'install result must include a notes array carrying the manual-enable message');
  assert.equal(r.notes.length, 1,
    'exactly one note: the manual-enable message');
  assert.match(r.notes[0], /JetBrains AI may require manual enable/i,
    'notes message must instruct the user that JetBrains AI may require manual enable in some IDE versions');
  // Verbatim canonical wording — locked-decision text must round-trip.
  assert.equal(
    r.notes[0],
    'JetBrains AI may require manual enable in some IDE versions.',
    'note text must match the canonical locked-decision wording verbatim',
  );
});
