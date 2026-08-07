# Dashboard reorder + manual quiz class selection

## Goal

Approved option: A — use real classes from the system for manual quiz settings.

1. Move the five KPI cards on the Teacher Overview below the learning-results section.
2. Move the quiz creation choices (AI/manual) into the space currently occupied by the KPI cards, directly below the hero/action-center composition.
3. Add real-class selection to the manual quiz “Thiết lập đề” drawer.

## Dashboard composition

Desktop and responsive order becomes:

1. Breadcrumb
2. Hero + Action Center
3. Error alert when applicable
4. Quiz creation choices (AI / manual)
5. Quick actions
6. Learning results: Performance panel + Recent submissions
7. KPI cards
8. Recent quizzes

The KPI component itself is not redesigned; only its position changes. This keeps the current visual contract and data calculations intact.

## Manual quiz class selection

The existing manual quiz data model already stores `quiz.classLevel`. The settings drawer will be expanded from a time-only drawer to a quiz-settings drawer containing:

- “Lớp áp dụng” selector using real classes from `useClassStore`.
- “Thời gian làm bài” controls already present.

Class loading follows existing authorization behavior:

- Admin: load all classes with `fetchClasses()`.
- Teacher: load only classes owned/assigned to that teacher with `fetchClasses(username)`.

The selector stores the selected classroom name in `quiz.classLevel`, preserving the existing quiz contract and avoiding a schema/database migration. Existing values remain valid even if the matching class no longer exists; the drawer will show the current value as a fallback option so editing an older quiz does not silently change its class.

For read-only quizzes, both class and time fields are disabled.

## Data flow

`ManualQuizWorkspacePage` reads auth state and `useClassStore`, loads classes when the settings drawer opens, and passes class options plus the current `classLevel` into `QuizSettingsDrawer`.

`QuizSettingsDrawer` keeps a local class draft and time draft. “Áp dụng” returns both values in one payload. `ManualQuizWorkspacePage` then calls the existing `updateQuiz` action once with `{ classLevel, timeLimit }`.

No backend endpoint, database field, migration, or public route changes are required.

## Tests

Regression coverage should verify:

- Teacher Overview renders quiz creation before the learning-results section and KPI cards after it.
- Manual quiz settings render real classes.
- Applying settings updates `classLevel` and `timeLimit` together.
- Read-only mode disables class and time settings.
- Existing class value remains selectable when it is absent from the fetched class list.
- Existing focus-trap / Escape behavior remains intact.

## Review notes

- No placeholders or unresolved decisions remain.
- The selected-class value continues using the existing `classLevel` string contract, so there is no migration risk.
- The layout change is composition-only and preserves existing panel implementations.

## Non-goals

- Do not add class assignment behavior to quiz publishing.
- Do not create a new `classId` field or migration.
- Do not change AI quiz creation class behavior.
- Do not redesign KPI cards, result charts, or the manual quiz editor shell.
- Do not push or deploy without explicit user approval. A later follow-up explicitly authorized one local commit after MathJax CDN hardening.
