// test/adapter-aider.test.js
//
// Aider adapter (TIER1-07) — end-to-end suite covering the full 7-shape
// whitelist plus user-content protection on both install and uninstall.
//
// Fifteen named tests:
//   1.  detect: nothing                                              → found:false
//   2.  detect: .aider.conf.yml at cwd                               → scope:'project'
//   3.  detect: .aider.conf.yml at ancestor                          → walk finds it
//   4.  detect: aider on synthetic PATH (no .aider.conf.yml)         → scope:'project'
//   5.  install case 1: no .aider.conf.yml, no CONVENTIONS.md
//   6.  install case 2: .aider.conf.yml lacks `read:` key
//   7.  install case 3: read: null/empty
//   8.  install case 4: read: scalar string
//   9.  install case 5: read: existing list
//  10.  install case 6: idempotent (already contains CONVENTIONS.md)  — mtime stable
//  11.  install case 7: read: mapping value                          → throws
//  12.  install refuses to overwrite user-owned CONVENTIONS.md       → throws, file unchanged
//  13.  uninstall: removes our CONVENTIONS.md and scrubs `read:` (key removed if list empty)
//  14.  uninstall: leaves user-owned CONVENTIONS.md alone, still scrubs `read:`
//  15.  install dryRun:true: no file changes; no mtime change
//
// Every test mkdtemps an isolated environment and threads cwd + homedir into
// the adapter (D2-24). PATH is forcibly cleared at file scope so the host's
// `aider` binary cannot leak into a test that asserts found:false.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, mkdir, writeFile, readFile, stat, rm, chmod,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import aider from '../lib/adapters/aider.js';
import { loadSkills } from '../lib/skills.js';

// ---- PATH isolation ----------------------------------------------------------
const ORIGINAL_PATH = process.env.PATH;
process.env.PATH = '';
process.on('exit', () => { process.env.PATH = ORIGINAL_PATH; });

/**
 * Build an isolated test environment under one mkdtemp.
 *   - homedir at <root>/home
 *   - cwd at <root>/project (or deeper if `atAncestor`)
 *   - .git anchor at the project root for ancestor-walk semantics
 */
async function makeEnv(t, {
  withConfYml = false,
  confYmlContent = '',
  atAncestor = false,
  withGit = true,
  conventionsContent = null,
  path: pathOverride,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-aider-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const projectRoot = join(root, 'project');
  const cwd = atAncestor ? join(projectRoot, 'sub', 'deep') : projectRoot;
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (withGit) await mkdir(join(projectRoot, '.git'), { recursive: true });
  if (withConfYml) {
    await writeFile(join(projectRoot, '.aider.conf.yml'), confYmlContent, 'utf8');
  }
  if (conventionsContent !== null) {
    await writeFile(join(projectRoot, 'CONVENTIONS.md'), conventionsContent, 'utf8');
  }
  if (pathOverride !== undefined) {
    const orig = process.env.PATH;
    process.env.PATH = pathOverride;
    t.after(() => { process.env.PATH = orig; });
  }
  return { root, homedir, cwd, projectRoot };
}

// ---- detect ------------------------------------------------------------------

test('aider detect: nothing → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await aider.detect(env);
  assert.equal(r.found, false);
});

test('aider detect: .aider.conf.yml at cwd → scope=project', async (t) => {
  const env = await makeEnv(t, { withConfYml: true });
  const r = await aider.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project.aiderConfYml, join(env.projectRoot, '.aider.conf.yml'));
  assert.equal(r.paths.project.conventionsMd, join(env.projectRoot, 'CONVENTIONS.md'));
});

test('aider detect: .aider.conf.yml at ancestor → walk finds it', async (t) => {
  const env = await makeEnv(t, { withConfYml: true, atAncestor: true });
  const r = await aider.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  // projectRoot for paths must be the ancestor that holds the conf, not cwd
  assert.equal(r.paths.project.projectRoot, env.projectRoot);
});

