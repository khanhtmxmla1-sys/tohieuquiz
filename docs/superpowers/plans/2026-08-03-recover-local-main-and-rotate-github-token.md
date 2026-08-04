# Khôi phục Local Main và Xử lý GitHub Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khôi phục `C:\quizpro\main` về đúng trạng thái của `origin/main`, bảo toàn các tài liệu kế hoạch cần giữ, loại bỏ cấu hình thử nghiệm làm test/build thành công giả và xử lý GitHub Personal Access Token đã lộ trong file local.

**Architecture:** Thực hiện theo quy trình phục hồi bảo thủ: chụp trạng thái và sao lưu chọn lọc ra ngoài repository, thu hồi credential trước, khôi phục từng file có chủ đích thay vì dùng lệnh xóa hàng loạt, fast-forward `main` tới `origin/main`, sau đó kiểm tra lại script thật bằng quality gate đầy đủ. Không sửa tính năng Quiz Progress V2, không rebase, không force-push và không deploy production trong kế hoạch này.

**Tech Stack:** Git, GitHub, PowerShell, Node.js 22.22+, npm, React 19, TypeScript 5.8, Vite 6, Vitest 4, Cypress, Cloudflare Workers.

## Global Constraints

- Repository mục tiêu duy nhất: `C:\quizpro`.
- `origin/main` là nguồn chuẩn cho mã nguồn đã merge.
- Không dùng `git reset --hard`, `git clean -fd`, `git rebase`, `git push --force` hoặc `git push --force-with-lease`.
- Không lưu, sao chép, in ra terminal, commit hoặc đưa token cũ vào file backup.
- Phải thu hồi token cũ trước khi tạo credential thay thế.
- Chỉ sao lưu các tài liệu kế hoạch và diff của ba file tracked bị ghi đè; không sao lưu `mcp.json`.
- Không tự động ghi đè tài liệu cùng tên đã có trên `origin/main`; phải so sánh trước.
- Không thay script chất lượng bằng lệnh giả như `node --version`.
- Không bỏ qua test thất bại, không giảm quality gate và không sửa test chỉ để đạt trạng thái xanh.
- Không push commit mới trước khi toàn bộ bước xác minh bắt buộc hoàn tất.
- Không deploy Vercel, Cloudflare Workers, D1 hoặc production trong kế hoạch phục hồi này.
- Mọi phát hiện thêm ngoài các file đã liệt kê trong Baseline phải dừng tại checkpoint và báo cáo trước khi xóa hoặc sửa.

## Baseline đã xác nhận ngày 2026-08-03

- Local branch: `main`.
- Local không có commit riêng chưa push tại thời điểm kiểm tra.
- Sau `git fetch`, local chậm hơn `origin/main` 23 commit tại thời điểm kiểm tra; số này có thể tăng nên phải tính lại khi thực thi.
- Tracked files bị sửa: `.gitignore`, `README.md`, `package.json`.
- Untracked ban đầu: hai tài liệu kế hoạch, `mcp.json`, `src/index.js`.
- Tài liệu kế hoạch phục hồi này được tạo thêm có chủ đích tại `docs/superpowers/plans/2026-08-03-recover-local-main-and-rotate-github-token.md`; được phép giữ untracked trong lúc fast-forward nếu remote chưa có file cùng đường dẫn.
- `package.json` local đã bị rút gọn và các script `test/build/lint/typecheck` bị thay bằng `node --version`.
- `README.md` local chỉ còn tiêu đề thử nghiệm.
- `src/index.js` là file thử nghiệm không thuộc ứng dụng thật.
- `mcp.json` chứa GitHub Personal Access Token dạng plaintext và tuyệt đối không được đưa vào backup hoặc Git.

## File Map

**External backup — Create outside repository**

