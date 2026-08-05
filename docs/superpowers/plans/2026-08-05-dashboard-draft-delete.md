# Dashboard Draft Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm hành động **Xóa bản nháp** trực tiếp trên thẻ Bản nháp của trang Tổng quan, có xác nhận, kiểm tra quyền phía server, dọn bản cục bộ và cập nhật Action Center ngay sau khi xóa.

**Architecture:** Worker trả một `secondaryAction` có cấu trúc cho bản nháp gần nhất thay vì để frontend phân tích URL. Frontend dùng API xóa draft hiện có, một dialog riêng cho xác nhận và reload Action Center sau mutation. Bản cục bộ được dọn best-effort để tránh draft đã xóa tự xuất hiện lại trên cùng thiết bị.

**Tech Stack:** React 19, TypeScript, React Router, Tailwind CSS, Vitest, Testing Library, Cloudflare Workers/D1.

## Global Constraints

- Nút chính xác nhận phải có nhãn `Xóa bản nháp`.
- Nút hủy trong dialog phải có nhãn `Giữ lại`.
- Không xây Thùng rác, khôi phục hoặc xóa hàng loạt trong đợt này.
- Không thay đổi API DELETE draft hiện có ngoài việc tái sử dụng nó.
- Backend tiếp tục kiểm tra teacher/admin và ownership.
- Item không phải `draft_unpublished` không được có hành động xóa.
- Không parse `draftId` từ `cta.url` ở frontend.

---

### Task 1: Mở rộng hợp đồng Action Center

**Files:**
- Modify: `shared/teacher-action-center.contract.ts`
- Modify: `workers/src/services/actionCenterService.ts`
- Test: `tests/actionCenterService.test.ts`

**Interfaces:**
- Produces: `TeacherActionMutation`, `TeacherActionItem.secondaryAction?: TeacherActionMutation`.
- Produces: item draft có `kind: 'delete_draft'`, `resourceId`, `resourceLabel`, `ownerUsername`.

- [ ] **Step 1: Viết test Worker thất bại**

Thêm kỳ vọng:

```ts
expect(center.items.find((item) => item.kind === 'draft_unpublished')?.secondaryAction).toEqual({
  kind: 'delete_draft',
  label: 'Xóa bản nháp',
  resourceId: 'draft-latest',
  resourceLabel: 'Đề Toán đang soạn',
  ownerUsername: 'teacher-a',
});
```

- [ ] **Step 2: Chạy test để xác nhận RED**

Run:

```bash
npm run test:ci -- tests/actionCenterService.test.ts
```

Expected: FAIL vì `secondaryAction` chưa tồn tại.

- [ ] **Step 3: Mở rộng contract và query**

Thêm:

```ts
export type TeacherActionMutationKind = 'delete_draft';

export interface TeacherActionMutation {
  kind: TeacherActionMutationKind;
  label: string;
  resourceId: string;
  resourceLabel: string;
  ownerUsername: string;
}
```

Trong `loadDrafts()`, trả thêm title và owner của draft mới nhất. Trong item draft:

```ts
secondaryAction: drafts.next_id ? {
  kind: 'delete_draft',
  label: 'Xóa bản nháp',
  resourceId: drafts.next_id,
  resourceLabel: drafts.next_label || DEFAULT_MANUAL_QUIZ_DRAFT_TITLE,
  ownerUsername: drafts.next_owner || actor.username || '',
} : undefined,
```

- [ ] **Step 4: Chạy test GREEN**

```bash
npm run test:ci -- tests/actionCenterService.test.ts
```

Expected: PASS.

### Task 2: Xác thực hợp đồng ở frontend

**Files:**
- Modify: `src/services/teacherActionCenterService.ts`
- Test: `tests/teacherActionCenterService.test.ts`

**Interfaces:**
- Consumes: `TeacherActionMutation` từ Task 1.
- Produces: validator chỉ chấp nhận `delete_draft` với đủ chuỗi không rỗng.

- [ ] **Step 1: Tạo test validator thất bại**

Mock `callApi` và kiểm tra payload draft action hợp lệ được trả về; payload có `secondaryAction.kind = 'unknown'` phải reject với `Dữ liệu việc cần chú ý không hợp lệ.`

- [ ] **Step 2: Chạy test RED**

```bash
npm run test:ci -- tests/teacherActionCenterService.test.ts
```

Expected: FAIL vì validator chưa kiểm tra secondary action.

- [ ] **Step 3: Thêm `isSecondaryAction()`**

```ts
const isSecondaryAction = (value: unknown): value is TeacherActionMutation => {
  if (!value || typeof value !== 'object') return false;
  const action = value as Partial<TeacherActionMutation>;
  return action.kind === 'delete_draft'
    && typeof action.label === 'string' && action.label.length > 0
    && typeof action.resourceId === 'string' && action.resourceId.length > 0
    && typeof action.resourceLabel === 'string' && action.resourceLabel.length > 0
    && typeof action.ownerUsername === 'string' && action.ownerUsername.length > 0;
};
```

