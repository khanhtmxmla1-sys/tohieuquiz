# Student Categorization Responsive UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay giao diện câu hỏi `CATEGORIZATION` của học sinh bằng card + chip lựa chọn có tiến độ rõ ràng, không còn ép nội dung thành cột chữ hẹp trên mobile và không thay đổi answer/scoring contract.

**Architecture:** Giữ nguyên `DragDropRenderer` là điểm triển khai duy nhất cho Quiz Player. Renderer tiếp tục đọc/ghi `Record<itemId, categoryId>` qua `answers[question.id]` và `onAnswerChange`; chỉ thay cấu trúc hiển thị để mọi item luôn ở cùng danh sách, cùng một state cục bộ `editingItemId` cho thao tác “Đổi”. Test component khóa contract tương tác và markup responsive; browser test kiểm tra viewport 390px và desktop.

**Tech Stack:** React, TypeScript, Tailwind utility classes, Vitest, Testing Library, Playwright/Chrome browser test.

## Global Constraints

- Không thay đổi `QuestionType.CATEGORIZATION`, schema JSON, serializer, Worker hoặc scoring.
- Không thêm dependency mới.
- Mobile/tablet hẹp phải luôn hiển thị nội dung trên và lựa chọn dưới; không dùng `sm:flex-row` cho item card.
- Item đã chọn vẫn ở đúng vị trí trong danh sách thay vì chuyển lên drop-zone khác.
- Trạng thái đã chọn phải có dấu `✓` + text, không phụ thuộc chỉ vào màu.
- Vùng chạm các nút lựa chọn tối thiểu 44px (`min-h-11`).
- Không refactor renderer khác.
- Không commit/push các thay đổi không liên quan đang có trên `main`, đặc biệt `AGENTS.md`, `CLAUDE.md` và các plan cũ.

---

### Task 1: Khóa contract UI và tương tác bằng test RED

**Files:**
- Create: `tests/DragDropRendererResponsive.test.tsx`
- Read only: `src/features/quiz-player/components/QuestionRenderer/renderers/DragDropRenderer.tsx`

**Interfaces:**
- Consumes: `DragDropRenderer` với `BaseRendererProps`, `answers[question.id]` dạng `Record<string, string>`.
- Produces: regression tests mô tả UI mới; không tạo production interface mới.

- [ ] **Step 1: Tạo fixture và test trạng thái ban đầu**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DragDropRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/DragDropRenderer';

vi.mock('../src/features/quiz-player/components/QuestionRenderer/utils/SmartText', () => ({
  default: ({ content }: { content: unknown }) => <span>{String(content ?? '')}</span>,
}));

const question = {
  id: 'personification-categorization',
  type: 'CATEGORIZATION',
  question: 'Phân loại cách nhân hoá',
  categories: [
    { id: 'call', name: 'Dùng từ gọi người để gọi vật' },
    { id: 'action', name: 'Dùng từ tả hoạt động/đặc điểm của người để tả vật' },
    { id: 'talk', name: 'Trò chuyện với vật như với người' },
  ],
  items: [
    { id: 'i1', content: 'Ông em rất thích đọc báo.', categoryId: 'call' },
    { id: 'i2', content: 'Trời tối, bác thợ rèn trở về trong ngôi nhà.', categoryId: 'action' },
  ],
} as any;

