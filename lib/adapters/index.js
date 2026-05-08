// lib/adapters/index.js
// Flat adapter registry. Phase 2 shipped Claude Code; Phase 3 added the
// remaining 8 Tier 1 adapters (9 total); Phase 4 adds 12 Tier 2 adapters
// (21 total). Cody (TIER2-03) is deferred. Adding a new adapter = one file
// in lib/adapters/ + one line here. Per ORC-08.
//
// Order is alphabetical-by-id for deterministic detect-order output (see
// research §Common Pitfalls → Pitfall 13).
//
// `continue` is a JS reserved word so it is imported under an aliased
// binding below. Adapter `id` fields are still the canonical kebab-case
// strings — the orchestrator filters by id, not by import name.
import aider from './aider.js';
import amazonQ from './amazon-q.js';
import claudeCode from './claude-code.js';
import cline from './cline.js';
import codex from './codex.js';
import continueAdapter from './continue.js';
import copilotChat from './copilot-chat.js';
import cursor from './cursor.js';
import gemini from './gemini.js';
import goose from './goose.js';
import hostedFallback from './hosted-fallback.js';
import jetbrains from './jetbrains.js';
import kiloCode from './kilo-code.js';
import opencode from './opencode.js';
import pearai from './pearai.js';
import pieces from './pieces.js';
import plandex from './plandex.js';
import rooCode from './roo-code.js';
import tabnine from './tabnine.js';
import windsurf from './windsurf.js';
import zed from './zed.js';

const adapters = [
  aider,
  amazonQ,
  claudeCode,
  cline,
  codex,
  continueAdapter,
  copilotChat,
  cursor,
  gemini,
  goose,
  hostedFallback,
  jetbrains,
  kiloCode,
  opencode,
  pearai,
  pieces,
  plandex,
  rooCode,
  tabnine,
  windsurf,
  zed,
];
export default adapters;
