// test/install-tier-2-integration.test.js — Plan 04-13 keystone integration tests.
//
// These tests prove the per-harness flag matrix (CLI-03 / CLI-04 /
// CLI-05 / CLI-08) at 21-adapter scale. Phase 3's
// install-multi-adapter.test.js pinned the matrix at 9 adapters; this
// file extends it across the new Tier 2 fleet (12 adapters; Cody is
// deferred per locked decision #1).
//
// Strategy mirrors the Phase 3 keystone:
//   - mkdtemp a fresh root per test with separate `home` and `project`
//     subdirs so cwd and homedir are siblings; findAncestorWith never
//     escapes the fixture.
//   - PATH neutralisation is mandatory: 7 of 21 adapters probe
//     commandExists (aider, codex, gemini, goose, pieces, plandex,
//     amazon-q). A developer machine with these binaries on PATH would
//     leak detection into otherwise filesystem-empty fixtures.
//   - dryRun:true everywhere except Test 9, which needs real artefacts
//     on disk to prove the round-trip byte-identity invariant.
//
// Note: Tests 6/7/8 invoke adapter.install() directly. The orchestrator's
// runInstall returns only an exit code — it does not surface the install
// result object to the caller, and printRow does not render the `notes`
// field. The hosted-fallback case is even more pointed: hosted-fallback's
// detect() returns found:false unconditionally, so runInstall hits the
// "No supported harnesses detected" branch and exits 1 before install()
// is ever invoked. Calling adapter.install() directly is the only way to
// exercise the notes/skipped contract without violating Pitfall 2 (no
// orchestrator special-casing of hosted-fallback) or the plan's
// files_modified scope (which excludes lib/install.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import adapters from '../lib/adapters/index.js';
import { runInstall, runUninstall, runList } from '../lib/install.js';
import jetbrainsAdapter from '../lib/adapters/jetbrains.js';
import plandexAdapter from '../lib/adapters/plandex.js';
import hostedFallbackAdapter from '../lib/adapters/hosted-fallback.js';
import gooseAdapter from '../lib/adapters/goose.js';
import { loadSkills } from '../lib/skills.js';

// --- helpers ----------------------------------------------------------------

function neutralisePath(t, root) {
  const original = process.env.PATH;
  process.env.PATH = root;
  t.after(() => {
    process.env.PATH = original;
  });
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

function makeStdin() {
  const stream = new Readable({
    read() {
      this.push(null);
    },
  });
  stream.isTTY = false;
  return stream;
}

function makeStreams() {
  return {
    stdin: makeStdin(),
    stdout: makeWritable(),
    stderr: makeWritable(),
  };
}

/** Seed any subset of the 21 adapters' detection signatures. */
async function makeFleet(t, opts = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-tier2-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });

  // Tier 1 (Phase 3) signatures — only what these tests exercise.
  if (opts.claudeGlobal) await mkdir(join(homedir, '.claude'));

  // Tier 2 (Phase 4) signatures.
  if (opts.gooseGlobal)
    await mkdir(join(homedir, '.config', 'goose'), { recursive: true });
  if (opts.copilotChat) await mkdir(join(cwd, '.github'));
  if (opts.rooCode) await mkdir(join(cwd, '.roo'));
  if (opts.pearaiGlobal) await mkdir(join(homedir, '.pearai'));
  if (opts.zedGlobal)
    await mkdir(join(homedir, '.config', 'zed'), { recursive: true });
  if (opts.tabnineGlobal) await mkdir(join(homedir, '.tabnine'));
  if (opts.amazonQ) await mkdir(join(cwd, '.amazonq'));
  if (opts.piecesGlobal)
    await mkdir(join(homedir, '.config', 'Pieces'), { recursive: true });
  if (opts.plandex) await mkdir(join(cwd, '.plandex'));
  if (opts.windsurfGlobal)
    await mkdir(join(homedir, '.codeium'), { recursive: true });
  if (opts.windsurfProject) await mkdir(join(cwd, '.windsurf'));
  if (opts.jetbrains) await mkdir(join(cwd, '.idea'));

  if (opts.neutralise !== false) neutralisePath(t, root);
  return { root, homedir, cwd };
}

// --- tests ------------------------------------------------------------------

