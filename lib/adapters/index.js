// lib/adapters/index.js
// Flat adapter registry. Phase 2 ships the vertical-slice adapter; Phase 3+
// appends Tier 1 + Tier 2 adapters. Adding a new adapter = one file in
// lib/adapters/ + one line here. Per ORC-08.
import claudeCode from './claude-code.js';

const adapters = [claudeCode];
export default adapters;
