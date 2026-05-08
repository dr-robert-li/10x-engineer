// lib/disclaimer.js — centralised consent gate.
//
// Every adapter write goes through lib/install.js (Plan 02-07), and install.js
// is the *only* caller of requireConsent. Adapters never import this module.
//
// Gate semantics:
//   - subcommand ∈ {print, export, list}  → proceed (no prompt, no stdin read)
//   - dryRun: true                        → proceed (no prompt, no stdin read)
//   - yes / acceptTokenBill flag set      → proceed (no prompt, no stdin read)
//   - non-TTY stdin without bypass flag   → refuse (no prompt, no stdin read)
//   - TTY + 'y'/'Y' (trimmed)             → proceed
//   - TTY + anything else (including '')  → decline (default-no)
//
// The non-TTY refusal is load-bearing: a piped `echo y |` must not bypass the
// gate. We check stdin.isTTY *before* constructing the readline interface and
// never read a byte from stdin in the refusal path. The test suite asserts
// readCount === 0 against a mock Readable.
//
// Stream injection (the second argument) is for the test harness. Production
// callers pass nothing and inherit process.stdin/stdout/stderr.
//
// This module also exports two error classes (ConsentDeclinedError,
// NonInteractiveError) and a per-harness scope prompt (promptScope). The
// orchestrator in lib/install.js uses the error classes to discriminate
// exit codes (2 vs 3) and uses promptScope when an adapter's detect()
// returns scope='both' and the user did not pass --global / --project /
// --all to force the choice. Per D2-09.

import * as readline from 'node:readline/promises';

// Subcommands that operate on text only — they never write to a harness path
// and therefore never need consent. Kept as a frozen set so a typo in
// install.js can't accidentally extend the skip list.
const SKIP_SUBCOMMANDS = new Set(['print', 'export', 'list']);

// The on-screen summary printed before the y/N prompt. The four phrases below
// are tested verbatim:
//   - "Token usage will increase dramatically"
//   - "Not for production"
//   - "token bills"
//   - "Full disclaimer: see README.md"
//
// They are the load-bearing legal cover for shipping this package. Any rewrite
// that drops a phrase trips test/disclaimer.test.js — by design.
export const DISCLAIMER_SUMMARY = [
  '',
  '  10x-engineer is a parody. Read this before continuing.',
  '',
  '  Token usage will increase dramatically. The persona installed by this',
  '  package instructs your coding agent to be maximally verbose, to over-',
  '  engineer every solution, and to pursue tangents indefinitely. Expect',
  '  many multiples of normal token consumption.',
  '',
  '  Not for production. Do not install on work accounts, shared agents,',
  '  billed-by-the-token plans you care about, or anywhere cost or output',
  '  quality matters.',
  '',
  '  You accept full responsibility for any token bills, quota exhaustion,',
  '  rate-limit hits, subscription overages, or other charges that result',
  '  from running this package. The author accepts none.',
  '',
  '  Full disclaimer: see README.md.',
  '',
].join('\n');

const PROMPT = '  Proceed? [y/N] ';

const NON_TTY_REFUSAL =
  '10x-engineer: refusing to install non-interactively.\n' +
  'Pipe-fed input cannot grant consent. Re-run with --yes or ' +
  '--i-accept-the-token-bill to acknowledge the disclaimer explicitly.\n';

/**
 * Ask the user for consent before installing the persona.
 *
 * @param {object} opts
 * @param {boolean} [opts.dryRun]          — install --dry-run; no writes happen
 * @param {boolean} [opts.yes]             — --yes flag set
 * @param {boolean} [opts.acceptTokenBill] — --i-accept-the-token-bill flag set
 * @param {string}  [opts.subcommand]      — 'install' | 'print' | 'export' | 'list' | ...
 * @param {object} [streams]
 * @param {NodeJS.ReadableStream} [streams.stdin]
 * @param {NodeJS.WritableStream} [streams.stdout]
 * @param {NodeJS.WritableStream} [streams.stderr]
 * @returns {Promise<boolean>} true to proceed, false to abort
 */
