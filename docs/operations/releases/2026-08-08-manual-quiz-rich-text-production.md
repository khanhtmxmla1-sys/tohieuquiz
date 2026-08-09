# Manual Quiz Rich Text Editor — Production Release

**Release date:** 2026-08-08
**PR:** #88
**Merge commit:** `d519fb70c09a4927a8e09cf18244f5cb82e4a374`
**Feature branch:** `feat/manual-quiz-rich-editor`

## Scope

- Compact optional image attachment in manual question authoring.
- Focused Tiptap rich editor for the main question prompt.
- Bold/italic/underline/strike, alignment, lists, fixed color/highlight palettes, clear formatting, undo/redo.
- Enter paragraph and Shift+Enter hard-break semantics.
- Existing Math Composer integration.
- Dual representation:
  - `question`: plain + TeX compatibility/search/grading/AI path.
  - `question_rich_text`: versioned structured presentation JSON.
- Safe rich renderer in teacher preview, student player, practice and live exam.
- Legacy fallback without bulk backfill.

## D1

Migration:

```text
0064_add_question_rich_text.sql
```

Column:

```sql
question_rich_text TEXT NOT NULL DEFAULT ''
```

Pre-migration registry was reported clean with 0063 as latest applied migration. A D1 Time Travel recovery point was captured before the production write.

Post-migration verification reported:

- 464 existing questions checked;
- `NULL question_rich_text = 0`;
- registry order begins `0064 -> 0063 -> 0062`.

## Frontend

Vercel production deployed merge `d519fb7` successfully.

## Worker

Rollback version retained before deploy:

```text
fdfef9a9-5136-408b-8ec2-4e772765b7ff
```

Production Worker version after deploy:

```text
5d137d5f-9e60-4b98-a003-7bbbd1057d17
```

Reported traffic:

```text
100%
```

Bindings for D1/R2/Queue/AI Gateway/cron/custom domain were verified during deploy.

## Verification

Reported final gates:

- `npm run verify`: PASS
- lint: PASS
- frontend typecheck: PASS
- strict typecheck: PASS
- Worker typecheck: PASS
- full Vitest shards: PASS
- coverage gate: PASS
- production build: PASS
- security/dependency audit: PASS
- performance budget: PASS
- migration contract/rollback tests: PASS
- manual workspace Cypress: 10/10
- full stubbed Cypress: 43/43
- GitHub CI/Release Readiness: PASS

Responsive E2E covered 320/768/1024/1440px and save/reload/publish, Enter, Shift+Enter and compact media.

## Production smoke

An initial post-Vercel smoke observed transient admin/teacher timeouts. Migration was paused while investigating. A repeated read-only smoke passed, after which migration/Worker deploy proceeded.

Final post-release production smoke was reported:

```text
15/15 PASS
failed = 0
status = ready
```

Coverage included frontend, API health, CORS, hostile origin, unauthenticated guards, authenticated reads for admin/teacher/student/parent, and browser shell.

## Architecture decision

This release establishes **Question Presentation v1** (`question + question_rich_text`) as the production baseline. See `docs/decisions/ADR-001-question-presentation-dual-representation.md`.

## Normal rollback

Do not drop `question_rich_text` during a normal app rollback. Keep the column/data and roll frontend/Worker back to reviewed versions if needed. The destructive migration rollback requires separate approval and a data-retention decision.
