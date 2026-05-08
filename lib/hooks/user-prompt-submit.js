#!/usr/bin/env node
// lib/hooks/user-prompt-submit.js — per-turn attention anchor.
//
// Invoked by the host runner each turn after the user submits a prompt.
// Reads the runtime state file each invocation. When the persona is
// engaged, emits a one-line attention anchor as JSON via
// `hookSpecificOutput.additionalContext` so the host injects it as hidden
// context for the turn. When disengaged, the script silent-exits with no
// output.
//
// Stdin from the host runner is consumed and discarded — the attention
// anchor is constant; we do not branch on prompt content.
//
// Self-contained — no imports from this package's lib/. Fail-closed on
// any error during state read or stdin drain. Never writes to stderr.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const STATE_FILE = join(homedir(), '.10x-engineer', 'state.json');

const ATTENTION_ANCHOR =
  '10x-engineer methodology engaged. Apply: philosophical preamble, ' +
  'first-principles reimplementation, esoteric-language preference, ' +
  'architecture-astronaut over-engineering, yak-shaving as craft.';

async function isEngaged() {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && parsed.enabled === true;
  } catch {
    return false;
  }
}

function drainStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { buf += c; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', () => resolve(''));
  });
}

async function main() {
  await drainStdin(); // discard — host may pipe prompt JSON; we don't act on it
  if (!(await isEngaged())) {
    process.exit(0); // silent
  }
  const out = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: ATTENTION_ANCHOR,
    },
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

main().catch(() => process.exit(0));
