// test/adapter-pieces.test.js — TIER2-01 round-trip suite for the Pieces
// adapter. Pieces is a project-file fallback: vendor docs (verified 2026-05-08)
// are silent on a stable rules path, so 10x-engineer owns <cwd>/PIECES.md
// outright. Markerless. The destination filename is generic enough that a
// user might one day place their own PIECES.md at a project root, so install
// and uninstall both gate on a first-line heuristic (mirrors aider.js).
//
// Eleven named tests covering the Pieces adapter contract:
//   1.  detect: nothing                                       → found:false
//   2.  detect: ~/.config/Pieces/ only                        → scope=project
//   3.  detect: <cwd>/PIECES.md only                          → scope=project
//   4.  detect: paths.global is always null on found
//   5.  Pitfall 10 — `pieces` on PATH alone, no FS signal     → found:false
//   6.  install + uninstall round-trip — clean cwd, install writes PIECES.md
//       starting with `# 10x-engineer persona`; uninstall removes it
//   7.  install refuses to overwrite a non-10x-engineer PIECES.md
//   8.  uninstall refuses to delete a non-10x-engineer PIECES.md
//   9.  install is idempotent — second install over our own file is OK
//  10.  dryRun:true performs no I/O; cwd mtime unchanged
//  11.  scope='global' (defensive) — install returns { written: [], skipped: [] }
//
// PATH is forcibly cleared at file scope so the host's `pieces` binary cannot
// leak into a test that asserts found:false. Each test mkdtemps an isolated
// environment and threads cwd + homedir into the adapter (D2-24). The real
// $HOME and process.cwd are never read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, mkdir, writeFile, readFile, stat, rm, chmod,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pieces from '../lib/adapters/pieces.js';
import { loadSkills } from '../lib/skills.js';

// ---- PATH isolation ---------------------------------------------------------
const ORIGINAL_PATH = process.env.PATH;
process.env.PATH = '';
process.on('exit', () => { process.env.PATH = ORIGINAL_PATH; });

/**
 * Build an isolated test environment under one mkdtemp.
 *   - homedir at <root>/home
 *   - cwd at <root>/project
 *   - withConfigDir creates <homedir>/.config/Pieces/
 *   - withPiecesMd writes <cwd>/PIECES.md with the given content
 *   - path overrides process.env.PATH (restored after the test)
 */
async function makeEnv(t, {
  withConfigDir = false,
  withPiecesMd = null,
  path: pathOverride,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-pieces-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (withConfigDir) {
    await mkdir(join(homedir, '.config', 'Pieces'), { recursive: true });
  }
  if (withPiecesMd !== null) {
    await writeFile(join(cwd, 'PIECES.md'), withPiecesMd, 'utf8');
  }
  if (pathOverride !== undefined) {
    const orig = process.env.PATH;
    process.env.PATH = pathOverride;
    t.after(() => { process.env.PATH = orig; });
  }
  return { root, homedir, cwd };
}

// ---- detect -----------------------------------------------------------------

test('pieces detect: no FS signals → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await pieces.detect(env);
  assert.equal(r.found, false);
});

test('pieces detect: ~/.config/Pieces/ present → found:true, scope=project', async (t) => {
  const env = await makeEnv(t, { withConfigDir: true });
  const r = await pieces.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, 'PIECES.md'));
});

test('pieces detect: <cwd>/PIECES.md present → found:true, scope=project', async (t) => {
  const env = await makeEnv(t, { withPiecesMd: '# 10x-engineer persona\n' });
  const r = await pieces.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, 'PIECES.md'));
});

test('pieces detect: paths.global is always null when found', async (t) => {
  const env = await makeEnv(t, { withConfigDir: true });
  const r = await pieces.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.paths.global, null);
});

