# Fix Rich Text + Math + Drag-Drop Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa dứt điểm hai lỗi hiển thị ở trang làm bài học sinh: thẻ `<strong>...</strong>` bị lộ khi phần in đậm chứa MathJax, và đáp án kéo-thả có LaTeX như `$50$`, `$200$`, `$94$` hiển thị nguyên dấu `$` sau khi được đặt vào ô trống.

**Architecture:** Giữ nguyên dữ liệu câu hỏi, importer, scoring contract và schema. Fix ở renderer dùng chung: `SafeFormattedText` phải cho phép formatting allowlist bao qua các đoạn math mà không dùng `dangerouslySetInnerHTML`; riêng blank của `DRAG_DROP` phải hiển thị giá trị qua `SmartText/MathSpan` thay vì `<input value>` vì input không thể render MathJax. Các loại fill/dropdown nhập tay vẫn giữ input/select hiện tại.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, better-react-mathjax, Vite.

## Global Constraints

- Không sửa dữ liệu câu hỏi đã lưu, không migration D1, không Worker/API changes.
- Không thay schema 13 dạng câu hỏi và không thay scoring/answer contract.
- Không dùng `dangerouslySetInnerHTML`.
- Chỉ render HTML trong allowlist hiện có: `u`, `b`, `i`, `em`, `strong`; HTML lạ hoặc có attributes phải tiếp tục hiện như text an toàn.
- TeX subscripts như `$a_b_c$` không được bị hiểu thành underline markup.
- `DRAG_DROP` giữ nguyên giá trị đáp án canonical, ví dụ answer state vẫn là string `$50$`; chỉ thay cách hiển thị.
- `DROPDOWN` và fill-in-the-blank nhập tay không được biến thành control mới.
- Không trộn thay đổi với worktree `fix/json-latex-preflight`; khi thực thi tạo worktree mới từ `origin/main` mới nhất.
- Commit/push/merge/deploy chỉ thực hiện khi người dùng phê duyệt sau khi verification xanh.

---

## File Map

### Production files dự kiến sửa

- `src/components/common/SafeFormattedText.tsx`
  - Trách nhiệm: parse formatting allowlist an toàn mà vẫn bảo toàn MathJax.
- `src/features/quiz-player/components/QuestionRenderer/renderers/FillInTheBlankRenderer.tsx`
  - Trách nhiệm: render blank và pool cho fill/dropdown/drag-drop.

### Test files dự kiến sửa/tạo

- `tests/SafeFormattedText.test.tsx`
  - Unit regression cho `<strong>` bao qua `$...$` và an toàn HTML/TeX underscore.
- `tests/QuestionRendererAnswerContract.test.tsx`
  - Regression cho answer state/interaction của `DRAG_DROP`.
- Create: `tests/QuestionRendererRichTextMath.test.tsx`
  - Integration test đi qua pipeline thật `QuestionRenderer → SmartText → MathSpan → SafeFormattedText` và `DRAG_DROP → InteractiveMathText`.

### Không sửa

- `src/features/manual-quiz-workspace/import/jsonQuestionImporter.ts`
- `src/utils/mathText.ts` trừ khi test chứng minh root cause nằm ở normalization (hiện evidence cho thấy không cần).
- database, workers, scoring domain.

---

## Acceptance Criteria tổng

- Một câu hỏi có title:
  - `<strong>Có $48$ lít dầu rót đều vào $6$ can.</strong>\nChọn Đúng hoặc Sai...`
  - phải hiển thị câu đầu in đậm, `48` và `6` render MathJax, không thấy literal `<strong>` hoặc `</strong>`.
- Một câu `DRAG_DROP` có `correctAnswer: "$50$"`:
  - pool hiển thị `50` bằng MathJax;
  - sau khi chọn, ô trống cũng render `50`, không thấy literal `$50$`;
  - click ô đã chọn vẫn xóa được đáp án như behavior hiện tại.