- `C:\quizpro-recovery\2026-08-03-2306\git-status.txt`
- `C:\quizpro-recovery\2026-08-03-2306\head.txt`
- `C:\quizpro-recovery\2026-08-03-2306\origin-main.txt`
- `C:\quizpro-recovery\2026-08-03-2306\tracked-root.diff`
- `C:\quizpro-recovery\2026-08-03-2306\plans\2026-07-31-tohieuquiz-module-icon-system.md`
- `C:\quizpro-recovery\2026-08-03-2306\plans\2026-08-03-quiz-answer-progress-v2.md`
- `C:\quizpro-recovery\2026-08-03-2306\plans\2026-08-03-recover-local-main-and-rotate-github-token.md`

**Delete from local working tree**

- `mcp.json`
- `src/index.js`
- Hai tài liệu kế hoạch cũ sau khi đã sao lưu ra ngoài repository, nhằm tránh xung đột với file cùng tên trên remote.

**Restore from Git**

- `.gitignore`
- `README.md`
- `package.json`

**Potentially modify after synchronization**

- `.gitignore` — chỉ thêm `/mcp.json` nếu phiên bản mới trên `origin/main` chưa ignore file này.
- `docs/superpowers/plans/2026-07-31-tohieuquiz-module-icon-system.md` — chỉ khôi phục nếu remote chưa có.
- Không ghi đè `docs/superpowers/plans/2026-08-03-quiz-answer-progress-v2.md` nếu remote đã có bản chính thức.
- `docs/superpowers/plans/2026-08-03-recover-local-main-and-rotate-github-token.md` — giữ làm tài liệu thực thi và chỉ commit sau khi phục hồi, kiểm tra chất lượng hoàn tất.

---

### Task 1: Đóng băng trạng thái và tạo backup chọn lọc

**Files:**
- Read: `.gitignore`, `README.md`, `package.json`.
- Read: ba tài liệu trong `docs/superpowers/plans/` được liệt kê ở File Map.
- Create: `C:\quizpro-recovery\2026-08-03-2306\*`.

**Interfaces:**
- Consumes: working tree hiện tại trước khi phục hồi.
- Produces: bản ghi đủ để đối chiếu và các tài liệu kế hoạch an toàn, không chứa token.

- [ ] **Step 1: Thiết lập đường dẫn cố định**

```powershell
$Repo = 'C:\quizpro'
$Backup = 'C:\quizpro-recovery\2026-08-03-2306'
Set-Location $Repo
New-Item -ItemType Directory -Force -Path "$Backup\plans" | Out-Null
```

Expected: thư mục backup tồn tại ngoài repository.

- [ ] **Step 2: Cập nhật thông tin remote nhưng chưa merge**

```powershell
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed; stop recovery' }
```

Expected: exit code `0`.

- [ ] **Step 3: Ghi trạng thái và commit IDs**

```powershell
git status --short --branch | Set-Content -Encoding UTF8 "$Backup\git-status.txt"
git rev-parse HEAD | Set-Content -Encoding ASCII "$Backup\head.txt"
git rev-parse origin/main | Set-Content -Encoding ASCII "$Backup\origin-main.txt"
git diff -- .gitignore README.md package.json | Set-Content -Encoding UTF8 "$Backup\tracked-root.diff"
```

Expected: tạo đủ bốn file; `tracked-root.diff` không chứa nội dung `mcp.json`.

- [ ] **Step 4: Sao lưu riêng ba tài liệu kế hoạch**

```powershell
$PlanFiles = @(
  'docs\superpowers\plans\2026-07-31-tohieuquiz-module-icon-system.md',
  'docs\superpowers\plans\2026-08-03-quiz-answer-progress-v2.md',
  'docs\superpowers\plans\2026-08-03-recover-local-main-and-rotate-github-token.md'
)

foreach ($relativePath in $PlanFiles) {
  $source = Join-Path $Repo $relativePath
  if (Test-Path $source) {
    Copy-Item -LiteralPath $source -Destination "$Backup\plans\" -Force
  }
}
```

Expected: mỗi tài liệu đang tồn tại có một bản trong `$Backup\plans`.

