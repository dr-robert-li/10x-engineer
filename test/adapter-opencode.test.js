// test/adapter-opencode.test.js — TIER1-05 mixed-mode round-trip suite.
//
// opencode is the only Tier 1 adapter that writes TWO artefacts of different
// kinds: a per-file global agent definition under <homedir>/.config/opencode/
// agents/10x-engineer.md AND a marker-bounded block in <projectRoot>/AGENTS.md.
// Uninstall removes both; user content surrounding both surfaces survives
// byte-identically.
//
// Ten named tests covering the mixed-mode contract:
//   1. detect: nothing                                                → found:false
//   2. detect: ~/.config/opencode/ exists                              → scope='global'
//   3. detect: project opencode.json exists                            → scope='project'
//   4. detect: project opencode.jsonc exists                           → scope='project'
//   5. detect: both                                                    → scope='both'
//   6. install + uninstall mixed-mode round-trip with pre-existing user
//      content in AGENTS.md AND a user-owned sibling under agents/
//   7. idempotent re-install: agent file content stable, AGENTS.md
//      block replaced in place
//   8. partial-failure cleanup: agent file present but AGENTS.md has no
//      block — uninstall completes cleanly (stripBlock no-ops)
//   9. dryRun:true: no file changes; mtime unchanged on AGENTS.md;
//      agent file still absent
//  10. vendor-canonical PLURAL `agents/` lock-in (research §Pitfall 4)
//
// Every test uses mkdtemp to build an isolated environment and threads cwd
// and homedir into the adapter (D2-24). The real ~/.config/opencode is
// never read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readFile, writeFile, stat, access,
} from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import opencode from '../lib/adapters/opencode.js';
import { loadSkills } from '../lib/skills.js';
import { assertByteIdenticalAroundMarker } from './helpers/byte-identity.js';

/**
 * Build an isolated test environment under a single mkdtemp. Caller flags
 * which opencode signals to seed.
 *
 *   withGlobal          → create <homedir>/.config/opencode/
 *   withProjectJson     → create <cwd>/opencode.json (vendor signature)
 *   withProjectJsonc    → create <cwd>/opencode.jsonc (alternate signature)
 *   projectAgentsContent → write <cwd>/AGENTS.md with this body
 */
async function makeEnv(t, opts = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-opencode-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (opts.withGlobal) {
    await mkdir(join(homedir, '.config', 'opencode'), { recursive: true });
  }
  if (opts.withProjectJson) {
    await writeFile(join(cwd, 'opencode.json'), '{}\n');
  }
  if (opts.withProjectJsonc) {
    await writeFile(join(cwd, 'opencode.jsonc'), '// jsonc\n{}\n');
  }
  if (opts.projectAgentsContent !== undefined) {
    await writeFile(join(cwd, 'AGENTS.md'), opts.projectAgentsContent);
  }
  return { root, homedir, cwd };
}

test('opencode detect: nothing → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await opencode.detect(env);
  assert.equal(r.found, false);
});

test('opencode detect: ~/.config/opencode/ exists → scope=global', async (t) => {
  const env = await makeEnv(t, { withGlobal: true });
  const r = await opencode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(r.paths.global, join(env.homedir, '.config', 'opencode', 'agents', '10x-engineer.md'));
  assert.equal(r.paths.project, null);
});

test('opencode detect: project opencode.json → scope=project', async (t) => {
  const env = await makeEnv(t, { withProjectJson: true });
  const r = await opencode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, 'AGENTS.md'));
  assert.equal(r.paths.global, null);
});

test('opencode detect: project opencode.jsonc → scope=project', async (t) => {
  const env = await makeEnv(t, { withProjectJsonc: true });
  const r = await opencode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.project, join(env.cwd, 'AGENTS.md'));
  assert.equal(r.paths.global, null);
});

test('opencode detect: both signals → scope=both, both paths populated', async (t) => {
  const env = await makeEnv(t, { withGlobal: true, withProjectJson: true });
  const r = await opencode.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'both');
  assert.ok(r.paths.global);
  assert.ok(r.paths.project);
});

test('opencode install + uninstall mixed-mode round-trip preserves user content on both surfaces', async (t) => {
  const original = '# user content\nstuff above the marker\n\nstuff below later\n';
  const env = await makeEnv(t, {
    withGlobal: true,
    withProjectJson: true,
    projectAgentsContent: original,
  });
  const skills = await loadSkills();
  const detection = await opencode.detect(env);
  assert.equal(detection.scope, 'both');

  // Seed a sibling file the user "already owned" inside agents/ — adapter
  // must NEVER touch it. Surgical removal — ROADMAP cross-phase invariant 4.
  const siblingDir = join(env.homedir, '.config', 'opencode', 'agents');
  await mkdir(siblingDir, { recursive: true });
  const siblingPath = join(siblingDir, 'user-owned.md');
  const siblingBody = '# user-owned agent\nshould survive round-trip\n';
  await writeFile(siblingPath, siblingBody);
  const siblingStatBefore = await stat(siblingPath);

  // Install both halves
  const installRes = await opencode.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  assert.equal(installRes.written.length, 2,
    'mixed-mode install must write 2 paths (global agent + project AGENTS.md)');

  // Post-install: global agent file present, with opencode frontmatter
  const agentBody = await readFile(detection.paths.global, 'utf8');
  assert.ok(agentBody.startsWith('---\n'), 'agent file must lead with frontmatter fence');
  assert.ok(agentBody.includes('description:'), 'agent frontmatter must include description');
  assert.ok(agentBody.includes('mode: subagent'), 'agent frontmatter must declare mode: subagent');

  // Post-install: project AGENTS.md preserves user content + adds marker block
  const afterInstall = await readFile(detection.paths.project, 'utf8');
  assert.ok(afterInstall.includes('# user content\nstuff above the marker'),
    'user content must survive install');
  assert.ok(afterInstall.includes('<!-- BEGIN 10x-engineer'), 'marker block must be present');

  // Round-trip: uninstall removes both
  const uninstallRes = await opencode.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.ok(uninstallRes.removed.length >= 1,
    'mixed-mode uninstall records at least the global half (project may be cleaned by stripBlock)');

  // Global agent file: gone
  await assert.rejects(
    access(detection.paths.global, constants.F_OK),
    { code: 'ENOENT' },
    'post-uninstall: global agent file must be gone',
  );

  // User-owned sibling under agents/: byte-identical (content + mtime)
  const siblingBodyAfter = await readFile(siblingPath, 'utf8');
  assert.equal(siblingBodyAfter, siblingBody,
    'post-uninstall: user-owned sibling under agents/ must be byte-identical');
  const siblingStatAfter = await stat(siblingPath);
  assert.equal(siblingStatAfter.mtimeMs, siblingStatBefore.mtimeMs,
    'post-uninstall: user-owned sibling mtime must be unchanged');

  // Project AGENTS.md: content surrounding the (now-stripped) marker block is byte-identical
  await assertByteIdenticalAroundMarker(detection.paths.project, original);
});

