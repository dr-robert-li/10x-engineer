// test/cli.test.js — subprocess-driven CLI integration tests.
//
// We spawn `node bin/cli.js <args>` out-of-process via execFile so the actual
// shebang, commander parsing path, and process.exit(code) chain are all
// exercised end-to-end. Each test asserts on {code, stdout, stderr}.
//
// Phase 2 only ships a single first-class adapter, so the empty-env install
// test expects exit 1 ("no harnesses detected") when HOME points at an empty
// mkdtemp. That is the orchestrator's "early bail before consent gate" branch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, '..', 'bin', 'cli.js');

// Use the absolute path to the running node executable so callers can
// override the subprocess's PATH (e.g. to neutralise harness binaries
// without making `node` itself unresolvable).
const nodeBin = process.execPath;

/** Run `node bin/cli.js <args>`. Resolves with {code, stdout, stderr} for
 *  non-zero exits too (execFile rejects on non-zero, so we normalise). */
async function runCli(args, opts = {}) {
  try {
    const r = await execFileP(nodeBin, [cli, ...args], {
      encoding: 'utf8',
      ...opts,
    });
    return { code: 0, stdout: r.stdout, stderr: r.stderr };
  } catch (e) {
    return { code: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

test('--help shows all five subcommands', async () => {
  const { code, stdout } = await runCli(['--help']);
  assert.equal(code, 0);
  for (const sub of ['install', 'uninstall', 'list', 'print', 'export']) {
    assert.ok(
      stdout.includes(sub),
      `expected --help output to mention '${sub}'; got:\n${stdout}`,
    );
  }
});

test('--version prints package.json version (0.2.0)', async () => {
  const { code, stdout } = await runCli(['--version']);
  assert.equal(code, 0);
  assert.ok(
    stdout.trim().includes('0.2.0'),
    `expected --version to print 0.2.0; got: ${JSON.stringify(stdout)}`,
  );
});

test('unknown option exits non-zero (commander v14 strict mode)', async () => {
  const { code } = await runCli(['install', '--no-such-flag-anywhere']);
  assert.notEqual(code, 0, 'unknown option should not exit 0');
});

test('install --dry-run --yes against an empty env returns exit 1 (no harnesses detected)', async (t) => {
  const root = await mkdtemp(join(tmpdir(), '10xe-cli-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  // Neutralise PATH: with the full Phase 3 registry, codex/gemini adapters
  // call commandExists() which reads PATH from the spawned subprocess env.
  // A developer machine with codex/gemini installed would leak detection
  // into a "no harness detected" fixture and flip this exit code. Point
  // PATH at the empty mkdtemp root so commandExists finds nothing while
  // execFile can still spawn `node` (resolved against the parent's PATH).
  const { code } = await runCli(
    ['install', '--dry-run', '--yes'],
    {
      cwd: root,
      env: { ...process.env, HOME: root, USERPROFILE: root, PATH: root },
    },
  );
  // No .claude/ in either cwd or HOME, no codex/gemini binary in the
  // sandbox PATH → exit 1
  assert.equal(code, 1, 'expected exit 1 when no harness detected');
});

test('export <dir> resolves positional and writes native-skills bundle', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), '10xe-cli-export-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const out = join(dir, 'bundle');
  const { code } = await runCli(['export', out]);
  assert.equal(code, 0);
  const sample = await readFile(
    join(out, 'native-skills', 'philosophical-preamble.md'),
    'utf8',
  );
  assert.ok(sample.startsWith('---\nname: philosophical-preamble\n'));
});

// CLI-05: --global and --project are mutually exclusive. The CLI must reject
// the combination before it reaches the orchestrator, with exit code 1 and a
// stderr message naming the offending flags.
test('install --global --project errors with mutual-exclusion message', async () => {
  const { code, stderr } = await runCli([
    'install', '--global', '--project', '--dry-run',
  ]);
  assert.equal(code, 1, 'expected exit code 1 for mutual-exclusion violation');
  assert.match(
    stderr,
    /--global and --project are mutually exclusive/,
    `expected mutual-exclusion message on stderr; got: ${JSON.stringify(stderr)}`,
  );
});