- [ ] **Step 5: Xác nhận backup không có credential**

```powershell
rg --hidden --files-with-matches `
  '(ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})' `
  $Backup
```

Expected: không có output. Nếu có tên file, xóa thư mục backup vừa tạo và dừng quy trình.

- [ ] **Step 6: Checkpoint backup**

```powershell
Get-ChildItem -Recurse $Backup | Select-Object FullName, Length
```

Expected: chỉ có các file trạng thái, diff tracked và tài liệu kế hoạch; không có `mcp.json`.

---

### Task 2: Thu hồi GitHub Personal Access Token đã lộ

**Files:**
- Delete: `mcp.json`.
- Do not create: bất kỳ file nào chứa token mới trong repository.

**Interfaces:**
- Consumes: token cũ đang xuất hiện trong `mcp.json` local.
- Produces: token cũ bị vô hiệu hóa và working tree không còn bản plaintext của credential.

- [ ] **Step 1: Thu hồi token trên GitHub**

Trên GitHub:

1. Mở ảnh đại diện tài khoản và chọn **Settings**.
2. Chọn **Developer settings**.
3. Chọn **Personal access tokens**.
4. Mở **Tokens (classic)** vì token đã thấy có định dạng classic.
5. Xác định token dùng cho MCP/local agent và chọn **Delete**.
6. Xác nhận xóa.

Expected: token cũ không còn trong danh sách token hoạt động.

- [ ] **Step 2: Không tạo token mới ngay**

Không tạo credential thay thế cho tới khi repository đã sạch và xác định MCP GitHub có thực sự còn cần hay Git Credential Manager đã đủ.

- [ ] **Step 3: Xóa file credential local**

```powershell
Set-Location 'C:\quizpro'
if (Test-Path '.\mcp.json') {
  Remove-Item -LiteralPath '.\mcp.json' -Force
}
Test-Path '.\mcp.json'
```

Expected: `False`.

- [ ] **Step 4: Quét working tree theo tên file, không in token**

```powershell
rg --hidden --files-with-matches `
  --glob '!.git/**' `
  --glob '!node_modules/**' `
  --glob '!dist/**' `
  '(ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})' `
  .
```

Expected: không có output. Nếu xuất hiện tên file, dừng và xử lý từng file như credential leak.

---

### Task 3: Khôi phục file tracked và loại bỏ file thử nghiệm có chủ đích

**Files:**
- Restore: `.gitignore`, `README.md`, `package.json`.
- Delete: `src/index.js`.
- Delete after backup: hai tài liệu kế hoạch cũ; giữ tài liệu phục hồi hiện tại.

**Interfaces:**
- Consumes: backup hoàn tất và token đã bị thu hồi.
- Produces: working tree chỉ còn tài liệu phục hồi có chủ đích, sẵn sàng fast-forward.

- [ ] **Step 1: Khôi phục ba file tracked từ local HEAD**

```powershell
Set-Location 'C:\quizpro'
git restore --source=HEAD --worktree -- .gitignore README.md package.json
if ($LASTEXITCODE -ne 0) { throw 'git restore failed; stop recovery' }
```

Expected: `git diff -- .gitignore README.md package.json` không có output.

- [ ] **Step 2: Xóa file `src/index.js` thử nghiệm**

```powershell
if (Test-Path '.\src\index.js') {
  Remove-Item -LiteralPath '.\src\index.js' -Force
}
```

Expected: file không còn tồn tại; không xóa thư mục `src`.

- [ ] **Step 3: Xóa hai bản kế hoạch cũ khỏi working tree sau khi backup**

```powershell
$WorkingPlans = @(
  '.\docs\superpowers\plans\2026-07-31-tohieuquiz-module-icon-system.md',
  '.\docs\superpowers\plans\2026-08-03-quiz-answer-progress-v2.md'
)

