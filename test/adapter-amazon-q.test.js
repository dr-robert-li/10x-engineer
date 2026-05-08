// test/adapter-amazon-q.test.js — TIER2-06 round-trip suite for the Amazon Q
// Developer CLI adapter. Mirrors the continue.test.js project-half shape with
// two structural deltas:
//   1. Detection has THREE OR-signals: PATH binary `q`, ~/.aws/amazonq/, and
//      <projectRoot>/.amazonq/. PATH alone is necessary-but-not-sufficient
//      (Pitfall 10) — at least one filesystem signal must accompany.
//   2. Project-only — paths.global is always null. Vendor open feature
//      request aws/amazon-q-developer-cli#3451 for global rules support;
//      not shipped as of 2026-05-08.
//
// Eleven named tests cover the adapter contract. Every test uses mkdtemp to
// build an isolated environment and threads cwd and homedir into the adapter
// (D2-24). Since detection gates on PATH, makeEnv saves and isolates
// process.env.PATH so the host machine's $PATH never leaks into a test that
// asserts found:false (Pitfall 10 — same pattern codex.test.js uses).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readdir, stat, readFile, writeFile, chmod,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import amazonQ from '../lib/adapters/amazon-q.js';
import { loadSkills } from '../lib/skills.js';
import { MARKER_BEGIN_PREFIX } from '../lib/markers.js';

/**
 * Build an isolated test environment under a single mkdtemp. Caller flags
 * which Amazon Q signals to seed (~/.aws/amazonq/ legacy MCP dir, or
 * <cwd>/.amazonq/ project dir).
 *
 * Critically, this helper also overrides process.env.PATH for the duration of
 * the test so commandExists('q') does not pick up a host-installed binary.
 * Defaults to '' (no PATH); callers that want PATH-binary detection set it
 * explicitly via opts.path.
 */
async function makeEnv(t, opts = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-amazon-q-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (opts.withAwsAmazonq) {
    await mkdir(join(homedir, '.aws', 'amazonq'), { recursive: true });
  }
  if (opts.withProjectAmazonq) {
    await mkdir(join(cwd, '.amazonq'), { recursive: true });
  }

  // PATH isolation: host's installed `q` (if any) must not leak into a test
  // that asserts found:false. Tests that exercise PATH-binary detection opt
  // in via opts.path = <fake bin dir>.
  const origPath = process.env.PATH;
  process.env.PATH = opts.path ?? '';
  t.after(() => { process.env.PATH = origPath; });

  return { root, homedir, cwd };
}

test('amazon-q detect: no signals → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await amazonQ.detect(env);
  assert.equal(r.found, false);
});

test('amazon-q detect: only ~/.aws/amazonq/ present → found:true, scope=project', async (t) => {
  const env = await makeEnv(t, { withAwsAmazonq: true });
  const r = await amazonQ.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.global, null);
  assert.equal(r.paths.project, join(env.cwd, '.amazonq', 'rules', '10x-engineer.md'));
});

test('amazon-q detect: only <projectRoot>/.amazonq/ present → found:true, scope=project', async (t) => {
  const env = await makeEnv(t, { withProjectAmazonq: true });
  const r = await amazonQ.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.global, null);
  assert.equal(r.paths.project, join(env.cwd, '.amazonq', 'rules', '10x-engineer.md'));
});

test('amazon-q detect: both filesystem signals present → found:true, scope=project', async (t) => {
  const env = await makeEnv(t, { withAwsAmazonq: true, withProjectAmazonq: true });
  const r = await amazonQ.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.global, null);
  assert.equal(r.paths.project, join(env.cwd, '.amazonq', 'rules', '10x-engineer.md'));
});

