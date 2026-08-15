# Worksheet Export Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa chức năng “Xuất Vở Bài Tập” về trạng thái production-ready: đúng đáp án, không mất dữ liệu ở đủ 15 `QuestionType`, giữ hình/công thức, PDF/DOCX có hành vi tương đương, và DOCX đạt hard gate của skill `tao-phieu-bai-tap`.

**Architecture:** Không vá riêng lẻ PDF và DOCX. Tạo lớp chuẩn hóa/presentation dùng chung cho dữ liệu dẫn xuất (đặc biệt matching/shuffle/media/answer mapping), sau đó để PDF và DOCX chỉ chịu trách nhiệm render. Các renderer được chia theo nhóm `choice`, `structured`, `writing`, `media` để tránh một switch lớn và bảo đảm parity giữa hai định dạng.

**Tech Stack:** React 19.2.7, TypeScript 5.8.2, Vite 6.4.2, Vitest 4.1.10, jsPDF 4.1.0, docx 9.5.1, MathJax 3.2.2 self-hosted, file-saver 2.0.5.

## Global Constraints

- Tuân thủ `AGENTS.md`: `plan → isolated worktree → GitNexus → TDD → review/verify → user approval → commit → push/PR → CI/review → merge → production smoke → cleanup`.
- Không sửa trực tiếp `main`; branch dự kiến: `fix/worksheet-export-integrity`, worktree riêng.
- Trước khi sửa bất kỳ function/class/method nào: GitNexus `impact(direction=upstream)`; HIGH/CRITICAL phải báo người dùng trước khi sửa.
- Mỗi behavior change phải có TDD RED trước GREEN.
- Không commit trước user approval gate cuối cùng; quy tắc repo này ưu tiên hơn khuyến nghị “frequent commits” của planning skill.
- Hỗ trợ đủ 15 `QuestionType`: MCQ, TRUE_FALSE, SHORT_ANSWER, MATCHING, MULTIPLE_SELECT, DRAG_DROP, ORDERING, IMAGE_QUESTION, DROPDOWN, UNDERLINE, CATEGORIZATION, WORD_SCRAMBLE, RIDDLE, ERROR_CORRECTION, GEOMETRY.
- DOCX mặc định: A4 portrait `11906 × 16838 twips`; margins top/bottom/left/right/gutter = `1134/1134/1134/850/0`; Times New Roman 14pt cho text run thường.
- Phân số/công thức không được xuất thành slash text như `1/2`, `3/4` khi dữ liệu nguồn là math; DOCX dùng Office Math, PDF dùng math raster/SVG có chất lượng in.
- Không bỏ `question.image`, `optionImages`, `svgContent`, `geometryData` nếu chúng quyết định đáp án.
- Không phụ thuộc `Math.random()` để tạo mapping đáp án; cùng một question phải tạo layout/answer mapping nhất quán trong một export.
- Không thêm dependency mới nếu stack hiện tại xử lý được.

---

## File Map

**Create**
- `src/services/worksheet-export/shared/matchingLayout.ts` — deterministic matching layout + answer mapping.
- `src/services/worksheet-export/shared/media.ts` — chuẩn hóa nguồn media/image cho export.
- `src/services/worksheet-export/pdf/pdfMath.ts` — render math fragments thành SVG/PNG dùng cho jsPDF.
- `src/services/worksheet-export/pdf/pdfMedia.ts` — render `image`, `optionImages`, SVG, geometry media.
- `src/services/worksheet-export/docx/docxMedia.ts` — embed media vào DOCX.
- `src/services/worksheet-export/docx/renderers/structuredRenderer.ts` — DROPDOWN/ORDERING/CATEGORIZATION/WORD_SCRAMBLE.
- `src/services/worksheet-export/docx/renderers/writingRenderer.ts` — UNDERLINE/RIDDLE/ERROR_CORRECTION/GEOMETRY answer area.
- `tests/worksheetExportIntegrity.test.ts` — regression tests cho P1/P2.

