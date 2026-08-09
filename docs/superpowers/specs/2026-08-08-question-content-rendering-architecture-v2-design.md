# TôHiệuQuiz Question Content & Rendering Architecture v2

**Status:** Long-term architecture roadmap — amended after Question Presentation v1 production release. Do not implement the full v2 contract as one project.

**Date:** 2026-08-08

**Scope owner:** TôHiệuQuiz question authoring, import, persistence, rendering, review, and backward compatibility.

---

## 0. Production baseline amendment — 2026-08-08

Production has already shipped a narrower and safer first step:

```text
question            -> plain text + TeX compatibility/search/grading/AI
question_rich_text  -> QuestionRichTextEnvelopeV1 presentation JSON
```

Migration `0064_add_question_rich_text.sql`, Tiptap authoring, teacher preview, student player, practice and live-exam read paths are released. This baseline is governed by `docs/decisions/ADR-001-question-presentation-dual-representation.md`.

Therefore this document is **not** an instruction to immediately replace production with `content_json + answer_key_json + explanation_json` or a new Question Contract. Those sections are target-state design material and must pass a fresh decision gate after incremental renderer/presentation phases.

Current implementation sequence is defined by:

- `docs/superpowers/plans/2026-08-08-question-presentation-evolution-roadmap.md`
- `docs/superpowers/plans/2026-08-08-question-presentation-integrity-review-rendering.md`

**2026-08-09 update:** the integrity/historical-review phase described below was implemented by PR #92, merged as `406973f`, and released to the production Worker. The full Question Contract v2 remains conditional/deferred; this release does not activate it.

Key amendment:

1. harden `question <-> questionRichText` consistency first: validate rich separately, derive plain, remove presentation JSON from the semantic math/scoring clone, then compare normalized plain projections;
2. harden the shared rich renderer so formatting marks cannot split one delimited math expression into multiple invalid renderer fragments;
3. preserve `questionRichText` in new authoritative result snapshots only when final serialized answers-with-rich stays within a 1.500.000-byte D1-aware budget, and treat historical snapshots as presentation authority;
4. degrade over-budget rich candidates to historical plain rather than blocking submission, and never borrow current quiz rich content into old snapshots;
5. preserve the existing `QUIZ_HAS_SUBMISSIONS` structural-edit guard; a future relaxation of that guard would require a separate answer-key-history decision;
6. expand rich fields incrementally;
7. evolve System Prompt/import only after runtime field support exists;
8. implement full Question Contract v2 only if later production evidence justifies it.

---

## 1. Objective

Xây dựng một kiến trúc nội dung câu hỏi thống nhất cho TôHiệuQuiz để:

1. Giáo viên soạn câu hỏi bằng Rich Text Editor nhẹ, không cần biết HTML hoặc LaTeX chuyên sâu.
2. System Prompt sinh JSON có cấu trúc, không trộn HTML/Markdown/MathJax delimiter vào chuỗi văn bản.
3. Cùng một nội dung được render nhất quán ở giáo viên, học sinh, xem lại bài, kết quả, kho câu hỏi và bản in.
4. Dữ liệu đáp án đúng được tách khỏi dữ liệu hiển thị để giảm nguy cơ lộ đáp án cho học sinh.
5. 13 dạng câu hỏi AI chính thức dùng một contract duy nhất, ID-based và dễ validate.
6. Câu hỏi cũ tiếp tục hoạt động mà không cần migration toàn bộ ngay lập tức.
7. Không làm thay đổi scoring engine hiện hành trong rollout đầu tiên.

### Success statement

> Giáo viên chỉ cần nhập nội dung; TôHiệuQuiz chịu trách nhiệm về cấu trúc, hiển thị, công thức, responsive, bảo mật và khả năng tương thích.

---

## 2. Source requirements được giữ nguyên

Thiết kế này kế thừa các quyết định đã chốt trong tài liệu **Manual Quiz Rich Text Editor**:

- Editor là một **Focused Educational Rich Text Editor**, không phải Word clone.
- Enter tạo paragraph; Shift+Enter tạo line break.
- Hỗ trợ định dạng cơ bản, alignment, list, math, image, preview.
- Preview giáo viên phải dùng cùng renderer thực tế của học sinh.
- Không lưu HTML tự do hoặc CSS tùy ý.
- Dữ liệu có cấu trúc được ưu tiên.
- Câu hỏi text/LaTeX cũ vẫn phải mở, sửa và hiển thị.
- Rich Text Editor là khối dùng chung, rollout ban đầu tập trung vào Soạn đề thủ công.

---

## 2A. Assumptions khóa cho spec này

1. D1 table `questions` và scoring contract hiện tại phải tiếp tục hoạt động trong toàn bộ giai đoạn chuyển tiếp.
2. `QUIZ_SCORING_ENGINE_VERSION = 2.0.0` và `QUIZ_ANSWER_SCHEMA_VERSION = 2` không thay đổi chỉ vì đổi content/rendering architecture.
3. Core 13 là contract AI chính thức; `ERROR_CORRECTION` và `GEOMETRY` là extension hiện hữu cần bảo toàn.
4. Chưa khóa editor framework. Tiptap/Lexical/ProseMirror hoặc lựa chọn khác chỉ là implementation adapter; thêm dependency cần approval riêng.
5. Rich Content v1 không giải quyết shared stimulus cross-question, collaboration hoặc arbitrary Word-like layout.
6. Server/Worker vẫn là security và grading authority; frontend renderer không phải security boundary.
7. Khi v2 authoring bắt đầu ghi các feature không biểu diễn được ở legacy renderer (color/highlight/list/alignment), full-fidelity rollback phải dựa vào việc giữ **v2 read-path** ổn định; legacy shadow chủ yếu bảo đảm scoring, compatibility và degraded presentation fallback.

---

## 3. Historical pre-Presentation-v1 findings từ repository

### 3.1 Frontend domain hiện tại

`src/types/domain.types.ts` hiện dùng union câu hỏi dạng flat string:

- `question`, `mainQuestion`, `text`, `sentence`, `passage`, `riddleLines`, ... là string.
- `options`, `items`, `pairs`, `blanks`, `categories` có nhiều shape khác nhau.
- MathJax nằm trực tiếp trong string, thường qua `$...$` / `$$...$$`.
- Formatting cơ bản hiện được giải bằng `SafeFormattedText` với allowlist HTML nhỏ.

### 3.2 Renderer hiện tại

`src/features/quiz-player/components/QuestionRenderer` đã là renderer chính cho:

- StudentView.
- Live Exam.
- component tests / visual regression.

Nhưng review/result vẫn có pipeline riêng tại `src/components/common/QuestionReview`.

Do đó hiện tồn tại ít nhất hai rendering trees:

```text
Student / Live Exam
  -> QuestionRenderer
  -> SmartText / MathSpan / SafeFormattedText

Result / Teacher review
  -> QuestionReview
  -> type-specific Review templates
  -> MathContent / MathSpan
```

Đây là nguồn tiềm ẩn của rendering drift.

### 3.3 Manual editor hiện tại

`QuestionEditorForm` đang dùng `MathTextarea` cho nội dung chính và editor riêng cho từng type. Nội dung vẫn là string, nên formatting/rich structure chưa có contract độc lập.

### 3.4 JSON importer hiện tại

`jsonQuestionImporter.ts` hỗ trợ aliases cho Core 13 nhưng phải normalize nhiều biến thể:

- `SINGLE_CHOICE -> MCQ`
- `MULTIPLE_CHOICE -> MULTIPLE_SELECT`
- `DRAG_DROP_FILL -> DRAG_DROP`
- `WORD_ASSEMBLY -> WORD_SCRAMBLE`

Importer hiện còn phải suy diễn type, map snake_case/camelCase, map answer theo label/text, và xử lý LaTeX trong chuỗi.

### 3.5 Persistence hiện tại

D1 table `questions` đang lưu nhiều cột flat:

```text
question
options
correct_answer
items
text_field
blanks
distractors
sentence
words
correct_word_indexes
image
explanation
...
```

`mapQuestionForSave()` dual-purpose normalize math + scoring contract rồi serialize theo type.

### 3.6 Scoring hiện tại

Scoring engine đã có contract riêng:

```text
QUIZ_SCORING_ENGINE_VERSION = 2.0.0
QUIZ_ANSWER_SCHEMA_VERSION = 2
```

Rollout v2 nội dung **không được làm lại scoring engine**. Rendering/content contract và answer submission contract là hai boundary độc lập.

---