test('amazon-q detect: Pitfall 10 — PATH `q` exists but no filesystem signal → found:false (PATH alone insufficient)', async (t) => {
  // Build a fake bindir, drop an executable `q` into it, point process.env.PATH
  // at it. NO filesystem signals — neither ~/.aws/amazonq/ nor <cwd>/.amazonq/.
  // Even though commandExists('q') would return true, detection MUST return
  // found:false because PATH alone is necessary-but-not-sufficient.
  const root = await mkdtemp(join(tmpdir(), '10xe-amazon-q-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  const fakeBinDir = join(root, 'bin');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  await mkdir(fakeBinDir, { recursive: true });
  const fakeQ = join(fakeBinDir, 'q');
  await writeFile(fakeQ, '#!/bin/sh\nexit 0\n');
  await chmod(fakeQ, 0o755);

  const origPath = process.env.PATH;
  process.env.PATH = fakeBinDir;
  t.after(() => { process.env.PATH = origPath; });

  const r = await amazonQ.detect({ cwd, homedir });
  assert.equal(r.found, false,
    'Pitfall 10: PATH-only detection must NOT trigger found:true; ' +
    'a filesystem signal (~/.aws/amazonq/ or <cwd>/.amazonq/) is required.');
});

test('amazon-q detect: paths.global is always null across every detect-truthy case', async (t) => {
  // Probe each of the three filesystem-signal permutations and confirm the
  // project-only invariant: paths.global never holds a non-null value.
  for (const opts of [
    { withAwsAmazonq: true },
    { withProjectAmazonq: true },
    { withAwsAmazonq: true, withProjectAmazonq: true },
  ]) {
    const env = await makeEnv(t, opts);
    const r = await amazonQ.detect(env);
    assert.equal(r.found, true);
    assert.equal(r.paths.global, null,
      `paths.global must be null for opts ${JSON.stringify(opts)} — project-only adapter`);
  }
});

test('amazon-q install + uninstall round-trip — user-owned sibling under .amazonq/rules/ untouched, rules/ dir survives', async (t) => {
  const env = await makeEnv(t, { withProjectAmazonq: true });
  const skills = await loadSkills();
  const detection = await amazonQ.detect(env);

  // Pre-seed a user-owned sibling under .amazonq/rules/ — placed alongside
  // the file we will write. The adapter must NEVER touch this on install or
  // uninstall, and uninstall must NOT remove the parent rules/ directory.
  const rulesDir = join(env.cwd, '.amazonq', 'rules');
  await mkdir(rulesDir, { recursive: true });
  const userRulePath = join(rulesDir, 'coding-standards.md');
  const userRuleBody = '# coding-standards\nuser-authored Amazon Q rule\n';
  await writeFile(userRulePath, userRuleBody, 'utf8');
  const userRuleStatBefore = await stat(userRulePath);

  // Install
  const installRes = await amazonQ.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0',
  });
  assert.equal(installRes.written.length, 1, 'concat-md writes exactly one file per scope');
  assert.equal(installRes.written[0], detection.paths.project);

  // 10x-engineer.md exists; user sibling still there
  assert.equal(existsSync(detection.paths.project), true);
  const installedDirContents = (await readdir(rulesDir)).sort();
  assert.deepEqual(installedDirContents, ['10x-engineer.md', 'coding-standards.md']);

  // Content sanity: every skill's h2 header appears in stable order — proves
  // all 10 skills concatenated in alphabetical filename order.
  const installedContent = await readFile(detection.paths.project, 'utf8');
  let cursor = 0;
  for (const s of skills) {
    const idx = installedContent.indexOf(`## ${s.name}`, cursor);
    assert.ok(idx >= 0, `expected '## ${s.name}' at or after offset ${cursor}`);
    cursor = idx;
  }
  assert.ok(installedContent.startsWith('# 10x-engineer persona (v0.1.0)'));

  // Markerless invariant: emitted file contains no marker strings
  assert.equal(installedContent.includes(MARKER_BEGIN_PREFIX), false,
    'concat-md is markerless — emitted file must contain no BEGIN marker');

  // Uninstall
  const uninstallRes = await amazonQ.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(uninstallRes.removed.length, 1);
  assert.equal(uninstallRes.removed[0], detection.paths.project);

  // Post-uninstall:
  // 1) 10x-engineer.md is gone
  assert.equal(existsSync(detection.paths.project), false,
    'post-uninstall: 10x-engineer.md must be unlinked');

  // 2) The parent rules/ dir survives (we never delete user-owned parents)
  assert.equal(existsSync(rulesDir), true,
    'post-uninstall: parent rules/ dir must survive (surgical removal)');

  // 3) user-owned sibling is byte-identical (content + mtime)
  const userRuleBodyAfter = await readFile(userRulePath, 'utf8');
  assert.equal(userRuleBodyAfter, userRuleBody,
    'post-uninstall: user-owned sibling content untouched');
  const userRuleStatAfter = await stat(userRulePath);
  assert.equal(userRuleStatAfter.mtimeMs, userRuleStatBefore.mtimeMs,
    'post-uninstall: user-owned sibling mtime unchanged');
});

test('amazon-q install is idempotent: re-running produces stable content (no duplication)', async (t) => {
  const env = await makeEnv(t, { withProjectAmazonq: true });
  const skills = await loadSkills();
  const detection = await amazonQ.detect(env);

  await amazonQ.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0' });
  const first = await readFile(detection.paths.project, 'utf8');
  await amazonQ.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.1.0' });
  const second = await readFile(detection.paths.project, 'utf8');
  assert.equal(first, second, 're-install must yield byte-identical content');
});

test('amazon-q dryRun: true does not touch disk; mtime on .amazonq/ unchanged', async (t) => {
  const env = await makeEnv(t, { withProjectAmazonq: true });
  const skills = await loadSkills();
  const detection = await amazonQ.detect(env);

  const amazonqDir = join(env.cwd, '.amazonq');
  const before = await stat(amazonqDir);

  const r = await amazonQ.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 1, 'written array must record would-be paths even with dryRun:true');

  // Nothing materialised
  assert.equal(existsSync(detection.paths.project), false,
    'dryRun:true must not write 10x-engineer.md');
  await assert.rejects(readdir(join(amazonqDir, 'rules')), { code: 'ENOENT' },
    'dryRun:true must not even create the rules/ dir');

  const after = await stat(amazonqDir);
  assert.equal(before.mtimeMs, after.mtimeMs, 'parent .amazonq/ mtime must be unchanged on dryRun');
});

test('amazon-q uninstall on missing 10x-engineer.md → graceful (no ENOENT throw)', async (t) => {
  const env = await makeEnv(t, { withProjectAmazonq: true });
  const detection = await amazonQ.detect(env);

  // No prior install; the file does not exist. Uninstall must not throw.
  const r = await amazonQ.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(r.removed.length, 1, 'removed array still records the would-be path even when file is absent');
  assert.equal(existsSync(detection.paths.project), false);
});

test('amazon-q install with scope=global → no-op (project-only adapter)', async (t) => {
  // Adapter is project-only. paths.global is always null. If a caller passes
  // scope='global', the install loop must skip cleanly — written.length is 0.
  const env = await makeEnv(t, { withProjectAmazonq: true });
  const skills = await loadSkills();
  const detection = await amazonQ.detect(env);

  const r = await amazonQ.install({
    skills,
    scope: 'global',
    paths: { global: null, project: detection.paths.project },
    dryRun: false,
    version: '0.1.0',
  });
  assert.equal(r.written.length, 0, 'scope=global must not write — paths.global is null');
  assert.deepEqual(r.skipped, [], 'no soft-skip records produced');
  assert.equal(existsSync(detection.paths.project), false,
    'no project-side write should occur when caller asked for scope=global');
});