test('opencode install is idempotent: re-running produces stable content', async (t) => {
  const env = await makeEnv(t, {
    withGlobal: true,
    withProjectJson: true,
    projectAgentsContent: '# original\n',
  });
  const skills = await loadSkills();
  const detection = await opencode.detect(env);

  await opencode.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const agentFirst = await readFile(detection.paths.global, 'utf8');
  const agentsFirst = await readFile(detection.paths.project, 'utf8');

  await opencode.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const agentSecond = await readFile(detection.paths.global, 'utf8');
  const agentsSecond = await readFile(detection.paths.project, 'utf8');

  assert.equal(agentSecond, agentFirst,
    're-running install must overwrite the agent file with byte-identical content');
  assert.equal(agentsSecond, agentsFirst,
    're-running install must replace the AGENTS.md marker block in place (no duplication)');
});

test('opencode uninstall is idempotent after partial-install state', async (t) => {
  // Simulate a partial-install state: agent file written, AGENTS.md has no
  // marker block (e.g., a previous install crashed between the two writes).
  // Uninstall must complete cleanly: remove the agent file; stripBlock no-ops
  // on a file that lacks the marker.
  const env = await makeEnv(t, {
    withGlobal: true,
    withProjectJson: true,
    projectAgentsContent: '# user content with no marker\n',
  });
  const detection = await opencode.detect(env);

  // Manually write the global agent file (simulates the post-partial state)
  await mkdir(join(detection.paths.global, '..'), { recursive: true });
  await writeFile(detection.paths.global, '---\nmode: subagent\n---\n\nstub\n');

  const beforeAgentsContent = await readFile(detection.paths.project, 'utf8');

  // Uninstall must not throw
  const r = await opencode.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  // Global agent file: gone
  await assert.rejects(
    access(detection.paths.global, constants.F_OK),
    { code: 'ENOENT' },
    'partial-state uninstall: global agent file must be removed',
  );

  // Project AGENTS.md: byte-identical (stripBlock no-ops on missing marker)
  const afterAgentsContent = await readFile(detection.paths.project, 'utf8');
  assert.equal(afterAgentsContent, beforeAgentsContent,
    'partial-state uninstall: AGENTS.md without marker must be byte-identical');

  // Removed list contains only the global path (project half no-opped)
  assert.ok(r.removed.includes(detection.paths.global),
    'removed array must record the global agent file path');
});

test('opencode dryRun:true does not change file mtime or write the agent file', async (t) => {
  const env = await makeEnv(t, {
    withGlobal: true,
    withProjectJson: true,
    projectAgentsContent: '# user content\n',
  });
  const skills = await loadSkills();
  const detection = await opencode.detect(env);

  // AGENTS.md exists pre-test → standard before/after stat
  const beforeProject = await stat(detection.paths.project);

  // Global agent file does NOT exist pre-test
  await assert.rejects(
    access(detection.paths.global, constants.F_OK),
    { code: 'ENOENT' },
    'pre-test sanity: global agent file must not exist yet',
  );

  const r = await opencode.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 2,
    'written array must record 2 would-be paths even on dryRun');

  // AGENTS.md mtime unchanged
  const afterProject = await stat(detection.paths.project);
  assert.equal(beforeProject.mtimeMs, afterProject.mtimeMs,
    'AGENTS.md mtime must be unchanged on dryRun');

  // Content unchanged
  const afterContent = await readFile(detection.paths.project, 'utf8');
  assert.equal(afterContent, '# user content\n');

  // Global agent file still absent
  await assert.rejects(
    access(detection.paths.global, constants.F_OK),
    { code: 'ENOENT' },
    'dryRun:true must NOT write the global agent file',
  );
});

test('opencode: install path uses vendor-canonical PLURAL "agents/" not "agent/"', async (t) => {
  const env = await makeEnv(t, { withGlobal: true });
  const detection = await opencode.detect(env);
  assert.match(detection.paths.global, /\/agents\/10x-engineer\.md$/,
    'opencode adapter MUST resolve to plural "agents/" — vendor canonical (research Pitfall 4)');
  assert.equal(/\/agent\/10x-engineer\.md$/.test(detection.paths.global), false,
    'opencode adapter MUST NOT use singular "agent/" — that path is the brief drift, not the vendor doc');
});
