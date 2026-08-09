# TôHiệuQuiz Main Repository Cleanup Implementation Plan

**Status:** APPROVED + IN EXECUTION — approved by user on 2026-08-09. Rescue packet and isolated hygiene worktree created before repository cleanup.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` task-by-task. Before any destructive Git/worktree operation, also apply `using-git-worktrees`, `git-workflow-and-versioning`, `file-organizer`, `doubt-driven-development`, and `verification-before-completion`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa checkout `C:\quizpro` về trạng thái `main` sạch và fast-forward đúng `origin/main`, bảo toàn toàn bộ công việc chưa commit có giá trị, đưa tài liệu release/architecture về đúng trạng thái production hiện tại, loại bỏ các worktree/local branch đã merge và sạch, đồng thời không xóa dữ liệu người dùng hoặc đụng production.

**Architecture:** Cleanup được chia thành hai lớp an toàn. Lớp 1 tạo rescue evidence cho mọi thay đổi chưa commit trước khi chạm vào root hoặc worktree. Lớp 2 thực hiện documentation/repository hygiene trên một worktree mới từ `origin/main`, merge qua PR, rồi mới làm sạch root và prune các worktree/branch đã merge bằng whitelist + non-force commands. Hai worktree đã merge nhưng còn dirty được quarantine, không discard trong plan này.

**Tech Stack:** Git worktrees, Git/GitHub CLI, PowerShell 5.1, Node/npm, TôHiệuQuiz React/Vite/TypeScript repository, GitHub protected `main`.

## Global Constraints

- Không chạy `git reset --hard`, `git clean -fd`, `git clean -fdx`, `git branch -D`, `git push --force` hoặc wildcard delete.
- Không dùng `git stash --include-untracked` trên root vì `downloads/` hiện khoảng 950 MB và không được đưa binary lớn vào Git object database.
- Không xóa, move hoặc commit nội dung trong `downloads/`; plan này chỉ ignore `/downloads/` để Git status sạch. Disk archival là task riêng nếu user yêu cầu sau.
- Không xóa `reports/bundle-report.json` trong bước đầu; xác nhận nó là generated artifact rồi ignore chính xác đường dẫn này.
- Không discard hai worktree dirty hiện tại:
  - `.worktrees/stability-audit-e2e` — 10 tracked files modified.
  - `.worktrees/teacher-dashboard-mockup-parity` — 1 untracked plan file.
- Không xóa hoặc chỉnh sửa bất kỳ branch/worktree chưa merge vào `origin/main`, gồm tối thiểu:
  - `claude/gift-shop-e2e`
  - `fix/json-latex-preflight`
  - `fix/manual-quiz-scroll-settings`
  - `feat/teacher-dashboard-mockup-exact`
  - cùng mọi branch khác xuất hiện trong `git branch --no-merged origin/main` tại thời điểm execution.
- Chỉ remove worktree trong whitelist Task 9 khi cả hai điều kiện đều đúng ngay trước lệnh remove:
  1. `git -C $wt status --porcelain` rỗng trong vòng lặp whitelist;
  2. HEAD của worktree là ancestor của `origin/main`.
- Chỉ delete local branch bằng `git branch -d`; nếu Git từ chối, dừng và giữ branch.
- Remote branch deletion không thuộc plan này.
- Không production deploy, không D1 migration, không Worker/Vercel mutation, không sửa application code.
- `origin/main` sau `git fetch origin main` là source-of-truth cho ancestry và sync.
- Root `main` chỉ được fast-forward bằng `git merge --ff-only origin/main` sau khi rescue evidence tồn tại và các file collision đã được xử lý chính xác.
- Mọi tài liệu production phải phân biệt rõ **repository main hiện tại** với **Worker version đang deploy**; không được suy luận Worker đã chạy commit mới chỉ vì `main` đã tiến lên.
- Protected `main` vẫn đi qua branch + PR + required checks; không push trực tiếp.

---

## Baseline Evidence — captured 2026-08-09

### Root checkout

```text
Path: C:\quizpro
Branch: main
Local HEAD: 26ecdcef2ccfb1cedb05c503830c49cbc61d5c0c
origin/main: f17cf40 (after fetch)
Ahead/behind local...origin: 0 / 2
Dirty entries: 13
```

Current tracked modifications:

```text
M  AGENTS.md
M  CLAUDE.md
M  docs/deployment/CURRENT_PROGRESS.md
M  docs/design/manual-quiz-rich-text-editor-spec.md
M  tasks/plan.md
M  tasks/todo.md
```

Current untracked repository-facing files/directories:

```text
docs/decisions/ADR-001-question-presentation-dual-representation.md
docs/operations/releases/2026-08-08-manual-quiz-rich-text-production.md
docs/superpowers/plans/2026-08-08-question-presentation-evolution-roadmap.md
docs/superpowers/plans/2026-08-08-question-presentation-integrity-review-rendering.md
docs/superpowers/specs/2026-08-08-question-content-rendering-architecture-v2-design.md
downloads/
reports/bundle-report.json
```

`downloads/` measured approximately `949,953,688` bytes at planning time.

### Merged clean worktrees eligible for removal after re-validation

```text
.worktrees/json-field-ownership-v34
.worktrees/json-import-remaining-types
.worktrees/json-question-import
.worktrees/json-rich-text-import
.worktrees/manual-quiz-rich-editor
.worktrees/prod-release-20260808
.worktrees/question-presentation-integrity
.worktrees/rich-text-math-drag-drop
.worktrees/student-assignment-start-flow
.worktrees/student-question-newlines
.worktrees/teacher-dashboard-audit-p1
.worktrees/teacher-dashboard-match-mockup
```

### Merged but dirty worktrees — quarantine, DO NOT REMOVE in this plan

```text
.worktrees/stability-audit-e2e
  M .github/workflows/ci.yml
  M cypress/e2e/quiz.cy.ts
  M docs/ROADMAP.md
  M docs/testing/e2e.md
  M package.json
  M tests/ResultsTab.test.tsx
  M tests/TeacherDashboardShell.test.tsx
  M tests/TeacherOverview.test.tsx
  M tests/loginNotificationIntegration.test.tsx
  M tests/rateLimitPurgeCron.test.ts

.worktrees/teacher-dashboard-mockup-parity
  ?? docs/superpowers/plans/2026-08-06-teacher-dashboard-mockup-parity.md
