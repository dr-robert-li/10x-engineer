// test/adapter-windsurf.test.js — TIER2-04 mixed-mode round-trip suite.
//
// Windsurf is the structurally most complex Tier 2 adapter — it writes TWO
// artefacts in different formats:
//
//   GLOBAL  → append-markers block in <homedir>/.codeium/windsurf/memories/
//             global_rules.md (shared user file, NEVER markerless-overwritten)
//   PROJECT → per-file directory of 10 .md files at
//             <projectRoot>/.windsurf/rules/10x-engineer/ (10x-engineer-owned)
//
// Vendor docs (verified 2026-05-08) explicitly contradict the project brief's
// `.windsurfrules` legacy signature — modern paths are `.windsurf/rules/`
// (project) and `~/.codeium/windsurf/memories/global_rules.md` (global).
// `.windsurfrules` is retained as a DETECTION signal only (legacy installs);
// never an INSTALL target (Pitfall 5).
//
// Thirteen named tests covering the mixed-mode contract:
//   1. detect: nothing                                      → found:false
//   2. detect: ~/.codeium/ only                             → scope='global'
//   3. detect: <project>/.windsurf/ only                    → scope='project'
//   4. detect: both signals                                 → scope='both'
//   5. detect: legacy <project>/.windsurfrules file         → scope='project'
//   6. install + uninstall scope='both' mixed-mode round-trip — global block
//      added to global_rules.md, 10 files materialised under .windsurf/rules/
//      10x-engineer/, both halves cleaned on uninstall, sibling preserved
//   7. uninstall scope='both' — global_rules.md byte-identical around block,
//      .windsurf/rules/10x-engineer/ removed, .windsurf/rules/ siblings untouched
//   8. install global half — pre-seeded global_rules.md with no trailing newline
//      survives byte-identically around the block (Pitfall 12 regression)
//   9. install global half — CRLF user content preserved across round-trip
//  10. install is idempotent — re-running produces stable file content
//      (no duplicate blocks, no duplicated per-file copies)
//  11. dryRun:true — global_rules.md mtime unchanged AND .windsurf/rules/
//      10x-engineer/ does NOT come into existence
//  12. Pitfall 5 regression — pre-seeded `.windsurfrules` legacy file is NEVER
//      touched (content + mtime byte-identical across install + uninstall)
//  13. Pitfall 12 regression — global_rules.md NEVER markerless-overwritten;
//      pre-seeded user content survives byte-identically around the marker
//
// Every test uses mkdtemp to build an isolated environment and threads cwd
// and homedir into the adapter (D2-24). The real ~/.codeium and the real
// cwd are never read.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp, rm, mkdir, readdir, readFile, writeFile, stat,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import windsurf from '../lib/adapters/windsurf.js';
import { loadSkills } from '../lib/skills.js';
import { assertByteIdenticalAroundMarker } from './helpers/byte-identity.js';

/**
 * Build an isolated test environment under a single mkdtemp. Caller flags
 * which Windsurf signals to seed.
 *
 *   withCodeium       → create the FULL <homedir>/.codeium/windsurf/memories/
 *                       directory tree (so global_rules.md can be written
 *                       atomically — replaceBlock → safeWriteFile tempfiles
 *                       into the destination directory and would otherwise
 *                       ENOENT). Note: deliberately mirrors what a real
 *                       Windsurf install creates on first launch.
 *   withWindsurfDir   → create <cwd>/.windsurf/
 *   withWindsurfrulesFile  → create <cwd>/.windsurfrules (legacy file marker;
 *                            optional content via globalRulesContent's sibling
 *                            opt — see windsurfrulesContent below)
 *   globalRulesContent     → pre-seed <homedir>/.codeium/windsurf/memories/
 *                            global_rules.md with this body
 *   windsurfrulesContent   → pre-seed <cwd>/.windsurfrules with this body
 */
