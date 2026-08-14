# Admin Randomization Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use Hub orchestration + TDD; evidence, not narrative, advances gates.

**Goal:** Cho phép Admin bật/tắt tập trung mọi random liên quan trực tiếp đến trải nghiệm làm quiz, trong khi giữ chấm điểm theo stable IDs và giữ thứ tự ổn định khi random bị tắt.

**Architecture:** Tận dụng `system_settings` hiện có để lưu một `RandomizationPolicy` toàn cục. Frontend tải policy một lần cho mỗi bề mặt làm bài và truyền policy xuống quiz player/renderers; Worker chỉ đọc policy tại điểm cần quyết định chọn câu practice. Loại bỏ double-shuffle ở student DTO để frontend là chủ sở hữu duy nhất của thứ tự trình bày structured answers. Khi random câu hỏi OFF, API trả câu hỏi theo `rowid ASC`, là thứ tự insert/reinsert hiện hành của quiz.

**Tech Stack:** React, TypeScript, Zustand/hooks, Cloudflare Workers + D1, Vitest.

## Global Constraints

- Không sửa trực tiếp `main`; chỉ làm trong `C:\quizpro\.worktrees\randomization-policy` / `feat/admin-randomization-policy`.
- Không commit/push/PR/migrate/deploy nếu chưa có approval riêng.
- Default phải bảo toàn hành vi production hiện tại: câu hỏi ON, choices OFF, matching ON, ordering ON, drag-drop ON, practice selection ON.
- Master OFF phải thắng mọi child setting.
- Chấm điểm luôn dựa stable IDs/original indexes, không dựa label A/B/C/D sau shuffle.
- Live Exam tiếp tục giữ cùng thứ tự câu hỏi; choice shuffle của Live Exam vẫn OFF theo hiện trạng session, nhưng master OFF phải tắt structured shuffle.
- Không đụng random ngoài quiz: password/username generation, visual effects, gamification, random IDs.

## Task 1: Contract + persistence settings

**Files:**
- Create: `shared/randomization-policy.contract.ts`
- Modify: `workers/src/routes/systemSettings.ts`
- Modify: `src/services/systemSettingsService.ts`
- Test: `tests/randomizationPolicy.test.ts`
- Test: `tests/systemSettingsRandomization.worker.test.ts`

**Acceptance criteria:**
- GET system settings trả policy với default legacy-compatible khi row chưa tồn tại.
- Admin-only POST cập nhật 7 randomization keys và ghi `SYSTEM_SETTINGS_UPDATED` audit.
- Master OFF được resolve thành toàn bộ effective flags OFF nhưng vẫn giữ child values đã lưu.

## Task 2: Stable presentation helpers + choice IDs

**Files:**
- Create: `src/features/randomization/randomization.ts`
- Modify: `src/features/quiz-player/components/QuestionRenderer/types.ts`
- Modify: `MCQRenderer.tsx`, `MultipleSelectRenderer.tsx`, `ImageQuestionRenderer.tsx`
- Test: `tests/RandomizationRenderers.test.tsx`

**Acceptance criteria:**
- OFF giữ nguyên options.
- ON đổi display order nhưng click vẫn gửi original stable option ID.
- Image option giữ đúng ảnh với đúng option sau shuffle.

## Task 3: Question order + structured renderers

**Files:**
- Modify: `src/features/quiz-player/hooks/useQuizPlayer.ts`
- Modify: `MatchingRenderer.tsx`, `OrderingRenderer.tsx`, `FillInTheBlankRenderer.tsx`
- Modify: `workers/src/routes/quizzes.ts`
- Test: `tests/useQuizPlayerRandomization.test.tsx`
- Test/update: structured-answer worker/UI tests.

**Acceptance criteria:**
- shuffleQuestions OFF giữ đúng thứ tự source.
- GET questions dùng `ORDER BY rowid ASC` để OFF ổn định.
- Matching/Ordering/DragDrop OFF giữ canonical order; ON dùng deterministic seeded order để refresh không tự nhảy.
- Worker không double-shuffle Matching/DragDrop; correct fields vẫn bị loại.

## Task 4: Practice + surfaces

**Files:**
- Create: `workers/src/services/randomizationPolicyService.ts`
- Modify: `workers/src/routes/practice.ts`
- Create: `src/features/randomization/useRandomizationPolicy.ts`
- Modify: `src/components/StudentView.tsx`
- Modify: `src/components/LiveExam/LiveExamQuiz.tsx`
- Test: `tests/practiceRandomization.worker.test.ts`

**Acceptance criteria:**
- Practice master/selection OFF dùng `ORDER BY rowid ASC`; ON dùng `ORDER BY RANDOM()`.
- StudentView truyền policy vào useQuizPlayer + renderers.
- Live Exam không random question order, choice shuffle vẫn false; structured flags tuân global policy.

## Task 5: Admin UI

**Files:**
- Create: `src/features/randomization/admin/RandomizationSettingsPanel.tsx`
- Modify: `src/features/feature-rollout/FeatureRolloutPage.tsx`
- Test: `tests/RandomizationSettingsPanel.test.tsx`

**Acceptance criteria:**
- Có master switch “Random toàn bộ bài kiểm tra”.
- Có child switches: câu hỏi, A/B/C/D, Matching, Ordering, DragDrop, chọn câu Practice.
- Master OFF disable controls nhưng không xóa child preferences.
- Save có loading/error/success và reload phản ánh D1.

## Task 6: Remove dead assignment setting + alignment

**Files:**
- Modify: `src/features/quiz-generator/hooks/useQuizPersistence.ts`
- Update contract tests nếu cần.

**Acceptance criteria:**
- Không còn gửi `settings.shuffleQuestions` không được Assignment API lưu.
- Không thay đổi deadline/maxAttempts/assignment behavior.

## Verification

Focused tests first, then:
- `npm run lint`
- `npm run typecheck`
- `npm run typecheck:workers`
- affected Vitest suites
- `npm run build`
- GitNexus `detect_changes(compare main)`
- Local Coding `review_diff`

## Non-goals

- Không random/tắt random password, username suffix, IDs, pet/heart visuals, attendance question, game-only visuals.
- Không deploy D1 hoặc production.
- Không thay đổi scoring contract/correct-answer semantics.
- Không thay đổi Live Exam ADR về cùng thứ tự câu hỏi.

## Stop conditions

Dừng trước commit nếu: P1/P2 review chưa xử lý, focused/full gates fail, GitNexus phát hiện scope ngoài dự kiến, hoặc cần mở rộng sang migration/schema mới.
