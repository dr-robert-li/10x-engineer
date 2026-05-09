// test/format-append-markers.test.js — FMT-03 unit tests.
//
// Pure-function transform: feed it skills + version, get back a single-element
// array whose content is wrapped in BEGIN/END markers via wrapBlock. Tests use
// synthetic fixtures to keep the suite decoupled from skills/*.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from '../lib/format/append-markers.js';
import { MARKER_BEGIN_PREFIX, MARKER_END } from '../lib/markers.js';
import { STATE_GATE_INSTRUCTION, BUILD_MODE_INSTRUCTION } from '../lib/state-gate-instruction.js';

function makeSkill(id, name = id) {
  return {
    id,
    name,
    description: `desc for ${id}`,
    when_to_use: `when ${id}`,
    body: `# ${id}\n\nbody for ${id}\n`,
  };
}

test('append-markers.single-output-element: result.length === 1', () => {
  const out = transform([makeSkill('a'), makeSkill('b')], '0.1.0');
  assert.equal(out.length, 1);
  assert.equal(out[0].relativePath, '');
});

test('append-markers.content-begins-with-marker', () => {
  const out = transform([makeSkill('a')], '0.1.0');
  assert.ok(
    out[0].content.startsWith(MARKER_BEGIN_PREFIX),
    `expected content to start with ${JSON.stringify(MARKER_BEGIN_PREFIX)}; got: ${JSON.stringify(out[0].content.slice(0, 60))}`,
  );
});

test('append-markers.content-ends-with-end-marker-and-newline', () => {
  const out = transform([makeSkill('a')], '0.1.0');
  assert.ok(
    out[0].content.endsWith(`${MARKER_END}\n`),
    `expected content to end with END marker + newline; got: ${JSON.stringify(out[0].content.slice(-60))}`,
  );
});

test('append-markers.version-embedded-in-begin-marker', () => {
  const out = transform([makeSkill('a')], '1.2.3');
  assert.match(out[0].content, /<!-- BEGIN 10x-engineer v\d+\.\d+\.\d+ -->/);
  assert.ok(
    out[0].content.includes('<!-- BEGIN 10x-engineer v1.2.3 -->'),
    'explicit version override must be threaded into the BEGIN marker via wrapBlock',
  );
});

test('append-markers.persona-header-present', () => {
  const out = transform([makeSkill('a')], '0.1.0');
  assert.ok(
    out[0].content.includes('# 10x-engineer persona\n'),
    'wrapped block must contain the persona H1 header literal',
  );
});

test('append-markers.every-skill-name-appears-as-h2', () => {
  const skills = [
    makeSkill('alpha', 'Alpha One'),
    makeSkill('beta', 'Beta Two'),
    makeSkill('gamma', 'Gamma Three'),
  ];
  const out = transform(skills, '0.1.0');
  for (const s of skills) {
    assert.ok(
      out[0].content.includes(`## ${s.name}\n`),
      `expected H2 heading "## ${s.name}" in wrapped content`,
    );
  }
});

test('append-markers.body-with-dollar-substitution-survives-byte-identical', () => {
  // Function-form replace inheritance from Phase 2 wrapBlock. The transform
  // does plain string concatenation, then hands off to wrapBlock — which
  // never runs the body through a regex replacement, so $&, $1, $$, ${0}
  // must appear verbatim in the wrapped output.
  const dollarSkill = {
    id: 'dollar',
    name: 'Dollar',
    description: 'd',
    when_to_use: 'd',
    body: 'cost: $&100 and $1 with $${0}\n',
  };
  const out = transform([dollarSkill], '0.1.0');
  assert.ok(
    out[0].content.includes('cost: $&100 and $1 with $${0}'),
    'function-form wrapBlock must preserve $& $1 $${} substitution sigils byte-identical',
  );
});

test('append-markers.state-gate-prologue-byte-equal-inside-marker-block', () => {
  // Single-source assertion: the prologue inside the wrapped block is
  // byte-equal to the STATE_GATE_INSTRUCTION export. Order check confirms
  // the prologue lives INSIDE the BEGIN/END marker block so stripBlock
  // removes it on uninstall. BUILD_MODE_INSTRUCTION rides along on the
  // same single-source contract (BUILD-03).
  const out = transform([makeSkill('a'), makeSkill('b')], '0.3.0');
  assert.ok(
    out[0].content.includes(STATE_GATE_INSTRUCTION),
    'STATE_GATE_INSTRUCTION must appear in the wrapped marker block',
  );
  assert.ok(
    out[0].content.includes(BUILD_MODE_INSTRUCTION),
    'BUILD_MODE_INSTRUCTION must appear in the wrapped marker block',
  );
  const beginIdx = out[0].content.indexOf('<!-- BEGIN 10x-engineer');
  const endIdx = out[0].content.indexOf('<!-- END 10x-engineer');
  const gateIdx = out[0].content.indexOf(STATE_GATE_INSTRUCTION);
  const buildIdx = out[0].content.indexOf(BUILD_MODE_INSTRUCTION);
  assert.ok(
    beginIdx < gateIdx && gateIdx < endIdx,
    'STATE_GATE_INSTRUCTION must appear INSIDE the BEGIN/END marker block',
  );
  assert.ok(
    beginIdx < buildIdx && buildIdx < endIdx,
    'BUILD_MODE_INSTRUCTION must appear INSIDE the BEGIN/END marker block',
  );
});

test('append-markers.build-mode-prologue-follows-state-gate-prologue', () => {
  // Canonical order (BUILD-03): the state-gate engages first (per-session
  // enable check), then build-mode applies. Reversing the order would
  // mean the host runner sees build-mode patterns in a body that has
  // not yet been gated — defeats the default-off contract.
  const out = transform([makeSkill('a')], '0.3.0');
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
