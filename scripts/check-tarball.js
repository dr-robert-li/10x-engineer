#!/usr/bin/env node
// scripts/check-tarball.js — pre-publish undercover-mode gate.
//
// Validates three surfaces:
//   1. Tarball contents (every shipped file scanned for forbidden fingerprints,
//      filtered by legitimate-uses.json allowlist).
//   2. package-lock.json (no allowlist — any forbidden pattern is contamination).
//   3. git log --all — NARROWED scope: author-identity drift +
//      trailers/footers/email-leak patterns only. Harness brand names are
//      sanctioned in commit subjects describing adapter work and are
//      therefore NOT scanned against git log. See auditGitLog for the full
//      pattern list and rationale.
//
// Exit codes:
//   0 — clean
//   1 — fingerprint hit in tarball outside allowlist
//   2 — git log audit failure (author drift OR forbidden pattern in commit body)
//   3 — package-lock.json contamination
//   4 — npm pack failure / setup error
//
// Wired manually (`node scripts/check-tarball.js`) and as `npm run check-tarball`
// + `prepublishOnly` after 05-06 wires the package.json script aliases.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const EXPECTED_AUTHOR = 'dr-robert-li <dr.robert.li.au@gmail.com>';

// ---- 1. Load forbidden patterns + allowlist ---------------------------------
function loadPatterns() {
  const forbidPath = join(REPO_ROOT, 'forbidden-fingerprints.txt');
  const allowPath = join(REPO_ROOT, 'legitimate-uses.json');
  const forbid = readFileSync(forbidPath, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim() && !l.startsWith('#'));
  const allow = JSON.parse(readFileSync(allowPath, 'utf8'));
  // Build pattern -> allowed_globs map for O(1) lookup.
  const allowMap = new Map();
  for (const entry of allow) {
    allowMap.set(entry.pattern, entry.allowed_globs);
  }
  return { forbid, allowMap };
}

// ---- 2. Glob match (no external dep — micromatch-like for simple globs) ----
// Supports `*` (single segment), `**` (any), exact paths.
function globMatch(pattern, path) {
  // Normalise both to forward slashes.
  const p = path.replace(/\\/g, '/');
  // Build regex from glob.
  const re = new RegExp(
    '^' +
      pattern
        .replace(/\\/g, '/')
        .replace(/[.+^${}()|[\]]/g, '\\$&')
        .replace(/\*\*/g, '__DOUBLESTAR__')
        .replace(/\*/g, '[^/]*')
        .replace(/__DOUBLESTAR__/g, '.*') +
      '$',
  );
  return re.test(p);
}

function isAllowed(pattern, filePath, allowMap) {
  const globs = allowMap.get(pattern);
  if (!globs || globs.length === 0) return false;
  return globs.some((g) => globMatch(g, filePath));
}

// ---- 3. Walk a directory recursively yielding {relPath, content} -----------
function* walkFiles(rootDir, prefix = '') {
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const full = join(rootDir, entry.name);
    const rel = prefix ? join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      yield* walkFiles(full, rel);
    } else if (entry.isFile()) {
      // Skip binaries (heuristic: read first 8KB, check for null bytes)
      const buf = readFileSync(full);
      if (buf.includes(0)) continue;
      yield { relPath: rel.replace(/\\/g, '/'), content: buf.toString('utf8') };
    }
  }
}

