# TôHiệuQuiz Question Presentation Evolution — Program Roadmap

> **Planning level:** Program roadmap. Mỗi phase implementation lớn phải có design/implementation plan riêng trước khi code.

**Production baseline:** `question + question_rich_text` / Presentation Schema v1. Initial rich-text release: `d519fb7`; integrity/historical-review hardening: PR #92 merge `406973f`; migration remains `0064_add_question_rich_text.sql`.

**Goal:** Tiến hóa từ Rich Text prompt v1 đã chạy production thành một hệ thống hiển thị câu hỏi nhất quán trên teacher/student/review/result mà không phá scoring, dữ liệu cũ hoặc API hiện hành.

## Architecture principles

1. Presentation thay đổi trước; scoring giữ nguyên.
2. `question` và `questionRichText` không được trở thành hai nguồn truth độc lập.
3. Một renderer presentation dùng chung trên mọi surface có thể dùng chung.
4. Mở rộng rich content theo vertical slice, không chuyển 13 dạng cùng lúc.
5. System Prompt chỉ chuyển sang structured rich JSON khi runtime thực sự cần.
6. Không migration/bulk backfill chỉ để “đẹp kiến trúc”.
7. Mọi production mutation có checkpoint, rollback và smoke.

---

## Dependency graph

```text
Production Presentation v1 (RELEASED)
        |
        v
Phase 1 — Integrity + Review Renderer Consolidation (RELEASED)
        |
        +--------------------+
        |                    |
        v                    v
Phase 2 — Rich field expansion
(explanation/options/items)
        |
        v
Phase 3 — Import/System Prompt evolution
        |
        v
Decision Gate — Is Full Question Contract v2 still needed?
        |
        +-- NO -> continue incremental Presentation v1/v2
        |
        +-- YES -> Phase 4 semantic DTO/answer-key architecture
```

---

# Phase 0 — Released baseline documentation

**Status:** COMPLETED — baseline/release documentation reconciled through the 2026-08-09 integrity release.

Deliverables:

- Mark Rich Text MVP spec as RELEASED.
- Mark production tasks complete.
- Record migration/Worker/frontend/smoke release evidence.
- Adopt ADR-001 as architectural baseline.
- Sync `docs/deployment/CURRENT_PROGRESS.md` to the 2026-08-08 production baseline so future agents do not treat migration 0054/older Worker versions as current.

No application code or D1 mutation.

---

# Phase 1 — Presentation integrity + historical review consolidation

**Status:** COMPLETED + MERGED + RELEASED — PR #92, merge `406973f`, production rollout 2026-08-09.

**Next program gate:** Phase 2 is not pre-authorized; each rich-field expansion requires a new focused plan and explicit approval.

**Detailed plan:** `docs/superpowers/plans/2026-08-08-question-presentation-integrity-review-rendering.md`

## Outcomes

### 1A. Typed Presentation v1 contract

`questionRichText` becomes optional presentation metadata on the domain `Question` and `QuestionSnapshot` types. `QuestionRichTextEnvelopeV1` remains the persisted presentation contract; Tiptap remains only an editor adapter.

### 1B. Server-owned dual-representation consistency

When valid `questionRichText` is present:

```text
questionRichText
  -> validate rich contract separately
  -> richTextToPlainText
  -> derive complete plain prompt
  -> remove presentation JSON from semantic clone
  -> current math normalization/validation on semantic clone only
  -> persist normalized question + separately validated question_rich_text
```

The submitted plain `question` is compatibility input only; it cannot silently disagree with rich content.

### 1C. Low-noise drift observability

Mismatch comparison happens after the same math/newline normalization used by the write path so equivalent TeX forms do not generate false telemetry.

- persist server-derived value;
- emit content-free structured event only for real semantic/plain drift;
- never log actual question text or rich JSON;
- omitted client plain echo is not a mismatch.

### 1D. Shared rich renderer preserves math across formatting boundaries

`QuestionRichTextRenderer` must segment delimited math across the full inline paragraph/list stream before rendering marks. If Tiptap formatting splits one logical formula into adjacent text nodes, the renderer emits one complete `MathSpan`; partial styling inside the formula may be dropped rather than breaking math.

### 1E. Authoritative historical snapshots retain presentation within a D1-aware budget

The grading loader must select `question_rich_text` so `buildAuthoritativeStoredAnswers()` can retain safe `questionRichText` in **new** result snapshots while still stripping correct-answer fields.

Cloudflare D1 limits string/BLOB/table-row size to 2.000.000 bytes. Phase 1 therefore retains rich snapshots only when the **final serialized authoritative answers candidate with rich** is at most **1.500.000 UTF-8 bytes**. If that candidate exceeds the threshold, result submission still succeeds and all stored question snapshots for that result degrade deterministically to historical plain presentation. The threshold is not a new rejection limit for legacy/plain-only answers. Pre-existing snapshots are not backfilled.

### 1F. Historical snapshot precedence

```text
snapshot has rich -> snapshot rich
snapshot exists but has no rich -> snapshot plain only
no snapshot -> current quiz presentation
```

Never inject current quiz rich presentation into an older snapshot that lacks it, because the quiz may have been edited after submission.

### 1G. Teacher result/review presentation parity

`QuestionReview` uses `QuestionRichTextRenderer` only when the question object supplied by the historical/current model actually contains `questionRichText`; otherwise it falls back to current math/plain behavior.

Do **not** rewrite answer-review templates/scoring in the same phase.

### 1H. Student result review parity

`ReviewTab` uses the same rich prompt renderer while continuing to use server-authoritative `reviewDetails` for correctness/answer display. Historical assignment review remains snapshot-first.

### 1I. No D1 migration

Phase 1 uses the existing `question_rich_text` column only. Adding that existing column to an explicit SELECT is not a schema change.

