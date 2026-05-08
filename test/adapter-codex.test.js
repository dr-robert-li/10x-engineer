// test/adapter-codex.test.js
//
// Codex CLI adapter — append-mode round-trip suite. Eleven named tests cover:
//
//   1.  detect: no .codex/, no codex on PATH, no project AGENTS.md → found:false
//   2.  detect: ~/.codex/ present                                 → scope:'global'
//   3.  detect: project AGENTS.md present                          → scope:'project'
//   4.  detect: both signals present                               → scope:'both'
//   5.  detect: codex on synthetic PATH (no ~/.codex/, no AGENTS.md) → scope:'global'
//   6.  install + uninstall round-trip on a populated AGENTS.md    → byte-identical-around-marker
//   7.  install + uninstall round-trip on a no-trailing-newline file → bounded \n artefact tolerated
//   8.  install + uninstall round-trip on a CRLF-saved file        → surrounding bytes byte-identical
//   9.  re-install is idempotent (replaceBlock-in-place)            → final file content stable
//  10.  dryRun:true does not touch disk; mtime unchanged
//  11.  AGENTS.override.md is NEVER modified (user escape hatch — Pitfall 6)
//
// Every test uses mkdtemp to build an isolated environment and threads cwd
// and homedir into the adapter (D2-24). Since this adapter is the first to
// gate detection on PATH, makeEnv saves and isolates process.env.PATH so the
// host machine's $PATH never leaks into a test that asserts found:false.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, mkdir, writeFile, readFile, stat, rm, chmod, access,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import codex from '../lib/adapters/codex.js';
import { loadSkills } from '../lib/skills.js';
import { assertByteIdenticalAroundMarker } from './helpers/byte-identity.js';

/**
 * Build an isolated test environment under a single mkdtemp. Caller flags
 * which Codex signals to seed (global dir, global AGENTS.md, project AGENTS.md,
 * .git anchor for the project root).
 *
 * Critically, this helper also overrides process.env.PATH for the duration of
 * the test so commandExists('codex') does not pick up a host-installed binary.
 * Defaults to '' (no PATH); callers that want PATH-binary detection set it
 * explicitly via opts.path.
 */
async function makeEnv(t, opts = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-codex-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (opts.withGlobalDir || opts.withGlobalAgents) {
    await mkdir(join(homedir, '.codex'), { recursive: true });
  }
  if (opts.withGlobalAgents) {
    await writeFile(join(homedir, '.codex', 'AGENTS.md'), opts.globalContent ?? '');
  }
  if (opts.withProjectAgents) {
    await writeFile(join(cwd, 'AGENTS.md'), opts.projectContent ?? '');
  }
  if (opts.withGit) {
    await mkdir(join(cwd, '.git'), { recursive: true });
  }

  // PATH isolation: host's installed `codex` (if any) must not leak into a
  // test that asserts found:false or scope:'project'. Test 5 opts in via
  // opts.path = <fake bin dir>.
  const origPath = process.env.PATH;
  process.env.PATH = opts.path ?? '';
  t.after(() => { process.env.PATH = origPath; });

  return { root, homedir, cwd };
}

test('codex detect: nothing → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await codex.detect(env);
  assert.equal(r.found, false);
});

test('codex detect: ~/.codex/ present → scope=global, paths.global resolved', async (t) => {
  const env = await makeEnv(t, { withGlobalDir: true });
  const r = await codex.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(r.paths.global, join(env.homedir, '.codex', 'AGENTS.md'));
  assert.equal(r.paths.project, null);
});

test('codex detect: project AGENTS.md present → scope=project', async (t) => {
  const env = await makeEnv(t, { withProjectAgents: true, withGit: true });
  const r = await codex.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, 'AGENTS.md'));
  assert.equal(r.paths.global, null);
});

test('codex detect: both signals present → scope=both', async (t) => {
  const env = await makeEnv(t, {
    withGlobalDir: true, withProjectAgents: true, withGit: true,
  });
  const r = await codex.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'both');
  assert.ok(r.paths.global);
  assert.ok(r.paths.project);
});