async function makeEnv(t, opts = {}) {
  const root = await mkdtemp(join(tmpdir(), '10xe-windsurf-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const homedir = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  if (opts.withCodeium) {
    // Pre-create the FULL memories path so safeWriteFile's sibling tempfile
    // rename has a valid destination directory. Mirrors real Windsurf state.
    await mkdir(join(homedir, '.codeium', 'windsurf', 'memories'), { recursive: true });
  }
  if (opts.withWindsurfDir) {
    await mkdir(join(cwd, '.windsurf'), { recursive: true });
  }
  if (opts.withWindsurfrulesFile) {
    await writeFile(
      join(cwd, '.windsurfrules'),
      opts.windsurfrulesContent ?? '# legacy windsurf rules\n',
    );
  }
  if (opts.globalRulesContent !== undefined) {
    // Caller wants pre-seeded global_rules.md content; ensure dir exists
    // independently of withCodeium (some tests pre-seed without separately
    // flagging withCodeium).
    await mkdir(join(homedir, '.codeium', 'windsurf', 'memories'), { recursive: true });
    await writeFile(
      join(homedir, '.codeium', 'windsurf', 'memories', 'global_rules.md'),
      opts.globalRulesContent,
    );
  }
  return { root, homedir, cwd };
}

test('windsurf detect: nothing → found:false', async (t) => {
  const env = await makeEnv(t);
  const r = await windsurf.detect(env);
  assert.equal(r.found, false);
});

test('windsurf detect: ~/.codeium/ only → scope=global, paths.project=null', async (t) => {
  const env = await makeEnv(t, { withCodeium: true });
  const r = await windsurf.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'global');
  assert.equal(
    r.paths.global,
    join(env.homedir, '.codeium', 'windsurf', 'memories', 'global_rules.md'),
  );
  assert.equal(r.paths.project, null);
});

test('windsurf detect: <project>/.windsurf/ only → scope=project, paths.global=null', async (t) => {
  const env = await makeEnv(t, { withWindsurfDir: true });
  const r = await windsurf.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  assert.equal(r.paths.global, null);
  assert.equal(
    r.paths.project,
    join(env.cwd, '.windsurf', 'rules', '10x-engineer'),
  );
});

test('windsurf detect: both signals → scope=both, both paths populated', async (t) => {
  const env = await makeEnv(t, { withCodeium: true, withWindsurfDir: true });
  const r = await windsurf.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'both');
  assert.ok(r.paths.global);
  assert.ok(r.paths.project);
});

test('windsurf detect: legacy <project>/.windsurfrules file → scope=project (Pitfall 5: detect-only)', async (t) => {
  const env = await makeEnv(t, { withWindsurfrulesFile: true });
  const r = await windsurf.detect(env);
  assert.equal(r.found, true);
  assert.equal(r.scope, 'project');
  // The legacy fallback resolves paths.project to .windsurf/rules/10x-engineer/
  // — the install will mkdir-recursive that path even though .windsurf/ does
  // not yet exist. The legacy fallback is detect-only; install never targets
  // .windsurfrules itself.
  assert.equal(
    r.paths.project,
    join(env.cwd, '.windsurf', 'rules', '10x-engineer'),
  );
});

test('windsurf install + uninstall scope=both mixed-mode round-trip preserves user content on both surfaces', async (t) => {
  const original = '# user windsurf memory\nstuff above the marker\n\nstuff below later\n';
  const env = await makeEnv(t, {
    withCodeium: true,
    withWindsurfDir: true,
    globalRulesContent: original,
  });
  const skills = await loadSkills();
  const detection = await windsurf.detect(env);
  assert.equal(detection.scope, 'both');

  // Seed a sibling rules-file the user "already owned" inside .windsurf/rules/
  // — alongside (not inside) the 10x-engineer/ install dir. The adapter must
  // NEVER touch this on install or uninstall — surgical removal is ROADMAP
  // cross-phase invariant 4.
  const siblingDir = join(env.cwd, '.windsurf', 'rules');
  await mkdir(siblingDir, { recursive: true });
  const siblingPath = join(siblingDir, 'user-owned.md');
  const siblingBody = '# user-owned rule\nshould survive round-trip\n';
  await writeFile(siblingPath, siblingBody);
  const siblingStatBefore = await stat(siblingPath);

  // Install both halves
  const installRes = await windsurf.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  // 1 global path + 10 project files = 11 written entries
  assert.equal(installRes.written.length, 11,
    'mixed-mode install must write 11 paths (global block + 10 project files)');

  // Post-install: global_rules.md contains the marker block
  const afterInstallGlobal = await readFile(detection.paths.global, 'utf8');
  assert.ok(
    afterInstallGlobal.includes('# user windsurf memory\nstuff above the marker'),
    'user content must survive install in global_rules.md',
  );
  assert.ok(
    afterInstallGlobal.includes('<!-- BEGIN 10x-engineer'),
    'marker block must be present in global_rules.md',
  );

  // Post-install: project dir exists with 10 files
  const installed = (await readdir(detection.paths.project)).sort();
  assert.equal(installed.length, 10, 'project half must materialise 10 .md files');
  for (const f of installed) {
    assert.ok(f.endsWith('.md'), 'each installed file is .md');
  }

  // Round-trip: uninstall removes both
  const uninstallRes = await windsurf.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  assert.ok(uninstallRes.removed.length >= 1,
    'mixed-mode uninstall must record at least one removed path');

  // Project half: 10x-engineer/ directory removed
  assert.equal(existsSync(detection.paths.project), false,
    'post-uninstall: 10x-engineer/ install dir must be removed');

  // .windsurf/rules/ contents: EXACTLY the user-owned sibling
  const rulesDirContents = (await readdir(siblingDir)).sort();
  assert.deepEqual(rulesDirContents, ['user-owned.md'],
    'post-uninstall .windsurf/rules/ contains only the user-owned sibling — surgical removal');

  // User-owned sibling: byte-identical (content + mtime)
  const siblingBodyAfter = await readFile(siblingPath, 'utf8');
  assert.equal(siblingBodyAfter, siblingBody);
  const siblingStatAfter = await stat(siblingPath);
  assert.equal(siblingStatAfter.mtimeMs, siblingStatBefore.mtimeMs,
    'post-uninstall: user-owned sibling mtime must be unchanged');

  // Global half: byte-identical content surrounding the (now-stripped) block
  await assertByteIdenticalAroundMarker(detection.paths.global, original);
});

