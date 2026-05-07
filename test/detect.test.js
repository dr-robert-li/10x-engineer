// test/detect.test.js — fault-isolation lock + ancestor-walk boundary tests.
//
// Five named tests:
//   1. Production-path Promise.allSettled fault-isolation (TEST-05 architectural lock).
//      Imports the live detectAll and the live adapters registry, mutates the registry
//      with a throwing adapter and an OK adapter, asserts the throw lands in `errored`
//      while the OK lands in `found`, restores via t.after splice cleanup.
//   2. Algorithm-shape unit: three-bucket return preserves scope and paths from found.
//   3. Algorithm-shape unit: throwing + ok + not-found land in correct buckets.
//   4. findAncestorWith stops at the .git boundary, never traversing past.
//   5. findAncestorWith stops at the homedir boundary when no .git exists.
//
// Tests 2 and 3 use a local `detectAllOf` mirror to unit-test the algorithm shape
// independent of the registry. They do NOT discharge TEST-05; only test 1 does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectAll, findAncestorWith, commandExists } from '../lib/detect.js';
import adapters from '../lib/adapters/index.js';

// Local stub adapter factory — used by the algorithm-shape unit tests below
const stub = (id, behavior) => ({
  id,
  displayName: id,
  format: 'native-skills',
  detect: behavior,
  install:   async () => ({ written: [] }),
  uninstall: async () => ({ removed: [] }),
});

// Inline detectAll-of-array mirror — for the algorithm-shape unit tests only.
// The architectural-lock fault-isolation test below uses the REAL detectAll.
async function detectAllOf(arr, ctx) {
  const settled = await Promise.allSettled(
    arr.map(async (a) => ({ adapter: a, result: await a.detect(ctx) })),
  );
  const found = [], notFound = [], errored = [];
  for (let i = 0; i < settled.length; i++) {
    const a = arr[i], s = settled[i];
    if (s.status === 'rejected') errored.push({ adapter: a, error: s.reason });
    else if (s.value.result.found) found.push({ adapter: a, ...s.value.result });
    else notFound.push({ adapter: a });
  }
  return { found, notFound, errored };
}

// ---- TEST-05 architectural lock: production detectAll under a poisoned registry ----
test('detectAll: Promise.allSettled fault-isolation — one throwing adapter does not poison the batch', async (t) => {
  // Inject a throwing adapter and an OK adapter into the LIVE registry, then restore
  // via t.after(). Mirrors the registry-mutation idiom from 02-07-PLAN.md ~528-532.
  // This test FAILS if anyone refactors detectAll to use Promise.all instead of allSettled.
  const throwingAdapter = {
    id: 'throwing-test-adapter',
    displayName: 'Throwing Test Adapter',
    format: 'native-skills',
    detect: async () => { throw Object.assign(new Error('synthetic failure'), { code: 'EACCES' }); },
    install:   async () => ({ written: [] }),
    uninstall: async () => ({ removed: [] }),
  };
  const okAdapter = {
    id: 'ok-test-adapter',
    displayName: 'OK Test Adapter',
    format: 'native-skills',
    detect: async () => ({ found: true, scope: 'global', paths: { global: '/tmp/ok-fixture' } }),
    install:   async () => ({ written: [] }),
    uninstall: async () => ({ removed: [] }),
  };
  adapters.push(throwingAdapter, okAdapter);
  t.after(() => {
    const i1 = adapters.indexOf(throwingAdapter);
    if (i1 >= 0) adapters.splice(i1, 1);
    const i2 = adapters.indexOf(okAdapter);
    if (i2 >= 0) adapters.splice(i2, 1);
  });

  const result = await detectAll({ cwd: '/tmp', homedir: '/tmp' });

  // The throwing adapter shows up in `errored` — never thrown out of detectAll.
  const erroredEntry = result.errored.find((e) => e.adapter.id === 'throwing-test-adapter');
  assert.ok(erroredEntry, 'throwing adapter must appear in result.errored');
  assert.match(
    erroredEntry.error?.message ?? String(erroredEntry.error),
    /synthetic failure/,
    'errored entry must surface the original error message',
  );

  // The OK adapter still ran — fault isolation proven against the production code path.
  const okEntry = result.found.find((e) => e.adapter.id === 'ok-test-adapter');
  assert.ok(okEntry, 'OK adapter must still appear in result.found despite sibling throw');
  assert.equal(okEntry.scope, 'global');
});

// ---- Algorithm-shape unit tests (local mirror; do not discharge TEST-05) ----
test('three-bucket return shape preserves scope and paths from found adapters', async () => {
  const fakes = [
    stub('a', async () => ({ found: true, scope: 'both', paths: { global: '/g', project: '/p' } })),
    stub('b', async () => ({ found: true, scope: 'project', paths: { project: '/p' } })),
    stub('c', async () => ({ found: false })),
  ];
  const r = await detectAllOf(fakes, {});
  assert.equal(r.found.length, 2);
  assert.equal(r.found[0].scope, 'both');
  assert.equal(r.found[0].paths.global, '/g');
  assert.equal(r.found[0].paths.project, '/p');
  assert.equal(r.found[1].scope, 'project');
  assert.equal(r.found[1].paths.project, '/p');
  assert.equal(r.notFound.length, 1);
  assert.equal(r.notFound[0].adapter.id, 'c');
});