**Modify**
- `tests/fixtures/worksheetExportFixture.ts`
- `tests/worksheetExportService.test.ts`
- `src/services/worksheet-export/shared/answerFormatter.ts`
- `src/services/worksheet-export/shared/mathNormalizer.ts` nếu cần tách “plain-text normalization” khỏi “print math rendering”.
- `src/services/worksheet-export/pdf/pdfDocument.ts`
- `src/services/worksheet-export/pdf/pdfLayout.ts`
- `src/services/worksheet-export/pdf/pdfQuestionRenderers.ts`
- `src/services/worksheet-export/pdf/pdfAnswerKey.ts`
- `src/services/worksheet-export/pdf/renderers/choiceRenderer.ts`
- `src/services/worksheet-export/pdf/renderers/matchingDragRenderer.ts`
- `src/services/worksheet-export/docx/docxDocument.ts`
- `src/services/worksheet-export/docx/docxHelpers.ts`
- `src/services/worksheet-export/docx/docxMath.ts`
- `src/services/worksheet-export/docx/docxQuestionRenderers.ts`
- `src/services/worksheet-export/docx/renderers/choiceRenderer.ts`
- `src/services/worksheet-export/docx/renderers/matchingDragRenderer.ts`
- `src/services/worksheet-export/docx/renderers/trueFalseRenderer.ts`
- `src/services/worksheet-export/fileName.ts`
- `src/components/TeacherDashboard/WorksheetExportModal.tsx`

**Reuse / reference**
- `src/utils/docxGenerator.ts` — đã có behavior cho DROPDOWN/ORDERING/UNDERLINE/CATEGORIZATION/WORD_SCRAMBLE/RIDDLE/ERROR_CORRECTION và image embedding; tái sử dụng ý tưởng nhưng không tạo duplicate helper mới nếu có thể extract canonical logic.
- `src/components/common/GeometryRenderer.tsx` — nguồn logic geometry; phần export cần pure conversion, không import React renderer vào service.
- `.agents/skills/tao-phieu-bai-tap/scripts/audit_docx_layout.py`
- `.agents/skills/tao-phieu-bai-tap/scripts/audit_docx_math_typography.py`

---

### Task 1: Khóa regression contract bằng TDD RED

**Files:**
- Modify: `tests/fixtures/worksheetExportFixture.ts`
- Create: `tests/worksheetExportIntegrity.test.ts`

**Produces:** Bộ test đỏ chứng minh từng lỗi audit trước khi sửa implementation.

- [ ] **Step 1:** Mở rộng fixture matching thành ít nhất 3 cặp (`2+2→4`, `3+3→6`, `5+5→10`) để shuffle thực sự thay đổi label.
- [ ] **Step 2:** Thêm option MCQ dài > 2 dòng PDF và `IMAGE_QUESTION` có `image` + `optionImages` data URL hợp lệ.
- [ ] **Step 3:** Viết test `keeps matching answer labels aligned with shuffled right column` — đọc right-column labels từ renderer output và assert answer key map trỏ đúng nội dung.
- [ ] **Step 4:** Viết test `renders all structured question payloads in DOCX` — assert DOCX chứa `Em ___ học.`, các option dropdown, ordering items, underline sentence, category names/items, letters scramble, riddle line, error passage.
- [ ] **Step 5:** Viết test `embeds required question and option images` — mock `ImageRun`/jsPDF `addImage` và assert image chính + option image được gọi.
- [ ] **Step 6:** Viết test `does not flatten LaTeX fractions to slash text in print outputs` — assert PDF/DOCX không chứa `1/2`/`3/4` từ fixture math và DOCX vẫn có `MathFraction`.
- [ ] **Step 7:** Viết test `renders multiline PDF choices without truncation` — mock `splitTextToSize()` trả 3 lines và assert cả 3 được gửi vào `doc.text`.
- [ ] **Step 8:** Viết test `counts answer pages in PDF footers` — answer key tạo thêm page rồi assert footer cuối cùng dùng total page count thực tế.
- [ ] **Step 9:** Viết test `preserves Vietnamese letters in exported filename` — expected `vo-bai-tap-Ôn-tập-Toán-Phân-số.docx/pdf` hoặc convention canonical đã khóa trong test.
- [ ] **Step 10:** Chạy `npx vitest run tests/worksheetExportIntegrity.test.ts`; expected: FAIL ở matching, DOCX structured, media, PDF math, multiline choice, footer, filename.

---

### Task 2: Tạo deterministic matching layout dùng chung

**Files:**
- Create: `src/services/worksheet-export/shared/matchingLayout.ts`
- Modify: `src/services/worksheet-export/shared/answerFormatter.ts`
- Modify: `src/services/worksheet-export/pdf/renderers/matchingDragRenderer.ts`
- Modify: `src/services/worksheet-export/docx/renderers/matchingDragRenderer.ts`

