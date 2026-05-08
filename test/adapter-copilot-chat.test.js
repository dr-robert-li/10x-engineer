// test/adapter-copilot-chat.test.js
//
// GitHub Copilot Chat adapter — append-mode round-trip suite. Project-only:
// the adapter has no global half, so this file omits the global-half tests
// that adapter-codex.test.js carries. Thirteen named tests cover:
//
//   1.  detect: nothing                                    → found:false
//   2.  detect: empty .github/ dir                         → scope:'project'
//   3.  detect: .github/copilot-instructions.md present     → scope:'project'
//   4.  paths.global is always null (project-only invariant)
//   5.  detect anchors at the .git boundary — nested cwd resolves to project root
//   6.  install + uninstall round-trip on populated copilot-instructions.md → byte-identical-around-marker
//   7.  install + uninstall round-trip on no-trailing-newline file          → bounded \n artefact tolerated
//   8.  install + uninstall round-trip on CRLF file                         → surrounding bytes byte-identical
//   9.  re-install is idempotent (replaceBlock-in-place)                    → final content stable
//  10.  uninstall removes only our block; user content survives byte-identically
//  11.  uninstall on missing file → graceful, no throw
//  12.  dryRun:true on install does not change file mtime
//  13.  dryRun:true on uninstall does not change file mtime
//  14.  scope='global' install request → { written: [], skipped: [] } (project-only adapter ignores global)
//
// Every test uses mkdtemp to build an isolated environment and threads cwd
// and homedir into the adapter (D2-24). No PATH isolation needed — Copilot
// Chat has no CLI; commandExists is not in the adapter's import set.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, mkdir, writeFile, readFile, stat, rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import copilotChat from '../lib/adapters/copilot-chat.js';
import { loadSkills } from '../lib/skills.js';
import { assertByteIdenticalAroundMarker } from './helpers/byte-identity.js';

/**
 * Build an isolated test environment under a single mkdtemp. Caller flags
 * which Copilot-Chat signals to seed (.github/ dir, copilot-instructions.md
 * presence, optional content, .git anchor for the project root).
 *
 * The adapter has no PATH dependency, so this helper does not touch
 * process.env.PATH.
 */
async function makeEnv(t, opts = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-copilot-chat-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (opts.withGithubDir || opts.withInstructionsFile) {
    await mkdir(join(cwd, '.github'), { recursive: true });
  }
  if (opts.withInstructionsFile) {
    await writeFile(
      join(cwd, '.github', 'copilot-instructions.md'),
      opts.instructionsContent ?? '',
    );
  }
  if (opts.withGitRoot) {
    await mkdir(join(cwd, '.git'), { recursive: true });
  }
  return { root, homedir, cwd };
}

test('copilot-chat detect: nothing → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await copilotChat.detect(env);
  assert.equal(r.found, false);
});

test('copilot-chat detect: empty .github/ dir → scope=project', async (t) => {
  const env = await makeEnv(t, { withGithubDir: true, withGitRoot: true });
  const r = await copilotChat.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.global, null);
  assert.equal(r.paths.project, join(env.cwd, '.github', 'copilot-instructions.md'));
});

test('copilot-chat detect: pre-existing copilot-instructions.md → scope=project', async (t) => {
  const env = await makeEnv(t, { withInstructionsFile: true, withGitRoot: true });
  const r = await copilotChat.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, '.github', 'copilot-instructions.md'));
});

test('copilot-chat paths.global is always null (project-only invariant)', async (t) => {
  // Even with every conceivable signal seeded, the project-only adapter must
  // never surface a global path. Pitfall 6 enforced.
  const env = await makeEnv(t, {
    withGithubDir: true,
    withInstructionsFile: true,
    withGitRoot: true,
  });
  const r = await copilotChat.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.global, null,
    'project-only adapter must NEVER set paths.global — Pitfall 6');
});

