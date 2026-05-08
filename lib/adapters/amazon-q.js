// lib/adapters/amazon-q.js
//
// Path source: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-project-rules.html, verified 2026-05-08
//
// Tier 2 adapter — Amazon Q Developer CLI. Single-file install at
// <projectRoot>/.amazonq/rules/10x-engineer.md. Markerless: destination
// is fully owned by us; uninstall unlinks the file directly. User-owned
// siblings under .amazonq/rules/ are untouched. Vendor reads the directory
// recursively via .amazonq/rules/**/*.md so our file loads alongside any
// user-authored siblings — no conflict.
//
// Format: concat-md (FMT-04 — Phase 3 / 03-03). Single concatenated markdown
// file with persona header.
//
// Project-only stance — paths.global is always null. Vendor doc states:
// "Currently, Q only checks $(pwd)/.amazonq/rules/**/*.md". Global rules
// support is an open vendor feature request (aws/amazon-q-developer-cli#3451)
// and is not shipped as of 2026-05-08. Activating paths.global is a one-line
// change once the vendor publishes the global path.
//
// Detection has THREE OR-signals:
//   - commandExists('q')           — PATH binary
//   - <homedir>/.aws/amazonq/      — legacy MCP config dir (AWS CLI convention)
//   - <projectRoot>/.amazonq/      — project signal (anchored via findAncestorWith)
//
// Pitfall 10: PATH `q` alone is necessary-but-not-sufficient. A user with `q`
// installed but not currently in an Amazon Q project would otherwise see
// found:true everywhere and pollute random project directories. The adapter
// requires at least one filesystem signal alongside any PATH match.
//
// dryRun threads through per D2-19. cwd and homedir are injected by the
// caller per D2-24; this module never reads them from the runtime ambient.

import { mkdir, writeFile, unlink, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { commandExists, findAncestorWith } from '../detect.js';
import { transform } from '../format/concat-md.js';

async function exists(p) {
  try { await access(p, constants.F_OK); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

export default {
  id: 'amazon-q',
  displayName: 'Amazon Q Developer CLI',
  format: 'concat-md',

  async detect({ cwd, homedir }) {
    const awsAmazonqDir = join(homedir, '.aws', 'amazonq');
    const projectRoot = (await findAncestorWith(cwd, '.amazonq', homedir)) ?? cwd;
    const projectAmazonqDir = join(projectRoot, '.amazonq');
    const [hasAws, hasProject, _hasBinary] = await Promise.all([
      exists(awsAmazonqDir),
      exists(projectAmazonqDir),
      commandExists('q'),
    ]);
    // Pitfall 10: PATH alone is necessary-but-not-sufficient. Require at
    // least one filesystem signal. (`hasBinary` alone, without filesystem,
    // intentionally returns found:false.)
    if (!hasAws && !hasProject) return { found: false };
    return {
      found: true,
      scope: 'project',
      paths: {
        global: null,
        project: join(projectRoot, '.amazonq', 'rules', '10x-engineer.md'),
      },
    };
  },

  async install({ skills, scope, paths, dryRun = false, version }) {
    const targets = [];
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);

    const [{ content }] = transform(skills, version);
    const written = [];
    for (const target of targets) {
      if (!dryRun) {
        await mkdir(join(target, '..'), { recursive: true });
        await writeFile(target, content);
      }
      written.push(target);
    }
    return { written, skipped: [] };
  },

  async uninstall({ scope, paths, dryRun = false }) {
    const targets = [];
    if ((scope === 'project' || scope === 'both') && paths.project) targets.push(paths.project);
    const removed = [];
    for (const target of targets) {
      if (!dryRun) {
        try { await unlink(target); }
        catch (e) { if (e.code !== 'ENOENT') throw e; }
      }
      removed.push(target);
    }
    return { removed };
  },
};