**Interface:**
```ts
export interface WorksheetMatchingRow {
  leftLabel: string;
  left: string;
  rightLabel: string;
  right: string;
}

export interface WorksheetMatchingLayout {
  rows: WorksheetMatchingRow[];
  answerText: string;
}

export function buildWorksheetMatchingLayout(
  question: MatchingQuestion,
): WorksheetMatchingLayout;
```

- [ ] **Step 1:** GitNexus impact cho `getWorksheetAnswerText`, `renderPdfMatching`, `renderDocxMatching`.
- [ ] **Step 2:** Implement deterministic shuffle từ `question.id + pairs` (xorshift/hash đơn giản nội bộ; không dependency).
- [ ] **Step 3:** `answerText` phải được suy ra từ vị trí thực tế của từng `pair.right` sau shuffle, ví dụ `1→C 2→A 3→B`.
- [ ] **Step 4:** PDF và DOCX matching cùng dùng `buildWorksheetMatchingLayout()`; bỏ `Math.random()` khỏi matching.
- [ ] **Step 5:** `answerFormatter` dùng cùng layout cho `QuestionType.MATCHING`.
- [ ] **Step 6:** Chạy focused tests; expected matching regression chuyển GREEN.

---

### Task 3: Sửa answer integrity cho toàn bộ QuestionType

**Files:**
- Modify: `src/services/worksheet-export/shared/answerFormatter.ts`
- Test: `tests/worksheetExportIntegrity.test.ts`

**Produces:** Mỗi QuestionType có answer formatter rõ ràng, không rơi default ngoài GEOMETRY fallback hợp lệ.

- [ ] **Step 1:** Thêm `DROPDOWN`: `blanks.map((b,i) => `${i+1}. ${b.correctAnswer}`).join(' | ')`.
- [ ] **Step 2:** Kiểm tra `DRAG_DROP` chấp nhận cả string và object `{content}`; normalize trước join.
- [ ] **Step 3:** Giữ `ORDERING`, `UNDERLINE`, `CATEGORIZATION`, `WORD_SCRAMBLE`, `ERROR_CORRECTION` nhưng thêm test exact semantic output.
- [ ] **Step 4:** `GEOMETRY` chỉ dùng `correctAnswer` nếu tồn tại; không tự bịa đáp án từ `geometryData`.
- [ ] **Step 5:** Chạy focused test answer key PDF + DOCX; expected GREEN.

---

### Task 4: Hoàn thiện DOCX renderer đủ 15 loại câu

**Files:**
- Create: `src/services/worksheet-export/docx/renderers/structuredRenderer.ts`
- Create: `src/services/worksheet-export/docx/renderers/writingRenderer.ts`
- Modify: `src/services/worksheet-export/docx/docxQuestionRenderers.ts`
- Modify: `src/services/worksheet-export/docx/docxHelpers.ts`

**Interfaces:**
```ts
export function renderDocxDropdown(question: DropdownQuestion): Paragraph[];
export function renderDocxOrdering(question: OrderingQuestion): Paragraph[];
export function renderDocxCategorization(question: CategorizationQuestion): Paragraph[];
export function renderDocxWordScramble(question: WordScrambleQuestion): Paragraph[];
export function renderDocxUnderline(question: UnderlineQuestion): Paragraph[];
export function renderDocxRiddle(question: RiddleQuestion): Paragraph[];
export function renderDocxErrorCorrection(question: ErrorCorrectionQuestion): Paragraph[];
export function renderDocxGeometryAnswerArea(question: GeometryQuestion): Paragraph[];
```

- [ ] **Step 1:** GitNexus impact cho `renderDocxQuestion`, `createDocxAnswerLine`.
- [ ] **Step 2:** Port behavior hiện có từ `src/utils/docxGenerator.ts` sang renderer canonical, dùng `createDocxMathChildren()` cho mọi text có thể chứa toán.
- [ ] **Step 3:** DROPDOWN: render `text` với blank + dòng lựa chọn `[1]: đi / ăn`.
- [ ] **Step 4:** ORDERING: render từng item đánh số + vùng ghi thứ tự.
- [ ] **Step 5:** CATEGORIZATION: render nhóm + item bank, không lộ `categoryId`/đáp án.
- [ ] **Step 6:** WORD_SCRAMBLE: render letters + vùng `Từ đúng`.
- [ ] **Step 7:** UNDERLINE: render `sentence` nguyên vẹn + hướng dẫn gạch chân.
- [ ] **Step 8:** RIDDLE: render toàn bộ `riddleLines` + answer line dùng `answerLabel`.
- [ ] **Step 9:** ERROR_CORRECTION: render `passage` + vùng `Từ sai / Từ đúng`.
- [ ] **Step 10:** GEOMETRY: media sẽ do Task 6 xử lý; renderer tạo vùng trả lời/drawing area, không biến geometry thành text.
- [ ] **Step 11:** Switch `renderDocxQuestion()` phải explicit cho đủ 15 enum values; default chỉ là defensive fallback và test không được đi qua default với enum hiện tại.
- [ ] **Step 12:** Chạy DOCX structured tests; expected GREEN.

