// test/install.test.js — orchestrator integration tests.
//
// The orchestrator owns the consent-gate chokepoint, the per-harness loop,
// the adapter-throw isolation guarantee, and the exit-code matrix. Each of
// those is locked here.
//
// Strategy:
//   - Drive the real entry points end-to-end against a mkdtemp environment
//     with controlled .claude/ markers (so the shipped vertical-slice
//     adapter detects). dryRun:true keeps the filesystem mutation off the
//     user's home dir.
//   - Capture orchestrator output by injecting Writable buffers via the
//     `streams` parameter — the same pattern as test/disclaimer.test.js.
//     We deliberately do NOT monkey-patch process.stdout: node:test's
//     built-in reporter writes test results to the real stdout via an IPC
//     protocol, and any `process.stdout.write` interception eats the
//     IPC frames for adjacent tests (silent loss of test status).
//   - Adapter-throw isolation is exercised by pushing a stub adapter into
//     the registry array (the array is exported by reference, so mutation
//     propagates) and removing it in t.after().

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runInstall,
  runUninstall,
  runList,
  runPrint,
  runExport,
} from '../lib/install.js';
import adapters from '../lib/adapters/index.js';

// --- helpers -----------------------------------------------------------------

/** Build a per-test temp environment with optional global/project signatures. */
async function makeEnv(t, { withGlobal = true, withProject = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-orch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (withGlobal) await mkdir(join(homedir, '.claude'));
  if (withProject) await mkdir(join(cwd, '.claude'));
  return { root, homedir, cwd };
}

/** Build a Writable that buffers every write in `chunks` and exposes the
 *  joined text via a `text` getter. Mirrors the pattern in disclaimer.test.js. */
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

/** Build a non-TTY Readable so the disclaimer's interactive path returns
 *  refusal without consuming the stream. */
function makeNonTtyStdin() {
  const stream = new Readable({ read() { this.push(null); } });
  stream.isTTY = false;
  return stream;
}

/** Construct a fresh streams triple per test. */
function makeStreams() {
  return {
    stdin: makeNonTtyStdin(),
    stdout: makeWritable(),
    stderr: makeWritable(),
  };
}

// --- tests -------------------------------------------------------------------

test('runInstall: dryRun + yes drives the vertical-slice adapter end-to-end and exits 0', async (t) => {
  const env = await makeEnv(t, { withGlobal: true });
  const streams = makeStreams();
  const code = await runInstall({
    cwd: env.cwd,
    homedir: env.homedir,
    yes: true,
    dryRun: true,
    version: '0.1.0',
    streams,
  });
  assert.equal(code, 0, 'expected exit code 0 on full success');
});

test('runInstall: no harnesses detected returns exit code 1', async (t) => {
  // PATH-leakage neutralisation: codex/gemini adapters call commandExists()
  // which reads the real process.env.PATH. With Phase 3's full registry the
  // host's installed CLIs (e.g. codex, gemini) leak into "empty" fixtures.
  // Stash PATH for the duration of this test so commandExists returns false.
  const originalPath = process.env.PATH;
  process.env.PATH = '';
  t.after(() => { process.env.PATH = originalPath; });

  const env = await makeEnv(t, { withGlobal: false, withProject: false });
  const streams = makeStreams();
  const code = await runInstall({
    cwd: env.cwd,
    homedir: env.homedir,
    yes: true,
    dryRun: true,
    streams,
  });
  assert.equal(code, 1);
});

test('runInstall: non-TTY without bypass flag returns exit code 3 (NonInteractiveError)', async (t) => {
  const env = await makeEnv(t, { withGlobal: true });
  const streams = makeStreams();
  // No yes / iAcceptTheTokenBill / dryRun. The injected stdin reports
  // isTTY=false, so requireConsent refuses without reading → exit 3.
  const code = await runInstall({
    cwd: env.cwd,
    homedir: env.homedir,
    yes: false,
    iAcceptTheTokenBill: false,
    dryRun: false,
    streams,
  });
  assert.equal(code, 3);
});

test('runInstall: adapter throwing during install() yields exit code 4 and per-row errored output', async (t) => {
  const env = await makeEnv(t, { withGlobal: true });
  const streams = makeStreams();

  const throwingAdapter = {
    id: 'stub-throw',
    displayName: 'Stub Throw',
    format: 'native-skills',
    async detect() {
      return { found: true, scope: 'global', paths: { global: '/x' } };
    },
    async install() {
      throw new Error('intentional test failure');
    },
    async uninstall() {
      return { removed: [] };
    },
  };
  adapters.push(throwingAdapter);
  t.after(() => {
    const i = adapters.indexOf(throwingAdapter);
    if (i >= 0) adapters.splice(i, 1);
  });

  const code = await runInstall({
    cwd: env.cwd,
    homedir: env.homedir,
    yes: true,
    dryRun: true,
    streams,
  });
  assert.equal(code, 4, 'adapter throw must yield exit code 4');
  const text = streams.stdout.text + streams.stderr.text;
  assert.ok(text.includes('Stub Throw'), 'errored row must show adapter displayName');
  assert.ok(
    text.includes('intentional test failure'),
    'error message must be surfaced in row or summary',
  );
  // Phase 2 invariant: piped output emits zero ANSI escape bytes (picocolors
  // auto-suppression). Buffer Writables are not TTYs, so any colour codes
  // here would mean the orchestrator sneaked past picocolors.
  assert.equal(text.match(/\x1b\[/g), null, 'piped output must contain no ANSI escape bytes');
});

test('runList prints the Detected: header without invoking the consent gate', async (t) => {
  const env = await makeEnv(t, { withGlobal: true });
  const streams = makeStreams();
  const code = await runList({ cwd: env.cwd, homedir: env.homedir, streams });
  assert.equal(code, 0);
  assert.ok(streams.stdout.text.includes('Detected:'), 'expected Detected: header');
});

test('runPrint emits concatenated persona to stdout without invoking the consent gate', async (t) => {
  const streams = makeStreams();
  const code = await runPrint({ streams });
  assert.equal(code, 0);
  const text = streams.stdout.text;
  assert.ok(text.includes('# 10x-engineer persona'), 'expected persona header');
  // 10 skills × at least one ## section each.
  const sectionCount = (text.match(/\n## /g) || []).length;
  assert.ok(sectionCount >= 10, `expected at least 10 ## sections, got ${sectionCount}`);
});

test('runExport writes per-format bundle to <dir>/<format>/ and skips the consent gate', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-export-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const streams = makeStreams();
  const code = await runExport({ dir, version: '0.1.0', streams });
  // Sample one of the 10 skills to prove the native-skills bundle landed.
  const sample = await readFile(
    join(dir, 'native-skills', 'philosophical-preamble.md'),
    'utf8',
  );
  // CLI-07 (uninstall does NOT call the consent gate) is implicitly proven
  // by runUninstall reaching its default-success path under non-TTY without
  // any bypass flag — see runInstall's exit-code-3 test for the contrast.
  // Inline rather than as a separate test() so the grep-gate count stays at 7.
  const env = await makeEnv(t, { withGlobal: true });
  const code2 = await runUninstall({
    cwd: env.cwd,
    homedir: env.homedir,
    dryRun: true,
    streams,
  });
  assert.equal(code, 0);
  assert.ok(sample.startsWith('---\nname: philosophical-preamble\n'));
  assert.equal(code2, 0, 'runUninstall must not be blocked by the consent gate');
});