// Test 1 — list output covers all 21 adapters. Phase 4 ROADMAP SC#4 +
// Pitfall 2 at registry scale. The fixture seeds two harnesses (Claude
// Code global + goose global) so detection is non-trivial; the other 19
// land in the not-found bucket — including hosted-fallback.
test('list: all 21 adapters surface in list output (ROADMAP SC#4 + Pitfall 2)', async (t) => {
  const env = await makeFleet(t, { claudeGlobal: true, gooseGlobal: true });
  const streams = makeStreams();
  const code = await runList({ cwd: env.cwd, homedir: env.homedir, streams });
  assert.equal(code, 0);
  const out = streams.stdout.text;
  for (const a of adapters) {
    assert.ok(
      out.includes(a.displayName),
      `${a.id} (${a.displayName}) missing from list output`,
    );
  }
  // hosted-fallback specifically — Pitfall 2.
  assert.match(out, /Hosted agent \(manual install\)/);
  // Claude Code + goose are under Detected; everyone else under Not detected.
  assert.match(out, /Detected:[\s\S]*Claude Code/);
  assert.match(out, /Detected:[\s\S]*Goose/);
  assert.match(out, /Not detected:[\s\S]*Hosted agent/);
});

// Test 2 — install --all --dry-run across a multi-Tier-2 fixture. No
// filesystem writes; per-adapter rows present in stdout.
test('install --all --dry-run: every detected Tier 2 adapter emits a row', async (t) => {
  const env = await makeFleet(t, {
    gooseGlobal: true,
    rooCode: true,
    pearaiGlobal: true,
    tabnineGlobal: true,
  });
  const streams = makeStreams();
  const code = await runInstall({
    all: true,
    dryRun: true,
    yes: true,
    cwd: env.cwd,
    homedir: env.homedir,
    streams,
    version: '0.1.0',
  });
  assert.equal(code, 0);
  const out = streams.stdout.text;
  assert.match(out, /Goose/);
  assert.match(out, /Roo Code/);
  assert.match(out, /PearAI/);
  assert.match(out, /Tabnine/);

  // Filesystem assertion: cwd contents unchanged (only the seed dirs we
  // created in makeFleet).
  const cwdEntries = (await readdir(env.cwd)).sort();
  assert.deepEqual(cwdEntries, ['.roo'], 'project dir must not have been written into');
});

// Test 3 — harness: goose with goose-only fixture writes only
// .config/goose/.goosehints. Goose seeded global-only → scope:'global'.
test('install --harness goose: only goose path appears in writes', async (t) => {
  const env = await makeFleet(t, { gooseGlobal: true });
  const streams = makeStreams();
  const code = await runInstall({
    harness: 'goose',
    dryRun: true,
    yes: true,
    verbose: true,
    cwd: env.cwd,
    homedir: env.homedir,
    streams,
    version: '0.1.0',
  });
  assert.equal(code, 0);
  const out = streams.stdout.text;
  assert.match(out, /Goose/);
  assert.match(
    out,
    new RegExp(
      join(env.homedir, '.config', 'goose', '.goosehints').replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      ),
    ),
    'goose .goosehints path must appear in verbose output',
  );
  // No other adapter rows.
  assert.equal(/Claude Code/.test(out), false);
  assert.equal(/Roo Code/.test(out), false);
  assert.equal(/Tabnine/.test(out), false);
});