test('copilot-chat detect anchors at .git boundary — nested cwd resolves to project root', async (t) => {
  // Build <root>/project/{.git,.github/copilot-instructions.md} and place
  // cwd four levels deep at <root>/project/sub/sub/. detect() must walk up,
  // discover .git at <root>/project/, and resolve paths.project to
  // <root>/project/.github/copilot-instructions.md — NOT to a path under
  // the deep cwd.
  const root = await mkdtemp(join(tmpdir(), '10xe-copilot-chat-anchor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const projectRoot = join(root, 'project');
  const deepCwd = join(projectRoot, 'sub', 'sub');
  await mkdir(homedir, { recursive: true });
  await mkdir(deepCwd, { recursive: true });
  await mkdir(join(projectRoot, '.git'), { recursive: true });
  await mkdir(join(projectRoot, '.github'), { recursive: true });
  await writeFile(join(projectRoot, '.github', 'copilot-instructions.md'), '# user content\n');

  const r = await copilotChat.detect({ cwd: deepCwd, homedir });
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(
    r.paths.project,
    join(projectRoot, '.github', 'copilot-instructions.md'),
    'detect must resolve to git-root-anchored path, not a path under the nested cwd',
  );
});

test('copilot-chat install + uninstall round-trip on populated copilot-instructions.md', async (t) => {
  const original = '# user content\nstuff above the marker\n\nstuff below later\n';
  const env = await makeEnv(t, {
    withInstructionsFile: true,
    instructionsContent: original,
    withGitRoot: true,
  });
  const skills = await loadSkills();
  const detection = await copilotChat.detect(env);

  await copilotChat.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });

  const afterInstall = await readFile(detection.paths.project, 'utf8');
  assert.ok(afterInstall.includes('# user content\nstuff above the marker'),
    'user content must survive install');
  assert.ok(afterInstall.includes('<!-- BEGIN 10x-engineer'), 'marker block must be present');

  await copilotChat.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('copilot-chat install + uninstall round-trip with no-trailing-newline file', async (t) => {
  const original = '{ "user": "config" }'; // no trailing \n
  const env = await makeEnv(t, {
    withInstructionsFile: true,
    instructionsContent: original,
    withGitRoot: true,
  });
  const skills = await loadSkills();
  const detection = await copilotChat.detect(env);

  await copilotChat.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await copilotChat.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('copilot-chat install + uninstall round-trip with CRLF file', async (t) => {
  // CRLF-saved file. BLOCK_RE in markers.js uses \r?\n; safe-fs preserves
  // BOM (none here) and replaceBlock/stripBlock are CRLF-tolerant.
  const original = '# title\r\nuser line one\r\nuser line two\r\n';
  const env = await makeEnv(t, {
    withInstructionsFile: true,
    instructionsContent: original,
    withGitRoot: true,
  });
  const skills = await loadSkills();
  const detection = await copilotChat.detect(env);

  await copilotChat.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await copilotChat.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('copilot-chat install is idempotent: re-running produces identical content', async (t) => {
  const env = await makeEnv(t, {
    withInstructionsFile: true,
    instructionsContent: '# original\n',
    withGitRoot: true,
  });
  const skills = await loadSkills();
  const detection = await copilotChat.detect(env);

  await copilotChat.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const afterFirst = await readFile(detection.paths.project, 'utf8');

  await copilotChat.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const afterSecond = await readFile(detection.paths.project, 'utf8');

  assert.equal(afterSecond, afterFirst,
    're-running install must produce byte-identical content (replaceBlock replaces in place)');
});

test('copilot-chat uninstall removes only our block; user content survives byte-identically', async (t) => {
  const original = '# user content above\n\nuser content below\n';
  const env = await makeEnv(t, {
    withInstructionsFile: true,
    instructionsContent: original,
    withGitRoot: true,
  });
  const skills = await loadSkills();
  const detection = await copilotChat.detect(env);

  await copilotChat.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const afterInstall = await readFile(detection.paths.project, 'utf8');
  assert.ok(afterInstall.includes('# user content above'),
    'user content above marker must survive install');
  assert.ok(afterInstall.includes('user content below'),
    'user content below marker must survive install');

  const r = await copilotChat.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(r.removed.length, 1, 'uninstall must report exactly one removed file');
  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('copilot-chat uninstall on missing file → graceful, no throw', async (t) => {
  const env = await makeEnv(t, { withGithubDir: true, withGitRoot: true });
  const detection = await copilotChat.detect(env);
  // .github/ exists but copilot-instructions.md does not → stripBlock returns
  // { removed: false, ... } and the adapter returns { removed: [] }.
  const r = await copilotChat.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.deepEqual(r, { removed: [] });
});

test('copilot-chat dryRun:true on install does not change file mtime', async (t) => {
  const env = await makeEnv(t, {
    withInstructionsFile: true,
    instructionsContent: '# user content\n',
    withGitRoot: true,
  });
  const skills = await loadSkills();
  const detection = await copilotChat.detect(env);

  const before = await stat(detection.paths.project);

  const r = await copilotChat.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 1, 'written array records the would-be path even on dryRun');

  const after = await stat(detection.paths.project);
  assert.equal(before.mtimeMs, after.mtimeMs, 'mtime must be unchanged on dryRun');

  const content = await readFile(detection.paths.project, 'utf8');
  assert.equal(content, '# user content\n');
});

test('copilot-chat dryRun:true on uninstall does not change file mtime', async (t) => {
  // Pre-install a real block so uninstall has something to consider stripping;
  // then dry-run uninstall and assert disk is unchanged.
  const env = await makeEnv(t, {
    withInstructionsFile: true,
    instructionsContent: '# user content\n',
    withGitRoot: true,
  });
  const skills = await loadSkills();
  const detection = await copilotChat.detect(env);
  await copilotChat.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });

  const before = await stat(detection.paths.project);
  const beforeContent = await readFile(detection.paths.project, 'utf8');

  const r = await copilotChat.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: true,
  });
  assert.equal(r.removed.length, 1, 'removed array records the would-be path even on dryRun');

  const after = await stat(detection.paths.project);
  assert.equal(before.mtimeMs, after.mtimeMs, 'mtime must be unchanged on dryRun uninstall');
  const afterContent = await readFile(detection.paths.project, 'utf8');
  assert.equal(afterContent, beforeContent, 'content must be byte-identical on dryRun uninstall');
});

test('copilot-chat scope=global install request → { written: [], skipped: [] } (project-only adapter)', async (t) => {
  // The project-only adapter MUST treat any non-project scope as a no-op,
  // even when paths.global is somehow non-null (shouldn't happen, but the
  // guard belongs to the adapter, not to the orchestrator).
  const env = await makeEnv(t, {
    withInstructionsFile: true,
    instructionsContent: '# user content\n',
    withGitRoot: true,
  });
  const skills = await loadSkills();
  const detection = await copilotChat.detect(env);

  const r = await copilotChat.install({
    skills,
    scope: 'global',
    paths: { global: join(env.homedir, 'fake-global-path.md'), project: detection.paths.project },
    dryRun: false,
    version: '0.1.0',
  });
  assert.deepEqual(r, { written: [], skipped: [] },
    'project-only adapter must ignore scope=global install request');
});