foreach ($file in $WorkingPlans) {
  if (Test-Path $file) {
    Remove-Item -LiteralPath $file -Force
  }
}
```

Expected: hai file cũ được gỡ; bản backup vẫn còn.

- [ ] **Step 4: Xác nhận chỉ còn plan phục hồi có chủ đích**

```powershell
git status --short --branch
```

Expected:

```text
## main...origin/main [behind N]
?? docs/superpowers/plans/2026-08-03-recover-local-main-and-rotate-github-token.md
```

Nếu có thêm file khác, dừng. Không dùng `git clean`.

- [ ] **Step 5: Xác nhận local không có commit riêng**

```powershell
git rev-list --left-right --count main...origin/main
```

Expected: cột trái bằng `0`; ví dụ `0 23`. Nếu cột trái lớn hơn `0`, dừng và review commit local.

- [ ] **Step 6: Kiểm tra plan phục hồi không xung đột với remote**

```powershell
git ls-tree -r --name-only origin/main -- docs/superpowers/plans/2026-08-03-recover-local-main-and-rotate-github-token.md
```

Expected: không có output. Nếu remote đã có file cùng đường dẫn, so sánh với backup rồi tạm xóa file local trước khi fast-forward.

---

### Task 4: Fast-forward `main` đến đúng `origin/main`

**Files:**
- Update through Git history: toàn bộ files trong các commit remote chưa có ở local.

**Interfaces:**
- Consumes: tracked working tree sạch; chỉ còn plan phục hồi untracked không xung đột.
- Produces: `HEAD` trùng `origin/main` mà không tạo merge commit.

- [ ] **Step 1: Fast-forward bằng ref đã fetch**

```powershell
Set-Location 'C:\quizpro'
git merge --ff-only origin/main
if ($LASTEXITCODE -ne 0) { throw 'fast-forward failed; do not rebase or force' }
```

Expected: Git báo `Fast-forward`.

- [ ] **Step 2: Xác nhận commit IDs bằng nhau**

```powershell
$LocalHead = git rev-parse HEAD
$RemoteHead = git rev-parse origin/main
if ($LocalHead -ne $RemoteHead) { throw 'HEAD does not match origin/main' }
$LocalHead
```

Expected: local và remote SHA giống nhau.

- [ ] **Step 3: Xác nhận không còn ahead/behind**

```powershell
git rev-list --left-right --count main...origin/main
git status --short --branch
```

Expected: `0 0`; chỉ còn plan phục hồi untracked.

- [ ] **Step 4: Kiểm tra script thật đã quay lại**

```powershell
npm pkg get scripts.dev scripts.test scripts.build scripts.lint scripts.typecheck
```

Expected:

- `dev` dùng Vite.
- `test` dùng Vitest.
- `build` dùng build router/Vite thật.
- `lint` dùng ESLint.
- `typecheck` dùng TypeScript.
- Không có giá trị nào chỉ là `node --version`.

---

### Task 5: Đối chiếu và khôi phục có chọn lọc tài liệu kế hoạch cũ

**Files:**
- Compare: backup plans với files sau fast-forward.
- Potentially create: kế hoạch Module Icon nếu remote chưa có.
- Potentially create: `*.recovered.md` khi cùng tên nhưng nội dung khác.

**Interfaces:**
- Consumes: backup ngoài repository và phiên bản chính thức sau fast-forward.
- Produces: không mất tài liệu có giá trị và không ghi đè tài liệu đã merge.

- [ ] **Step 1: Thiết lập biến đường dẫn**

```powershell
$Repo = 'C:\quizpro'
$BackupPlans = 'C:\quizpro-recovery\2026-08-03-2306\plans'
Set-Location $Repo
```

- [ ] **Step 2: Đối chiếu Quiz Progress V2**

```powershell
$quizBackup = Join-Path $BackupPlans '2026-08-03-quiz-answer-progress-v2.md'
$quizDest = Join-Path $Repo 'docs\superpowers\plans\2026-08-03-quiz-answer-progress-v2.md'