## 4. Core design decision

### 4.1 Chosen approach — Structured content + semantic interaction contract

TôHiệuQuiz v2 dùng ba lớp:

```text
Question Contract v2
        |
        v
Normalization / Compatibility
        |
        v
Renderable Question v2
        |
        +--------------------------+
        |                          |
        v                          v
RichContentRenderer        InteractionRenderer
        |                          |
        +-------------+------------+
                      v
               QuestionRenderer
                      |
     +----------------+------------------+
     |                |                  |
 Teacher Preview   Student          Review / Result
```

### 4.2 Alternatives considered

#### Alternative A — tiếp tục string + HTML allowlist + MathJax delimiter

**Pros**
- Ít migration nhất.
- Có thể tận dụng `SafeFormattedText`.

**Cons**
- HTML, text và TeX tiếp tục trộn trong một chuỗi.
- Renderer phải đoán nội dung.
- Khó làm Enter/paragraph/list/image đúng nghĩa.
- AI dễ sinh markup sai.
- Dễ lặp lại lỗi `<strong>` / `$50$` ở các surface mới.

**Decision:** Rejected as long-term architecture. Chỉ giữ cho legacy adapter.

#### Alternative B — lưu JSON native của một editor framework cụ thể

Ví dụ ProseMirror/Tiptap/Lexical document JSON trực tiếp làm domain model.

**Pros**
- Editor triển khai nhanh hơn.
- Framework có sẵn history, selection, paste.

**Cons**
- Domain data bị khóa vào editor implementation.
- Đổi editor sau này trở thành data migration.
- System Prompt phải biết schema vendor-specific.
- Renderer server/print/PDF bị phụ thuộc framework.

**Decision:** Rejected.

#### Alternative C — TôHiệuQuiz Rich Content Schema riêng

Editor framework chỉ là adapter UI; dữ liệu canonical thuộc TôHiệuQuiz.

**Pros**
- Ổn định, vendor-neutral.
- AI dễ sinh schema nhỏ và rõ.
- Renderer, print, API, editor dùng chung contract.
- Backward compatibility kiểm soát được.

**Decision:** **Selected.**

---

# PART A — VERSIONING & TERMINOLOGY

## 5. Version model

Ba version độc lập:

### 5.1 `contractVersion`

Version của Question JSON envelope.

```text
Question Contract v2 -> contractVersion: 2
```

### 5.2 `RichContent.version`

Version của document content model.

```text
Rich Content v1 -> version: 1
```

### 5.3 `answerSchemaVersion`

Version của student answer/scoring contract.

Rollout này giữ:

```text
answerSchemaVersion = 2
```

Không tăng version scoring chỉ vì đổi cách hiển thị.

---

## 6. Core 13 question types

Question Contract v2 dùng **chính canonical runtime names**, không dùng alias AI riêng:

1. `MCQ`
2. `TRUE_FALSE`
3. `SHORT_ANSWER`
4. `MATCHING`
5. `MULTIPLE_SELECT`
6. `DRAG_DROP`
7. `ORDERING`
8. `IMAGE_QUESTION`
9. `DROPDOWN`
10. `UNDERLINE`
11. `CATEGORIZATION`
12. `WORD_SCRAMBLE`
13. `RIDDLE`

### 6.1 Legacy AI aliases vẫn được chấp nhận ở import boundary

```text
SINGLE_CHOICE      -> MCQ
MULTIPLE_CHOICE    -> MULTIPLE_SELECT
DRAG_DROP_FILL     -> DRAG_DROP
WORD_ASSEMBLY      -> WORD_SCRAMBLE nếu ghép ký tự/âm tiết
WORD_ASSEMBLY      -> ORDERING nếu sắp xếp từ/cụm thành câu
```

### 6.2 Existing runtime extensions

Repository hiện còn:

- `ERROR_CORRECTION`
- `GEOMETRY`

Hai type này **không bị xóa**.

Chúng được xem là extension ngoài Core 13:

```text
QuestionRenderer registry
  Core 13
  + ERROR_CORRECTION extension
  + GEOMETRY extension
```

System Prompt v2 Core 13 không tự sinh hai type này trong phase đầu.

---

# PART B — RICH CONTENT SCHEMA v1

## 7. Design principles

Rich Content v1 phải:

- Không chứa raw HTML.
- Không chứa Markdown formatting.
- Không chứa CSS tự do.
- Không chứa font family/font size/margin/padding tùy ý.
- Math được lưu bằng node riêng.
- Image được lưu bằng reference, không nhúng binary mới vào JSON.
- Có thể render mà không cần editor framework.
- Có thể serialize bằng JSON chuẩn.
- Có giới hạn kích thước và node count.

---

## 8. Primitive types

```ts
type RichAlign = 'left' | 'center' | 'right';

type TextColorToken =
  | 'default'
  | 'muted'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger';

type HighlightToken =
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink';
```

Không chấp nhận hex/RGB trực tiếp trong document.

---

## 9. Text marks

```ts
interface RichTextMarks {
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
  color?: TextColorToken;
  highlight?: HighlightToken;
}
```

Empty/false marks không cần serialize.

---

## 10. Inline nodes

```ts
type RichInlineNode =
  | RichTextNode
  | RichInlineMathNode
  | RichLineBreakNode;

interface RichTextNode {
  type: 'text';
  text: string;
  marks?: RichTextMarks;
}

interface RichInlineMathNode {
  type: 'math';
  latex: string;
}

interface RichLineBreakNode {
  type: 'line_break';
}
```

### Rules

- `text` không dùng HTML tags.
- `text` không dùng `$...$` hoặc `$$...$$` để biểu diễn math.
- New paragraph không dùng `\n`; dùng block mới.
- Shift+Enter dùng `line_break`.
- Math chỉ xuất hiện trong `math.latex` hoặc `math_block.latex`.

---

## 11. Rich inline content

Dùng cho option, label và các nội dung compact.

```ts
interface RichInlineContentV1 {
  version: 1;
  nodes: RichInlineNode[];
}
```

---

## 12. Image reference

```ts
interface RichImageRefV1 {
  src: string;
  alt: string;
  source?: 'upload' | 'library' | 'external';
  width?: 'small' | 'medium' | 'large' | 'full';
}
```

### Image rules

- `alt` bắt buộc với image mới.
- Không cho lưu CSS width/height tùy ý.
- Không cho AI bịa `src`.
- System Prompt chỉ được dùng image URL/asset đã được input cung cấp.
- New v2 content không lưu base64 image; legacy base64 vẫn đọc được qua compatibility adapter.
- Upload mới đi qua storage flow hiện hành/R2.

---

## 13. Block nodes

```ts
type RichBlockNode =
  | RichParagraphNode
  | RichListNode
  | RichMathBlockNode
  | RichImageBlockNode;

interface RichParagraphNode {
  type: 'paragraph';
  align?: RichAlign;
  children: RichInlineNode[];
}

interface RichListNode {
  type: 'bullet_list' | 'ordered_list';
  items: Array<{
    id: string;
    content: RichInlineContentV1;
  }>;
}

interface RichMathBlockNode {
  type: 'math_block';
  latex: string;
  align?: RichAlign;
}

interface RichImageBlockNode {
  type: 'image';
  image: RichImageRefV1;
  align?: RichAlign;
  caption?: RichInlineContentV1;
}
```

Nested lists không thuộc Rich Content v1.

---

## 14. Rich document

```ts
interface RichDocumentV1 {
  version: 1;
  blocks: RichBlockNode[];
}
```

---

## 15. Interactive template document

Một số type cần node tương tác nằm giữa text/math.

### 15.1 Slot node

```ts
interface RichSlotNode {
  type: 'slot';
  id: string;
  slotType: 'drag_drop' | 'dropdown';
}
```

### 15.2 Selectable node

```ts
interface RichSelectableNode {
  type: 'selectable';
  id: string;
  children: RichInlineNode[];
}
```

### 15.3 Template paragraph

```ts
type RichTemplateInlineNode =
  | RichInlineNode
  | RichSlotNode
  | RichSelectableNode;

interface RichTemplateParagraphNode {
  type: 'paragraph';
  align?: RichAlign;
  children: RichTemplateInlineNode[];
}

interface RichTemplateDocumentV1 {
  version: 1;
  blocks: RichTemplateParagraphNode[];
}
```

Rich Content v1 cố ý giới hạn interactive template ở paragraph. Nếu cần ảnh, list hoặc formula block làm dữ kiện, đặt chúng trong `context`/`prompt`; slot/selectable chỉ nằm trong `RichTemplateDocumentV1`. Điều này giữ interaction tree nhỏ, dễ validate và không tạo nested interactive layout khó dùng trên mobile.

