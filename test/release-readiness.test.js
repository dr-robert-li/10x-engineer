// test/release-readiness.test.js — REL-13 phase-level round-trip gate.
//
// For every active adapter (hosted-fallback excluded — never writes), seed
// a fixture that triggers detection, run install + uninstall, and assert
// the round-trip is surgical: every leaf file we wrote is gone, every
// pre-existing path persists with byte-identical content, no marker block
// survives, and any extra path is an empty parent directory we created via
// mkdir -p (ROADMAP cross-phase invariant 4 — never delete user-shared
// parents).
//
// Per-adapter test files own the per-adapter edge cases (BOM, CRLF, legacy
// markers, idempotency, partial overlap). This file proves the headline
// contract across the whole registry as a release gate. Project scope only
// — global / 'both' scope variants are pinned in per-adapter tests.
//
// PATH neutralisation is mandatory: aider, codex, gemini probe
// commandExists; a developer-machine binary would leak detection into
// otherwise filesystem-empty fixtures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import adapters from '../lib/adapters/index.js';
import { loadSkills } from '../lib/skills.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stash PATH for the duration of a test so commandExists() returns false
 *  for every adapter that probes a binary. Restored in t.after(). */
function neutralisePath(t, root) {
  const original = process.env.PATH;
  process.env.PATH = root;
  t.after(() => { process.env.PATH = original; });
}

/** Walk a directory recursively, returning a map of relPath → '<dir>' or
 *  file content (utf8). Missing roots return an empty map. */
async function snapshotTree(rootDir) {
  const tree = {};
  async function walk(dir, prefix) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (e) {
      if (e.code === 'ENOENT') return;
      throw e;
    }
    for (const ent of entries) {
      const childPath = join(dir, ent.name);
      const relPath = prefix ? join(prefix, ent.name) : ent.name;
      if (ent.isDirectory()) {
        tree[relPath] = '<dir>';
        await walk(childPath, relPath);
      } else if (ent.isFile()) {
        tree[relPath] = await readFile(childPath, 'utf8');
      }
    }
  }
  await walk(rootDir, '');
  return tree;
}

/** Synthesise a minimal detection-trigger for a given adapter. Project scope
 *  only — every adapter takes homedir + cwd as parameters (D2-24). The seed
 *  is the documented filesystem signal for each adapter; codex's AGENTS.md
 *  is seeded with one user-owned line so stripBlock's delete-if-empty path
 *  doesn't fire and remove the file entirely (correct behaviour but
 *  inconvenient for the surgical-removal assertion). */
async function synthFixture(adapter, tmpRoot) {
  const homedir = join(tmpRoot, 'home');
  const cwd = join(tmpRoot, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });

  const mk = (rel) => mkdir(join(cwd, rel), { recursive: true });
  const mkH = (...rels) => mkdir(join(homedir, ...rels), { recursive: true });

  switch (adapter.id) {
    case 'aider':         await writeFile(join(cwd, '.aider.conf.yml'), ''); break;
    case 'claude-code':   await mk('.claude'); break;
    case 'cline':         await mk('.clinerules'); break;
    case 'codex':         await writeFile(join(cwd, 'AGENTS.md'), '# project conventions\n'); break;
    case 'continue':      await mk('.continue'); break;
    case 'cursor':        await mk('.cursor'); break;
    case 'gemini':        await mk('.gemini'); break;
    case 'hermes-agent':  await mkH('.hermes'); break;
    case 'kilo-code':     await mk('.kilocode'); break;
    case 'opencode':      await mkH('.config', 'opencode'); break;
    case 'roo-code':      await mk('.roo'); break;
    case 'hosted-fallback': break; // never writes; skipped in caller
    default: throw new Error(`No fixture synth for adapter id: ${adapter.id}`);
  }

  return { homedir, cwd };
}

// ---------------------------------------------------------------------------
// Tests — one subtest per active adapter (hosted-fallback excluded)
// ---------------------------------------------------------------------------

const skills = await loadSkills();

for (const adapter of adapters) {
  if (adapter.id === 'hosted-fallback') continue; // never writes; skip

  test(`release-readiness: ${adapter.id} — install→uninstall byte-identical round-trip`, async (t) => {
    const tmpRoot = await mkdtemp(join(tmpdir(), `release-${adapter.id}-`));
    t.after(() => rm(tmpRoot, { recursive: true, force: true }));
    neutralisePath(t, tmpRoot);

    const { homedir, cwd } = await synthFixture(adapter, tmpRoot);

    const preHome = await snapshotTree(homedir);
    const preCwd  = await snapshotTree(cwd);

    const detection = await adapter.detect({ cwd, homedir });
    assert.equal(detection.found, true,
      `synthFixture for ${adapter.id} must trigger detection`);

    const installResult = await adapter.install({
      skills, scope: detection.scope, paths: detection.paths,
      dryRun: false, version: '0.1.0',
    });
    assert.ok(Array.isArray(installResult.written),
      `${adapter.id}.install must return { written: [] }`);

    const uninstallResult = await adapter.uninstall({
      scope: detection.scope, paths: detection.paths, dryRun: false,
    });
    assert.ok(Array.isArray(uninstallResult.removed),
      `${adapter.id}.uninstall must return { removed: [] }`);

    const postHome = await snapshotTree(homedir);
    const postCwd  = await snapshotTree(cwd);

    // No marker block in any post-uninstall file (catches scrub bugs early).
    for (const tree of [postHome, postCwd]) {
      for (const [p, content] of Object.entries(tree)) {
        if (content === '<dir>') continue;
        assert.equal(/BEGIN 10x-engineer/.test(content), false,
          `${adapter.id}: post-uninstall ${p} still contains marker block`);
      }
    }

    // Surgical-removal contract (ROADMAP cross-phase invariant 4): post ⊇ pre
    // IFF every extra path is an empty directory we created during install.
    // (a) every pre-existing path persists, (b) pre-existing file content
    // unchanged, (c) any extra path is a dir (no leaked leaf files).
    const assertSurgical = (pre, post, label) => {
      for (const p of Object.keys(pre)) {
        assert.ok(Object.prototype.hasOwnProperty.call(post, p),
          `${adapter.id}: ${label}/${p} disappeared after round-trip`);
        if (pre[p] === '<dir>') continue;
        assert.equal(post[p], pre[p],
          `${adapter.id}: ${label}/${p} content drift after round-trip`);
      }
      const prePaths = new Set(Object.keys(pre));
      for (const p of Object.keys(post)) {
        if (prePaths.has(p)) continue;
        assert.equal(post[p], '<dir>',
          `${adapter.id}: ${label}/${p} survived as file (expected dir or absent)`);
      }
    };
    assertSurgical(preHome, postHome, 'home');
    assertSurgical(preCwd,  postCwd,  'cwd');
  });
}

