// lib/install.js — orchestrator. The single chokepoint that ties every prior
// module together. Five public entry points correspond to the five commander
// subcommands defined in bin/cli.js (Plan 02-08):
//
//   runInstall     install
//   runUninstall   uninstall
//   runList        list
//   runPrint       print
//   runExport      export
//
// Cross-phase invariants enforced here:
//
//   1. requireConsent is called EXACTLY ONCE per runInstall, BEFORE the
//      adapter loop — ORC-05.
//   2. requireConsent is NEVER imported by any adapter — pinned by the
//      Phase 5 grep gate. This file is the SOLE caller in the codebase.
//   3. --all does NOT skip the disclaimer; only --yes / --i-accept-the-token-bill
//      / --dry-run do — D2-06 / D2-08 / ORC-06.
//   4. Adapter throwing during install() yields a per-row 'errored' result;
//      the loop continues with the next adapter — ORC-07.
//   5. Exit code matrix (CLI-13):
//        0 — full success
//        1 — no harnesses detected
//        2 — disclaimer declined (ConsentDeclinedError)
//        3 — non-interactive without --yes (NonInteractiveError)
//        4 — at least one adapter errored during install/uninstall
//   6. picocolors auto-suppresses ANSI on non-TTY — piped output emits zero
//      ANSI escape bytes.
//   7. uninstall does NOT call requireConsent — CLI-07 (non-destructive intent).
//   8. cwd, homedir, and the streams object (stdin/stdout/stderr) are all
//      injected so tests can drive the orchestrator with mkdtemp environments
//      and Writable buffers — D2-24. Production callers in bin/cli.js pass
//      `process.cwd()`, `os.homedir()`, and inherit the real streams.

