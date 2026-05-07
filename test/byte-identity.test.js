// test/byte-identity.test.js
//
// Smoke tests for the shared assertByteIdenticalAroundMarker helper. Per
// Plan 03-01 Task 3. The helper is consumed by every Phase 3 append-mode
// adapter test (Codex, Gemini, opencode AGENTS.md, Continue) — these
// smokes prove the helper accepts correct round-trips and rejects damaged
// user content.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertByteIdenticalAroundMarker } from './helpers/byte-identity.js';

test('byte-identity: passes when only difference is a marker block appended after original content', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-byteid-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const original = '# user file\n\nsome content\n';
  const installed =
    original +
    '<!-- BEGIN 10x-engineer v0.1.0 -->\n' +
    'persona body\n' +
    '<!-- END 10x-engineer -->\n';
  const f = join(dir, 'AGENTS.md');
  await writeFile(f, installed);

  // Must not throw.
  await assertByteIdenticalAroundMarker(f, original);
});

test('byte-identity: passes when original lacked trailing newline and \\n was synthesised', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-byteid-nlsynth-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  // Original ends with `}` — no trailing newline. Per FND-09-refined,
  // replaceBlock synthesises a single \n between user content and the
  // marker block. The helper must accept this bounded artefact.
  const original = '{\n  "key": "value"\n}';
  const installed =
    original + '\n' +
    '<!-- BEGIN 10x-engineer v0.1.0 -->\n' +
    'persona body\n' +
    '<!-- END 10x-engineer -->\n';
  const f = join(dir, 'AGENTS.md');
  await writeFile(f, installed);

  await assertByteIdenticalAroundMarker(f, original);
});

test('byte-identity: FAILS when user content above the marker was modified', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-byteid-damaged-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const original = '# user file\n\nline alpha\nline beta\n';
  // Damaged: `line alpha` was rewritten to `line ALPHA` between install and assert.
  const damaged =
    '# user file\n\nline ALPHA\nline beta\n' +
    '<!-- BEGIN 10x-engineer v0.1.0 -->\n' +
    'persona body\n' +
    '<!-- END 10x-engineer -->\n';
  const f = join(dir, 'AGENTS.md');
  await writeFile(f, damaged);

  await assert.rejects(
    () => assertByteIdenticalAroundMarker(f, original),
    /BEFORE marker not byte-identical/i,
    'helper must reject when user content above marker drifted',
  );
});