// ---- 4. Scan a (relPath, content) pair against forbidden+allowlist ---------
function scanFile(relPath, content, forbid, allowMap, hits) {
  for (const pattern of forbid) {
    let re;
    try {
      re = new RegExp(pattern, 'gi');
    } catch (e) {
      console.error(`Invalid pattern: ${pattern}`);
      continue;
    }
    let m;
    while ((m = re.exec(content)) !== null) {
      if (!isAllowed(pattern, relPath, allowMap)) {
        // Compute line number
        const upToMatch = content.slice(0, m.index);
        const lineNum = upToMatch.split('\n').length;
        hits.push({ pattern, file: relPath, line: lineNum, match: m[0] });
      }
      // Avoid infinite loop on zero-width matches (shouldn't happen with our patterns)
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
}

// ---- 5. Run npm pack --dry-run and extract the file list -------------------
function getTarballFileList() {
  const out = execSync('npm pack --dry-run --json', {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const arr = JSON.parse(out);
  // npm pack returns an array; first element has files[].
  if (!Array.isArray(arr) || !arr[0] || !Array.isArray(arr[0].files)) {
    throw new Error('Unexpected npm pack output');
  }
  return arr[0].files.map((f) => f.path);
}

// ---- 6. Audit git log ------------------------------------------------------
//
// SCOPE — narrowed (locked decision, 2026-05-08):
//
// The git-log audit checks only TWO surfaces:
//   (a) commit author identity drift, and
//   (b) co-authoring trailers / agent-tool footers / email leaks in commit
//       bodies.
//
// Harness brand names (Cursor, Aider, Codex, opencode, etc.) are NOT
// scanned in git log. Per the project's authoring rules, harness names are
// sanctioned in commit subjects describing adapter work — `feat(adapters):
// add aider adapter` is legitimate per-rule, not contamination. Scanning
// the full forbidden-fingerprints list against git log produced ~200
// false-positive hits on these legitimate adapter-work commits.
//
// The full forbidden-fingerprints list still applies to tarball contents
// (with allowlist) and package-lock.json (no allowlist) — the two surfaces
// users actually consume. git log is a developer-only surface; trailers
// and author-drift are the only fingerprints that matter there.
const GIT_LOG_PATTERNS = [
  // Co-authoring trailers and agent-tool footers — never legitimate.
  'Co-Authored-By',
  'Co-authored-by',
  '🤖 Generated with',
  '🤖',
  'Generated by',
  'Authored by AI',
  'AI-assisted',
  'ai-assisted',
  '\\(C\\)laude',
  // Email/domain leak patterns — never legitimate.
  '@anthropic\\.com',
  'noreply@anthropic',
];

function auditGitLog(hits) {
  // 6a. Author identity audit — any commit author ≠ EXPECTED_AUTHOR fails.
  const authors = execSync(
    'git log --all --pretty=format:%an\\ \\<%ae\\>',
    { cwd: REPO_ROOT, encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);
  const driftedAuthors = [...new Set(authors.filter((a) => a !== EXPECTED_AUTHOR))];
  if (driftedAuthors.length > 0) {
    hits.push({
      pattern: '<author drift>',
      file: 'git log',
      line: 0,
      match: `unexpected authors: ${driftedAuthors.join(', ')}`,
    });
  }

  // 6b. Commit body audit — narrowed to trailer + email-leak patterns only.
  const fullLog = execSync(
    'git log --all --pretty=format:%H%n%an\\ \\<%ae\\>%n%s%n%b%n---END---',
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  for (const pattern of GIT_LOG_PATTERNS) {
    let re;
    try {
      re = new RegExp(pattern, 'gi');
    } catch {
      continue;
    }
    let m;
    while ((m = re.exec(fullLog)) !== null) {
      // git log has no allowlist — any hit on the narrowed list is contamination.
      const upToMatch = fullLog.slice(0, m.index);
      const lineNum = upToMatch.split('\n').length;
      hits.push({ pattern, file: 'git log', line: lineNum, match: m[0] });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
}

// ---- 7. Main ---------------------------------------------------------------
async function main() {
  const { forbid, allowMap } = loadPatterns();

  // Tarball contents scan
  const tarballHits = [];
  let fileList;
  try {
    fileList = getTarballFileList();
  } catch (e) {
    console.error(`npm pack --dry-run failed: ${e.message}`);
    process.exit(4);
  }
  for (const relPath of fileList) {
    const full = join(REPO_ROOT, relPath);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    const buf = readFileSync(full);
    if (buf.includes(0)) continue; // binary skip
    scanFile(relPath, buf.toString('utf8'), forbid, allowMap, tarballHits);
  }

  // package-lock.json scan (no allowlist — any hit is contamination)
  const lockfileHits = [];
  const lockPath = join(REPO_ROOT, 'package-lock.json');
  if (existsSync(lockPath)) {
    const lockContent = readFileSync(lockPath, 'utf8');
    // For lockfile, allowMap is empty (no legitimate uses); use empty map.
    scanFile('package-lock.json', lockContent, forbid, new Map(), lockfileHits);
  }

  // git log audit (narrowed to trailers + author-drift; see auditGitLog notes)
  const gitHits = [];
  auditGitLog(gitHits);

  // Report
  const totalHits = tarballHits.length + lockfileHits.length + gitHits.length;
  if (totalHits === 0) {
    console.log('check-tarball: clean ✓');
    console.log(`  scanned ${fileList.length} tarball files, package-lock.json, git log`);
    process.exit(0);
  }

  console.error(`check-tarball: ${totalHits} contamination hits`);
  for (const h of [...tarballHits, ...lockfileHits, ...gitHits]) {
    console.error(`  ${h.file}:${h.line}  /${h.pattern}/  → "${h.match}"`);
  }

  // Exit code precedence: lockfile (3) > git (2) > tarball (1).
  if (lockfileHits.length > 0) process.exit(3);
  if (gitHits.length > 0) process.exit(2);
  process.exit(1);
}

main().catch((e) => {
  console.error(`check-tarball: unexpected error — ${e.stack || e.message}`);
  process.exit(4);
});
