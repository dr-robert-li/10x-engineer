#!/usr/bin/env node
// bin/cli.js — commander-based front door. Five subcommands map 1:1 to the
// five public entry points in lib/install.js. Each action handler awaits the
// orchestrator's exit code and calls process.exit(code) so the shell's exit
// status reflects the orchestrator's return value (CLI-13).
//
// Cross-phase invariants:
//   1. Shebang on line 1 + chmod 755 — npm injects the Windows .cmd shim
//      automatically (D2-26).
//   2. Argument parsing flows through commander; process.argv is never read
//      directly (CLI-01).
//   3. pkg.version is read once at startup via the import.meta URL so the
//      package.json file resolves regardless of process.cwd() — D2-04
//      single source of truth.
//   4. --global is renamed to globalScope in the orchestrator call to avoid
//      shadowing JS's `global`. Commander camelCases --i-accept-the-token-bill
//      to opts.iAcceptTheTokenBill, --dry-run to opts.dryRun, etc.
//   5. Phase 2 ships a single first-class adapter; --harness, --all, --global,
//      --project parse cleanly but their full filtering/scope semantics are
//      Phase 3 territory.

import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  runInstall,
  runUninstall,
  runList,
  runPrint,
  runExport,
} from '../lib/install.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(join(here, '..', 'package.json'), 'utf8'));

const program = new Command();

program
  .name('10x-engineer')
  .description('Install the 10x-engineer persona into supported coding harnesses')
  .version(pkg.version, '-V, --version', 'output the current version');

program
  .command('install')
  .description('Detect supported harnesses and install the persona')
  .option('--harness <name>', 'install to a specific harness only')
  .option('--all', 'install to every detected harness without per-harness prompting')
  .option('--global', 'prefer global scope where the harness supports it')
  .option('--project', 'prefer project scope where the harness supports it')
  .option('--dry-run', 'show what would be written; touch nothing')
  .option('--yes', 'skip the interactive disclaimer prompt')
  .option('--i-accept-the-token-bill', 'same as --yes; for ceremony')
  .option('--verbose', 'show resolved paths, dry-run contents, full error stacks')
  .action(async (opts) => {
    // CLI-05: reject --global combined with --project. Validated at the CLI
    // boundary so commander rejects the combination before the orchestrator
    // is invoked. Phase 2 left the resolution-when-both-passed semantics
    // undefined (orchestrator's resolveScope() prefers --global silently);
    // making it a hard error keeps user intent unambiguous.
    if (opts.global && opts.project) {
      process.stderr.write('--global and --project are mutually exclusive\n');
      process.exit(1);
    }
    const code = await runInstall({
      harness: opts.harness,
      all: opts.all,
      // commander camelCases --global to opts.global; rename to globalScope
      // to avoid shadowing the JS `global` global at the orchestrator boundary.
      globalScope: opts.global,
      projectScope: opts.project,
      dryRun: opts.dryRun,
      yes: opts.yes,
      iAcceptTheTokenBill: opts.iAcceptTheTokenBill,
      verbose: opts.verbose,
      cwd: process.cwd(),
      version: pkg.version,
    });
    process.exit(code);
  });

program
  .command('uninstall')
  .description('Remove the persona from all detected harnesses')
  .option('--harness <name>', 'uninstall from a specific harness only')
  .option('--dry-run', 'show what would be removed; touch nothing')
  .option('--verbose', 'show resolved paths and full error stacks')
  .action(async (opts) => {
    const code = await runUninstall({
      harness: opts.harness,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      cwd: process.cwd(),
      version: pkg.version,
    });
    process.exit(code);
  });

program
  .command('list')
  .description('Show all supported harnesses with detection status')
  .option('--verbose', 'show resolved detection paths')
  .action(async (opts) => {
    const code = await runList({ verbose: opts.verbose, cwd: process.cwd() });
    process.exit(code);
  });

program
  .command('print')
  .description('Print the concatenated persona to stdout (universal fallback)')
  .action(async () => {
    const code = await runPrint();
    process.exit(code);
  });

program
  .command('export <dir>')
  .description('Write per-harness pre-formatted bundles to <dir>/<harness>/')
  .action(async (dir) => {
    const code = await runExport({ dir, cwd: process.cwd(), version: pkg.version });
    process.exit(code);
  });

await program.parseAsync(process.argv);
