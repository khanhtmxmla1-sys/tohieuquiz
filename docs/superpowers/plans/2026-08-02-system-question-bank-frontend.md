# TôHiệuQuiz System Question Bank Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép giáo viên duyệt kho hệ thống và kho cá nhân trong trình soạn đề, đồng thời cung cấp màn hình admin quản lý và nhập hàng loạt câu hỏi hệ thống.

**Architecture:** Frontend dùng service V2 có phân trang server-side và giữ method legacy. `TestBankModal` quản lý tab, filter, pagination và action; `TestBankBrowser` chỉ render dữ liệu. Màn hình admin là route lazy-load được bảo vệ bởi `AdminRoute` và feature flag runtime.

**Tech Stack:** React, TypeScript, React Router, Tailwind CSS, Vitest, Testing Library, Cypress.

## Global Constraints

- Không tải toàn bộ kho về trình duyệt để lọc.
- Giáo viên không thấy nút sửa/xóa SYSTEM.
- Feature flag tắt thì giao diện cũ và service legacy vẫn hoạt động.
- Mọi nút tương tác có min-height 44px và accessible name.
- Không thay đổi contract `Question` khi thêm câu vào đề.
- Loading, empty, error và retry phải có trạng thái rõ ràng.

---

## File Map

**Create**
- `src/features/question-bank/questionBank.types.ts`
- `src/features/question-bank/useQuestionBank.ts`
- `src/features/question-bank/SystemQuestionBankAdminPage.tsx`
- `src/features/question-bank/components/QuestionBankFilters.tsx`
- `src/features/question-bank/components/QuestionBankPagination.tsx`
- `src/features/question-bank/components/BulkQuestionImportPanel.tsx`
- `src/features/question-bank/components/BulkImportReviewTable.tsx`
- `tests/questionBankServiceV2.test.ts`
- `tests/TestBankModal.system.test.tsx`
- `tests/SystemQuestionBankAdminPage.test.tsx`
- `cypress/e2e/system-question-bank.cy.ts`

**Modify**
- `src/services/testBankService.ts`
- `src/features/quiz-editor/components/TestBankModal.tsx`
- `src/features/quiz-editor/components/TestBankBrowser.tsx`
- `src/app/lazyViews.ts`
- `src/app/AppRoutes.tsx`
- `src/components/TeacherDashboard/TeacherDashboard.tsx` or the active admin navigation registry discovered during implementation
- `tests/QuestionBankDrawer.test.tsx`
- `tests/apiErrorPresentation.test.tsx`

### Task 1: Typed V2 service with legacy preservation

**Interfaces:**
- Produces `listQuestionBank(params)`, `getQuestionBankItem(id)`, `createQuestionBankItem`, `patchQuestionBankItem`, `archiveQuestionBankItem`, `bulkImportQuestionBank`, `copyQuestionToPersonal`.
- Keeps `getTestBank`, `saveQuestion`, `deleteQuestion` unchanged for fallback.

- [x] **Step 1: Write failing service tests**

Assert query serialization, credentials, pagination mapping, 409 duplicate error details and bulk payload.

- [x] **Step 2: Run and verify failure**

Run: `npm test -- tests/questionBankServiceV2.test.ts tests/testBankService.test.ts`
Expected: V2 tests FAIL; legacy tests PASS.

- [x] **Step 3: Add frontend types**

Re-export shared contracts and define UI filters:

```ts
export interface QuestionBankFilters {
  scope: 'SYSTEM' | 'PERSONAL';
  search: string;
  grade?: number;
  subject?: string;
  semester?: number;
  topicCode?: string;
  lessonCode?: string;
  type?: QuestionType;
  difficulty?: 1 | 2 | 3;
  page: number;
  pageSize: number;
}
```

- [x] **Step 4: Implement service methods**

Use `URLSearchParams`; omit undefined/empty values; always use `credentials: 'include'`. Normalize all API failures into `QuestionBankApiError` with `code`, `status`, `details`.

- [x] **Step 5: Run tests**

Run: `npm test -- tests/questionBankServiceV2.test.ts tests/testBankService.test.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/features/question-bank/questionBank.types.ts src/services/testBankService.ts tests/questionBankServiceV2.test.ts tests/testBankService.test.ts
git commit -m "feat(question-bank): add typed frontend API client"
```

### Task 2: Query hook and filter components

**Interfaces:**
- Produces `useQuestionBank(filters, enabled)` with `{ items, pagination, loading, loaded, error, reload }`.
- Produces controlled `QuestionBankFilters` and `QuestionBankPagination` components.

- [x] **Step 1: Write failing hook/component tests**

Test stale response cancellation, resetting page to 1 after filter changes, retry, and disabled state.

- [x] **Step 2: Implement `useQuestionBank`**

Use an `active` flag or AbortController. Debounce only search by 300ms; select filters apply immediately.

- [x] **Step 3: Implement filters**

Fields: keyword, grade, subject, semester, topic, lesson, type, difficulty. Curriculum-dependent topic/lesson options come from a small static catalog shared with the dataset plan, not from hard-coded JSX branches.

- [x] **Step 4: Implement pagination**

Display `Trang X/Y`, previous/next buttons, total item count and page-size selector 30/50/100.

- [x] **Step 5: Run tests and commit**

Run: `npm test -- tests/TestBankModal.system.test.tsx`
Expected: focused component tests PASS.