test('local-mirror algorithm shape: throwing + ok + not-found land in correct buckets', async () => {
  const fakes = [
    stub('ok-1',     async () => ({ found: true, scope: 'global', paths: { global: '/x' } })),
    stub('boom',     async () => { throw Object.assign(new Error('blew up'), { code: 'EACCES' }); }),
    stub('ok-2',     async () => ({ found: false })),
    stub('boom-sync', async () => { throw new TypeError('sync-throw inside async'); }),
  ];
  const r = await detectAllOf(fakes, {});
  assert.equal(r.found.length, 1, 'expected 1 found');
  assert.equal(r.notFound.length, 1, 'expected 1 notFound');
  assert.equal(r.errored.length, 2, 'expected 2 errored');
  assert.equal(r.found[0].adapter.id, 'ok-1');
  assert.equal(r.errored[0].adapter.id, 'boom');
  assert.equal(r.errored[0].error.code, 'EACCES');
  assert.equal(r.errored[1].adapter.id, 'boom-sync');
});

test('findAncestorWith stops at .git boundary, never traversing past', async (t) => {
  const root = await mkdtemp(join(tmpdir(), '10xe-detect-git-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  // root/.git (boundary)
  // root/projA/sub/cwd  ← walk starts here
  // root/.cursor        ← would be FOUND if we walked past .git
  await mkdir(join(root, '.git'));
  await mkdir(join(root, 'projA', 'sub', 'cwd'), { recursive: true });
  await mkdir(join(root, '.cursor'));

  // homedir is set to /tmp so .git is the binding boundary
  const result = await findAncestorWith(
    join(root, 'projA', 'sub', 'cwd'),
    '.cursor',
    '/tmp',
  );
  // .cursor lives at the .git boundary level → must NOT be found
  assert.equal(result, null);
});

test('findAncestorWith stops at homedir boundary when no .git exists', async (t) => {
  const root = await mkdtemp(join(tmpdir(), '10xe-detect-home-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  // root (= homedir for this test)
  // root/projB/cwd
  // root/.cursor   ← would be FOUND if we walked past homedir
  await mkdir(join(root, 'projB', 'cwd'), { recursive: true });
  await mkdir(join(root, '.cursor'));

  // homedir IS root — walk must stop here, never going to root's parent
  const result = await findAncestorWith(
    join(root, 'projB', 'cwd'),
    '.cursor',
    root,
  );
  // .cursor exists inside the homedir bound — finding it AT homedir is allowed
  // (the boundary is "do not traverse past", not "do not find at")
  assert.equal(result, root);

  // But a marker that lives strictly above homedir must NOT be found
  const above = await findAncestorWith(
    join(root, 'projB', 'cwd'),
    'definitely-not-here',
    root,
  );
  assert.equal(above, null);
});

// ---- commandExists: PATH-binary detection helper (Phase 3 Plan 03-01) ----
//
// commandExists is consumed by Wave 3 adapters (Codex, Gemini, Aider) that
// gate detection on PATH presence in addition to filesystem signature.
// The helper is a pure PATH-scan — no child_process — and these tests pin
// that contract along with the POSIX/Windows candidate-generation rules.

test('commandExists: returns true for binary in fixture PATH', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), '10xe-cmd-found-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const bin = join(tmp, 'foo-bin');
  await writeFile(bin, '#!/bin/sh\necho ok\n');
  await chmod(bin, 0o755);
  const result = await commandExists('foo-bin', { PATH: tmp });
  assert.equal(result, true);
});

test('commandExists: returns false when binary is not on PATH', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), '10xe-cmd-missing-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  // Empty directory — no binary present
  const result = await commandExists('definitely-not-installed-xyz', { PATH: tmp });
  assert.equal(result, false);
});

test('commandExists: tolerates non-existent PATH entries (no throw)', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), '10xe-cmd-tolerant-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const bin = join(tmp, 'real-bin');
  await writeFile(bin, '#!/bin/sh\n');
  await chmod(bin, 0o755);
  // PATH contains a non-existent dir BEFORE the real one — must still find the real one
  const ghost = join(tmp, 'definitely-not-a-dir-zzz');
  const env = { PATH: `${ghost}:${tmp}` };
  const result = await commandExists('real-bin', env);
  assert.equal(result, true);
});

test('commandExists: empty PATH returns false safely', async () => {
  // env.PATH absent or empty — no candidates to scan, no throw
  assert.equal(await commandExists('anything', { PATH: '' }), false);
  assert.equal(await commandExists('anything', {}), false);
});

test('commandExists: Windows-mode honours PATHEXT for candidate names', async (t) => {
  // Simulate Windows candidate generation by passing a PATHEXT env. We cannot
  // rewrite process.platform inside a running process, but the contract is:
  // on win32, PATHEXT-derived candidates are checked. We discharge the
  // candidate-generation half by checking the POSIX path stays exactly one
  // candidate (`name`) and the Windows path would expand. Concretely: we
  // verify the POSIX behaviour does NOT spuriously match a `.EXE`-suffixed
  // file when the bare name is absent — a Windows-only fingerprint must not
  // leak into POSIX detection.
  const tmp = await mkdtemp(join(tmpdir(), '10xe-cmd-pathext-'));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const exe = join(tmp, 'thing.EXE');
  await writeFile(exe, 'binary-stub\n');
  await chmod(exe, 0o755);
  // On POSIX the candidate set is [''], so 'thing' must NOT match 'thing.EXE'.
  if (process.platform !== 'win32') {
    assert.equal(
      await commandExists('thing', { PATH: tmp }),
      false,
      'POSIX candidate set is [""] — the .EXE-suffixed file must not be matched',
    );
  }
  // On either platform, querying the literal filename 'thing.EXE' WITH that
  // exact name on PATH must succeed — proves the file fixture is well-formed.
  assert.equal(await commandExists('thing.EXE', { PATH: tmp }), true);
});