```

### Current production evidence relevant to documentation cleanup

The most recent verified Question Presentation release evidence before this cleanup includes:

```text
PR #92 merge: 406973f6794d1111d6cd84360b3d9e3c5c21c730
Worker version: 0b91dd72-ff0e-40c1-8a1f-57f138bc5eca
Worker traffic: 100%
Rollback version retained: 5d137d5f-9e60-4b98-a003-7bbbd1057d17
Post-deploy production smoke run: 31295886040 — success
D1 migrations: no pending migration after deploy audit
```

`origin/main` has advanced after that Worker release. Therefore execution MUST perform a fresh read-only deployment audit before updating `CURRENT_PROGRESS.md` and MUST NOT claim Worker source equals latest `origin/main` unless verified.

---

## Dependency Graph

```text
Task 1 — Freeze + rescue evidence
   |
   v
Task 2 — Create isolated hygiene worktree from origin/main
   |
   +----------------------+
   |                      |
   v                      v
Task 3 — Ignore rules   Task 4 — Reconcile retained docs
   |                      |
   +-----------+----------+
               v
Task 5 — Fresh deployment/doc baseline audit
               |
               v
Task 6 — Normalize release/ADR/plan/progress docs
               |
               v
Checkpoint A — Review hygiene diff + verification
               |
               v
Task 7 — Commit / push / PR gate
               |
               v
Checkpoint B — PR merged + origin/main refreshed
               |
               v
Task 8 — Restore and fast-forward root main
               |
               v
Task 9 — Remove merged CLEAN worktrees only
               |
               v
Task 10 — Delete merged LOCAL branches only
               |
               v
Task 11 — Final repository verification
```

Tasks 8–10 MUST NOT begin before the documentation/hygiene PR is merged and `origin/main` contains the retained documentation.

---

# Phase A — Rescue First

### Task 1: Create a reversible rescue packet for every current dirty state

**Files/directories created:**
- Local-only: `C:\quizpro\.tmp\main-cleanup-rescue-20260809\`
- Local-only patch: `.tmp/main-cleanup-rescue-20260809/root-tracked.patch`
- Local-only patch: `.tmp/main-cleanup-rescue-20260809/stability-audit-e2e.patch`
- Local-only copy: `.tmp/main-cleanup-rescue-20260809/teacher-dashboard-mockup-parity-plan.md`
- Local-only manifest: `.tmp/main-cleanup-rescue-20260809/manifest.txt`

**Consumes:** current dirty root and dirty worktrees without changing them.

**Produces:** recoverable text/patch evidence plus base SHAs and hashes.

- [ ] **Step 1: Refresh remote refs without changing the working tree**

Run from `C:\quizpro`:

```powershell
git fetch origin main --prune
```

Expected: exit `0`. No merge, checkout, reset or working-tree mutation.

- [ ] **Step 2: Record exact baseline**

```powershell
$root = 'C:\quizpro'
$rescue = Join-Path $root '.tmp\main-cleanup-rescue-20260809'
New-Item -ItemType Directory -Force -Path $rescue | Out-Null

@(
  "capturedUtc=$([DateTime]::UtcNow.ToString('o'))"
  "rootHead=$(git -C $root rev-parse HEAD)"
  "originMain=$(git -C $root rev-parse origin/main)"
  "rootBranch=$(git -C $root branch --show-current)"
) | Set-Content -Encoding UTF8 (Join-Path $rescue 'manifest.txt')

git -C $root status --porcelain=v1 | Add-Content -Encoding UTF8 (Join-Path $rescue 'manifest.txt')
```

Expected: manifest contains current root HEAD, current `origin/main`, branch and full porcelain status.

- [ ] **Step 3: Save tracked root diff as binary-safe patch**

```powershell
git -C C:\quizpro diff --binary --output=C:\quizpro\.tmp\main-cleanup-rescue-20260809\root-tracked.patch -- AGENTS.md CLAUDE.md docs/deployment/CURRENT_PROGRESS.md docs/design/manual-quiz-rich-text-editor-spec.md tasks/plan.md tasks/todo.md
```

`--output` is intentional: it avoids PowerShell 5.1 text-redirection encoding changes that could corrupt a recovery patch containing Vietnamese text.

Verify non-empty:

```powershell
(Get-Item C:\quizpro\.tmp\main-cleanup-rescue-20260809\root-tracked.patch).Length
```

Expected: value `> 0`.

- [ ] **Step 4: Copy every untracked repository-facing document into rescue packet**

```powershell
$files = @(
  'C:\quizpro\docs\decisions\ADR-001-question-presentation-dual-representation.md',
  'C:\quizpro\docs\operations\releases\2026-08-08-manual-quiz-rich-text-production.md',
  'C:\quizpro\docs\superpowers\plans\2026-08-08-question-presentation-evolution-roadmap.md',
  'C:\quizpro\docs\superpowers\plans\2026-08-08-question-presentation-integrity-review-rendering.md',
  'C:\quizpro\docs\superpowers\specs\2026-08-08-question-content-rendering-architecture-v2-design.md',
  'C:\quizpro\docs\superpowers\plans\2026-08-09-main-repository-cleanup.md'
)
$dst = 'C:\quizpro\.tmp\main-cleanup-rescue-20260809\root-untracked-docs'
New-Item -ItemType Directory -Force -Path $dst | Out-Null
foreach ($file in $files) {
  if (Test-Path $file) {
    Copy-Item -LiteralPath $file -Destination (Join-Path $dst (Split-Path $file -Leaf)) -Force
  }
}
```

Expected: all existing listed docs have local rescue copies. `downloads/` and `reports/bundle-report.json` are intentionally excluded from Git rescue.

- [ ] **Step 5: Rescue dirty merged worktree diffs without changing those worktrees**

```powershell
git -C C:\quizpro\.worktrees\stability-audit-e2e diff --binary --output=C:\quizpro\.tmp\main-cleanup-rescue-20260809\stability-audit-e2e.patch
Copy-Item -LiteralPath 'C:\quizpro\.worktrees\teacher-dashboard-mockup-parity\docs\superpowers\plans\2026-08-06-teacher-dashboard-mockup-parity.md' -Destination 'C:\quizpro\.tmp\main-cleanup-rescue-20260809\teacher-dashboard-mockup-parity-plan.md' -Force
```

Append source SHAs:

```powershell
@(
  "stabilityHead=$(git -C C:\quizpro\.worktrees\stability-audit-e2e rev-parse HEAD)"
  "parityHead=$(git -C C:\quizpro\.worktrees\teacher-dashboard-mockup-parity rev-parse HEAD)"
) | Add-Content -Encoding UTF8 C:\quizpro\.tmp\main-cleanup-rescue-20260809\manifest.txt
```

- [ ] **Step 6: Hash rescue packet**

```powershell
Get-ChildItem C:\quizpro\.tmp\main-cleanup-rescue-20260809 -Recurse -File |
  Sort-Object FullName |
  ForEach-Object {
    $h = Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName
    "$($h.Hash)  $($_.FullName)"
  } | Set-Content -Encoding UTF8 C:\quizpro\.tmp\main-cleanup-rescue-20260809\sha256.txt
