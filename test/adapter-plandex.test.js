// test/adapter-plandex.test.js — TIER2-12 Plandex adapter test suite.
//
// Plandex is a project-file fallback adapter. Per LOCKED USER DECISION #2
// (recorded in 04-PHASE-CONTEXT.md), vendor docs are silent on a custom
// system-prompt / persistent-rules path; the install destination is
// <cwd>/PLANDEX.md, owned by 10x-engineer, gated by a first-line heuristic
// for refuse-to-overwrite safety. Plandex's runtime requires the user to
// run `plandex load PLANDEX.md` to pull the persona into context — the
// adapter cannot trigger this; it returns the instruction in the install
// result's `notes` field.
//
// Twelve named tests:
//   1.  detect: nothing → found:false
//   2.  detect: plandex on PATH but no filesystem signal → found:false
//       (Pitfall 10: PATH alone is insufficient)
//   3.  detect: <cwd>/.plandex/ present → scope='project'
//   4.  detect: <cwd>/PLANDEX.md present → scope='project'
//   5.  detect: paths.global is always null (project-only invariant)
//   6.  install + uninstall round-trip — concat-md content correct
//   7.  install is idempotent: re-running yields byte-identical content
//   8.  install refuses to overwrite a non-10x-engineer PLANDEX.md
//       (first-line heuristic), records the skip, file unchanged
//   9.  uninstall refuses to delete a non-10x-engineer PLANDEX.md (heuristic)
//   10. uninstall on missing file → graceful, no throw
//   11. dryRun:true does not change PLANDEX.md mtime / does not create the file
//   12. install returns notes with `plandex load PLANDEX.md` instruction
//
// Per-test isolation via mkdtemp('10xe-plandex-'). cwd and homedir are
// injected into the adapter (D2-24) — never read from process or node:os.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, mkdir, writeFile, readFile, stat, rm,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import plandex from '../lib/adapters/plandex.js';
import { loadSkills } from '../lib/skills.js';

// ---- PATH isolation ---------------------------------------------------------
// Some tests need a synthetic PATH containing a fake `plandex` binary; others
// need PATH cleared so the host's `plandex` binary cannot leak into a
// found:false assertion. Save the original at file scope and restore on exit.
const ORIGINAL_PATH = process.env.PATH;
process.env.PATH = '';
process.on('exit', () => { process.env.PATH = ORIGINAL_PATH; });

/**
 * Build an isolated test environment under one mkdtemp.
 *   - homedir at <root>/home
 *   - cwd at <root>/project
 *   - optional <cwd>/.plandex/ directory signal
 *   - optional <cwd>/PLANDEX.md file (with caller-supplied content)
 *   - optional synthetic PATH carrying a fake `plandex` binary
 */
async function makeEnv(t, {
  withProjectPlandexDir = false,
  withProjectPlandexMd = false,
  plandexMdContent = '',
  withFakeBinaryOnPath = false,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-plandex-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (withProjectPlandexDir) {
    await mkdir(join(cwd, '.plandex'), { recursive: true });
  }
  if (withProjectPlandexMd) {
    await writeFile(join(cwd, 'PLANDEX.md'), plandexMdContent, 'utf8');
  }
  if (withFakeBinaryOnPath) {
    const binDir = join(root, 'bin');
    await mkdir(binDir, { recursive: true });
    const binPath = join(binDir, 'plandex');
    await writeFile(binPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const orig = process.env.PATH;
    process.env.PATH = binDir + (orig ? delimiter + orig : '');
    t.after(() => { process.env.PATH = orig; });
  }
  return { root, homedir, cwd };
}

// ---- detect -----------------------------------------------------------------

test('plandex detect: nothing → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await plandex.detect(env);
  assert.equal(r.found, false);
});

test('plandex detect: PATH alone is insufficient (Pitfall 10) — binary on PATH but no filesystem signal → found:false', async (t) => {
  const env = await makeEnv(t, { withFakeBinaryOnPath: true });
  const r = await plandex.detect(env);
  assert.equal(r.found, false,
    'Pitfall 10: a PATH-binary alone with no filesystem signal must not register as detected');
});

test('plandex detect: <cwd>/.plandex/ present → scope=project, paths.project resolved', async (t) => {
  const env = await makeEnv(t, { withProjectPlandexDir: true });
  const r = await plandex.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, 'PLANDEX.md'));
});

test('plandex detect: <cwd>/PLANDEX.md present → scope=project (file alone is a signal)', async (t) => {
  const env = await makeEnv(t, {
    withProjectPlandexMd: true,
    plandexMdContent: '# 10x-engineer persona\n\nstub\n',
  });
  const r = await plandex.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, 'PLANDEX.md'));
});

test('plandex detect: paths.global is always null — project-only invariant', async (t) => {
  const env = await makeEnv(t, { withProjectPlandexDir: true });
  const r = await plandex.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.paths.global, null,
    'paths.global must be null — Plandex adapter is project-only per LOCKED USER DECISION');
});

// ---- install + uninstall ----------------------------------------------------

