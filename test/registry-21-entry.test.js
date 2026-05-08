// test/registry-21-entry.test.js — Plan 04-13 keystone shape test.
//
// Pins the adapter registry at 21 entries (9 Phase 3 Tier 1 + 12 Phase 4
// Tier 2) in locked alphabetical-by-id order. Cody (TIER2-03) is
// DEFERRED per locked user decision #1; the registry MUST NOT contain
// it. This file is the single source of truth for Pitfall 13 (alphabetical
// ordering) and Pitfall 2 (no orchestrator special-casing of
// hosted-fallback) at registry scale.
//
// Stream-injection helper lifted from test/install-multi-adapter.test.js
// (Phase 3 multi-adapter pattern).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import adapters from '../lib/adapters/index.js';
import { runList } from '../lib/install.js';

// Locked alphabetical-by-id array. If this drifts, Phase 4 SC#4 breaks.
// `'continue'` (con) sorts before `'copilot-chat'` (cop) — verify by
// `'n' < 'p'` lexicographic order.
const EXPECTED_IDS = [
  'aider',
  'amazon-q',
  'claude-code',
  'cline',
  'codex',
  'continue',
  'copilot-chat',
  'cursor',
  'gemini',
  'goose',
  'hosted-fallback',
  'jetbrains',
  'kilo-code',
  'opencode',
  'pearai',
  'pieces',
  'plandex',
  'roo-code',
  'tabnine',
  'windsurf',
  'zed',
];

test('registry: length === 21', () => {
  assert.equal(adapters.length, 21);
});

test('registry: id-array matches locked alphabetical order (Pitfall 13)', () => {
  const ids = adapters.map((a) => a.id);
  assert.deepEqual(ids, EXPECTED_IDS);
});

test('registry: every adapter exports the canonical 6 fields', () => {
  for (const a of adapters) {
    assert.equal(typeof a.id, 'string', `${a.id ?? '?'}.id`);
    assert.equal(typeof a.displayName, 'string', `${a.id}.displayName`);
    assert.equal(typeof a.format, 'string', `${a.id}.format`);
    assert.equal(typeof a.detect, 'function', `${a.id}.detect`);
    assert.equal(typeof a.install, 'function', `${a.id}.install`);
    assert.equal(typeof a.uninstall, 'function', `${a.id}.uninstall`);
  }
});

test('registry: no duplicate ids', () => {
  const ids = adapters.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id detected');
});

test('registry: cody is DEFERRED — not in registry (locked user decision #1)', () => {
  const ids = adapters.map((a) => a.id);
  assert.equal(ids.includes('cody'), false, 'cody must not appear in the registry');
});

// Stream helpers — same pattern as test/install-multi-adapter.test.js.
function makeStreams() {
  const out = [];
  const err = [];
  const stdout = new Writable({
    write(c, _e, cb) {
      out.push(c.toString('utf8'));
      cb();
    },
  });
  const stderr = new Writable({
    write(c, _e, cb) {
      err.push(c.toString('utf8'));
      cb();
    },
  });
  return { streams: { stdout, stderr }, out, err };
}

// PATH neutralisation — adapters that probe commandExists (aider, codex,
// gemini, goose, pieces, plandex, amazon-q) would otherwise leak detection
// from the dev box into a filesystem-empty fixture.
function neutralisePath(t, root) {
  const original = process.env.PATH;
  process.env.PATH = root;
  t.after(() => {
    process.env.PATH = original;
  });
}

test('list: hosted-fallback appears under not-found alongside the other 20 adapters (ROADMAP SC#4 + Pitfall 2)', async (t) => {
  const root = await mkdtemp(join(tmpdir(), '10xe-list-21-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  neutralisePath(t, root);
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });

  const { streams, out } = makeStreams();
  const code = await runList({ cwd, homedir, streams });
  assert.equal(code, 0);

  const output = out.join('');
  // All 21 adapters' displayNames should appear in the not-found bucket
  // because the fixture is empty.
  for (const a of adapters) {
    assert.ok(
      output.includes(a.displayName),
      `${a.id} (${a.displayName}) missing from list output`,
    );
  }
  // hosted-fallback specifically must appear — the orchestrator does NOT
  // special-case suppress it (Pitfall 2).
  assert.match(
    output,
    /Hosted agent \(manual install\)/,
    'hosted-fallback must appear in list output (Pitfall 2 — no orchestrator special-case suppression)',
  );
});

test('lib/install.js does not special-case hosted-fallback (Pitfall 2 source-level grep)', async () => {
  const installSrc = await readFile('./lib/install.js', 'utf8');
  assert.equal(
    /id\s*===\s*['"]hosted-fallback['"]/.test(installSrc),
    false,
    'lib/install.js must not branch on hosted-fallback id (===)',
  );
  assert.equal(
    /id\s*!==\s*['"]hosted-fallback['"]/.test(installSrc),
    false,
    'lib/install.js must not branch on hosted-fallback id (!==)',
  );
  assert.equal(
    /['"]hosted-fallback['"]/.test(installSrc),
    false,
    'lib/install.js must not mention hosted-fallback as a literal at all (Pitfall 2)',
  );
});
