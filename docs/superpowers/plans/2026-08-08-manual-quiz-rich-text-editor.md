# Manual Quiz Rich Text Editor + Compact Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp vùng `Nội dung câu hỏi` của soạn đề thủ công thành rich-text editor nhẹ, giữ nguyên hệ thống công thức hiện tại, đồng thời thu gọn `Ảnh đính kèm (tùy chọn)` để nhường không gian cho việc soạn câu hỏi.

**Architecture:** Triển khai theo hai vertical slices có thể kiểm thử độc lập. Slice A chỉ sửa UI ảnh đính kèm, không đổi dữ liệu. Slice B dùng Tiptap cho prompt chính và lưu **dual representation**: `question` plain text tiếp tục là canonical compatibility/search/math/grading fallback, còn `question_rich_text` là JSON versioned + allowlisted cho presentation. Teacher preview và primary student `QuestionRenderer` ưu tiên rich doc, nhưng luôn fallback về plain text.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS, Zustand, Vitest + Testing Library, Cypress, better-react-mathjax, Cloudflare Worker + D1. Proposed new authoring dependency: Tiptap (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, underline/text-align/highlight/color/text-style extensions).

## Global Constraints

- Không biến editor thành Word clone.
- Không cho font family, free-form font size, arbitrary margin/padding/style, table, link, iframe hoặc inline image node trong MVP.
- Không lưu arbitrary HTML; persisted rich content phải là versioned JSON allowlist.
- Không dùng `dangerouslySetInnerHTML` cho question rich content.
- Giữ nguyên `questions.question` và behavior grading/scoring hiện tại.
- TeX vẫn là text delimiters trong rich document; không tạo custom math node ở MVP.
- `Enter` = paragraph mới; `Shift+Enter` = hard break.
- Ảnh đính kèm tùy chọn mặc định collapsed; `IMAGE_QUESTION` vẫn dùng full image editor.
- Rich text MVP chỉ áp dụng cho **prompt chính** (`question` / `mainQuestion`), chưa áp dụng options/explanation/type-specific passages.
- Responsive + accessibility: test 320/768/1024/1440px; không document-level horizontal overflow.
- Dependency additions chỉ gồm các package Tiptap liệt kê trong plan; không thêm editor framework thứ hai.
- Production D1 migration/deploy không nằm trong approval mặc định của plan; phải xin phê duyệt riêng sau staging/verification.
- Mỗi task dùng TDD và commit riêng khi thực thi; không commit trong giai đoạn planning.

---

## Evidence and blast radius

### Current key symbols

- `SharedHeaderEditor` — `src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorForm.tsx`
  - GitNexus upstream impact: **LOW**, tối đa 1 direct dependent trong graph hiện tại.
- `MediaDropzone` — `src/features/manual-quiz-workspace/components/MediaDropzone.tsx`
  - Shared bởi optional attachment và `ImageQuestionEditor`; do đó không compact global behavior.
- `mapQuestionForSave` — `workers/src/utils/helpers.ts`
  - GitNexus upstream impact: **LOW**, 8 symbols tổng, 4 direct, 2 modules.
- Existing student prompt path:
  - `QuestionRenderer/index.tsx → SmartText → MathSpan → SafeFormattedText`.
- Existing manual prompt path:
  - `QuestionEditorPane → QuestionEditorForm → MathTextarea`.

### Existing behavior to preserve

- `MediaDropzone` tests đã khóa MIME/size, upload/progress, paste, retry, alt sanitization, URL, replace, delete.
- `SafeFormattedText` đã có secure formatting allowlist và math masking; không thay parser này để làm rich editor.
- `MathSpan` dùng `whiteSpace: pre-line` nên legacy newline đang render.
- `MathComposerProvider` hiện đăng ký native input/textarea; cần thêm generic command target thay vì phá native path.
- `question` plain text được dùng rộng bởi Worker, live exam, grading, analytics và AI; không đổi semantic của field này.

---

## File map

### New frontend/shared files

- `shared/question-rich-text.contract.ts`
  - Versioned rich-doc types, validation, normalization, max-size, plain fallback conversion.
- `src/features/quiz-editor/components/RichQuestionEditor/RichQuestionEditor.tsx`
  - Tiptap instance, controlled document bridge, editor surface.
- `src/features/quiz-editor/components/RichQuestionEditor/RichQuestionToolbar.tsx`
  - Focused toolbar.
- `src/features/quiz-editor/components/RichQuestionEditor/richQuestionExtensions.ts`
  - Extension allowlist/config.
- `src/components/common/QuestionRichTextRenderer.tsx`
  - Safe JSON → React rendering using `MathSpan` for text runs.
- `src/features/manual-quiz-workspace/components/CompactMediaAttachment.tsx`
  - Compact optional attachment presentation.

### Existing frontend files to modify