test('pieces detect: Pitfall 10 — `pieces` on PATH alone (no FS signal) is INSUFFICIENT → found:false', async (t) => {
  // Construct a synthetic PATH directory with a fake `pieces` binary, but no
  // ~/.config/Pieces/ and no <cwd>/PIECES.md. PATH alone must not flip
  // found:true, otherwise installing globally pollutes random project roots.
  const root = await mkdtemp(join(tmpdir(), '10xe-pieces-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  const fakeBinDir = join(root, 'bin');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  await mkdir(fakeBinDir, { recursive: true });
  const fakePieces = join(fakeBinDir, 'pieces');
  await writeFile(fakePieces, '#!/bin/sh\nexit 0\n');
  await chmod(fakePieces, 0o755);

  const orig = process.env.PATH;
  process.env.PATH = fakeBinDir;
  t.after(() => { process.env.PATH = orig; });

  const r = await pieces.detect({ cwd, homedir });
  assert.equal(r.found, false,
    'PATH binary alone must NOT flip found:true — at least one FS signal is required');
});

// ---- install + uninstall ----------------------------------------------------

test('pieces install + uninstall round-trip — writes PIECES.md, then unlinks it', async (t) => {
  const env = await makeEnv(t, { withConfigDir: true });
  const skills = await loadSkills();
  const detection = await pieces.detect(env);

  // Install
  const installRes = await pieces.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  assert.equal(installRes.written.length, 1);
  assert.equal(installRes.written[0], detection.paths.project);
  assert.equal(installRes.skipped.length, 0);

  // PIECES.md exists with the persona header on first line
  assert.equal(existsSync(detection.paths.project), true);
  const installedContent = await readFile(detection.paths.project, 'utf8');
  assert.ok(installedContent.startsWith('# 10x-engineer persona (v0.1.0)'),
    'installed PIECES.md must begin with the 10x-engineer persona header');

  // Every skill h2 appears in stable order
  let cursor = 0;
  for (const s of skills) {
    const idx = installedContent.indexOf(`## ${s.name}`, cursor);
    assert.ok(idx >= 0, `expected '## ${s.name}' at or after offset ${cursor}`);
    cursor = idx;
  }

  // Uninstall
  const uninstallRes = await pieces.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(uninstallRes.removed.length, 1);
  assert.equal(uninstallRes.removed[0], detection.paths.project);
  assert.equal(existsSync(detection.paths.project), false,
    'post-uninstall: PIECES.md must be unlinked');
});

test('pieces install refuses to overwrite a non-10x-engineer PIECES.md', async (t) => {
  const userContent = '# my notes\n\nPersonal pieces of code I want to remember.\n';
  const env = await makeEnv(t, { withConfigDir: true, withPiecesMd: userContent });
  const detection = await pieces.detect(env);
  const skills = await loadSkills();
  const before = await stat(detection.paths.project);

  const r = await pieces.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  assert.equal(r.written.length, 0, 'must not write when file is user-owned');
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0], /refusing to overwrite/);

  // User content byte-identical
  const after = await readFile(detection.paths.project, 'utf8');
  assert.equal(after, userContent, 'user PIECES.md must not be modified');
  const afterStat = await stat(detection.paths.project);
  assert.equal(afterStat.mtimeMs, before.mtimeMs,
    'user PIECES.md mtime must be unchanged on refused install');
});

test('pieces uninstall refuses to delete a non-10x-engineer PIECES.md', async (t) => {
  const userContent = '# my notes\n\nuser-owned file\n';
  const env = await makeEnv(t, { withConfigDir: true, withPiecesMd: userContent });
  const detection = await pieces.detect(env);

  const r = await pieces.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(r.removed.length, 0,
    'uninstall must not unlink a user-owned PIECES.md');
  // File untouched
  const after = await readFile(detection.paths.project, 'utf8');
  assert.equal(after, userContent, 'user PIECES.md must not be deleted');
  assert.equal(existsSync(detection.paths.project), true);
});

test('pieces install is idempotent — re-installing over our own file is OK', async (t) => {
  const env = await makeEnv(t, { withConfigDir: true });
  const skills = await loadSkills();
  const detection = await pieces.detect(env);

  // First install — creates PIECES.md (10x-engineer-owned)
  await pieces.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const first = await readFile(detection.paths.project, 'utf8');

  // Second install — heuristic recognises our own header → re-write same content
  await pieces.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const second = await readFile(detection.paths.project, 'utf8');
  assert.equal(first, second, 're-install over our own file must yield byte-identical content');
});

test('pieces install dryRun:true → no writes, cwd mtime unchanged', async (t) => {
  const env = await makeEnv(t, { withConfigDir: true });
  const skills = await loadSkills();
  const detection = await pieces.detect(env);
  const before = await stat(env.cwd);

  // Wait long enough for mtime resolution to advance had we written.
  await new Promise((r) => setTimeout(r, 25));

  const r = await pieces.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 1, 'written array still records would-be path on dryRun');

  // No file materialised
  assert.equal(existsSync(detection.paths.project), false,
    'dryRun:true must not write PIECES.md');

  const after = await stat(env.cwd);
  assert.equal(before.mtimeMs, after.mtimeMs,
    'cwd mtime must be unchanged on dryRun');
});

test('pieces install scope=global (defensive) → no-op', async (t) => {
  const env = await makeEnv(t, { withConfigDir: true });
  const skills = await loadSkills();
  // Adapter never returns scope=global, but install must defensively no-op
  // if a caller ever hands it one.
  const r = await pieces.install({
    skills, scope: 'global', paths: { global: null, project: join(env.cwd, 'PIECES.md') },
    dryRun: false, version: '0.1.0',
  });
  assert.equal(r.written.length, 0);
  assert.equal(r.skipped.length, 0);
  assert.equal(existsSync(join(env.cwd, 'PIECES.md')), false);
});