## Exit criteria

- Mismatched dual representation cannot persist as two semantic prompts.
- Equivalent TeX forms do not produce drift false positives.
- Shared rich renderer preserves delimited math even when formatting marks split the formula across adjacent rich text nodes.
- New result snapshots preserve safe rich presentation only when final answers-with-rich is within the 1.5 MB D1-aware budget; over-budget rich candidates degrade to plain without blocking submission; old snapshots remain plain without backfill.
- Historical review never borrows newer current-quiz rich content into an old snapshot.
- Existing `QUIZ_HAS_SUBMISSIONS` structural-edit guard remains green; Phase 1 does not redesign answer-key history while submitted quiz structure is immutable.
- Rich prompt renders consistently in manual preview, quiz player, teacher review and student result review when rich historical/current data exists.
- Legacy/plain-only questions remain unchanged.
- Scoring contract/score output unchanged.
- Full verification + browser checks pass before release.

---

# Phase 2 — Rich field expansion

**Start only after Phase 1 production stability.**

Split into independent subplans; never combine all fields in one PR.

## Phase 2A — Explanation

Add versioned `explanationRichText` presentation while keeping legacy `explanation` plain fallback.

Why first:

- non-interactive content;
- lower grading risk;
- validates reusable field-level rich-content pattern.

## Phase 2B — MCQ/MULTIPLE_SELECT options + TRUE_FALSE statements

Add LIMITED rich presentation to choice/item text.

Rules:

- answer identity stays existing letter/ID contract;
- presentation text is not answer identity;
- math inside choice must render in editor/player/review.

## Phase 2C — Matching/Ordering/Categorization

Add LIMITED rich presentation to left/right/items/categories.

Must preserve duplicate-text identity using IDs/index contracts already owned by scoring normalization.

## Phase 2D — DRAG_DROP/DROPDOWN interactive content

Only after simpler item-rich fields are stable.

Must explicitly test:

- selected value math rendering;
- duplicate choices;
- blank identity;
- mobile interaction;
- review parity.

## Phase 2E — Remaining language-specific types

UNDERLINE, WORD_SCRAMBLE, RIDDLE, ERROR_CORRECTION and extension types are migrated individually where rich presentation provides real user value.

## Phase 2 non-goals

- no scoring rewrite;
- no bulk migration;
- no forced System Prompt v2;
- no arbitrary HTML/CSS;
- no new giant question blob.

---

# Phase 3 — JSON importer + System Prompt evolution

**Prerequisite:** at least the target rich fields from Phase 2 must exist and render consistently.

## Decision A — Keep AI semantic/plain by default

Preferred default:

```text
System Prompt
 -> current semantic question JSON
 -> importer validation
 -> plain fields
 -> Presentation adapter/editor
```

Advantages:

- smaller JSON;
- fewer escaping/schema failures;
- AI focuses on pedagogy and correctness;
- author/editor controls presentation.

## Decision B — Optional AI presentation profile

Only add structured rich output when user explicitly requests formatting or when automated formatting has measurable benefit.

If enabled:

- generated rich content must use TôHiệuQuiz contract, not raw Tiptap JSON;
- plain fallback must be server-derived;
- importer validates allowlist/version/size;
- legacy JSON remains accepted.

## Exit criteria

- Old 13-type JSON still imports.
- New optional presentation JSON round-trips safely.
- No raw HTML/Markdown is required for formatting.
- AI cannot create answer identity by display text when a stable ID exists.

---

# Phase 4 — Full semantic Question Contract v2 (conditional)

This phase is **not pre-authorized** and is not assumed necessary.

Trigger only if at least one of these becomes true:

1. presentation fields become too fragmented to maintain safely;
2. public/student DTO answer-leak prevention requires stronger structural boundary;
3. external API/import consumers need a stable semantic contract independent of legacy storage;
4. current scoring normalization cannot evolve without repeated ambiguous adapters.

If triggered, write a new ADR and approved spec before implementation.

Candidate scope:

- AuthoringQuestion DTO;
- StudentQuestion allowlist DTO;
- ReviewQuestion envelope;
- private answer-key projection;
- ID-based interaction contract;
- optional new persistence fields.

Do not assume `content_json + answer_key_json + explanation_json` is the only solution; re-evaluate against production evidence at that time.

---

# Cross-phase test strategy

Every phase must include:

- TDD RED → GREEN for changed behavior;
- legacy/plain-only fixture;
- rich/TeX fixture;
- malformed rich JSON fixture;
- XSS/unknown-node rejection;
- teacher/student parity fixture where applicable;
- scoring parity test;
- desktop/mobile browser verification for user-visible surfaces.

Global gates before PR/release:

```bash
npm run lint
npm run typecheck
npm run typecheck:strict
npm run typecheck:workers
npm run test:ci:all
npm run test:coverage
npm run build
npm run security:check
npm run perf:budget
npm run release:readiness
```

Production release adds:

```bash
npm run cypress:run:production-smoke
```

plus feature-specific authenticated smoke.

---

# Program stop conditions

Stop and reassess if:

- scoring changes unexpectedly;
- `question` and rich presentation cannot be derived deterministically;
- student/public payload exposes correctness data not previously exposed;
- rich renderer introduces material accessibility/mobile regressions;
- bundle/performance budget cannot be met without route-level lazy loading;
- a phase requires a D1 migration not covered by its approved plan;
- legacy questions require bulk mutation to keep working.

---

# Approval boundaries

Program roadmap approval does **not** authorize:

- D1 migration after 0064;
- scoring schema changes;
- production backfill;
- deleting legacy columns;
- enabling a full Question Contract v2;
- production deploy.

Each of those requires a dedicated implementation/release gate.