import pc from 'picocolors';
import { homedir as osHomedir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { detectAll } from './detect.js';
import { loadSkills } from './skills.js';
import { clearState } from './state.js';
import adapters from './adapters/index.js';
import {
  requireConsent,
  promptScope,
  promptHarnessSelection,
  ConsentDeclinedError,
  NonInteractiveError,
} from './disclaimer.js';
import { transform as nativeSkillsTransform } from './format/native-skills.js';

// ---------------------------------------------------------------------------
// Stream resolution.
// Every public entry point accepts an optional `streams` object so tests can
// pass Writable buffers without touching process.stdout / process.stderr.
// node:test reports test results to its parent over the real stdout via an
// IPC protocol; if a test monkey-patches process.stdout, the IPC frames for
// the *next* test get eaten silently. So: we never touch process.stdout in
// this module unless the caller declined to pass `streams`.
// ---------------------------------------------------------------------------

function resolveStreams(streams = {}) {
  return {
    stdin: streams.stdin || process.stdin,
    stdout: streams.stdout || process.stdout,
    stderr: streams.stderr || process.stderr,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Filter the registry by harness id. Empty harness → full registry copy. */
function filterAdapters(harness) {
  if (!harness) return adapters.slice();
  return adapters.filter((a) => a.id === harness);
}

/** Run detect() on a list of adapters with allSettled fan-out, returning the
 *  same three-bucket shape as detectAll but scoped to the supplied subset. */
async function detectSubset(registry, ctx) {
  const settled = await Promise.allSettled(
    registry.map(async (a) => ({ adapter: a, result: await a.detect(ctx) })),
  );
  const found = [];
  const notFound = [];
  const detectionErrored = [];
  for (let i = 0; i < settled.length; i++) {
    const a = registry[i];
    const s = settled[i];
    if (s.status === 'rejected') {
      detectionErrored.push({ adapter: a, error: s.reason });
    } else if (s.value.result.found) {
      found.push({ adapter: a, ...s.value.result });
    } else {
      notFound.push({ adapter: a });
    }
  }
  return { found, notFound, detectionErrored };
}

/** Translate the boolean-returning requireConsent into the exit-code-friendly
 *  exception shape used by the orchestrator. The cases:
 *
 *    proceed=true  → return (caller continues)
 *    proceed=false → either NonInteractiveError or ConsentDeclinedError
 *
 *  Discrimination rule: if no bypass flag was set AND stdin is non-TTY, the
 *  disclaimer module refused interactively without reading stdin → that's a
 *  NonInteractiveError. Otherwise the user typed something other than 'y' →
 *  that's a ConsentDeclinedError.
 */
async function gateConsent({ yes, iAcceptTheTokenBill, dryRun, streams }) {
  const proceed = await requireConsent(
    {
      yes,
      acceptTokenBill: iAcceptTheTokenBill,
      dryRun,
      subcommand: 'install',
    },
    streams,
  );
  if (proceed) return;
  const bypassed = yes || iAcceptTheTokenBill || dryRun;
  if (!bypassed && !streams.stdin.isTTY) throw new NonInteractiveError();
  throw new ConsentDeclinedError();
}

/** Print one result row. picocolors auto-suppresses ANSI on non-TTY. */
function printRow(result, { verbose, streams }) {
  const name = pc.bold(result.adapter.displayName);
  if (result.status === 'written') {
    streams.stdout.write(`${pc.green('✓')} ${name} — ${result.written.length} files\n`);
    if (verbose && Array.isArray(result.written)) {
      for (const p of result.written) {
        streams.stdout.write(`  ${pc.dim('→')} ${p}\n`);
      }
    }
    return;
  }
  if (result.status === 'removed') {
    const n = Array.isArray(result.removed) ? result.removed.length : 0;
    streams.stdout.write(`${pc.green('✓')} ${name} — removed ${n}\n`);
    if (verbose && Array.isArray(result.removed)) {
      for (const p of result.removed) {
        streams.stdout.write(`  ${pc.dim('→')} ${p}\n`);
      }
    }
    return;
  }
  if (result.status === 'skipped') {
    streams.stdout.write(`${pc.dim('·')} ${name} — skipped (${result.reason})\n`);
    return;
  }
  if (result.status === 'errored') {
    streams.stdout.write(`${pc.red('✗')} ${name} — ${pc.dim(result.error.message)}\n`);
    if (verbose && result.error && result.error.stack) {
      streams.stderr.write(pc.dim(result.error.stack) + '\n');
    }
  }
}

/** End-of-run summary listing every errored adapter. Surfaces detection
 *  errors too so the user sees the full picture. */
function printSummary({ results, detectionErrored, streams }) {
  const errored = results.filter((r) => r.status === 'errored');
  if (errored.length === 0 && detectionErrored.length === 0) return;
  streams.stderr.write('\n' + pc.bold('Errors:') + '\n');
  for (const r of errored) {
    const path = r.wouldBePath ? `  (target: ${r.wouldBePath})` : '';
    streams.stderr.write(
      `  ${pc.red('✗')} ${r.adapter.displayName}: ${r.error.message}${path}\n`,
    );
    streams.stderr.write(
      `     ${pc.dim('Try:')} npx 10x-engineer print  (manual install fallback)\n`,
    );
  }
  for (const e of detectionErrored) {
    streams.stderr.write(
      `  ${pc.red('✗')} ${e.adapter.displayName} (detection): ${e.error.message}\n`,
    );
  }
}

/** Resolve the scope choice for one detected adapter, honouring the override
 *  flags before falling back to promptScope. D2-09 / ORC-06. */
async function resolveScope({ scope, paths, adapter }, opts, streams) {
  if (scope !== 'both') return scope;
  if (opts.globalScope) return 'global';
  if (opts.projectScope) return 'project';
  if (opts.all) return 'both';
  return await promptScope(
    {
      displayName: adapter.displayName,
      globalPath: paths.global,
      projectPath: paths.project,
    },
    streams,
  );
}

/** Choose the would-be path for an errored adapter so the summary can point
 *  the user at where the install was going to write. */
function pickWouldBePath(scope, paths) {
  if (!paths) return null;
  if (scope === 'global') return paths.global || null;
  if (scope === 'project') return paths.project || null;
  if (scope === 'both') return paths.global || paths.project || null;
  return paths.global || paths.project || null;
}

// ---------------------------------------------------------------------------
// runInstall
// ---------------------------------------------------------------------------

/**
 * @param {object} opts
 * @param {string}  [opts.harness]              CLI-03 — filter by adapter id
 * @param {boolean} [opts.all=false]            ORC-06 — bypass scope prompt for 'both'
 * @param {boolean} [opts.globalScope=false]    Force scope='global' for 'both'
 * @param {boolean} [opts.projectScope=false]   Force scope='project' for 'both'
 * @param {boolean} [opts.dryRun=false]         CLI-06 / D2-08
 * @param {boolean} [opts.yes=false]            D2-06
 * @param {boolean} [opts.iAcceptTheTokenBill=false] D2-06
 * @param {boolean} [opts.verbose=false]        D2-10
 * @param {string}  opts.cwd                    injected — process.cwd() at call site
 * @param {string}  [opts.homedir]              injected — defaults to os.homedir()
 * @param {string}  [opts.version]              from package.json
 * @param {object}  [opts.streams]              {stdin, stdout, stderr} — test seam
 * @returns {Promise<number>} exit code per CLI-13
 */
export async function runInstall({
  harness,
  all = false,
  globalScope = false,
  projectScope = false,
  dryRun = false,
  yes = false,
  iAcceptTheTokenBill = false,
  verbose = false,
  cwd,
  homedir = osHomedir(),
  version,
  streams,
} = {}) {
  const s = resolveStreams(streams);
  const ctx = { cwd, homedir };

  const registry = filterAdapters(harness);
  if (registry.length === 0) {
    s.stderr.write(
      harness
        ? `Harness '${harness}' not found in registry.\n`
        : 'No adapters registered.\n',
    );
    return 1;
  }

  const skills = await loadSkills();
  let { found, detectionErrored } = await detectSubset(registry, ctx);

  if (found.length === 0) {
    s.stderr.write('No supported harnesses detected.\n');
    for (const e of detectionErrored) {
      s.stderr.write(
        `${pc.red('✗')} ${e.adapter.displayName} (detection): ${e.error.message}\n`,
      );
    }
    return 1;
  }

  // Centralised consent gate — ORC-05.
  try {
    await gateConsent({ yes, iAcceptTheTokenBill, dryRun, streams: s });
  } catch (e) {
    if (e instanceof ConsentDeclinedError) {
      s.stderr.write(`${e.message}\n`);
      return 2;
    }
    if (e instanceof NonInteractiveError) {
      s.stderr.write(`${e.message}\n`);
      return 3;
    }
    throw e;
  }

  // Interactive harness selection (v0.2.0). Skipped when the user has
  // already narrowed the target via --all or --harness, or when stdin is
  // not a TTY (the consent gate above already refused such a session
  // unless a bypass flag was supplied; in that case we install to every
  // detected harness, matching the pre-v0.2.0 behaviour).
  const skipHarnessPrompt = all || harness || !s.stdin.isTTY;
  if (!skipHarnessPrompt) {
    const selectedIds = await promptHarnessSelection({ found }, s);
    if (selectedIds.length === 0) {
      s.stdout.write('No harnesses selected — nothing to do.\n');
      return 0;
    }
    found = found.filter((e) => selectedIds.includes(e.adapter.id));
  }

  const results = [];
  for (const entry of found) {
    const { adapter, paths } = entry;
    const chosenScope = await resolveScope(
      entry,
      { all, globalScope, projectScope },
      s,
    );

    if (chosenScope === 'skip') {
      const result = { adapter, status: 'skipped', reason: 'declined scope' };
      results.push(result);
      printRow(result, { verbose, streams: s });
      continue;
    }

    try {
      const r = await adapter.install({
        skills,
        scope: chosenScope,
        paths,
        dryRun,
        version,
      });
      const result = { adapter, status: 'written', ...r };
      results.push(result);
      printRow(result, { verbose, streams: s });
    } catch (e) {
      const result = {
        adapter,
        status: 'errored',
        error: e,
        wouldBePath: pickWouldBePath(chosenScope, paths),
      };
      results.push(result);
      printRow(result, { verbose, streams: s });
    }
  }

  printSummary({ results, detectionErrored, streams: s });

  return results.some((r) => r.status === 'errored') ? 4 : 0;
}

// ---------------------------------------------------------------------------
// runUninstall
//
// No consent gate — CLI-07. Uninstall is non-destructive intent: removing
// what we wrote. Adapters know the markers / dirs that belong to us.
// ---------------------------------------------------------------------------

export async function runUninstall({
  harness,
  dryRun = false,
  verbose = false,
  cwd,
  homedir = osHomedir(),
  streams,
} = {}) {
  const s = resolveStreams(streams);
  const ctx = { cwd, homedir };
  const registry = filterAdapters(harness);
  if (registry.length === 0) {
    s.stderr.write(
      harness
        ? `Harness '${harness}' not found in registry.\n`
        : 'No adapters registered.\n',
    );
    return 1;
  }

  const { found, detectionErrored } = await detectSubset(registry, ctx);

  const results = [];
  for (const entry of found) {
    const { adapter, scope, paths } = entry;
    try {
      const r = await adapter.uninstall({ scope, paths, dryRun });
      const result = { adapter, status: 'removed', ...r };
      results.push(result);
      printRow(result, { verbose, streams: s });
    } catch (e) {
      const result = {
        adapter,
        status: 'errored',
        error: e,
        wouldBePath: pickWouldBePath(scope, paths),
      };
      results.push(result);
      printRow(result, { verbose, streams: s });
    }
  }

  // Surgical-removal of the v0.2.0 runtime state file. clearState is a
  // no-op when ~/.10x-engineer/ does not exist; otherwise it removes the
  // state.json and the now-empty parent dir.
  try {
    await clearState({ homedir, dryRun });
  } catch (e) {
    s.stderr.write(`${pc.red('✗')} state cleanup failed: ${pc.dim(e.message)}\n`);
  }

  printSummary({ results, detectionErrored, streams: s });
  return results.some((r) => r.status === 'errored') ? 4 : 0;
}

// ---------------------------------------------------------------------------
// runList — CLI-09. No consent gate.
// ---------------------------------------------------------------------------

export async function runList({
  verbose = false,
  cwd,
  homedir = osHomedir(),
  streams,
} = {}) {
  const s = resolveStreams(streams);
  const ctx = { cwd, homedir };
  const { found, notFound, errored } = await detectAll(ctx);
  s.stdout.write(pc.bold('Detected:') + '\n');
  if (found.length === 0) {
    s.stdout.write(`  ${pc.dim('(none)')}\n`);
  }
  for (const f of found) {
    s.stdout.write(
      `  ${pc.green('✓')} ${pc.bold(f.adapter.displayName)} — scope: ${f.scope}\n`,
    );
    if (verbose && f.paths) {
      if (f.paths.global) {
        s.stdout.write(`     ${pc.dim('global:')}  ${f.paths.global}\n`);
      }
      if (f.paths.project) {
        s.stdout.write(`     ${pc.dim('project:')} ${f.paths.project}\n`);
      }
    }
  }
  if (notFound.length > 0) {
    s.stdout.write('\n' + pc.bold('Not detected:') + '\n');
    for (const n of notFound) {
      s.stdout.write(`  ${pc.dim('·')} ${n.adapter.displayName}\n`);
    }
  }
  if (errored.length > 0) {
    s.stdout.write('\n' + pc.bold('Errored during detection:') + '\n');
    for (const e of errored) {
      s.stdout.write(
        `  ${pc.red('✗')} ${e.adapter.displayName} — ${pc.dim(e.error.message)}\n`,
      );
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// runPrint — CLI-10. Concatenates the persona to stdout. No consent gate.
// ---------------------------------------------------------------------------

export async function runPrint({ streams } = {}) {
  const s = resolveStreams(streams);
  const skills = await loadSkills();
  const header =
    '# 10x-engineer persona\n\n' +
    'Concatenated persona for manual install. Copy the body of each section\n' +
    'into your harness configuration of choice.\n\n';
  s.stdout.write(header);
  for (const sk of skills) {
    s.stdout.write(`\n## ${sk.name}\n\n`);
    s.stdout.write(`> ${sk.description}\n\n`);
    s.stdout.write(sk.body);
    if (!sk.body.endsWith('\n')) s.stdout.write('\n');
  }
  return 0;
}

// ---------------------------------------------------------------------------
// runExport — CLI-11. Pre-formatted bundles for manual install. No consent
// gate. Phase 2 only ships the native-skills transform; Phase 3 will append
// every other format.
// ---------------------------------------------------------------------------

export async function runExport({ dir, version, streams } = {}) {
  const s = resolveStreams(streams);
  if (!dir) {
    s.stderr.write('export requires a target directory argument\n');
    return 1;
  }
  const skills = await loadSkills();

  const formats = [
    { id: 'native-skills', transform: nativeSkillsTransform },
  ];

  for (const fmt of formats) {
    const out = fmt.transform(skills, version);
    const targetDir = join(dir, fmt.id);
    await mkdir(targetDir, { recursive: true });
    for (const file of out) {
      await writeFile(join(targetDir, file.relativePath), file.content);
    }
    s.stdout.write(
      `${pc.green('✓')} wrote ${out.length} ${fmt.id} files to ${targetDir}\n`,
    );
  }
  return 0;
}