// ---------------------------------------------------------------------------
// HOOK-09 carve-out: settings.json / hooks.json content-equal round-trip.
//
// REL-13 (Phase 5) asserts byte-identical round-trip on marker-bounded
// append-mode files. Phase 6 introduces structured-edit JSON config files
// (settings.json, hooks.json) where byte-identity is impossible — JSON.parse
// + JSON.stringify always re-serializes. The Phase 6 contract is weaker:
// foreign entries survive CONTENT-EQUAL. This test pins that contract.
// ---------------------------------------------------------------------------

import claudeCodeAdapter from '../lib/adapters/claude-code.js';
import codexAdapter from '../lib/adapters/codex.js';

test('release-readiness HOOK-09: claude-code settings.json content-equal round-trip with foreign entry', async (t) => {
  const tmpRoot = await mkdtemp(join(tmpdir(), 'release-cc-hook-'));
  t.after(() => rm(tmpRoot, { recursive: true, force: true }));
  neutralisePath(t, tmpRoot);

  const homedir = join(tmpRoot, 'home');
  const cwd = join(tmpRoot, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  await mkdir(join(homedir, '.claude'), { recursive: true });

  // Pre-seed settings.json with a foreign hook entry + a foreign top-level key.
  const settingsPath = join(homedir, '.claude/settings.json');
  const foreign = {
    hooks: {
      SessionStart: [
        { hooks: [{ type: 'command', command: 'node /opt/foreign-tool/start.js', timeout: 10 }] },
      ],
    },
    other_user_setting: { keep: 'me', nested: { array: [1, 2, 3] } },
  };
  await writeFile(settingsPath, JSON.stringify(foreign, null, 2) + '\n');

  const detection = await claudeCodeAdapter.detect({ cwd, homedir });
  await claudeCodeAdapter.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.3.0',
  });
  await claudeCodeAdapter.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  // settings.json may persist; foreign content must survive content-equal.
  const post = JSON.parse(await readFile(settingsPath, 'utf8'));
  // Foreign hook entry survives
  assert.equal(post.hooks.SessionStart.length, 1,
    'foreign SessionStart entry must survive uninstall');
  assert.match(post.hooks.SessionStart[0].hooks[0].command, /foreign-tool/);
  // Foreign top-level key survives by content (deep-equal)
  assert.deepEqual(post.other_user_setting, foreign.other_user_setting,
    'foreign top-level keys must survive content-equal');
});

test('release-readiness HOOK-09: codex hooks.json content-equal round-trip with foreign entry', async (t) => {
  const tmpRoot = await mkdtemp(join(tmpdir(), 'release-codex-hook-'));
  t.after(() => rm(tmpRoot, { recursive: true, force: true }));
  neutralisePath(t, tmpRoot);

  const homedir = join(tmpRoot, 'home');
  const cwd = join(tmpRoot, 'project');
  await mkdir(homedir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  await mkdir(join(homedir, '.codex'), { recursive: true });

  const hooksJsonPath = join(homedir, '.codex/hooks.json');
  const foreign = {
    hooks: {
      UserPromptSubmit: [
        { hooks: [{ type: 'command', command: 'node /opt/some-tool/anchor.js', timeout: 5 }] },
      ],
    },
    foreign_codex_setting: 'survive me',
  };
  await writeFile(hooksJsonPath, JSON.stringify(foreign, null, 2) + '\n');

  const detection = await codexAdapter.detect({ cwd, homedir });
  await codexAdapter.install({
    skills, scope: detection.scope, paths: detection.paths, dryRun: false, version: '0.3.0',
  });
  await codexAdapter.uninstall({
    scope: detection.scope, paths: detection.paths, dryRun: false,
  });

  const post = JSON.parse(await readFile(hooksJsonPath, 'utf8'));
  assert.equal(post.hooks.UserPromptSubmit.length, 1,
    'foreign UserPromptSubmit entry must survive uninstall');
  assert.match(post.hooks.UserPromptSubmit[0].hooks[0].command, /some-tool/);
  assert.equal(post.foreign_codex_setting, 'survive me');
});