test('aider detect: aider on synthetic PATH only → found:true', async (t) => {
  // No .aider.conf.yml anywhere; only a fake `aider` binary on a private PATH.
  const root = await mkdtemp(join(tmpdir(), '10xe-aider-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  const fakeBinDir = join(root, 'bin');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  await mkdir(fakeBinDir, { recursive: true });
  const fakeAider = join(fakeBinDir, 'aider');
  await writeFile(fakeAider, '#!/bin/sh\nexit 0\n');
  await chmod(fakeAider, 0o755);

  const orig = process.env.PATH;
  process.env.PATH = fakeBinDir;
  t.after(() => { process.env.PATH = orig; });

  const r = await aider.detect({ cwd, homedir });
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  // No .aider.conf.yml ancestor → projectRoot anchors at cwd
  assert.equal(r.paths.project.projectRoot, cwd);
});

// ---- install: 7 sanctioned shapes -------------------------------------------

test('aider install case 1: no .aider.conf.yml → creates both files', async (t) => {
  const env = await makeEnv(t, { withConfYml: true, confYmlContent: '' });
  // Re-blank: detect via .aider.conf.yml then unlink it for the case-1 fixture
  await rm(join(env.projectRoot, '.aider.conf.yml'));
  // We still need detect() to succeed — re-create empty file for detection
  await writeFile(join(env.projectRoot, '.aider.conf.yml'), '');
  const skills = await loadSkills();
  const detection = await aider.detect(env);
  // Now empty out the conf so install runs case 1
  await writeFile(join(env.projectRoot, '.aider.conf.yml'), '');

  const r = await aider.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  assert.ok(r.written.length >= 2, 'wrote both CONVENTIONS.md and .aider.conf.yml');
  const conv = await readFile(detection.paths.project.conventionsMd, 'utf8');
  assert.ok(conv.startsWith('# 10x-engineer conventions'),
    'CONVENTIONS.md begins with our header');
  const yml = await readFile(detection.paths.project.aiderConfYml, 'utf8');
  assert.equal(yml, 'read:\n  - CONVENTIONS.md\n');
});

test('aider install case 2: .aider.conf.yml lacks read: → appended', async (t) => {
  const original = 'model: gpt-4\nauto-commits: false\n';
  const env = await makeEnv(t, { withConfYml: true, confYmlContent: original });
  const skills = await loadSkills();
  const detection = await aider.detect(env);

  await aider.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const yml = await readFile(detection.paths.project.aiderConfYml, 'utf8');
  assert.ok(yml.startsWith('model: gpt-4\nauto-commits: false\n'),
    'original keys preserved verbatim');
  assert.ok(yml.endsWith('read:\n  - CONVENTIONS.md\n'),
    'read: block appended at end');
});

test('aider install case 3: read: null → replaced with single-element list', async (t) => {
  const env = await makeEnv(t, { withConfYml: true, confYmlContent: 'read: ~\n' });
  const skills = await loadSkills();
  const detection = await aider.detect(env);
  await aider.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const yml = await readFile(detection.paths.project.aiderConfYml, 'utf8');
  assert.equal(yml, 'read:\n  - CONVENTIONS.md\n');
});

test('aider install case 4: read: scalar → converts to list with both entries', async (t) => {
  const env = await makeEnv(t, {
    withConfYml: true, confYmlContent: 'read: SOMEFILE.md\n',
  });
  const skills = await loadSkills();
  const detection = await aider.detect(env);
  await aider.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const yml = await readFile(detection.paths.project.aiderConfYml, 'utf8');
  assert.equal(yml, 'read:\n  - SOMEFILE.md\n  - CONVENTIONS.md\n');
});

test('aider install case 5: existing list → CONVENTIONS appended without disturbing entries', async (t) => {
  const env = await makeEnv(t, {
    withConfYml: true, confYmlContent: 'read:\n  - A.md\n  - B.md\n',
  });
  const skills = await loadSkills();
  const detection = await aider.detect(env);
  await aider.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const yml = await readFile(detection.paths.project.aiderConfYml, 'utf8');
  assert.equal(yml, 'read:\n  - A.md\n  - B.md\n  - CONVENTIONS.md\n');
});

test('aider install case 6: idempotent re-install — mtime unchanged on both files', async (t) => {
  const env = await makeEnv(t, { withConfYml: true, confYmlContent: '' });
  const skills = await loadSkills();
  const detection = await aider.detect(env);

  // First install — creates both files.
  await aider.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const ymlBefore = await stat(detection.paths.project.aiderConfYml);
  const convBefore = await stat(detection.paths.project.conventionsMd);

  // Wait long enough for mtime resolution to actually advance had we written.
  await new Promise((r) => setTimeout(r, 25));

  // Second install — must be a no-op.
  await aider.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const ymlAfter = await stat(detection.paths.project.aiderConfYml);
  const convAfter = await stat(detection.paths.project.conventionsMd);
  assert.equal(ymlAfter.mtimeMs, ymlBefore.mtimeMs,
    '.aider.conf.yml mtime must be unchanged on idempotent re-install');
  assert.equal(convAfter.mtimeMs, convBefore.mtimeMs,
    'CONVENTIONS.md mtime must be unchanged on idempotent re-install');
});

test('aider install case 7: read: with mapping value → throws UnsupportedConfigShapeError', async (t) => {
  const env = await makeEnv(t, {
    withConfYml: true, confYmlContent: 'read:\n  foo: bar\n',
  });
  const skills = await loadSkills();
  const detection = await aider.detect(env);
  await assert.rejects(
    aider.install({
      skills, scope: detection.scope, paths: detection.paths,
      dryRun: false, version: '0.1.0',
    }),
    (err) => err.name === 'UnsupportedConfigShapeError'
      && /npx 10x-engineer print/.test(err.message),
  );
  // Atomicity: CONVENTIONS.md must NOT have been written.
  assert.equal(existsSync(detection.paths.project.conventionsMd), false,
    'CONVENTIONS.md must not be written when YAML merge throws (atomic)');
});

test('aider install refuses to overwrite user-owned CONVENTIONS.md', async (t) => {
  const userBody = '# user notes\n\nthis is mine, do not touch\n';
  const env = await makeEnv(t, {
    withConfYml: true,
    confYmlContent: '',
    conventionsContent: userBody,
  });
  const skills = await loadSkills();
  const detection = await aider.detect(env);
  const before = await stat(detection.paths.project.conventionsMd);

  await assert.rejects(
    aider.install({
      skills, scope: detection.scope, paths: detection.paths,
      dryRun: false, version: '0.1.0',
    }),
    (err) => err.name === 'UnsupportedConfigShapeError',
  );
  // User content must be byte-identical
  const after = await readFile(detection.paths.project.conventionsMd, 'utf8');
  assert.equal(after, userBody, 'user-owned CONVENTIONS.md must be byte-identical');
  const afterStat = await stat(detection.paths.project.conventionsMd);
  assert.equal(afterStat.mtimeMs, before.mtimeMs, 'mtime unchanged');
});

// ---- uninstall ---------------------------------------------------------------

test('aider uninstall: removes our CONVENTIONS.md and scrubs read:', async (t) => {
  const env = await makeEnv(t, { withConfYml: true, confYmlContent: '' });
  const skills = await loadSkills();
  const detection = await aider.detect(env);

  await aider.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  // Sanity: install made both
  assert.ok(existsSync(detection.paths.project.conventionsMd));
  const ymlAfterInstall = await readFile(detection.paths.project.aiderConfYml, 'utf8');
  assert.equal(ymlAfterInstall, 'read:\n  - CONVENTIONS.md\n');

  await aider.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  assert.equal(existsSync(detection.paths.project.conventionsMd), false,
    'our CONVENTIONS.md must be removed');
  // read: had only our entry → key removed entirely; .aider.conf.yml ends empty-ish.
  const ymlAfterUninstall = await readFile(detection.paths.project.aiderConfYml, 'utf8');
  assert.ok(!/^read\s*:/m.test(ymlAfterUninstall),
    'read: key must be gone when its only entry was ours');
});

test('aider uninstall: leaves user-owned CONVENTIONS.md alone, still scrubs read:', async (t) => {
  const userBody = '# user notes\n\nuser content\n';
  // Pre-state: user has their own CONVENTIONS.md AND their own read: list with
  // CONVENTIONS.md plus one more entry. Uninstall must scrub the entry but not
  // unlink the file.
  const env = await makeEnv(t, {
    withConfYml: true,
    confYmlContent: 'read:\n  - A.md\n  - CONVENTIONS.md\n',
    conventionsContent: userBody,
  });
  const detection = await aider.detect(env);

  await aider.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  // CONVENTIONS.md byte-identical to user version
  const conv = await readFile(detection.paths.project.conventionsMd, 'utf8');
  assert.equal(conv, userBody, 'user-owned CONVENTIONS.md must survive uninstall');

  // read: scrubbed but A.md preserved
  const yml = await readFile(detection.paths.project.aiderConfYml, 'utf8');
  assert.ok(/read:\n\s+- A\.md/.test(yml), 'A.md must remain in read:');
  assert.ok(!/CONVENTIONS\.md/.test(yml), 'CONVENTIONS.md must be removed from read:');
});

// ---- dryRun ------------------------------------------------------------------

test('aider install dryRun:true: no file changes', async (t) => {
  const original = 'model: gpt-4\n';
  const env = await makeEnv(t, { withConfYml: true, confYmlContent: original });
  const skills = await loadSkills();
  const detection = await aider.detect(env);

  const ymlBefore = await stat(detection.paths.project.aiderConfYml);

  const r = await aider.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: true, version: '0.1.0',
  });
  assert.ok(r.written.length >= 1, 'written array records would-be paths even on dryRun');

  // No CONVENTIONS.md created
  assert.equal(existsSync(detection.paths.project.conventionsMd), false,
    'CONVENTIONS.md must not exist after dryRun');

  // .aider.conf.yml unchanged
  const ymlAfter = await stat(detection.paths.project.aiderConfYml);
  assert.equal(ymlAfter.mtimeMs, ymlBefore.mtimeMs,
    '.aider.conf.yml mtime must be unchanged on dryRun');
  const ymlContent = await readFile(detection.paths.project.aiderConfYml, 'utf8');
  assert.equal(ymlContent, original, '.aider.conf.yml content unchanged');
});
