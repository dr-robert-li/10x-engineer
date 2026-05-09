// lib/adapters/helpers/persona-builder.js
//
// Shared helper for adapters that install a hook-driven runtime persona.
// Used by the two hook-installing adapters so each writes the same canonical
// response-mode persona + section separator + build-mode persona.
//
// Phase 6 wrote persona.txt with response-mode skills only. Phase 7
// (BUILD-02) extends the format to include the build-mode catalogue and
// (when present) the 12 child skills, with PERSONA_SECTION_SEPARATOR
// between the two halves. The session-start hook reads ONE persona.txt
// and emits its contents verbatim — no runtime concatenation logic.
//
// Graceful degradation (ROADMAP Phase 7 success criterion #2): when the
// build-mode skill set is empty (no build-*.md files on disk), the helper
// returns the response-mode persona only — no separator, no trailing
// build-mode header. The hook payload stays valid; the host loads the
// response-mode persona alone.

import { PERSONA_SECTION_SEPARATOR } from '../../state-gate-instruction.js';

const PERSONA_HEADER =
  '# 10x-engineer persona\n\n' +
  'Concatenated persona for hook-driven runtime injection.\n\n';

const BUILD_MODE_HEADER =
  '# 10x-engineer persona — build-mode extensions\n\n' +
  'Artefact-producing patterns. Apply when the user requests a tangible output.\n\n';

function renderSection(sk) {
  const heading = `## ${sk.name}\n\n`;
  const blurb = `> ${sk.description}\n\n`;
  const body = sk.body.endsWith('\n') ? sk.body : sk.body + '\n';
  return heading + blurb + body;
}

function renderResponseModePersona(skills) {
  const sections = skills.map(renderSection);
  return PERSONA_HEADER + sections.join('\n');
}

function renderBuildModePersona(skills) {
  const sections = skills.map(renderSection);
  return BUILD_MODE_HEADER + sections.join('\n');
}

/**
 * Build the persona.txt content from the response-mode and build-mode
 * skill arrays. Section separator from lib/state-gate-instruction.js.
 *
 * @param {Array<{name: string, description: string, body: string}>} responseSkills
 * @param {Array<{name: string, description: string, body: string}>} [buildSkills]
 * @returns {string}
 */
export function buildPersonaText(responseSkills, buildSkills) {
  const responseHalf = renderResponseModePersona(responseSkills);
  if (!buildSkills || buildSkills.length === 0) {
    return responseHalf;
  }
  return responseHalf + PERSONA_SECTION_SEPARATOR + renderBuildModePersona(buildSkills);
}
