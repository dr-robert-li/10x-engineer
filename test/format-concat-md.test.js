// test/format-concat-md.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from '../lib/format/concat-md.js';
import { MARKER_BEGIN_PREFIX } from '../lib/markers.js';

function makeSkill(id, name = id) {
  return {
    id,
    name,
    description: `desc for ${id}`,
    when_to_use: `when ${id}`,
    body: `# ${id}\n\nbody for ${id}\n`,
  };
}

test('concat-md.single-output-element-named-10x-engineer-md', () => {
  const out = transform([makeSkill('a'), makeSkill('b')]);
  assert.equal(out.length, 1);
  assert.equal(out[0].relativePath, '10x-engineer.md');
});

test('concat-md.content-begins-with-h1-persona-header', () => {
  const out = transform([makeSkill('a')]);
  assert.ok(
    out[0].content.startsWith('# 10x-engineer persona'),
    `expected content to start with '# 10x-engineer persona'; got: ${JSON.stringify(out[0].content.slice(0, 40))}`,
  );
});

test('concat-md.version-embedded-in-header-when-provided', () => {
  const out = transform([makeSkill('a')], '1.2.3');
  assert.ok(
    out[0].content.startsWith('# 10x-engineer persona (v1.2.3)'),
    `expected versioned header; got: ${JSON.stringify(out[0].content.slice(0, 60))}`,
  );
});

test('concat-md.version-omitted-no-parenthesised-suffix', () => {
  const out = transform([makeSkill('a')]);
  // Header line should be `# 10x-engineer persona\n` — no `(v...)` suffix.
  const firstLine = out[0].content.split('\n', 1)[0];
  assert.equal(firstLine, '# 10x-engineer persona');
});

test('concat-md.every-skill-h2-section-present', () => {
  const skills = [makeSkill('a', 'first-principles'), makeSkill('b', 'compiler-driven'), makeSkill('c', 'yak-shaving')];
  const out = transform(skills);
  for (const s of skills) {
    assert.ok(
      out[0].content.includes(`## ${s.name}`),
      `expected '## ${s.name}' in content`,
    );
  }
});

test('concat-md.body-preserved-verbatim', () => {
  const skills = [makeSkill('a'), makeSkill('b'), makeSkill('c')];
  const out = transform(skills);
  for (const s of skills) {
    assert.ok(
      out[0].content.includes(s.body),
      `expected body of ${s.id} verbatim in content`,
    );
  }
});

test('concat-md.no-marker-strings-emitted', () => {
  const out = transform([makeSkill('a'), makeSkill('b')], '1.0.0');
  assert.ok(
    !out[0].content.includes(MARKER_BEGIN_PREFIX),
    'concat-md is markerless by design — destination is owned by us, uninstall = unlink',
  );
});

test('concat-md.dollar-substitution-survives-byte-identical', () => {
  // String.replace with a string replacement performs $-substitution. If the
  // transform ever does that, `${0}` and `$&` will mutate. Use function-form
  // (or template-literal concatenation) to keep these byte-identical.
  const trickySkill = {
    id: 'tricky',
    name: 'tricky-skill',
    description: 'description with $& and ${0} hazards',
    when_to_use: 'when',
    body: '# tricky\n\nCost: $&100 and placeholder ${0} and $1 group\n',
  };
  const out = transform([trickySkill]);
  assert.ok(
    out[0].content.includes(trickySkill.body),
    'trickyBody must appear byte-identical in output',
  );
  assert.ok(
    out[0].content.includes('description with $& and ${0} hazards'),
    'trickyDescription must appear byte-identical in output',
  );
});