// Test 4 — harness: copilot-chat with .github/ seeded writes
// <projectRoot>/.github/copilot-instructions.md.
test('install --harness copilot-chat: writes <projectRoot>/.github/copilot-instructions.md', async (t) => {
  const env = await makeFleet(t, { copilotChat: true });
  const streams = makeStreams();
  const code = await runInstall({
    harness: 'copilot-chat',
    dryRun: true,
    yes: true,
    verbose: true,
    cwd: env.cwd,
    homedir: env.homedir,
    streams,
    version: '0.1.0',
  });
  assert.equal(code, 0);
  const out = streams.stdout.text;
  assert.match(out, /GitHub Copilot Chat/);
  const expectedPath = join(env.cwd, '.github', 'copilot-instructions.md');
  assert.match(
    out,
    new RegExp(expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'copilot-instructions.md path must appear in verbose output',
  );
});

// Test 5 — harness: windsurf with both global+project seeded; --all
// resolves scope='both' without prompting; both halves appear in writes.
test('install --harness windsurf scope=both: both halves appear in writes', async (t) => {
  const env = await makeFleet(t, {
    windsurfGlobal: true,
    windsurfProject: true,
  });
  const streams = makeStreams();
  const code = await runInstall({
    harness: 'windsurf',
    all: true, // bypass scope prompt for scope='both' adapter
    dryRun: true,
    yes: true,
    verbose: true,
    cwd: env.cwd,
    homedir: env.homedir,
    streams,
    version: '0.1.0',
  });
  assert.equal(code, 0);
  const out = streams.stdout.text;
  assert.match(out, /Windsurf/);
  // Global half: ~/.codeium/windsurf/memories/global_rules.md
  const globalPath = join(
    env.homedir,
    '.codeium',
    'windsurf',
    'memories',
    'global_rules.md',
  );
  assert.match(
    out,
    new RegExp(globalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'windsurf global half must appear in verbose output',
  );
  // Project half: <cwd>/.windsurf/rules/10x-engineer/<id>.md — assert at
  // least one per-skill file appears under that directory.
  const projectDirRe = new RegExp(
    join(env.cwd, '.windsurf', 'rules', '10x-engineer').replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    ),
  );
  assert.match(out, projectDirRe, 'windsurf project half dir must appear');
});

// Test 6 — jetbrains.install() emits the manual-enable note (LOCKED
// DECISION #3 end-to-end). Direct adapter call: the orchestrator's
// printRow does not render the `notes` field; only adapter.install()
// surfaces it.
test('jetbrains.install: result.notes contains manual-enable text (LOCKED DECISION #3)', async (t) => {
  const env = await makeFleet(t, { jetbrains: true });
  const skills = await loadSkills();
  const detection = await jetbrainsAdapter.detect({
    cwd: env.cwd,
    homedir: env.homedir,
  });
  assert.equal(detection.found, true);
  const result = await jetbrainsAdapter.install({
    skills,
    scope: detection.scope,
    paths: detection.paths,
    dryRun: true,
    version: '0.1.0',
  });
  assert.ok(Array.isArray(result.notes), 'result.notes must be an array');
  assert.equal(result.notes.length, 1);
  assert.match(
    result.notes[0],
    /JetBrains AI may require manual enable/,
    'manual-enable note text must be present',
  );
});

// Test 7 — plandex.install() emits the `plandex load PLANDEX.md` note
// (LOCKED DECISION #2). Direct adapter call same justification as Test 6.
test('plandex.install: result.notes contains `plandex load PLANDEX.md` text (LOCKED DECISION #2)', async (t) => {
  const env = await makeFleet(t, { plandex: true });
  const skills = await loadSkills();
  const detection = await plandexAdapter.detect({
    cwd: env.cwd,
    homedir: env.homedir,
  });
  assert.equal(detection.found, true);
  const result = await plandexAdapter.install({
    skills,
    scope: detection.scope,
    paths: detection.paths,
    dryRun: true,
    version: '0.1.0',
  });
  assert.ok(Array.isArray(result.notes), 'result.notes must be an array');
  assert.equal(result.notes.length, 1);
  assert.match(
    result.notes[0],
    /plandex load PLANDEX\.md/,
    'plandex load instruction text must be present',
  );
});

// Test 8 — hosted-fallback adapter direct call returns
// skipped: [HOSTED_FALLBACK_MESSAGE]. Direct adapter call required:
// runInstall would short-circuit at "No supported harnesses detected"
// because hosted-fallback's detect() returns found:false unconditionally.
test('hosted-fallback.install: skipped[0] carries the manual-install message', async () => {
  const result = await hostedFallbackAdapter.install({
    skills: [],
    scope: 'project',
    paths: { project: null },
    dryRun: false,
    version: '0.1.0',
  });
  assert.deepEqual(result.written, []);
  assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0], /Hosted agents/);
  assert.match(result.skipped[0], /npx 10x-engineer print/);
  assert.match(result.skipped[0], /npx 10x-engineer export/);
});