```

Expected: `sha256.txt` lists each rescue file.

- [ ] **Step 7: Verify rescue packet did not mutate working trees**

```powershell
git -C C:\quizpro status --short
git -C C:\quizpro\.worktrees\stability-audit-e2e status --short
git -C C:\quizpro\.worktrees\teacher-dashboard-mockup-parity status --short
```

Expected: same business changes as before Task 1; only the new cleanup plan may appear additionally at root. No original modification disappears.

**Stop condition:** if any rescue source file cannot be read/copied or patch length is zero despite known changes, stop before any cleanup command.

---

# Phase B — Build the Hygiene Change in Isolation

### Task 2: Create a clean isolated worktree from fresh `origin/main`

**Files/directories created:**
- Worktree: `C:\quizpro\.worktrees\main-hygiene-20260809`
- Branch: `chore/main-hygiene-20260809`

**Dependencies:** Task 1 complete.

- [ ] **Step 1: Confirm root is normal checkout and `.worktrees/` is ignored**

```powershell
git -C C:\quizpro rev-parse --git-dir
git -C C:\quizpro rev-parse --git-common-dir
git -C C:\quizpro check-ignore -v .worktrees
```

Expected: root is primary checkout and `.worktrees/` is ignored by repository rules.

- [ ] **Step 2: Confirm branch/path do not already exist**

```powershell
git -C C:\quizpro show-ref --verify --quiet refs/heads/chore/main-hygiene-20260809
if ($LASTEXITCODE -eq 0) { throw 'cleanup branch already exists' }

if (Test-Path C:\quizpro\.worktrees\main-hygiene-20260809) {
  throw 'cleanup worktree path already exists'
}
```

Expected: both absent.

- [ ] **Step 3: Create worktree at exact `origin/main`**

```powershell
git -C C:\quizpro worktree add C:\quizpro\.worktrees\main-hygiene-20260809 -b chore/main-hygiene-20260809 origin/main
```

Verify:

```powershell
git -C C:\quizpro\.worktrees\main-hygiene-20260809 status --short
git -C C:\quizpro\.worktrees\main-hygiene-20260809 rev-parse HEAD
git -C C:\quizpro rev-parse origin/main
```

Expected: worktree status empty and both SHAs equal.

- [ ] **Step 4: Install exact locked dependencies only if verification later requires them**

Preferred:

```powershell
npm ci
```

Run from hygiene worktree. Do not edit dependency manifests.

**Stop condition:** if worktree does not start clean at current `origin/main`, remove only this newly-created worktree and investigate before proceeding.

---

### Task 3: Make generated/local artifacts stop polluting Git status

**Files:**
- Modify: `.gitignore`

**Produces:** precise ignore entries only; no broad pattern hiding repository source.

- [ ] **Step 1: Characterize both artifacts**

From hygiene worktree:

```powershell
git ls-files --error-unmatch downloads 2>$null
if ($LASTEXITCODE -eq 0) { throw 'downloads is unexpectedly tracked' }

git ls-files --error-unmatch reports/bundle-report.json 2>$null
if ($LASTEXITCODE -eq 0) { throw 'bundle report is unexpectedly tracked' }
```

Also locate generator:

```powershell
Select-String -Path scripts\analyze-bundle.mjs -Pattern 'bundle-report|reports' -Context 2,2
```

Expected: `/downloads/` is local-only; `reports/bundle-report.json` is generated by performance tooling or otherwise demonstrably reproducible.

- [ ] **Step 2: Add only these ignore rules**

Append under generated/local artifacts:

```gitignore
# Local downloaded media (not application assets)
/downloads/

