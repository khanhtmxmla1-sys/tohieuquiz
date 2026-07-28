# TôHiệuQuiz Modernization Baseline — 2026-07-28

## Purpose

This report locks the reproducible local baseline used before Batch 3 governance and auth-enforcement changes. It contains no credentials, token values, environment secrets or production data.

## Source and workspace provenance

| Item | Value |
|---|---|
| Integration branch | `feat/modernization-integration` |
| Integration worktree | `C:\quizpro\.worktrees\modernization-integration` |
| Source HEAD | `828d8c1223aa3d448fed029feb114394fb502b1d` |
| Merge base with `origin/main` | `4b561e898f997cb1ae10a63a2f5a595e7e645cd8` |
| Main repository branch | `main` |
| Main repository HEAD | `4b561e898f997cb1ae10a63a2f5a595e7e645cd8` |
| Node.js | `v24.13.0` |
| npm | `11.13.0` |
| Git | `2.52.0.windows.1` |
| OS | `Microsoft Windows NT 10.0.26100.0` |

The master plan originally proposed a worktree named `.worktrees/security-ui-modernization-20260728` on `feat/security-ui-modernization`. Execution instead uses the already-isolated integration worktree and branch above so completed modernization batches remain in one auditable history.

### Main repository status before baseline

```text
 M AGENTS.md
 M CLAUDE.md
?? .agent/
?? docs/superpowers/plans/2026-07-28-security-ui-feature-modernization-master-plan.md
?? implementation_plan.md
?? task.md
```

These pre-existing main-repository changes were not edited, staged or committed by the baseline run.

### Integration worktree status before baseline

```text
(clean)
```

The production build regenerated `public/sitemap.xml`, and dependency audits generated ignored files under `reports/`. Both are execution artifacts and are removed or restored before the baseline commit.

## Reproduction commands and results

Run from `C:\quizpro\.worktrees\modernization-integration`.

| Command | Result | Duration |
|---|---:|---:|
| `npm ci` | Passed; 719 packages installed; 0 vulnerabilities | 76.10 s |
| `npm ci --prefix workers` | Passed; 40 packages installed; 0 vulnerabilities | 18.46 s |
| `npm run lint` | Passed; 0 warnings allowed | 21.81 s |
| `npx tsc --noEmit` | Passed | 39.87 s |
| `npx tsc -p workers/tsconfig.json --noEmit` | Passed | 12.23 s |
| `npm run test:run -- --reporter=dot` | Failed with four known baseline assertions | 409.71 s |
| `npm run security:check` | Passed | 26.87 s |
| `npm run build` | Passed; Vite transformed 4,447 modules | 41.41 s wrapper; 36.36 s Vite build |

### Full test baseline

- Test files: **304 passed, 3 failed, 307 total**.
- Tests: **1,432 passed, 4 failed, 1,436 total**.
- Vitest-reported duration: **407.51 seconds**.

Known failures present before Batch 3 implementation:

1. `tests/freshD1Bootstrap.test.ts` expects 42 migrations but the repository now contains 43 after migration `0044_create_ai_tutor_usage.sql`.
2. `tests/studentDashboardCopy.test.ts` still asserts the previous ErrorBoundary copy after the supportable-error UI was introduced.
3. `src/services/api/__tests__/apiClient.test.ts` still asserts the previous 401 message.
4. `src/services/api/__tests__/apiClient.test.ts` still asserts the previous network/CORS message.

These failures are assertion drift from the already-committed modernization work. They are recorded here rather than hidden or attributed to the upcoming Task 3/Task 10 changes.

### Security baseline

`npm run security:check` passed all enforced gates:

- Repository scan: 1,727 tracked or unignored files checked.
- Reachable Git history secret scan: passed.
- CSP, CORS, browser-auth and migration rollback policy gates: passed.
- Root production dependency audit: 0 critical, 0 high, 0 moderate, 0 low.
- Workers production dependency audit: 0 critical, 0 high, 0 moderate, 0 low.

## Bundle and CSS baseline

- CSS total: **261,135 bytes minified**, **41,649 bytes gzip**.
- JavaScript chunks over 100 KB minified: **12**.

| Chunk | Minified bytes | Gzip bytes |
|---|---:|---:|
| `index-Bljwq9Y5.js` | 404,881 | 101,908 |
| `WorksheetExportModal-D33WkT5F.js` | 384,271 | 112,535 |
| `jspdf.es.min-CZLYaLQb.js` | 384,178 | 125,536 |
| `index-CBbhqmgK.js` | 359,603 | 114,650 |
| `Tooltip-BwUPBe_w.js` | 305,077 | 93,075 |
| `html2canvas.esm-QH1iLAAe.js` | 202,379 | 48,044 |
| `CreateTab-DBvj1eTy.js` | 159,983 | 47,769 |
| `index.es-BcbO1DrD.js` | 159,595 | 53,533 |
| `StudentDashboardUI-Bao5en3Q.js` | 145,490 | 37,699 |
| `ManualQuizWorkspacePage-m44ZgtLy.js` | 132,006 | 39,634 |
| `TeacherLiveExamDashboardContainer-DR5z2xNe.js` | 117,958 | 29,682 |
| `vendor-motion-K7xuzy2c.js` | 117,801 | 39,080 |

No chunk exceeds the current 500 KB minified budget.

## Feature-flag and auth configuration baseline

Production-default frontend flags used by CI/build remain disabled:

```text
VITE_FEATURE_GIFT_SHOP_V2=false
VITE_FEATURE_AI_QUIZ_V2=false
VITE_FEATURE_AI_BLUEPRINT_V3=false
VITE_FEATURE_PARENT_PORTAL_V1=false
VITE_GIFT_SHOP_MODE=api
```

The manual quiz workspace preserves existing access by default when `VITE_FEATURE_MANUAL_QUIZ_WORKSPACE_V1` is absent.

Worker auth configuration before Task 10:

```text
AUTH_MIGRATION_MODE="compat"
AUTH_TOKEN_TRANSPORT_MODE="cookie"
```

## Warnings and limitations

- npm reports `mathjax-full@3.2.2` as deprecated because MathJax 4 uses `@mathjax/src`.
- The full suite is slow on this Windows environment and took approximately 6 minutes 50 seconds.
- The four known test failures above must be aligned before the Batch 3 final gate can be green.
- No production deployment, secret change, production migration or production database operation was performed.