`RichTemplateDocumentV1` chỉ cho phép interactive nodes ở type đã khai báo tương ứng.

---

## 16. Content capability profiles

### FULL

Cho phép:

- paragraph
- line break
- bold / italic / underline / strike
- tokenized text color / highlight
- left / center / right
- bullet list / ordered list
- inline math / block math
- image

### LIMITED

Cho phép:

- text
- line break khi field cho phép
- bold / italic / underline
- inline math
- image chỉ ở type có contract cho phép

Không cho:

- arbitrary alignment
- list
- block math
- text color/highlight mặc định

### PLAIN

String semantic, không formatting.

Dùng cho:

- accepted answers
- IDs
- internal references
- search normalization
- grading values

---

## 17. Field capability matrix

| Field | Profile |
|---|---|
| Question instruction | LIMITED |
| Question context/passage | FULL |
| Question prompt/stem | FULL |
| Explanation | FULL |
| MCQ / Multi-select option | LIMITED |
| TRUE_FALSE item | LIMITED |
| Matching left/right | LIMITED |
| Drag/drop choice | LIMITED |
| Dropdown option | LIMITED |
| Ordering item | LIMITED |
| Categorization category/item | LIMITED |
| Underline selectable content | LIMITED |
| Word scramble unit | LIMITED |
| Riddle hint/label | LIMITED |
| Correct/accepted answer value | PLAIN |

---

# PART C — QUESTION CONTRACT v2

## 18. Canonical type union và root envelope

```ts
type CoreQuestionTypeV2 =
  | 'MCQ'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'MATCHING'
  | 'MULTIPLE_SELECT'
  | 'DRAG_DROP'
  | 'ORDERING'
  | 'IMAGE_QUESTION'
  | 'DROPDOWN'
  | 'UNDERLINE'
  | 'CATEGORIZATION'
  | 'WORD_SCRAMBLE'
  | 'RIDDLE';

type AuthoringQuestionV2 =
  | MCQQuestionV2
  | TrueFalseQuestionV2
  | ShortAnswerQuestionV2
  | MatchingQuestionV2
  | MultipleSelectQuestionV2
  | DragDropQuestionV2
  | OrderingQuestionV2
  | ImageQuestionV2
  | DropdownQuestionV2
  | UnderlineQuestionV2
  | CategorizationQuestionV2
  | WordScrambleQuestionV2
  | RiddleQuestionV2;

interface QuestionSetEnvelopeV2 {
  contractVersion: 2;
  questions: AuthoringQuestionV2[];
}
```

JSON paste v2 MUST dùng envelope này.

Legacy bare array vẫn được importer cũ/compatibility path chấp nhận.

---

## 19. Common question fields

```ts
interface QuestionV2Base {
  id: string;
  type: CoreQuestionTypeV2;

  instruction?: RichInlineContentV1;
  context?: RichDocumentV1;
  prompt: RichDocumentV1;

  explanation?: RichDocumentV1;

  metadata?: {
    difficulty?: 1 | 2 | 3;
    points?: number;
    subject?: string;
    skillCode?: string;
    subskillCode?: string;
    tags?: string[];
  };
}
```

### Rendering order

```text
instruction
context
prompt
interaction
```

`context` dùng cho passage, dữ kiện chung hoặc đoạn đọc hiểu trong phạm vi một question.

Shared stimulus cross-question không thuộc v2; có thể bổ sung `stimulusRef` ở version sau mà không phá contract.

---

## 20. Choice content

```ts
interface ChoiceV2 {
  id: string;
  content: RichInlineContentV1;
  image?: RichImageRefV1;
}
```

ID là canonical identity. Text không bao giờ là identity.

---

# PART D — 13 QUESTION TYPE CONTRACTS

## 21. MCQ

```ts
interface MCQQuestionV2 extends QuestionV2Base {
  type: 'MCQ';
  interaction: {
    options: ChoiceV2[]; // 2..6
  };
  answerKey: {
    optionId: string;
  };
}
```

Rules:

- option IDs unique.
- `answerKey.optionId` phải tồn tại.
- System Prompt mặc định tạo 4 options nếu user không yêu cầu khác.

---

## 22. MULTIPLE_SELECT

```ts
interface MultipleSelectQuestionV2 extends QuestionV2Base {
  type: 'MULTIPLE_SELECT';
  interaction: {
    options: ChoiceV2[]; // 2..6
  };
  answerKey: {
    optionIds: string[];
  };
}
```

Rules v2 mới:

- `optionIds` unique.
- tối thiểu 2 correct options.
- tất cả IDs phải tồn tại trong options.

Legacy question có một correct option vẫn render qua adapter và được gắn compatibility warning; không tự mutate dữ liệu cũ.

---

## 23. TRUE_FALSE

```ts
interface TrueFalseQuestionV2 extends QuestionV2Base {
  type: 'TRUE_FALSE';
  interaction: {
    items: Array<{
      id: string;
      content: RichInlineContentV1;
    }>;
  };
  answerKey: {
    values: Record<string, boolean>;
  };
}
```

Core schema:

- 1..10 items để giữ tương thích manual/legacy.
- key phải có đúng một boolean cho mỗi item.

AI generation profile:

- **exactly 4 related items** theo rule hiện hành của TôHiệuQuiz.

Correctness không được lưu trong `interaction.items`.

---

## 24. SHORT_ANSWER

```ts
interface ShortAnswerQuestionV2 extends QuestionV2Base {
  type: 'SHORT_ANSWER';
  interaction: {
    input: {
      mode: 'text';
      maxLength?: number;
    };
  };
  answerKey: {
    acceptedValues: string[];
    normalization?: {
      trim?: true;
      collapseWhitespace?: true;
      caseSensitive?: boolean;
      unicode?: 'NFC';
    };
  };
}
```

Default normalization:

```text
trim = true
collapseWhitespace = true
caseSensitive = false
unicode = NFC
```

Numeric tolerance/fuzzy matching không thuộc v2.

---

## 25. MATCHING

```ts
interface MatchingQuestionV2 extends QuestionV2Base {
  type: 'MATCHING';
  interaction: {
    leftItems: ChoiceV2[];
    rightItems: ChoiceV2[];
  };
  answerKey: {
    pairs: Record<string, string>; // leftId -> rightId
  };
}
```

Rules:

- 2..10 pairs.
- IDs unique toàn interaction.
- mỗi left item map đúng một right item.
- Core v2 dùng one-to-one matching.
- Student DTO có thể shuffle rightItems mà không thay answerKey semantics.

---

## 26. DRAG_DROP

```ts
interface DragDropQuestionV2 extends QuestionV2Base {
  type: 'DRAG_DROP';
  interaction: {
    template: RichTemplateDocumentV1;
    choices: ChoiceV2[];
  };
  answerKey: {
    values: Record<string, string>; // slotId -> choiceId
  };
}
```

Rules:

- template chỉ chứa `slotType: 'drag_drop'`.
- mọi slot phải có answerKey.
- every answerKey choice ID phải tồn tại.
- distractor = choice không xuất hiện trong answerKey.
- choice instance được dùng một lần.
- nếu hai blank có cùng text đúng như `50`, System Prompt tạo **hai choice IDs khác nhau**, không reuse một ID.

Không còn placeholder kiểu `[50]` hay `{{blank1}}` trong text canonical v2.

---

## 27. ORDERING

```ts
interface OrderingQuestionV2 extends QuestionV2Base {
  type: 'ORDERING';
  interaction: {
    items: ChoiceV2[];
  };
  answerKey: {
    order: string[]; // item IDs
  };
}
```

Rules:

- tối thiểu 2 items.
- `order` chứa mỗi item ID đúng một lần.
- không dùng array index làm canonical identity.

---

## 28. IMAGE_QUESTION

```ts
interface ImageQuestionV2 extends QuestionV2Base {
  type: 'IMAGE_QUESTION';
  interaction: {
    promptImage: RichImageRefV1;
    options: ChoiceV2[];
  };
  answerKey: {
    optionId: string;
  };
}
```

Rules:

- `promptImage` bắt buộc.
- alt bắt buộc.
- option có thể có text, image, hoặc cả hai.
- System Prompt không tự tạo URL ảnh giả.

---

## 29. DROPDOWN

