// test/format-mdc.test.js
//
// FMT-02 unit tests. Pins the vendor-canonical three-key frontmatter shape
// (description, globs, alwaysApply), the YAML escape rules for hostile
// characters, and verbatim body preservation. Per Plan 03-01 Task 1.
//
// Synthetic skill fixtures only. The transform is pure; coupling these tests
// to the live skills/*.md content would re-test FND-08 instead of FMT-02.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from '../lib/format/mdc.js';

function makeSkill(overrides = {}) {
  return {
    id: 'demo',
    name: 'Demo',
    description: 'a normal description',
    when_to_use: 'always',
    body: '# body\nverbatim\n',
    ...overrides,
  };
}

test('mdc: emits one output per skill, every relativePath ends with .mdc', () => {
  const skills = [
    makeSkill({ id: 'a' }),
    makeSkill({ id: 'b' }),
    makeSkill({ id: 'c' }),
  ];
  const out = transform(skills);
  assert.equal(out.length, 3);
  for (const r of out) {
    assert.match(r.relativePath, /\.mdc$/, `expected .mdc extension, got ${r.relativePath}`);
  }
  assert.equal(out[0].relativePath, 'a.mdc');
  assert.equal(out[1].relativePath, 'b.mdc');
  assert.equal(out[2].relativePath, 'c.mdc');
});

test('mdc: frontmatter has description, globs, alwaysApply in exact key order', () => {
  const [out] = transform([makeSkill({ description: 'hello world' })]);
  // The three-key block is the first frontmatter section; key order is fixed.
  const expected =
    '---\n' +
    'description: hello world\n' +
    'globs: ["**/*"]\n' +
    'alwaysApply: true\n' +
    '---\n';
  assert.ok(
    out.content.startsWith(expected),
    `expected content to start with canonical frontmatter; got: ${JSON.stringify(out.content.slice(0, 120))}`,
  );
});

test('mdc: globs is the YAML list form ["**/*"], not the bare scalar **/*', () => {
  const [out] = transform([makeSkill()]);
  // The list form is the documented canonical shape; the scalar form would be
  // valid YAML but is not what FMT-02 emits.
  assert.match(out.content, /^globs: \["\*\*\/\*"\]$/m);
  // And there must be no bare-scalar globs line.
  assert.doesNotMatch(out.content, /^globs: \*\*\/\*$/m);
});

test('mdc: alwaysApply value is bare true, not the string "true"', () => {
  const [out] = transform([makeSkill()]);
  assert.match(out.content, /^alwaysApply: true$/m);
  assert.doesNotMatch(out.content, /^alwaysApply: "true"$/m);
});

test('mdc: post-frontmatter body equals skill.body byte-for-byte', () => {
  const trickyBody = '# Has $1 and $& and `code` and \\n literally\nline two\n';
  const [out] = transform([makeSkill({ body: trickyBody })]);
  assert.ok(
    out.content.endsWith(trickyBody),
    `expected content to end with verbatim body; got: ${JSON.stringify(out.content.slice(-80))}`,
  );
  // Stronger: the body slice immediately after the second `---\n` is === trickyBody
  const closingIdx = out.content.indexOf('---\n', 4); // skip opening fence
  const bodySlice = out.content.slice(closingIdx + '---\n'.length);
  assert.equal(bodySlice, trickyBody);
});

test('mdc: description containing " is YAML-escaped to a quoted scalar', () => {
  const [out] = transform([makeSkill({ description: 'She said "hello"' })]);
  assert.match(out.content, /^description: "She said \\"hello\\""$/m);
});

test('mdc: description containing : is wrapped in a quoted scalar', () => {
  // A colon-containing description would otherwise be parsed as a YAML mapping
  // key (`ratio: 1:2` → key `ratio`, value `1:2`) — quote the whole scalar.
  const [out] = transform([makeSkill({ description: 'ratio: 1:2' })]);
  assert.match(out.content, /^description: "ratio: 1:2"$/m);
});

test('mdc: emitted frontmatter has EXACTLY three keys (not four)', () => {
  // Guard against the brief drift that mentioned "four frontmatter keys" —
  // vendor-canonical is three.
  const [out] = transform([makeSkill()]);
  // Slice between the opening `---\n` and the closing `---\n`.
  const sections = out.content.split('---\n');
  // sections[0] = '' (before opening fence), sections[1] = frontmatter, sections[2] = body
  assert.ok(sections.length >= 3, 'expected at least one full frontmatter block');
  const fm = sections[1];
  const keyLines = fm.split('\n').filter((l) => /^[a-zA-Z]/.test(l));
  assert.equal(
    keyLines.length, 3,
    `mdc frontmatter must have exactly three keys; got ${keyLines.length}: ${JSON.stringify(keyLines)}`,
  );
});
