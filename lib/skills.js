// lib/skills.js — single-pass skills loader, partitioned into response-mode
// and build-mode loaders.
//
// Two named exports:
//
//   loadSkills()           — returns the 10 response-mode skills. Filters
//                            out any filename matching `build-*.md` so that
//                            every Tier-1 and Tier-2 adapter receiving this
//                            array emits ONLY response-mode rule bodies via
//                            the format transforms. Build-mode content is
//                            routed through (a) BUILD_MODE_INSTRUCTION inside
//                            every always-on rule body, and (b) the
//                            persona.txt section-separator concatenation
//                            performed by the persona-builder helper.
//                            Build-mode skill bodies are NEVER emitted as
//                            standalone .mdc / per-skill files.
//
//   loadBuildModeSkills()  — returns only `build-*.md` skill files. Returns
//                            [] gracefully if no build-* files exist (e.g.
//                            a tarball stripped of build-mode artefacts).
//                            Guarantees `build-mode-overview.md` is the
//                            FIRST entry when present — the persona-builder
//                            reads in this order so the catalogue overview
//                            precedes individual scaffolders / sub-artefacts
//                            in the runtime payload.
//
// SKILLS_DIR is resolved via fileURLToPath(import.meta.url) — anchored to the
// module location. This works identically when the package is installed at
// node_modules/10x-engineer/lib/skills.js and never depends on cwd.
//
// File reads are sequential. Concurrency wins nothing on the current set
// (≤ 25 small files at v1.0); ordered iteration keeps alphabetical-stability
// trivially provable within each subset.

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './frontmatter.js';

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(here, '..', 'skills');

// Read + parse a single skills/*.md file into the canonical entry shape.
// Shared between loadSkills and loadBuildModeSkills — single source of the
// canonical-shape contract.
async function readSkill(filename) {
  const fullPath = join(SKILLS_DIR, filename);
  const src = await readFile(fullPath, 'utf8');
  const { data, body } = parseFrontmatter(src);
  const id = basename(filename, extname(filename));
  return {
    id,
    name: data.name,
    description: data.description,
    when_to_use: data.when_to_use,
    body,
    data,
    frontmatter: data,
  };
}

// List skills/*.md files alphabetically. Used by both loaders before each
// applies its filename filter.
async function listMarkdownEntries() {
  return (await readdir(SKILLS_DIR))
    .filter((f) => f.endsWith('.md'))
    .sort();
}

// Phase 1 response-mode skills whose filenames coincidentally start with the
// `build-` prefix. These predate the Phase 7 build-mode catalogue and remain
// part of the response-mode set. The Phase 8 build-mode counterpart for
// `build-system-from-scratch.md` is the double-prefixed
// `build-build-system-from-scratch.md` listed in build-mode-overview.md.
const RESPONSE_MODE_PREFIX_COLLISIONS = new Set([
  'build-system-from-scratch.md',
]);

// Predicate: filename belongs to the build-mode set (build-mode-overview.md
// or any Phase 8 child) and is NOT a response-mode prefix collision.
function isBuildModeFile(filename) {
  return (
    filename.startsWith('build-') &&
    !RESPONSE_MODE_PREFIX_COLLISIONS.has(filename)
  );
}

/**
 * Load every response-mode skill (skills/*.md, EXCLUDING build-*.md), parse
 * frontmatter, return canonical in-memory array in alphabetical filename order.
 *
 * Each entry has:
 *   id           — basename without .md extension
 *   name         — from frontmatter
 *   description  — from frontmatter
 *   when_to_use  — from frontmatter
 *   body         — post-fence content, verbatim
 *   data         — alias of the parsed frontmatter object
 *   frontmatter  — same reference as data (different consumers expect different names)
 *
 * Entries are returned in alphabetical filename order — pinned for downstream
 * stability so format transforms can index by position deterministically.
 *
 * @returns {Promise<Array<{
 *   id: string,
 *   name: string,
 *   description: string,
 *   when_to_use: string,
 *   body: string,
 *   data: { name: string, description: string, when_to_use: string },
 *   frontmatter: { name: string, description: string, when_to_use: string },
 * }>>}
 */
export async function loadSkills() {
  const entries = (await listMarkdownEntries()).filter(
    (f) => !isBuildModeFile(f),
  );
  const skills = [];
  for (const filename of entries) {
    skills.push(await readSkill(filename));
  }
  return skills;
}

/**
 * Load every build-mode skill (skills/build-*.md), parse frontmatter, return
 * canonical in-memory array. `build-mode-overview.md` is guaranteed FIRST when
 * present; remaining entries follow in alphabetical filename order.
 *
 * Returns [] when no build-* files exist on disk (graceful degradation).
 *
 * @returns {Promise<Array<{
 *   id: string,
 *   name: string,
 *   description: string,
 *   when_to_use: string,
 *   body: string,
 *   data: { name: string, description: string, when_to_use: string },
 *   frontmatter: { name: string, description: string, when_to_use: string },
 * }>>}
 */
export async function loadBuildModeSkills() {
  const allBuild = (await listMarkdownEntries()).filter(isBuildModeFile);
  if (allBuild.length === 0) return [];

  // Reorder: build-mode-overview.md first, then the rest alphabetically.
  const OVERVIEW = 'build-mode-overview.md';
  const ordered = [];
  if (allBuild.includes(OVERVIEW)) ordered.push(OVERVIEW);
  for (const f of allBuild) {
    if (f !== OVERVIEW) ordered.push(f);
  }

  const skills = [];
  for (const filename of ordered) {
    skills.push(await readSkill(filename));
  }
  return skills;
}