```ts
interface DropdownQuestionV2 extends QuestionV2Base {
  type: 'DROPDOWN';
  interaction: {
    template: RichTemplateDocumentV1;
    slots: Array<{
      id: string;
      options: ChoiceV2[];
    }>;
  };
  answerKey: {
    values: Record<string, string>; // slotId -> optionId
  };
}
```

Rules:

- template chỉ chứa `slotType: 'dropdown'`.
- mỗi slot có ít nhất 2 options.
- correct option ID phải thuộc options của chính slot đó.

AI generation profile:

- ưu tiên 4 dropdowns khi user yêu cầu dạng nhiều ý theo chuẩn hiện hành.

---

## 30. UNDERLINE

```ts
interface UnderlineQuestionV2 extends QuestionV2Base {
  type: 'UNDERLINE';
  interaction: {
    template: RichTemplateDocumentV1;
  };
  answerKey: {
    selectedIds: string[];
  };
}
```

Rules:

- template dùng `selectable` nodes.
- `selectedIds` chỉ chứa selectable IDs.
- không dùng word index làm canonical v2 identity.
- multi-word selectable segment được hỗ trợ.

Legacy `sentence + words + correctWordIndexes` được adapter chuyển thành selectable nodes theo best-effort deterministic mapping.

---

## 31. CATEGORIZATION

```ts
interface CategorizationQuestionV2 extends QuestionV2Base {
  type: 'CATEGORIZATION';
  interaction: {
    categories: ChoiceV2[];
    items: ChoiceV2[];
  };
  answerKey: {
    categoriesByItemId: Record<string, string>;
  };
}
```

Rules:

- ít nhất 2 categories.
- mỗi item map đúng một category.
- categoryId không nằm trong visible item data.

---

## 32. WORD_SCRAMBLE

```ts
interface WordScrambleQuestionV2 extends QuestionV2Base {
  type: 'WORD_SCRAMBLE';
  interaction: {
    units: ChoiceV2[];
    hint?: RichInlineContentV1;
  };
  answerKey: {
    order: string[]; // unit IDs
    value: string;
  };
}
```

Rules:

- dùng cho ghép chữ cái/âm tiết thành từ.
- nếu nhiệm vụ là sắp xếp từ/câu thành câu hoàn chỉnh, dùng `ORDERING`.
- mỗi repeated letter vẫn có ID riêng.

---

## 33. RIDDLE

```ts
interface RiddleQuestionV2 extends QuestionV2Base {
  type: 'RIDDLE';
  interaction: {
    input: {
      mode: 'text';
      label?: RichInlineContentV1;
    };
    hint?: RichInlineContentV1;
  };
  answerKey: {
    acceptedValues: string[];
    answerType?: 'original' | 'transformed';
  };
}
```

Riddle lines nằm trong `prompt` dưới dạng paragraphs / line breaks; không cần field `riddleLines` mới.

---

# PART E — SYSTEM PROMPT JSON v2

## 34. Canonical AI output

System Prompt v2 chỉ trả **JSON object** theo shape:

```json
{
  "contractVersion": 2,
  "questions": []
}
```

Không code fence.
Không Markdown ngoài JSON.
Không commentary.

---

## 35. AI formatting rules

System Prompt MUST nêu rõ:

### 35.1 Không HTML

Không sinh:

```text
<strong>
<em>
<u>
<br>
<p>
<span>
style=
```

### 35.2 Không Markdown formatting

Không sinh formatting bằng:

```text
**bold**
*italic*
_word_
```

trong `text` node.

### 35.3 Math chỉ bằng node math

Sai:

```json
{"type":"text","text":"Tính $24 \\div 6$."}
```

Đúng:

```json
{
  "type": "paragraph",
  "children": [
    {"type":"text","text":"Tính "},
    {"type":"math","latex":"24 \\div 6"},
    {"type":"text","text":"."}
  ]
}
```

Trong **raw JSON**, LaTeX backslash vẫn phải escape theo JSON:

```json
{"type":"math","latex":"\\frac{3}{4}"}
```

Sau `JSON.parse`, renderer nhận:

```text
\frac{3}{4}
```

### 35.4 Paragraph/line break là structural

- Paragraph mới -> block mới.
- Shift+Enter semantics -> `{ "type": "line_break" }`.
- Không dùng nhiều `\n\n\n` để căn bố cục.

### 35.5 ID rules

ID phải:

- unique trong question.
- ngắn, deterministic trong generated JSON.
- dùng prefix theo semantic role.

Ví dụ:

```text
q001
opt-a
opt-b
tf-1
left-1
right-1
slot-1
choice-1
cat-1
item-1
unit-1
select-1
```

Answer key luôn tham chiếu ID, không tham chiếu text/label.

### 35.6 Visible data không chứa correctness

Không được sinh:

```json
{"id":"tf-1","content":{},"isCorrect":true}
```

Không được sinh:

```json
{"id":"item-1","content":{},"categoryId":"cat-a"}
```

Correctness chỉ nằm trong `answerKey`.

### 35.7 Color/highlight

AI không tự dùng color/highlight nếu user không yêu cầu.

Khi cần, chỉ dùng token được schema cho phép.

### 35.8 Image

AI chỉ đưa image node/URL nếu:

- URL/asset được user cung cấp; hoặc
- hệ thống generation pipeline đã cung cấp asset hợp lệ.

Không bịa URL.

---

## 36. Full System Prompt example — MCQ

```json
{
  "contractVersion": 2,
  "questions": [
    {
      "id": "Q001",
      "type": "MCQ",
      "instruction": {
        "version": 1,
        "nodes": [
          {
            "type": "text",
            "text": "Chọn đáp án đúng.",
            "marks": { "bold": true }
          }
        ]
      },
      "prompt": {
        "version": 1,
        "blocks": [
          {
            "type": "paragraph",
            "children": [
              { "type": "text", "text": "Tính " },
              { "type": "math", "latex": "24 \\div 6" },
              { "type": "text", "text": "." }
            ]
          }
        ]
      },
      "interaction": {
        "options": [
          { "id": "opt-a", "content": { "version": 1, "nodes": [{ "type": "text", "text": "3" }] } },
          { "id": "opt-b", "content": { "version": 1, "nodes": [{ "type": "text", "text": "4" }] } },
          { "id": "opt-c", "content": { "version": 1, "nodes": [{ "type": "text", "text": "5" }] } },
          { "id": "opt-d", "content": { "version": 1, "nodes": [{ "type": "text", "text": "6" }] } }
        ]
      },
      "answerKey": {
        "optionId": "opt-b"
      },
      "explanation": {
        "version": 1,
        "blocks": [
          {
            "type": "paragraph",
            "children": [
              { "type": "text", "text": "Ta có " },
              { "type": "math", "latex": "24 \\div 6 = 4" },
              { "type": "text", "text": "." }
            ]
          }
        ]
      },
      "metadata": {
        "difficulty": 1,
        "points": 1
      }
    }
  ]
}
```

---

## 37. Full System Prompt example — DRAG_DROP

```json
{
  "contractVersion": 2,
  "questions": [
    {
      "id": "Q010",
      "type": "DRAG_DROP",
      "prompt": {
        "version": 1,
        "blocks": [
          {
            "type": "paragraph",
            "children": [
              { "type": "text", "text": "Kéo số thích hợp vào mỗi ô trống." }
            ]
          }
        ]
      },
      "interaction": {
        "template": {
          "version": 1,
          "blocks": [
            {
              "type": "paragraph",
              "children": [
                { "type": "text", "text": "350 : 7 = " },
                { "type": "slot", "id": "slot-1", "slotType": "drag_drop" },
                { "type": "text", "text": " và 400 : 2 = " },
                { "type": "slot", "id": "slot-2", "slotType": "drag_drop" }
              ]
            }
          ]
        },
        "choices": [
          { "id": "choice-1", "content": { "version": 1, "nodes": [{ "type": "math", "latex": "50" }] } },
          { "id": "choice-2", "content": { "version": 1, "nodes": [{ "type": "math", "latex": "200" }] } },
          { "id": "choice-3", "content": { "version": 1, "nodes": [{ "type": "math", "latex": "94" }] } }
        ]
      },
      "answerKey": {
        "values": {
          "slot-1": "choice-1",
          "slot-2": "choice-2"
        }
      }
    }
  ]
}
```

Không còn `$50$`, `$200$` trong input value.
Renderer nhận math node trực tiếp.

---

# PART F — DTO & SECURITY BOUNDARIES

## 38. Không dùng một DTO cho mọi audience

Question v2 phải có ba boundary rõ:

