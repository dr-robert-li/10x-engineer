// test/skills-build-mode.test.js — TEST-10 + TEST-13 executable assertions
// for the build-mode skill partition.
//
// TEST-10: every BUILD/SCAFF/SUBART/DOCS skill file in skills/ exists,
// parses through lib/frontmatter.js parseFrontmatter, has data.name
// matching its filename basename, sits in the [80, 200] line band, and
// contains no Unicode emoji or winking phrases.
//
// TEST-13: every backtick-wrapped `*.md` reference inside any build-* skill
// file's `## See Also` bullet list resolves to a real file in skills/.
//
// Universe: loadBuildModeSkills() — iterates the build-mode partition
// (post-Phase-9: 16 files). The test does NOT hardcode the file count —
// it iterates the partition and asserts per-file. Future milestones
// automatically pick up the same invariants.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBuildModeSkills } from '../lib/skills.js';
import { parseFrontmatter } from '../lib/frontmatter.js';

const here = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(here, '..', 'skills');

// Filename predicate for the build-mode partition on disk. Mirrors the
// loader's own predicate: filenames begin with `build-`, end with `.md`,
// and exclude `build-system-from-scratch.md` — the Phase 1 response-mode
// file whose name happens to share the prefix.
function isBuildModeFile(f) {
  return (
    f.startsWith('build-') &&
    f.endsWith('.md') &&
    f !== 'build-system-from-scratch.md'
  );
}

test('TEST-10 file count: build-mode universe is 16 files post-Phase-9', async () => {
  const skills = await loadBuildModeSkills();
  assert.ok(
    skills.length >= 16,
    `expected >= 16 build-mode skills (1 keystone + 5 SCAFF + 7 SUBART + 3 DOCS), got ${skills.length}`,
  );
});

test('TEST-10 frontmatter: every build-* parses with name === filename basename', async () => {
  const skills = await loadBuildModeSkills();
  for (const s of skills) {
    assert.equal(s.id, s.name, `${s.id}: frontmatter name must equal filename basename`);
    assert.ok(s.description?.length, `${s.id}: missing description`);
    assert.ok(s.when_to_use?.length, `${s.id}: missing when_to_use`);
  }
});

test('TEST-10 line band: every build-* file is 80–200 lines', async () => {
  const files = (await readdir(skillsDir)).filter(isBuildModeFile);
  // Note: build-system-from-scratch.md is response-mode (Phase 1) per
  // RESPONSE_MODE_PREFIX_COLLISIONS in lib/skills.js; the line-band
  // invariant for response-mode is enforced elsewhere — this test scopes
  // to build-mode only.
  for (const f of files) {
    const src = await readFile(join(skillsDir, f), 'utf8');
    const lines = src.split('\n').length;
    assert.ok(lines >= 80 && lines <= 200, `${f}: ${lines} lines outside [80, 200] band`);
  }
});

test('TEST-10 voice invariant: no emoji in any build-* file', async () => {
  // Comprehensive Unicode emoji-block coverage per RESEARCH §"Voice
  // Invariant Patterns". The 0x2600–0x27BF symbols block catches ⚠️
  // (0x26A0); that emoji lives only in README.md, never in skills/build-*.md.
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/u;
  const files = (await readdir(skillsDir)).filter(isBuildModeFile);
  for (const f of files) {
    const src = await readFile(join(skillsDir, f), 'utf8');
    const m = src.match(EMOJI);
    assert.ok(!m, `${f}: emoji detected: ${m?.[0]}`);
  }
});

test('TEST-10 voice invariant: no winking phrases', async () => {
  // Word-boundary, case-insensitive — no fourth-wall-break tropes.
  const WINKING = /\b(of course|obviously|the reader may suspect|the reader may|lol|haha|jk|just kidding|as we all know|trust me|wink wink)\b/i;
  const files = (await readdir(skillsDir)).filter(isBuildModeFile);
  for (const f of files) {
    const src = await readFile(join(skillsDir, f), 'utf8');
    const m = src.match(WINKING);
    assert.ok(!m, `${f}: winking phrase detected: ${m?.[0]}`);
  }
});

test('TEST-13 cross-reference integrity: every See Also *.md ref resolves', async () => {
  const files = (await readdir(skillsDir)).filter(isBuildModeFile);
  for (const f of files) {
    const src = await readFile(join(skillsDir, f), 'utf8');
    // Locate the `## See Also` heading and the section body. Stop at the
    // next `## ` heading, OR a line beginning `See also: ` (the prose-
    // citation tail contains paper references, not file references), OR
    // a line beginning `_` (italic footer some files might use), OR
    // end-of-file.
    const seeAlsoMatch = src.match(/^## See Also\s*\n([\s\S]*?)(?=\n## |\nSee also: |\n_|$)/m);
    if (!seeAlsoMatch) continue; // file may not have a See Also section
    const section = seeAlsoMatch[1];
    // Extract every backtick-wrapped *.md basename. Pattern requires
    // lowercase + hyphens only, no asterisks (avoids matching
    // italicised paper titles like *Notes.md*).
    const refs = [...section.matchAll(/`([a-z][a-z0-9-]*\.md)`/g)].map((m) => m[1]);
    for (const ref of refs) {
      const target = join(skillsDir, ref);
      assert.ok(existsSync(target), `${f}: See Also ref \`${ref}\` does not resolve to ${target}`);
    }
  }
});
