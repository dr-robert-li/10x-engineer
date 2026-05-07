// test/format-yaml-config-md.test.js
//
// Pins the seven sanctioned shapes of FMT-05's mergeReadEntry plus the
// CONVENTIONS.md transform behaviour. Each `mergeReadEntry` test below maps
// to one row of the §Aider yaml-config+md Whitelist table.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  transform,
  mergeReadEntry,
  UnsupportedConfigShapeError,
} from '../lib/format/yaml-config+md.js';

function makeSkill(id, name = id) {
  return {
    id,
    name,
    description: `desc for ${id}`,
    when_to_use: `when ${id}`,
    body: `# ${id}\n\nbody for ${id}\n`,
  };
}

// --- transform ---------------------------------------------------------

test('transform returns one entry whose relativePath is CONVENTIONS.md', () => {
  const out = transform([makeSkill('a'), makeSkill('b')]);
  assert.equal(out.length, 1);
  assert.equal(out[0].relativePath, 'CONVENTIONS.md');
});

test('transform content begins with `# 10x-engineer conventions`', () => {
  const out = transform([makeSkill('a')]);
  assert.ok(out[0].content.startsWith('# 10x-engineer conventions'));
});

test('transform header includes (vX.Y.Z) when version supplied', () => {
  const out = transform([makeSkill('a')], '1.2.3');
  assert.ok(out[0].content.startsWith('# 10x-engineer conventions (v1.2.3)'));
});

test('transform omits version parens when version is absent', () => {
  const out = transform([makeSkill('a')]);
  assert.ok(!out[0].content.startsWith('# 10x-engineer conventions ('));
});

test('transform body contains every skill name and description', () => {
  const out = transform([makeSkill('a'), makeSkill('b')]);
  assert.ok(out[0].content.includes('## a'));
  assert.ok(out[0].content.includes('> desc for a'));
  assert.ok(out[0].content.includes('## b'));
  assert.ok(out[0].content.includes('> desc for b'));
});

test('transform is pure: same input twice -> deeply equal output', () => {
  const inputs = [makeSkill('p'), makeSkill('q')];
  assert.deepEqual(transform(inputs), transform(inputs));
});

// --- mergeReadEntry: case 1 (empty / missing) --------------------------

test('case 1 empty string: emits read: with conventions path', () => {
  assert.equal(
    mergeReadEntry('', 'CONVENTIONS.md'),
    'read:\n  - CONVENTIONS.md\n',
  );
});

test('case 1 whitespace-only string: same as empty', () => {
  assert.equal(
    mergeReadEntry('   \n\n  ', 'CONVENTIONS.md'),
    'read:\n  - CONVENTIONS.md\n',
  );
});

// --- mergeReadEntry: case 2 (no read: key) -----------------------------

test('case 2 no read: key: appends read: block, preserves original lines', () => {
  const out = mergeReadEntry('model: gpt-4\n', 'CONVENTIONS.md');
  assert.ok(out.includes('model: gpt-4'), 'original key preserved');
  assert.ok(out.endsWith('read:\n  - CONVENTIONS.md\n'), 'read: appended at end');
});

test('case 2 missing trailing newline still produces well-formed output', () => {
  const out = mergeReadEntry('model: gpt-4', 'CONVENTIONS.md');
  assert.equal(out, 'model: gpt-4\nread:\n  - CONVENTIONS.md\n');
});

// --- mergeReadEntry: case 3 (null / empty list) ------------------------

test('case 3a read: with no value: replaces with single-element list', () => {
  assert.equal(
    mergeReadEntry('read:\n', 'CONVENTIONS.md'),
    'read:\n  - CONVENTIONS.md\n',
  );
});

test('case 3b read: []: replaces with single-element list', () => {
  assert.equal(
    mergeReadEntry('read: []\n', 'CONVENTIONS.md'),
    'read:\n  - CONVENTIONS.md\n',
  );
});

test('case 3c read: ~ (null sentinel): replaces with single-element list', () => {
  assert.equal(
    mergeReadEntry('read: ~\n', 'CONVENTIONS.md'),
    'read:\n  - CONVENTIONS.md\n',
  );
});

test('case 3d read: null: replaces with single-element list', () => {
  assert.equal(
    mergeReadEntry('read: null\n', 'CONVENTIONS.md'),
    'read:\n  - CONVENTIONS.md\n',
  );
});

// --- mergeReadEntry: case 4 (scalar string) ----------------------------

test('case 4 read: scalar string: converts to list and appends', () => {
  assert.equal(
    mergeReadEntry('read: SOMEFILE.md\n', 'CONVENTIONS.md'),
    'read:\n  - SOMEFILE.md\n  - CONVENTIONS.md\n',
  );
});

test('case 4 quoted scalar: unwraps and converts to list', () => {
  assert.equal(
    mergeReadEntry('read: "SOMEFILE.md"\n', 'CONVENTIONS.md'),
    'read:\n  - SOMEFILE.md\n  - CONVENTIONS.md\n',
  );
});