---

### Task 5: Chuẩn hóa DOCX A4, margins, font và typo header

**Files:**
- Modify: `src/services/worksheet-export/docx/docxDocument.ts`
- Modify: `src/services/worksheet-export/docx/docxHelpers.ts`
- Modify: `src/services/worksheet-export/docx/docxMath.ts`
- Modify: all DOCX renderer files that create `TextRun` directly.

**Contract:**
```ts
export const WORKSHEET_DOCX_FONT = 'Times New Roman';
export const WORKSHEET_DOCX_SIZE = 28; // half-points = 14pt
export const WORKSHEET_A4 = { width: 11906, height: 16838 } as const;
export const WORKSHEET_MARGINS = { top: 1134, bottom: 1134, left: 1134, right: 850, gutter: 0 } as const;
```

- [ ] **Step 1:** Source-driven verification với docx 9.5.1 docs/Context7 cho page size, margins, default run style và `TextRun.font`.
- [ ] **Step 2:** Set explicit A4 portrait + exact margins trong `Document.sections[].properties.page`.
- [ ] **Step 3:** Tạo helper/style dùng chung để mọi regular `TextRun` có Times New Roman 14pt.
- [ ] **Step 4:** Không tăng cỡ title/header; hierarchy dùng bold/alignment/spacing theo hard gate.
- [ ] **Step 5:** Sửa typo `BÀI KIỂM TRÀ` → `BÀI KIỂM TRA`.
- [ ] **Step 6:** Sinh DOCX thật từ fixture vào `.tmp/worksheet-audit.docx` bằng test harness.
- [ ] **Step 7:** Chạy `python .agents/skills/tao-phieu-bai-tap/scripts/audit_docx_layout.py .tmp/worksheet-audit.docx`; expected PASS.
- [ ] **Step 8:** Chạy `set PYTHONIOENCODING=utf-8&& python .agents/skills/tao-phieu-bai-tap/scripts/audit_docx_math_typography.py .tmp/worksheet-audit.docx`; expected PASS.

---

### Task 6: Media parity — image, optionImages, SVG, geometry

**Files:**
- Create: `src/services/worksheet-export/shared/media.ts`
- Create: `src/services/worksheet-export/pdf/pdfMedia.ts`
- Create: `src/services/worksheet-export/docx/docxMedia.ts`
- Modify: `src/services/worksheet-export/pdf/pdfDocument.ts`
- Modify: `src/services/worksheet-export/pdf/pdfQuestionRenderers.ts`
- Modify: `src/services/worksheet-export/docx/docxDocument.ts`
- Modify: `src/services/worksheet-export/docx/docxQuestionRenderers.ts`
- Potentially extract pure geometry conversion from `src/components/common/GeometryRenderer.tsx` into `src/utils/geometrySvg.ts` only after GitNexus impact confirms safe blast radius.

**Interfaces:**
```ts
export interface WorksheetImageAsset {
  data: Uint8Array | ArrayBuffer;
  mime: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
}

export async function loadWorksheetImage(source: string): Promise<WorksheetImageAsset | null>;
```

- [ ] **Step 1:** GitNexus impact cho media-related symbols và `GeometryRenderer` helpers trước extraction.
- [ ] **Step 2:** Hỗ trợ `data:image/png;base64`, `data:image/jpeg;base64`, và HTTPS image URL; lỗi fetch phải trả structured warning/failure thay vì silently bỏ required image.
- [ ] **Step 3:** PDF render image chính sau prompt, trước options; giữ aspect ratio và `ensurePdfSpace()`.
- [ ] **Step 4:** DOCX embed image chính bằng `ImageRun`, centered, giữ aspect ratio.
- [ ] **Step 5:** `optionImages` phải render cạnh/ dưới đúng option label tương ứng ở cả PDF và DOCX.
- [ ] **Step 6:** Giữ pipeline `sanitizeSvgDiagram → rasterizeSvgDiagramForPdf` hiện tại; DOCX cần cùng sanitized SVG raster path hoặc PNG equivalent.
- [ ] **Step 7:** `geometryData`: dùng pure geometry→SVG/PNG; không screenshot DOM và không phụ thuộc React component runtime trong export service.
- [ ] **Step 8:** Nếu `IMAGE_QUESTION` không load được required image hoặc GEOMETRY thiếu cả geometry/svg usable, export phải fail với message có thể hiển thị cho giáo viên, không tạo file bị thiếu dữ kiện.
- [ ] **Step 9:** Chạy media tests cho image main, optionImages, SVG sanitize, geometry; expected GREEN.

