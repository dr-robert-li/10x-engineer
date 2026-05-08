// test/adapter-hosted-fallback.test.js
//
// Per-adapter test suite for the hosted-agent fallback (TIER2-13).
// This adapter is structurally distinct from the other Tier 1/Tier 2
// adapters: it performs zero filesystem I/O. The tests below assert
// the contract:
//   - detect() always returns { found: false }, regardless of input
//   - install() returns { written: [], skipped: [<message>] }
//   - install() never touches the filesystem (mkdtemp snapshot equality)
//   - uninstall() is a no-op returning { removed: [] }
//   - Pitfall 1 invariant: every entry point does not throw / does not
//     reject. Promise.allSettled in the orchestrator would mask any
//     throw silently, and the user-facing message would never surface.
//
// The list-visibility integration test (asserting hosted-fallback shows
// up under the not-found bucket of `list` output) lives in plan 04-13's
// integration test, not here. This file's scope is the adapter contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import hostedFallback from '../lib/adapters/hosted-fallback.js';

test('detect: always returns found:false (no cwd/homedir input)', async () => {
  const r = await hostedFallback.detect();
  assert.deepEqual(r, { found: false });
});

test('detect: ignores cwd/homedir; still returns found:false', async () => {
  const r = await hostedFallback.detect({ cwd: '/tmp', homedir: '/home/anyone' });
  assert.deepEqual(r, { found: false });
});

test('install: returns { written: [], skipped: [<message>] } with print + export refs', async () => {
  const r = await hostedFallback.install({
    skills: [],
    scope: 'project',
    paths: { project: null },
    dryRun: false,
    version: '0.1.0',
  });
  assert.deepEqual(r.written, []);
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0], /npx 10x-engineer print/);
  assert.match(r.skipped[0], /npx 10x-engineer export/);
});

test('install: does not throw / reject (Pitfall 1 invariant)', async () => {
  // Promise.allSettled in the orchestrator would silently swallow any
  // throw, and the user-facing message would never reach the CLI row.
  // Probe a representative cross-section of input shapes.
  await assert.doesNotReject(async () => hostedFallback.install({}));
  await assert.doesNotReject(async () => hostedFallback.install({ scope: 'global' }));
  await assert.doesNotReject(async () => hostedFallback.install({ scope: 'both', dryRun: true }));
  await assert.doesNotReject(async () => hostedFallback.install());
});

test('install: performs zero filesystem mutation (snapshot equality)', async (t) => {
  const root = await mkdtemp(join(tmpdir(), '10xe-hosted-fallback-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const before = (await readdir(root)).sort();
  const beforeStat = await stat(root);

  await hostedFallback.install({
    skills: [],
    scope: 'project',
    paths: { project: join(root, 'irrelevant.md') },
    dryRun: false,
    version: '0.1.0',
  });

  const after = (await readdir(root)).sort();
  const afterStat = await stat(root);
  assert.deepEqual(after, before, 'mkdtemp directory contents must be unchanged');
  assert.equal(afterStat.mtimeMs, beforeStat.mtimeMs, 'mkdtemp directory mtime must be unchanged');
});

test('uninstall: returns { removed: [] }', async () => {
  const r = await hostedFallback.uninstall({ scope: 'project', paths: {}, dryRun: false });
  assert.deepEqual(r, { removed: [] });
});

test('uninstall: does not throw / reject (Pitfall 1 invariant)', async () => {
  await assert.doesNotReject(async () => hostedFallback.uninstall({}));
  await assert.doesNotReject(async () => hostedFallback.uninstall({ scope: 'global' }));
  await assert.doesNotReject(async () => hostedFallback.uninstall({ scope: 'both', dryRun: true }));
  await assert.doesNotReject(async () => hostedFallback.uninstall());
});

test('uninstall: performs zero filesystem mutation (snapshot equality)', async (t) => {
  const root = await mkdtemp(join(tmpdir(), '10xe-hosted-fallback-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const before = (await readdir(root)).sort();
  const beforeStat = await stat(root);

  await hostedFallback.uninstall({
    scope: 'both',
    paths: { global: join(root, 'g'), project: join(root, 'p') },
    dryRun: false,
  });

  const after = (await readdir(root)).sort();
  const afterStat = await stat(root);
  assert.deepEqual(after, before, 'mkdtemp directory contents must be unchanged');
  assert.equal(afterStat.mtimeMs, beforeStat.mtimeMs, 'mkdtemp directory mtime must be unchanged');
});

test('install: dryRun:true vs dryRun:false return equivalent shape (adapter ignores filesystem regardless)', async () => {
  const a = await hostedFallback.install({ dryRun: false });
  const b = await hostedFallback.install({ dryRun: true });
  assert.deepEqual(a.written, b.written);
  assert.deepEqual(a.skipped, b.skipped);
});

test('all entry-point methods return Promises (async contract conformance)', () => {
  assert.ok(hostedFallback.detect() instanceof Promise);
  assert.ok(hostedFallback.install() instanceof Promise);
  assert.ok(hostedFallback.uninstall() instanceof Promise);
});