- `src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorForm.tsx`
- `src/features/manual-quiz-workspace/components/MediaDropzone.tsx` only if extracting shared small primitives/controller is needed; full variant behavior must stay.
- `src/features/manual-quiz-workspace/components/QuestionEditorPane.tsx`
- `src/features/manual-quiz-workspace/components/StudentPreviewPane.tsx`
- `src/features/manual-quiz-workspace/math-composer/useMathComposer.tsx`
- `src/features/quiz-editor/types/quiz-editor.types.ts`
- `src/features/quiz-editor/utils/questionDraftMapper.ts`
- `src/features/quiz-editor/hooks/useQuestionEditor.ts`
- `src/features/quiz-player/components/QuestionRenderer/index.tsx`
- `src/types/*` exact domain type file resolved during Task 7 before edit.
- `package.json`, `package-lock.json`

### Worker/D1 files

- Create: `workers/migrations/0064_add_question_rich_text.sql`
- Create: `workers/rollbacks/0064_drop_question_rich_text.sql`
- Modify: `workers/schema.sql`
- Modify: `workers/scripts/bootstrap_d1_migration_registry.sql`
- Modify: `workers/src/types.ts`
- Modify: `workers/src/utils/helpers.ts`
- Modify: `workers/src/routes/quizzes.ts`
- Modify: `workers/src/routes/practice.ts`
- Modify: `workers/src/services/liveExam/quizLoader.ts`

### Tests

- `tests/MediaDropzone.test.tsx`
- `tests/QuestionEditorForm.test.tsx`
- `tests/QuestionEditorPane.test.tsx`
- Create: `tests/QuestionRichTextContract.test.ts`
- Create: `tests/RichQuestionEditor.test.tsx`
- Create: `tests/QuestionRichTextRenderer.test.tsx`
- Modify/create Worker persistence route tests after locating nearest current route test during Task 8.
- `cypress/e2e/manual-quiz-workspace.cy.ts`

---

# Slice A — Compact optional attachment

## Task 1: Lock compact attachment behavior with tests

**Files:**
- Modify: `tests/MediaDropzone.test.tsx`
- Modify: `tests/QuestionEditorForm.test.tsx`

**Interfaces:**
- Consumes: existing `MediaDropzone` upload semantics.
- Produces: UI contract for a new `CompactMediaAttachment` used only for optional attachments.

- [ ] **Step 1: Add RED test for collapsed empty state**

Add an inline-form test that expects:

```tsx
expect(screen.getByRole('button', { name: 'Thêm ảnh đính kèm' })).toHaveAttribute('aria-expanded', 'false');
expect(screen.queryByText('Chọn, kéo thả hoặc dán ảnh')).not.toBeInTheDocument();
expect(screen.queryByLabelText('Mô tả ảnh Ảnh đính kèm')).not.toBeInTheDocument();
```

Expected current result: FAIL because full dropzone is always visible.

- [ ] **Step 2: Add RED test for explicit expand**

```tsx
fireEvent.click(screen.getByRole('button', { name: 'Thêm ảnh đính kèm' }));
expect(screen.getByRole('button', { name: /Chọn.*ảnh/i })).toBeInTheDocument();
expect(screen.getByRole('button', { name: /Dùng URL/i })).toBeInTheDocument();
```

- [ ] **Step 3: Lock existing full MediaDropzone tests**

Run:

```bash
npx vitest run tests/MediaDropzone.test.tsx tests/QuestionEditorForm.test.tsx --maxWorkers=2
```

Expected: only new compact tests RED; current full MediaDropzone behavior remains GREEN.

- [ ] **Step 4: Do not modify production code in this task**

Commit at execution time:

```bash
git add tests/MediaDropzone.test.tsx tests/QuestionEditorForm.test.tsx
git commit -m "test: define compact manual quiz attachment behavior"
```

---

## Task 2: Build compact optional attachment without regressing image questions

**Files:**
- Create: `src/features/manual-quiz-workspace/components/CompactMediaAttachment.tsx`
- Modify: `src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorForm.tsx`
- Test: `tests/QuestionEditorForm.test.tsx`
- Test: `tests/MediaDropzone.test.tsx`

**Interfaces:**

```ts
interface CompactMediaAttachmentProps {
  label: string;
  value: string;
  altText?: string;
  onChange(url: string): void;
  onAltTextChange?(value: string): void;
}
```

- [ ] **Step 1: Implement collapsed empty state**

Use local UI state only:

```tsx
const [expanded, setExpanded] = useState(Boolean(value));
```

Empty/collapsed rendering must expose one row and `aria-expanded`.

- [ ] **Step 2: Reuse existing upload pipeline**

Use `useQuestionMediaUpload` + `sanitizeImageAltText`; do not duplicate compression/upload API code.

Required interaction support:
- hidden file input;
- click select;
- drag/drop;
- paste image;
- URL mode;
- progress;
- retry;
- remove/reset.

- [ ] **Step 3: Make alt text conditional**

Render `Mô tả ảnh` only when `value` is non-empty, not merely because `onAltTextChange` exists.

- [ ] **Step 4: Render compact uploaded summary**

Use a fixed thumbnail on project spacing scale, e.g. Tailwind `h-16 w-16`, plus alt input and `Thay ảnh`/`Xóa` actions. Do not use the current full-width `max-h-56 w-full` preview.

- [ ] **Step 5: Switch only SharedHeader optional media to compact component**

