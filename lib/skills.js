// lib/skills.js — single-pass skills loader.
//
// Reads skills/*.md once and returns the canonical in-memory shape consumed
// by every format transform (FMT-01..05) and every adapter that follows.
// Per FND-08.
//
// SKILLS_DIR is resolved via fileURLToPath(import.meta.url) — anchored to the
// module location. This works identically when the package is installed at
// node_modules/10x-engineer/lib/skills.js and never depends on cwd.
//
// File reads are sequential. There are 10 small files; concurrency wins
// nothing here, and ordered iteration keeps the alphabetical-stability
// invariant trivially provable.

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './frontmatter.js';

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(here, '..', 'skills');

/**
 * Load every skills/*.md, parse frontmatter, return canonical in-memory array.
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
  const entries = (await readdir(SKILLS_DIR))
    .filter(f => f.endsWith('.md'))
    .sort();

  const skills = [];
  for (const filename of entries) {
    const fullPath = join(SKILLS_DIR, filename);
    const src = await readFile(fullPath, 'utf8');
    const { data, body } = parseFrontmatter(src);
    const id = basename(filename, extname(filename));
    skills.push({
      id,
      name: data.name,
      description: data.description,
      when_to_use: data.when_to_use,
      body,
      data,
      frontmatter: data,
    });
  }
  return skills;
}