### 38.1 AuthoringQuestionV2

Dành cho teacher/admin editor/import. Đây là discriminated union Core 13 đã khai báo ở §18 và có đầy đủ:

- prompt/content.
- interaction.
- answerKey.
- explanation.
- metadata.

### 38.2 StudentQuestionV2

Dành cho student interactive/live exam/public practice. Contract TypeScript phải được tạo theo **allowlist projection**, không phải deep-delete runtime ad hoc:

```ts
type ToStudentQuestion<Q extends AuthoringQuestionV2> =
  Q extends unknown
    ? Omit<Q, 'answerKey' | 'explanation'>
    : never;

type StudentQuestionV2 = ToStudentQuestion<AuthoringQuestionV2>;
```

Do `interaction` của v2 không chứa correctness, projection này giữ nguyên discriminated union theo `type` nhưng loại hoàn toàn private key/explanation khỏi DTO học sinh.

StudentQuestionV2 có:

- instruction/context/prompt.
- interaction.
- public metadata cần thiết.

Không có:

- `answerKey`.
- `explanation` trước policy cho phép.
- any hidden correct mapping.

Worker implementation vẫn phải **construct DTO positively** từ các field được phép và validate output; utility type trên chỉ khóa compile-time shape.

### 38.3 ReviewQuestionV2

Review là envelope, không phải một bản copy thứ ba của question schema:

```ts
type ReviewStatus = 'correct' | 'wrong' | 'skipped' | 'invalid' | 'voided';

interface ReviewQuestionV2 {
  question: StudentQuestionV2;
  studentAnswer: unknown;
  grading: {
    status: ReviewStatus;
    isCorrect: boolean;
    issueCode?: string;
  };
  explanation?: RichDocumentV1;
  answerFeedback?: {
    // Chỉ server tạo sau khi policy cho phép; không lấy từ client.
    correctAnswerProjection?: unknown;
  };
  teacherAnswerKey?: AuthoringQuestionV2['answerKey'];
}
```

Rules:

- `teacherAnswerKey` chỉ có ở teacher/admin audience được phép.
- student post-submit review không mặc định có `teacherAnswerKey`.
- `answerFeedback` là server-produced projection phục vụ hiển thị, không phải authoring key thô.
- `grading` dùng authoritative server result; renderer không tự chấm lại bằng presentation data.

Student review không mặc định nhận raw authoring object.

---

## 39. Security invariant

> Không một field visible trong StudentQuestionV2 được phép suy ra trực tiếp đáp án đúng chỉ bằng cách đọc JSON payload.

Cụ thể:

- TRUE_FALSE item không có `isCorrect`.
- CATEGORIZATION item không có `categoryId` đúng.
- DRAG_DROP slot không chứa correct choice.
- MATCHING public DTO không chứa pair mapping nguyên bản.
- ORDERING public items không mang rank đúng.
- UNDERLINE selectable nodes không mang `correct` flag.

Server sanitation là boundary bắt buộc, không dựa vào UI hide.

---

# PART G — RENDERING ARCHITECTURE

## 40. Shared renderer hierarchy

```text
QuestionRendererV2
|
+-- QuestionChrome
|   +-- number
|   +-- progress/status
|
+-- QuestionContent
|   +-- InstructionRenderer
|   +-- RichContentRenderer(context)
|   +-- RichContentRenderer(prompt)
|
+-- QuestionInteractionRenderer
|   +-- MCQ
|   +-- TRUE_FALSE
|   +-- SHORT_ANSWER
|   +-- MATCHING
|   +-- MULTIPLE_SELECT
|   +-- DRAG_DROP
|   +-- ORDERING
|   +-- IMAGE_QUESTION
|   +-- DROPDOWN
|   +-- UNDERLINE
|   +-- CATEGORIZATION
|   +-- WORD_SCRAMBLE
|   +-- RIDDLE
|   +-- extensions
|
+-- QuestionFeedbackRenderer (optional)
    +-- correct/wrong/skipped
    +-- student answer
    +-- correct answer
    +-- explanation
```

---

## 41. RichContentRenderer

Một renderer duy nhất cho Rich Content v1.

Responsibilities:

- text marks.
- paragraphs.
- alignment.
- line breaks.
- lists.
- inline math.
- block math.
- images.
- responsive overflow behavior.

Không chứa:

- scoring logic.
- answer state.
- question-type logic.
- teacher permission logic.

---

## 42. Template renderer

`RichTemplateRenderer` extends content rendering bằng slot registry:

```ts
interface TemplateSlotRenderer {
  renderSlot(node: RichSlotNode): ReactNode;
  renderSelectable(node: RichSelectableNode): ReactNode;
}
```

DRAG_DROP, DROPDOWN và UNDERLINE dùng cùng template pipeline.

Math bên trong choice/slot/selectable vẫn đi qua RichContentRenderer.

---

## 43. Question renderer modes

```ts
type QuestionRenderMode =
  | 'preview'
  | 'interactive'
  | 'review'
  | 'print';
```

### preview

- Teacher preview.
- read-only interaction hoặc local sandbox interaction.
- không highlight đáp án đúng.
- nhìn giống student surface.

### interactive

- Student normal quiz.
- Live Exam.
- Practice/Homework.

### review

- Result detail.
- Teacher student-detail.
- Student post-submit review khi policy cho phép.

### print

- static rendering.
- không interactive widgets.
- answer key/explanation phụ thuộc print policy.

**Security không được quyết định bằng mode.**
Mode chỉ điều khiển presentation; API DTO quyết định dữ liệu nào renderer được nhận.

---

## 44. Surface migration matrix

| Surface | Target |
|---|---|
| Manual Quiz Editor Preview | `QuestionRendererV2 mode="preview"` |
| JSON Import Review | `QuestionRendererV2 mode="preview"` compact |
| Question Bank preview/detail | shared renderer / RichContentRenderer |
| StudentView | `QuestionRendererV2 mode="interactive"` |
| LiveExamQuiz | `QuestionRendererV2 mode="interactive"` |
| Teacher result detail | `QuestionRendererV2 mode="review"` |
| Student result review | `QuestionRendererV2 mode="review"` |
| Existing QuestionReview | deprecated after migration |
| Print/PDF | `QuestionRendererV2 mode="print"` or platform adapter consuming same Rich Content |

---

## 45. Preview invariant

Teacher preview MUST NOT có renderer riêng mô phỏng student UI.

Allowed:

```text
Editor state
  -> normalize draft
  -> StudentQuestion-like DTO
  -> QuestionRendererV2 mode=preview
```

Not allowed:

```text
EditorPreviewRenderer
StudentQuestionRenderer
```

với hai cây render độc lập.

---

# PART H — EDITOR ARCHITECTURE

## 46. Editor domain boundary

Rich Text Editor không lưu editor-vendor JSON.

```text
Editor framework state
       |
       v
EditorAdapter.toRichContent()
       |
       v
RichDocumentV1
```

Khi load:

```text
RichDocumentV1
       |
       v
EditorAdapter.fromRichContent()
       |
       v
Editor framework state
```

---

## 47. Editor profiles

```ts
type EditorProfile = 'full' | 'limited';
```

### `full`

Toolbar:

```text
Undo Redo
Bold Italic Underline Strike
Text Color Highlight
Align Left Center Right
Bullet Ordered
Formula
Image
Clear Formatting
```

### `limited`

Toolbar:

```text
Bold Italic Underline
Inline Formula
Clear Formatting
```

Image button chỉ bật ở field/type cho phép.

---

## 48. Enter semantics

### Enter

Creates:

```json
{"type":"paragraph","children":[]}
```

### Shift+Enter

Creates:

```json
{"type":"line_break"}
```

### List Enter

- current non-empty item -> new list item.
- empty item + Enter -> exit list.

### Formula block Enter

Cursor sau formula block -> new paragraph phía dưới.

---

# PART I — PERSISTENCE DESIGN

## 49. Additive D1 schema

Không phá các cột cũ trong phase đầu.

Đề xuất thêm vào `questions`:

```text
question_schema_version INTEGER NOT NULL DEFAULT 1
content_json            TEXT NULL
answer_key_json         TEXT NULL
explanation_json        TEXT NULL
```

### `content_json`

Chứa **student-renderable** structured data. Persistence wrapper được version riêng để sau này có thể đổi cách đóng gói mà không đồng nhất nó với `RichDocumentV1.version`:

