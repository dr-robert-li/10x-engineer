// test/adapter-gemini.test.js — TIER1-09 round-trip suite for the Gemini CLI adapter.
//
// Twelve named tests covering the Gemini adapter contract:
//   1. detect: nothing — no .gemini/, no gemini on PATH, no GEMINI.md → found:false
//   2. detect: ~/.gemini/ present → scope='global'
//   3. detect: project GEMINI.md present at cwd → scope='project'
//   4. detect: GEMINI.md at ancestor of cwd → walk finds it
//   5. detect: both global and project markers → scope='both'
//   6. detect: gemini on synthetic PATH only → scope='global'
//   7. install + uninstall round-trip (happy path) — user content byte-identical
//   8. round-trip with no trailing newline — assertByteIdenticalAroundMarker passes
//   9. round-trip with CRLF — surrounding bytes byte-identical
//  10. idempotent re-install (single marker block, content stable)
//  11. dryRun:true — no file changes; mtime unchanged
//  12. ~/.gemini/settings.json untouched (MCP config) — byte-identical, mtime unchanged
//
// Every test mkdtemps an isolated environment and threads cwd and homedir into
// the adapter (D2-24). The real ~ and the real cwd are never read.
//
// PATH isolation: every test clears process.env.PATH at the top of the file
// (saved/restored once via the test runner's lifecycle); tests that exercise
// PATH-binary detection opt in by repointing PATH at a fixture mkdtemp.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, stat, readFile, writeFile, chmod,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import gemini from '../lib/adapters/gemini.js';
import { loadSkills } from '../lib/skills.js';
import { assertByteIdenticalAroundMarker } from './helpers/byte-identity.js';

// ---- PATH isolation ----------------------------------------------------------
// commandExists() inside detect.js defaults to process.env. Without this guard,
// any host that has `gemini` on PATH would leak detection into tests that expect
// found:false or scope='project'. Save once, force empty, individual tests opt
// back in by writing to process.env.PATH and restoring in their own t.after().

const ORIGINAL_PATH = process.env.PATH;
process.env.PATH = '';
process.on('exit', () => { process.env.PATH = ORIGINAL_PATH; });

/**
 * Build an isolated test environment:
 *   - homedir at <root>/home
 *   - cwd at <root>/project (deeper if `atAncestor`)
 *   - optional ~/.gemini/ (withGlobalDir)
 *   - optional <cwd>/GEMINI.md or ancestor placement
 *
 * @param {object} opts
 * @param {boolean} [opts.withGlobalDir]      create <homedir>/.gemini/
 * @param {boolean} [opts.withProjectGemini]  create <cwd>/GEMINI.md (empty body)
 * @param {boolean} [opts.atAncestor]         place GEMINI.md at <root>/project, deepen cwd
 */
async function makeEnv(t, {
  withGlobalDir = false,
  withProjectGemini = false,
  atAncestor = false,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-gemini-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = atAncestor
    ? join(root, 'project', 'sub', 'deep')
    : join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (withGlobalDir) await mkdir(join(homedir, '.gemini'));
  if (withProjectGemini && !atAncestor) {
    await writeFile(join(cwd, 'GEMINI.md'), '', 'utf8');
  }
  if (atAncestor) {
    await writeFile(join(root, 'project', 'GEMINI.md'), '', 'utf8');
  }
  return { root, homedir, cwd };
}

// -----------------------------------------------------------------------------
// 1. detect: nothing
// -----------------------------------------------------------------------------
test('detect: no .gemini/, no GEMINI.md, no gemini on PATH → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await gemini.detect(env);
  assert.equal(r.found, false);
});

// -----------------------------------------------------------------------------
// 2. detect: ~/.gemini/ present
// -----------------------------------------------------------------------------
test('detect: ~/.gemini/ present → scope=global', async (t) => {
  const env = await makeEnv(t, { withGlobalDir: true });
  const r = await gemini.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(r.paths.global, join(env.homedir, '.gemini', 'GEMINI.md'));
  assert.equal(r.paths.project, null);
});