if ((Test-Path $quizBackup) -and (Test-Path $quizDest)) {
  git diff --no-index -- $quizDest $quizBackup
} elseif ((Test-Path $quizBackup) -and -not (Test-Path $quizDest)) {
  Copy-Item $quizBackup $quizDest -Force
}
```

Expected:

- Exit `0`: giống nhau, giữ bản remote.
- Exit `1`: khác nhau, không ghi đè; tạo bản review:

```powershell
Copy-Item $quizBackup "$quizDest.recovered.md" -Force
```

- [ ] **Step 3: Đối chiếu Module Icon System**

```powershell
$iconBackup = Join-Path $BackupPlans '2026-07-31-tohieuquiz-module-icon-system.md'
$iconDest = Join-Path $Repo 'docs\superpowers\plans\2026-07-31-tohieuquiz-module-icon-system.md'

if (Test-Path $iconBackup) {
  if (Test-Path $iconDest) {
    git diff --no-index -- $iconDest $iconBackup
  } else {
    Copy-Item $iconBackup $iconDest -Force
  }
}
```

Expected: file chỉ được khôi phục trực tiếp khi remote chưa có; file khác nội dung phải tạo `.recovered.md` để review.

- [ ] **Step 4: Review thay đổi tài liệu**

```powershell
git status --short -- docs/superpowers/plans
git diff -- docs/superpowers/plans
```

Expected: chỉ có tài liệu cần giữ và plan phục hồi; không có code/config.

---

### Task 6: Ngăn `mcp.json` bị commit nhầm lần nữa

**Files:**
- Potentially modify: `.gitignore`.

**Interfaces:**
- Consumes: `.gitignore` chính thức sau fast-forward.
- Produces: Git bỏ qua file cấu hình MCP local có khả năng chứa credential.

- [ ] **Step 1: Kiểm tra ignore hiện tại**

```powershell
git check-ignore -v mcp.json
```

Expected: nếu có output, không sửa `.gitignore`; nếu không có, tiếp tục.

- [ ] **Step 2: Thêm rule tối thiểu**

```powershell
$ignoreEntry = @'

