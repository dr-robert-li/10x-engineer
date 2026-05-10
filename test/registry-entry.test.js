// test/registry-entry.test.js — adapter registry shape lock.
//
// Pins the adapter registry at the canonical 12 entries in locked
// alphabetical-by-id order. Cody and the legacy Tier 2 adapters are
// DEFERRED; the registry MUST NOT contain them.
//
// Stream-injection helper lifted from test/install-multi-adapter.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import adapters from '../lib/adapters/index.js';
import { runList } from '../lib/install.js';

const EXPECTED_IDS = [
  'aider',
  'claude-code',
  'cline',
  'codex',
  'continue',
  'cursor',
  'gemini',
  'hermes-agent',
  'hosted-fallback',
  'kilo-code',
  'opencode',
  'roo-code',
];

test('registry: length === 12', () => {
  assert.equal(adapters.length, 12);
});

test('registry: id-array matches locked alphabetical order', () => {
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

test('registry: deferred ids absent', () => {
  const ids = adapters.map((a) => a.id);
  for (const deferred of [
    'cody',
    'amazon-q',
    'copilot-chat',
    'goose',
    'jetbrains',
    'pearai',
    'pieces',
    'plandex',
    'tabnine',
    'windsurf',
    'zed',
  ]) {
    assert.equal(ids.includes(deferred), false, `${deferred} must not appear in the registry`);
  }
});

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
// gemini) would otherwise leak detection from the dev box.
function neutralisePath(t, root) {
  const original = process.env.PATH;
  process.env.PATH = root;
  t.after(() => {
    process.env.PATH = original;
  });
}

test('list: every adapter appears under not-found on an empty fixture', async (t) => {
  const root = await mkdtemp(join(tmpdir(), '10xe-list-'));
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
  for (const a of adapters) {
    assert.ok(
      output.includes(a.displayName),
      `${a.id} (${a.displayName}) missing from list output`,
    );
  }
  assert.match(
    output,
    /Hosted agent \(manual install\)/,
    'hosted-fallback must appear in list output (no orchestrator special-case suppression)',
  );
});

test('lib/install.js does not special-case hosted-fallback (source-level grep)', async () => {
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
    'lib/install.js must not mention hosted-fallback as a literal at all',
  );
});
