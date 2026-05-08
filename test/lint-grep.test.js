// test/lint-grep.test.js — TEST-08 lint-grep zero-hit invariants.
//
// Three architectural rules enforced as test-time assertions:
//   1. No hardcoded '~/' paths in lib/ or bin/ — homedir must be parameterised.
//   2. No raw ANSI escape codes (\x1b[...) — picocolors is the only colour path.
//   3. Adapters in lib/adapters/ never call raw writeFile — must use safeWriteFile.
//
// Each test walks the relevant directory, reads each .js file, scans line by
// line. A hit prints {file, line, snippet} via assert.fail. No shell dependency.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(HERE, '..');
const LIB = join(REPO_ROOT, 'lib');
const BIN = join(REPO_ROOT, 'bin');
const ADAPTERS = join(REPO_ROOT, 'lib', 'adapters');

async function* walk(dir, ext = '.js') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full, ext);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      yield full;
    }
  }
}

async function scanLines(filePath, predicate) {
  const content = await readFile(filePath, 'utf8');
  const hits = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (predicate(lines[i], i + 1, filePath)) {
      hits.push({ file: relative(REPO_ROOT, filePath), line: i + 1, text: lines[i].trim() });
    }
  }
  return hits;
}

// Test 1: No hardcoded '~/' paths in lib/ or bin/ ----------------------------
// The pattern matches a literal '~/' inside single or double quotes. Adapters
// take homedir as a parameter; helpers use os.homedir() indirection. A literal
// '~/' inside a string means a path is being baked in.
test('lint-grep: no hardcoded ~/ paths in lib/ or bin/', async () => {
  const re = /['"]~\//;
  const allHits = [];
  for (const dir of [LIB, BIN]) {
    for await (const file of walk(dir)) {
      const hits = await scanLines(file, (line) => re.test(line));
      allHits.push(...hits);
    }
  }
  if (allHits.length > 0) {
    const report = allHits.map((h) => `  ${h.file}:${h.line}  ${h.text}`).join('\n');
    assert.fail(`Found ${allHits.length} hardcoded '~/' path(s):\n${report}`);
  }
});

// Test 2: No raw ANSI escape codes in lib/ or bin/ ---------------------------
// picocolors is the only colour path; raw '\x1b[' (ESC + '[') means someone
// hand-wrote an ANSI sequence, which breaks non-TTY output.
test('lint-grep: no raw ANSI escape codes in lib/ or bin/', async () => {
  // Match ESC (\x1b) followed by '[' — both as literal byte and as the
  // common JS escape forms `\x1b[`, `[`, `\033[` (octal — rare in JS).
  const re = /(\x1b\[|\\x1b\[|\\u001b\[|\\033\[)/;
  const allHits = [];
  for (const dir of [LIB, BIN]) {
    for await (const file of walk(dir)) {
      const hits = await scanLines(file, (line) => re.test(line));
      allHits.push(...hits);
    }
  }
  if (allHits.length > 0) {
    const report = allHits.map((h) => `  ${h.file}:${h.line}  ${h.text}`).join('\n');
    assert.fail(`Found ${allHits.length} raw ANSI escape code(s):\n${report}`);
  }
});

// Test 3: Adapters never call raw writeFile (must use safeWriteFile) ---------
// Match `writeFile` as a word — but exclude `safeWriteFile`. Implementation:
// look for `writeFile` not preceded by `safe`. The naive shell version is
// `grep writeFile | grep -v safeWriteFile`; here we encode that semantically.
test('lint-grep: adapters use safeWriteFile, not raw writeFile', async () => {
  // Word-boundary writeFile not preceded by 'safe' (case-sensitive).
  // (?<!safe) lookbehind: the `writeFile` not preceded by 'safe'.
  const re = /(?<!safe)\bwriteFile\b/;
  const allHits = [];
  for await (const file of walk(ADAPTERS)) {
    const hits = await scanLines(file, (line) => {
      // Skip pure import lines that pull in safeWriteFile (the lookbehind
      // already handles this, but be defensive against multi-import lines).
      if (/import\s+\{[^}]*safeWriteFile[^}]*\}/.test(line)) return false;
      return re.test(line);
    });
    allHits.push(...hits);
  }
  if (allHits.length > 0) {
    const report = allHits.map((h) => `  ${h.file}:${h.line}  ${h.text}`).join('\n');
    assert.fail(`Found ${allHits.length} raw writeFile call(s) in adapters:\n${report}`);
  }
});