describe('DragDropRenderer responsive categorization UI', () => {
  it('keeps every item in one readable card list and shows progress', () => {
    render(
      <DragDropRenderer
        question={question}
        index={0}
        answers={{}}
        onAnswerChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Đã làm 0/2')).toBeInTheDocument();
    expect(screen.getByText('Ông em rất thích đọc báo.')).toBeInTheDocument();
    expect(screen.getByText('Trời tối, bác thợ rèn trở về trong ngôi nhà.')).toBeInTheDocument();
    expect(screen.queryByText(/Danh sách chưa phân loại/)).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có mục nào')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Thêm test chọn nhóm và giữ item tại chỗ**

```tsx
it('assigns a category without removing the item card', () => {
  const onAnswerChange = vi.fn();
  render(
    <DragDropRenderer
      question={question}
      index={0}
      answers={{}}
      onAnswerChange={onAnswerChange}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Chọn nhóm Dùng từ gọi người để gọi vật cho Ông em rất thích đọc báo.' }));

  expect(onAnswerChange).toHaveBeenCalledWith('personification-categorization', {
    i1: 'call',
  });
});
```

- [ ] **Step 3: Thêm test trạng thái đã chọn và thao tác Đổi**

```tsx
it('collapses an assigned item to its selected badge and allows changing it', () => {
  const onAnswerChange = vi.fn();
  const { rerender } = render(
    <DragDropRenderer
      question={question}
      index={0}
      answers={{ 'personification-categorization': { i1: 'call' } }}
      onAnswerChange={onAnswerChange}
    />,
  );

  expect(screen.getByText('Đã làm 1/2')).toBeInTheDocument();
  expect(screen.getByText('✓ Dùng từ gọi người để gọi vật')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Đổi nhóm cho Ông em rất thích đọc báo.' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Đổi nhóm cho Ông em rất thích đọc báo.' }));
  fireEvent.click(screen.getByRole('button', { name: 'Chọn nhóm Trò chuyện với vật như với người cho Ông em rất thích đọc báo.' }));

  expect(onAnswerChange).toHaveBeenCalledWith('personification-categorization', {
    i1: 'talk',
  });

  rerender(
    <DragDropRenderer
      question={question}
      index={0}
      answers={{ 'personification-categorization': { i1: 'call', i2: 'action' } }}
      onAnswerChange={onAnswerChange}
    />,
  );
  expect(screen.getByText('Đã làm 2/2')).toBeInTheDocument();
  expect(screen.getByText('Đã phân loại xong tất cả.')).toBeInTheDocument();
});
```

- [ ] **Step 4: Chạy test để xác nhận RED**

Run:

```bash
npm run test:run -- tests/DragDropRendererResponsive.test.tsx
```

Expected: FAIL vì renderer hiện tại còn `Danh sách chưa phân loại`, chưa có progress `Đã làm X/Y`, chưa có nút `Đổi`, và item đã chọn bị chuyển khỏi danh sách dưới.

- [ ] **Step 5: Commit test RED**

```bash
git add tests/DragDropRendererResponsive.test.tsx
git commit -m "test(quiz): cover responsive categorization interaction"
```

---

### Task 2: Triển khai card + chip + progress trong `DragDropRenderer`

**Files:**
- Modify: `src/features/quiz-player/components/QuestionRenderer/renderers/DragDropRenderer.tsx:1-116`
- Test: `tests/DragDropRendererResponsive.test.tsx`

**Interfaces:**
- Consumes: `question.categories`, `question.items`, `answers[question.id]`, `onAnswerChange(question.id, assignments)`.
- Produces: cùng answer payload hiện hữu `Record<string, string>`; thêm state cục bộ `editingItemId: string | null` chỉ cho UI.

- [ ] **Step 1: Thay derived state và thêm local edit state**

Giữ `currentAssignments` và `handleAssign`, bỏ `getItemsInCategory`/`unassignedItems`, thêm:

```tsx
const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
const assignedCount = items.filter((item: any) => Boolean(currentAssignments[item.id])).length;

const handleAssign = (itemId: string, categoryId: string | null) => {
  const newAssignments = { ...currentAssignments };
  if (categoryId === null) {
    delete newAssignments[itemId];
  } else {
    newAssignments[itemId] = categoryId;
  }
  onAnswerChange(question.id, newAssignments);
  setEditingItemId(null);
};
```

- [ ] **Step 2: Thay drop-zone phía trên bằng header tiến độ + legend nhóm**

Markup mục tiêu:

```tsx
<div className="space-y-4">
  <section className="rounded-[10px] border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-slate-800">Phân loại các mục</h3>
      <span className="text-xs font-medium text-slate-500">
        Đã làm {assignedCount}/{items.length}
      </span>
    </div>

    <div className="mt-3 flex flex-wrap gap-2" aria-label="Các nhóm phân loại">
      {categories.map((category: any) => (
        <span
          key={category.id}
          className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium leading-5 text-sky-800"
        >
          <SmartText content={category.name} />
        </span>
      ))}
    </div>
  </section>
```

- [ ] **Step 3: Render mọi item trong cùng một card list**

Mỗi card dùng cấu trúc dọc ở mọi breakpoint để nội dung không bao giờ bị ép cạnh controls:

```tsx
<div className="space-y-3">
  {items.map((item: any) => {
    const assignedCategoryId = currentAssignments[item.id];
    const assignedCategory = categories.find((category: any) => category.id === assignedCategoryId);
    const isEditing = !assignedCategory || editingItemId === item.id;

    return (
      <article
        key={item.id}
        className="rounded-[10px] border border-slate-200 bg-white p-4"
      >
        <div className="min-w-0 text-sm font-medium leading-6 text-slate-800">
          <SmartText content={item.content} />
        </div>

        {isEditing ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((category: any) => (
              <button
                key={category.id}
                type="button"
                aria-label={`Chọn nhóm ${category.name} cho ${item.content}`}
                aria-pressed={assignedCategoryId === category.id}
                onClick={() => handleAssign(item.id, category.id)}
                className="min-h-11 max-w-full rounded-[8px] border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs font-semibold leading-5 text-sky-700 transition-colors hover:border-sky-500 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <SmartText content={category.name} />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className={`inline-flex min-h-9 max-w-full items-center rounded-[8px] border px-3 py-1.5 text-xs font-semibold leading-5 ${selectedAnswerClass}`}>
              <span aria-hidden="true" className="mr-1">✓</span>
              <SmartText content={assignedCategory.name} />
            </span>
            <button
              type="button"
              aria-label={`Đổi nhóm cho ${item.content}`}
              onClick={() => setEditingItemId(item.id)}
              className="min-h-11 rounded-[8px] px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Đổi
            </button>
          </div>
        )}
      </article>
    );
  })}
</div>
```

- [ ] **Step 4: Thêm trạng thái hoàn thành và bỏ hướng dẫn cũ**

Sau danh sách item:

```tsx
{items.length > 0 && assignedCount === items.length ? (
  <p className="text-center text-sm font-medium text-sky-700">
    Đã phân loại xong tất cả.
  </p>
) : null}
```

Xóa dòng hướng dẫn cũ:

```tsx
Nhấn vào mục đã phân loại để đưa mục đó trở lại danh sách.
```

vì thao tác mới đã có nút `Đổi` rõ nghĩa.

- [ ] **Step 5: Chạy focused test GREEN**

Run:

```bash
npm run test:run -- tests/DragDropRendererResponsive.test.tsx
```

Expected: PASS toàn bộ test trong file.

- [ ] **Step 6: Chạy regression renderer tests**

Run:

```bash
npm run test:run -- tests/QuestionRendererAnswerContract.test.tsx tests/QuestionRendererCoverage.test.tsx tests/quizProgress.test.ts
```

Expected: PASS; answer contract và progress không regress.

- [ ] **Step 7: Commit implementation**

```bash
git add src/features/quiz-player/components/QuestionRenderer/renderers/DragDropRenderer.tsx tests/DragDropRendererResponsive.test.tsx
git commit -m "fix(quiz): compact student categorization UI"
```

---

### Task 3: Browser regression ở mobile và desktop

**Files:**
- Modify only if needed after browser evidence: `src/features/quiz-player/components/QuestionRenderer/renderers/DragDropRenderer.tsx`
- Optional create if project harness needs stable fixture: `cypress/e2e/categorization-responsive.cy.ts`

**Interfaces:**
- Consumes: UI đã hoàn thiện ở Task 2.
- Produces: evidence rằng viewport nhỏ không overflow/co chữ và desktop vẫn usable; không thay đổi data contract.

- [ ] **Step 1: Chạy app local bằng script hiện hữu**

```bash
npm run dev
```

Expected: Vite dev server khởi động thành công và hiển thị local URL.

- [ ] **Step 2: Kiểm tra viewport mobile khoảng 390x844**

Dùng browser testing trên route/fixture có câu `CATEGORIZATION`, xác nhận bằng DOM/screenshot:

- câu `Ông em rất thích đọc báo.` hiển thị theo dòng bình thường;
- không có horizontal scroll;
- mỗi item card chiếm full width;
- group buttons nằm bên dưới nội dung và wrap;
- click nhóm cập nhật `Đã làm 1/2`;
- card đã chọn hiển thị `✓ <nhóm>` + `Đổi`;
- click `Đổi` rồi chọn nhóm khác hoạt động.

- [ ] **Step 3: Kiểm tra desktop khoảng 1280x800**

Xác nhận:

- card không trải controls cạnh text theo cách gây loãng bố cục;
- legend nhóm dễ đọc;
- progress cập nhật đúng;
- keyboard focus visible trên group buttons và `Đổi`.

- [ ] **Step 4: Nếu browser test phát hiện lỗi layout, sửa tối thiểu và chạy lại focused test**

Chỉ chỉnh Tailwind classes trong `DragDropRenderer.tsx`; không thay data flow. Sau sửa:

```bash
npm run test:run -- tests/DragDropRendererResponsive.test.tsx tests/QuestionRendererAnswerContract.test.tsx tests/QuestionRendererCoverage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit browser-driven polish nếu có diff**

```bash
git add src/features/quiz-player/components/QuestionRenderer/renderers/DragDropRenderer.tsx cypress/e2e/categorization-responsive.cy.ts
git commit -m "test(quiz): verify categorization responsive layout"
```

Nếu không có file/diff mới, không tạo commit rỗng.

---

### Task 4: Review và verification trước khi báo hoàn tất

**Files:**
- Review: toàn bộ diff của branch/worktree so với base.

**Interfaces:**
- Consumes: commits Task 1–3.
- Produces: branch đã được kiểm tra và sẵn sàng cho bước commit/push/PR tiếp theo nếu người dùng yêu cầu.

- [ ] **Step 1: Chạy lint/typecheck tập trung toàn repo theo script chuẩn**

```bash
npm run lint
npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 2: Chạy focused tests một lần cuối**

```bash
npm run test:run -- tests/DragDropRendererResponsive.test.tsx tests/QuestionRendererAnswerContract.test.tsx tests/QuestionRendererCoverage.test.tsx tests/quizProgress.test.ts
```

Expected: PASS.

- [ ] **Step 3: Build frontend/project**

```bash
npm run build
```

Expected: exit code 0; không có build error mới từ renderer.

- [ ] **Step 4: Review git diff và code review**

Xác nhận diff chỉ gồm:

```text
docs/superpowers/specs/2026-08-12-student-categorization-responsive-ui-design.md
docs/superpowers/plans/2026-08-12-student-categorization-responsive-ui.md
tests/DragDropRendererResponsive.test.tsx
src/features/quiz-player/components/QuestionRenderer/renderers/DragDropRenderer.tsx
```

và optional browser fixture nếu thật sự cần. Không đưa `AGENTS.md`, `CLAUDE.md`, plan cũ hoặc thay đổi không liên quan vào commit.

- [ ] **Step 5: Dừng trước push/deploy trừ khi có chỉ thị riêng**

Báo rõ branch/worktree, commit, test/build result và những thay đổi đã thực hiện. Không tự deploy production trong task này.