# Generated performance analysis output
/reports/bundle-report.json
```

Do not ignore the whole `reports/` directory.

- [ ] **Step 3: Verify ignore behavior against root paths**

```powershell
git -C C:\quizpro\.worktrees\main-hygiene-20260809 check-ignore -v C:\quizpro\downloads\giu-vung-danh-hieu-truong-chuan-quoc-gia-720p.mp4
git -C C:\quizpro\.worktrees\main-hygiene-20260809 check-ignore -v C:\quizpro\reports\bundle-report.json
```

Expected: both resolve to the new exact ignore rules.

- [ ] **Step 4: Diff review**

```powershell
git diff -- .gitignore
git diff --check -- .gitignore
```

Expected: only two precise ignore additions, no whitespace errors.

---

### Task 4: Reconcile the retained untracked docs onto the clean hygiene branch

**Files copied/modified:**
- Create: `docs/decisions/ADR-001-question-presentation-dual-representation.md`
- Create: `docs/operations/releases/2026-08-08-manual-quiz-rich-text-production.md`
- Create: `docs/superpowers/plans/2026-08-08-question-presentation-evolution-roadmap.md`
- Create: `docs/superpowers/plans/2026-08-08-question-presentation-integrity-review-rendering.md`
- Create: `docs/superpowers/specs/2026-08-08-question-content-rendering-architecture-v2-design.md`
- Create: `docs/superpowers/plans/2026-08-09-main-repository-cleanup.md`

**Dependencies:** Task 1 rescue + Task 2 clean worktree.

- [ ] **Step 1: Confirm none of these paths became tracked on newer `origin/main`**

```powershell
$paths = @(
  'docs/decisions/ADR-001-question-presentation-dual-representation.md',
  'docs/operations/releases/2026-08-08-manual-quiz-rich-text-production.md',
  'docs/superpowers/plans/2026-08-08-question-presentation-evolution-roadmap.md',
  'docs/superpowers/plans/2026-08-08-question-presentation-integrity-review-rendering.md',
  'docs/superpowers/specs/2026-08-08-question-content-rendering-architecture-v2-design.md',
  'docs/superpowers/plans/2026-08-09-main-repository-cleanup.md'
)
foreach ($p in $paths) {
  git ls-files --error-unmatch $p 2>$null
  if ($LASTEXITCODE -eq 0) { Write-Output "TRACKED_ALREADY $p" }
}
```

If a path is already tracked, compare it against rescue content instead of overwriting blindly.

- [ ] **Step 2: Copy rescue docs into hygiene worktree preserving exact filenames**

Use `Copy-Item -LiteralPath` per file. Do not copy `downloads/` or `bundle-report.json`.

- [ ] **Step 3: Confirm document inventory**

```powershell
git status --short
```

Expected: `.gitignore` plus the six intended documentation files only at this stage.

---

### Task 5: Refresh read-only source/deployment baseline before editing production docs

**Files:** none. Read-only audit only.

**Why:** repository `origin/main` advanced after Worker `0b91dd72...` was deployed. Documentation must record source/deployment separately.

- [ ] **Step 1: Record current repository source**

```powershell
git fetch origin main
git rev-parse origin/main
git log --oneline -5 origin/main
```

Expected: fresh SHA and recent commit list.

- [ ] **Step 2: Record Worker production deployment read-only**

From `workers/` in hygiene worktree:

```powershell
npx wrangler whoami
npx wrangler deployments status --config wrangler.toml --json
```

Expected: correct production Cloudflare account and exact Worker version/percentage. No deploy command.

- [ ] **Step 3: Record D1 migration registry read-only**

```powershell
npx wrangler d1 migrations list tohieuquiz-db --remote --config wrangler.toml
```

Expected at planning time: `No migrations to apply!`. If different, documentation must state actual result and execution stops before any D1 mutation.

- [ ] **Step 4: Record latest relevant GitHub release/PR evidence**

```powershell
gh pr view 92 --repo khanhtmxmla1-sys/tohieuquiz --json number,state,mergedAt,mergeCommit,title,url
gh run view 31295886040 --repo khanhtmxmla1-sys/tohieuquiz --json status,conclusion,url
```

Expected: PR #92 merged and production smoke success.

- [ ] **Step 5: Check frontend deployment state read-only if a connected Vercel/GitHub status source is available**

Do not infer Vercel source from Git history alone. If exact Vercel deployment SHA cannot be verified, docs should say only that repository main has advanced and omit speculative frontend deployment ID.

**Stop condition:** any production write prompt, missing Cloudflare identity, or migration drift. This task is read-only.

---

### Task 6: Normalize documentation to the completed 2026-08-09 state

**Files:**
- Modify: `docs/deployment/CURRENT_PROGRESS.md`
- Modify: `docs/design/manual-quiz-rich-text-editor-spec.md`
- Modify: `tasks/plan.md`
- Modify: `tasks/todo.md`
- Modify: `docs/decisions/ADR-001-question-presentation-dual-representation.md`
- Modify: `docs/superpowers/plans/2026-08-08-question-presentation-evolution-roadmap.md`
- Modify: `docs/superpowers/plans/2026-08-08-question-presentation-integrity-review-rendering.md`
- Modify: `docs/superpowers/specs/2026-08-08-question-content-rendering-architecture-v2-design.md`
- Create: `docs/operations/releases/2026-08-09-question-presentation-integrity-production.md`

**Interfaces:** documentation-only; no runtime behavior.

#### Required content contract

`CURRENT_PROGRESS.md` MUST distinguish:

```text
Repository main source: exact SHA printed by Task 5 Step 1 at execution time
Question Presentation PR #92 merge: 406973f6794d1111d6cd84360b3d9e3c5c21c730
Worker production version: exact version_id printed by Task 5 Step 2 at execution time
Worker source/release basis: 406973f tree unless Task 5 verifies a later Worker deploy
D1 latest applied migration: 0064 and no pending migrations only if Task 5 Step 3 confirms it
Rollback Worker version: 5d137d5f-9e60-4b98-a003-7bbbd1057d17 unless fresh deployment history disproves it
```

It MUST NOT claim latest `origin/main` is already deployed to Worker merely because main advanced.

- [ ] **Step 1: Mark ADR-001 accepted**

Change:

```markdown
## Status
Proposed — awaiting product/architecture approval
```

To:

```markdown
## Status
Accepted — implemented by PR #92 and released to production on 2026-08-09
```

Add a short implementation evidence section referencing PR #92, merge `406973f`, the production Worker version from Task 5 and smoke run `31295886040`.

- [ ] **Step 2: Mark the detailed Question Presentation Integrity plan completed**

Add near the header:

```markdown
**Status:** COMPLETED + MERGED + RELEASED — PR #92, merge `406973f`, production rollout 2026-08-09.
```

Do not delete the task-by-task historical plan; keep it as implementation evidence.

- [ ] **Step 3: Update program roadmap Phase 1 status**

Change Phase 1 from “next executable phase” to completed/released and point future work to Phase 2 only after a new explicit plan/approval.

- [ ] **Step 4: Amend architecture-v2 design current baseline**

In the Production baseline amendment, record that the listed Phase 1 integrity/review steps are now implemented. Keep full Question Contract v2 conditional/deferred.

- [ ] **Step 5: Preserve Manual Quiz Rich Text spec as released historical baseline**

Ensure its status reads RELEASED and points to both:

```text
docs/operations/releases/2026-08-08-manual-quiz-rich-text-production.md
docs/operations/releases/2026-08-09-question-presentation-integrity-production.md
```

Do not rewrite historical pre-implementation sections beyond status/context annotations.

- [ ] **Step 6: Replace stale active task state**

`tasks/plan.md` should no longer say Question Presentation Integrity is `PLANNED`. Convert it to a concise completed handoff record, for example:

```markdown
# Current Plan — Repository Hygiene After Question Presentation Release

