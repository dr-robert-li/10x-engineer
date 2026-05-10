// lib/adapters/index.js
// Flat adapter registry. Adding a new adapter = one file in lib/adapters/
// + one line here.
//
// Order is alphabetical-by-id for deterministic detect-order output.
//
// `continue` is a JS reserved word so it is imported under an aliased
// binding below. Adapter `id` fields are still the canonical kebab-case
// strings — the orchestrator filters by id, not by import name.
import aider from './aider.js';
import claudeCode from './claude-code.js';
import cline from './cline.js';
import codex from './codex.js';
import continueAdapter from './continue.js';
import cursor from './cursor.js';
import gemini from './gemini.js';
import hermesAgent from './hermes-agent.js';
import hostedFallback from './hosted-fallback.js';
import kiloCode from './kilo-code.js';
import opencode from './opencode.js';
import rooCode from './roo-code.js';

const adapters = [
  aider,
  claudeCode,
  cline,
  codex,
  continueAdapter,
  cursor,
  gemini,
  hermesAgent,
  hostedFallback,
  kiloCode,
  opencode,
  rooCode,
];
export default adapters;
