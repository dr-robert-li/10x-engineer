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
