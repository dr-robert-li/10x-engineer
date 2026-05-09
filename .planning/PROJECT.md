# 10x-engineer

## What This Is

`10x-engineer` is a parody coding-agent plugin distributed via `npx`. It installs a set of skills/rules/instructions into popular coding harnesses (Claude Code, Cursor, Cline, Codex, Gemini CLI, Aider, opencode, Continue, Kilo Code, and 13+ more). Once installed, the host agent adopts a satirical "10x engineer" persona — earnestly verbose, chronically over-engineering, building compilers for problems that need none, reimplementing standard library functions from scratch, and pursuing tangents with operatic gravity. The package itself is small, lean, and dependency-light; the comedy lives in the *behaviour* it induces, not in the codebase.

## Core Value

**The skill files must be funny when read standalone — earnest, never winking — and must install cleanly into every supported harness with surgical, marker-based uninstall.** If the voice fails or an install corrupts a user's existing config, the joke dies.

## Current Milestone: v1.0 Build-Mode Persona

**Goal:** Extend the persona from *responds in voice* to *builds in voice*. Once 10x-engineer is engaged, the host agent must produce actual artefacts (full project trees, composable sub-artefacts, over-engineered READMEs) in the same over-engineered, abstracted, esoteric, first-principles, verbose manner the persona prescribes for prose. The build engine is the host agent's already-running LLM, steered by hook-injected build-shaping skills — no new CLI subcommand, no new network calls, no new dependencies.

**Target features:**
- **Full project scaffolders** — host agent produces complete project trees on request (compiler-from-scratch, json-parser-from-scratch, http-stack-from-scratch, build-system-from-scratch). Directory structure, files, philosophical preamble per file, hand-rolled where a library would do, esoteric language defaults.
- **Sub-artefacts library** — composable patterns the host agent reaches for inside any build: philosophical-preamble generator, free-monad encoder, DSL grammar with hand-rolled lexer/parser, Coq proof stub, Forth bootstrap, abstract-factory-of-factories, monad-transformer stacks.
- **README/docs generator** — host agent produces over-engineered READMEs on request: philosophical sections, epigraphs, dead-CS citations, install command buried mid-document, plain-English disclaimer at the bottom.

**Hook strategy:** Phase 6's SessionStart + UserPromptSubmit hooks load build-mode skills as additional persona-extension content alongside the existing 10 skills. State-file gate (`~/.10x-engineer/state.json` `enabled: true`) governs both. Always-on rule bodies (Cursor, Cline, Continue, Aider, opencode, GEMINI.md, etc.) gain the same build-mode prologue text via the existing single-source-of-truth pattern (`lib/state-gate-instruction.js` precedent).

**Constraints inherited:** Undercover-mode contract (no agent fingerprints anywhere). MIT, Node 18+, ESM, deps limited to `commander` (+ optionally `kleur`). Tarball <150KB. No telemetry, no network, no postinstall.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Write 10 canonical skill markdown files in earnest, self-serious voice (no memes, no winking)
- [ ] Build CLI (`bin/cli.js`) using `commander` with subcommands: `install`, `uninstall`, `list`, `print`, `export`, `--help`, `--version`
- [ ] Implement adapter pattern in `lib/adapters/` — one file per harness, uniform interface (`detect`, `install`, `uninstall`)
- [ ] Cover Tier 1 harnesses (9): Claude Code, Cursor, Cline, Kilo Code, opencode, Continue, Aider, Codex CLI, Gemini CLI
- [ ] Cover Tier 2 harnesses (13+): Pieces, Goose, Cody, Windsurf/Codeium, Tabnine, Amazon Q, GitHub Copilot Chat, Zed AI, JetBrains AI, Roo Code, PearAI, Plandex, hosted-agent fallback
- [ ] Parallel filesystem detection (`lib/detect.js`) running all adapters concurrently
- [ ] Per-format transform pipeline (native skills, `.mdc`, append-with-markers, concat-md, yaml-config+md)
- [ ] Idempotent installs (re-running replaces marker block in place, never duplicates)
- [ ] Marker-based surgical uninstall (`<!-- BEGIN 10x-engineer v<version> -->` … `<!-- END 10x-engineer -->`)
- [ ] First-install disclaimer flow: interactive y/N by default, `--yes` / `--i-accept-the-token-bill` skips
- [ ] Per-harness confirm-each install UX when multiple harnesses detected
- [ ] Universal fallbacks: `print` (concat persona to stdout), `export <dir>` (per-harness bundles)
- [ ] README in-character body + plain-English disclaimer as final section (no collapsed details, no soft styling)
- [ ] `npm publish --dry-run` succeeds; package size <175KB
- [ ] Smoke tests using `node:test` against fixture directories simulating each harness's signature files
- [ ] Undercover-mode pre-publish grep sweep for forbidden agent-fingerprint strings

