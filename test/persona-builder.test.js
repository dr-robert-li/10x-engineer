// test/persona-builder.test.js
//
// Phase 7 BUILD-02: locks the persona.txt content shape produced by the
// shared persona-builder helper. The two hook-installing adapters consume
// this helper; one helper means one set of unit tests covering both call
// sites at the contract level.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPersonaText } from '../lib/adapters/helpers/persona-builder.js';
import { PERSONA_SECTION_SEPARATOR } from '../lib/state-gate-instruction.js';

const r1 = { id: 'r1', name: 'response-skill-one', description: 'rdesc', when_to_use: 'rwhen', body: 'response body one\n' };
const b1 = { id: 'b1', name: 'build-skill-one', description: 'bdesc', when_to_use: 'bwhen', body: 'build body one\n' };

test('buildPersonaText: empty buildSkills array → response-mode only, no separator', () => {
  const out = buildPersonaText([r1], []);
  assert.ok(!out.includes('BUILD-MODE EXTENSIONS'), 'must not emit build-mode header when set empty');
  assert.ok(!out.includes(PERSONA_SECTION_SEPARATOR), 'must not emit separator when set empty');
  assert.ok(out.includes('response-skill-one'), 'response skill must be present');
});

test('buildPersonaText: undefined buildSkills → response-mode only', () => {
  const out = buildPersonaText([r1]);
  assert.ok(!out.includes('BUILD-MODE EXTENSIONS'));
  assert.ok(out.includes('response-skill-one'));
});

test('buildPersonaText: null buildSkills → response-mode only', () => {
  const out = buildPersonaText([r1], null);
  assert.ok(!out.includes('BUILD-MODE EXTENSIONS'));
  assert.ok(out.includes('response-skill-one'));
});

test('buildPersonaText: both halves → contains separator + both names + canonical order', () => {
  const out = buildPersonaText([r1], [b1]);
  assert.ok(out.includes(PERSONA_SECTION_SEPARATOR), 'PERSONA_SECTION_SEPARATOR byte-equal substring must appear');
  assert.ok(out.includes('response-skill-one'));
  assert.ok(out.includes('build-skill-one'));
  assert.ok(
    out.indexOf('response-skill-one') < out.indexOf('build-skill-one'),
    'response-mode skill must appear before build-mode skill',
  );
});

test('buildPersonaText: response-mode header always present', () => {
  const a = buildPersonaText([r1], []);
  const b = buildPersonaText([r1], [b1]);
  assert.ok(a.includes('# 10x-engineer persona'));
  assert.ok(b.includes('# 10x-engineer persona'));
});

test('buildPersonaText: build-mode header only when build set non-empty', () => {
  const empty = buildPersonaText([r1], []);
  const filled = buildPersonaText([r1], [b1]);
  assert.ok(!empty.includes('build-mode extensions'));
  assert.ok(filled.includes('build-mode extensions'));
});

test('buildPersonaText: pure function (same inputs → same output)', () => {
  const a = buildPersonaText([r1], [b1]);
  const b = buildPersonaText([r1], [b1]);
  assert.equal(a, b);
});