test('windsurf uninstall scope=both — global_rules.md content surrounding stripped block is byte-identical', async (t) => {
  const original = '# my notes\n\nimportant context for cascade\n';
  const env = await makeEnv(t, {
    withCodeium: true,
    withWindsurfDir: true,
    globalRulesContent: original,
  });
  const skills = await loadSkills();
  const detection = await windsurf.detect(env);

  await windsurf.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await windsurf.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  // global_rules.md: byte-identical around the (now-absent) marker block.
  await assertByteIdenticalAroundMarker(detection.paths.global, original);
});

test('windsurf install global half — pre-seeded global_rules.md with NO trailing newline survives byte-identically (Pitfall 12)', async (t) => {
  // No trailing newline on user content — the bounded `\n` artefact path.
  const original = '# user content\nno trailing newline here';
  const env = await makeEnv(t, {
    withCodeium: true,
    globalRulesContent: original,
  });
  const skills = await loadSkills();
  const detection = await windsurf.detect(env);
  assert.equal(detection.scope, 'global');

  await windsurf.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  // Marker block was inserted; user content survives byte-identically up to
  // the bounded `\n` artefact (handled by assertByteIdenticalAroundMarker).
  await assertByteIdenticalAroundMarker(detection.paths.global, original);

  await windsurf.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  await assertByteIdenticalAroundMarker(detection.paths.global, original);
});

test('windsurf install global half — CRLF user content preserved across round-trip', async (t) => {
  // CRLF line endings — markers.js BLOCK_RE uses \r?\n and safe-fs reports
  // originalEol; user content must survive intact.
  const originalCRLF = '# user content\r\nfirst line\r\n\r\nlast line\r\n';
  const env = await makeEnv(t, {
    withCodeium: true,
    globalRulesContent: originalCRLF,
  });
  const skills = await loadSkills();
  const detection = await windsurf.detect(env);

  await windsurf.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });

  // CRLF user content survives byte-identically before the marker
  const afterInstall = await readFile(detection.paths.global, 'utf8');
  const beginIdx = afterInstall.indexOf('<!-- BEGIN 10x-engineer');
  assert.ok(beginIdx > 0, 'marker block must be present');
  const beforeBlock = afterInstall.slice(0, beginIdx);
  // Allow the bounded \n artefact: original may match exactly, or with one synthesised \n.
  assert.ok(
    beforeBlock === originalCRLF
      || beforeBlock === originalCRLF + '\n'
      || originalCRLF.startsWith(beforeBlock),
    'CRLF user content must survive byte-identically before the marker',
  );

  await windsurf.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  await assertByteIdenticalAroundMarker(detection.paths.global, originalCRLF);
});

test('windsurf install is idempotent: re-running produces stable file content (no duplicate block, no duplicate per-file copies)', async (t) => {
  const env = await makeEnv(t, {
    withCodeium: true,
    withWindsurfDir: true,
    globalRulesContent: '# original notes\n',
  });
  const skills = await loadSkills();
  const detection = await windsurf.detect(env);

  await windsurf.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const globalFirst = await readFile(detection.paths.global, 'utf8');
  const projectFirst = (await readdir(detection.paths.project)).sort();

  await windsurf.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  const globalSecond = await readFile(detection.paths.global, 'utf8');
  const projectSecond = (await readdir(detection.paths.project)).sort();

  assert.equal(globalSecond, globalFirst,
    're-running install must replace the marker block in place (no duplication)');
  assert.deepEqual(projectSecond, projectFirst,
    're-running install must not duplicate per-file copies');
  assert.equal(projectSecond.length, 10);
});