test('codex detect: codex on synthetic PATH → scope=global (PATH-binary fallback)', async (t) => {
  // Build a fake bindir, drop an executable named `codex` into it, then
  // wire env.PATH to point at it. With no ~/.codex/ on disk and no project
  // AGENTS.md, detection must still return found:true via commandExists.
  const root = await mkdtemp(join(tmpdir(), '10xe-codex-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  const fakeBinDir = join(root, 'bin');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  await mkdir(fakeBinDir, { recursive: true });
  const fakeCodex = join(fakeBinDir, 'codex');
  await writeFile(fakeCodex, '#!/bin/sh\nexit 0\n');
  await chmod(fakeCodex, 0o755);

  const origPath = process.env.PATH;
  process.env.PATH = fakeBinDir;
  t.after(() => { process.env.PATH = origPath; });

  const r = await codex.detect({ cwd, homedir });
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(r.paths.global, join(homedir, '.codex', 'AGENTS.md'));
});

test('codex install + uninstall round-trip on populated AGENTS.md', async (t) => {
  const original = '# user content\nstuff above the marker\n\nstuff below later\n';
  const env = await makeEnv(t, {
    withProjectAgents: true,
    projectContent: original,
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await codex.detect(env);

  await codex.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });

  // Post-install: the original user content must still be present, plus a marker block
  const afterInstall = await readFile(detection.paths.project, 'utf8');
  assert.ok(afterInstall.includes('# user content\nstuff above the marker'),
    'user content must survive install');
  assert.ok(afterInstall.includes('<!-- BEGIN 10x-engineer'), 'marker block must be present');

  // Round-trip
  await codex.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('codex install + uninstall round-trip with no-trailing-newline AGENTS.md', async (t) => {
  // FND-09-refined: a single bounded \n artefact is tolerated by the helper.
  const original = '{ "user": "config" }'; // no trailing \n
  const env = await makeEnv(t, {
    withProjectAgents: true,
    projectContent: original,
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await codex.detect(env);

  await codex.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await codex.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('codex install + uninstall round-trip with CRLF AGENTS.md', async (t) => {
  // CRLF-saved file. BLOCK_RE in markers.js uses \r?\n; safe-fs preserves
  // BOM (none here) and replaceBlock/stripBlock are CRLF-tolerant.
  const original = '# title\r\nuser line one\r\nuser line two\r\n';
  const env = await makeEnv(t, {
    withProjectAgents: true,
    projectContent: original,
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await codex.detect(env);

  await codex.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await codex.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('codex install is idempotent: re-running produces identical content', async (t) => {
  const env = await makeEnv(t, {
    withProjectAgents: true,
    projectContent: '# original\n',
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await codex.detect(env);

  await codex.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const afterFirst = await readFile(detection.paths.project, 'utf8');

  await codex.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const afterSecond = await readFile(detection.paths.project, 'utf8');

  assert.equal(afterSecond, afterFirst,
    're-running install must produce byte-identical content (replaceBlock replaces in place)');
});

test('codex dryRun:true does not change file mtime', async (t) => {
  const env = await makeEnv(t, {
    withProjectAgents: true,
    projectContent: '# user content\n',
    withGit: true,
  });
  const skills = await loadSkills();
  const detection = await codex.detect(env);

  const before = await stat(detection.paths.project);

  const r = await codex.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 1, 'written array records the would-be path even on dryRun');

  const after = await stat(detection.paths.project);
  assert.equal(before.mtimeMs, after.mtimeMs, 'mtime must be unchanged on dryRun');

  // Content also unchanged
  const content = await readFile(detection.paths.project, 'utf8');
  assert.equal(content, '# user content\n');
});

test('codex AGENTS.override.md is never modified (user escape hatch — Pitfall 6)', async (t) => {
  const env = await makeEnv(t, {
    withGlobalDir: true,
    withProjectAgents: true,
    projectContent: '',
    withGit: true,
  });
  const overridePath = join(env.homedir, '.codex', 'AGENTS.override.md');
  const overrideBody = '# user override\nshould survive\n';
  await writeFile(overridePath, overrideBody);
  const before = await stat(overridePath);

  const skills = await loadSkills();
  const detection = await codex.detect(env);
  await codex.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await codex.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  const after = await stat(overridePath);
  assert.equal(await readFile(overridePath, 'utf8'), overrideBody,
    'AGENTS.override.md content must be byte-identical');
  assert.equal(after.mtimeMs, before.mtimeMs,
    'AGENTS.override.md mtime must be unchanged');
});

test('codex install writes slash-command file at ~/.codex/prompts/10x-engineer.md (global scope)', async (t) => {
  const env = await makeEnv(t, { withGlobalDir: true });
  const skills = await loadSkills();
  const detection = await codex.detect(env);
  assert.equal(detection.scope, 'global');

  const r = await codex.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.2',
  });

  const promptPath = join(env.homedir, '.codex', 'prompts', '10x-engineer.md');
  assert.equal(existsSync(promptPath), true,
    'codex prompts/10x-engineer.md must be written on global install');
  assert.ok(r.written.includes(promptPath),
    'install.written must record the prompt file path');

  const body = await readFile(promptPath, 'utf8');
  // Frontmatter dropped, $ARGUMENTS rewritten to $1
  assert.equal(body.startsWith('---'), false,
    'codex prompt body must not carry yaml frontmatter');
  assert.ok(body.includes('$1'),
    'codex prompt body must rewrite $ARGUMENTS to $1');
  assert.equal(body.includes('$ARGUMENTS'), false,
    'codex prompt body must not retain raw $ARGUMENTS placeholder');

  // Uninstall removes the prompt file but leaves the prompts/ dir
  await codex.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.equal(existsSync(promptPath), false,
    'codex prompts/10x-engineer.md must be removed on uninstall');
  await assert.doesNotReject(
    access(join(env.homedir, '.codex', 'prompts')),
    'parent prompts/ dir is preserved (surgical removal)',
  );
});

test('codex install with project-only scope does NOT write a global prompt file', async (t) => {
  const env = await makeEnv(t, { withProjectAgents: true, withGit: true });
  const skills = await loadSkills();
  const detection = await codex.detect(env);
  assert.equal(detection.scope, 'project');

  await codex.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.2',
  });

  const promptPath = join(env.homedir, '.codex', 'prompts', '10x-engineer.md');
  assert.equal(existsSync(promptPath), false,
    'project-only install must NOT touch global ~/.codex/prompts/');
});

test('codex dryRun:true does not create the prompt file', async (t) => {
  const env = await makeEnv(t, { withGlobalDir: true });
  const skills = await loadSkills();
  const detection = await codex.detect(env);

  await codex.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: true, version: '0.1.2',
  });

  const promptPath = join(env.homedir, '.codex', 'prompts', '10x-engineer.md');
  assert.equal(existsSync(promptPath), false,
    'dryRun must not create the prompt file');
  assert.equal(existsSync(join(env.homedir, '.codex', 'prompts')), false,
    'dryRun must not create the prompts/ dir');
});

test('codex Phase 6: install copies hook scripts + persona.txt + patches hooks.json (global scope)', async (t) => {
  const env = await makeEnv(t, { withGlobalDir: true });
  const skills = await loadSkills();
  const detection = await codex.detect(env);
  assert.equal(detection.found, true);
  assert.equal(detection.scope, 'global');

  await codex.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.3.0',
  });

  // The two hook scripts and persona.txt
  const hooksDir = join(env.homedir, '.codex/hooks');
  const ssPath = join(hooksDir, '10x-engineer-session-start.js');
  const upsPath = join(hooksDir, '10x-engineer-user-prompt-submit.js');
  const personaPath = join(hooksDir, 'persona.txt');
  assert.equal(existsSync(ssPath), true, 'session-start script must exist in .codex/hooks/');
  assert.equal(existsSync(upsPath), true, 'user-prompt-submit script must exist in .codex/hooks/');
  assert.equal(existsSync(personaPath), true, 'persona.txt must exist in .codex/hooks/');

  // hooks.json patched
  const hooksJsonPath = join(env.homedir, '.codex/hooks.json');
  assert.equal(existsSync(hooksJsonPath), true, 'hooks.json must be created on install');
  const cfg = JSON.parse(await readFile(hooksJsonPath, 'utf8'));
  assert.equal(cfg.hooks.SessionStart.length, 1);
  assert.match(cfg.hooks.SessionStart[0].hooks[0].command, /10x-engineer-session-start/);
  assert.equal(cfg.hooks.UserPromptSubmit.length, 1);
  assert.match(cfg.hooks.UserPromptSubmit[0].hooks[0].command, /10x-engineer-user-prompt-submit/);

  // Hook scripts must be byte-equal to lib/hooks/* sources
  const ssSrc = await readFile(
    new URL('../lib/hooks/session-start.js', import.meta.url).pathname, 'utf8');
  assert.equal(await readFile(ssPath, 'utf8'), ssSrc,
    'installed session-start hook must be byte-equal to source');

  // Mode 0755 on POSIX
  if (process.platform !== 'win32') {
    const st = await stat(ssPath);
    assert.equal(st.mode & 0o111, 0o111, 'installed session-start hook must be executable on POSIX');
  }

  // Round-trip uninstall removes all four artefacts
  await codex.uninstall({ scope: detection.scope, paths: detection.paths, dryRun: false });
  assert.equal(existsSync(ssPath), false);
  assert.equal(existsSync(upsPath), false);
  assert.equal(existsSync(personaPath), false);
  // hooks.json may persist as `{}` after our entries are removed
  if (existsSync(hooksJsonPath)) {
    const post = JSON.parse(await readFile(hooksJsonPath, 'utf8'));
    assert.equal(post.hooks ? Object.keys(post.hooks).length : 0, 0,
      'no 10x-engineer hook entries remain in hooks.json after uninstall');
  }
});

test('codex Phase 6: foreign hooks.json entry survives install + uninstall', async (t) => {
  const env = await makeEnv(t, { withGlobalDir: true });
  const skills = await loadSkills();

  // Pre-seed hooks.json with a foreign entry the user already configured.
  const hooksJsonPath = join(env.homedir, '.codex/hooks.json');
  const foreign = {
    hooks: {
      SessionStart: [
        { hooks: [{ type: 'command', command: 'node /opt/foreign-tool/start.js', timeout: 10 }] },
      ],
    },
    other_user_setting: { keep: 'me' },
  };
  await writeFile(hooksJsonPath, JSON.stringify(foreign, null, 2) + '\n');

  const detection = await codex.detect(env);
  await codex.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });
  const postInstall = JSON.parse(await readFile(hooksJsonPath, 'utf8'));
  assert.equal(postInstall.hooks.SessionStart.length, 2,
    'install must append our SessionStart entry alongside the foreign one');
  assert.equal(postInstall.other_user_setting.keep, 'me',
    'foreign top-level keys must survive install');

  await codex.uninstall({ scope: detection.scope, paths: detection.paths, dryRun: false });
  const postUninstall = JSON.parse(await readFile(hooksJsonPath, 'utf8'));
  assert.equal(postUninstall.hooks.SessionStart.length, 1,
    'uninstall must remove only our SessionStart entry');
  assert.match(postUninstall.hooks.SessionStart[0].hooks[0].command, /foreign-tool/,
    'foreign SessionStart entry must survive content-equal');
  assert.equal(postUninstall.other_user_setting.keep, 'me',
    'foreign top-level keys must survive uninstall');
});

test('codex Phase 6: idempotent re-install does not duplicate hooks.json entries', async (t) => {
  const env = await makeEnv(t, { withGlobalDir: true });
  const skills = await loadSkills();
  const detection = await codex.detect(env);
  await codex.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });
  await codex.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });
  const cfg = JSON.parse(await readFile(join(env.homedir, '.codex/hooks.json'), 'utf8'));
  assert.equal(cfg.hooks.SessionStart.length, 1, 're-install must not duplicate SessionStart');
  assert.equal(cfg.hooks.UserPromptSubmit.length, 1, 're-install must not duplicate UserPromptSubmit');
});