**Previous phase:** Question Presentation Integrity — COMPLETED, MERGED, RELEASED.
**Active plan:** `docs/superpowers/plans/2026-08-09-main-repository-cleanup.md`
**Scope:** repository/documentation/worktree hygiene only; no application code or production mutation.
```

`tasks/todo.md` should mark the completed Phase 1 tasks as complete and expose only the repository-hygiene execution checklist from this plan as active. Do not resurrect future Phase 2 feature work as current TODO without a new product approval.

- [ ] **Step 7: Create 2026-08-09 release evidence file**

Create `docs/operations/releases/2026-08-09-question-presentation-integrity-production.md` with these sections:

```markdown
# Question Presentation Integrity — Production Release

**Release date:** 2026-08-09
**PR:** #92
**Merge commit:** `406973f6794d1111d6cd84360b3d9e3c5c21c730`
**Feature commit:** `87b8427d6426e6eb524301be4e7c4d9c367e8cd4`

## Scope
- rich -> plain authoritative projection
- cross-node math rendering
- safe rich result snapshots with 1.5 MB budget
- historical snapshot precedence
- teacher/student historical rich review
- quiz deletion dependency guards

## D1
- no new migration in PR #92
- existing `0064_add_question_rich_text.sql` used
- fresh post-release migration registry result from Task 5

## Worker rollout
- candidate version: `0b91dd72-ff0e-40c1-8a1f-57f138bc5eca`
- previous rollback version: `5d137d5f-9e60-4b98-a003-7bbbd1057d17`
- staged rollout: 0% -> 10% -> 50% -> 100%
- 10% observation: 60/60 health, 15/15 public quiz reads
- 50% observation: 60/60 health, 15/15 public quiz reads
- post-100% observation: 20/20 health, 5/5 public quiz reads

## Production smoke
- GitHub run `31295886040`
- conclusion: success

## Rollback
- normal rollback uses previous reviewed Worker version
- do not drop `question_rich_text`
```

If Task 5 produces different current Worker/migration evidence, preserve historical rollout numbers above but clearly add a “Current state at documentation time” subsection instead of rewriting history.

- [ ] **Step 8: Restore generated GitNexus-count files instead of committing count-only churn**

Do **not** copy the root modifications of `AGENTS.md` and `CLAUDE.md` into hygiene branch if the only change is symbol/relationship counts. Leave the clean `origin/main` versions unchanged.

- [ ] **Step 9: Verify documentation references and status words**

Run:

```powershell
rg -n "PLANNED|awaiting product/architecture approval|production migration/deploy remains" docs/decisions docs/deployment docs/design/manual-quiz-rich-text-editor-spec.md docs/superpowers/plans/2026-08-08-question-presentation-evolution-roadmap.md docs/superpowers/plans/2026-08-08-question-presentation-integrity-review-rendering.md tasks/plan.md tasks/todo.md
```

Expected: no stale statement that Phase 1 or its production release is still pending. Future Phase 2/4 planning language may remain pending where appropriate.

---

## Checkpoint A — Hygiene branch review gate

- [ ] **Step 1: Inventory exact changed files**

```powershell
git status --short
git diff --stat
git diff --name-only
```

Expected scope only:

```text
.gitignore
CURRENT_PROGRESS/spec/task docs
ADR/roadmap/architecture docs
2026-08-08 release evidence
2026-08-09 release evidence
cleanup plan
```

No `src/`, `workers/src/`, `package.json`, lockfile, migration, workflow or application test file may change.

- [ ] **Step 2: Whitespace/secret review**

```powershell
git diff --check

git diff | Select-String -Pattern 'password|secret|api[_-]?key|token|authorization' -CaseSensitive:$false
```

Expected: no whitespace errors and no newly introduced credential material. Benign documentation words such as “tokenized” must be manually classified, not blindly treated as secrets.

- [ ] **Step 3: Review all documentation diffs**

```powershell
git diff -- .gitignore docs tasks
```

Required review assertions:

```text
- no production mutation command is presented as already executed unless evidence exists
- no stale Worker version is described as current
- no latest-main == deployed-Worker inference
- ADR history retained; status updated rather than old ADR deleted
- no dirty worktree contents were silently incorporated
```

- [ ] **Step 4: Applicable repository verification**

Because this branch is documentation + ignore-only, run:

```powershell
npm run lint
npm run typecheck
npm run typecheck:workers
git diff --check
```

Expected: exit `0` for each. Full browser/E2E is not required for documentation-only hygiene unless CI or review exposes a code change.

- [ ] **Step 5: Doubt review of destructive cleanup whitelist**

Before Task 7, independently re-run:

```powershell
git -C C:\quizpro branch --merged origin/main --format='%(refname:short)'
git -C C:\quizpro branch --no-merged origin/main --format='%(refname:short)'
git -C C:\quizpro worktree list --porcelain
```

Compare output against the whitelists in this plan. Any difference is a review finding; update the whitelist rather than guessing.

**Stop condition:** any application code diff, any failing verification, or any stale/misleading production status.

---

# Phase C — Commit / PR Gate

### Task 7: Commit repository hygiene in atomic commits and open a PR

**Dependencies:** Checkpoint A green.

**Approval boundary:** This task requires explicit user permission for commit/push/PR if not already granted after reviewing the completed diff.

- [ ] **Step 1: Commit ignore rules separately**

```powershell
git add .gitignore
git diff --staged --check
git commit -m "chore: ignore local generated artifacts"
```

Expected: commit touches `.gitignore` only.

- [ ] **Step 2: Commit documentation/release reconciliation**

```powershell
git add docs tasks
git diff --staged --check
git commit -m "docs: reconcile question presentation release state"
```

Expected: docs/tasks only.

- [ ] **Step 3: Verify branch clean and inspect commit range**

```powershell
git status --short
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: clean worktree; two focused commits.

- [ ] **Step 4: Push branch**

```powershell
git push -u origin chore/main-hygiene-20260809
```

- [ ] **Step 5: Prepare PR body and open PR**

```powershell
$prBody = @'
## Summary
- Retain and normalize Question Presentation ADR/roadmap/implementation/release documentation.
- Ignore `/downloads/` and `/reports/bundle-report.json` without deleting local files.
- Reconcile `CURRENT_PROGRESS.md`, `tasks/plan.md`, and `tasks/todo.md` with the completed PR #92 production rollout.
- Keep dirty merged worktrees quarantined for a separate recovery decision.

## Scope guard
- No `src/` or `workers/src/` change.
- No migration or production mutation.
- No dirty worktree discard.
- No remote branch deletion.

## Verification
- `npm run lint`
- `npm run typecheck`
- `npm run typecheck:workers`
- `git diff --check`
'@
$prBody | Set-Content -Encoding UTF8 C:\quizpro\.tmp\main-hygiene-pr-body.md
gh pr create --repo khanhtmxmla1-sys/tohieuquiz --base main --head chore/main-hygiene-20260809 --title "chore: clean repository state after question presentation release" --body-file C:\quizpro\.tmp\main-hygiene-pr-body.md
```