In `QuestionEditorForm.tsx`, replace the optional `MediaDropzone` import/use with `CompactMediaAttachment`.

Do **not** change `ImageQuestionEditor.tsx`.

- [ ] **Step 6: Run focused tests**

```bash
npx vitest run tests/MediaDropzone.test.tsx tests/QuestionEditorForm.test.tsx --maxWorkers=2
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/manual-quiz-workspace/components/CompactMediaAttachment.tsx \
  src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorForm.tsx \
  tests/MediaDropzone.test.tsx tests/QuestionEditorForm.test.tsx
git commit -m "feat: compact optional question attachments"
```

---

## Task 3: Reclaim authoring space for question content

**Files:**
- Modify: `src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorForm.tsx`
- Modify: `src/features/manual-quiz-workspace/components/QuestionEditorPane.tsx`
- Modify: `cypress/e2e/manual-quiz-workspace.cy.ts`

**Interfaces:** Existing form props only; no data contract changes.

- [ ] **Step 1: Add E2E assertions for compact state and overflow**

At 1440×900:

```ts
cy.get('button[aria-label="Thêm ảnh đính kèm"]').should('have.attr', 'aria-expanded', 'false');
cy.contains('Chọn, kéo thả hoặc dán ảnh').should('not.exist');
assertNoHorizontalOverflow();
```

- [ ] **Step 2: Increase main question authoring area**

Before rich editor lands, increase the prompt field min-height/rows enough to validate desired hierarchy (target equivalent ~220px desktop), but do not use arbitrary inline pixel style if Tailwind spacing/min-height token is sufficient.

- [ ] **Step 3: Evaluate `max-w-4xl` → `max-w-5xl` only with screenshot evidence**

Change `QuestionEditorPane` width only if 1440px browser check shows the center pane has unused horizontal space without crowding the 380px preview.

- [ ] **Step 4: Browser check**

Test 1440×900, 1024×768, 768×1024, 320×800.

Expected:
- no page horizontal overflow;
- optional image collapsed by default;
- `Độ khó` and `Các đáp án` appear substantially earlier vertically;
- preview remains usable.

- [ ] **Step 5: Commit**

```bash
git add src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorForm.tsx \
  src/features/manual-quiz-workspace/components/QuestionEditorPane.tsx \
  cypress/e2e/manual-quiz-workspace.cy.ts
git commit -m "ui: prioritize manual question authoring space"
```

### Checkpoint A

At this point the compact attachment improvement is independently releasable. If product review rejects rich-text scope, Slice A can still ship safely.

---

# Slice B — Structured rich-text prompt

## Task 4: Define the rich-text contract before installing the editor

**Files:**
- Create: `shared/question-rich-text.contract.ts`
- Create: `tests/QuestionRichTextContract.test.ts`

**Interfaces produced:**

```ts
export const QUESTION_RICH_TEXT_SCHEMA_VERSION = 1 as const;
export const MAX_QUESTION_RICH_TEXT_BYTES = 64 * 1024;

export interface QuestionRichTextEnvelopeV1 {
  schemaVersion: 1;
  doc: QuestionRichTextDoc;
}

export function parseQuestionRichText(input: unknown):
  | { ok: true; value: QuestionRichTextEnvelopeV1 }
  | { ok: false; error: string };

export function richTextToPlainText(value: QuestionRichTextEnvelopeV1): string;
export function plainTextToRichText(value: string): QuestionRichTextEnvelopeV1;
export function serializeQuestionRichText(value: QuestionRichTextEnvelopeV1 | undefined): string;
export function deserializeQuestionRichText(value: unknown): QuestionRichTextEnvelopeV1 | undefined;
```

- [ ] **Step 1: Write RED tests for node/mark allowlist**

Cases:
- paragraph + text accepted;
- hardBreak accepted;
- bullet/ordered/listItem accepted;
- left/center/right accepted;
- bold/italic/underline/strike accepted;
- palette color/highlight accepted;
- `link`, `image`, `iframe`, unknown mark, `justify`, arbitrary `style` rejected.

- [ ] **Step 2: Write RED tests for size/version**

- >64 KiB rejects.
- missing/wrong schemaVersion rejects.
- malformed arrays/attrs reject.

- [ ] **Step 3: Write RED conversion tests**

```ts
expect(richTextToPlainText(plainTextToRichText('Dòng 1\nDòng 2'))).toBe('Dòng 1\nDòng 2');
```

Also lock TeX preservation:

```ts
const source = 'Tính $\\frac{1}{2}$\nRồi trả lời.';
expect(richTextToPlainText(plainTextToRichText(source))).toBe(source);
```

- [ ] **Step 4: Implement minimal validator/converters**

Use explicit recursive switch/allowlist. Do not add a generic HTML sanitizer/parser.

- [ ] **Step 5: Run**

```bash
npx vitest run tests/QuestionRichTextContract.test.ts --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/question-rich-text.contract.ts tests/QuestionRichTextContract.test.ts
git commit -m "feat: define question rich text contract"
```

---

## Task 5: Add Tiptap foundation and focused editor component