test('codex Phase 6: project-only install does not patch hooks.json or create hooks dir', async (t) => {
  const env = await makeEnv(t, { withProjectAgents: true });
  const skills = await loadSkills();
  const detection = await codex.detect(env);
  assert.equal(detection.found, true);
  assert.equal(detection.scope, 'project',
    'no <homedir>/.codex/, no codex on PATH → project-only scope');

  await codex.install({ skills, scope: detection.scope, paths: detection.paths, dryRun: false });

  // No hooks dir at homedir or cwd
  assert.equal(existsSync(join(env.homedir, '.codex')), false,
    'project install must not create <homedir>/.codex/');
  assert.equal(existsSync(join(env.cwd, '.codex')), false,
    'project install must not create project-side .codex/');
});

test('codex Phase 6: dryRun does not create hooks dir or hooks.json', async (t) => {
  const env = await makeEnv(t, { withGlobalDir: true });
  const skills = await loadSkills();
  const detection = await codex.detect(env);
  const r = await codex.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: true,
  });
  // hooks dir not created
  assert.equal(existsSync(join(env.homedir, '.codex/hooks')), false,
    'hooks/ must not be created on dryRun');
  assert.equal(existsSync(join(env.homedir, '.codex/hooks.json')), false,
    'hooks.json must not be created on dryRun');
  // written array still records would-be paths
  const wouldBe = r.written.join('\n');
  assert.match(wouldBe, /10x-engineer-session-start\.js/,
    'dryRun written array must include the would-be session-start path');
  assert.match(wouldBe, /hooks\.json/,
    'dryRun written array must include the would-be hooks.json path');
});