Before invoking `gh pr create`, append the actual verification results from Checkpoint A to the body file if any command output needs qualification.

- [ ] **Step 6: Wait for required checks/review in the current interaction and resolve only findings within scope**

Do not bypass branch protection. Do not merge if checks are red.

---

## Checkpoint B — Before touching root main

Required facts:

```text
PR merged into main
origin/main fetched after merge
all retained untracked docs now exist in origin/main
ignore rules for /downloads/ and /reports/bundle-report.json exist in origin/main
rescue packet still exists
root dirty files have not been destroyed yet
```

Verify retained paths directly:

```powershell
git -C C:\quizpro fetch origin main
$required = @(
  'docs/decisions/ADR-001-question-presentation-dual-representation.md',
  'docs/operations/releases/2026-08-08-manual-quiz-rich-text-production.md',
  'docs/operations/releases/2026-08-09-question-presentation-integrity-production.md',
  'docs/superpowers/plans/2026-08-08-question-presentation-evolution-roadmap.md',
  'docs/superpowers/plans/2026-08-08-question-presentation-integrity-review-rendering.md',
  'docs/superpowers/specs/2026-08-08-question-content-rendering-architecture-v2-design.md',
  'docs/superpowers/plans/2026-08-09-main-repository-cleanup.md'
)
foreach ($p in $required) {
  git -C C:\quizpro cat-file -e "origin/main:$p"
  if ($LASTEXITCODE -ne 0) { throw "missing from origin/main: $p" }
}
```

Do not proceed if any path is missing.

---

# Phase D — Clean the Root Checkout

### Task 8: Restore known root-only edits, remove exact doc collisions, then fast-forward main

**Dependencies:** PR merged + Checkpoint B green.

**Files affected in root:** only the original 6 tracked modifications and original untracked docs already preserved in merged `origin/main`.

- [ ] **Step 1: Re-capture root status immediately before cleanup**

```powershell
git -C C:\quizpro status --short
```

Compare with Task 1 manifest. If new unknown modifications appeared, stop and rescue them before continuing.

- [ ] **Step 2: Restore the six known tracked files only**

```powershell
git -C C:\quizpro restore -- AGENTS.md CLAUDE.md docs/deployment/CURRENT_PROGRESS.md docs/design/manual-quiz-rich-text-editor-spec.md tasks/plan.md tasks/todo.md
```

Do not use `git restore .`.

- [ ] **Step 3: Remove only exact untracked doc files that are already verified in `origin/main`**

```powershell
$exact = @(
  'C:\quizpro\docs\decisions\ADR-001-question-presentation-dual-representation.md',
  'C:\quizpro\docs\operations\releases\2026-08-08-manual-quiz-rich-text-production.md',
  'C:\quizpro\docs\superpowers\plans\2026-08-08-question-presentation-evolution-roadmap.md',
  'C:\quizpro\docs\superpowers\plans\2026-08-08-question-presentation-integrity-review-rendering.md',
  'C:\quizpro\docs\superpowers\specs\2026-08-08-question-content-rendering-architecture-v2-design.md',
  'C:\quizpro\docs\superpowers\plans\2026-08-09-main-repository-cleanup.md'
)
foreach ($p in $exact) {
  if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force }
}
```

This exact removal is authorized only because Checkpoint B proved those paths exist in merged `origin/main` and Task 1 rescue copies exist.

Do not remove `downloads/` or `reports/bundle-report.json`; they will become ignored after fast-forward.

- [ ] **Step 4: Confirm no unexpected untracked collision remains**

```powershell
git -C C:\quizpro status --short
```

Expected before fast-forward: at most `downloads/` and `reports/bundle-report.json` remain visible if the new `.gitignore` is not yet in local main.

- [ ] **Step 5: Fast-forward only**

```powershell
git -C C:\quizpro merge --ff-only origin/main
```

Expected: exit `0`, no merge commit created locally.

- [ ] **Step 6: Verify root main clean**

```powershell
git -C C:\quizpro status --short
git -C C:\quizpro rev-parse main
git -C C:\quizpro rev-parse origin/main
git -C C:\quizpro check-ignore -v downloads\giu-vung-danh-hieu-truong-chuan-quoc-gia-720p.mp4
git -C C:\quizpro check-ignore -v reports\bundle-report.json
```

Expected:

```text
status: empty
main SHA == origin/main SHA
downloads media ignored
bundle report ignored
```

**Stop condition:** `--ff-only` refuses, unexpected files appear, or root is not clean after sync.

---

# Phase E — Worktree and Local Branch Hygiene

### Task 9: Remove only re-validated merged clean worktrees

**Dependencies:** Task 8 root clean.

**Whitelist at planning time:**

```text
C:\quizpro\.worktrees\json-field-ownership-v34
C:\quizpro\.worktrees\json-import-remaining-types
C:\quizpro\.worktrees\json-question-import
C:\quizpro\.worktrees\json-rich-text-import
C:\quizpro\.worktrees\manual-quiz-rich-editor
C:\quizpro\.worktrees\prod-release-20260808
C:\quizpro\.worktrees\question-presentation-integrity
C:\quizpro\.worktrees\rich-text-math-drag-drop
C:\quizpro\.worktrees\student-assignment-start-flow
C:\quizpro\.worktrees\student-question-newlines
C:\quizpro\.worktrees\teacher-dashboard-audit-p1
C:\quizpro\.worktrees\teacher-dashboard-match-mockup
```

- [ ] **Step 1: Re-validate the exact whitelist and remove one worktree at a time**

