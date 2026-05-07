// test/safe-fs.test.js — invariant tests for lib/safe-fs.js
//
// Five tests pin the contract of safeReadFile + safeWriteFile:
//   1. Plain write returns { written:true, path } and lands the bytes
//   2. dryRun:true short-circuits BEFORE any syscall — no tempfile, no target
//   3. Tempfile is cleaned up when the underlying writeFile rejects
//   4. UTF-8 BOM round-trips via { hadBom:true }
//   5. originalEol detection (LF / CRLF / mixed)
//
// Per-test isolation: each test creates its own mkdtemp workspace and cleans
// up via t.after(rm). No committed fixtures. No global state. The BOM byte
// sequence is constructed via Buffer.from([0xEF, 0xBB, 0xBF]) — never as a
// literal source byte.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeReadFile, safeWriteFile } from '../lib/safe-fs.js';

test('safeWriteFile writes content and returns path', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-sfs-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, 'out.txt');
  const result = await safeWriteFile(target, 'hello');
  assert.equal(result.written, true);
  assert.equal(result.path, target);
  assert.equal(await readFile(target, 'utf8'), 'hello');
});

test('safeWriteFile with dryRun=true does not touch disk', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-sfs-dry-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, 'never-written.txt');
  const result = await safeWriteFile(target, 'should not land', { dryRun: true });
  assert.equal(result.written, false);
  await assert.rejects(stat(target), { code: 'ENOENT' });
  // No tempfile lingers either
  const remaining = await readdir(dir);
  assert.deepEqual(remaining, []);
});

test('safeWriteFile cleans up tempfile when writeFile fails', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-sfs-clean-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, 'doomed.txt');
  // Pass an invalid content type so writeFile rejects
  await assert.rejects(safeWriteFile(target, { not: 'a string or buffer' }));
  const remaining = await readdir(dir);
  assert.deepEqual(remaining.filter(n => n.includes('10x-engineer.tmp')), []);
});

test('safeReadFile + safeWriteFile preserve UTF-8 BOM round-trip', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-sfs-bom-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const target = join(dir, 'bom.md');
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  const body = Buffer.from('# rules\nbody\n', 'utf8');
  await writeFile(target, Buffer.concat([bom, body]));

  const r = await safeReadFile(target);
  assert.equal(r.hadBom, true);
  // The BOM codepoint must be stripped from content
  assert.notEqual(r.content.charCodeAt(0), 0xFEFF);
  assert.ok(r.content.startsWith('# rules'));

  // Round-trip: write back with hadBom=true and verify on-disk bytes
  await safeWriteFile(target, r.content + 'extra\n', { hadBom: true });
  const raw = await readFile(target);
  assert.equal(raw[0], 0xEF);
  assert.equal(raw[1], 0xBB);
  assert.equal(raw[2], 0xBF);
  // body was preserved
  const text = await readFile(target, 'utf8');
  assert.ok(text.includes('# rules'));
  assert.ok(text.includes('extra'));
});

test('safeReadFile reports originalEol for LF, CRLF, and mixed files', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-sfs-eol-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const lf = join(dir, 'lf.txt');
  await writeFile(lf, 'a\nb\nc\n');
  assert.equal((await safeReadFile(lf)).originalEol, '\n');

  const crlf = join(dir, 'crlf.txt');
  await writeFile(crlf, 'a\r\nb\r\nc\r\n');
  assert.equal((await safeReadFile(crlf)).originalEol, '\r\n');

  const mixed = join(dir, 'mixed.txt');
  await writeFile(mixed, 'a\r\nb\nc\r\n');
  assert.equal((await safeReadFile(mixed)).originalEol, 'mixed');
});
