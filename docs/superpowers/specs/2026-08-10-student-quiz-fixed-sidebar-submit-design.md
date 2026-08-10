# Student Quiz Fixed Sidebar + Submit Design

**Date:** 2026-08-10

## Goal

On the standard student quiz player, add the student's avatar to the quiz header, keep the desktop question navigator and submit action stationary, and make only the right-hand question column scroll. Hide the visual scrollbar while preserving mouse wheel, touchpad, touch, keyboard focus, and `scrollIntoView()` behavior.

## Scope

In scope:
- Standard student quiz flow rendered by `src/components/StudentView.tsx`.
- Desktop layout at `lg` and above.
- Student avatar in the shared `QuizHeader`, opt-in from `StudentView` so Live Exam remains unchanged.
- Desktop submit action directly below the question navigator and available on every page.
- Mobile/tablet keep the existing natural page scroll and `MobileQuizNavigator` behavior.
- Long desktop question navigators may scroll internally with a hidden scrollbar while the submit button remains available.

Out of scope:
- Worker/API/D1 changes.
- Scoring, answer persistence, timer behavior, question shuffling, or submission semantics.
- Live Exam layout redesign.
- New avatar upload or avatar data changes.

## Architecture

### 1. Header avatar

`QuizHeader` already receives `avatar?: string | null` but does not render it. Add an explicit `showAvatar?: boolean` opt-in prop (default `false`). `StudentView` passes `showAvatar`; `LiveExamQuiz` continues using the default and therefore keeps its existing appearance.

When enabled:
- Render a compact square avatar before title/progress text.
- If `avatar` exists, render the image with `object-cover`.
- If no avatar exists, render the first visible character of `studentName`, falling back to `HS`.
- Keep the current title/progress truncation and timer layout.

### 2. Desktop shell and scroll ownership

At `lg` and above, `StudentView` becomes a viewport-height flex shell:
- outer quiz shell: `lg:h-dvh lg:overflow-hidden`;
- header: flex child with no content scrolling;
- content region: `min-h-0 flex-1`;
- left aside: fixed in the content region and does not participate in right-column scrolling;
- right `<main>`: `lg:min-h-0 lg:overflow-y-auto` and is the only question-content scroll container.

Scrollbar visuals are hidden with CSS utilities that preserve scrolling:
- `scrollbar-width: none` for Firefox;
- `-ms-overflow-style: none` for legacy Edge behavior;
- hidden `::-webkit-scrollbar` for Chromium/Safari.

No `overflow: hidden` is applied to the right content itself.

### 3. Contained desktop question navigator

`QuizNavigation` is shared with Live Exam, where its current `sticky top-24` behavior must remain. Add an opt-in `contained?: boolean` prop (default `false`).

When `contained=true`:
- root card becomes a shrinkable `flex min-h-0 flex-col overflow-hidden` container instead of sticky;
- with short quizzes, the card stays content-height so the submit button sits immediately below it;
- heading and legend remain visible;
- the question-number grid gets its own `min-h-0 flex-1 overflow-y-auto` region with hidden scrollbar;
- with 50–100 questions, the card shrinks to the available sidebar height and only the number grid scrolls, keeping the submit button visible.

The default path remains unchanged for Live Exam.

### 4. Shared submit button and responsive placement

Create `QuizSubmitButton.tsx` as a small presentation component that owns only:
- visible text (`Nộp bài` / `Đang nộp bài...`);
- disabled state;
- shared button styling.

`StudentView` renders this button under `QuizNavigation` on desktop. Clicking it still calls `setShowSubmitConfirm(true)`; it never submits directly.

`QuizPagination` continues to render the submit button on the last page for existing consumers. Add `hideSubmitOnDesktop?: boolean` (default `false`). `StudentView` passes `true`, so mobile/tablet retain the existing last-page submit button while desktop avoids duplication. `LiveExamQuiz` does not pass the prop and keeps its current submit control.

Desktop submit errors render under the sidebar button; mobile/tablet keep the current error position below pagination. Only one copy is visible at each responsive breakpoint.

## Accessibility

- Avatar image/fallback has an accessible name when displayed.
- Submit controls remain native `<button>` elements with at least 48px height.
- Existing `SubmitConfirmModal` remains the confirmation gate and focus-management authority.
- Add `aria-label="Điều hướng bài làm"` to the desktop `<aside>` and `aria-label="Nội dung câu hỏi"` to `<main>` for clearer landmarks.
- Preserve reduced-motion handling in `useQuizPageNavigation`.

## Responsive behavior

- 1440px / 1024px: header stationary, left navigator/submit stationary, right questions independently scroll.
- 768px and below: existing single-column page flow and mobile bottom-sheet navigator remain; no fixed desktop aside.
- 390px / 320px: no horizontal overflow; avatar remains compact and title/timer can shrink safely.

## Testing strategy

TDD unit tests first:
- `QuizHeader` renders real avatar and fallback only when explicitly enabled.
- `QuizNavigation` default stays sticky; contained mode exposes internal scrolling structure.
- `QuizPagination` hides desktop submit only when opt-in is provided and leaves default behavior unchanged.
- `StudentView` desktop sidebar submit calls the existing confirmation setter; standard layout includes fixed-aside/right-scroll classes.

Regression tests:
- Existing `MobileQuizNavigator`, `quizPageNavigation`, `LiveExamQuiz.pagination`, and `LiveExamQuiz.progress` remain green.
- Cypress extends `student-quiz-reliability.cy.ts` with desktop checks for sidebar position, right-column scrolling, hidden scrollbar, submit visibility, exact question navigation, and horizontal overflow.

## Acceptance criteria

1. Student avatar appears at the left of the standard student quiz header; missing avatar shows a compact fallback.
2. Live Exam header layout is unchanged by default.
3. Desktop question list and submit button remain stationary while the right question column scrolls.
4. Desktop submit is available on every page and still opens the existing confirmation modal.
5. Mobile/tablet keep current navigation and last-page submit behavior.
6. Long navigator lists can scroll internally without a visible scrollbar.
7. No horizontal overflow at 320, 390, 768, 1024, or 1440 widths.
8. Focus-to-question navigation still scrolls/focuses the intended question.
9. No backend, migration, scoring, persistence, or API contract changes.
