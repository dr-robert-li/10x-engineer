// test/frontmatter.test.js — unit tests for lib/frontmatter.js.
//
// D2-30 lockdown: the parser must accept every real skill file in
// skills/*.md without throwing. Phase 1 shipped 10 skills; Phase 7 added
// the build-mode voice anchor (build-mode-overview.md); Phase 8 added
// 12 child build-* files (one per response-mode skill plus a project-tree
// template); Phase 9 added 3 docs-generator build-* files (DOCS-01..03).
// The lockdown is structural (every skill parses, every key present, body
// substantive) — the count floor is computed dynamically from
// `loadSkills().length + loadBuildModeSkills().length` so future
// milestones automatically pick up the same invariant.
// If the parser rejects a real skill, the parser is wrong (not the skill).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFrontmatter,
  stringifyFrontmatter,
  FrontmatterParseError,
} from '../lib/frontmatter.js';
import { loadSkills, loadBuildModeSkills } from '../lib/skills.js';

const here = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(here, '..', 'skills');

test('parser accepts every shipped skill file (D2-30 lockdown)', async () => {
  const files = (await readdir(skillsDir)).filter(f => f.endsWith('.md'));
  // Floor is computed from the loader partitions rather than a hand-bumped
  // literal: response-mode skills + build-mode skills sum to the expected
  // floor. Catches removal (count drops below the partition sum), never
  // falsely fails when adding files (loaders pick the new file up too).
  const [responseSkills, buildSkills] = await Promise.all([loadSkills(), loadBuildModeSkills()]);
  const expectedFloor = responseSkills.length + buildSkills.length;
  assert.ok(files.length >= expectedFloor,
    `expected >= ${expectedFloor} skill files (loadSkills ${responseSkills.length} + loadBuildModeSkills ${buildSkills.length}), got ${files.length}`);
  for (const file of files) {
    const src = await readFile(join(skillsDir, file), 'utf8');
    const { data, body } = parseFrontmatter(src);
    assert.ok(data.name,         `${file}: missing name`);
    assert.ok(data.description,  `${file}: missing description`);
    assert.ok(data.when_to_use,  `${file}: missing when_to_use`);
    assert.ok(body.length > 100, `${file}: body too short`);
  }
});

test('parser rejects missing fence', () => {
  assert.throws(() => parseFrontmatter('no frontmatter here'), FrontmatterParseError);
});

test('parser rejects unknown keys', () => {
  const src = '---\nname: x\ndescription: y\nwhen_to_use: z\nextra: bad\n---\nbody\n';
  assert.throws(() => parseFrontmatter(src), /unknown frontmatter key: extra/);
});

test('parser rejects missing required keys', () => {
  const src = '---\nname: x\ndescription: y\n---\nbody\n';
  assert.throws(() => parseFrontmatter(src), /missing required key: when_to_use/);
});

test('parser rejects duplicate keys', () => {
  const src = '---\nname: x\nname: y\ndescription: z\nwhen_to_use: a\n---\nbody\n';
  assert.throws(() => parseFrontmatter(src), /duplicate frontmatter key: name/);
});

test('parser rejects flow-style values', () => {
  const src = '---\nname: x\ndescription: [arr]\nwhen_to_use: z\n---\nbody\n';
  assert.throws(() => parseFrontmatter(src), /flow-style values not supported/);
});

test('parser handles CRLF fences', () => {
  const src = '---\r\nname: x\r\ndescription: y\r\nwhen_to_use: z\r\n---\r\nbody\r\n';
  const { data, body } = parseFrontmatter(src);
  assert.equal(data.name, 'x');
  assert.ok(body.startsWith('body'));
});

test('stringifyFrontmatter round-trips canonical shape', () => {
  const src = '---\nname: x\ndescription: y\nwhen_to_use: z\n---\nbody content\nmore\n';
  const { data, body } = parseFrontmatter(src);
  const round = stringifyFrontmatter(data, body);
  const reparsed = parseFrontmatter(round);
  assert.deepEqual(reparsed.data, data);
  assert.equal(reparsed.body, body);
});
