// test/format-native-skills.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from '../lib/format/native-skills.js';

function makeSkill(id, name = id) {
  return {
    id,
    name,
    description: `desc for ${id}`,
    when_to_use: `when ${id}`,
    body: `# ${id}\n\nbody for ${id}\n`,
    data: { name, description: `desc for ${id}`, when_to_use: `when ${id}` },
    frontmatter: { name, description: `desc for ${id}`, when_to_use: `when ${id}` },
  };
}

test('transform returns one entry per skill', () => {
  const out = transform([makeSkill('a'), makeSkill('b'), makeSkill('c')]);
  assert.equal(out.length, 3);
});

test('transform produces relativePath = <id>.md and frontmatter+body content', () => {
  const out = transform([makeSkill('x')]);
  assert.equal(out[0].relativePath, 'x.md');
  assert.ok(out[0].content.startsWith('---\nname: x\n'));
  assert.ok(out[0].content.includes('description: desc for x'));
  assert.ok(out[0].content.includes('when_to_use: when x'));
  assert.ok(out[0].content.includes('# x'));
  assert.ok(out[0].content.includes('body for x'));
});

test('transform is pure: same input twice -> deeply equal output', () => {
  const inputs = [makeSkill('p'), makeSkill('q')];
  const a = transform(inputs);
  const b = transform(inputs);
  assert.deepEqual(a, b);
});

test('transform preserves skill body verbatim (skill content is opaque to the pipeline)', () => {
  const trickyBody = '# Has $1 and $& and `code` and \\n literally\n';
  const skill = makeSkill('tricky');
  skill.body = trickyBody;
  const [out] = transform([skill]);
  // Body is appended after the closing fence — stringifyFrontmatter emits `---\n...---\n${body}`
  assert.ok(out.content.endsWith(trickyBody),
    `expected content to end with the verbatim body; got: ${JSON.stringify(out.content.slice(-80))}`);
});
