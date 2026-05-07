// lib/adapters/index.js
// Flat adapter registry. Phase 2 shipped Claude Code; Phase 3 adds the
// remaining 8 Tier 1 adapters. Adding a new adapter = one file in
// lib/adapters/ + one line here. Per ORC-08.
//
// Order is alphabetical-by-id for deterministic detect-order output.
// `continue` is a JS reserved word so it is imported under an aliased
// binding below. The adapter's `id` field is still `'continue'` — the
// orchestrator filters by id, not by import name.
import aider from './aider.js';
import claudeCode from './claude-code.js';
import cline from './cline.js';
import codex from './codex.js';
import continueAdapter from './continue.js';
import cursor from './cursor.js';
import gemini from './gemini.js';
import kiloCode from './kilo-code.js';
import opencode from './opencode.js';

const adapters = [
  aider,
  claudeCode,
  cline,
  codex,
  continueAdapter,
  cursor,
  gemini,
  kiloCode,
  opencode,
];
export default adapters;