```ts
interface StoredQuestionContentV1 {
  contentVersion: 1;
  instruction?: RichInlineContentV1;
  context?: RichDocumentV1;
  prompt: RichDocumentV1;
  interaction: AuthoringQuestionV2['interaction'];
}
```

Ví dụ serialized:

```json
{
  "contentVersion": 1,
  "prompt": { "version": 1, "blocks": [] },
  "interaction": {}
}
```

`contentVersion` là version của **stored content wrapper**; `RichDocumentV1.version`/`RichInlineContentV1.version` vẫn version từng document. Hai version có thể tiến hóa độc lập.

Không chứa answerKey.

### `answer_key_json`

Chứa private canonical key theo Question Contract v2.

### `explanation_json`

Chứa RichDocumentV1 cho explanation.

Tách riêng explanation giúp public/student route không vô tình gửi explanation chỉ vì trả `content_json`.

---

## 50. Why not one giant question JSON column

Một blob chứa cả visible content + answerKey + explanation làm tăng nguy cơ:

- public DTO trả nhầm nested answer data.
- sanitizer phải deep-delete theo từng type.
- future feature thêm nested correctness field dễ bị leak.

Vì vậy persistence split theo security boundary.

---

## 51. Dual-write strategy

Trong rollout đầu:

```text
AuthoringQuestionV2
   |
   +-> content_json
   +-> answer_key_json
   +-> explanation_json
   |
   +-> LegacyShadowMapper
           +-> question
           +-> options
           +-> correct_answer
           +-> items
           +-> text_field
           +-> blanks
           +-> ...
```

Legacy columns tiếp tục phục vụ:

- current scoring engine.
- old API/readers.
- compatibility fallback.
- degraded presentation fallback nếu cần khẩn cấp.

`LegacyShadowMapper` phải ưu tiên **semantic/scoring fidelity**. Với presentation feature mà renderer v1 không biểu diễn được (ví dụ token color, highlight, list structure, alignment), shadow dùng deterministic downgrade về biểu diễn gần nhất; canonical Rich Content v2 không bị mất.

Vì vậy sau khi production đã có v2-authored content, rollback chuẩn là **tắt v2 authoring/write rollout nhưng giữ stable v2 read-path**. Chỉ dùng legacy renderer fallback khi chấp nhận presentation degradation tạm thời.

Không cho client gửi legacy shadow và v2 fields như hai nguồn độc lập.

Server tạo shadow từ canonical v2 input.

---

## 52. Canonical ownership trong transition

### v2 row

Nếu:

```text
question_schema_version = 2
content_json valid
```

thì canonical rendering source = `content_json`.

Legacy fields là shadow.

### v1 row

Nếu không có v2 payload:

canonical rendering source = legacy fields qua adapter.

---

# PART J — BACKWARD COMPATIBILITY

## 53. No forced mass migration

Không bắt buộc migrate tất cả questions ngay khi release editor.

Read path:

```ts
function resolveRenderableQuestion(row): RenderableQuestionV2 {
  if (hasValidV2Payload(row)) return parseV2(row);
  return legacyQuestionToV2(row);
}
```

---

## 54. Lazy upgrade on edit

Khi giáo viên mở câu v1:

```text
legacy question
  -> legacyQuestionToV2
  -> Rich Editor
```

Nếu save:

```text
Rich v2
  -> save as question_schema_version=2
  -> write v2 columns
  -> generate legacy shadow
```

Nếu không save, DB không mutate.

---

## 55. Legacy adapter responsibilities

`legacyQuestionToV2()` xử lý:

- legacy question/mainQuestion.
- `$...$` / `$$...$$` -> math nodes.
- allowlisted `<strong>/<b>/<i>/<em>/<u>` -> text marks.
- newlines -> paragraphs/line_break theo deterministic rules.
- `image` + `imageAlt` -> image reference.
- per-type flat shape -> v2 interaction.
- legacy answer fields -> v2 answerKey for teacher-only normalization.

Unknown/unparseable markup:

- giữ dạng plain visible text.
- không thực thi raw HTML.
- phát compatibility warning.

---

## 56. Legacy adapter must be deterministic

Cùng một legacy question phải normalize thành cùng semantic v2 shape.

Không dùng random IDs khi đọc.

ID fallback derive từ:

```text
questionId + semantic path + index
```

Ví dụ:

```text
q123:option:0
q123:tf:2
q123:matching:left:1
q123:slot:3
```

---

## 57. Legacy types outside Core 13

`ERROR_CORRECTION` và `GEOMETRY`:

- tiếp tục dùng existing domain/scoring semantics.
- renderer registry nhận adapter/extension renderer.
- không bị convert cưỡng bức sang một trong Core 13.
- không được loại bỏ trong migration.

---

# PART K — SCORING & ANSWER CONTRACT

## 58. Scoring engine remains authoritative

Không thay `QUIZ_SCORING_ENGINE_VERSION` trong phase đầu chỉ vì Rich Content.

Server vẫn là authority cho grading.

---

## 59. V2 answerKey to current grading adapter

Question v2 dùng ID-based answer key để authoring/rendering rõ ràng.

Trước khi ghi legacy scoring shadow:

```text
V2 answerKey
   -> resolve IDs against interaction
   -> Current grading-compatible representation
   -> prepareQuestionScoringContractForSave()
```

Examples:

### MCQ

```text
optionId -> legacy A/B/C... shadow khi cần
```

### DRAG_DROP

```text
slotId -> choiceId -> choice display plain semantic value
```

### ORDERING

```text
ordered item IDs -> current order indexes/ranks
```

### UNDERLINE

```text
selected selectable IDs -> deterministic legacy word indexes khi legacy shadow cần
```

---

## 60. Rich formatting never participates in grading identity

Không compare serialized Rich Content JSON để chấm.

Answer identity luôn là:

- stable ID, hoặc
- normalized plain semantic value đối với text-answer types.

Formatting thay đổi không được làm thay correctness.

---

# PART L — VALIDATION

## 61. Boundary validation

Zod schemas cần tồn tại cho:

- `RichInlineContentV1`
- `RichDocumentV1`
- `RichTemplateDocumentV1`
- `QuestionSetEnvelopeV2`
- từng QuestionV2 type.

Validate tại:

1. Paste JSON/import boundary.
2. Teacher save API.
3. Worker read of `content_json` trước khi trust.
4. Legacy migration/backfill tool.

---

## 62. Structural limits

Rich Content v1 guardrails:

- max 100 blocks/document.
- max 200 inline/template nodes/paragraph.
- max 50 items/list.
- max 10,000 characters/text node.
- max 4,096 characters/math node.
- max 128 KB serialized RichDocument.
- max 256 KB total structured question payload excluding media binary.

Image binary không nằm trong JSON v2.

---

## 63. Validation error contract

Importer/editor phải trả lỗi dạng structured:

```ts
interface QuestionContentValidationIssue {
  questionId?: string;
  path: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}
```

Ví dụ:

```json
{
  "questionId": "Q010",
  "path": "interaction.answerKey.values.slot-2",
  "code": "UNKNOWN_CHOICE_ID",
  "message": "slot-2 tham chiếu choice không tồn tại.",
  "severity": "error"
}
```

Không chỉ báo chung `JSON không hợp lệ`.

---

# PART M — SANITIZATION & SECURITY

## 64. No raw HTML rendering

`RichContentRenderer` tạo React elements trực tiếp từ typed nodes.

Forbidden:

```text
dangerouslySetInnerHTML
raw style HTML
script
iframe
on* attributes
```

Legacy renderer có thể giữ SafeFormattedText trong compatibility layer, nhưng v2 nodes không đi qua HTML parser.

---

## 65. Paste sanitization

Paste từ Word/Google Docs/web:

```text
Clipboard HTML
  -> sanitizer
  -> supported semantic marks/blocks
  -> RichDocumentV1
```

Discard:

- font family.
- arbitrary font size.
- margins/padding.
- positioning.
- classes/styles không map được.
- scripts/event handlers.
- unsupported embeds.

---

## 66. Math security

- LaTeX được validate tại boundary hiện có hoặc service kế nhiệm.
- Renderer dùng MathJax assets được project quản lý, không phụ thuộc external CDN cho core production path.
- Không hỗ trợ raw TeX commands ngoài policy của math validation.

---

# PART N — RENDERING UX CONTRACT

## 67. Design-system controlled typography

Question JSON không lưu:

- font family.
- free font size.
- arbitrary margin/padding.
- absolute positioning.

Renderer quyết định typography từ Design System.

---

## 68. Responsive rules

### Math block

