// test/path-source-comment.test.js — Plan 04-13 cross-cutting assertion.
//
// Cross-phase invariant 6 (research): every Tier 2 adapter source file
// carries a path-source comment on line 3 in the canonical shape:
//
//   // Path source: <url>(? and <url>)*, verified 2026-05-08
//
// One test per Tier 2 adapter for clear failure messages — explicit
// per-adapter test() calls (not a loop) so the source-grep gate that
// counts test invocations stays honest. Plus a dedicated assertion
// that PearAI uses the two-URL ` and ` join (Aider precedent — vendor
// docs split across the upstream trypear/pearai-submodule repo and
// the Continue.dev docs the fork inherits from).
//
// 12 Tier 2 adapters; Cody (TIER2-03) is deferred so excluded from this
// list per the locked decision #1 in Phase 4.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Locked regex — line 3 must start with `// Path source: ` followed by
// one or more http(s) URLs (joined by ' and ' if multiple), then a
// comma-space-`verified `-DATE suffix. The DATE literal is pinned to
// 2026-05-08 across the entire Tier 2 fleet (Path-source freeze date).
const PATH_SOURCE_REGEX =
  /^\/\/ Path source: https?:\/\/\S+( and https?:\/\/\S+)*, verified 2026-05-08$/;

async function assertLine3({ id }) {
  const src = await readFile(`./lib/adapters/${id}.js`, 'utf8');
  const lines = src.split('\n');
  assert.ok(lines.length >= 3, `${id}.js must have ≥3 lines`);
  const line3 = lines[2];
  assert.match(
    line3,
    PATH_SOURCE_REGEX,
    `${id}.js line 3 does not match Path-source regex; got: ${JSON.stringify(line3)}`,
  );
}

test("path-source comment well-formed: lib/adapters/'amazon-q'.js line 3", async () => {
  await assertLine3({ id: 'amazon-q' });
});

test("path-source comment well-formed: lib/adapters/'copilot-chat'.js line 3", async () => {
  await assertLine3({ id: 'copilot-chat' });
});

test("path-source comment well-formed: lib/adapters/'goose'.js line 3", async () => {
  await assertLine3({ id: 'goose' });
});

test("path-source comment well-formed: lib/adapters/'hosted-fallback'.js line 3", async () => {
  await assertLine3({ id: 'hosted-fallback' });
});

test("path-source comment well-formed: lib/adapters/'jetbrains'.js line 3", async () => {
  await assertLine3({ id: 'jetbrains' });
});

test("path-source comment well-formed: lib/adapters/'pearai'.js line 3", async () => {
  await assertLine3({ id: 'pearai' });
});

test("path-source comment well-formed: lib/adapters/'pieces'.js line 3", async () => {
  await assertLine3({ id: 'pieces' });
});

test("path-source comment well-formed: lib/adapters/'plandex'.js line 3", async () => {
  await assertLine3({ id: 'plandex' });
});

test("path-source comment well-formed: lib/adapters/'roo-code'.js line 3", async () => {
  await assertLine3({ id: 'roo-code' });
});

test("path-source comment well-formed: lib/adapters/'tabnine'.js line 3", async () => {
  await assertLine3({ id: 'tabnine' });
});

test("path-source comment well-formed: lib/adapters/'windsurf'.js line 3", async () => {
  await assertLine3({ id: 'windsurf' });
});

test("path-source comment well-formed: lib/adapters/'zed'.js line 3", async () => {
  await assertLine3({ id: 'zed' });
});

test('PearAI line 3 uses the two-URL ` and ` join (Aider precedent)', async () => {
  const src = await readFile('./lib/adapters/pearai.js', 'utf8');
  const line3 = src.split('\n')[2];
  assert.match(
    line3,
    /^\/\/ Path source: https?:\/\/\S+ and https?:\/\/\S+, verified 2026-05-08$/,
    'PearAI must cite both upstream sources joined by " and "',
  );
});