test('windsurf dryRun: true — global_rules.md mtime unchanged AND .windsurf/rules/10x-engineer/ does not come into existence', async (t) => {
  const env = await makeEnv(t, {
    withCodeium: true,
    withWindsurfDir: true,
    globalRulesContent: '# pre-existing notes\n',
  });
  const skills = await loadSkills();
  const detection = await windsurf.detect(env);
  assert.equal(detection.scope, 'both');

  // Pre-existing global_rules.md → mtime is checkable
  const globalBefore = await stat(detection.paths.global);

  // Project dir does NOT exist pre-test
  assert.equal(existsSync(detection.paths.project), false,
    'pre-test sanity: project install dir must not exist yet');

  const r = await windsurf.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: true, version: '0.1.0',
  });
  assert.equal(r.written.length, 11,
    'written array must record would-be paths even on dryRun');

  // Global mtime unchanged
  const globalAfter = await stat(detection.paths.global);
  assert.equal(globalBefore.mtimeMs, globalAfter.mtimeMs,
    'global_rules.md mtime must be unchanged on dryRun');

  // Global content unchanged
  const afterContent = await readFile(detection.paths.global, 'utf8');
  assert.equal(afterContent, '# pre-existing notes\n');

  // Project install dir still absent
  assert.equal(existsSync(detection.paths.project), false,
    'dryRun:true must NOT create .windsurf/rules/10x-engineer/');
});

test('windsurf Pitfall 5: .windsurfrules legacy file is NEVER touched (detect-only)', async (t) => {
  // Legacy file present + global signal present so install runs in scope=both.
  // Adapter must never read or write .windsurfrules itself; the file is
  // purely a detection signal for legacy installs.
  const rulesContent = '# my legacy windsurf rules\n\nstuff i wrote\n';
  const env = await makeEnv(t, {
    withCodeium: true,
    withWindsurfrulesFile: true,
    windsurfrulesContent: rulesContent,
  });
  const legacyPath = join(env.cwd, '.windsurfrules');
  const before = await readFile(legacyPath, 'utf8');
  const beforeMtime = (await stat(legacyPath)).mtimeMs;

  const skills = await loadSkills();
  const detection = await windsurf.detect(env);
  assert.equal(detection.scope, 'both');

  await windsurf.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });
  await windsurf.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  const after = await readFile(legacyPath, 'utf8');
  assert.equal(after, before,
    'Pitfall 5 violation: .windsurfrules content changed (must be detect-only)');
  const afterMtime = (await stat(legacyPath)).mtimeMs;
  assert.equal(afterMtime, beforeMtime,
    'Pitfall 5 violation: .windsurfrules mtime changed (file was touched)');
});

test('windsurf Pitfall 12: global_rules.md NEVER markerless-overwritten — pre-seeded user content survives byte-identically around marker', async (t) => {
  // Regression: confirm the global half uses replaceBlock (not writeFile) so a
  // pre-existing user file is never clobbered. Pre-seed substantial user
  // content above and below; install; assert all of it survives around the
  // inserted marker block, byte-for-byte.
  const userBefore =
    '# my windsurf cascade memories\n' +
    '\n' +
    '## context: project conventions\n' +
    'always use snake_case for db columns\n' +
    'never push directly to main\n' +
    '\n' +
    '## context: stack\n' +
    'node 20, postgres 16, react 18\n';
  const env = await makeEnv(t, {
    withCodeium: true,
    globalRulesContent: userBefore,
  });
  const skills = await loadSkills();
  const detection = await windsurf.detect(env);

  await windsurf.install({
    skills, scope: detection.scope, paths: detection.paths,
    dryRun: false, version: '0.1.0',
  });

  const afterInstall = await readFile(detection.paths.global, 'utf8');
  // The user content must survive verbatim; only the marker block is added.
  assert.ok(afterInstall.includes('# my windsurf cascade memories'),
    'Pitfall 12 violation: user heading lost');
  assert.ok(afterInstall.includes('always use snake_case for db columns'),
    'Pitfall 12 violation: user content line 1 lost');
  assert.ok(afterInstall.includes('node 20, postgres 16, react 18'),
    'Pitfall 12 violation: user content tail lost');
  assert.ok(afterInstall.includes('<!-- BEGIN 10x-engineer'),
    'marker block must be present');

  // Byte-identity around the marker.
  await assertByteIdenticalAroundMarker(detection.paths.global, userBefore);

  // And after uninstall, byte-identity (mode 2 — no marker) still holds.
  await windsurf.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });
  await assertByteIdenticalAroundMarker(detection.paths.global, userBefore);
});
