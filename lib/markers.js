// lib/markers.js — marker invariants and atomic block I/O.
//
// MARKER_BEGIN_PREFIX is module-level and intentionally version-free: prefix-only
// matching means a future version's stripBlock removes any past version's marker.
// The architectural-lock test in test/markers.test.js asserts this property
// against a v0.9 fixture and must pass at every package version forever.
//
// Five invariants are enforced by the code shape below:
//   1. MARKER_BEGIN_PREFIX has no version, no closing -->        (D2-14)
//   2. BLOCK_RE uses \r?\n everywhere                             (D2-15)
//   3. replaceBlock and stripBlock use function-form String.replace; persona
//      bodies containing $&, $1, $`, $', $$ survive byte-identical (D2-16)
//   4. guardOrphanMarkers runs before every write and throws
//      MarkerCorruptionError on multi-BEGIN/END mismatch          (D2-17)
//   5. All writes route through safeWriteFile (atomic temp+rename) (D2-18)
//
// BOM bytes are owned by lib/safe-fs.js. This module passes hadBom through
// verbatim from safeReadFile to safeWriteFile and never touches BOM bytes
// directly.

import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { safeReadFile, safeWriteFile } from './safe-fs.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(here, '..', 'package.json');
const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));

export const MARKER_BEGIN_PREFIX = '<!-- BEGIN 10x-engineer';
export const MARKER_END = '<!-- END 10x-engineer -->';

// CRLF-tolerant; non-greedy body; trailing newline optional.
// Prefix-only on BEGIN so a future version's stripBlock removes a past
// version's marker (D2-14, locked by architectural-lock test).
const BLOCK_RE =
  /<!-- BEGIN 10x-engineer[^\r\n]*-->\r?\n[\s\S]*?<!-- END 10x-engineer -->(\r?\n)?/;

// Counting regexes — global flag for matchAll, prefix-only on BEGIN.
const BEGIN_COUNT_RE = /<!-- BEGIN 10x-engineer[^\r\n]*-->/g;
const END_COUNT_RE   = /<!-- END 10x-engineer -->/g;

export class MarkerCorruptionError extends Error {
  constructor(filePath, beginCount, endCount, beginLines, endLines) {
    super(
      `${filePath}: found ${beginCount} BEGIN and ${endCount} END markers; expected at most 1 of each.\n` +
      `BEGIN lines: ${beginLines.join(', ') || '(none)'}\n` +
      `END lines:   ${endLines.join(', ') || '(none)'}\n` +
      `Refusing to modify. Edit manually or report a bug.`
    );
    this.name = 'MarkerCorruptionError';
    this.filePath = filePath;
    this.beginCount = beginCount;
    this.endCount = endCount;
  }
}

export function getVersion(override) {
  return override ?? pkg.version;
}

export function wrapBlock(body, version) {
  const ver = version ?? getVersion();
  const trimmedBody = body.endsWith('\n') ? body : body + '\n';
  return `${MARKER_BEGIN_PREFIX} v${ver} -->\n${trimmedBody}${MARKER_END}\n`;
}

export function guardOrphanMarkers(content, filePath) {
  const beginMatches = [...content.matchAll(BEGIN_COUNT_RE)];
  const endMatches = [...content.matchAll(END_COUNT_RE)];

  // Allowed states:
  //   0 BEGIN, 0 END  → no install yet
  //   1 BEGIN, 1 END  → existing install
  if (beginMatches.length === endMatches.length && beginMatches.length <= 1) return;

  const lineOf = (idx) => content.slice(0, idx).split(/\r?\n/).length;
  throw new MarkerCorruptionError(
    filePath,
    beginMatches.length,
    endMatches.length,
    beginMatches.map(m => lineOf(m.index)),
    endMatches.map(m => lineOf(m.index)),
  );
}

function ensureTrailingNewline(s) {
  if (s.length === 0) return '';
  return s.endsWith('\n') ? s : s + '\n';
}

export async function replaceBlock(filePath, newBlock, { dryRun = false } = {}) {
  let existingContent = '';
  let hadBom = false;
  try {
    const r = await safeReadFile(filePath);
    existingContent = r.content;
    hadBom = r.hadBom;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  guardOrphanMarkers(existingContent, filePath);
  const next = BLOCK_RE.test(existingContent)
    ? existingContent.replace(BLOCK_RE, () => newBlock)         // function-form (D2-16)
    : ensureTrailingNewline(existingContent) + newBlock;
  if (dryRun) return { written: false, path: filePath };
  await safeWriteFile(filePath, next, { hadBom });
  return { written: true, path: filePath };
}

export async function stripBlock(filePath, { dryRun = false } = {}) {
  let existingContent;
  let hadBom = false;
  try {
    const r = await safeReadFile(filePath);
    existingContent = r.content;
    hadBom = r.hadBom;
  } catch (e) {
    if (e.code === 'ENOENT') return { removed: false, path: filePath };
    throw e;
  }
  guardOrphanMarkers(existingContent, filePath);
  if (!BLOCK_RE.test(existingContent)) return { removed: false, path: filePath };
  const next = existingContent.replace(BLOCK_RE, () => '');     // function-form (D2-16)
  if (dryRun) return { removed: true, path: filePath };
  if (next.trim().length === 0) {
    const { rm } = await import('node:fs/promises');
    await rm(filePath);
  } else {
    await safeWriteFile(filePath, next, { hadBom });
  }
  return { removed: true, path: filePath };
}
