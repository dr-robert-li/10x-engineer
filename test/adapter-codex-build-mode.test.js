// test/adapter-codex-build-mode.test.js
//
// Phase 7 BUILD-02 + BUILD-04: parallel default-off invariant + persona.txt
// content shape lock for the parallel hook-installing adapter. Mirrors the
// other build-mode adapter test byte-for-byte at the assertion level.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, access, constants } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import adapter from '../lib/adapters/codex.js';
import { loadSkills } from '../lib/skills.js';

async function setup() {
  const root = await mkdtemp(join(tmpdir(), '10x-cx-bm-'));
  const homedir = join(root, 'home');
  const cwd = join(root, 'cwd');
  await mkdir(join(homedir, '.codex'), { recursive: true });
  await mkdir(cwd, { recursive: true });
  return { root, homedir, cwd };
}

test('second hook-installing adapter: persona.txt contains both response-mode and build-mode halves', async () => {
  const { homedir, cwd } = await setup();
  const skills = await loadSkills();
  const found = await adapter.detect({ cwd, homedir });
  assert.ok(found.found && found.paths.global, 'global path expected');

  await adapter.install({ skills, scope: 'global', paths: found.paths, version: '0.3.0' });

  const personaPath = join(homedir, '.codex', 'hooks', 'persona.txt');
  const persona = await readFile(personaPath, 'utf8');

  assert.ok(persona.includes('# 10x-engineer persona'), 'response-mode header must be present');
  assert.ok(persona.includes('BUILD-MODE EXTENSIONS'), 'section-separator header must be present');
});

test('second hook-installing adapter: install with state.json {enabled:false} does NOT modify state.json (BUILD-04)', async () => {
  const { homedir, cwd } = await setup();
  const stateDir = join(homedir, '.10x-engineer');
  const statePath = join(stateDir, 'state.json');
  await mkdir(stateDir, { recursive: true });
  const before = '{"enabled":false}';
  await writeFile(statePath, before, 'utf8');

  const skills = await loadSkills();
  const found = await adapter.detect({ cwd, homedir });
  await adapter.install({ skills, scope: 'global', paths: found.paths, version: '0.3.0' });

  const after = await readFile(statePath, 'utf8');
  assert.equal(after, before, 'state.json must remain byte-equal');
});

test('second hook-installing adapter: install with no state.json on disk does NOT create one', async () => {
  const { homedir, cwd } = await setup();
  const skills = await loadSkills();
  const found = await adapter.detect({ cwd, homedir });
  await adapter.install({ skills, scope: 'global', paths: found.paths, version: '0.3.0' });

  const statePath = join(homedir, '.10x-engineer', 'state.json');
  let exists = true;
  try { await access(statePath, constants.F_OK); } catch { exists = false; }
  assert.equal(exists, false, 'install must not create state.json');
});

test('second hook-installing adapter: dry-run does not write persona.txt', async () => {
  const { homedir, cwd } = await setup();
  const skills = await loadSkills();
  const found = await adapter.detect({ cwd, homedir });
  await adapter.install({ skills, scope: 'global', paths: found.paths, version: '0.3.0', dryRun: true });

  const personaPath = join(homedir, '.codex', 'hooks', 'persona.txt');
  let exists = true;
  try { await access(personaPath, constants.F_OK); } catch { exists = false; }
  assert.equal(exists, false, 'dry-run must not write persona.txt');
});