export async function requireConsent(opts = {}, streams = {}) {
  const {
    dryRun = false,
    yes = false,
    acceptTokenBill = false,
    subcommand = 'install',
  } = opts;
  const {
    stdin = process.stdin,
    stdout = process.stdout,
    stderr = process.stderr,
  } = streams;

  // Skip subcommands first — these never invoke the gate even on the install
  // path. install.js short-circuits too, but defensive duplication is cheap.
  if (SKIP_SUBCOMMANDS.has(subcommand)) return true;

  // Dry-run never writes anything, so consent is moot.
  if (dryRun) return true;

  // Explicit bypass flags. Either flag suffices.
  if (yes || acceptTokenBill) return true;

  // Non-TTY refusal. Critical: do not read stdin. Returning false here is
  // load-bearing for ROADMAP criterion #5.
  if (!stdin.isTTY) {
    stderr.write(NON_TTY_REFUSAL);
    return false;
  }

  // Interactive path. Print the summary, ask, default-no.
  stdout.write(DISCLAIMER_SUMMARY);
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(PROMPT);
    return /^y$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

// ---------------------------------------------------------------------------
// Error classes used by the orchestrator (lib/install.js) to map gate state
// to exit codes. The boolean-returning requireConsent above is the canonical
// API; these errors are the orchestrator-side translation layer.
// ---------------------------------------------------------------------------

/** Raised when an interactive user declined the disclaimer. Maps to exit 2. */
export class ConsentDeclinedError extends Error {
  constructor(message = 'Disclaimer declined.') {
    super(message);
    this.name = 'ConsentDeclinedError';
  }
}

/** Raised when stdin is non-TTY and no bypass flag was supplied. Maps to exit 3. */
export class NonInteractiveError extends Error {
  constructor(
    message =
      'Non-interactive shell detected. ' +
      'Pass --yes or --i-accept-the-token-bill to confirm.',
  ) {
    super(message);
    this.name = 'NonInteractiveError';
  }
}

// ---------------------------------------------------------------------------
// Per-harness scope prompt (D2-09).
//
// Fires when an adapter's detect() returns scope='both' AND the user did not
// pass --global / --project / --all to force the choice. Single-keypress
// reader: the user types one of g / p / b / s without pressing Enter. EOF or
// any other key resolves to 'skip' — the safe default.
//
// Stream injection mirrors requireConsent so tests can drive it without
// mutating process.stdin. In production the orchestrator passes nothing and
// inherits the real streams.
// ---------------------------------------------------------------------------

const SCOPE_PROMPT = (displayName, globalPath, projectPath) =>
  `${displayName} detected at both:\n` +
  `  global:  ${globalPath}\n` +
  `  project: ${projectPath}\n` +
  '\n' +
  'Install scope?\n' +
  '  [g] global only   [p] project only   [b] both   [s] skip this harness\n' +
  '> ';

/**
 * Ask the user which scope to install for a harness with both global and
 * project signatures present.
 *
 * @param {object} opts
 * @param {string} opts.displayName
 * @param {string} opts.globalPath
 * @param {string} opts.projectPath
 * @param {object} [streams]
 * @param {NodeJS.ReadableStream} [streams.stdin]
 * @param {NodeJS.WritableStream} [streams.stdout]
 * @returns {Promise<'global'|'project'|'both'|'skip'>}
 */
export async function promptScope(
  { displayName, globalPath, projectPath } = {},
  streams = {},
) {
  const { stdin = process.stdin, stdout = process.stdout } = streams;

  // Non-TTY → safe default. Combined with the disclaimer's non-TTY refusal
  // this branch is unreachable in production, but the test harness exercises
  // it directly to lock the contract.
  if (!stdin.isTTY) return 'skip';

  stdout.write(SCOPE_PROMPT(displayName, globalPath, projectPath));

  const wasRaw = stdin.isRaw;
  const wasPaused = typeof stdin.isPaused === 'function' ? stdin.isPaused() : false;
  if (typeof stdin.setRawMode === 'function') stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise((resolve) => {
    const cleanup = () => {
      stdin.removeListener('data', onData);
      if (typeof stdin.setRawMode === 'function') stdin.setRawMode(wasRaw);
      if (wasPaused) stdin.pause();
    };
    const onData = (chunk) => {
      cleanup();
      const ch = String(chunk).charAt(0);
      // Ctrl-C, Ctrl-D, Enter → skip
      if (ch === '\x03' || ch === '\x04' || ch === '\r' || ch === '\n' || ch === '') {
        stdout.write('s\n');
        return resolve('skip');
      }
      const lower = ch.toLowerCase();
      stdout.write(lower + '\n');
      if (lower === 'g') return resolve('global');
      if (lower === 'p') return resolve('project');
      if (lower === 'b') return resolve('both');
      return resolve('skip');
    };
    stdin.on('data', onData);
  });
}

// ---------------------------------------------------------------------------
// Interactive harness selection (v0.2.0).
//
// runInstall calls this after the consent gate when neither --all nor
// --harness was supplied. The user picks a subset of detected harnesses
// from a numbered checklist; the orchestrator filters the install loop to
// the selection.
//
// Line-mode reader (no raw mode): a single trimmed line, comma- or
// space-separated. Accepts:
//   - integers in [1..N]                → those entries
//   - 'a' / 'all'                       → every entry
//   - 'n' / 'none' / empty / Enter      → no entries (caller should abort)
//   - any other token                   → ignored
//
// Returns an array of adapter ids in registry order (deduped). Stream
// injection mirrors the rest of the module; production callers pass
// nothing and inherit the real streams.
// ---------------------------------------------------------------------------

import { createInterface } from 'node:readline/promises';

const HARNESS_PROMPT_HEADER = 'Detected harnesses:\n';
const HARNESS_PROMPT_FOOTER =
  '\nSelect harnesses (comma-separated indices, "a" for all, "n" for none): ';

export async function promptHarnessSelection({ found } = {}, streams = {}) {
  const {
    stdin = process.stdin,
    stdout = process.stdout,
  } = streams;

  if (!Array.isArray(found) || found.length === 0) return [];

  // Non-TTY callers do not reach this prompt in production (runInstall
  // refuses with NonInteractiveError beforehand). Belt-and-braces: if
  // someone calls us directly with a piped stdin, return the empty set.
  if (!stdin.isTTY) return [];

  stdout.write(HARNESS_PROMPT_HEADER);
  for (let i = 0; i < found.length; i++) {
    const entry = found[i];
    const name = entry.adapter ? entry.adapter.displayName : entry.displayName;
    stdout.write(`  ${i + 1}. ${name}\n`);
  }
  stdout.write(HARNESS_PROMPT_FOOTER);

  // terminal:false keeps readline out of full-screen line-editing mode.
  // We only need a single line read; cursor handling would otherwise
  // try to setRawMode on a non-TTY-derived stream and hang.
  const rl = createInterface({ input: stdin, output: stdout, terminal: false });
  let answer;
  try {
    answer = await rl.question('');
  } finally {
    rl.close();
  }

  const trimmed = (answer || '').trim().toLowerCase();
  if (trimmed === '' || trimmed === 'n' || trimmed === 'none') return [];
  if (trimmed === 'a' || trimmed === 'all') {
    return found.map((e) => (e.adapter ? e.adapter.id : e.id));
  }

  const picks = new Set();
  for (const tok of trimmed.split(/[\s,]+/)) {
    if (!tok) continue;
    const n = Number.parseInt(tok, 10);
    if (Number.isInteger(n) && n >= 1 && n <= found.length) {
      const entry = found[n - 1];
      picks.add(entry.adapter ? entry.adapter.id : entry.id);
    }
  }

  // Preserve registry order rather than user-typed order.
  return found
    .map((e) => (e.adapter ? e.adapter.id : e.id))
    .filter((id) => picks.has(id));
}