# Local MCP configuration and credentials
/mcp.json
'@
Add-Content -LiteralPath '.gitignore' -Value $ignoreEntry -Encoding UTF8
```

- [ ] **Step 3: Kiểm tra diff và whitespace**

```powershell
git diff -- .gitignore
git diff --check
```

Expected: chỉ thêm comment và `/mcp.json`; không có whitespace error.

- [ ] **Step 4: Xác nhận rule hoạt động bằng file rỗng tạm thời**

```powershell
New-Item -ItemType File -Path '.\mcp.json' -Force | Out-Null
git check-ignore -v mcp.json
Remove-Item -LiteralPath '.\mcp.json' -Force
```

Expected: rule `/mcp.json` được áp dụng.

---

### Task 7: Làm mới project profile và cài dependencies từ lockfile

**Files:**
- Read: root và Worker package manifests/lockfiles.
- Generated locally: `node_modules/`, `workers/node_modules/`.

**Interfaces:**
- Consumes: mã nguồn đã đồng bộ và package scripts thật.
- Produces: dependencies tái lập đúng theo lockfile và MCP nhận diện đúng stack/scripts.

- [ ] **Step 1: Dùng MCP Local Coding làm mới profile**

```text
workspace_snapshot(path="C:\quizpro", refresh=true)
project_profile(path="C:\quizpro", refresh=true)
detect_test_commands(path="C:\quizpro")
```

Expected: nhận diện React/Vite/Cloudflare và các script thật, không còn profile Express thử nghiệm.

- [ ] **Step 2: Xác nhận Node.js**

```powershell
node --version
npm --version
```

Expected: Node.js `v22.22.0` hoặc mới hơn trong major được project hỗ trợ.

- [ ] **Step 3: Cài root dependencies**

```powershell
Set-Location 'C:\quizpro'
npm ci
if ($LASTEXITCODE -ne 0) { throw 'root npm ci failed' }
```

- [ ] **Step 4: Cài Worker dependencies**

```powershell
Push-Location '.\workers'
npm ci
$WorkerCiExit = $LASTEXITCODE
Pop-Location
if ($WorkerCiExit -ne 0) { throw 'workers npm ci failed' }
```

- [ ] **Step 5: Xác nhận không có manifest/lockfile drift**

```powershell
git status --short
git diff -- package.json package-lock.json workers/package.json workers/package-lock.json
```

Expected: không có diff ở manifests/lockfiles.

---

### Task 8: Chạy quality gate thật và chống “thành công giả”

**Files:**
- Execute: scripts trong `package.json`.

**Interfaces:**
- Consumes: dependencies sạch và script thật.
- Produces: bằng chứng lint, typecheck, test, build và security chạy qua implementation thực tế.

- [ ] **Step 1: In script definitions trước khi chạy**

```powershell
npm pkg get scripts.lint scripts.typecheck scripts.typecheck:strict scripts.typecheck:workers scripts.test:ci:all scripts.build scripts.security:check scripts.verify
```

Expected: có ESLint, TypeScript, Vitest, build thật và security scripts; không có `node --version`.

- [ ] **Step 2: Chạy lint**

```powershell
npm run lint
```

Expected: exit code `0`, ESLint thực sự quét repository.

- [ ] **Step 3: Chạy typecheck**

```powershell
npm run typecheck
npm run typecheck:strict
npm run typecheck:workers
```

Expected: cả ba lệnh exit code `0`.

- [ ] **Step 4: Chạy test CI**

```powershell
npm run test:ci:all
```

Expected: Vitest chạy test shards, có số lượng test cụ thể và exit code `0`.

- [ ] **Step 5: Chạy production build local**

```powershell
npm run build
```

Expected: tạo build output thật, exit code `0`, không deploy.

- [ ] **Step 6: Chạy security gate**

```powershell
npm run security:check
```

Expected: source/history/policy/dependency audits pass. Nếu phát hiện secret, dừng và không push.

- [ ] **Step 7: Chạy aggregate verification**

```powershell
npm run verify
```

Expected: quality gate tổng hợp exit code `0`.

- [ ] **Step 8: Quy tắc khi gate thất bại**

Nếu một lệnh thất bại:

1. Ghi lại lệnh và lỗi đầu tiên.
2. Dùng skill `systematic-debugging` hoặc `debugging-and-error-recovery`.
3. Phân biệt lỗi baseline từ remote với lỗi do phục hồi.
4. Không sửa `package.json` để bỏ qua lỗi.
5. Không deploy và không push trước khi có báo cáo nguyên nhân.

---

### Task 9: Commit tài liệu/bảo mật sau khi quality gate pass

**Files:**
- Potentially commit: plan phục hồi, kế hoạch Module Icon, `.gitignore`.
- Do not commit: `*.recovered.md` chưa review, `mcp.json`, artifacts, backup ngoài repo.

**Interfaces:**
- Consumes: quality gate pass và diff đã review.
- Produces: các commit nhỏ, tách biệt, không chứa secret.

- [ ] **Step 1: Review diff bằng MCP**

```text
git_status(cwd="C:\quizpro")
change_summary(cwd="C:\quizpro")
review_diff(cwd="C:\quizpro")
```

Expected: không còn thay đổi ở `package.json`, `README.md`, source thử nghiệm hoặc credential.

- [ ] **Step 2: Commit `.gitignore` riêng nếu đã thay đổi**

```powershell
git add .gitignore
git diff --staged --check
git commit -m "chore(security): ignore local MCP credentials"
```

- [ ] **Step 3: Commit tài liệu riêng**

```powershell
git add docs/superpowers/plans/2026-08-03-recover-local-main-and-rotate-github-token.md
if (Test-Path 'docs/superpowers/plans/2026-07-31-tohieuquiz-module-icon-system.md') {
  git add docs/superpowers/plans/2026-07-31-tohieuquiz-module-icon-system.md
}
git diff --staged --check
git commit -m "docs: add local repository recovery plan"
```

Expected: commit chỉ có tài liệu đã review. Không stage `*.recovered.md`.

---

### Task 10: Xác nhận Git cuối cùng và lập báo cáo

**Files:**
- Review: toàn bộ Git state.
- No deployment files modified intentionally.

**Interfaces:**
- Consumes: commits có chủ đích và quality evidence.
- Produces: báo cáo phục hồi rõ ràng, sẵn sàng xin phép push.

- [ ] **Step 1: Chạy final MCP checks**

```text
git_status(cwd="C:\quizpro")
workspace_doctor(path="C:\quizpro")
session_report(cwd="C:\quizpro")
```

- [ ] **Step 2: Xác nhận quan hệ với remote**

```powershell
git fetch origin --prune
git rev-list --left-right --count main...origin/main
git status --short --branch
git log -5 --oneline --decorate
```

Expected: local không behind; working tree sạch. Local có thể ahead đúng số commit tài liệu/bảo mật vừa tạo.

- [ ] **Step 3: Quét credential lần cuối**

```powershell
rg --hidden --files-with-matches `
  --glob '!.git/**' `
  --glob '!node_modules/**' `
  --glob '!dist/**' `
  '(ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})' `
  .
```

