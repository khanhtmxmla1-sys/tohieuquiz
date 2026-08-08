# Student Question Newline Rendering Implementation Plan

> **For agentic workers:** Execute task-by-task with TDD and review checkpoints.

**Goal:** Preserve author-entered line breaks in the student quiz prompt for plain-text/fallback questions while retaining current rich-text and math rendering behavior, then align System Prompt V3.3 with that presentation contract.

**Architecture:** Keep the existing dual representation (`question` + optional `questionRichText`). Rich content continues through `QuestionRichTextRenderer`; plain/fallback content must preserve `\n` through the existing `SmartText`/`MathSpan` path using CSS white-space behavior rather than rewriting strings into HTML. No persistence or scoring changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest/Testing Library, Vite.

## Global Constraints

- Frontend only. Do not modify Worker/API, D1, migrations, grading, scoring, or question schema.
- Preserve React escaping; no `dangerouslySetInnerHTML`.
- Plain one-line questions must remain visually unchanged.
- Multiline plain text must preserve line breaks and continue wrapping long lines naturally.
- Math-containing multiline prompts must preserve both math rendering and line breaks.
- Existing valid `questionRichText` remains authoritative for presentation.
- Do not commit/push/merge without separate user permission.

---

### Task 1: Reproduce newline collapse with regression tests

**Files:**
- Modify/Test: `tests/QuestionRendererRichTextMath.test.tsx`
- Modify/Test: `tests/QuestionRichTextRenderer.test.tsx` only if fallback coverage is missing.

**Acceptance:**
- A plain poem/dialogue prompt containing `\n` exposes a newline-preserving wrapper in the student renderer.
- A multiline prompt containing TeX also exposes newline-preserving rendering.
- The new test fails on current code for the plain `SmartText` path.

**Verify:**
`npx vitest run tests/QuestionRendererRichTextMath.test.tsx tests/QuestionRichTextRenderer.test.tsx --maxWorkers=1`

### Task 2: Minimal frontend fix

**Files:**
- Modify: `src/features/quiz-player/components/QuestionRenderer/utils/SmartText.tsx`
- Touch `src/components/common/MathSpan.tsx` only if evidence shows its existing `whiteSpace: pre-line` is insufficient.

**Acceptance:**
- Plain `SmartText` preserves newline characters.
- Math/HTML-like `SmartText` continues through shared safe `MathSpan` and preserves newlines.
- Long text still wraps; no `white-space: pre` behavior.

**Verify:** same focused tests plus targeted lint.

### Task 3: Integration/runtime verification

**Files:**
- Prefer tests only; modify `QuestionRenderer/index.tsx` only if integration evidence requires it.

**Acceptance:**
- Student player shows instruction and poem/dialogue lines separately.
- Teacher preview fallback remains correct through shared `QuestionRichTextRenderer`/`MathSpan`.
- Rich paragraphs/hardBreaks continue unchanged.

**Verify:** focused integration tests and browser/Cypress spot check if local fixture path is available.

### Task 4: Quality gate and review

**Verify:**
- `npx vitest run tests/QuestionRendererRichTextMath.test.tsx tests/QuestionRichTextRenderer.test.tsx --maxWorkers=1`
- targeted ESLint on changed TS/TSX files
- `npm run typecheck`
- `npm run typecheck:strict`
- `npm run build:frontend`
- `git diff --check`
- GitNexus `detect_changes`
- diff review/security scan
- confirm no `workers/`, migration, D1, or schema files changed.

### Task 5: Generate System Prompt V3.3

**Source:** `/mnt/data/ToHieuQuiz_Gem_System_Prompt_13_Types_LaTeX_JSON_Strict_Layout_RichText_v3.2.md`

**Acceptance:**
- Keep all V3.2 schemas, quote safety, LaTeX rules and 13 question types.
- Require `questionRichText` for layout-sensitive prompts: poetry, dialogue, reading passage + question blocks, intentionally multiline math/steps, standalone centered formulas.
- Keep simple one-line questions eligible for plain-only output.
- `question` remains semantically equivalent fallback with matching `\n` structure.
- Validate examples as JSON and scan for accidental numeric backreferences/fake image URLs.

**Stop condition:** implementation is verified in the feature worktree; do not commit/push/merge without separate approval.


## Verification evidence before PR merge

- Vitest regression: 9/9 passed.
- Cypress question scoring matrix: 2/2 passed.
- Targeted ESLint, frontend typecheck, strict typecheck, and git diff --check: passed.
- Frontend production build: passed after restoring the worktree dependency junction.
- Security scan: passed.
- GitNexus: LOW risk, 0 affected processes.
- Scope check: frontend renderer/tests/docs only; no Worker, D1, migration, or schema changes.
