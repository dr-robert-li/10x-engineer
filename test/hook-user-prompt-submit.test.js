// test/hook-user-prompt-submit.test.js — TEST-09 spawn-based hook coverage (HOOK-03).
//
// Same harness pattern as test/hook-session-start.test.js — child process
// against a per-test mkdtemp HOME. The user-prompt-submit hook drains stdin
// even on the disengaged path so the host runner's pipe doesn't block; we
// always write a JSON prompt to stdin and verify the script terminates.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const HOOK_PATH = resolve(import.meta.dirname, '..', 'lib', 'hooks', 'user-prompt-submit.js');

async function makeHome(t) {
  const root = await mkdtemp(join(tmpdir(), '10xe-hook-ups-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function runHook(homedir, { stdin = '' } = {}) {
  return new Promise((resolveP, rejectP) => {
    const env = { ...process.env, HOME: homedir, USERPROFILE: homedir };
    const child = spawn(process.execPath, [HOOK_PATH], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString('utf8'); });
    child.stderr.on('data', (c) => { stderr += c.toString('utf8'); });
    child.on('error', rejectP);
    child.on('close', (code) => resolveP({ code, stdout, stderr }));
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
  });
}

async function writeState(homedir, contents) {
  const dir = join(homedir, '.10x-engineer');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'state.json'), contents);
}

const STDIN_PROMPT = JSON.stringify({
  session_id: 'test-session',
  cwd: '/tmp',
  hook_event_name: 'UserPromptSubmit',
  prompt: 'do something interesting',
});

test('user-prompt-submit: missing state.json → exit 0, no stdout', async (t) => {
  const home = await makeHome(t);
  const r = await runHook(home, { stdin: STDIN_PROMPT });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});

test('user-prompt-submit: enabled:false → exit 0, no stdout', async (t) => {
  const home = await makeHome(t);
  await writeState(home, '{"enabled":false}');
  const r = await runHook(home, { stdin: STDIN_PROMPT });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});

test('user-prompt-submit: malformed JSON → exit 0 (fail-closed), no stdout', async (t) => {
  const home = await makeHome(t);
  await writeState(home, '{not json');
  const r = await runHook(home, { stdin: STDIN_PROMPT });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});

test('user-prompt-submit: enabled:true → JSON hookSpecificOutput on stdout', async (t) => {
  const home = await makeHome(t);
  await writeState(home, '{"enabled":true}');
  const r = await runHook(home, { stdin: STDIN_PROMPT });
  assert.equal(r.code, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok(parsed.hookSpecificOutput);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.ok(typeof parsed.hookSpecificOutput.additionalContext === 'string');
  assert.ok(parsed.hookSpecificOutput.additionalContext.length > 0);
  // The anchor must mention the methodology to give the model a load-bearing reminder.
  assert.match(parsed.hookSpecificOutput.additionalContext, /10x-engineer/);
});

test('user-prompt-submit: terminates even when stdin is empty', async (t) => {
  const home = await makeHome(t);
  await writeState(home, '{"enabled":false}');
  const r = await runHook(home); // no stdin payload
  assert.equal(r.code, 0);
});
