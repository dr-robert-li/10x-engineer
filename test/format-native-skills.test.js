// test/format-native-skills.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from '../lib/format/native-skills.js';
import { STATE_GATE_INSTRUCTION, BUILD_MODE_INSTRUCTION } from '../lib/state-gate-instruction.js';

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

test('native-skills.state-gate-prologue-byte-equal-in-every-skill', () => {
  // Single-source assertion: the prologue text in every produced skill file
  // is byte-equal to the canonical STATE_GATE_INSTRUCTION export. Editing
  // the export propagates to every adapter that consumes this format; this
  // test guards the link. BUILD_MODE_INSTRUCTION rides along on the same
  // single-source contract (BUILD-03).
  const skills = [
    { id: 's1', data: { name: 's1', description: 'd1', when_to_use: 'w1' }, body: 'body1\n' },
    { id: 's2', data: { name: 's2', description: 'd2', when_to_use: 'w2' }, body: 'body2\n' },
  ];
  const out = transform(skills, '0.3.0');
  for (const file of out) {
    assert.ok(
      file.content.includes(STATE_GATE_INSTRUCTION),
      `STATE_GATE_INSTRUCTION must appear in every native-skills output file: ${file.relativePath}`,
    );
    assert.ok(
      file.content.includes(BUILD_MODE_INSTRUCTION),
      `BUILD_MODE_INSTRUCTION must appear in every native-skills output file: ${file.relativePath}`,
    );
  }
});

test('native-skills.build-mode-prologue-follows-state-gate-prologue', () => {
  // Canonical order (BUILD-03): the state-gate engages first (per-session
  // enable check), then build-mode applies. Reversing the order would
  // mean the host runner sees build-mode patterns in a body that has
  // not yet been gated — defeats the default-off contract.
  const skills = [makeSkill('s1')];
  const out = transform(skills, '0.3.0');
  for (const file of out) {
    const sgi = file.content.indexOf(STATE_GATE_INSTRUCTION);
    const bmi = file.content.indexOf(BUILD_MODE_INSTRUCTION);
    assert.ok(sgi >= 0, `STATE_GATE_INSTRUCTION not found in ${file.relativePath}`);
    assert.ok(bmi >= 0, `BUILD_MODE_INSTRUCTION not found in ${file.relativePath}`);
    assert.ok(
      bmi > sgi,
      `BUILD_MODE_INSTRUCTION must appear AFTER STATE_GATE_INSTRUCTION in ${file.relativePath}; got SGI@${sgi}, BMI@${bmi}`,
    );
  }
});