- `DROPDOWN` có LaTeX tiếp tục render đúng bằng `LatexDropdown`.
- Fill-in-the-blank nhập tay tiếp tục là `<input>`.
- Unknown/attributed HTML không được inject vào DOM.
- `$a_b_c$` không tạo `<u>`.
- Tất cả focused tests, lint, typecheck, strict typecheck và build đều pass.

---

### Task 1: Khóa regression cho `<strong>` chứa MathJax

**Files:**
- Modify: `tests/SafeFormattedText.test.tsx`

**Interfaces:**
- Consumes: `SafeFormattedText({ content, enableMarkdown })`
- Produces: regression contract cho formatting span bao qua math segment.

- [ ] **Step 1: Thêm test đỏ cho strong bao qua math**

Thêm test tương đương:

```tsx
it('keeps an allowlisted strong wrapper across inline math segments', () => {
  const { container } = render(
    <SafeFormattedText
      content={'<strong>Có $48$ lít dầu rót đều vào $6$ can.</strong>\nChọn Đúng hoặc Sai.'}
    />,
  );

  const strong = container.querySelector('strong');
  expect(strong).not.toBeNull();
  expect(strong).toHaveTextContent('Có $48$ lít dầu rót đều vào $6$ can.');
  expect(container.textContent).not.toContain('<strong>');
  expect(container.textContent).not.toContain('</strong>');
});
```

- [ ] **Step 2: Chạy riêng test và xác nhận RED**

Run:

```bash
npx vitest run tests/SafeFormattedText.test.tsx --maxWorkers=1
```

Expected: test mới FAIL vì hiện `splitMathSegments()` chia `<strong>` và `</strong>` sang các segment khác nhau.

- [ ] **Step 3: Khóa thêm test không regression security/TeX**

Giữ nguyên và chạy các contract hiện có:

```tsx
expect(container.querySelector('script')).toBeNull();
expect(container.querySelector('[onclick]')).toBeNull();
expect(container.querySelector('u')).toHaveTextContent('word');
```

Bổ sung nếu cần một case:

```tsx
render(<SafeFormattedText content={'<strong>$a_b_c$</strong> and _word_'} />);
expect(container.querySelector('strong')).toHaveTextContent('$a_b_c$');
expect(container.querySelectorAll('u')).toHaveLength(1);
```

Expected: test mới vẫn RED do strong/math; security tests cũ vẫn GREEN.

---

### Task 2: Sửa `SafeFormattedText` để formatting bao qua math segments

**Files:**
- Modify: `src/components/common/SafeFormattedText.tsx`
- Test: `tests/SafeFormattedText.test.tsx`

**Interfaces:**
- Consumes: normalized string từ `normalizeMathText()`.
- Produces: React nodes chỉ từ allowlist, với math delimiter được giữ nguyên để `MathSpan`/MathJax typeset.

**Thiết kế bắt buộc:** Không parse HTML trên từng math segment độc lập nữa. Thay vào đó:

1. `normalizeMathText(content)` một lần.
2. Tìm paired allowlisted HTML tag trên **toàn chuỗi** trước, để `<strong> ... $48$ ... </strong>` được nhận là một range duy nhất.
3. Với text trước/sau và content bên trong tag, render đệ quy.
4. Chỉ ở base case mới gọi `splitMathSegments()` để bảo vệ TeX khỏi underline/markdown parser.
5. Chỉ áp dụng `_word_`/markdown trên `segment.type === 'text'`; math segment trả lại `segment.raw` nguyên vẹn.
6. Unknown tag/attributed tag không match allowlist và phải ở dạng text.

- [ ] **Step 1: Tách helper tìm HTML allowlist khỏi inline text markup**

Ví dụ interface nội bộ:

```ts
interface AllowedHtmlMatch {
  index: number;
  full: string;
  tagName: keyof React.JSX.IntrinsicElements;
  inner: string;
}
```