**Approval note:** Approval of this implementation plan authorizes adding only the Tiptap packages named in the header. Any different editor framework or extra Pro/cloud package requires a new approval.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/quiz-editor/components/RichQuestionEditor/richQuestionExtensions.ts`
- Create: `src/features/quiz-editor/components/RichQuestionEditor/RichQuestionEditor.tsx`
- Create: `tests/RichQuestionEditor.test.tsx`

**Interfaces:**

```ts
interface RichQuestionEditorProps {
  value: QuestionRichTextEnvelopeV1;
  onChange(value: QuestionRichTextEnvelopeV1, plainText: string): void;
  ariaLabel?: string;
  minHeightClassName?: string;
  onEditorReady?(adapter: RichQuestionEditorAdapter): void;
}
```

- [ ] **Step 1: Install the approved packages**

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit \
  @tiptap/extension-underline @tiptap/extension-text-align \
  @tiptap/extension-highlight @tiptap/extension-color @tiptap/extension-text-style
```

Then inspect actual installed versions and adapt imports to current documented API; do not copy outdated v2 imports blindly.

- [ ] **Step 2: Configure schema allowlist**

StarterKit must disable nodes not in v1 if it enables them by default (e.g. heading/codeBlock/blockquote/horizontalRule as applicable). Add only allowed extensions.

TextAlign:

```ts
TextAlign.configure({ types: ['paragraph'], alignments: ['left', 'center', 'right'] })
```

Highlight must use multicolor only with application palette enforcement.

- [ ] **Step 3: RED editor semantics tests**

Testing Library cases:
- renders initial paragraph;
- typing triggers `onChange` with JSON + plain fallback;
- Enter creates a paragraph;
- Shift+Enter creates a `hardBreak`;
- legacy TeX text remains identical in plain fallback.

- [ ] **Step 4: Implement controlled synchronization carefully**

Do not call `setContent` on every `onUpdate`. Only synchronize when external value actually changes (question selection/reload), preventing cursor jumps and update loops.

- [ ] **Step 5: Add deterministic test id/focus contract**

Root editable area:

```tsx
data-testid="question-rich-editor"
aria-label="Nội dung câu hỏi"
```

Expose adapter methods needed by Math Composer instead of querying ProseMirror internals from parent components.

- [ ] **Step 6: Run**

```bash
npx vitest run tests/RichQuestionEditor.test.tsx tests/QuestionRichTextContract.test.ts --maxWorkers=2
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json shared/question-rich-text.contract.ts \
  src/features/quiz-editor/components/RichQuestionEditor tests/RichQuestionEditor.test.tsx
git commit -m "feat: add focused rich question editor foundation"
```

---

## Task 6: Add toolbar formatting, lists, colors and paste constraints

**Files:**
- Create: `src/features/quiz-editor/components/RichQuestionEditor/RichQuestionToolbar.tsx`
- Modify: `src/features/quiz-editor/components/RichQuestionEditor/RichQuestionEditor.tsx`
- Modify: `src/features/quiz-editor/components/RichQuestionEditor/richQuestionExtensions.ts`
- Modify: `tests/RichQuestionEditor.test.tsx`

**Interfaces:** Toolbar consumes a Tiptap `Editor`; no app state.

- [ ] **Step 1: Add RED toolbar tests**

Buttons required:
- Undo / Redo
- Bold / Italic / Underline / Strike
- Left / Center / Right
- Bullet list / Ordered list
- fixed text color palette
- fixed highlight palette
- Clear formatting

Assert `aria-label`; toggle buttons expose `aria-pressed`.

- [ ] **Step 2: Implement format commands**

Use Tiptap command chain and project button styling. No free-form color input.

- [ ] **Step 3: Lock keyboard shortcuts**

Verify Ctrl/Cmd+B/I/U and native undo/redo behavior. Enter/Shift+Enter tests remain green.

- [ ] **Step 4: Lock paste behavior**

Paste unsupported HTML such as:

```html
<div style="font-size:72px" onclick="evil()"><script>alert(1)</script><strong>Hợp lệ</strong></div>
```

Expected persisted output:
- no script/event/style;
- allowed textual content remains;
- supported strong mark may remain;
- no arbitrary node/attribute enters `QuestionRichTextEnvelopeV1`.

- [ ] **Step 5: Run**

```bash
npx vitest run tests/RichQuestionEditor.test.tsx --maxWorkers=1
```

- [ ] **Step 6: Commit**

```bash
git add src/features/quiz-editor/components/RichQuestionEditor tests/RichQuestionEditor.test.tsx
git commit -m "feat: add rich question formatting toolbar"
```

---

## Task 7: Bridge the existing Math Composer to rich editor selections

**Files:**
- Modify: `src/features/manual-quiz-workspace/math-composer/useMathComposer.tsx`
- Modify: `src/features/quiz-editor/components/RichQuestionEditor/RichQuestionEditor.tsx`
- Modify: `tests/QuestionEditorPane.test.tsx`
- Modify: `tests/RichQuestionEditor.test.tsx`

**Interface change:** Extend Math Composer from native-only fields to a generic registered target while preserving native API.

Proposed shape:

