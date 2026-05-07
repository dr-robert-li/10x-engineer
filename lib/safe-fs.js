// lib/safe-fs.js — atomic write + BOM-preserving read foundation.
//
// The single sanctioned write/read path for any user-existing file. Every
// adapter and every marker operation routes through here. Three contracts
// hold from line one:
//
//   1. dryRun:true short-circuits BEFORE any filesystem syscall (D2-19, FND-10).
//      Returns {written:false, path:filePath}. No tempfile. No mtime change.
//   2. Atomic write via sibling tempfile + rename (D2-18). Same-fs rename is
//      atomic on POSIX (rename(2)) and on NTFS (MoveFileEx). Tempfile name
//      embeds process.pid so concurrent installers do not clobber each other.
//   3. UTF-8 BOM round-trips (FND-06). safeReadFile reports hadBom and strips
//      the BOM codepoint from content. safeWriteFile re-emits the BOM bytes
//      when called with {hadBom:true}, idempotently — content already prefixed
//      with the BOM does not double up.
//
// originalEol detection (LF / CRLF / mixed) is reported for downstream
// adapters that want to round-trip line endings; the contract is observational
// only, callers decide what to do with it.

import { writeFile, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';

const BOM = '\uFEFF';

/**
 * Read a UTF-8 file, returning content normalised for matching plus BOM/EOL
 * metadata. Per FND-06.
 *
 * @param {string} filePath
 * @returns {Promise<{ content: string, hadBom: boolean, originalEol: '\n' | '\r\n' | 'mixed' }>}
 */
export async function safeReadFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const hadBom = raw.charCodeAt(0) === 0xFEFF;
  const content = hadBom ? raw.slice(1) : raw;

  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfOnlyCount = (content.match(/(?<!\r)\n/g) || []).length;
  let originalEol;
  if (crlfCount > 0 && lfOnlyCount === 0) originalEol = '\r\n';
  else if (lfOnlyCount > 0 && crlfCount === 0) originalEol = '\n';
  else if (crlfCount === 0 && lfOnlyCount === 0) originalEol = '\n';
  else originalEol = 'mixed';

  return { content, hadBom, originalEol };
}

/**
 * Atomic write via sibling tempfile + rename. Re-emits BOM when hadBom=true.
 * Per D2-18 (atomicity), D2-19 (dryRun), FND-06 (BOM re-emit).
 *
 * @param {string} filePath
 * @param {string|Buffer} content
 * @param {{ dryRun?: boolean, hadBom?: boolean }} [opts]
 * @returns {Promise<{ written: boolean, path: string }>}
 */
export async function safeWriteFile(filePath, content, { dryRun = false, hadBom = false } = {}) {
  if (dryRun) return { written: false, path: filePath };

  let final = content;
  if (hadBom && typeof content === 'string') {
    final = content.charCodeAt(0) === 0xFEFF ? content : BOM + content;
  } else if (hadBom && Buffer.isBuffer(content)) {
    const startsWithBom =
      content.length >= 3 &&
      content[0] === 0xEF &&
      content[1] === 0xBB &&
      content[2] === 0xBF;
    final = startsWithBom
      ? content
      : Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), content]);
  }

  const dir = dirname(filePath);
  const tmp = join(dir, `${basename(filePath)}.10x-engineer.tmp.${process.pid}`);

  try {
    await writeFile(tmp, final);
    await rename(tmp, filePath);
    return { written: true, path: filePath };
  } catch (err) {
    try { await unlink(tmp); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    throw err;
  }
}