---

### Task 7: PDF math rendering không còn slash-text

**Files:**
- Create: `src/services/worksheet-export/pdf/pdfMath.ts`
- Modify: `src/services/worksheet-export/pdf/pdfQuestionRenderers.ts`
- Modify: `src/services/worksheet-export/pdf/pdfAnswerKey.ts`
- Modify: PDF renderer files có text math.

**Interface:**
```ts
export interface PdfTextOrMathSegment {
  type: 'text' | 'math';
  value: string;
}

export async function preparePdfMathSegments(content: unknown): Promise<PdfTextOrMathSegment[]>;
```

- [ ] **Step 1:** Source-driven verify MathJax 3 browser APIs trong version self-hosted hiện tại.
- [ ] **Step 2:** Reuse `normalizeMathText()` + `splitMathSegments()` để phân biệt prose và math, không flatten `\frac` thành slash trước khi render.
- [ ] **Step 3:** Typeset math fragment qua MathJax thành SVG, sanitize result, rasterize/insert vào jsPDF ở baseline phù hợp.
- [ ] **Step 4:** Prose vẫn dùng Unicode font hiện tại; math image chỉ thay segment math.
- [ ] **Step 5:** Answer key PDF dùng cùng math pipeline.
- [ ] **Step 6:** Nếu MathJax unavailable/failed, export trả lỗi rõ thay vì silently đổi `\frac{1}{2}` → `1/2`.
- [ ] **Step 7:** Regression test assert `1/2` và `3/4` không xuất như raw slash text từ fixture; expected GREEN.

---

### Task 8: Sửa PDF pagination, long choices và footer

**Files:**
- Modify: `src/services/worksheet-export/pdf/renderers/choiceRenderer.ts`
- Modify: `src/services/worksheet-export/pdf/pdfLayout.ts`
- Modify: `src/services/worksheet-export/pdf/pdfDocument.ts`
- Modify: `src/services/worksheet-export/pdf/pdfAnswerKey.ts`

- [ ] **Step 1:** GitNexus impact cho `renderPdfChoices`, `ensurePdfSpace`, `addPdfFooters`, `renderPdfAnswerKey`.
- [ ] **Step 2:** Tính row height từ `max(lines.length)` của 2 options trong cùng row; render toàn bộ lines, không chỉ `lines[0]`.
- [ ] **Step 3:** `ensurePdfSpace()` phải chạy trước khi chốt tọa độ `y` của row; sau page break phải dùng `ctx.yPos` mới.
- [ ] **Step 4:** Question + required visual + minimum answer area được coi như atomic block khi đủ chỗ; nếu block lớn hơn một trang thì split theo renderer-specific safe boundary.
- [ ] **Step 5:** Render answer key trước, sau đó `addPdfFooters()` cuối cùng để `getNumberOfPages()` gồm tất cả answer pages.
- [ ] **Step 6:** Trang answer key mới phải dùng cùng paper/footer policy phù hợp; footer có `Trang N / Total` đúng toàn bộ file.
- [ ] **Step 7:** Chạy long-choice + multipage + answer-key tests; expected GREEN.

---

### Task 9: Filename Unicode + modal accessibility/error UX

**Files:**
- Modify: `src/services/worksheet-export/fileName.ts`
- Modify: `src/components/TeacherDashboard/WorksheetExportModal.tsx`
- Test: `tests/worksheetExportIntegrity.test.ts`
- Add component test if existing test infra has a suitable TeacherDashboard modal test location.