// -----------------------------------------------------------------------------
// 3. detect: project GEMINI.md at cwd
// -----------------------------------------------------------------------------
test('detect: GEMINI.md at cwd → scope=project, project path resolved', async (t) => {
  const env = await makeEnv(t, { withProjectGemini: true });
  const r = await gemini.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, 'GEMINI.md'));
  assert.equal(r.paths.global, null);
});

// -----------------------------------------------------------------------------
// 4. detect: GEMINI.md at ancestor of cwd → walk finds it
// -----------------------------------------------------------------------------
test('detect: GEMINI.md at ancestor → walk anchors install path to ancestor', async (t) => {
  const env = await makeEnv(t, { atAncestor: true });
  const r = await gemini.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  // Marker is at <root>/project/GEMINI.md; cwd is <root>/project/sub/deep
  const ancestor = join(env.root, 'project');
  assert.equal(r.paths.project, join(ancestor, 'GEMINI.md'));
});

// -----------------------------------------------------------------------------
// 5. detect: both
// -----------------------------------------------------------------------------
test('detect: ~/.gemini/ + project GEMINI.md → scope=both', async (t) => {
  const env = await makeEnv(t, { withGlobalDir: true, withProjectGemini: true });
  const r = await gemini.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'both');
  assert.ok(r.paths.global);
  assert.ok(r.paths.project);
});

// -----------------------------------------------------------------------------
// 6. detect: gemini on synthetic PATH only → scope=global
// -----------------------------------------------------------------------------
test('detect: gemini on PATH only (no .gemini/, no GEMINI.md) → scope=global', async (t) => {
  const env = await makeEnv(t);
  // Build a fixture PATH dir containing a `gemini` executable
  const binDir = await mkdtemp(join(tmpdir(), '10xe-gemini-bin-'));
  t.after(() => rm(binDir, { recursive: true, force: true }));
  const binPath = join(binDir, 'gemini');
  await writeFile(binPath, '#!/bin/sh\necho ok\n');
  await chmod(binPath, 0o755);
  const savedPath = process.env.PATH;
  process.env.PATH = binDir;
  t.after(() => { process.env.PATH = savedPath; });

  const r = await gemini.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  // PATH-only detection still maps to <homedir>/.gemini/GEMINI.md (the
  // canonical global file). The dir need not exist for the path to be
  // declared — replaceBlock will mkdir-on-write where applicable.
  assert.equal(r.paths.global, join(env.homedir, '.gemini', 'GEMINI.md'));
  assert.equal(r.paths.project, null);
});

// -----------------------------------------------------------------------------
// 7. install + uninstall round-trip (happy path)
// -----------------------------------------------------------------------------
test('install + uninstall round-trip — user content byte-identical', async (t) => {
  const env = await makeEnv(t, { withProjectGemini: true });
  const target = join(env.cwd, 'GEMINI.md');
  const userBody = '# My project rules\n\nDo the thing.\nDo not break the thing.\n';
  await writeFile(target, userBody, 'utf8');

  const skills = await loadSkills();
  const detection = await gemini.detect(env);

  await gemini.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });

  // Marker block present; surrounding bytes preserved.
  const installed = await readFile(target, 'utf8');
  assert.ok(installed.includes('<!-- BEGIN 10x-engineer'), 'BEGIN marker present');
  assert.ok(installed.includes('<!-- END 10x-engineer -->'), 'END marker present');
  await assertByteIdenticalAroundMarker(target, userBody);

  await gemini.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  // Post-uninstall: marker gone, user body intact (bounded \n artefact tolerated).
  await assertByteIdenticalAroundMarker(target, userBody);
});

// -----------------------------------------------------------------------------
// 8. round-trip with no trailing newline
// -----------------------------------------------------------------------------
test('round-trip with no trailing newline — bytes around marker byte-identical', async (t) => {
  const env = await makeEnv(t, { withProjectGemini: true });
  const target = join(env.cwd, 'GEMINI.md');
  const userBody = '# rules\n\nno trailing newline'; // intentional: no final \n
  await writeFile(target, userBody, 'utf8');

  const skills = await loadSkills();
  const detection = await gemini.detect(env);

  await gemini.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  await assertByteIdenticalAroundMarker(target, userBody);

  await gemini.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  await assertByteIdenticalAroundMarker(target, userBody);
});

