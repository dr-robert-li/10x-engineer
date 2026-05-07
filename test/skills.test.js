// test/skills.test.js — unit tests for lib/skills.js.
//
// loadSkills() is the input-side of every format transform. The shape and
// the count are LOCKED against the 10 Phase 1 skill files (D2-30).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSkills } from '../lib/skills.js';

test('loadSkills returns 10 canonical entries', async () => {
  const skills = await loadSkills();
  assert.equal(skills.length, 10, 'expected exactly 10 skills (Phase 1 lockdown)');
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

test('skill.id equals skill.name for every Phase 1 skill', async () => {
  // The Phase 1 lockdown is that filename basename = frontmatter `name`.
  // If this test ever fails, EITHER the skill's frontmatter `name` was changed
  // (Phase 1 contract violation — revert) OR a new skill was added without
  // matching its filename (fix the new skill).
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
