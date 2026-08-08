# TODO — Manual Quiz Rich Text Editor + Compact Attachment

## Planning
- [x] Read TôHiệuQuiz lead workflow and planning skills.
- [x] Inspect current manual editor, media upload, math composer, preview/player and persistence paths.
- [x] Run GitNexus impact checks on important symbols.
- [x] Check current Tiptap documentation.
- [x] Save consolidated product/technical spec.
- [x] Save detailed implementation plan.
- [x] User approves implementation plan.

## Slice A — Compact attachment
- [x] Task 1: Add compact attachment regression tests.
- [x] Task 2: Implement compact optional attachment while preserving `IMAGE_QUESTION` full media UI.
- [x] Task 3: Reclaim editor space; responsive browser verification completed in final gate.
- [x] Checkpoint A unit/typecheck review.

## Slice B — Rich text
- [x] Task 4: Create versioned rich-text contract + conversion tests.
- [x] Task 5: Add approved Tiptap dependencies + editor foundation.
- [x] Task 6: Add toolbar, lists, alignment, palette colors/highlight and persisted allowlist normalization.
- [x] Task 7: Adapt existing Math Composer to rich editor selections while preserving native fields.
- [x] Task 8: Verify and harden dual rich/plain frontend draft mapping (HIGH-impact `questionToDraft` explicitly approved by user; proceed cautiously).
- [x] Task 9: Verify D1 migration `0064_add_question_rich_text.sql` + rollback/schema/registry.
- [x] Task 10: Verify Worker persistence, validation and DTO mapping.
- [x] Task 11: Verify main prompt integration with rich editor.
- [x] Task 12: Verify safe teacher-preview + student-player rich renderer.
- [x] Task 13: Verify rich presentation in practice/live-exam read paths.

## Slice C — Verification
- [x] Task 14: Extend/verify manual workspace E2E for Enter/Shift+Enter, formatting, persistence, compact media and responsive overflow.
- [x] Task 15: Focused tests, typecheck, lint, build, perf budget, security, browser accessibility, GitNexus detect_changes, code review and `npm run verify`.

## Production — separate approval
- [ ] Ask for production migration/deploy approval.
- [ ] Audit migration registry before production change.
- [ ] Apply production D1 migration safely.
- [ ] Deploy reviewed Worker/frontend release.
- [ ] Run post-deploy smoke and legacy/new-rich quiz checks.
