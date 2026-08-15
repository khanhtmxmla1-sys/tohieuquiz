<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **tohieuquiz** (20801 symbols, 43444 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/tohieuquiz/context` | Codebase overview, check index freshness |
| `gitnexus://repo/tohieuquiz/clusters` | All functional areas |
| `gitnexus://repo/tohieuquiz/processes` | All execution flows |
| `gitnexus://repo/tohieuquiz/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## Required delivery workflow

For every non-trivial code change, agents MUST follow this delivery sequence. A step may be skipped only when it is genuinely not applicable, and the agent must explicitly state `N/A` with the reason.

1. **Plan** — inspect the current state, define scope, risks, files, tests, rollback/verification, and present the plan before implementation. For non-trivial changes, wait for user approval of the plan before editing.
2. **Isolated worktree** — create/use a dedicated Git worktree and feature/fix branch. Do not implement directly on `main` unless the user explicitly requests it and the change is safe.
3. **GitNexus pre-change analysis** — refresh the index if stale, run impact analysis for every function/class/method to be edited, report blast radius/risk, and stop for user confirmation on HIGH/CRITICAL risk.
4. **TDD** — for executable behavior changes, write/adjust a failing regression test first (RED), implement the smallest change to pass (GREEN), then refactor while keeping tests green. For docs/config-only work with no executable behavior, mark TDD `N/A` and explain why.
5. **Review + verification** — run focused tests plus relevant lint/typecheck/build/performance/security/browser checks, review the final diff, and run `detect_changes()` before commit. Resolve P1/P2 findings before continuing.
6. **User approval gate** — show the final scope, verification evidence, remaining risks, and exact files to be committed. Do not commit/push until the user approves.
7. **Commit** — stage only task-related files and create a focused commit. Never include unrelated dirty files.
8. **Push + PR** — push the feature branch, open a PR against `main`, and include scope, risk, verification, and deployment/migration notes.
9. **CI + PR approval** — wait for required CI checks and required human/reviewer approval. Do not merge with failed/pending required checks or unresolved review findings.
10. **Merge** — merge only after the PR is clean, approved, and mergeable. Re-check the PR HEAD immediately before merge.
11. **Production verification / smoke** — after production deployment is triggered/completed, verify the deployed SHA/environment and run the appropriate read-only production smoke checks. Backend/Worker/D1 migrations or destructive rollout steps require their own explicit approval when applicable.
12. **Cleanup** — fast-forward local `main` only when safe, preserve unrelated local changes, remove the merged worktree/branch, delete the remote feature branch when appropriate, and report the final SHA/status.

**Required order:** `plan → worktree → GitNexus → TDD → review/verify → approve → commit → push/PR → CI + PR approval → merge → production smoke → cleanup`.

Never silently bypass a gate. If blocked by auth, CI, reviewer approval, production health, dirty working tree, or an unexpected blast radius, stop and report the blocker instead of forcing the next step.

## Agent skills

### Issue tracker

Issues live in the private GitHub repository `khanhtmxmla1-sys/tohieuquiz` (the remote is configured). See `docs/agents/issue-tracker.md`.

A stale `GITHUB_TOKEN` environment variable on the development machine overrides the `gh` keyring and breaks both `gh` and `git push`. Clear it for the session with `set "GITHUB_TOKEN="` (cmd) or `Remove-Item Env:GITHUB_TOKEN` (PowerShell).

### Triage labels

Uses default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: `CONTEXT.md` at root + `docs/adr/` for architecture decisions. See `docs/agents/domain.md`.