// -----------------------------------------------------------------------------
// 9. round-trip with CRLF line endings
// -----------------------------------------------------------------------------
test('round-trip with CRLF line endings — surrounding bytes byte-identical', async (t) => {
  const env = await makeEnv(t, { withProjectGemini: true });
  const target = join(env.cwd, 'GEMINI.md');
  const userBody = '# crlf rules\r\n\r\nfirst rule\r\nsecond rule\r\n';
  await writeFile(target, userBody, 'utf8');

  const skills = await loadSkills();
  const detection = await gemini.detect(env);

  await gemini.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  await assertByteIdenticalAroundMarker(target, userBody);

  await gemini.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  await assertByteIdenticalAroundMarker(target, userBody);
});

// -----------------------------------------------------------------------------
// 10. idempotent re-install
// -----------------------------------------------------------------------------
test('install is idempotent — single marker block, content stable', async (t) => {
  const env = await makeEnv(t, { withProjectGemini: true });
  const target = join(env.cwd, 'GEMINI.md');
  const userBody = '# rules\n';
  await writeFile(target, userBody, 'utf8');

  const skills = await loadSkills();
  const detection = await gemini.detect(env);

  await gemini.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  const afterFirst = await readFile(target, 'utf8');

  await gemini.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  const afterSecond = await readFile(target, 'utf8');

  assert.equal(afterFirst, afterSecond, 're-install must be byte-stable (no duplicate block)');
  const beginCount = (afterSecond.match(/<!-- BEGIN 10x-engineer/g) || []).length;
  const endCount = (afterSecond.match(/<!-- END 10x-engineer -->/g) || []).length;
  assert.equal(beginCount, 1, 'exactly one BEGIN marker after re-install');
  assert.equal(endCount, 1, 'exactly one END marker after re-install');
});

// -----------------------------------------------------------------------------
// 11. dryRun:true — no file changes
// -----------------------------------------------------------------------------
test('dryRun:true — file content and mtime unchanged', async (t) => {
  const env = await makeEnv(t, { withProjectGemini: true });
  const target = join(env.cwd, 'GEMINI.md');
  const userBody = '# rules\n\nuntouched\n';
  await writeFile(target, userBody, 'utf8');
  const before = await stat(target);

  const skills = await loadSkills();
  const detection = await gemini.detect(env);

  await gemini.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true, version: '0.1.0',
  });

  const after = await stat(target);
  assert.equal(after.mtimeMs, before.mtimeMs, 'mtime unchanged on dryRun:true');
  const content = await readFile(target, 'utf8');
  assert.equal(content, userBody, 'file content unchanged on dryRun:true');
});

// -----------------------------------------------------------------------------
// 12. ~/.gemini/settings.json untouched (MCP config)
// -----------------------------------------------------------------------------
test('~/.gemini/settings.json is never modified (MCP config sibling)', async (t) => {
  const env = await makeEnv(t, { withGlobalDir: true, withProjectGemini: true });
  const settingsPath = join(env.homedir, '.gemini', 'settings.json');
  const settingsBody = '{ "mcpServers": { "x": "y" } }\n';
  await writeFile(settingsPath, settingsBody, 'utf8');
  const before = await stat(settingsPath);

  const skills = await loadSkills();
  const detection = await gemini.detect(env);

  await gemini.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  await gemini.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  // Settings.json is byte-identical AND mtime unchanged.
  assert.ok(existsSync(settingsPath), 'settings.json must still exist');
  const after = await stat(settingsPath);
  assert.equal(after.mtimeMs, before.mtimeMs, 'settings.json mtime unchanged');
  const settingsAfter = await readFile(settingsPath, 'utf8');
  assert.equal(settingsAfter, settingsBody, 'settings.json content untouched');
});