```powershell
$worktrees = @(
  'C:\quizpro\.worktrees\json-field-ownership-v34',
  'C:\quizpro\.worktrees\json-import-remaining-types',
  'C:\quizpro\.worktrees\json-question-import',
  'C:\quizpro\.worktrees\json-rich-text-import',
  'C:\quizpro\.worktrees\manual-quiz-rich-editor',
  'C:\quizpro\.worktrees\prod-release-20260808',
  'C:\quizpro\.worktrees\question-presentation-integrity',
  'C:\quizpro\.worktrees\rich-text-math-drag-drop',
  'C:\quizpro\.worktrees\student-assignment-start-flow',
  'C:\quizpro\.worktrees\student-question-newlines',
  'C:\quizpro\.worktrees\teacher-dashboard-audit-p1',
  'C:\quizpro\.worktrees\teacher-dashboard-match-mockup'
)
foreach ($wt in $worktrees) {
  if (-not (Test-Path -LiteralPath $wt)) { Write-Output "SKIP missing $wt"; continue }
  $status = git -C $wt status --porcelain
  if ($status) { throw "$wt became dirty; keep it" }
  $head = git -C $wt rev-parse HEAD
  git -C C:\quizpro merge-base --is-ancestor $head origin/main
  if ($LASTEXITCODE -ne 0) { throw "$wt HEAD $head is not in origin/main; keep it" }
  git -C C:\quizpro worktree remove $wt
  if ($LASTEXITCODE -ne 0) { throw "worktree remove failed for $wt" }
  git -C C:\quizpro worktree list
}
```

Expected: every existing whitelist item removes with exit `0` and no `--force`. Do not infer safety from branch name alone.

- [ ] **Step 3: Prune stale registrations after whitelist complete**

```powershell
git -C C:\quizpro worktree prune --verbose
git -C C:\quizpro worktree list
```

- [ ] **Step 4: Assert quarantine worktrees still exist**

```powershell
Test-Path C:\quizpro\.worktrees\stability-audit-e2e
Test-Path C:\quizpro\.worktrees\teacher-dashboard-mockup-parity
```

Expected: both `True`.

Also assert unmerged worktrees still exist, including `json-latex-preflight`, `manual-quiz-scroll-settings`, `teacher-dashboard-mockup-exact`, and `.claude/worktrees/laughing-cori-4e77cf`.

---

### Task 10: Delete only merged local branches no longer attached to a worktree

**Dependencies:** Task 9 complete.

**Candidate local branches from planning-time merged list:**

```text
feat/json-question-import
feat/json-rich-text-import
feat/manual-quiz-rich-editor
feature/login-ui-refinement
feature/system-hanoi-timezone
fix/certificate-footer-safe-zone
fix/json-field-ownership-v34
fix/json-import-remaining-types
fix/question-presentation-integrity
fix/rich-text-math-drag-drop
fix/student-assignment-start-flow
fix/student-question-newlines
fix/teacher-dashboard-audit-p1
fix/teacher-dashboard-match-approved-mockup
hotfix/release-readiness-mathjax
release/dashboard-manual-class-mathjax-20260807
```

Explicitly excluded because dirty worktrees remain:

```text
fix/stability-audit-e2e
fix/teacher-dashboard-mockup-parity
```

- [ ] **Step 1: Refresh merged/no-merged sets**

```powershell
git -C C:\quizpro fetch origin main
git -C C:\quizpro branch --merged origin/main --format='%(refname:short)'
git -C C:\quizpro branch --no-merged origin/main --format='%(refname:short)'
```

- [ ] **Step 2: Apply all guards and delete the exact candidate branches using non-force only**

```powershell
$candidates = @(
  'feat/json-question-import',
  'feat/json-rich-text-import',
  'feat/manual-quiz-rich-editor',
  'feature/login-ui-refinement',
  'feature/system-hanoi-timezone',
  'fix/certificate-footer-safe-zone',
  'fix/json-field-ownership-v34',
  'fix/json-import-remaining-types',
  'fix/question-presentation-integrity',
  'fix/rich-text-math-drag-drop',
  'fix/student-assignment-start-flow',
  'fix/student-question-newlines',
  'fix/teacher-dashboard-audit-p1',
  'fix/teacher-dashboard-match-approved-mockup',
  'hotfix/release-readiness-mathjax',
  'release/dashboard-manual-class-mathjax-20260807'
)
$merged = @(git -C C:\quizpro branch --merged origin/main --format='%(refname:short)')
$worktreeMeta = git -C C:\quizpro worktree list --porcelain
foreach ($branch in $candidates) {
  git -C C:\quizpro show-ref --verify --quiet "refs/heads/$branch"
  if ($LASTEXITCODE -ne 0) { Write-Output "SKIP missing branch $branch"; continue }
  if ($merged -notcontains $branch) { throw "$branch is no longer merged into origin/main" }
  if ($worktreeMeta -match [regex]::Escape("branch refs/heads/$branch")) { throw "$branch is still attached to a worktree" }
  git -C C:\quizpro branch -d $branch
  if ($LASTEXITCODE -ne 0) { throw "non-force delete refused for $branch; keep it" }
}
```

If Git refuses any deletion, keep that branch and record why. Never escalate to `-D` in this plan.

- [ ] **Step 4: Preserve all unmerged local branches**

Run again:

```powershell
git -C C:\quizpro branch --no-merged origin/main --format='%(refname:short)'
```

Compare with pre-cleanup manifest. No unmerged branch may disappear as a side effect.

**Remote branches:** no deletion in this plan. A separate remote-branch cleanup can be planned after checking open/merged PR references.

---

# Phase F — Final Verification

### Task 11: Prove main is clean, synced and recoverable

**Dependencies:** Tasks 1–10 complete.

- [ ] **Step 1: Root cleanliness**

```powershell
git -C C:\quizpro status --short
```

Expected: no output.

- [ ] **Step 2: Main synchronization**

```powershell
$local = git -C C:\quizpro rev-parse main
$remote = git -C C:\quizpro rev-parse origin/main
if ($local -ne $remote) { throw "main drift: local=$local remote=$remote" }
```

Expected: equal.

- [ ] **Step 3: Confirm ignored local artifacts remain on disk**

```powershell
Test-Path C:\quizpro\downloads
Test-Path C:\quizpro\reports\bundle-report.json
git -C C:\quizpro check-ignore -v downloads\giu-vung-danh-hieu-truong-chuan-quoc-gia-720p.mp4
git -C C:\quizpro check-ignore -v reports\bundle-report.json
```

Expected: files remain, Git ignores them. This proves cleanup did not delete downloaded media.

