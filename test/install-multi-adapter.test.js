// test/install-multi-adapter.test.js — Wave 5 keystone integration tests.
//
// These tests prove that the per-harness flag matrix (CLI-03 / CLI-04 /
// CLI-05 / CLI-08) behaves correctly now that the registry contains nine
// adapters. Phase 2 only had a single first-class adapter, so most of the
// branching in the orchestrator (filter-by-id, --all-skips-prompt, scope
// override, uninstall-by-id) was untestable end-to-end. This file pins
// each cell of the matrix against a multi-adapter fixture.
//
// Strategy:
//   - mkdtemp a fresh root per test with separate `home` and `project`
//     subdirs so cwd and homedir are siblings; findAncestorWith never
//     escapes the fixture.
//   - Optional fixture seeding for any subset of adapter detection
//     signatures (Claude Code global, Claude Code project, Cursor,
//     Codex global, project AGENTS.md, .git boundary) — `makeMultiEnv`
//     is the common helper.
//   - PATH neutralisation is mandatory: codex/gemini/aider call
//     commandExists() which reads process.env.PATH. A developer machine
//     with codex/gemini installed would leak detection into otherwise
//     filesystem-empty fixtures. Each test stashes PATH and points it at
//     the empty mkdtemp root for the duration of the run.
//   - Output capture via injected Writable buffers (no monkey-patching of
//     process.stdout — node:test reports test results to its parent over
//     the real stdout via IPC, and any interception eats the IPC frames
//     for adjacent tests).
//   - dryRun:true everywhere except Test 8, which needs real artefacts on
//     disk to prove uninstall-by-harness scopes its removal correctly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { mkdtemp, mkdir, writeFile, rm, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInstall, runUninstall } from '../lib/install.js';

// --- helpers -----------------------------------------------------------------

/** Stash PATH for the duration of a test so commandExists() returns false
 *  for every adapter that probes a binary. Restored in t.after(). */
function neutralisePath(t, root) {
  const original = process.env.PATH;
  process.env.PATH = root;
  t.after(() => { process.env.PATH = original; });
}

/** Build a Writable that buffers every write in `chunks` and exposes the
 *  joined text via a `text` getter. */
function makeWritable() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _enc, cb) { chunks.push(chunk.toString('utf8')); cb(); },
  });
  Object.defineProperty(stream, 'text', { get: () => chunks.join('') });
  return stream;
}

/** Build a Readable usable as a stdin replacement. The injected isTTY
 *  property is what gateConsent inspects to discriminate the
 *  NonInteractiveError branch. */
function makeStdin({ isTTY = false, data = '' } = {}) {
  const stream = new Readable({ read() { this.push(null); } });
  stream.isTTY = isTTY;
  if (data) {
    // Re-create with data because the closed-on-construction Readable
    // above cannot accept further pushes from outside.
  }
  return stream;
}

function makeStreams({ stdinTTY = false } = {}) {
  return {
    stdin: makeStdin({ isTTY: stdinTTY }),
    stdout: makeWritable(),
    stderr: makeWritable(),
  };
}

/** Seed any subset of the nine adapters' detection signatures into a
 *  fresh mkdtemp root. Returns { root, homedir, cwd }. */
async function makeMultiEnv(t, opts = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-multi-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (opts.claudeGlobal) await mkdir(join(homedir, '.claude'));
  if (opts.claudeProject) await mkdir(join(cwd, '.claude'));
  if (opts.cursor) await mkdir(join(cwd, '.cursor'));
  if (opts.cline) await mkdir(join(cwd, '.clinerules'));
  if (opts.codexGlobal) await mkdir(join(homedir, '.codex'));
  if (opts.geminiGlobal) await mkdir(join(homedir, '.gemini'));
  if (opts.continueGlobal) await mkdir(join(homedir, '.continue'));
  if (opts.projectAgents) {
    await writeFile(join(cwd, 'AGENTS.md'), opts.agentsContent ?? '');
  }
  if (opts.gitRoot) await mkdir(join(cwd, '.git'));
  // PATH neutralisation defaults on; opt-out via { neutralise: false } if
  // a future test needs to exercise commandExists.
  if (opts.neutralise !== false) neutralisePath(t, root);
  return { root, homedir, cwd };
}

// --- tests -------------------------------------------------------------------

// CLI-03 — --harness <name> filters the registry to a single adapter.
test('CLI-03: --harness cursor filters registry to single adapter', async (t) => {
  const env = await makeMultiEnv(t, {
    claudeGlobal: true,
    cursor: true,
    codexGlobal: true,
  });
  const streams = makeStreams();
  const code = await runInstall({
    harness: 'cursor',
    dryRun: true,
    yes: true,
    cwd: env.cwd,
    homedir: env.homedir,
    streams,
    version: '0.1.0',
  });
  assert.equal(code, 0, 'expected exit 0 on filtered single-adapter install');
  const out = streams.stdout.text;
  assert.match(out, /Cursor/, 'Cursor row must appear in stdout');
  assert.equal(
    /Claude Code/.test(out),
    false,
    '--harness cursor must not invoke Claude Code',
  );
  assert.equal(
    /Codex CLI/.test(out),
    false,
    '--harness cursor must not invoke Codex CLI',
  );
});