Cho phép `secondaryAction` vắng mặt; nếu có thì phải hợp lệ.

- [ ] **Step 4: Chạy test GREEN**

```bash
npm run test:ci -- tests/teacherActionCenterService.test.ts
```

Expected: PASS.

### Task 3: Tạo dialog xác nhận xóa

**Files:**
- Create: `src/components/TeacherDashboard/overview/DraftDeleteDialog.tsx`
- Test: `tests/draftDeleteDialog.test.tsx`

**Interfaces:**
- Consumes: `TeacherActionMutation`.
- Produces: `DraftDeleteDialog({ action, isDeleting, onClose, onConfirm })`.

- [ ] **Step 1: Viết component test RED**

Kiểm tra dialog có tên `Xóa bản nháp này?`, hiển thị resource label, nút `Giữ lại`, nút `Xóa bản nháp`, và khóa hai hành động phá hủy khi `isDeleting=true`.

- [ ] **Step 2: Chạy test RED**

```bash
npm run test:ci -- tests/draftDeleteDialog.test.tsx
```

Expected: FAIL vì component chưa tồn tại.

- [ ] **Step 3: Tạo component**

Dùng `Modal`, icon `Trash2`/`Loader2`, `initialFocusRef` trỏ vào nút `Giữ lại`, `closeOnBackdrop={!isDeleting}` và `closeOnEscape={!isDeleting}`.

- [ ] **Step 4: Chạy test GREEN**

```bash
npm run test:ci -- tests/draftDeleteDialog.test.tsx
```

Expected: PASS.

### Task 4: Nối hành động xóa vào Action Center

**Files:**
- Modify: `src/components/TeacherDashboard/overview/ActionCenterPanel.tsx`
- Modify: `tests/actionCenterPanel.test.tsx`

**Interfaces:**
- Consumes: `deleteRemoteManualQuizDraftIfExists(draftId)`.
- Consumes: `removeLocalDraft(ownerUsername, draftId)`.
- Produces: nút secondary action và mutation flow có reload.

- [ ] **Step 1: Viết UI test RED**

Mock `deleteRemoteManualQuizDraftIfExists`, `removeLocalDraft`, `showSuccess`, `showError`. Kiểm tra:

```ts
fireEvent.click(await screen.findByRole('button', { name: 'Xóa bản nháp' }));
expect(screen.getByRole('dialog', { name: 'Xóa bản nháp này?' })).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'Xóa bản nháp', hidden: false }));
await waitFor(() => expect(deleteDraftMock).toHaveBeenCalledWith('draft-latest'));
expect(removeLocalDraftMock).toHaveBeenCalledWith('teacher-a', 'draft-latest');
expect(fetchTeacherActionCenterMock).toHaveBeenCalledTimes(2);
expect(showSuccessMock).toHaveBeenCalledWith('Đã xóa bản nháp.');
```

Thêm test lỗi API không xóa item và gọi `showError`.

- [ ] **Step 2: Chạy test RED**

```bash
npm run test:ci -- tests/actionCenterPanel.test.tsx
```

Expected: FAIL vì chưa có nút/dialog.

- [ ] **Step 3: Triển khai mutation flow**

`ActionItem` nhận callback `onSecondaryAction`. `ActionCenterPanel` giữ `pendingDeleteAction` và `deletingDraftId`. Sau remote delete, gọi local cleanup trong `try/catch`, tải lại Action Center và toast thành công. Khi API lỗi, giữ dialog đóng hoặc mở theo trạng thái đã chọn nhất quán và toast lỗi.

- [ ] **Step 4: Chạy test GREEN**

```bash
npm run test:ci -- tests/actionCenterPanel.test.tsx
```

Expected: PASS.

### Task 5: Regression và kiểm tra hoàn tất

**Files:**
- Verify all files above.

- [ ] **Step 1: Chạy test tập trung**

```bash
npm run test:ci -- tests/actionCenterService.test.ts tests/teacherActionCenterService.test.ts tests/draftDeleteDialog.test.tsx tests/actionCenterPanel.test.tsx tests/manualQuizDraftService.test.ts
```

Expected: tất cả PASS.

- [ ] **Step 2: Chạy typecheck và lint**

```bash
npm run typecheck
npm run typecheck:strict
npm run typecheck:workers
npm run lint
```

Expected: exit code 0.

- [ ] **Step 3: Chạy build**

```bash
npm run build
```

Expected: production build thành công.

- [ ] **Step 4: Review diff**

Kiểm tra không có parsing URL, không có mutation cho item khác, không bỏ ownership check và không thay đổi API DELETE.

- [ ] **Step 5: Commit**

```bash
git add shared/teacher-action-center.contract.ts workers/src/services/actionCenterService.ts src/services/teacherActionCenterService.ts src/components/TeacherDashboard/overview tests docs/superpowers

git commit -m "feat(dashboard): delete quiz drafts from action center"
```