### Task 3: Upgrade teacher bank modal to SYSTEM/PERSONAL tabs

**Interfaces:**
- `TestBankModal` owns active scope, selection and copy/delete actions.
- `TestBankBrowser` receives already-filtered server results and source metadata.

- [x] **Step 1: Write failing modal tests**

Cover default SYSTEM tab when it has data, fallback PERSONAL when SYSTEM total is zero, tab-specific actions, adding selected questions, and copy success refresh.

- [x] **Step 2: Run and verify failure**

Run: `npm test -- tests/TestBankModal.system.test.tsx`
Expected: FAIL.

- [x] **Step 3: Refactor browser props**

Replace client-only filter state with:

```ts
interface TestBankBrowserProps {
  items: QuestionBankItem[];
  scope: 'SYSTEM' | 'PERSONAL';
  loading: boolean;
  selectedIds: Set<string>;
  onToggle(id: string): void;
  onDelete?(item: QuestionBankItem): void;
  onCopyToPersonal?(item: QuestionBankItem): void;
}
```

Cards show type, difficulty, grade, subject, topic, lesson, source and tags. SYSTEM cards show copy but not delete for teachers.

- [x] **Step 4: Add tabs and filters to modal**

Use labels `Kho hệ thống` and `Kho của tôi`; update dialog label/title to `Ngân hàng câu hỏi`. Preserve `cloneQuestionFromBank` when adding to the quiz.

- [x] **Step 5: Implement copy/delete feedback**

On duplicate copy, show a non-destructive toast indicating the question already exists. On successful copy, refresh PERSONAL data without switching tabs automatically.

- [x] **Step 6: Run tests and commit**

Run: `npm test -- tests/TestBankModal.system.test.tsx tests/QuestionBankDrawer.test.tsx`
Expected: PASS.

### Task 4: Feature flag resolution and fallback behavior

- [x] **Step 1: Write failing flag-gating tests**

Mock `resolveRuntimeFeatureFlag('system_question_bank_v1')` as enabled/disabled/error. Disabled or resolution error must use the current personal-only modal.

- [x] **Step 2: Implement flag hook in the modal boundary**

Do not scatter flag checks throughout child components. Resolve once when modal opens and listen for `tohieuquiz:feature-flags-updated`.

- [x] **Step 3: Run tests**

Run: `npm test -- tests/TestBankModal.system.test.tsx tests/unifiedNotificationsFeatureFlag.test.tsx`
Expected: PASS.

### Task 5: Admin management page

**Interfaces:**
- Route `/teacher/system-question-bank`.
- Admin can filter by status, create/edit, publish/archive, bulk import and review results.

- [x] **Step 1: Write failing admin page tests**

Test AdminRoute protection, counts for DRAFT/PUBLISHED/ARCHIVED, table filters, bulk preview, publish/archive actions and per-row import status.

- [x] **Step 2: Build page shell**

Create a header, three status summary cards, filters, paginated table and action bar. Reuse existing question editor/modal rather than creating a second editor contract.

- [x] **Step 3: Build bulk import panel**

Accept `.json` only in V1. Parse client-side, require an array, cap preview at 100, show validation warnings before submission, and send the original normalized objects to the bulk API.

- [x] **Step 4: Build review table**

Rows display index, result `CREATED`, `DUPLICATE` or `INVALID`, and the created ID, existing ID or validation errors. Export is omitted in V1 because no matching existing utility is available.

- [x] **Step 5: Add route and lazy import**

Add `SystemQuestionBankAdminPage` to the teacher dashboard lazy-tab registry and protect `/teacher/system-question-bank` with `ProtectedRoute role="teacher"` plus `AdminRoute`.

- [x] **Step 6: Add admin navigation entry**

Place `Ngân hàng câu hỏi hệ thống` under the existing admin/system group, visible only to admin and only when the feature flag is enabled.

- [x] **Step 7: Run tests and commit**

Run: `npm test -- tests/SystemQuestionBankAdminPage.test.tsx tests/AppShell.test.tsx tests/routeGuards.test.tsx`
Expected: PASS.

### Task 6: Accessibility, responsive behavior and E2E

- [x] **Step 1: Add Cypress fixture data**

Stub SYSTEM and PERSONAL list endpoints, copy action, bulk import and admin status updates.

- [x] **Step 2: Add E2E journeys**

Component integration covers teacher modal selection, add-to-quiz and copy-to-personal. Cypress covers the admin route, server-side filters, JSON preview/import, publish and archive actions.

- [x] **Step 3: Test responsive layouts**

Verify 390, 768 and 1440 widths; filters and tables remain usable without horizontal page scrolling.

- [x] **Step 4: Test keyboard and screen reader semantics**

Tabs use `role="tablist"`, `role="tab"`, `aria-selected`; controls have accessible names and minimum 44px targets; status messages use `role="status"` or `role="alert"` appropriately.

- [x] **Step 5: Run frontend quality checks**

```bash
npm test -- tests/questionBankServiceV2.test.ts tests/TestBankModal.system.test.tsx tests/SystemQuestionBankAdminPage.test.tsx
npm run typecheck
npm run lint
npm run cypress:run -- --spec cypress/e2e/system-question-bank.cy.ts
```

Expected: all PASS.

- [x] **Step 6: Commit verification notes**

Record results in `docs/testing/system-question-bank-frontend-verification.md` and commit.
