// test/install-harness-select.test.js — interactive harness selection (v0.2.0).
//
// Locks the v0.2.0 contract: when neither --all nor --harness is supplied
// and stdin is a TTY, runInstall presents a numbered checklist and
// filters the install loop to the user's selection. --yes /
// --i-accept-the-token-bill bypass only the disclaimer; the selection
// prompt still fires on a TTY.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInstall } from '../lib/install.js';
import { promptHarnessSelection } from '../lib/disclaimer.js';

// --- helpers ---

async function makeEnv(t, { withGlobal = true, withProject = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-select-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (withGlobal) await mkdir(join(homedir, '.claude'));
  if (withProject) await mkdir(join(cwd, '.claude'));
  return { root, homedir, cwd };
}

function makeWritable() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString('utf8'));
      cb();
    },
  });
  Object.defineProperty(stream, 'text', { get: () => chunks.join('') });
  return stream;
}

/** TTY Readable: pushes the supplied lines once on first read, then EOF. */
function makeTtyStdin(lines) {
  let cursor = 0;
  const stream = new Readable({
    read() {
      if (cursor < lines.length) {
        this.push(lines[cursor++] + '\n');
      } else {
        this.push(null);
      }
    },
  });
  stream.isTTY = true;
  return stream;
}

function makeNonTtyStdin() {
  const stream = new Readable({ read() { this.push(null); } });
  stream.isTTY = false;
  return stream;
}

// PATH neutraliser — codex/gemini/aider commandExists() probes leak
// detection from a developer machine into otherwise empty fixtures.
function neutralisePath(t) {
  const original = process.env.PATH;
  process.env.PATH = '';
  t.after(() => { process.env.PATH = original; });
}

// --- promptHarnessSelection unit tests ---

test('promptHarnessSelection: numeric pick returns the selected adapter id', async () => {
  const found = [
    { adapter: { id: 'aider', displayName: 'Aider' } },
    { adapter: { id: 'claude-code', displayName: 'Claude Code' } },
    { adapter: { id: 'cursor', displayName: 'Cursor' } },
  ];
  const stdin = makeTtyStdin(['2']);
  const stdout = makeWritable();
  const ids = await promptHarnessSelection({ found }, { stdin, stdout });
  assert.deepEqual(ids, ['claude-code']);
  assert.match(stdout.text, /1\. Aider/);
  assert.match(stdout.text, /2\. Claude Code/);
  assert.match(stdout.text, /3\. Cursor/);
});

test('promptHarnessSelection: comma-separated picks return registry-ordered subset', async () => {
  const found = [
    { adapter: { id: 'aider', displayName: 'Aider' } },
    { adapter: { id: 'claude-code', displayName: 'Claude Code' } },
    { adapter: { id: 'cursor', displayName: 'Cursor' } },
  ];
  const stdin = makeTtyStdin(['3,1']);
  const stdout = makeWritable();
  const ids = await promptHarnessSelection({ found }, { stdin, stdout });
  // Output preserves registry order, not user-typed order.
  assert.deepEqual(ids, ['aider', 'cursor']);
});

test('promptHarnessSelection: "a" returns every id', async () => {
  const found = [
    { adapter: { id: 'aider', displayName: 'Aider' } },
    { adapter: { id: 'cursor', displayName: 'Cursor' } },
  ];
  const stdin = makeTtyStdin(['a']);
  const stdout = makeWritable();
  const ids = await promptHarnessSelection({ found }, { stdin, stdout });
  assert.deepEqual(ids, ['aider', 'cursor']);
});

test('promptHarnessSelection: "n" returns empty array', async () => {
  const found = [{ adapter: { id: 'aider', displayName: 'Aider' } }];
  const ids = await promptHarnessSelection(
    { found },
    { stdin: makeTtyStdin(['n']), stdout: makeWritable() },
  );
  assert.deepEqual(ids, []);
});

test('promptHarnessSelection: empty input returns empty array (default-no)', async () => {
  const found = [{ adapter: { id: 'aider', displayName: 'Aider' } }];
  const ids = await promptHarnessSelection(
    { found },
    { stdin: makeTtyStdin(['']), stdout: makeWritable() },
  );
  assert.deepEqual(ids, []);
});

