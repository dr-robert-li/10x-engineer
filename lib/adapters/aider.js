// lib/adapters/aider.js
//
// Path source: https://aider.chat/docs/config/aider_conf.html and https://aider.chat/docs/usage/conventions.html, verified 2026-05-07
//
// Tier 1 adapter — Aider. Project-scoped, two-file install:
//   1. <projectRoot>/CONVENTIONS.md       (the persona body)
//   2. <projectRoot>/.aider.conf.yml      (patched: `read:` list)
//
// The `read:` patch routes through mergeReadEntry from FMT-05, which enforces
// the 7-shape whitelist. Out-of-whitelist YAML throws UnsupportedConfigShapeError
// pointing the user at `npx 10x-engineer print`.
//
// CONVENTIONS.md is never overwritten if it predates us — first-line heuristic:
// it must begin with `# 10x-engineer conventions` to be considered ours. The
// same heuristic gates uninstall removal.
//
// Atomicity: install runs the user-CONVENTIONS check AND mergeReadEntry BEFORE
// any write. Either gate failing leaves the filesystem byte-identical.
//
// Detection: filesystem (.aider.conf.yml at cwd or any ancestor up to homedir,
// halting at .git boundaries) OR PATH (aider binary). cwd + homedir injected
// per D2-24; never read from process / node:os here.

import { access, constants, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { commandExists, findAncestorWith } from '../detect.js';
import { safeReadFile, safeWriteFile } from '../safe-fs.js';
import {
  transform,
  mergeReadEntry,
  UnsupportedConfigShapeError,
} from '../format/yaml-config+md.js';

const OUR_CONVENTIONS_HEADER = '# 10x-engineer conventions';
const CONVENTIONS_REL = 'CONVENTIONS.md';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

/** safeReadFile or null on ENOENT. */
async function readIfExists(p) {
  try { return await safeReadFile(p); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

export default {
  id: 'aider',
  displayName: 'Aider',
  format: 'yaml-config+md',

  async detect({ cwd, homedir }) {
    const directHit = await exists(join(cwd, '.aider.conf.yml'));
    const ancestor = directHit
      ? cwd
      : await findAncestorWith(cwd, '.aider.conf.yml', homedir);
    const hasBinary = await commandExists('aider');
    if (!ancestor && !hasBinary) return { found: false };
    const projectRoot = ancestor ?? cwd;
    return {
      found: true,
      scope: 'project',
      paths: {
        global: null,
        project: {
          conventionsMd: join(projectRoot, CONVENTIONS_REL),
          aiderConfYml: join(projectRoot, '.aider.conf.yml'),
          projectRoot,
        },
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    if (scope !== 'project' || !paths || !paths.project) {
      return { written: [], skipped: [] };
    }
    const { conventionsMd, aiderConfYml } = paths.project;

    // Gate 1: refuse to overwrite a user-owned CONVENTIONS.md.
    const existing = await readIfExists(conventionsMd);
    const existingConventions = existing === null ? null : existing.content;
    if (existingConventions !== null
        && !existingConventions.startsWith(OUR_CONVENTIONS_HEADER)) {
      const firstLine = existingConventions.split('\n', 1)[0];
      throw new UnsupportedConfigShapeError(
        `existing CONVENTIONS.md is user-owned (first line: ${firstLine})`,
      );
    }

    // Gate 2: read existing .aider.conf.yml (may be missing → '').
    let existingYaml = '';
    let hadBom = false;
    const yml = await readIfExists(aiderConfYml);
    if (yml !== null) {
      existingYaml = yml.content;
      hadBom = yml.hadBom;
    }

    // Gate 3: merge BEFORE any write. Throws on case 7 → no disk touched.
    const newYaml = mergeReadEntry(existingYaml, CONVENTIONS_REL);

    // Idempotency (case 6): verbatim merge AND CONVENTIONS.md already ours.
    const isNoOp = newYaml === existingYaml && existingConventions !== null;
    const written = [];

    if (!isNoOp) {
      const [{ content: convContent }] = transform(skills, version);
      await safeWriteFile(conventionsMd, convContent, { dryRun });
      written.push(conventionsMd);
    }
    if (newYaml !== existingYaml) {
      await safeWriteFile(aiderConfYml, newYaml, { dryRun, hadBom });
      written.push(aiderConfYml);
    }
    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    if (scope !== 'project' || !paths || !paths.project) {
      return { removed: [] };
    }
    const { conventionsMd, aiderConfYml } = paths.project;
    const removed = [];

    // Remove CONVENTIONS.md only if it's ours.
    const existing = await readIfExists(conventionsMd);
    const existingConventions = existing === null ? null : existing.content;
    if (existingConventions !== null
        && existingConventions.startsWith(OUR_CONVENTIONS_HEADER)) {
      if (!dryRun) {
        try { await unlink(conventionsMd); }
        catch (e) { if (e.code !== 'ENOENT') throw e; }
      }
      removed.push(conventionsMd);
    }

    // Scrub CONVENTIONS.md from the read: list in .aider.conf.yml.
    const yml = await readIfExists(aiderConfYml);
    if (yml === null) return { removed };
    const scrubbed = scrubReadEntry(yml.content, CONVENTIONS_REL);
    if (scrubbed !== yml.content) {
      await safeWriteFile(aiderConfYml, scrubbed, { dryRun, hadBom: yml.hadBom });
      removed.push(aiderConfYml);
    }
    return { removed };
  },
};

/**
 * Inverse of mergeReadEntry — adapter-local. Removes `relPath` from the
 * `read:` list. Empty list ⇒ key removed. Path absent ⇒ input verbatim.
 * Out-of-whitelist shapes ⇒ input verbatim (refuse to surgically edit a
 * config we do not understand). Surrounding lines preserved.
 */
function scrubReadEntry(existingYaml, relPath) {
  if (!existingYaml) return existingYaml;
  const lines = existingYaml.split('\n');
  const readIdx = lines.findIndex((l) => /^read\s*:/.test(l));
  if (readIdx === -1) return existingYaml;

  const afterColon = lines[readIdx].replace(/^read\s*:\s*/, '');
  let endOfBlock = readIdx + 1;
  let items;

  if (afterColon === '') {
    while (endOfBlock < lines.length && /^\s+-\s/.test(lines[endOfBlock])) endOfBlock++;
    items = [];
    for (let i = readIdx + 1; i < endOfBlock; i++) {
      const m = lines[i].match(/^\s+-\s+(.*?)\s*$/);
      if (m) items.push(m[1].replace(/^["']|["']$/g, ''));
    }
  } else {
    const value = afterColon.trim();
    const flow = value.match(/^\[([^\]]*)\]$/);
    if (flow) {
      items = flow[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else if (value === '~' || value === 'null' || value === '[]' || value === '') {
      items = [];
    } else {
      items = [value.replace(/^["']|["']$/g, '')];
    }
  }

  if (!items.includes(relPath)) return existingYaml;

  const filtered = items.filter((x) => x !== relPath);
  const before = lines.slice(0, readIdx);
  const after = lines.slice(endOfBlock);

  if (filtered.length === 0) {
    const stitched = [...before, ...after].join('\n');
    if (stitched === '') return '';
    return stitched.endsWith('\n') ? stitched : stitched + '\n';
  }
  const replacement = ['read:', ...filtered.map((x) => `  - ${x}`)];
  const stitched = [...before, ...replacement, ...after].join('\n');
  return stitched.endsWith('\n') ? stitched : stitched + '\n';
}