// CLI-03 — unknown harness id exits 1 with a friendly stderr message.
test('CLI-03: unknown harness returns exit code 1 with stderr message', async (t) => {
  const env = await makeMultiEnv(t, { claudeGlobal: true });
  const streams = makeStreams();
  const code = await runInstall({
    harness: 'doesnotexist',
    dryRun: true,
    yes: true,
    cwd: env.cwd,
    homedir: env.homedir,
    streams,
    version: '0.1.0',
  });
  assert.equal(code, 1);
  assert.match(
    streams.stderr.text,
    /Harness 'doesnotexist' not found/,
    'expected stderr to name the missing harness id',
  );
});

// CLI-04 — --all skips per-harness scope prompts when an adapter has
// scope: 'both'. We seed Claude Code with both global+project so its
// detection returns scope: 'both' (the case that would otherwise trigger
// promptScope and block on stdin). With --all, the loop must complete
// without consuming stdin.
test('CLI-04: --all bypasses per-harness scope prompt for scope=both adapters', async (t) => {
  const env = await makeMultiEnv(t, {
    claudeGlobal: true,
    claudeProject: true,
    cursor: true,
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
  assert.equal(code, 0, 'expected exit 0; --all must not block on prompt');
  const out = streams.stdout.text;
  // Both detected adapters should appear in the install output.
  assert.match(out, /Claude Code/, 'Claude Code row expected with --all');
  assert.match(out, /Cursor/, 'Cursor row expected with --all');
});

// CLI-04 + ORC-06 — disclaimer still gates --all. A non-TTY stdin with
// neither --yes nor --i-accept-the-token-bill nor --dry-run must yield
// the NonInteractiveError exit code (3). The plan calls this out
// specifically: --all does NOT bypass consent.
test('CLI-04: --all without --yes on non-TTY returns exit code 3 (NonInteractiveError)', async (t) => {
  const env = await makeMultiEnv(t, { claudeGlobal: true, cursor: true });
  const streams = makeStreams({ stdinTTY: false });
  const code = await runInstall({
    all: true,
    dryRun: false,
    cwd: env.cwd,
    homedir: env.homedir,
    streams,
    version: '0.1.0',
  });
  assert.equal(code, 3, '--all does not exempt the consent gate (D2-06 / ORC-06)');
});

// CLI-05 — --global selects the global scope path for an adapter whose
// detection returns scope: 'both'.
test('CLI-05: --global selects global scope on a both-scope adapter', async (t) => {
  const env = await makeMultiEnv(t, {
    claudeGlobal: true,
    claudeProject: true,
  });
  const streams = makeStreams();
  const code = await runInstall({
    harness: 'claude-code',
    globalScope: true,
    dryRun: true,
    yes: true,
    cwd: env.cwd,
    homedir: env.homedir,
    streams,
    verbose: true,
    version: '0.1.0',
  });
  assert.equal(code, 0);
  const out = streams.stdout.text;
  // verbose:true reveals would-be paths so we can assert the scope choice
  // by path, not just by row count.
  assert.match(
    out,
    new RegExp(env.homedir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'expected homedir-rooted path with --global',
  );
  assert.equal(
    out.includes(join(env.cwd, '.claude')),
    false,
    '--global must not include the project path',
  );
});

// CLI-05 — --project selects the project scope path for a both-scope
// adapter; mirror image of the --global test above.
test('CLI-05: --project selects project scope on a both-scope adapter', async (t) => {
  const env = await makeMultiEnv(t, {
    claudeGlobal: true,
    claudeProject: true,
  });
  const streams = makeStreams();
  const code = await runInstall({
    harness: 'claude-code',
    projectScope: true,
    dryRun: true,
    yes: true,
    cwd: env.cwd,
    homedir: env.homedir,
    streams,
    verbose: true,
    version: '0.1.0',
  });
  assert.equal(code, 0);
  const out = streams.stdout.text;
  assert.match(
    out,
    new RegExp(env.cwd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'expected cwd-rooted path with --project',
  );
  assert.equal(
    out.includes(join(env.homedir, '.claude')),
    false,
    '--project must not include the global path',
  );
});

// CLI-05 — --global is a no-op for a project-only adapter (Cursor). The
// adapter's natural scope ('project') wins because resolveScope() only
// honours the override when the detected scope is 'both'. This is the
// "no-op for non-both adapters" precedence rule in research §CLI-05.
test('CLI-05: --global is a no-op for a project-only adapter', async (t) => {
  const env = await makeMultiEnv(t, { cursor: true });
  const streams = makeStreams();
  const code = await runInstall({
    harness: 'cursor',
    globalScope: true,
    dryRun: true,
    yes: true,
    cwd: env.cwd,
    homedir: env.homedir,
    streams,
    verbose: true,
    version: '0.1.0',
  });
  assert.equal(code, 0);
  const out = streams.stdout.text;
  // Cursor only ever writes to <cwd>/.cursor/rules/10x-engineer/, even
  // when --global is passed.
  assert.match(out, /Cursor/);
  assert.match(
    out,
    new RegExp(env.cwd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'project path expected even with --global override',
  );
});

// CLI-08 — uninstall --harness <id> scopes removal to the named adapter
// only. Install Claude Code + Codex CLI (real, not dry-run) so there are
// real artefacts on disk; uninstall codex; assert the codex marker block
// is gone but the Claude Code skills directory survives intact.
test('CLI-08: uninstall --harness codex removes codex only', async (t) => {
  const env = await makeMultiEnv(t, { claudeGlobal: true, codexGlobal: true });
  const installStreams = makeStreams();
  // Real install (no dryRun) so we have actual files to inspect later.
  const installCode = await runInstall({
    all: true,
    yes: true,
    cwd: env.cwd,
    homedir: env.homedir,
    streams: installStreams,
    version: '0.1.0',
  });
  assert.equal(installCode, 0, 'precondition: install --all must succeed');

  // Sanity check pre-uninstall state.
  const claudeSkillsDir = join(env.homedir, '.claude', 'skills', '10x-engineer');
  const codexAgentsMd = join(env.homedir, '.codex', 'AGENTS.md');
  assert.ok(existsSync(claudeSkillsDir), 'Claude Code skills dir must exist after install');
  assert.ok(existsSync(codexAgentsMd), 'Codex AGENTS.md must exist after install');
  const codexBefore = await readFile(codexAgentsMd, 'utf8');
  assert.match(
    codexBefore,
    /BEGIN 10x-engineer/,
    'Codex AGENTS.md must contain marker block before uninstall',
  );

  // Surgical uninstall: codex only.
  const uninstallStreams = makeStreams();
  const uninstallCode = await runUninstall({
    harness: 'codex',
    cwd: env.cwd,
    homedir: env.homedir,
    streams: uninstallStreams,
  });
  assert.equal(uninstallCode, 0, 'uninstall --harness codex must succeed');

  // Claude Code is untouched.
  assert.ok(
    existsSync(claudeSkillsDir),
    'Claude Code skills dir must survive an unrelated uninstall',
  );
  const claudeFiles = await readdir(claudeSkillsDir);
  assert.ok(claudeFiles.length > 0, 'Claude Code skills dir must still contain its files');

  // Codex marker block is gone. The file may have been auto-removed if it
  // was emptied, or stripped to empty content; either way the marker
  // string must not be present.
  if (existsSync(codexAgentsMd)) {
    const codexAfter = await readFile(codexAgentsMd, 'utf8');
    assert.equal(
      /BEGIN 10x-engineer/.test(codexAfter),
      false,
      'Codex AGENTS.md must no longer contain the marker block',
    );
  }
});

// Cross-adapter detection isolation — ORC-01 / ORC-02 invariant. A
// throwing adapter pushed into the registry must not poison detection
// for the other eight. With the populated Phase 3 registry this is the
// nine-adapter shape of the Phase 2 isolation test.
test('cross-adapter isolation: a throwing detect() does not poison the others', async (t) => {
  const env = await makeMultiEnv(t, { claudeGlobal: true, cursor: true });
  // Push a stub adapter that throws during detect(). The array is
  // exported by reference, so a push here propagates into runInstall.
  const { default: adapters } = await import('../lib/adapters/index.js');
  const throwingAdapter = {
    id: 'stub-detect-throw',
    displayName: 'Stub Detect Throw',
    format: 'native-skills',
    async detect() { throw new Error('intentional detect failure'); },
    async install() { return { written: [], skipped: [] }; },
    async uninstall() { return { removed: [] }; },
  };
  adapters.push(throwingAdapter);
  t.after(() => {
    const i = adapters.indexOf(throwingAdapter);
    if (i >= 0) adapters.splice(i, 1);
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
  // Detection error does not flip the exit code by itself; it's surfaced
  // in the summary. The other adapters install successfully → exit 0.
  assert.equal(code, 0, 'detect() throw must not poison sibling adapters');
  const all = streams.stdout.text + streams.stderr.text;
  assert.match(all, /Claude Code/, 'Claude Code row must still appear');
  assert.match(all, /Cursor/, 'Cursor row must still appear');
  assert.match(
    all,
    /Stub Detect Throw|intentional detect failure/,
    'detection error must surface in the summary section',
  );
});