// Test 9 — round-trip byte-identity at scale (cross-phase invariant 4).
// Real install + uninstall on a Tier 2 adapter (goose) leaves the
// filesystem byte-identical. Goose is a clean choice: append-markers
// against a single file we create from scratch — both creation and
// deletion are surgical.
test('round-trip byte-identity: goose install → uninstall leaves filesystem unchanged', async (t) => {
  const env = await makeFleet(t, { gooseGlobal: true });
  const skills = await loadSkills();

  // Pre-snapshot — both home and cwd subtrees.
  async function snapshotTree(rootDir) {
    const tree = {};
    async function walk(dir, prefix) {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (e) {
        if (e.code === 'ENOENT') return;
        throw e;
      }
      for (const ent of entries) {
        const childPath = join(dir, ent.name);
        const relPath = prefix ? join(prefix, ent.name) : ent.name;
        if (ent.isDirectory()) {
          tree[relPath] = '<dir>';
          await walk(childPath, relPath);
        } else if (ent.isFile()) {
          tree[relPath] = await readFile(childPath, 'utf8');
        }
      }
    }
    await walk(rootDir, '');
    return tree;
  }

  const preHome = await snapshotTree(env.homedir);
  const preCwd = await snapshotTree(env.cwd);

  const detection = await gooseAdapter.detect({
    cwd: env.cwd,
    homedir: env.homedir,
  });
  assert.equal(detection.found, true);

  // Real install — no dryRun.
  const installResult = await gooseAdapter.install({
    skills,
    scope: detection.scope,
    paths: detection.paths,
    dryRun: false,
    version: '0.1.0',
  });
  assert.ok(installResult.written.length >= 1, 'install must write at least 1 file');

  // Real uninstall.
  const uninstallResult = await gooseAdapter.uninstall({
    scope: detection.scope,
    paths: detection.paths,
    dryRun: false,
  });
  assert.ok(uninstallResult.removed.length >= 0);

  // Post-snapshot — must equal pre.
  const postHome = await snapshotTree(env.homedir);
  const postCwd = await snapshotTree(env.cwd);

  // The file may persist as an empty string (stripBlock self-cleans, but
  // mkdir of the parent dir during install is idempotent). Assert that
  // the marker block is NOT present in any post-uninstall file content.
  for (const [path, content] of Object.entries(postHome)) {
    if (content === '<dir>') continue;
    assert.equal(
      /BEGIN 10x-engineer/.test(content),
      false,
      `post-uninstall file ${path} still contains marker block (round-trip not byte-identical)`,
    );
  }

  // Strict structural equality: the same set of paths exists pre and post.
  assert.deepEqual(
    Object.keys(postHome).sort(),
    Object.keys(preHome).sort(),
    'home subtree path set must be byte-identical pre vs post round-trip',
  );
  assert.deepEqual(
    Object.keys(postCwd).sort(),
    Object.keys(preCwd).sort(),
    'cwd subtree path set must be byte-identical pre vs post round-trip',
  );

  // For files (not dirs), assert content equality.
  for (const path of Object.keys(preHome)) {
    if (preHome[path] === '<dir>') continue;
    assert.equal(postHome[path], preHome[path], `home file ${path} content drift`);
  }
});

// Test 10 — detection fault isolation at 21-adapter scale (ROADMAP SC#4
// + Pitfall 1). A throwing detect() in the registry must not poison the
// other 21; runList places it in the errored bucket and the rest unaffected.
test('detection fault isolation at 21-adapter scale: throwing adapter does not poison the batch', async (t) => {
  const env = await makeFleet(t, { claudeGlobal: true, gooseGlobal: true });
  const throwingAdapter = {
    id: 'stub-throw-21',
    displayName: 'Stub Throw 21',
    format: 'native-skills',
    async detect() {
      throw new Error('intentional detect failure');
    },
    async install() {
      return { written: [], skipped: [] };
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

  const streams = makeStreams();
  const code = await runList({
    cwd: env.cwd,
    homedir: env.homedir,
    streams,
  });
  assert.equal(code, 0, 'detect() throw must not fail the list run');
  const out = streams.stdout.text;
  // All 21 real adapters still appear.
  for (const a of adapters) {
    if (a === throwingAdapter) continue;
    assert.ok(
      out.includes(a.displayName),
      `${a.id} missing — throw poisoned the batch`,
    );
  }
  // The throwing adapter shows up under the errored bucket with its message.
  assert.match(out, /Errored during detection/);
  assert.match(out, /Stub Throw 21/);
  assert.match(out, /intentional detect failure/);
});