test('plandex install + uninstall round-trip — concat-md content correct, file removed on uninstall', async (t) => {
  const env = await makeEnv(t, { withProjectPlandexDir: true });
  const skills = await loadSkills();
  const detection = await plandex.detect(env);

  const installRes = await plandex.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  assert.equal(installRes.written.length, 1);
  assert.equal(installRes.written[0], detection.paths.project);
  assert.equal(installRes.skipped.length, 0);

  // Content sanity: persona header + every skill's h2 in stable order.
  const installedContent = await readFile(detection.paths.project, 'utf8');
  assert.ok(installedContent.startsWith('# 10x-engineer persona (v0.1.0)'),
    'concat-md output must begin with the persona header that drives the first-line heuristic');
  let cursor = 0;
  for (const s of skills) {
    const idx = installedContent.indexOf(`## ${s.name}`, cursor);
    assert.ok(idx >= 0, `expected '## ${s.name}' at or after offset ${cursor}`);
    cursor = idx;
  }

  // Uninstall
  const uninstallRes = await plandex.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(uninstallRes.removed.length, 1);
  assert.equal(uninstallRes.removed[0], detection.paths.project);
  assert.equal(existsSync(detection.paths.project), false,
    'post-uninstall: PLANDEX.md must be unlinked');
});

test('plandex install is idempotent: re-running yields byte-identical content', async (t) => {
  const env = await makeEnv(t, { withProjectPlandexDir: true });
  const skills = await loadSkills();
  const detection = await plandex.detect(env);

  await plandex.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0' });
  const first = await readFile(detection.paths.project, 'utf8');
  await plandex.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0' });
  const second = await readFile(detection.paths.project, 'utf8');
  assert.equal(first, second, 're-install must yield byte-identical content');
});

test('plandex install refuses to overwrite a user-owned PLANDEX.md (first-line heuristic)', async (t) => {
  const userBody = '# my own plandex notes\n\nplease do not clobber\n';
  const env = await makeEnv(t, {
    withProjectPlandexDir: true,
    withProjectPlandexMd: true,
    plandexMdContent: userBody,
  });
  const skills = await loadSkills();
  const detection = await plandex.detect(env);
  const before = await readFile(detection.paths.project, 'utf8');
  const beforeStat = await stat(detection.paths.project);

  const r = await plandex.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  assert.equal(r.written.length, 0,
    'refuse-to-overwrite: user-owned PLANDEX.md must not be written');
  assert.equal(r.skipped.length, 1,
    'refuse-to-overwrite: skip is recorded in the skipped channel');
  assert.match(r.skipped[0], /refus/,
    'skip message names the refuse-to-overwrite reason');

  // File untouched (content + mtime).
  const after = await readFile(detection.paths.project, 'utf8');
  assert.equal(after, before, 'user-owned PLANDEX.md content must be byte-identical');
  const afterStat = await stat(detection.paths.project);
  assert.equal(afterStat.mtimeMs, beforeStat.mtimeMs,
    'user-owned PLANDEX.md mtime must be unchanged');
});

test('plandex uninstall refuses to delete a user-owned PLANDEX.md (first-line heuristic)', async (t) => {
  const userBody = '# my own plandex notes\n\nstays\n';
  const env = await makeEnv(t, {
    withProjectPlandexDir: true,
    withProjectPlandexMd: true,
    plandexMdContent: userBody,
  });
  const detection = await plandex.detect(env);

  const r = await plandex.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(r.removed.length, 0,
    'uninstall must refuse to remove a user-owned PLANDEX.md');
  assert.equal(existsSync(detection.paths.project), true);
  const after = await readFile(detection.paths.project, 'utf8');
  assert.equal(after, userBody);
});

test('plandex uninstall on missing PLANDEX.md → graceful, no throw', async (t) => {
  const env = await makeEnv(t, { withProjectPlandexDir: true });
  const detection = await plandex.detect(env);
  const r = await plandex.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.deepEqual(r.removed, [], 'no-op uninstall returns empty removed array');
});

test('plandex dryRun:true does not change disk — PLANDEX.md not created and parent dir mtime unchanged', async (t) => {
  const env = await makeEnv(t, { withProjectPlandexDir: true });
  const skills = await loadSkills();
  const detection = await plandex.detect(env);

  const cwdStatBefore = await stat(env.cwd);

  const r = await plandex.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 1, 'written array still records would-be path under dryRun:true');
  assert.equal(existsSync(detection.paths.project), false,
    'dryRun:true must not materialise PLANDEX.md');

  const cwdStatAfter = await stat(env.cwd);
  assert.equal(cwdStatBefore.mtimeMs, cwdStatAfter.mtimeMs,
    'dryRun:true must not touch the parent cwd mtime');
});

test('plandex install returns notes with `plandex load PLANDEX.md` instruction (locked-user-decision instructional channel)', async (t) => {
  const env = await makeEnv(t, { withProjectPlandexDir: true });
  const skills = await loadSkills();
  const detection = await plandex.detect(env);

  const r = await plandex.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  assert.equal(r.written.length, 1);
  assert.ok(Array.isArray(r.notes),
    'install result must include a notes array carrying the plandex-load instruction');
  assert.equal(r.notes.length, 1);
  assert.match(r.notes[0], /plandex load PLANDEX\.md/,
    'notes message must instruct the user to run `plandex load PLANDEX.md`');
});