### Out of Scope

- CI/CD pipelines — explicitly forbidden by build plan; keep it boring
- Logo / branding assets — same reason
- Custom test framework — node:test is the line
- Telemetry / analytics / network calls — parody, not trojan
- Postinstall scripts — parody, not trojan
- Hosted agent server-side install (Sweep, Devin, etc.) — out of scope; CLI prints manual-install message + `print` fallback
- TypeScript — plain ESM JavaScript, Node 18+
- npm publication at v1 — GitHub release only initially, prepared to npm-publish standards for later
- Dependencies beyond `commander` (and optionally `kleur`) — installs in <1s

## Context

- **Maintainer:** `dr-robert-li` (Dr. Robert Li, `dr.robert.li.au@gmail.com`). Sole author of record across commits, tags, releases, issues, PRs.
- **Remote:** https://github.com/dr-robert-li/10x-engineer
- **Undercover constraint (load-bearing):** Every artefact must read as if hand-authored by `dr-robert-li`. Zero evidence of agentic coding-harness involvement. Forbidden strings include `Claude`, `Anthropic`, `Sonnet`, `Opus`, `Generated by`, `Co-Authored-By`, `🤖 Generated with`, etc. Harness names appear in source *only* as install targets in `lib/adapters/` and the coverage table.
- **`.gitignore` baseline:** `CLAUDE.md`, `.claude/`, `.cursor/`, `.continue/`, `.aider*`, `.windsurfrules`, `AGENTS.md`, `GEMINI.md`, `.kilocode/`, `.clinerules/`, `.roo/`, `.goosehints`, `node_modules/`, `*.log`, `.DS_Store`, `.env*`, `scratch*`, `notes*`, `transcript*`, `.cache/`. The project's working brief (`CLAUDE.md`) is *not* committed.
- **Voice precedent for skills:** Self-serious solo developer narrating a livestream. Treats `Array.map` like a moral failing. Builds parser combinators to read JSON. Reaches for COBOL/Forth/Ada/Common Lisp before reaching for JavaScript. Writes 300-word philosophical preambles before any code block. Comedy comes from the gap between gravitas and absurdity. Reference voice example from CLAUDE.md: "npm? In this economy? We'll write our own package manager. In Forth."
- **Disclaimer text is locked:** the README's `## ⚠️ Disclaimer` section is a verbatim contract from CLAUDE.md — plain English, no in-character voice, last section, no collapsed `<details>`, no faint styling. Cannot be softened.

## Constraints

- **Runtime:** Node 18+, ESM (`"type": "module"`).
- **License:** MIT. `LICENSE` file is standard MIT text with `Copyright (c) <year> Robert Li`. `package.json` `"license": "MIT"`.
- **Dependencies:** `commander` (required), `kleur` (optional, for colored output). Nothing else at runtime.
- **Package size:** <175KB total tarball.
- **No telemetry, no network calls, no postinstall hooks.**
- **All append-mode writes wrapped in begin/end markers.** Never overwrite user's existing `AGENTS.md`, `GEMINI.md`, `CONVENTIONS.md`, `copilot-instructions.md`, or any rules file.
- **Skill files standalone-readable** so users can read them directly and laugh.
- **No emoji, no fourth-wall breaks, no winking** in skill files. Voice stays earnest. (README disclaimer heading allowed one ⚠️ emoji — that's the only exception.)
- **Pre-publish grep blocks release** on any agent-fingerprint hit outside legitimate adapter references.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GitHub release only for v1, npm-publish-ready | User wants public availability via `npx github:dr-robert-li/10x-engineer` immediately; npm publication deferred but no cleanup needed when ready | — Pending |
| Tier 1 + Tier 2 harness coverage from v1 | Maximise reach on first ship; per-harness adapter pattern keeps additions cheap | — Pending |
| Confirm-each install UX | Explicit consent per harness; safer for users running across multiple agent setups | — Pending |
| Skills-first build order | Voice is the creative core; lock the persona before scaffolding adapters around it | — Pending |
| `node:test` for smoke tests | Built-in, zero deps, stays under 150KB constraint | — Pending |
| Interactive y/N disclaimer + `--yes` / `--i-accept-the-token-bill` flag | Block accidental installs; allow CI/scripted opt-in | — Pending |
| MIT license | Permissive, npm-standard, compatible with downstream use | — Pending |
| Undercover mode is hard requirement, not aspiration | Maintainer ships under their own name; agent-fingerprint scrub is a release blocker, not a polish item | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-09 — Phase 9 (Docs Generators & Verification Gate) complete; DOCS-01..03 + TEST-10..13 validated; persona surface locked behind executable tests at 50.8% of 512 KB budget; next phase: 10 (v1.0-release)*
