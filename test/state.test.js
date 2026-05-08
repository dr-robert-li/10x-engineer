// test/state.test.js — runtime enable/disable state.
//
// HOOK-01: default-off semantic — missing/malformed state resolves to
// enabled:false. Phase 6 inverted these assertions from the v0.2.0
// default-on contract. The original tests are intentionally NOT preserved
// alongside; they encoded the OLD semantic.
//
// HOOK-06: safeWriteFlag invariants — symlink-target refusal, symlink-parent
// refusal, atomic rename, mode 0600 (POSIX-only assertion guarded by
// process.platform), parent auto-mkdir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, mkdir, rm, writeFile, readFile, access, symlink, stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  readState,
  writeState,
  clearState,
  safeWriteFlag,
  statePath,
  STATE_DIR,
  STATE_FILENAME,
} from '../lib/state.js';

async function makeHome(t) {
  const root = await mkdtemp(join(tmpdir(), '10xe-state-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

// ---------------------------------------------------------------------------
// readState — default-off (HOOK-01)
// ---------------------------------------------------------------------------

test('readState: missing file → enabled:false (default-off)', async (t) => {
  const homedir = await makeHome(t);
  assert.deepEqual(await readState({ homedir }), { enabled: false });
});

test('readState: enabled:false in file → enabled:false', async (t) => {
  const homedir = await makeHome(t);
  await mkdir(join(homedir, STATE_DIR));
  await writeFile(join(homedir, STATE_DIR, STATE_FILENAME), '{"enabled":false}');
  assert.deepEqual(await readState({ homedir }), { enabled: false });
});

test('readState: enabled:true in file → enabled:true', async (t) => {
  const homedir = await makeHome(t);
  await mkdir(join(homedir, STATE_DIR));
  await writeFile(join(homedir, STATE_DIR, STATE_FILENAME), '{"enabled":true}');
  assert.deepEqual(await readState({ homedir }), { enabled: true });
});

test('readState: malformed JSON → enabled:false (fail-closed)', async (t) => {
  const homedir = await makeHome(t);
  await mkdir(join(homedir, STATE_DIR));
  await writeFile(join(homedir, STATE_DIR, STATE_FILENAME), '{not json');
  assert.deepEqual(await readState({ homedir }), { enabled: false });
});

test('readState: enabled is the string "true" → enabled:false (strict)', async (t) => {
  const homedir = await makeHome(t);
  await mkdir(join(homedir, STATE_DIR));
  await writeFile(join(homedir, STATE_DIR, STATE_FILENAME), '{"enabled":"true"}');
  assert.deepEqual(await readState({ homedir }), { enabled: false });
});

test('readState: missing enabled key → enabled:false', async (t) => {
  const homedir = await makeHome(t);
  await mkdir(join(homedir, STATE_DIR));
  await writeFile(join(homedir, STATE_DIR, STATE_FILENAME), '{}');
  assert.deepEqual(await readState({ homedir }), { enabled: false });
});

// ---------------------------------------------------------------------------
// writeState — round-trips through safeWriteFlag
// ---------------------------------------------------------------------------

test('writeState: creates parent dir and writes pretty JSON', async (t) => {
  const homedir = await makeHome(t);
  const r = await writeState({ homedir, enabled: false });
  assert.equal(r.written, true);
  const file = statePath({ homedir });
  const raw = await readFile(file, 'utf8');
  assert.match(raw, /"enabled": false/);
  assert.deepEqual(JSON.parse(raw), { enabled: false });
});

test('writeState: round-trips through readState', async (t) => {
  const homedir = await makeHome(t);
  await writeState({ homedir, enabled: false });
  assert.deepEqual(await readState({ homedir }), { enabled: false });
  await writeState({ homedir, enabled: true });
  assert.deepEqual(await readState({ homedir }), { enabled: true });
});

test('writeState: dryRun touches no disk', async (t) => {
  const homedir = await makeHome(t);
  const r = await writeState({ homedir, enabled: false, dryRun: true });
  assert.equal(r.written, false);
  await assert.rejects(access(statePath({ homedir })), { code: 'ENOENT' });
});

// ---------------------------------------------------------------------------
// clearState — unchanged from v0.2.0
// ---------------------------------------------------------------------------

test('clearState: missing state is a no-op', async (t) => {
  const homedir = await makeHome(t);
  const r = await clearState({ homedir });
  assert.deepEqual(r.removed, []);
});

test('clearState: removes state file and the empty parent dir', async (t) => {
  const homedir = await makeHome(t);
  await writeState({ homedir, enabled: false });
  const r = await clearState({ homedir });
  assert.equal(r.removed.length, 2);
  await assert.rejects(access(statePath({ homedir })), { code: 'ENOENT' });
  await assert.rejects(access(join(homedir, STATE_DIR)), { code: 'ENOENT' });
});

test('clearState: dryRun does not touch disk', async (t) => {
  const homedir = await makeHome(t);
  await writeState({ homedir, enabled: false });
  const r = await clearState({ homedir, dryRun: true });
  assert.equal(r.removed.length, 2);
  await access(statePath({ homedir }));
});

// ---------------------------------------------------------------------------
// safeWriteFlag — symlink refusal + atomic rename + mode 0600 (HOOK-06)
// ---------------------------------------------------------------------------

test('safeWriteFlag: writes content and returns path on happy path', async (t) => {
  const homedir = await makeHome(t);
  const target = join(homedir, '.10x-engineer', 'state.json');
  const r = await safeWriteFlag(target, '{"enabled":false}\n');
  assert.equal(r.written, true);
  assert.equal(r.path, target);
  assert.equal(await readFile(target, 'utf8'), '{"enabled":false}\n');
});

test('safeWriteFlag: auto-creates parent dir if missing', async (t) => {
  const homedir = await makeHome(t);
  const target = join(homedir, '.10x-engineer', 'state.json');
  // Parent does not exist yet — function must mkdir -p
  await safeWriteFlag(target, 'x');
  await access(dirname(target));
});

test('safeWriteFlag: refuses symlinked target', async (t) => {
  if (process.platform === 'win32') return; // symlink semantics differ; skip
  const homedir = await makeHome(t);
  const dir = join(homedir, '.10x-engineer');
  await mkdir(dir, { recursive: true });
  const target = join(dir, 'state.json');
  const decoy = join(homedir, 'decoy');
  await writeFile(decoy, 'untouched\n');
  await symlink(decoy, target);
  const r = await safeWriteFlag(target, 'attacker-controlled');
  assert.equal(r.written, false);
  assert.equal(r.reason, 'target-is-symlink');
  // The decoy must remain untouched
  assert.equal(await readFile(decoy, 'utf8'), 'untouched\n');
});

test('safeWriteFlag: refuses symlinked parent dir', async (t) => {
  if (process.platform === 'win32') return; // symlink semantics differ; skip
  const homedir = await makeHome(t);
  const realDir = join(homedir, 'real');
  await mkdir(realDir);
  const fakeDir = join(homedir, '.10x-engineer');
  await symlink(realDir, fakeDir);
  const target = join(fakeDir, 'state.json');
  const r = await safeWriteFlag(target, 'attacker-controlled');
  assert.equal(r.written, false);
  assert.equal(r.reason, 'parent-is-symlink');
});

test('safeWriteFlag: writes mode 0600 on POSIX', async (t) => {
  if (process.platform === 'win32') return; // NTFS does not honour POSIX modes
  const homedir = await makeHome(t);
  const target = join(homedir, '.10x-engineer', 'state.json');
  await safeWriteFlag(target, 'x');
  const st = await stat(target);
  assert.equal(st.mode & 0o777, 0o600);
});

test('safeWriteFlag: leaves no orphan tempfile after a successful write', async (t) => {
  const homedir = await makeHome(t);
  const target = join(homedir, '.10x-engineer', 'state.json');
  await safeWriteFlag(target, 'x');
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(dirname(target));
  // Only the final file should remain — no `state.json.10x-engineer.<pid>.<ts>` tempfile.
  assert.deepEqual(entries.sort(), ['state.json']);
});
