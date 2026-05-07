// test/frontmatter.test.js — unit tests for lib/frontmatter.js.
//
// D2-30 lockdown: the parser must accept every one of the 10 real
// Phase 1 skill files in skills/*.md without throwing. The skills are LOCKED.
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

const here = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(here, '..', 'skills');

test('parser accepts every Phase 1 skill file (D2-30 lockdown)', async () => {
  const files = (await readdir(skillsDir)).filter(f => f.endsWith('.md'));
  assert.equal(files.length, 10, 'expected exactly 10 skill files');
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
