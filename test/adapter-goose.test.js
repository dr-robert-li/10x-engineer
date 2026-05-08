// test/adapter-goose.test.js
//
// Goose adapter (TIER2-02) — append-mode round-trip suite. Fourteen named
// tests cover:
//
//   1.  detect: no ~/.config/goose/, no goose on PATH, no project .goosehints → found:false
//   2.  detect: ~/.config/goose/ present                                       → scope:'global'
//   3.  detect: project .goosehints present                                    → scope:'project'
//   4.  detect: both signals present                                           → scope:'both'
//   5.  detect: goose on synthetic PATH (no ~/.config/goose/, no .goosehints)  → scope:'global'
//   6.  install + uninstall round-trip on a populated .goosehints              → byte-identical-around-marker
//   7.  install + uninstall round-trip on a no-trailing-newline file           → bounded \n artefact tolerated
//   8.  install + uninstall round-trip on a CRLF-saved file                    → surrounding bytes byte-identical
//   9.  re-install is idempotent (replaceBlock-in-place)                       → final file content stable
//  10.  uninstall on file with no marker block                                 → graceful no-op, no throw
//  11.  dryRun:true does not touch disk on install; mtime unchanged
//  12.  dryRun:true does not touch disk on uninstall; mtime unchanged
//  13.  install with scope:'global' skips project even when paths.project set
//  14.  install with scope:'project' skips global even when paths.global  set
//
// Every test uses mkdtemp to build an isolated environment and threads cwd
// and homedir into the adapter (D2-24). Since this adapter gates detection
// on PATH, makeEnv saves and isolates process.env.PATH so the host machine's
// $PATH never leaks into a test that asserts found:false.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, mkdir, writeFile, readFile, stat, rm, chmod,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import goose from '../lib/adapters/goose.js';
import { loadSkills } from '../lib/skills.js';
import { assertByteIdenticalAroundMarker } from './helpers/byte-identity.js';

/**
 * Build an isolated test environment under a single mkdtemp. Caller flags
 * which Goose signals to seed (global dir, global .goosehints, project
 * .goosehints, .git anchor for the project root).
 *
 * Critically, this helper also overrides process.env.PATH for the duration of
 * the test so commandExists('goose') does not pick up a host-installed binary.
 * Defaults to '' (no PATH); callers that want PATH-binary detection set it
 * explicitly via opts.path.
 */
async function makeEnv(t, opts = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-goose-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (opts.withGooseHome || opts.withGlobalGoosehints) {
    await mkdir(join(homedir, '.config', 'goose'), { recursive: true });
  }
  if (opts.withGlobalGoosehints) {
    await writeFile(join(homedir, '.config', 'goose', '.goosehints'), opts.globalContent ?? '');
  }
  if (opts.withProjectGoosehints) {
    await writeFile(join(cwd, '.goosehints'), opts.projectContent ?? '');
  }
  if (opts.withGit) {
    await mkdir(join(cwd, '.git'), { recursive: true });
  }

  // PATH isolation: host's installed `goose` (if any) must not leak into a
  // test that asserts found:false or scope:'project'. Test 5 opts in via
  // opts.path = <fake bin dir>.
  const origPath = process.env.PATH;
  process.env.PATH = opts.path ?? '';
  t.after(() => { process.env.PATH = origPath; });

  return { root, homedir, cwd };
}

test('goose detect: nothing → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await goose.detect(env);
  assert.equal(r.found, false);
});

test('goose detect: ~/.config/goose/ present → scope=global, paths.global resolved', async (t) => {
  const env = await makeEnv(t, { withGooseHome: true });
  const r = await goose.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(r.paths.global, join(env.homedir, '.config', 'goose', '.goosehints'));
  assert.equal(r.paths.project, null);
});

test('goose detect: project .goosehints present → scope=project', async (t) => {
  const env = await makeEnv(t, { withProjectGoosehints: true, withGit: true });
  const r = await goose.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, '.goosehints'));
  assert.equal(r.paths.global, null);
});

