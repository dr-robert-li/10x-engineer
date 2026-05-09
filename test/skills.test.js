// test/skills.test.js — unit tests for lib/skills.js.
//
// loadSkills() is the input-side of every format transform. The shape is
// LOCKED (D2-30). After the Phase 7 partition, loadSkills() returns ONLY
// the response-mode set (filenames that do NOT start with `build-`); the
// build-mode set has its own loader (loadBuildModeSkills) covered by
// test/skills-loader-build-mode.test.js. The response-mode count stays
// at 10 across v1.0 — adding build-mode files does not move this floor.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSkills } from '../lib/skills.js';

test('loadSkills returns exactly the 10 response-mode canonical entries', async () => {
  const skills = await loadSkills();
  assert.equal(skills.length, 10, `expected exactly 10 response-mode skills, got ${skills.length}`);
  // No build-mode skill leaks through. `build-system-from-scratch` is the
  // Phase 1 response-mode skill whose filename collides with the build-*
  // prefix; it stays in the response-mode set.
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

test('every skill has the canonical shape', async () => {
  const skills = await loadSkills();
  for (const s of skills) {
    assert.ok(typeof s.id === 'string' && s.id.length > 0,           `${s.id || '(unknown)'}: missing id`);
    assert.ok(typeof s.name === 'string' && s.name.length > 0,        `${s.id}: missing name`);
    assert.ok(typeof s.description === 'string' && s.description.length > 0, `${s.id}: missing description`);
    assert.ok(typeof s.when_to_use === 'string' && s.when_to_use.length > 0, `${s.id}: missing when_to_use`);
    assert.ok(typeof s.body === 'string' && s.body.length > 100,      `${s.id}: body too short`);
    assert.ok(s.data && typeof s.data === 'object',                   `${s.id}: missing data alias`);
    assert.ok(s.frontmatter && typeof s.frontmatter === 'object',     `${s.id}: missing frontmatter alias`);
  }
});

test('skill.id equals skill.name for every shipped skill', async () => {
  // The lockdown is that filename basename = frontmatter `name`.
  // If this test ever fails, EITHER the skill's frontmatter `name` was changed
  // (contract violation — revert) OR a new skill was added without matching
  // its filename (fix the new skill).
  const skills = await loadSkills();
  for (const s of skills) {
    assert.equal(s.id, s.name, `id (${s.id}) must equal name (${s.name})`);
  }
});

test('skills are returned in stable alphabetical order', async () => {
  const skills = await loadSkills();
  const ids = skills.map(s => s.id);
  const sorted = [...ids].sort();
  assert.deepEqual(ids, sorted, 'expected loadSkills() to return alphabetically sorted entries');
});

test('data and frontmatter aliases are the same object', async () => {
  const skills = await loadSkills();
  assert.equal(skills[0].data, skills[0].frontmatter,
    'data and frontmatter must be the same reference (alias)');
});
