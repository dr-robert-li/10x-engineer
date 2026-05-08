#!/usr/bin/env node
// lib/hooks/session-start.js — session-start runtime persona injection.
//
// Invoked by the host runner at session start. Reads the runtime state file
// each invocation. When the persona is engaged, writes the full ruleset
// (read from a sibling persona.txt written at install time) to stdout; the
// host runner injects that text as hidden context the model sees but the
// user does not. When disengaged, the script silent-exits with no output.
//
// Self-contained: no imports from this package's lib/ modules. The host
// runner invokes the script as `node <absolute-path>` with no node_modules
// in scope. State file path semantics (~/.10x-engineer/state.json) must be
// duplicated here verbatim — the file is the cross-process contract.
//
// Persona path resolution: PERSONA_FILE env-var (TEST-only override) takes
// precedence over the sibling persona.txt resolved from import.meta.dirname.
// In production the installer copies this script to <homedir>/.claude/hooks/
// (or <homedir>/.codex/hooks/) alongside a persona.txt the same install
// wrote — the unset-env path resolves correctly. Tests redirect via the env
// var so they never need to write into the source tree's lib/hooks/.
//
// Fail-closed contract: any error during state-file or persona-file read
// (ENOENT, SyntaxError, EACCES, anything) resolves to a silent exit-0.
// Never write to stderr; never crash. A surfaced error in the user's
// transcript would break the dormant-install illusion.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const STATE_FILE = join(homedir(), '.10x-engineer', 'state.json');
const PERSONA_FILE = process.env.PERSONA_FILE || join(import.meta.dirname, 'persona.txt');

async function isEngaged() {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && parsed.enabled === true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await isEngaged())) {
    process.exit(0); // silent — no stdout
  }
  try {
    const persona = await readFile(PERSONA_FILE, 'utf8');
    process.stdout.write(persona);
  } catch {
    // Persona file missing or unreadable — silent fail. Do not crash the
    // host's session-start path.
  }
  process.exit(0);
}

main().catch(() => process.exit(0));