- [ ] **Step 1:** Filename sanitize theo Unicode letters/numbers (`\p{L}\p{N}` với `u` flag), collapse whitespace/dashes, giữ tiếng Việt, loại Windows-invalid chars `<>:"/\\|?*` và trailing dots/spaces.
- [ ] **Step 2:** Modal container: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` trỏ title.
- [ ] **Step 3:** Nút X có `aria-label="Đóng cửa sổ xuất vở bài tập"`.
- [ ] **Step 4:** Format/paper buttons dùng `aria-pressed` hoặc radio semantics rõ; ưu tiên semantic radio group nếu không tăng complexity.
- [ ] **Step 5:** Escape đóng modal khi không export; focus được đưa vào modal khi mở và trả lại trigger nếu parent pattern hỗ trợ.
- [ ] **Step 6:** Error container `role="alert"`; không đóng modal khi export fail.
- [ ] **Step 7:** Filename + accessibility tests GREEN.

---

### Task 10: Verification hard gates và review cuối

**Files:** Không thêm source mới trừ regression fixes phát hiện trong verification.

- [ ] **Step 1:** `npx vitest run tests/worksheetExportService.test.ts tests/worksheetExportIntegrity.test.ts` → 0 failures.
- [ ] **Step 2:** `npx eslint "src/services/worksheet-export/**/*.ts" "src/components/TeacherDashboard/WorksheetExportModal.tsx" "tests/worksheetExport*.test.ts" --max-warnings=0` → exit 0.
- [ ] **Step 3:** `npm run typecheck` → exit 0.
- [ ] **Step 4:** `npm run build:frontend` → exit 0.
- [ ] **Step 5:** `npm run perf:budget` → exit 0; so sánh Worksheet Export lazy chunk với baseline audit (`~113.2 KB gzip`) và báo delta.
- [ ] **Step 6:** `npm run security:scan` → PASS.
- [ ] **Step 7:** `npm run audit:dependencies:production` → critical/high = 0.
- [ ] **Step 8:** Sinh DOCX thật rồi chạy cả hai skill audit scripts → PASS.
- [ ] **Step 9:** Render visual toàn bộ DOCX/PDF. Nếu local vẫn thiếu `soffice`, cài/enable tool chỉ khi user/project policy cho phép; không được tuyên bố visual QA PASS nếu chưa render được.
- [ ] **Step 10:** Browser test modal: mở, Tab order, Escape, export loading/error state, console = 0 errors/warnings liên quan.
- [ ] **Step 11:** `review_diff` + manual five-axis review; P1/P2 = 0 trước approval gate.
- [ ] **Step 12:** GitNexus `detect_changes(scope=compare, base_ref=main)`; scope chỉ gồm Worksheet Export + test/support extraction đã dự kiến.
- [ ] **Step 13:** Báo user: exact files, verification evidence, remaining risks; chờ `DUYỆT COMMIT` trước khi commit/push.

---

## Acceptance Criteria

1. Đủ 15 QuestionType render usable trong PDF và DOCX; không loại nào rơi vào “chỉ có dòng Trả lời” nếu schema có structured payload cần hiển thị.
2. Matching answer mapping luôn đúng với cột B thực tế.
3. DROPDOWN answer key không rỗng.
4. IMAGE_QUESTION/optionImages và GEOMETRY/SVG không mất media quyết định đáp án.
5. PDF không cắt option dài và không dùng tọa độ cũ sau page break.
6. PDF footer tính đúng cả answer pages.
7. DOCX hard gate layout PASS: A4 portrait + `1134/1134/1134/850/0` margins.
8. DOCX hard gate typography PASS: Times New Roman 14pt regular runs và không unrendered fraction slash.
9. PDF math không flatten LaTeX fraction thành slash text.
10. Filename giữ tiếng Việt an toàn trên Windows.
11. Focused tests, lint, typecheck, frontend build, security scan, dependency audit, perf budget đều PASS.
12. Visual QA được thực hiện thực tế; nếu chưa có renderer local thì trạng thái vẫn BLOCKED, không được đánh dấu DONE.

## Rollback Strategy

- Mọi source change diễn ra trong isolated worktree `fix/worksheet-export-integrity`; rollback đơn giản bằng bỏ worktree/branch trước merge.
- Không migration DB, không schema persistence change, không production data write.
- Nếu media/math pipeline gây regression lớn, giữ renderer contract tests và revert riêng Task 6/7 mà không ảnh hưởng Task 2–5/8–9.

## Self-Review

- Spec coverage: toàn bộ P1/P2 audit được map vào Task 2–9; security/performance/build/document hard gates ở Task 10.
- Không có placeholder hoặc mục công việc còn bỏ ngỏ.
- Type/interface consistency: matching layout và media interfaces được định nghĩa trước consumers.
- Scope discipline: không refactor quiz player/editor trừ khi pure geometry extraction được GitNexus chứng minh là cần thiết và an toàn.