```ts
interface MathComposerTarget {
  label: string;
  selectedText(): string;
  insertTemplate(templateId: MathTemplateId, values?: Record<string, string>): FormulaInsertionResult | null;
  focus(): void;
}
```

Native `useMathComposerField` becomes an adapter implementing this contract; rich editor registers a target using Tiptap selection/commands.

- [ ] **Step 1: RED regression test for native field**

Existing MathTextarea formula insertion must keep working after refactor.

- [ ] **Step 2: RED test for rich editor formula insertion**

Given selection/cursor inside `Nội dung câu hỏi`, trigger a formula template and assert:
- TeX appears at cursor;
- rich JSON has text only, no unsupported node;
- plain fallback contains same TeX;
- focus returns to rich editor.

- [ ] **Step 3: Refactor provider to generic active target**

Do not remove existing `useMathComposerField` public behavior for `TextInput`/`MathTextarea` used by type-specific fields.

- [ ] **Step 4: Integrate rich editor adapter**

The adapter converts current Tiptap text selection into template input and inserts returned TeX string via editor commands.

- [ ] **Step 5: Run**

```bash
npx vitest run tests/QuestionEditorPane.test.tsx tests/RichQuestionEditor.test.tsx --maxWorkers=2
```

Expected: native + rich formula insertion PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/manual-quiz-workspace/math-composer/useMathComposer.tsx \
  src/features/quiz-editor/components/RichQuestionEditor/RichQuestionEditor.tsx \
  tests/QuestionEditorPane.test.tsx tests/RichQuestionEditor.test.tsx