test('goose detect: both signals present → scope=both', async (t) => {
  const env = await makeEnv(t, {
    withGooseHome: true, withProjectGoosehints: true, withGit: true,
  });
  const r = await goose.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'both');
  assert.ok(r.paths.global);
  assert.ok(r.paths.project);
});

test('goose detect: goose on synthetic PATH → scope=global (PATH-binary fallback)', async (t) => {
  // Build a fake bindir, drop an executable named `goose` into it, then
  // wire env.PATH to point at it. With no ~/.config/goose/ on disk and no
  // project .goosehints, detection must still return found:true via
  // commandExists.
  const root = await mkdtemp(join(tmpdir(), '10xe-goose-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  const fakeBinDir = join(root, 'bin');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  await mkdir(fakeBinDir, { recursive: true });
  const fakeGoose = join(fakeBinDir, 'goose');
  await writeFile(fakeGoose, '#!/bin/sh\nexit 0\n');
  await chmod(fakeGoose, 0o755);

  const origPath = process.env.PATH;
  process.env.PATH = fakeBinDir;
  t.after(() => { process.env.PATH = origPath; });

  const r = await goose.detect({ cwd, homedir });
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(r.paths.global, join(homedir, '.config', 'goose', '.goosehints'));
});

test('goose install + uninstall round-trip on populated .goosehints', async (t) => {
  const original = '# user content\nstuff above the marker\n\nstuff below later\n';
  const env = await makeEnv(t, {
    withProjectGoosehints: true,
    projectContent: original,
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await goose.detect(env);

  await goose.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });

  const afterInstall = await readFile(detection.paths.project, 'utf8');
  assert.ok(afterInstall.includes('# user content\nstuff above the marker'),
    'user content must survive install');
  assert.ok(afterInstall.includes('<!-- BEGIN 10x-engineer'), 'marker block must be present');

  await goose.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('goose install + uninstall round-trip with no-trailing-newline .goosehints', async (t) => {
  // FND-09-refined: a single bounded \n artefact is tolerated by the helper.
  const original = '# rule one without trailing newline'; // no trailing \n
  const env = await makeEnv(t, {
    withProjectGoosehints: true,
    projectContent: original,
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await goose.detect(env);

  await goose.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await goose.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('goose install + uninstall round-trip with CRLF .goosehints', async (t) => {
  // CRLF-saved file. BLOCK_RE in markers.js uses \r?\n; safe-fs preserves
  // BOM (none here) and replaceBlock/stripBlock are CRLF-tolerant.
  const original = '# title\r\nuser line one\r\nuser line two\r\n';
  const env = await makeEnv(t, {
    withProjectGoosehints: true,
    projectContent: original,
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await goose.detect(env);

  await goose.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await goose.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('goose install is idempotent: re-running produces identical content', async (t) => {
  const env = await makeEnv(t, {
    withProjectGoosehints: true,
    projectContent: '# original\n',
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await goose.detect(env);

  await goose.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const afterFirst = await readFile(detection.paths.project, 'utf8');

  await goose.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const afterSecond = await readFile(detection.paths.project, 'utf8');

  assert.equal(afterSecond, afterFirst,
    're-running install must produce byte-identical content (replaceBlock replaces in place)');
});

test('goose uninstall on file with no marker block is a graceful no-op', async (t) => {
  // Pre-existing user content with no install ever performed: stripBlock
  // must return removed:false and leave the file byte-identical (no throw,
  // no mtime change).
  const original = '# pre-existing rules\nno marker block here\n';
  const env = await makeEnv(t, {
    withProjectGoosehints: true,
    projectContent: original,
    withGit: true,
  });
  const detection = await goose.detect(env);

  const before = await stat(detection.paths.project);

  const r = await goose.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  // No path was actually removed (stripBlock returned removed:false), so
  // the removed[] array is empty.
  assert.deepEqual(r.removed, [], 'no-block uninstall must report nothing removed');

  const after = await stat(detection.paths.project);
  assert.equal(before.mtimeMs, after.mtimeMs,
    'file mtime must be unchanged when there is no block to strip');
  const content = await readFile(detection.paths.project, 'utf8');
  assert.equal(content, original, 'file content must be byte-identical');
});

test('goose dryRun:true does not change file mtime on install', async (t) => {
  const env = await makeEnv(t, {
    withProjectGoosehints: true,
    projectContent: '# user content\n',
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await goose.detect(env);

  const before = await stat(detection.paths.project);

  const r = await goose.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 1, 'written array records the would-be path even on dryRun');

  const after = await stat(detection.paths.project);
  assert.equal(before.mtimeMs, after.mtimeMs, 'mtime must be unchanged on dryRun install');

  const content = await readFile(detection.paths.project, 'utf8');
  assert.equal(content, '# user content\n');
});

test('goose dryRun:true does not change file mtime on uninstall', async (t) => {
  // Seed a file that already contains a marker block, then uninstall with
  // dryRun:true and assert mtime / content unchanged.
  const env = await makeEnv(t, {
    withProjectGoosehints: true,
    projectContent: '# user content\n',
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await goose.detect(env);

  // Real install first so there's a block to "remove".
  await goose.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const seeded = await readFile(detection.paths.project, 'utf8');
  const before = await stat(detection.paths.project);

  const r = await goose.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: true,
  });
  assert.deepEqual(r.removed, [detection.paths.project],
    'dryRun uninstall must report the would-be removal path');

  const after = await stat(detection.paths.project);
  assert.equal(before.mtimeMs, after.mtimeMs, 'mtime must be unchanged on dryRun uninstall');

  const content = await readFile(detection.paths.project, 'utf8');
  assert.equal(content, seeded, 'file content must be byte-identical on dryRun uninstall');
});

test('goose install with scope=global skips project even when paths.project is set', async (t) => {
  // Both paths populated but caller asks for scope:'global' only — the
  // project file must be untouched.
  const env = await makeEnv(t, {
    withGooseHome: true,
    withProjectGoosehints: true,
    projectContent: '# project pre\n',
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await goose.detect(env);
  // Sanity: detection found both
  assert.equal(detection.scope, 'both');

  const projectBefore = await stat(detection.paths.project);

  const r = await goose.install({
    skills,
    scope: 'global',
    paths: detection.paths,
    dryRun: false,
    version: '0.1.0',
  });
  assert.equal(r.written.length, 1, 'only one path should be written under scope=global');
  assert.equal(r.written[0], detection.paths.global);

  const projectAfter = await stat(detection.paths.project);
  assert.equal(projectBefore.mtimeMs, projectAfter.mtimeMs,
    'project .goosehints mtime must be unchanged when scope=global');
  const projectContent = await readFile(detection.paths.project, 'utf8');
  assert.equal(projectContent, '# project pre\n',
    'project .goosehints content must be untouched');
});

test('goose install with scope=project skips global even when paths.global is set', async (t) => {
  const env = await makeEnv(t, {
    withGlobalGoosehints: true,
    globalContent: '# global pre\n',
    withProjectGoosehints: true,
    projectContent: '',
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await goose.detect(env);
  assert.equal(detection.scope, 'both');

  const globalBefore = await stat(detection.paths.global);

  const r = await goose.install({
    skills,
    scope: 'project',
    paths: detection.paths,
    dryRun: false,
    version: '0.1.0',
  });
  assert.equal(r.written.length, 1, 'only one path should be written under scope=project');
  assert.equal(r.written[0], detection.paths.project);

  const globalAfter = await stat(detection.paths.global);
  assert.equal(globalBefore.mtimeMs, globalAfter.mtimeMs,
    'global .goosehints mtime must be unchanged when scope=project');
  const globalContent = await readFile(detection.paths.global, 'utf8');
  assert.equal(globalContent, '# global pre\n',
    'global .goosehints content must be untouched');
});
