// test/hook-session-start.test.js — TEST-09 spawn-based hook coverage (HOOK-02).
//
// Each test spawns the hook script as a child process with HOME pointed at a
// per-test mkdtemp root and PERSONA_FILE pointed at a per-test temp-file
// fixture. The script reads ~/.10x-engineer/state.json relative to that
// HOME and reads the persona file at PERSONA_FILE — so isolation is total.
// No real state file is read; no source-tree file is mutated.
//
// TEST-07 isolation contract: this test file MUST NOT create, modify, or
// remove `lib/hooks/persona.txt` in the repo working tree. The PERSONA_FILE
// env-var override is the entire reason that path is uninvolved.
//
// Fail-closed contract: missing, malformed, enabled:false, type-mismatched
// state.json all yield exit 0 with empty stdout and empty stderr. The only
// engaged case (enabled:true with PERSONA_FILE pointing at a populated file)
// emits the persona to stdout verbatim.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const HOOK_PATH = resolve(import.meta.dirname, '..', 'lib', 'hooks', 'session-start.js');
const SOURCE_TREE_PERSONA = resolve(import.meta.dirname, '..', 'lib', 'hooks', 'persona.txt');

async function makeHome(t) {
  const root = await mkdtemp(join(tmpdir(), '10xe-hook-ss-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function makeTempPersona(t, content) {
  const dir = await mkdtemp(join(tmpdir(), '10xe-persona-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const personaPath = join(dir, 'persona.txt');
  await writeFile(personaPath, content);
  return personaPath;
}

function runHook(homedir, { stdin = '', personaFile } = {}) {
  return new Promise((resolveP, rejectP) => {
    const env = { ...process.env, HOME: homedir, USERPROFILE: homedir };
    if (personaFile !== undefined) {
      env.PERSONA_FILE = personaFile;
    } else {
      // Explicitly redirect PERSONA_FILE to a non-existent path inside the
      // mkdtemp HOME so the hook's missing-persona path is exercised without
      // ever reading from the source-tree's lib/hooks/persona.txt.
      env.PERSONA_FILE = join(homedir, '__no_such_persona__');
    }
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

// ---------------------------------------------------------------------------
// TEST-07 source-tree-isolation invariant — runs first, runs last.
// ---------------------------------------------------------------------------

test('TEST-07 invariant: source-tree lib/hooks/persona.txt MUST NOT exist before any tests run', () => {
  assert.equal(existsSync(SOURCE_TREE_PERSONA), false,
    'TEST-07: tests must not create lib/hooks/persona.txt; this file is a runtime artefact written only by the installer at install time');
});

test('session-start: missing state.json → exit 0, no stdout, no stderr', async (t) => {
  const home = await makeHome(t);
  const r = await runHook(home);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});

test('session-start: enabled:false → exit 0, no stdout, no stderr', async (t) => {
  const home = await makeHome(t);
  await writeState(home, '{"enabled":false}\n');
  const r = await runHook(home);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});

test('session-start: malformed JSON → exit 0 (fail-closed), no stdout, no stderr', async (t) => {
  const home = await makeHome(t);
  await writeState(home, '{not json');
  const r = await runHook(home);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});

test('session-start: enabled is the string "true" → exit 0 (strict), no stdout', async (t) => {
  const home = await makeHome(t);
  await writeState(home, '{"enabled":"true"}');
  const r = await runHook(home);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});

test('session-start: enabled:true but PERSONA_FILE points at non-existent path → exit 0, no stdout', async (t) => {
  const home = await makeHome(t);
  await writeState(home, '{"enabled":true}');
  const r = await runHook(home);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});

test('session-start: enabled:true with PERSONA_FILE pointing at populated temp-file → exit 0, persona on stdout', async (t) => {
  const home = await makeHome(t);
  await writeState(home, '{"enabled":true}');
  const personaContent = '# Persona test marker\nfirst-principles-everything\n';
  const personaPath = await makeTempPersona(t, personaContent);
  const r = await runHook(home, { personaFile: personaPath });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, personaContent);
  assert.equal(r.stderr, '');
});

test('TEST-07 invariant: source-tree lib/hooks/persona.txt MUST NOT exist after the engaged test', () => {
  assert.equal(existsSync(SOURCE_TREE_PERSONA), false,
    'TEST-07: the engaged test used PERSONA_FILE override into a temp dir; source-tree persona.txt must remain absent');
});