git commit -m "feat: connect math composer to rich question editor"
```

---

## Task 8: Extend frontend question drafts using dual representation

**Files:**
- Modify: `src/features/quiz-editor/types/quiz-editor.types.ts`
- Modify: `src/features/quiz-editor/utils/questionDraftMapper.ts`
- Modify: `src/features/quiz-editor/hooks/useQuestionEditor.ts`
- Create/modify: nearest mapper test resolved before edit (prefer existing question draft mapper test if present; otherwise `tests/QuestionDraftMapper.richText.test.ts`)

**Interfaces:**

Add optional field to applicable drafts:

```ts
questionRichText?: QuestionRichTextEnvelopeV1;
```

For TRUE_FALSE use the same property for `mainQuestion` presentation; do not invent a second schema unless a concrete conflict appears.

- [ ] **Step 1: RED mapper tests for legacy question**

`questionToDraft({ question: 'Dòng 1\nDòng 2' })` produces a rich doc via `plainTextToRichText`.

- [ ] **Step 2: RED mapper round-trip**

Rich document → draft → question preserves:
- `questionRichText`;
- derived plain `question`;
- existing `image`, `imageAlt`, difficulty, options, answers.

- [ ] **Step 3: Update draft types and mappers**

Never make rich field required for loading legacy questions.

- [ ] **Step 4: Remove/retire textarea-specific ref contract if no longer used**

`questionTextRef` in `useQuestionEditor` currently documents FormattingToolbar/textarea positioning. Remove it only after repository search proves no active consumer; otherwise adapt type/interface.

- [ ] **Step 5: Run**

```bash
npx vitest run tests/QuestionEditorForm.test.tsx tests/useQuestionEditor.math.test.tsx tests/*QuestionDraftMapper* --maxWorkers=2
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/features/quiz-editor/types/quiz-editor.types.ts \
  src/features/quiz-editor/utils/questionDraftMapper.ts \
  src/features/quiz-editor/hooks/useQuestionEditor.ts tests
git commit -m "feat: map rich question drafts with plain fallback"
```

---

## Task 9: Add D1 persistence and Worker-side rich-doc validation

**Important:** Before touching `workers/src/routes/quizzes.ts`, run `gitNexus.api_impact` on the quiz routes in the execution session because API handlers are being modified.

**Files:**
- Create: `workers/migrations/0064_add_question_rich_text.sql`
- Create: `workers/rollbacks/0064_drop_question_rich_text.sql`
- Modify: `workers/schema.sql`
- Modify: `workers/scripts/bootstrap_d1_migration_registry.sql`
- Modify: `workers/src/types.ts`

**Migration:**

```sql
ALTER TABLE questions ADD COLUMN question_rich_text TEXT NOT NULL DEFAULT '';
```

Rollback is destructive and used only with explicit rollback approval:

```sql
ALTER TABLE questions DROP COLUMN question_rich_text;
```

- [ ] **Step 1: Add schema/migration registry change**

Register `0064_add_question_rich_text.sql` after 0063.

- [ ] **Step 2: Extend Worker type only as optional string/camel mapping source**

Example:

```ts
question_rich_text?: string;
```

- [ ] **Step 3: Add migration/schema tests or run existing migration state tests**

Locate current migration drift/registry tests before editing; add assertion that schema and registry end at 0064.

- [ ] **Step 4: Local migration dry verification**

Use project-safe migration workflow, not ad-hoc production commands.

Expected:
- column exists;
- existing rows default `''`;
- migration registry matches expected latest.

- [ ] **Step 5: Commit migration foundation only**

```bash
git add workers/migrations/0064_add_question_rich_text.sql \
  workers/rollbacks/0064_drop_question_rich_text.sql workers/schema.sql \
  workers/scripts/bootstrap_d1_migration_registry.sql workers/src/types.ts
git commit -m "db: add question rich text presentation field"
```

---

## Task 10: Persist and expose rich JSON through quiz APIs safely

**Files:**
- Modify: `workers/src/utils/helpers.ts`
- Modify: `workers/src/routes/quizzes.ts`
- Modify: shared contract imports/build configuration only if Worker path requires an existing shared import convention
- Test: nearest quiz route/helper test files found via `find_files` before edit

**Interfaces:**

Incoming frontend payload:

```ts
questionRichText?: QuestionRichTextEnvelopeV1;
```

D1 value:

```text
question_rich_text = JSON.stringify(validatedEnvelope) or ''
```

Outgoing DTO:

```ts
questionRichText?: QuestionRichTextEnvelopeV1;
```

- [ ] **Step 1: RED helper test for valid persistence**

`mapQuestionForSave` must append serialized rich JSON while preserving plain question at its current column.

- [ ] **Step 2: RED invalid payload tests**

Reject unsupported node/mark/version/oversize before DB write with a deterministic 400 error, e.g. `INVALID_QUESTION_RICH_TEXT`.

- [ ] **Step 3: Update insert/copy column order atomically**

Modify together:
- `buildQuestionInsertStatement` column list/placeholders;
- `mapQuestionForSave` value array;
- `copiedQuestionValues`;
- any update/replace batch that reuses insert statement.

Add an explicit test that insert column count === value count so this cannot drift silently.

- [ ] **Step 4: Map D1 field to camel DTO**

`mapQuestionFromD1` should:
- parse/validate non-empty JSON;
- expose `questionRichText` only when valid;
- delete raw `question_rich_text` from mapped DTO;
- fallback silently to plain question if legacy/invalid stored value is encountered, while logging safe observability metadata rather than content.

- [ ] **Step 5: Student sanitizer**

Rich doc is presentation data and may remain in student DTO. Ensure answer fields are still removed exactly as before.

- [ ] **Step 6: Run focused Worker tests/typecheck**

```bash
npm run typecheck:workers
npx vitest run <resolved-rich-text-worker-tests> --maxWorkers=1
```

- [ ] **Step 7: Commit**

```bash
git add workers/src/utils/helpers.ts workers/src/routes/quizzes.ts shared/question-rich-text.contract.ts tests
git commit -m "feat: persist validated question rich text"
```

---

## Task 11: Wire rich editor into SharedHeader without expanding scope

**Files:**
- Modify: `src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorForm.tsx`
- Modify: `tests/QuestionEditorForm.test.tsx`
- Modify: `src/features/manual-quiz-workspace/components/QuestionEditorPane.tsx`
- Modify: `tests/QuestionEditorPane.test.tsx`

**Interfaces:** `RichQuestionEditor.onChange(rich, plain)` updates both `questionRichText` and `question/mainQuestion` in one draft update.

- [ ] **Step 1: Replace only main prompt `MathTextarea`**

Pseudo-update:

```tsx
<RichQuestionEditor
  value={draft.questionRichText ?? plainTextToRichText(questionValue)}
  onChange={(questionRichText, plainText) => onDraftChange((previous) => ({
    ...previous,
    [questionField]: plainText,
    questionRichText,
  }))}
  ariaLabel="Nội dung câu hỏi"
/>
```

- [ ] **Step 2: Keep type-specific `MathTextarea` inputs unchanged**

Do not convert DragDrop/Dropdown/ErrorCorrection passages, options or explanations in this task.

- [ ] **Step 3: Update save-and-next focus selector**

Current code focuses:

```ts
document.querySelector('[aria-label="Trình soạn câu hỏi"] textarea')
```

Change to focus the rich editor test id/accessible editor root, with legacy fallback only if necessary.

- [ ] **Step 4: Unit tests**

Assert:
- editor appears in inline form;
- plain question updates alongside rich value;
- save still calls existing path;
- switching selected question rehydrates correct external document.

- [ ] **Step 5: Run**

```bash
npx vitest run tests/QuestionEditorForm.test.tsx tests/QuestionEditorPane.test.tsx tests/useQuestionEditor.math.test.tsx --maxWorkers=2
```

- [ ] **Step 6: Commit**

```bash
git add src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorForm.tsx \
  src/features/manual-quiz-workspace/components/QuestionEditorPane.tsx \
  tests/QuestionEditorForm.test.tsx tests/QuestionEditorPane.test.tsx
git commit -m "feat: enable rich text for manual question prompts"
```

---

## Task 12: Render rich documents safely in teacher preview and student player

**Files:**
- Create: `src/components/common/QuestionRichTextRenderer.tsx`
- Modify: `src/features/manual-quiz-workspace/components/StudentPreviewPane.tsx`
- Modify: `src/features/quiz-player/components/QuestionRenderer/index.tsx`
- Create: `tests/QuestionRichTextRenderer.test.tsx`

**Interfaces:**

```ts
interface QuestionRichTextRendererProps {
  value?: QuestionRichTextEnvelopeV1;
  fallback: string;
  className?: string;
}
```

- [ ] **Step 1: RED renderer tests**

Lock:
- paragraph + hardBreak;
- left/center/right;
- bullet/ordered list;
- bold/italic/underline/strike;
- fixed color/highlight;
- TeX text rendered via existing `MathSpan`;
- invalid/missing doc → fallback `MathSpan`/plain path;
- no raw HTML injection.

- [ ] **Step 2: Implement JSON → React renderer**

Use explicit node switch. For text nodes, wrap marks as React elements/styles from fixed palette and pass text through `MathSpan` so TeX stays compatible.

Do not use `dangerouslySetInnerHTML`.

- [ ] **Step 3: Teacher preview**

`StudentPreviewPane` prefers `selected.questionRichText` and passes current plain prompt as fallback.

- [ ] **Step 4: Student quiz player**

`QuestionRenderer/index.tsx` uses rich renderer for prompt only when a valid mapped `questionRichText` exists; otherwise retain `SmartText` behavior.

- [ ] **Step 5: Run**

```bash
npx vitest run tests/QuestionRichTextRenderer.test.tsx tests/QuestionRendererRichTextMath.test.tsx --maxWorkers=2
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/components/common/QuestionRichTextRenderer.tsx \
  src/features/manual-quiz-workspace/components/StudentPreviewPane.tsx \
  src/features/quiz-player/components/QuestionRenderer/index.tsx \
  tests/QuestionRichTextRenderer.test.tsx
git commit -m "feat: render structured question formatting safely"
```

---

## Task 13: Preserve rich presentation in practice and live-exam read paths

**Files:**
- Modify: `workers/src/routes/practice.ts`
- Modify: `workers/src/services/liveExam/quizLoader.ts`
- Test: nearest practice/live-exam mapper tests (resolve exact files before edit)

**Rationale:** Generic `/api/questions` paths mostly use `SELECT *`, but practice and live-exam loaders use explicit select lists. If they omit `question_rich_text`, student gameplay would inconsistently lose formatting.

- [ ] **Step 1: RED read-path tests**

For a row with both plain question and rich JSON, verify mapped student question includes rich presentation without exposing correct-answer fields beyond current contract.

- [ ] **Step 2: Add `question_rich_text` to explicit SELECTs**

Use the same safe mapping/parse utility rather than direct unchecked `JSON.parse` where possible.

- [ ] **Step 3: Do not modify grading/analytics/AI loaders unnecessarily**

They continue consuming plain `question`. This is intentional compatibility, not a missing feature.

- [ ] **Step 4: Run**

```bash
npm run typecheck:workers
npx vitest run <resolved-practice-live-exam-tests> --maxWorkers=2
```

- [ ] **Step 5: Commit**

```bash
git add workers/src/routes/practice.ts workers/src/services/liveExam/quizLoader.ts tests
git commit -m "feat: preserve rich prompts in student quiz loaders"
```

---

# Slice C — End-to-end behavior and quality gate

## Task 14: Extend manual workspace E2E for Enter, formatting, persistence and compact media

**Files:**
- Modify: `cypress/e2e/manual-quiz-workspace.cy.ts`

- [ ] **Step 1: Draft/reload newline test**

Create/edit a question with:

```text
Dòng thứ nhất
Dòng thứ hai
```

Use actual Enter keystroke, save draft, reload/recover, and assert both lines render in editor/preview.

- [ ] **Step 2: Shift+Enter test**

Assert serialized document contains `hardBreak` rather than a second paragraph.

- [ ] **Step 3: Formatting persistence**

Apply bold + centered paragraph + bullet list, trigger draft save/reload, then verify editor state and preview output.

- [ ] **Step 4: Publish payload contract**

Intercept `POST /api/quizzes` and assert one question includes:
- non-empty plain `question`;
- `questionRichText.schemaVersion === 1`;
- no unsupported raw style fields.

- [ ] **Step 5: Compact attachment contract**

Assert empty attachment collapsed; expand; use URL or mocked upload path; after a value exists, verify compact thumbnail + alt input and no full-height image preview.

- [ ] **Step 6: Responsive overflow checks**

Reuse `assertNoHorizontalOverflow()` at:
- 1440×900;
- 1024×768;
- 768×1024;
- mobile supported by current Cypress viewport strategy.

- [ ] **Step 7: Run**

```bash
npx cypress run --e2e --spec cypress/e2e/manual-quiz-workspace.cy.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add cypress/e2e/manual-quiz-workspace.cy.ts
git commit -m "test: cover manual rich editor end to end"
```

---

## Task 15: Performance, accessibility, security and full verification

**Files:** No production changes unless a verification failure reveals a root-cause defect inside approved scope.

- [ ] **Step 1: Focused unit/integration suite**

```bash
npx vitest run \
  tests/MediaDropzone.test.tsx \
  tests/QuestionEditorForm.test.tsx \
  tests/QuestionEditorPane.test.tsx \
  tests/QuestionRichTextContract.test.ts \
  tests/RichQuestionEditor.test.tsx \
  tests/QuestionRichTextRenderer.test.tsx \
  tests/useQuestionEditor.math.test.tsx \
  --maxWorkers=2
```

Expected: PASS.

- [ ] **Step 2: Type checks**

```bash
npm run typecheck
npm run typecheck:strict
npm run typecheck:workers
```

Expected: PASS.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: PASS, 0 warnings.

- [ ] **Step 4: Build + bundle budget**

```bash
npm run build
npm run perf:budget
```

If Tiptap causes the budget to fail, lazy-load the rich editor on quiz-authoring routes before proceeding. Do not raise the budget merely to make CI green without product/performance approval.

- [ ] **Step 5: Security gates**

```bash
npm run security:check
```

Also run a changed-files secret scan through Local Coding.

- [ ] **Step 6: Stubbed E2E**

```bash
npm run cypress:run:stubbed
```

Expected: PASS.

- [ ] **Step 7: Real browser accessibility/visual check**

Use browser-testing skill/Playwright or Chrome DevTools against local app.

Check:
- keyboard Tab order;
- toolbar accessible names and pressed states;
- attachment `aria-expanded`;
- no console errors;
- no network/CDN regression;
- screenshots at 320/768/1024/1440.

- [ ] **Step 8: GitNexus pre-commit/pre-PR check**

Run `detect_changes(scope="all")`; investigate any newly affected HIGH/CRITICAL path before proceeding.

- [ ] **Step 9: Primary code review**

Use `code-review-and-quality` / `requesting-code-review`. Fix blocker/major issues and rerun impacted gates.

- [ ] **Step 10: Optional independent read-only reviewer**

Use configured Gemini reviewer only for read-only review if available. ChatGPT adjudicates all findings against repo evidence/tests.

- [ ] **Step 11: Full verification**

```bash
npm run verify
```

Expected: PASS.

---

# Production rollout plan — separate approval required

No production mutation occurs during implementation approval alone.

When implementation + CI + review are green:

1. Capture current production source/deployment baseline.
2. Audit D1 migration registry; ensure latest expected becomes `0064_add_question_rich_text.sql`.
3. Apply migration with existing safe migration workflow to staging/local rehearsal first.
4. Run quiz authoring + read-path smoke.
5. Ask user for explicit **production migration/deploy approval**.
6. Apply production migration.
7. Deploy Worker/frontend using existing release procedure.
8. Run health/CORS/auth guard/role smoke + manual quiz creation smoke.
9. Verify old quiz without `question_rich_text` still renders.
10. Verify new rich quiz renders in normal player/practice/live exam.

## Rollback strategy

### Frontend/Worker rollback

Safe first response: redeploy previous reviewed application version. New D1 column is additive and harmless to old code.

### Database rollback

Do **not** drop `question_rich_text` during normal application rollback. Dropping the column destroys formatted documents. Use `workers/rollbacks/0064_drop_question_rich_text.sql` only after explicit destructive rollback approval and data retention decision.

---

# Success criteria

The feature is complete only when all are true:

- Empty optional attachment no longer occupies a large card.
- Main question editor visibly receives the reclaimed authoring space.
- Enter/Shift+Enter behavior matches the spec and survives save/reload.
- Required formatting controls persist through D1 and render in preview/player.
- Existing formula composer works in the rich editor and native fields.
- Legacy plain questions work without migration/backfill.
- `IMAGE_QUESTION` full media workflow is unchanged.
- Student DTO still excludes answer data.
- Unsupported HTML/style cannot be persisted/rendered as executable markup.
- No horizontal overflow at target breakpoints.
- Lint/typecheck/tests/build/security/performance gates pass.
- GitNexus does not reveal unresolved HIGH/CRITICAL impact.

---

# Scope intentionally not implemented in this plan

- Rich formatting of answers/options.
- Rich formatting of explanations.
- Rich formatting of long passages in every question type.
- Inline image nodes within the editor document.
- Free font/font-size controls.
- Tables/links/embeds.
- Rich formatting in analytics/report tables that already have safe plain fallback.
- Changes to scoring/grading logic.
- Production deployment without separate approval.

---

# Self-review of plan

## Spec coverage

- Compact image: Tasks 1–3.
- Larger authoring area: Task 3.
- Enter/Shift+Enter: Tasks 5, 14.
- Formatting/alignment/lists/colors: Task 6.
- Math composer: Task 7.
- Structured secure data + fallback: Tasks 4, 8–10.
- Teacher/student rendering: Task 12.
- Practice/live exam consistency: Task 13.
- Legacy compatibility: Tasks 4, 8, 10, 12.
- Responsive/accessibility/security: Tasks 14–15.
- D1 migration/rollback: Tasks 9–10 + rollout section.

## Key trade-off

The plan intentionally keeps `question` as plain canonical fallback and adds `question_rich_text` rather than replacing existing storage. This costs one extra field but sharply reduces blast radius across grading, analytics, AI and legacy clients.

## Approval gates

- **Plan approval:** permits implementation in an isolated worktree and the listed Tiptap dependency additions.
- **Production gate:** migration/deploy to production still requires a separate explicit approval.