- không làm overflow toàn page.
- container có bounded horizontal overflow khi công thức không wrap an toàn.

### Image

```text
max-width: 100%
height: auto
```

### Lists

- indentation theo token.
- không nested trong v1.

### Interactive controls

- touch target tối thiểu theo accessibility guideline của project.
- math content không được ép vào native `<input value>` nếu cần typeset.

---

# PART O — OBSERVABILITY

## 69. Metrics/events cần có

Không log full student content.

Suggested events:

```text
question_content_v2_parse_success
question_content_v2_parse_failure
question_content_v2_legacy_fallback
question_content_v2_legacy_upgrade_saved
question_content_v2_render_fallback
question_content_v2_student_sanitized
question_content_v2_import_rejected
```

Dimensions an toàn:

```text
questionType
schemaVersion
surface
issueCode
renderPath=v1|v2
```

Không log:

- full question text.
- student free-text answer.
- answerKey.

---

# PART P — TESTING STRATEGY

## 70. Schema tests

Mỗi node/type cần:

- valid fixture.
- missing required field.
- invalid enum.
- duplicate ID.
- broken answer reference.
- oversized content.
- unknown node.

---

## 71. Rich renderer tests

Phải cover:

- paragraph + Enter semantics.
- Shift+Enter.
- bold/italic/underline/strike.
- color/highlight tokens.
- alignment.
- bullet/ordered list.
- inline math.
- block math.
- image + alt.
- text + math + formatting cùng paragraph.
- no raw HTML execution.

---

## 72. 13 type renderer contract tests

Mỗi type có một fixture canonical v2 chạy qua:

```text
preview
interactive
review
```

Các contract quan trọng:

- interaction value và answer identity không phụ thuộc display text.
- repeated labels vẫn phân biệt bằng ID.
- math render đúng trong prompt và answer items.
- review render dùng cùng content renderer.

---

## 73. Surface integration tests

Phải cover ít nhất:

1. Manual editor preview.
2. JSON import review.
3. StudentView.
4. LiveExamQuiz.
5. Teacher result detail.
6. Student result review.
7. Question bank detail.

---

## 74. Legacy compatibility corpus

Tạo fixture corpus từ question shapes hiện có:

- plain text.
- text + `$...$`.
- `<strong>` + math.
- multiline.
- all Core 13.
- ERROR_CORRECTION.
- GEOMETRY/SVG.
- legacy image/base64 nếu dữ liệu hiện hành có.

Snapshot semantic v2 output của adapter để khóa deterministic behavior.

---

## 75. Security tests

Phải chứng minh StudentQuestionV2 không có:

```text
answerKey
explanation trước policy
isCorrect
categoryId đúng
correctOrder
correctWordIndexes
correct answer mapping
```

Test cả nested traversal, không chỉ top-level delete.

---

## 76. Browser visual tests

Viewport:

- desktop.
- laptop.
- tablet.
- mobile.

Fixture visual cần gồm:

- long reading passage.
- long math.
- image question.
- 4-item TRUE_FALSE.
- DRAG_DROP math choices.
- dropdown with math.
- result review.

---

# PART Q — ROLLOUT PLAN AT ARCHITECTURE LEVEL

## 77. Phase 0 — Contracts only

- Add Rich Content v1 TypeScript/Zod contracts.
- Add Question Contract v2 types/schemas.
- Add canonical fixtures.
- No production behavior change.

---

## 78. Phase 1 — Shared read/render foundation

- Implement RichContentRenderer.
- Implement compatibility adapter.
- Keep existing editor and persistence.
- Render legacy data through adapter in controlled preview/tests first.
- Establish the v2 read-path before any v2-only content can be authored.

---

## 79. Phase 2 — Additive persistence + DTO boundaries

- add D1 v2 columns.
- implement Authoring/Student/Review DTO construction.
- implement dual-write + LegacyShadowMapper.
- keep authoring UI on v1 initially.
- verify scoring parity and answer-leak tests before enabling writes from Rich Editor.

---

## 80. Phase 3 — Manual Quiz Rich Text Editor + JSON v2

- Replace main `MathTextarea` with Rich Editor adapter.
- Migrate type-specific content inputs progressively.
- Preview uses QuestionRenderer v2.
- Paste JSON v2 enabled.
- v2 save/lazy upgrade enabled only for staged teacher audience.

This is first authoring rollout that creates v2-only formatting.

---

## 81. Phase 4 — Student renderer

- StudentView and LiveExam consume the same canonical rendering path.
- feature flag / staged rollout by surface/audience.
- legacy questions continue through adapter.

---

## 82. Phase 5 — Review/result consolidation

- migrate `QuestionReview` content to QuestionRenderer v2 review mode.
- eliminate duplicate formatting/math rendering paths.

---

## 83. Phase 6 — Question Bank + remaining surfaces + optional backfill

- question bank preview/detail.
- import preview.
- quiz preview.
- analysis/result panels displaying full question content.
- optional audited backfill only after metrics prove adapter/render stability.
- legacy columns remain until a later, separately approved deprecation project.

---

## 84. Rollback

Rollback có hai mức rõ ràng.

### Level A — Preferred after v2 authoring is enabled

```text
disable v2 authoring / v2 write rollout
-> keep stable v2 read-path for already-authored Rich Content
-> legacy questions still resolve through adapter
-> old scoring shadow remains authoritative-compatible
```

Đây là rollback mặc định vì giữ full rendering fidelity cho nội dung v2 đã tạo.

### Level B — Emergency legacy presentation fallback

```text
disable affected v2 surface renderer
-> use legacy shadow renderer temporarily
-> scoring and semantic content remain available
-> advanced v2 formatting may degrade visually
-> canonical content_json remains untouched for recovery
```

No rollback depends on destructive DB downgrade. Không được tuyên bố legacy renderer có full fidelity với color/highlight/list/alignment của v2.

---

# PART R — FEATURE FLAG & STOP CONDITIONS

## 85. Feature rollout

Use existing feature rollout control plane rather than inventing a new deployment mechanism.

Recommended logical capability flags (có thể map vào control plane hiện tại thay vì bắt buộc đúng tên physical flag):

```text
question_content_v2_read
question_content_v2_authoring
question_content_v2_student_surface
question_content_v2_review_surface
```

Tách read/authoring/surface cho phép rollback authoring mà không làm mất khả năng render đúng các document v2 đã lưu.

Possible staged audiences:

```text
internal/admin
selected teacher
selected class
percentage
all
```

---

## 86. Hard stop conditions

Stop rollout if:

- Student DTO can expose answerKey.
- v2 render differs materially between teacher preview and student for same DTO.
- legacy corpus has unsupported high-frequency shapes.
- scoring result changes for unchanged legacy questions.
- math render failure rate increases.
- v2 save cannot produce valid legacy shadow during transition.
- mobile content causes page-level horizontal overflow.

---

# PART S — TARGET MODULE BOUNDARIES

## 87. Proposed modules

Names are architectural targets; implementation plan may adjust exact paths to existing conventions.

```text
src/domain/question-content/
  richContent.types.ts
  richContent.schema.ts
  questionV2.types.ts
  questionV2.schema.ts
  questionV2.fixtures.ts
  legacyQuestionAdapter.ts

src/features/question-rendering/
  QuestionRenderer.tsx
  RichContentRenderer.tsx
  RichTemplateRenderer.tsx
  interactionRegistry.ts
  renderers/

src/features/question-editor/
  RichTextEditor.tsx
  richTextEditorAdapter.ts
  editorProfiles.ts

workers/src/services/questionContent/
  questionContentMapper.ts
  questionContentSanitizer.ts
  questionContentPersistence.ts
  questionContentDto.ts
```

### Existing modules to migrate, not duplicate forever

```text
src/features/quiz-player/components/QuestionRenderer
src/components/common/QuestionReview
src/components/common/MathSpan
src/components/common/SafeFormattedText
src/features/quiz-editor/components/QuestionEditorModal
src/features/manual-quiz-workspace/import/jsonQuestionImporter.ts
workers/src/utils/helpers.ts
workers/src/routes/quizzes.ts
workers/src/services/liveExamQuestionMapper.ts
```

---

# PART T — API CONTRACT BEHAVIOR

## 88. Teacher create/update

Teacher input may contain Question Contract v2.

Server sequence:

```text
parse envelope
-> validate Rich Content
-> validate type contract
-> validate answer references
-> validate math/media
-> build student-safe content
-> build private answer key
-> build legacy scoring shadow
-> validate scoring contract
-> persist atomically
```

No partial question writes.