- [ ] **Step 4: Confirm quarantine data remains intact**

```powershell
git -C C:\quizpro\.worktrees\stability-audit-e2e status --short
git -C C:\quizpro\.worktrees\teacher-dashboard-mockup-parity status --short
```

Expected: their pre-existing dirty work remains present.

- [ ] **Step 5: Confirm rescue packet remains available**

```powershell
Get-ChildItem C:\quizpro\.tmp\main-cleanup-rescue-20260809 -Recurse -File
Get-Content C:\quizpro\.tmp\main-cleanup-rescue-20260809\sha256.txt
```

Do not delete rescue packet in the same cleanup session. Retain until user explicitly approves later disposal.

- [ ] **Step 6: Inspect final worktree/branch inventory**

```powershell
git -C C:\quizpro worktree list
git -C C:\quizpro branch --merged origin/main --format='%(refname:short)'
git -C C:\quizpro branch --no-merged origin/main --format='%(refname:short)'
```

Expected:

```text
- obsolete merged clean worktrees removed
- dirty quarantine worktrees retained
- unmerged worktrees/branches retained
- main present and synced
```

- [ ] **Step 7: Final repository verification after merged documentation change**

Run from clean root:

```powershell
npm run lint
npm run typecheck
npm run typecheck:workers
git diff --check
```

Expected: all exit `0`; `git diff --check` has no output.

- [ ] **Step 8: Produce final cleanup report**

Report exactly:

```text
1. main local SHA / origin/main SHA
2. final git status
3. worktrees removed
4. local branches removed
5. dirty/unmerged worktrees deliberately retained
6. downloads/report preserved and ignored
7. rescue packet path
8. documentation PR number + merge SHA
9. verification command results
10. anything intentionally left for follow-up
```

---

## Risk Matrix

| Risk | Severity | Mitigation |
|---|---:|---|
| Lose uncommitted root docs | Critical | Rescue patch + copied untracked docs + SHA256 before restore/removal |
| Lose dirty worktree changes | Critical | Quarantine; never remove dirty worktrees in this plan |
| Accidentally delete 950 MB downloaded media | High | Never delete/move; add exact `/downloads/` ignore rule |
| Hide real repository files with broad ignore | High | Ignore only `/downloads/` and `/reports/bundle-report.json` |
| Delete unmerged branch | Critical | Re-run `--merged/--no-merged`, ancestry guard, `branch -d` only |
| Remove wrong worktree | High | Exact whitelist + clean status + ancestor check immediately before remove |
| Root diverges while cleanup runs | High | Fetch checkpoints; `merge --ff-only`; stop on refusal |
| Docs claim latest main is deployed Worker | High | Fresh read-only Worker audit; separate repository source from deployment source |
| Cleanup PR mixes application code | High | Checkpoint A rejects any `src/`, `workers/src/`, migrations, workflows or package changes |
| Generated GitNexus counts create noisy commit | Low | Restore/leave `AGENTS.md` and `CLAUDE.md` unchanged unless meaningful guidance changed |

---

## Non-Goals

This plan does NOT:

- fix or merge the 10 dirty `stability-audit-e2e` files;
- decide whether `teacher-dashboard-mockup-parity` plan should be kept or discarded;
- delete any unmerged local branch;
- delete remote branches;
- archive/delete downloaded videos;
- delete rescue evidence;
- alter production Worker/Vercel/D1;
- change application behavior;
- start Question Presentation Phase 2;
- refactor adjacent code while “cleaning”.

These require separate explicit decisions/plans.

---

## Hard Stop Conditions

Stop execution and report instead of guessing if any occurs:

1. `origin/main` changes materially and invalidates the branch/worktree whitelist.
2. A supposedly clean worktree becomes dirty.
3. A candidate branch is no longer ancestor of `origin/main`.
4. Root gains new unknown modifications after rescue capture.
5. `git merge --ff-only origin/main` refuses.
6. Any retained doc is missing from merged `origin/main` before removing root collision.
7. Any command would require `--force`, `-D`, `reset --hard` or `git clean` to proceed.
8. Documentation verification exposes uncertain production state.
9. GitHub required checks fail.
10. Any secret/student data appears in cleanup diff or logs.

---

## Approval Boundaries

Approval of this plan authorizes, during execution:

- creating the local rescue packet under `.tmp/main-cleanup-rescue-20260809`;
- creating `chore/main-hygiene-20260809` in a new ignored worktree;
- adding the two exact `.gitignore` entries;
- editing/adding the documentation files listed in Tasks 4–6;
- restoring the six exact tracked root modifications **only after rescue + merged PR verification**;
- removing the exact untracked doc collisions **only after they are verified in merged `origin/main`**;
- removing only the exact merged clean worktrees that pass fresh safety guards;
- deleting only merged local branches with `git branch -d` that pass fresh safety guards.

Approval of this plan does **not** authorize:

- force delete/reset/clean operations;
- discard of either dirty quarantined worktree;
- deletion of any unmerged branch/worktree;
- remote branch deletion;
- deletion/move of `downloads/`;
- production deploy/migration/data mutation;
- application code changes;
- bypassing PR protection;
- commit/push/PR if the user has not separately granted the repository-write gate required by the TôHiệuQuiz lead workflow.

---

## Definition of Done

Cleanup is complete only when all are true:

```text
[ ] root C:\quizpro git status is empty
[ ] local main SHA == origin/main SHA
[ ] downloads/ still exists and is ignored
[ ] reports/bundle-report.json is ignored (and preserved unless separately deleted)
[ ] all retained release/ADR/architecture docs are tracked on main
[ ] CURRENT_PROGRESS reflects fresh repository + deployment evidence without conflating them
[ ] Question Presentation Integrity plan/ADR no longer claim Phase 1 is pending
[ ] merged clean worktrees on the approved whitelist are removed
[ ] dirty quarantine worktrees remain intact
[ ] unmerged branches/worktrees remain intact
[ ] local merged branches are removed only via non-force deletion
[ ] rescue packet still exists with hashes
[ ] applicable lint/typecheck/Worker typecheck and required PR checks are green
[ ] no production mutation occurred
```

---

## Execution Handoff

When this plan is approved, execute it inline with `executing-plans` and checkpoints. Because the task contains irreversible filesystem/Git cleanup operations, do not parallelize destructive steps; only independent read-only audits may run in parallel.
