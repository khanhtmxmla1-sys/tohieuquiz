# Teacher Dashboard Audit P1 Design

**Date:** 2026-08-09

## Goal

Fix the concrete Teacher Dashboard UX defects confirmed by Playwright without redesigning the whole dashboard or changing backend/API contracts.

## Evidence

Playwright against the production frontend with the repository's authenticated API fixtures confirmed:

- At 1024px, the desktop sidebar remains 240px while Quick Actions switches to six columns; each action is about 104px wide and several titles truncate.
- On `/teacher/assignments` at mobile width, none of the five bottom-navigation items is active; `Thêm` also has no `aria-current` state.
- The breadcrumb item `Trang chủ` is a non-interactive `span` despite hover styling.
- The per-row `Quản lý` button in `Đề kiểm tra gần đây` opens the generic `/teacher/quizzes` page rather than the selected quiz editor.
- Several dashboard controls measure 40px instead of the established 44px minimum target.
- No horizontal overflow was observed at 1440, 1024, 390, or 320px.

## Chosen approach

Use a targeted stabilization patch rather than a broad visual redesign.

1. Keep Quick Actions at 2 columns on mobile and 3 columns from `md`; move the six-column layout from `lg` to `xl`.
2. Treat every dashboard tab not represented by the four primary mobile items as belonging to `Thêm`; when such a tab is active, `Thêm` receives the same active styling and `aria-current="page"`.
3. Make `Trang chủ` a real anchor to `/`; keep `Dashboard giáo viên` as the current breadcrumb item.
4. Add an explicit `onOpenQuiz(quizId)` callback from the dashboard routing container to `RecentQuizzesPanel`, and use `getQuizEditorRoute(quizId)` so each recent quiz opens the canonical unified editor.
5. Raise only the confirmed dashboard shell/overview interactive controls from 40px to at least 44px; do not globally change unrelated components.

## Alternatives considered

### A. Full dashboard redesign

Rejected for this patch because the defects are isolated and existing responsive/function tests are green. A full redesign would increase visual and regression risk without being necessary to fix the confirmed issues.

### B. Collapse the desktop sidebar earlier

Rejected for now. It could solve the 1024px Quick Action density, but it changes the dashboard information architecture and shell behavior. Moving the six-column breakpoint to `xl` is smaller and directly addresses the measured clipping.

### C. Route recent-quiz actions from inside `RecentQuizzesPanel`

Rejected in favor of a callback. Keeping routing in the shell/container preserves the current separation between presentation and navigation logic.

## Interfaces

- `OverviewTabProps` gains `onOpenQuiz: (quizId: string) => void`.
- `RecentQuizzesPanelProps` gains `onOpenQuiz: (quizId: string) => void` while preserving `onManageQuizzes` for `Xem tất cả`.
- `TeacherDashboardCoreTabs` supplies `onOpenQuiz={(quizId) => navigate(getQuizEditorRoute(quizId))}`.
- No API, Worker, D1, migration, auth, storage, or feature-flag contract changes.

## Accessibility and responsive requirements

- Interactive dashboard controls touched by this patch must be at least 44px on the relevant axis.
- `Thêm` must expose `aria-current="page"` when the current mobile tab is outside `overview`, `manage`, `classes`, and `results`.
- Breadcrumb `Trang chủ` must be keyboard focusable as a native link.
- 1024px Quick Action titles must not be forced into the six-column layout.
- Existing no-horizontal-overflow behavior must remain intact at 1440, 1024, 768, 390, and 320px.

## Tests

TDD coverage will include:

- Unit regression: Quick Action grid uses `xl:grid-cols-6`, not `lg:grid-cols-6`.
- Unit regression: `Trang chủ` is a real link to `/`.
- Unit regression: clicking a recent quiz row action calls `onOpenQuiz` with that quiz ID; `Xem tất cả` still calls `onManageQuizzes`.
- Unit regression: mobile `Thêm` is active for a secondary tab and inactive for a primary tab.
- Cypress responsive regression: at 1024px Quick Actions render as three columns and visible titles are not horizontally clipped; mobile secondary-tab navigation marks `Thêm` current.
- Focused Vitest, typecheck, lint, frontend build, performance budget, and Playwright responsive measurements after implementation.

## Non-goals

- No redesign of Hero, KPI hierarchy, Action Center information density, mobile IA labels, or dashboard search behavior.
- No dependency upgrades or vulnerability remediation in this patch.
- No commit, push, production migration, or deployment without explicit user permission.