Helper chỉ match:

```ts
/<(u|b|i|em|strong)>([\s\S]*?)<\/\1>/i
```

Không match attributes.

- [ ] **Step 2: Thêm base renderer bảo vệ math**

Base renderer phải có behavior tương đương:

```tsx
const renderTextAndMath = (value: string, keyPrefix: string, enableMarkdown: boolean) =>
  splitMathSegments(value).flatMap((segment, index) => {
    if (segment.type === 'math') return segment.raw;
    return renderTextMarkupOnly(segment.raw, `${keyPrefix}-${index}`, enableMarkdown);
  });
```

`renderTextMarkupOnly` chỉ xử lý underline/markdown, không xử lý paired HTML nữa.

- [ ] **Step 3: Render paired HTML trên full range trước khi split math**

Behavior mong muốn:

```tsx
<strong>
  Có $48$ lít dầu rót đều vào $6$ can.
</strong>
```

sau đó outer `MathSpan` vẫn bọc `MathJax`, nên `$48$`/`$6$` được typeset trong node `<strong>`.

- [ ] **Step 4: Chạy test Task 1 và xác nhận GREEN**

Run:

```bash
npx vitest run tests/SafeFormattedText.test.tsx --maxWorkers=1
```

Expected: tất cả tests PASS.

- [ ] **Step 5: Refactor nhỏ nếu cần, không mở rộng scope**

Không thêm parser HTML tổng quát, không dependency mới, không raw HTML.

---

### Task 3: Khóa regression cho DRAG_DROP có đáp án LaTeX

**Files:**
- Modify: `tests/QuestionRendererAnswerContract.test.tsx`

**Interfaces:**
- Consumes: `FillInTheBlankRenderer` với `type: 'DRAG_DROP'` và answer state string.
- Produces: contract UI + answer event cho blank đã chọn.

- [ ] **Step 1: Thêm test đỏ cho blank đã chọn**

Dùng fixture:

```tsx
const question = {
  id: 'drag-math',
  type: 'DRAG_DROP',
  question: 'Kéo số',
  text: 'Mỗi bao nặng: [1] kg.',
  blanks: [{ id: 'blank-1', correctAnswer: '$50$' }],
} as any;
```

Render với:

```tsx
answers={{ 'drag-math': { 'blank-1': '$50$' } }}
```

Contract:

```tsx
expect(screen.queryByRole('textbox', { name: 'Ô trống blank-1' })).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: /Ô trống blank-1/i })).toBeInTheDocument();
```

Test phải FAIL trên code hiện tại vì blank là read-only `<input>`.

- [ ] **Step 2: Khóa behavior click-to-clear**

```tsx
fireEvent.click(screen.getByRole('button', { name: /Ô trống blank-1/i }));
expect(onAnswerChange).toHaveBeenCalledWith('drag-math', '', 'blank-1');
```

- [ ] **Step 3: Khóa non-drag behavior**

Thêm/giữ test chứng minh `FILL_IN_THE_BLANK` không có options vẫn dùng textbox và cho phép nhập text.

Expected: chỉ DRAG_DROP đổi control.

---

### Task 4: Đổi blank DRAG_DROP sang control render `SmartText`

**Files:**
- Modify: `src/features/quiz-player/components/QuestionRenderer/renderers/FillInTheBlankRenderer.tsx`
- Test: `tests/QuestionRendererAnswerContract.test.tsx`

**Interfaces:**
- Consumes: `currentValue: string`, `isDragDrop`, `handleFill(blankId, value)`.
- Produces: interactive blank button cho DRAG_DROP, giữ nguyên answer state string.

- [ ] **Step 1: Trong `renderBlank`, giữ nhánh `LatexDropdown` đầu tiên như hiện tại**

Nếu `blankOptions.length > 0`, không thay behavior.

- [ ] **Step 2: Thêm nhánh riêng cho `isDragDrop` trước `<input>`**

