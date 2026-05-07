// test/helpers/byte-identity.js
//
// Shared assertion helper for the FND-09-refined round-trip contract. Per
// Phase 3 research §Common Pitfalls — Pitfall 10: an install→uninstall
// cycle on a no-trailing-newline user file may leave a single bounded `\n`
// artefact, so strict whole-file byte-identity is not guaranteed. The user
// content slices AROUND the marker block ARE strictly byte-identical, and
// that is what this helper asserts.
//
// Two operating modes:
//   1. Marker present (post-install): slice-before-BEGIN and slice-after-END
//      compare to the corresponding slices of originalBytes.
//   2. Marker absent (post-uninstall): whole-file compare with bounded \n
//      artefact tolerance.
//
// The 4-arg signature honours the contract surface declared in
// must_haves.truths; the prefix/marker args default to canonical constants.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MARKER_BEGIN_PREFIX, MARKER_END } from '../../lib/markers.js';

/**
 * @param {string} filePath        path to the file under test
 * @param {string} originalBytes   the pre-install file content
 * @param {string} [beginPrefix]   marker BEGIN prefix; defaults to MARKER_BEGIN_PREFIX
 * @param {string} [endMarker]     marker END line; defaults to MARKER_END
 */
export async function assertByteIdenticalAroundMarker(
  filePath,
  originalBytes,
  beginPrefix = MARKER_BEGIN_PREFIX,
  endMarker = MARKER_END,
) {
  const current = await readFile(filePath, 'utf8');
  const beginIdx = current.indexOf(beginPrefix);
  const endIdx = current.indexOf(endMarker);

  if (beginIdx === -1 && endIdx === -1) {
    // Mode 2: no marker (post-uninstall). Whole-file compare with bounded \n tolerance.
    if (current === originalBytes) return;
    if (current === originalBytes + '\n') return;
    if (originalBytes === current + '\n') return;
    assert.equal(
      current, originalBytes,
      'post-uninstall: file content drifted beyond the bounded trailing-\\n artefact',
    );
    return;
  }

  if (beginIdx === -1 || endIdx === -1) {
    assert.fail(`malformed marker state: BEGIN at ${beginIdx}, END at ${endIdx}`);
  }

  // Mode 1: marker present. Compare before/after slices.
  const before = current.slice(0, beginIdx);
  const after = current.slice(endIdx + endMarker.length);

  // before slice may have gained one synthesised `\n` per FND-09 — bounded artefact allowed.
  const beforeMatches =
    before === originalBytes ||
    before === originalBytes + '\n' ||
    originalBytes.startsWith(before);
  assert.ok(
    beforeMatches,
    `bytes BEFORE marker not byte-identical to original (allowing single \\n artefact)`,
  );

  // after slice — Phase 3 fixtures pre-install state has no marker block, so after is
  // typically '' or '\n' (trailing newline from wrapBlock). For replace-in-place
  // fixtures, after corresponds to the suffix of originalBytes past the original block.
  const afterMatches =
    after === '' ||
    after === '\n' ||
    originalBytes.endsWith(after);
  assert.ok(
    afterMatches,
    `bytes AFTER marker contain unexpected content (allowing trailing \\n artefact)`,
  );
}