Expected: không có output.

- [ ] **Step 4: Báo cáo bắt buộc**

Báo cáo phải ghi:

- SHA trước phục hồi và SHA sau fast-forward.
- Số commit fast-forward thực tế.
- Token cũ đã được thu hồi hay chưa.
- Tài liệu kế hoạch được giữ/khôi phục/đối chiếu thế nào.
- `.gitignore` có được harden hay không.
- Kết quả lint, typecheck, test, build, security và verify.
- Git clean/ahead/behind bao nhiêu.
- Không có deployment nào được thực hiện.

- [ ] **Step 5: Chỉ push sau khi người dùng duyệt báo cáo**

```powershell
git push origin main
```

Expected: chỉ chạy sau phê duyệt; không dùng force. Nếu không có commit mới, không cần push.

---

## Stop Conditions

Dừng ngay và báo cáo nếu:

1. Không thể xác nhận token cũ đã bị thu hồi.
2. Backup chứa credential pattern.
3. Local `main` ahead trước khi đồng bộ.
4. Working tree xuất hiện thêm file ngoài Baseline.
5. Plan phục hồi xung đột đường dẫn với file đã có trên remote.
6. `git merge --ff-only origin/main` thất bại.
7. `HEAD` không bằng `origin/main` sau fast-forward.
8. Package scripts vẫn là `node --version`.
9. `npm ci` làm thay đổi lockfile.
10. Security history scan phát hiện credential trong Git history.
11. Lint, typecheck, test, build hoặc security gate thất bại.
12. Có yêu cầu rebase, force-push hoặc deploy để hoàn tất phục hồi.

## Acceptance Criteria

- Token cũ đã bị thu hồi trên GitHub.
- `mcp.json` plaintext đã bị xóa.
- Không còn credential pattern trong working tree và security scan pass.
- `package.json`, `README.md` và source tree đến từ `origin/main`.
- `src/index.js` thử nghiệm không còn tồn tại.
- `main` đã fast-forward và không behind remote.
- Các tài liệu kế hoạch đã được đối chiếu, không bị ghi đè mù quáng.
- Script `lint`, `typecheck`, `test`, `build`, `security` là script thật.
- `npm ci`, lint, typecheck, test, build, security và `npm run verify` đều pass.
- Git working tree sạch sau các commit có chủ đích.
- Không có force-push và không có production deployment.

## Execution Strategy

Thực hiện tuần tự bằng `executing-plans`, với checkpoint sau Task 2, Task 4, Task 6 và Task 8. Không chạy song song vì có thao tác credential và Git state. `gitNexus` không cần dùng vì kế hoạch không sửa API route handler hoặc contract API.