Control mong muốn:

```tsx
if (isDragDrop) {
  return (
    <button
      key={key}
      type="button"
      aria-label={`Ô trống ${blankId}${currentValue ? ', bấm để xóa đáp án' : ', chưa có đáp án'}`}
      onClick={() => currentValue && handleFill(blankId, '')}
      className={`mx-1 inline-flex min-h-9 min-w-[72px] items-center justify-center rounded-[8px] border px-3 py-1 text-center align-middle font-medium transition-colors ${answerInputClasses(Boolean(currentValue.trim()))}`}
    >
      {currentValue ? <SmartText content={currentValue} /> : <span className="text-slate-400">...</span>}
    </button>
  );
}
```

Yêu cầu:
- Không đặt fixed `w-20`, để fraction/công thức dài có thể nở ngang.
- Empty blank vẫn hiển thị `...`.
- Filled blank dùng `SmartText`, nên `$50$`/`$\frac{1}{2}$` đi qua `MathSpan`.
- Click filled blank gọi `handleFill(blankId, '')` như behavior cũ.

- [ ] **Step 3: Giữ `<input>` cho non-drag branch**

Không đổi `onChange`, `placeholder`, answer state hoặc aria của fill-in-the-blank.

- [ ] **Step 4: Chạy focused answer contract**

Run:

```bash
npx vitest run tests/QuestionRendererAnswerContract.test.tsx --maxWorkers=1
```

Expected: PASS.

---

### Task 5: Integration test toàn pipeline renderer

**Files:**
- Create: `tests/QuestionRendererRichTextMath.test.tsx`

**Interfaces:**
- Consumes: production `QuestionRenderer`, không mock `SmartText` hoặc `MathSpan`.
- Produces: regression ở đúng pipeline mà học sinh sử dụng.

- [ ] **Step 1: Mock duy nhất `better-react-mathjax` để test DOM ổn định**

```tsx
vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
```

Không mock `SmartText`, `MathSpan`, `SafeFormattedText`.

- [ ] **Step 2: Integration test TRUE_FALSE header**

Fixture:

```tsx
{
  id: 'tf-rich',
  type: 'TRUE_FALSE',
  question: '<strong>Có $48$ lít dầu rót đều vào $6$ can.</strong>\nChọn Đúng hoặc Sai cho mỗi nhận định sau.',
  items: [
    { id: 'a', statement: 'Mỗi can chứa 8 lít dầu.' },
    { id: 'b', statement: '3 can chứa 24 lít dầu.' },
    { id: 'c', statement: '5 can chứa 40 lít dầu.' },
    { id: 'd', statement: '8 can chứa 64 lít dầu.' },
  ],
}
```

Assert:

```tsx
expect(container.querySelector('strong')).toHaveTextContent('Có $48$ lít dầu rót đều vào $6$ can.');
expect(container.textContent).not.toContain('<strong>');
expect(screen.getAllByRole('button', { name: /Đúng|Sai/ })).toHaveLength(8);
```

- [ ] **Step 3: Integration test DRAG_DROP math blank**

Fixture có `correctAnswer: '$50$'` và answer state đã chọn.

Assert:
- blank là button, không phải textbox;
- button chứa `$50$` ở DOM test (MathJax mock pass-through) và đi qua renderer thay vì `input.value`;
- pool option vẫn tồn tại/disabled đúng theo used count.

- [ ] **Step 4: Chạy integration suite**

```bash
npx vitest run tests/QuestionRendererRichTextMath.test.tsx tests/SafeFormattedText.test.tsx tests/QuestionRendererAnswerContract.test.tsx --maxWorkers=2
```

Expected: PASS.

---

### Task 6: Kiểm tra regression rộng hơn

**Files:** Không đổi production code trừ khi test chứng minh regression do fix.

- [ ] **Step 1: Chạy renderer tests liên quan**