---

## 89. Public/student reads

Server sequence:

```text
load row
-> resolve v2 or legacy adapter
-> construct StudentQuestionV2
-> assert no private paths
-> return
```

Do not serialize full AuthoringQuestionV2 rồi deep-delete ad hoc ở route cuối.

Student DTO should be constructed positively from allowed fields.

---

## 90. Teacher reads

Teacher/editor DTO may include:

- content.
- answerKey.
- explanation.
- metadata.
- legacy compatibility diagnostics when relevant.

---

## 91. Result/review reads

Server constructs review DTO from:

- renderable question.
- authoritative scoring result.
- authoritative student answer.
- optional correct answer projection.
- explanation policy.

Review renderer should not recalculate authoritative correctness from presentation data.

---

# PART U — JSON IMPORT EXPERIENCE

## 92. Paste JSON v2 flow

```text
Paste
-> JSON parse
-> contractVersion detect
-> v2 schema validation
-> type validation
-> answer-reference validation
-> math/media validation
-> preview using QuestionRendererV2
-> import
```

For contractVersion 1/legacy:

```text
legacy importer
-> normalize legacy Question
-> legacyQuestionToV2 preview
-> import/save
```

---

## 93. Import UI errors

Examples:

```text
Q018 · interaction.options[2].content
Unsupported node type "html".
```

```text
Q020 · answerKey.optionId
"opt-e" does not exist in interaction.options.
```

```text
Q023 · prompt.blocks[1].latex
LaTeX command is not allowed by math policy.
```

UI should provide path + reason, not generic parse message.

---

# PART V — SYSTEM PROMPT GENERATION PROFILE

## 94. Core generation policies retained

System Prompt v2 retains current pedagogical rules, separate from structural schema.

Examples:

- TRUE_FALSE: exactly 4 related statements for generated sets using this profile.
- MULTIPLE_SELECT: shared context where requested, at least 2 correct answers.
- DRAG_DROP: generally 4 slots in the established elementary profile when user requests that style.
- DROPDOWN: enough context, often 4 dropdowns under current preferred profile.
- English elementary: common vocabulary and unambiguous antecedents.
- output: JSON only.

These are **generation profile constraints**, not low-level renderer constraints.

This separation prevents UI/persistence schema from becoming unnecessarily restrictive.

---

# PART W — NON-GOALS

## 95. Explicitly out of scope for v2 foundation

- Word clone.
- arbitrary fonts/font sizes.
- arbitrary CSS.
- nested tables.
- arbitrary embedded HTML.
- free-position text/image boxes.
- collaboration/multi-cursor editing.
- shared cross-question stimulus entity.
- scoring engine rewrite.
- fuzzy/AI semantic grading.
- automatic destructive migration of all old questions.
- removal of ERROR_CORRECTION or GEOMETRY.

---

# PART X — ACCEPTANCE CRITERIA

## 96. AC01 — Structured content

New v2 questions can represent:

- paragraph.
- Enter / Shift+Enter.
- bold/italic/underline/strike.
- tokenized color/highlight.
- alignment.
- lists.
- inline/block math.
- image.

without raw HTML.

---

## 97. AC02 — Core 13 schema

Every Core 13 type has:

- visible interaction contract.
- separate answerKey contract.
- deterministic IDs.
- Zod validation.
- canonical fixture.

---

## 98. AC03 — System Prompt

System Prompt v2 can generate a valid `contractVersion: 2` envelope without:

- HTML formatting tags.
- Markdown formatting.
- `$...$` math delimiters in text nodes.
- answer correctness embedded in visible items.

---

## 99. AC04 — Preview parity

Given the same StudentQuestionV2 DTO:

Teacher Preview and Student Interactive render the same:

- content hierarchy.
- typography.
- math.
- image.
- spacing.

except interactive state/control behavior.

---

## 100. AC05 — Review parity

Review/result reuses RichContentRenderer for prompt/options/items/explanation.

Không có một Math/HTML parsing implementation riêng trong review pipeline.

---

## 101. AC06 — No answer leak

Automated contract test traverses StudentQuestionV2 and verifies no private answer data exists.

---

## 102. AC07 — Legacy

Untouched v1 questions:

- still load.
- still render.
- still grade identically.
- still edit.

Không yêu cầu bulk migration để deploy v2.

---

## 103. AC08 — Lazy upgrade

Editing and saving a v1 question can persist v2 structured content while maintaining valid legacy scoring/render shadow during rollout.

---

## 104. AC09 — Mobile

No Rich Content block creates page-level horizontal overflow on supported mobile viewport.

---

## 105. AC10 — Security

Paste/import cannot persist executable HTML/script/event attributes/CSS into v2 content.

---

## 106. AC11 — Math

Math displays correctly in:

- prompt.
- explanation.
- option.
- true/false statement.
- matching item.
- drag/drop choice after placement.
- dropdown option/selected value.
- ordering item.
- categorization item.
- underline selectable.
- result/review.

---

## 107. AC12 — Rollback

- v2 authoring/write can be disabled without scoring change or canonical data loss.
- already-authored v2 content remains full-fidelity through stable v2 read-path.
- emergency legacy presentation fallback does not destroy data, but may intentionally downgrade unsupported formatting until v2 rendering is restored.

---

# PART Y — IMPLEMENTATION BOUNDARIES

## 108. Always do

- Contract-first.
- Zod validation at boundaries.
- ID-based semantic references.
- Server-side student DTO construction.
- Same renderer for preview/student content.
- Backward compatibility tests.
- TDD for every type migration.
- Feature-flagged staged rollout.

---

## 109. Ask before

- D1 migration execution.
- adding editor dependency.
- changing scoring answer schema.
- bulk backfill production questions.
- deleting/deprecating legacy columns.
- enabling v2 for all users.

---

## 110. Never do

- Store raw arbitrary HTML as canonical content.
- Trust AI JSON without schema validation.
- Expose AuthoringQuestionV2 directly to students.
- Use display text as unique answer identity when an ID exists.
- Build a second independent Student Preview renderer.
- Drop legacy fields before rollout completion and rollback window.
- Migrate scoring and content architecture in one unreviewable change.

---

# PART Z — FINAL ARCHITECTURE

## 111. End-state data flow

### AI / pasted JSON

```text
System Prompt v2
  -> QuestionSetEnvelopeV2
  -> schema validation
  -> AuthoringQuestionV2
```

### Teacher editor

```text
Rich Text Editor
  -> RichDocumentV1
  -> AuthoringQuestionV2
```

### Save

```text
AuthoringQuestionV2
  -> Worker validation
  -> content_json
  -> answer_key_json
  -> explanation_json
  -> legacy scoring shadow
```

### Student

```text
D1
  -> v2 parse OR legacy adapter
  -> StudentQuestionV2
  -> QuestionRendererV2 interactive
```

### Teacher preview

```text
Editor draft
  -> Student-safe projection
  -> QuestionRendererV2 preview
```

### Review/result

```text
D1 + authoritative grading
  -> ReviewQuestionV2
  -> QuestionRendererV2 review
```

---

## 112. Final decision summary

The following decisions are locked by this design unless the user explicitly changes the spec:

1. **Structured Rich Content, not HTML, is the new canonical presentation model.**
2. **Question Contract v2 uses current runtime names for Core 13.**
3. **Answer correctness is separated from visible interaction data.**
4. **One RichContentRenderer is shared across all surfaces.**
5. **Teacher Preview reuses the student rendering pipeline.**
6. **QuestionReview becomes a review mode of the same rendering architecture, not a separate formatting engine.**
7. **Persistence is additive and split into public content / private answer key / explanation.**
8. **Legacy data is adapted at read time and lazily upgraded on edit/save.**
9. **Current scoring engine/Answer Schema v2 remains authoritative during first rollout.**
10. **Core 13 is the official AI generation contract; ERROR_CORRECTION and GEOMETRY remain supported extensions.**
11. **Rollout is feature-flagged and rollback-safe.**
12. **No production implementation starts until this spec is reviewed and approved.**

---

## 113. Commands for later implementation verification

When implementation begins, applicable project gates include:

```bash
npm run lint
npm run typecheck
npm run typecheck:strict
npm run typecheck:workers
npm run test:ci:all
npm run build
npm run security:check
npm run release:readiness
```

Focused contract/renderer/browser tests MUST run before full release gates.

---

## 114. Next gate

After product review of this document:

1. revise spec if requested;
2. user approves final spec;
3. create a phased implementation plan;
4. only then begin code changes.
