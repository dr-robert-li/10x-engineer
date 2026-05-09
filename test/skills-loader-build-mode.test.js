// test/skills-loader-build-mode.test.js
//
// Phase 7 BUILD-02: locks the partition + ordering invariants for the two
// skill loaders introduced in lib/skills.js. The orchestrator (lib/install.js)
// calls loadSkills(); the persona-builder helper (Plan 05) calls
// loadBuildModeSkills(). The two consumers must never receive the same skill
// twice, and the overview must come first in the build-mode array.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSkills, loadBuildModeSkills } from '../lib/skills.js';

test('loadSkills returns exactly the 10 response-mode skills, no build-mode leakage', async () => {
  const skills = await loadSkills();
  assert.equal(skills.length, 10, `expected 10 response-mode skills, got ${skills.length}`);
  // build-system-from-scratch.md (Phase 1) is the legitimate response-mode
  // file whose name happens to start with `build-`. Anything else starting
  // with `build-` would be a build-mode leak.
  const RESPONSE_MODE_PREFIX_COLLISIONS = new Set(['build-system-from-scratch']);
  for (const s of skills) {
    if (s.id.startsWith('build-')) {
      assert.ok(
        RESPONSE_MODE_PREFIX_COLLISIONS.has(s.id),
        `loadSkills leaked unexpected build-mode skill: ${s.id}`,
      );
    }
  }
});

test('loadBuildModeSkills returns at least the overview after Plan 01', async () => {
  const skills = await loadBuildModeSkills();
  assert.ok(skills.length >= 1, `expected >= 1 build-mode skill, got ${skills.length}`);
});

test('loadBuildModeSkills returns build-mode-overview FIRST', async () => {
  const skills = await loadBuildModeSkills();
  assert.equal(
    skills[0].id,
    'build-mode-overview',
    `expected build-mode-overview first, got ${skills[0]?.id}`,
  );
});

test('loadBuildModeSkills entries all have ids starting with "build-"', async () => {
  const skills = await loadBuildModeSkills();
  for (const s of skills) {
    assert.ok(
      s.id.startsWith('build-'),
      `build-mode loader returned non-build skill: ${s.id}`,
    );
  }
});

test('loadBuildModeSkills entries match canonical shape', async () => {
  const skills = await loadBuildModeSkills();
  for (const s of skills) {
    assert.equal(typeof s.id, 'string');
    assert.equal(typeof s.name, 'string');
    assert.equal(typeof s.description, 'string');
    assert.equal(typeof s.when_to_use, 'string');
    assert.equal(typeof s.body, 'string');
    assert.ok(s.body.length > 0, `body empty for ${s.id}`);
    assert.ok(s.data && typeof s.data === 'object');
    assert.ok(s.frontmatter && typeof s.frontmatter === 'object');
    assert.equal(s.data, s.frontmatter, 'data and frontmatter must alias the same object');
  }
});

test('loadSkills ∩ loadBuildModeSkills = ∅ (disjoint partition)', async () => {
  const [response, build] = await Promise.all([loadSkills(), loadBuildModeSkills()]);
  const responseIds = new Set(response.map((s) => s.id));
  const overlap = build.filter((s) => responseIds.has(s.id));
  assert.deepEqual(overlap, [], `partition leaked: ${overlap.map((s) => s.id).join(', ')}`);
});

test('build-mode-overview body smoke check (loader + parseFrontmatter wired)', async () => {
  const skills = await loadBuildModeSkills();
  const overview = skills.find((s) => s.id === 'build-mode-overview');
  assert.ok(overview, 'build-mode-overview must be present');
  assert.ok(
    overview.body.includes('## The Build-Mode Catalogue'),
    'overview body must contain catalogue heading (smoke test that the read pipeline returned the post-frontmatter body)',
  );
});

test('build-system-from-scratch (Phase 1 response-mode) is NOT classified as build-mode', async () => {
  // Regression lock: the simple `f.startsWith("build-")` predicate would
  // misclassify the Phase 1 response-mode file `build-system-from-scratch.md`
  // as build-mode. The loader uses an explicit RESPONSE_MODE_PREFIX_COLLISIONS
  // exception set; this test guarantees the exception stays wired up.
  const [response, build] = await Promise.all([loadSkills(), loadBuildModeSkills()]);
  assert.ok(
    response.some((s) => s.id === 'build-system-from-scratch'),
    'build-system-from-scratch must be in the response-mode set',
  );
  assert.ok(
    !build.some((s) => s.id === 'build-system-from-scratch'),
    'build-system-from-scratch must NOT leak into the build-mode set',
  );
});