```bash
npx vitest run \
  tests/SafeFormattedText.test.tsx \
  tests/QuestionRendererRichTextMath.test.tsx \
  tests/QuestionRendererAnswerContract.test.tsx \
  tests/QuestionRendererCoverage.test.tsx \
  tests/quizAnswerStateColors.test.tsx \
  --maxWorkers=2
```

Expected: tất cả PASS.

- [ ] **Step 2: Kiểm tra các edge case bắt buộc**

Bằng automated tests hoặc fixture integration:

```text
<strong>Text only</strong>
<strong>Text $48$ text $6$</strong>
<u>$a_b_c$</u>
<script>alert(1)</script>
<u onclick="evil()">unsafe</u>
DRAG_DROP: $50$
DRAG_DROP: $\frac{1}{2}$
DRAG_DROP: plain text "hers"
DROPDOWN: LaTeX option
FILL_IN_THE_BLANK: input text bình thường
```

Không mở rộng parser sang arbitrary HTML.

---

### Task 7: Browser verification thực tế

**Files:** Không đổi code nếu không phát hiện bug mới.

**Setup:** chạy dev server trong worktree mới.

```bash
npm run dev -- --host 127.0.0.1
```

- [ ] **Step 1: Reproduce TRUE_FALSE với strong + math**

Mở luồng làm bài có fixture tương đương ảnh người dùng.

Expected:
- Không thấy literal `<strong>`/`</strong>`.
- Dòng đầu bold.
- `48`, `6` typeset MathJax.
- Dòng hướng dẫn xuống dòng đúng.

- [ ] **Step 2: Reproduce DRAG_DROP math**

Expected:
- pool: `50`, `200` render MathJax.
- chọn `50` → blank hiển thị `50`, không `$50$`.
- click blank → đáp án được xóa và item trở lại pool.
- duplicate values như `50, 50, 200, 200` vẫn giữ đúng occurrence/used-count logic.

- [ ] **Step 3: Accessibility**

- Blank DRAG_DROP là button có accessible name.
- Keyboard focus thấy rõ.
- Enter/Space xóa đáp án đã chọn qua native button behavior.
- Không có console error/warning do MathJax/React key nesting.

- [ ] **Step 4: Chụp screenshot trước/sau**

Lưu evidence cho 2 case đã báo.

---

### Task 8: Quality gates và primary review

**Files:** toàn diff.

- [ ] **Step 1: GitNexus impact trước khi sửa symbols khi bắt đầu implementation**

Đánh giá:
- `SafeFormattedText`
- `FillInTheBlankRenderer`

Nếu impact HIGH/CRITICAL → dừng và xin duyệt mở rộng phạm vi.

- [ ] **Step 2: Lint + typecheck**

```bash
npm run lint -- --quiet
npm run typecheck
npm run typecheck:strict
```

Expected: PASS.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Diff hygiene**

```bash
git diff --check
git status --short
```

Expected:
- chỉ có files renderer/tests/plan được duyệt;
- không có DB/Worker/importer changes;
- không chạm `AGENTS.md`, `CLAUDE.md` hoặc thay đổi người dùng khác.

- [ ] **Step 5: Primary code review**

Review 5 axes:
- correctness;
- security/XSS;
- architecture;
- accessibility;
- regression risk.

Không approve nếu:
- dùng `dangerouslySetInnerHTML`;
- stripping `$...$` khỏi answer state;
- thay input cho tất cả fill/dropdown;
- parser HTML mở rộng beyond allowlist.

- [ ] **Step 6: Optional independent Gemini read-only review**

Chỉ dùng nếu CLI quota hoạt động. Gemini không được sửa file.

---

### Task 9: Commit / PR / deploy sau khi được duyệt

**Dependencies:** Tasks 1–8 GREEN và người dùng cho phép release.

- [ ] **Step 1: Commit focused change**

Suggested commit:

