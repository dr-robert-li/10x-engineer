// test/path-source-comment.test.js — cross-cutting assertion.
//
// Every Tier 2 adapter source file carries a path-source comment on line
// 3 in the canonical shape:
//
//   // Path source: <url>(? and <url>)*, verified 2026-05-08
//
// After the v0.2.0 trim only hosted-fallback and roo-code remain in the
// Tier 2 set; per-adapter test() calls keep the source-grep gate honest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

test("path-source comment well-formed: lib/adapters/'hosted-fallback'.js line 3", async () => {
  await assertLine3({ id: 'hosted-fallback' });
});

test("path-source comment well-formed: lib/adapters/'roo-code'.js line 3", async () => {
  await assertLine3({ id: 'roo-code' });
});
