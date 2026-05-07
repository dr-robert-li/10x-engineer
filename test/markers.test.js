// test/markers.test.js — invariant tests for lib/markers.js
//
// Five tests live in this file. Each is independently meaningful; the first is
// the architectural-lock test that locks the prefix-only matching invariant
// across every future package version.
//
// Test isolation: each test creates its own mkdtemp workspace and cleans up via
// t.after. No committed fixtures. No global state.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  replaceBlock,
  stripBlock,
  wrapBlock,
  MARKER_BEGIN_PREFIX,
  MARKER_END,
} from '../lib/markers.js';

test('architectural-lock: stripBlock removes a v0.9 marker block at any current version', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-arch-lock-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, 'AGENTS.md');

  // The fixture uses v0.9 — a release that predates the current package version.
  // The current-version stripBlock must remove it cleanly. If this test ever
  // fails, someone tightened MARKER_BEGIN_PREFIX or BLOCK_RE to require a
  // specific version. Treat the failure as "revert the change", never "update
  // the fixture".
  const before =
    '# my own rules\n' +
    '\n' +
    '<!-- BEGIN 10x-engineer v0.9 -->\n' +
    'old persona body\n' +
    'with multiple lines\n' +
    '<!-- END 10x-engineer -->\n' +
    '\n' +
    'my closing notes\n';

  await writeFile(target, before);
  const result = await stripBlock(target);

  assert.equal(result.removed, true);
  const after = await readFile(target, 'utf8');
  assert.ok(!after.includes('BEGIN 10x-engineer'), 'BEGIN marker still present');
  assert.ok(!after.includes('END 10x-engineer'),   'END marker still present');
  assert.ok(after.includes('my own rules'),         'user content stripped');
  assert.ok(after.includes('my closing notes'),     'user content stripped');
});

test('CRLF: replaceBlock matches a CRLF-saved block and replaces it once', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-crlf-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, 'AGENTS.md');

  const before =
    '# windows file\r\n' +
    '<!-- BEGIN 10x-engineer v1.0 -->\r\n' +
    'old\r\n' +
    '<!-- END 10x-engineer -->\r\n' +
    'tail\r\n';
  await writeFile(target, before);

  const newBlock = wrapBlock('new content\n', '0.1.0');
  await replaceBlock(target, newBlock);

  const after = await readFile(target, 'utf8');
  assert.equal((after.match(/<!-- BEGIN 10x-engineer/g) || []).length, 1);
  assert.ok(after.includes('new content'));
  assert.ok(!after.includes('old'));
  assert.ok(after.startsWith('# windows file\r\n'));
});

test('BOM: safeReadFile preserves UTF-8 BOM on round-trip', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-bom-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, 'AGENTS.md');

  // Construct the BOM as a byte buffer; never paste a literal BOM into source.
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  const body = Buffer.from('# rules\n', 'utf8');
  await writeFile(target, Buffer.concat([bom, body]));

  const newBlock = wrapBlock('persona\n', '0.1.0');
  await replaceBlock(target, newBlock);
  await stripBlock(target);

  const raw = await readFile(target);
  if (raw.length === 0) return; // empty-file deletion is acceptable
  assert.equal(raw[0], 0xEF);
  assert.equal(raw[1], 0xBB);
  assert.equal(raw[2], 0xBF);
});

test('$&-substitution: function-form replace preserves literal $&, $1, $`, $$', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-subst-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, 'AGENTS.md');

  await writeFile(target,
    '<!-- BEGIN 10x-engineer v1.0 -->\nold\n<!-- END 10x-engineer -->\n');

  const dangerous =
    '<!-- BEGIN 10x-engineer v0.1.0 -->\n' +
    'Cost is $1 and $& and $`escape and $$\n' +
    '<!-- END 10x-engineer -->\n';
  await replaceBlock(target, dangerous);

  const after = await readFile(target, 'utf8');
  assert.ok(after.includes('Cost is $1 and $& and $`escape and $$'),
    `tokens were interpreted instead of preserved: ${after}`);
});

test('multi-BEGIN: two BEGIN one END throws and leaves file untouched', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-multi-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, 'AGENTS.md');

  const corrupt =
    '<!-- BEGIN 10x-engineer v0.9 -->\n' +
    'old\n' +
    '<!-- BEGIN 10x-engineer v1.0 -->\n' +
    'USER CONTENT\n' +
    '<!-- END 10x-engineer -->\n';
  await writeFile(target, corrupt);

  const newBlock = '<!-- BEGIN 10x-engineer v1.1 -->\nnew\n<!-- END 10x-engineer -->\n';
  await assert.rejects(
    replaceBlock(target, newBlock),
    (err) => err.name === 'MarkerCorruptionError'
              && err.beginCount === 2
              && err.endCount === 1,
  );

  assert.equal(await readFile(target, 'utf8'), corrupt);
});
