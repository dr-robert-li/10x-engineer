// lib/adapters/hosted-fallback.js
//
// Path source: https://github.com/dr-robert-li/10x-engineer/blob/main/CLAUDE.md, verified 2026-05-08
//
// Tier 2 adapter — hosted-agent fallback for Sweep, Devin, and any hosted
// (server-side) runner where filesystem install is not possible.
//
// detect() always returns found:false — the adapter appears in `list` under
// the not-found bucket (per ORC-02 + ROADMAP Phase 4 SC#4). The orchestrator
// does NOT special-case suppress this adapter from list output.
//
// Users invoke explicitly via:
//   npx 10x-engineer install --harness hosted-fallback
//
// install() and uninstall() perform ZERO filesystem I/O for any scope or
// dryRun value. install() returns skipped: with the user-facing message.
// uninstall() is a no-op.
//
// Pitfall 1 invariant: this adapter MUST NOT throw — Promise.allSettled
// would catch any throw silently and the user-facing message would never
// surface. The test suite asserts assert.doesNotReject() against every
// entry point.

const HOSTED_FALLBACK_MESSAGE =
  'Hosted agents (Sweep, Devin, server-side runners) cannot be installed via\n' +
  'filesystem — copy the persona manually:\n' +
  '  - Concatenated persona: npx 10x-engineer print\n' +
  '  - Per-harness bundles:  npx 10x-engineer export <dir>';

export default {
  id: 'hosted-fallback',
  displayName: 'Hosted agent (manual install)',
  format: 'none', // no format consumed; this adapter never writes

  async detect() {
    return { found: false };
  },

  async install() {
    return { written: [], skipped: [HOSTED_FALLBACK_MESSAGE] };
  },

  async uninstall() {
    return { removed: [] };
  },
};
