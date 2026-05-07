// test/disclaimer.test.js — gate-matrix tests for lib/disclaimer.js
//
// The consent gate is the single thing standing between an unsuspecting user
// and a six-figure token bill. Every branch of the matrix gets a test:
//
//   1. TTY + 'y' answer        → proceeds
//   2. TTY + 'n' answer        → declines
//   3. TTY + capitalised 'Y'   → proceeds
//   4. TTY + empty/other       → declines (default-no)
//   5. non-TTY, no flag        → refuses *without reading stdin*
//   6. non-TTY, --yes          → proceeds (no prompt, no stdin read)
//   7. --i-accept-the-token-bill → proceeds (no prompt, no stdin read)
//   8. dryRun: true            → proceeds (no prompt, no stdin read)
//   9. subcommand 'print'      → proceeds (no prompt, no stdin read)
//  10. subcommand 'export'     → proceeds (no prompt, no stdin read)
//  11. subcommand 'list'       → proceeds (no prompt, no stdin read)
//  12. summary copy contains the four locked README phrases
//
// Test isolation: each test constructs its own mock streams. No globals are
// touched. process.stdin / process.stdout / process.stderr are never used.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { requireConsent, DISCLAIMER_SUMMARY } from '../lib/disclaimer.js';

// --- helpers -----------------------------------------------------------------

// A Readable that exposes line-at-a-time input AND tracks whether stdin was
// ever read. The non-TTY refusal test asserts readCount === 0.
function makeStdin({ lines = [], isTTY = true } = {}) {
  let readCount = 0;
  let cursor = 0;
  const stream = new Readable({
    read() {
      readCount++;
      if (cursor < lines.length) {
        this.push(lines[cursor++] + '\n');
      } else {
        this.push(null);
      }
    },
  });
  // node:readline checks .isTTY on the input stream.
  stream.isTTY = isTTY;
  Object.defineProperty(stream, 'readCount', { get: () => readCount });
  return stream;
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

// --- gate matrix -------------------------------------------------------------

test("TTY + 'y' answer → proceeds", async () => {
  const stdin = makeStdin({ lines: ['y'], isTTY: true });
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({}, { stdin, stdout, stderr });
  assert.equal(proceed, true);
  assert.ok(stdout.text.includes('Token usage will increase dramatically'),
    'summary not printed to stdout');
});

test("TTY + 'n' answer → declines", async () => {
  const stdin = makeStdin({ lines: ['n'], isTTY: true });
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({}, { stdin, stdout, stderr });
  assert.equal(proceed, false);
});

test("TTY + capitalised 'Y' → proceeds", async () => {
  const stdin = makeStdin({ lines: ['Y'], isTTY: true });
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({}, { stdin, stdout, stderr });
  assert.equal(proceed, true);
});

test('TTY + empty answer → declines (default-no)', async () => {
  const stdin = makeStdin({ lines: [''], isTTY: true });
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({}, { stdin, stdout, stderr });
  assert.equal(proceed, false);
});

test('TTY + arbitrary answer → declines', async () => {
  const stdin = makeStdin({ lines: ['maybe'], isTTY: true });
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({}, { stdin, stdout, stderr });
  assert.equal(proceed, false);
});

test('non-TTY without bypass flag → refuses *and never reads stdin*', async () => {
  // The load-bearing test for ROADMAP criterion #5: a piped `echo y |` must
  // NOT bypass the gate. We assert two things — return value is false AND
  // readCount stays at 0 (proving stdin was not consumed).
  const stdin = makeStdin({ lines: ['y'], isTTY: false });
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({}, { stdin, stdout, stderr });
  assert.equal(proceed, false);
  assert.equal(stdin.readCount, 0,
    'stdin was consumed despite non-TTY refusal — gate is bypassable via pipe');
  assert.ok(stderr.text.includes('--yes') || stderr.text.includes('--i-accept-the-token-bill'),
    'refusal message must direct the user to the explicit bypass flags');
});

test('--yes flag → proceeds without prompting and without reading stdin', async () => {
  const stdin = makeStdin({ lines: ['n'], isTTY: true }); // 'n' would decline if read
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({ yes: true }, { stdin, stdout, stderr });
  assert.equal(proceed, true);
  assert.equal(stdin.readCount, 0, 'stdin consumed despite --yes bypass');
});

test('--i-accept-the-token-bill flag → proceeds without prompting and without reading stdin', async () => {
  const stdin = makeStdin({ lines: ['n'], isTTY: true });
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({ acceptTokenBill: true }, { stdin, stdout, stderr });
  assert.equal(proceed, true);
  assert.equal(stdin.readCount, 0, 'stdin consumed despite --i-accept-the-token-bill bypass');
});

test('dryRun: true → proceeds without prompting and without reading stdin', async () => {
  const stdin = makeStdin({ lines: ['n'], isTTY: true });
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({ dryRun: true }, { stdin, stdout, stderr });
  assert.equal(proceed, true);
  assert.equal(stdin.readCount, 0, 'stdin consumed despite dryRun');
});

test("subcommand 'print' → proceeds without prompting", async () => {
  const stdin = makeStdin({ lines: ['n'], isTTY: true });
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({ subcommand: 'print' }, { stdin, stdout, stderr });
  assert.equal(proceed, true);
  assert.equal(stdin.readCount, 0);
});

test("subcommand 'export' → proceeds without prompting", async () => {
  const stdin = makeStdin({ lines: ['n'], isTTY: true });
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({ subcommand: 'export' }, { stdin, stdout, stderr });
  assert.equal(proceed, true);
  assert.equal(stdin.readCount, 0);
});

test("subcommand 'list' → proceeds without prompting", async () => {
  const stdin = makeStdin({ lines: ['n'], isTTY: true });
  const stdout = makeWritable();
  const stderr = makeWritable();
  const proceed = await requireConsent({ subcommand: 'list' }, { stdin, stdout, stderr });
  assert.equal(proceed, true);
  assert.equal(stdin.readCount, 0);
});

test('DISCLAIMER_SUMMARY contains all four locked phrases from the README disclaimer', () => {
  // These four substrings are tested against verbatim. If a future change
  // softens the language, this test fails — by design. The README disclaimer
  // is load-bearing legal cover; the CLI summary must echo it faithfully.
  assert.ok(DISCLAIMER_SUMMARY.includes('Token usage will increase dramatically'),
    'missing: "Token usage will increase dramatically"');
  assert.ok(DISCLAIMER_SUMMARY.includes('Not for production'),
    'missing: "Not for production"');
  assert.ok(DISCLAIMER_SUMMARY.includes('token bills'),
    'missing: "token bills"');
  assert.ok(DISCLAIMER_SUMMARY.includes('Full disclaimer: see README.md'),
    'missing: "Full disclaimer: see README.md"');
});