test('promptHarnessSelection: out-of-range and garbage tokens are silently dropped', async () => {
  const found = [
    { adapter: { id: 'aider', displayName: 'Aider' } },
    { adapter: { id: 'cursor', displayName: 'Cursor' } },
  ];
  const stdin = makeTtyStdin(['1, 99, foo, 2']);
  const ids = await promptHarnessSelection(
    { found },
    { stdin, stdout: makeWritable() },
  );
  assert.deepEqual(ids, ['aider', 'cursor']);
});

test('promptHarnessSelection: non-TTY stdin returns empty array', async () => {
  const found = [{ adapter: { id: 'aider', displayName: 'Aider' } }];
  const ids = await promptHarnessSelection(
    { found },
    { stdin: makeNonTtyStdin(), stdout: makeWritable() },
  );
  assert.deepEqual(ids, []);
});

// --- runInstall integration tests ---

test('runInstall: TTY with --i-accept-the-token-bill prompts for selection and filters install', async (t) => {
  neutralisePath(t);
  const env = await makeEnv(t, { withGlobal: true });
  // Disclaimer bypassed via --i-accept-the-token-bill; only the selection
  // prompt reads stdin. Single line: "1" picks Claude Code.
  const stdin = makeTtyStdin(['1']);
  const streams = {
    stdin,
    stdout: makeWritable(),
    stderr: makeWritable(),
  };
  const code = await runInstall({
    cwd: env.cwd,
    homedir: env.homedir,
    iAcceptTheTokenBill: true,
    dryRun: true,
    version: '0.1.0',
    streams,
  });
  assert.equal(code, 0);
  assert.match(streams.stdout.text, /Detected harnesses:/);
  assert.match(streams.stdout.text, /1\. Claude Code/);
  // Adapter row present (dry-run write reported).
  assert.match(streams.stdout.text, /Claude Code — \d+ files/);
});

test('runInstall: TTY with empty selection exits 0 with explanatory message', async (t) => {
  neutralisePath(t);
  const env = await makeEnv(t, { withGlobal: true });
  const stdin = makeTtyStdin(['n']);
  const streams = {
    stdin,
    stdout: makeWritable(),
    stderr: makeWritable(),
  };
  const code = await runInstall({
    cwd: env.cwd,
    homedir: env.homedir,
    iAcceptTheTokenBill: true,
    dryRun: true,
    version: '0.1.0',
    streams,
  });
  assert.equal(code, 0);
  assert.match(streams.stdout.text, /No harnesses selected/);
});

test('runInstall: --all bypasses the selection prompt', async (t) => {
  neutralisePath(t);
  const env = await makeEnv(t, { withGlobal: true });
  // Non-TTY stdin would otherwise refuse; --all skips selection regardless.
  const streams = {
    stdin: makeNonTtyStdin(),
    stdout: makeWritable(),
    stderr: makeWritable(),
  };
  const code = await runInstall({
    cwd: env.cwd,
    homedir: env.homedir,
    all: true,
    yes: true,
    dryRun: true,
    version: '0.1.0',
    streams,
  });
  assert.equal(code, 0);
  assert.equal(/Detected harnesses:/.test(streams.stdout.text), false,
    '--all must skip the selection prompt entirely');
});

test('runInstall: --harness <id> bypasses the selection prompt', async (t) => {
  neutralisePath(t);
  const env = await makeEnv(t, { withGlobal: true });
  const streams = {
    stdin: makeNonTtyStdin(),
    stdout: makeWritable(),
    stderr: makeWritable(),
  };
  const code = await runInstall({
    cwd: env.cwd,
    homedir: env.homedir,
    harness: 'claude-code',
    yes: true,
    dryRun: true,
    version: '0.1.0',
    streams,
  });
  assert.equal(code, 0);
  assert.equal(/Detected harnesses:/.test(streams.stdout.text), false);
});

test('runInstall: non-TTY stdin without bypass flag still refuses (exit 3)', async (t) => {
  neutralisePath(t);
  const env = await makeEnv(t, { withGlobal: true });
  const streams = {
    stdin: makeNonTtyStdin(),
    stdout: makeWritable(),
    stderr: makeWritable(),
  };
  const code = await runInstall({
    cwd: env.cwd,
    homedir: env.homedir,
    version: '0.1.0',
    streams,
  });
  // Disclaimer's non-TTY refusal fires before the selection prompt would.
  assert.equal(code, 3);
});