```bash
git add src/components/common/SafeFormattedText.tsx \
        src/features/quiz-player/components/QuestionRenderer/renderers/FillInTheBlankRenderer.tsx \
        tests/SafeFormattedText.test.tsx \
        tests/QuestionRendererAnswerContract.test.tsx \
        tests/QuestionRendererRichTextMath.test.tsx

git commit -m "fix: render rich math text in quiz blanks"
```

- [ ] **Step 2: Push feature branch + PR vào main**

Không bypass branch protection.

- [ ] **Step 3: Chờ required checks + review**

Merge chỉ khi tất cả xanh.

- [ ] **Step 4: Production deploy**

Frontend/Vercel deployment theo main. Không Worker deploy, không D1 migration.

- [ ] **Step 5: Production smoke**

- `https://thtohieu.com` HTTP 200.
- kiểm tra một quiz có TRUE_FALSE title rich-math.
- kiểm tra một DRAG_DROP có `$50$` hoặc `$\frac{1}{2}$`.
- console sạch.

---

## Risks and Mitigations

| Risk | Mức | Mitigation |
|---|---:|---|
| Parse formatting trước math có thể làm `_` trong TeX bị hiểu nhầm | Cao | Chỉ parse paired HTML trên full range; underline/markdown chỉ chạy ở base text segments sau `splitMathSegments()` |
| XSS do mở rộng HTML renderer | Cao | Giữ exact allowlist, không attributes, không `dangerouslySetInnerHTML`, giữ tests script/onclick |
| DRAG_DROP đổi `<input>` thành button làm scoring khác | Thấp | Không đổi answer state/event contract; chỉ UI control. Test `onAnswerChange(questionId, '', blankId)` |
| Công thức dài làm blank tràn layout | Trung bình | `min-w` + auto width, không fixed `w-20`; browser test fraction và mobile |
| Duplicate drag options bị sai used-count | Trung bình | Không đổi pool algorithm; regression test `50, 50, 200, 200` |
| Fix chung ảnh hưởng explanations/other screens dùng `SafeFormattedText` | Trung bình | Unit tests allowlist + unknown HTML + markdown + TeX underscore; browser smoke các màn dùng MathSpan |

---

## Non-goals

- Không sửa System Prompt trong task renderer này.
- Không auto-strip `$...$` khỏi dữ liệu kéo-thả.
- Không convert HTML sang Markdown trong database.
- Không thêm rich-text editor.
- Không sửa JSON importer/preflight trong cùng PR.
- Không thay MathJax library/config nếu không có evidence mới.

---

## Stop Conditions

Dừng và báo người dùng nếu:

- GitNexus cho thấy `SafeFormattedText` có blast radius HIGH/CRITICAL không thể khóa bằng tests.
- Test chứng minh root cause còn nằm trong `normalizeMathText`/MathJax config và cần mở rộng scope.
- Fix cần dùng raw HTML hoặc sanitize library mới.
- Quality gate, browser verification hoặc accessibility fail sau 3 vòng sửa.
- Cần sửa dữ liệu production/migration.

---

## Definition of Done

- [ ] Regression `<strong> + $math$` có test đỏ trước và xanh sau.
- [ ] Regression DRAG_DROP `$50$` có test đỏ trước và xanh sau.
- [ ] Không lộ literal `<strong>` ở title.
- [ ] Không lộ literal `$50$/$200$/$94$` trong blank DRAG_DROP.
- [ ] TeX underscore, unknown HTML, attributed HTML vẫn an toàn.
- [ ] Answer/scoring contract không đổi.
- [ ] Focused renderer tests PASS.
- [ ] lint PASS.
- [ ] typecheck PASS.
- [ ] strict typecheck PASS.
- [ ] production build PASS.
- [ ] browser desktop + mobile PASS.
- [ ] primary diff review PASS.
- [ ] Không commit/push/deploy trước approval của người dùng.