// --- mergeReadEntry: case 5 (list of strings) --------------------------

test('case 5a block list: appends conventions to existing block list', () => {
  assert.equal(
    mergeReadEntry('read:\n  - SOMEFILE.md\n', 'CONVENTIONS.md'),
    'read:\n  - SOMEFILE.md\n  - CONVENTIONS.md\n',
  );
});

test('case 5b multi-element block list preserves order then appends', () => {
  assert.equal(
    mergeReadEntry('read:\n  - A.md\n  - B.md\n', 'CONVENTIONS.md'),
    'read:\n  - A.md\n  - B.md\n  - CONVENTIONS.md\n',
  );
});

test('case 5c flow list: appends conventions and normalises to block form', () => {
  assert.equal(
    mergeReadEntry('read: [A.md, B.md]\n', 'CONVENTIONS.md'),
    'read:\n  - A.md\n  - B.md\n  - CONVENTIONS.md\n',
  );
});

// --- mergeReadEntry: case 6 (idempotent) -------------------------------

test('case 6a block list already contains conventions: returns input unchanged', () => {
  const input = 'read:\n  - CONVENTIONS.md\n';
  assert.equal(mergeReadEntry(input, 'CONVENTIONS.md'), input);
});

test('case 6b conventions among multiple list entries: returns input unchanged', () => {
  const input = 'read:\n  - A.md\n  - CONVENTIONS.md\n  - B.md\n';
  assert.equal(mergeReadEntry(input, 'CONVENTIONS.md'), input);
});

test('case 6c scalar already equals conventions path: returns input unchanged', () => {
  const input = 'read: CONVENTIONS.md\n';
  assert.equal(mergeReadEntry(input, 'CONVENTIONS.md'), input);
});

test('case 6d flow list already contains conventions: returns input unchanged', () => {
  const input = 'read: [A.md, CONVENTIONS.md]\n';
  assert.equal(mergeReadEntry(input, 'CONVENTIONS.md'), input);
});

// --- mergeReadEntry: case 7 (unsupported, throw) -----------------------

test('case 7a mapping continuation under read:: throws', () => {
  assert.throws(
    () => mergeReadEntry('read:\n  foo: bar\n', 'CONVENTIONS.md'),
    UnsupportedConfigShapeError,
  );
});

test('case 7a error message points user at `npx 10x-engineer print`', () => {
  try {
    mergeReadEntry('read:\n  foo: bar\n', 'CONVENTIONS.md');
    assert.fail('expected throw');
  } catch (err) {
    assert.ok(err instanceof UnsupportedConfigShapeError);
    assert.ok(
      err.message.includes('npx 10x-engineer print'),
      `error message should mention the print fallback: ${err.message}`,
    );
  }
});

test('case 7b top-level YAML is a sequence: throws', () => {
  assert.throws(
    () => mergeReadEntry('- a\n- b\n', 'CONVENTIONS.md'),
    UnsupportedConfigShapeError,
  );
});

test('case 7c multi-document YAML: throws', () => {
  assert.throws(
    () => mergeReadEntry('---\nread: a\n---\nfoo: bar\n', 'CONVENTIONS.md'),
    UnsupportedConfigShapeError,
  );
});

test('case 7 multi-token scalar (not a single path): throws', () => {
  assert.throws(
    () => mergeReadEntry('read: foo bar baz\n', 'CONVENTIONS.md'),
    UnsupportedConfigShapeError,
  );
});

// --- preservation of surrounding lines ---------------------------------

test('preserves comments and other keys above read: across cases 4/5', () => {
  const input =
    '# top comment\nmodel: gpt-4\nread:\n  - SOMEFILE.md\nauto-commits: false\n';
  const out = mergeReadEntry(input, 'CONVENTIONS.md');
  assert.ok(out.startsWith('# top comment\nmodel: gpt-4\n'));
  assert.ok(out.includes('  - SOMEFILE.md\n  - CONVENTIONS.md\n'));
  assert.ok(out.endsWith('auto-commits: false\n'));
});

test('preserves trailing keys after a scalar read:', () => {
  const input = 'read: A.md\nauto-commits: false\n';
  const out = mergeReadEntry(input, 'CONVENTIONS.md');
  assert.ok(out.includes('read:\n  - A.md\n  - CONVENTIONS.md\n'));
  assert.ok(out.endsWith('auto-commits: false\n'));
});

// --- UnsupportedConfigShapeError shape ---------------------------------

test('UnsupportedConfigShapeError carries name and message prefix', () => {
  const err = new UnsupportedConfigShapeError('test reason');
  assert.equal(err.name, 'UnsupportedConfigShapeError');
  assert.ok(err.message.startsWith('.aider.conf.yml shape unsupported:'));
  assert.ok(err.message.includes('npx 10x-engineer print'));
  assert.ok(err instanceof Error);
});
