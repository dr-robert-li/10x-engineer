// test/state.test.js — runtime enable/disable state.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, mkdir, rm, writeFile, readFile, access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readState, writeState, clearState, statePath, STATE_DIR, STATE_FILENAME,
} from '../lib/state.js';

async function makeHome(t) {
  const root = await mkdtemp(join(tmpdir(), '10xe-state-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('readState: missing file → enabled:true (default-on)', async (t) => {
  const homedir = await makeHome(t);
  const state = await readState({ homedir });
  assert.deepEqual(state, { enabled: true });
});

test('readState: enabled:false in file → enabled:false', async (t) => {
  const homedir = await makeHome(t);
  await mkdir(join(homedir, STATE_DIR));
  await writeFile(join(homedir, STATE_DIR, STATE_FILENAME), '{"enabled":false}');
  const state = await readState({ homedir });
  assert.deepEqual(state, { enabled: false });
});

test('readState: enabled:true in file → enabled:true', async (t) => {
  const homedir = await makeHome(t);
  await mkdir(join(homedir, STATE_DIR));
  await writeFile(join(homedir, STATE_DIR, STATE_FILENAME), '{"enabled":true}');
  const state = await readState({ homedir });
  assert.deepEqual(state, { enabled: true });
});

test('readState: malformed JSON → default-on (enabled:true)', async (t) => {
  const homedir = await makeHome(t);
  await mkdir(join(homedir, STATE_DIR));
  await writeFile(join(homedir, STATE_DIR, STATE_FILENAME), '{not json');
  const state = await readState({ homedir });
  assert.deepEqual(state, { enabled: true });
});

test('writeState: creates parent dir and writes pretty JSON', async (t) => {
  const homedir = await makeHome(t);
  await writeState({ homedir, enabled: false });
  const file = statePath({ homedir });
  const raw = await readFile(file, 'utf8');
  assert.match(raw, /"enabled": false/);
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed, { enabled: false });
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
  await writeState({ homedir, enabled: false, dryRun: true });
  await assert.rejects(access(statePath({ homedir })), { code: 'ENOENT' });
});

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
  // removed array still records the would-be paths.
  assert.equal(r.removed.length, 2);
  // File still exists.
  await access(statePath({ homedir }));
});
