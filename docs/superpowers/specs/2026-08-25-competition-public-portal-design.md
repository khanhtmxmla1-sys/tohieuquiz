# SÂN CHƠI TÔ HIỆU QUIZ — Competition Public & Student Portal Design

**Date:** 2026-08-25

**Architecture class:** ARCHITECTURAL

**Design status:** Approved and locked for implementation planning

**Workspace:** `C:\quizpro\.worktrees\competition-v1`

**Branch:** `feat/competition-v1`

---

## 1. Product name and purpose

The user-facing product name is **SÂN CHƠI TÔ HIỆU QUIZ**. `Competition V1` remains an internal engineering name.

This work adds a public competition microsite and a dedicated student competition experience on top of the existing Competition V1 backend. It does not replace the canonical Competition domain, School Exam orchestration, Live Exam integration, result publication, ranking, certificate, or export pipelines.

## 2. Problem statement

The current student entry point `/student/competition` is rendered inside `StudentDashboardUI`. Competition content therefore behaves like another dashboard tab instead of a standalone competition product. There is also no public, unauthenticated competition microsite for campaign information, news, rules, schedule, and official award winners.

The target is to separate public marketing/content, authenticated student participation, and staff administration while preserving one canonical backend.

## 3. Goals

V1 portal MUST:

- provide a public microsite at `/cuoc-thi/**` without login;
- provide a dedicated authenticated student portal at `/thi/**` outside `StudentDashboardUI`;
- preserve `/teacher/competition` as the staff/admin area;
- reuse existing Competition round, attempt, eligibility, School Exam, publication, ranking, correction, certificate, and export capabilities;
- expose official award winners through a privacy-safe Golden Board;
- preserve the publication embargo for School Exam results;
- support mobile-first, accessible, SEO-friendly public pages;
- preserve old bookmarks/navigation through a compatibility redirect.

## 4. Non-goals

V1 portal MUST NOT introduce:

- a separate `thi.tohieuquiz.vn` subdomain;
- cross-domain authentication;
- a general-purpose CMS;
- public full rankings;
- social comments or community features;
- a new Competition lifecycle;
- a new scoring engine;
- a replacement for Live Exam School Exam execution;
- a native mobile application;
- manual winner entry.

## 5. Existing canonical Competition baseline

The current backend is the source of truth and already contains:

- Campaign;
- frozen audience;
- six Competition rounds;
- eligibility;
- round attempts and materialized progress;
- School Exam event/room/member orchestration;
- certified capacity preflight;
- Live Exam provisioning;
- reconciliation;
- incident/retest;
- immutable/versioned publication;
- ranking;
- result correction and republish;
- certificate generation;
- asynchronous XLSX export.

The current canonical lifecycle is six rounds first, then eligibility, then School Exam. The portal MUST adapt to this lifecycle rather than creating another business state machine.

## 6. Three-zone architecture

Competition is separated into three presentation/security zones:

1. **Public Competition Portal** — `/cuoc-thi/**` — anonymous read-only access.
2. **Student Competition Portal** — `/thi/**` — authenticated student-only participation.
3. **Competition Admin** — `/teacher/competition/**` — authenticated Teacher/Admin with existing scoped authorization.

These zones may share visual primitives, DTO schemas, and domain adapters, but MUST NOT share an authorization boundary.

## 7. Route map

Canonical public routes:

- `/cuoc-thi`
- `/cuoc-thi/:campaignSlug`
- `/cuoc-thi/:campaignSlug/bang-vang`
- `/cuoc-thi/:campaignSlug/tin-tuc/:articleSlug`

Canonical student routes:

- `/thi/:campaignSlug`
- `/thi/:campaignSlug/vong/:roundNumber`
- `/thi/:campaignSlug/vong/:roundNumber/quy-che`
- `/thi/:campaignSlug/vong/:roundNumber/kiem-tra`
- `/thi/:campaignSlug/vong/:roundNumber/lam-bai`

Canonical staff route:

- `/teacher/competition`

All new Competition player routes remain under `/thi/**`; `/student/live-exam/:sessionId` is not the canonical public-facing Competition route.

## 8. Public portal access contract

`/cuoc-thi/**` is accessible to everyone without authentication.

Public requests MUST return only explicitly defined public DTOs. A public handler MUST NOT serialize or proxy the raw Admin/Teacher Competition model. Unknown, DRAFT, PREVIEW, or ARCHIVED pages MUST not disclose private campaign configuration through the public API.

Public page visibility is controlled by `CompetitionPublicPage.status`, not by `CompetitionCampaign.status` alone.

## 9. Public microsite shell

The public portal uses a dedicated microsite shell, not `StudentDashboardUI` or `TeacherDashboard`.

The shell contains:

- Competition brand/header;
- responsive navigation;
- primary CTA `VÀO THI`;
- campaign navigation when a campaign is selected;
- footer/legal links;
- skip link and keyboard-visible focus;
- no authenticated dashboard-only widgets.

The public shell may detect an existing student session to make the CTA smoother, but anonymous access remains fully supported.

## 10. `/cuoc-thi` index page

The index page contains:

- hero/banner for SÂN CHƠI TÔ HIỆU QUIZ;
- competitions currently running;
- upcoming competitions;
- completed competitions whose public page remains PUBLISHED, when configured for display;
- representative six-round journey;
- schedule highlights;
- latest news;
- rules and guides entry points;
- Golden Board entry point;
- CTA to student portal.

Campaign grouping is derived from public-page publication state plus campaign date/status data. Internal lifecycle values are mapped to public-friendly states such as `UPCOMING`, `ONGOING`, and `ENDED`.

## 11. Campaign public detail page

`/cuoc-thi/:campaignSlug` is the public campaign landing page.

It MUST support:

- hero/banner;
- campaign title and school year;
- public summary;
- six-round journey/timeline;
- published schedule content;
- published rules content;
- published guide content;
- published news/announcements;
- Golden Board CTA when enabled;
- `VÀO THI` CTA.

No private audience, eligibility, quiz mapping, room, attempt, reconcile, incident, retest, or export information may be present in its DTO.

## 12. Public Golden Board page

`/cuoc-thi/:campaignSlug/bang-vang` displays **official award winners only**.

Default mode:

`displayMode = AWARD_WINNERS`

Allowed winner fields are limited to:

- full name;
- class display name;
- school display name;
- grade level;
- award/achievement label.

The page MUST NOT expose full ranking rows or internal identifiers.

## 13. Public article page

`/cuoc-thi/:campaignSlug/tin-tuc/:articleSlug` renders one PUBLISHED `CompetitionArticle` belonging to the requested campaign.

Article types supported in V1:

- `ANNOUNCEMENT`
- `GUIDE`
- `RULES`
- `SCHEDULE`
- `RESULT`
- `AWARD`
- `CERTIFICATE`
- `INCIDENT_NOTICE`

V1 article `content` is stored as Markdown/plain rich text. Rendering MUST escape raw HTML, allow only the project-approved Markdown features, and allow only safe link/image URL schemes. Arbitrary HTML, scripts, inline event handlers, and executable embeds are forbidden.

## 14. Public page lifecycle

`CompetitionPublicPage` has an independent lifecycle:

`DRAFT → PREVIEW → PUBLISHED → ARCHIVED`

Rules:

- `DRAFT`: staff editing only;
- `PREVIEW`: staff/admin preview only, not anonymous discovery;
- `PUBLISHED`: available through anonymous public routes/APIs;
- `ARCHIVED`: removed from active public discovery and anonymous campaign APIs.

Publishing a campaign in Competition core does not automatically publish its public page. Archiving the public page does not mutate the Competition campaign lifecycle.

## 15. Student Competition shell

`/thi/**` uses a dedicated Competition shell outside `StudentDashboardUI`.

The shell MUST exclude unrelated distractions:

- dashboard menu;
- chat;
- shop;
- achievements;
- unrelated student navigation during an active exam.

Outside an active exam it may provide a minimal back link to the student dashboard.

## 16. Student authentication and role boundary

Every `/thi/**` route requires a valid Student session.

Teacher/Admin sessions MUST NOT be treated as Student sessions and MUST NOT be able to create a student attempt through the portal. Student identity MUST be derived from the authenticated session, never from body/query parameters supplied by the browser.

The existing ownership invariant remains mandatory: a student can access only campaigns/rounds/attempts that belong to that authenticated student.

## 17. Deep-link login return

When an anonymous user opens a student deep link under `/thi/**`:

1. preserve the requested relative `/thi/...` path as `returnTo`;
2. send the user to the existing login flow;
3. after successful Student login, validate that `returnTo` is an internal allowed path;
4. return to the exact original Competition URL.

Open redirects MUST be prevented. Absolute external URLs are never accepted as `returnTo`.

## 18. Student campaign home

`/thi/:campaignSlug` displays:

- campaign title and student-specific status;
- six-round journey;
- eligibility/result notices appropriate to the current canonical backend state;
- School Exam notice/entry when the canonical campaign has moved into the School Exam phase;
- official-result card only after publication;
- next actionable CTA.

The student DTO may contain internal campaign/round IDs because it is authenticated and ownership-scoped; the public DTO does not need them.

## 19. Six-round presentation states

The portal maps canonical round/progress data into exactly these UI states:

- `LOCKED`
- `OPEN`
- `PASSED`
- `FAILED_RETRY_AVAILABLE`
- `CLOSED`

This is presentation mapping only.

Mapping rules:

- `PASSED`: canonical progress says the student passed;
- `FAILED_RETRY_AVAILABLE`: round is OPEN, at least one attempt was used, not passed, and attempts remain;
- `OPEN`: round is OPEN, student is eligible to enter, and attempts remain;
- `CLOSED`: round is CLOSED/FINALIZED or attempts are exhausted without a pass;
- `LOCKED`: round is not yet enterable because it is not open or a canonical prerequisite/eligibility condition blocks entry.

The server remains authoritative. The client state is never an authorization decision.

## 20. Round page

`/thi/:campaignSlug/vong/:roundNumber` shows:

- round number/title;
- open/close time in campaign timezone;
- pass threshold when policy allows it to be disclosed;
- attempts used/remaining;
- current presentation state;
- rules CTA;
- preflight CTA;
- result summary for ordinary rounds when allowed.

The page MUST not include answer keys or hidden quiz snapshot fields.

## 21. Rules step

`/thi/:campaignSlug/vong/:roundNumber/quy-che` is a required UX step before preflight.

It renders the applicable published Competition rules/round instructions and a clear acknowledgment action. The acknowledgment is not treated as an authorization token. Server-side preflight and start-attempt validation are still required.

## 22. Entry preflight step

`/thi/:campaignSlug/vong/:roundNumber/kiem-tra` performs a **non-attempt-creating, server-side entry preflight**.

For an ordinary round it verifies at minimum:

- authenticated Student identity;
- campaign audience membership;
- round belongs to campaign;
- round is OPEN at server time;
- eligibility/prerequisite rules;
- attempt limit;
- valid quiz mapping for the student’s grade/class.

The preflight returns a stable status/reason DTO suitable for UI. It does not reserve a score, consume an attempt, or authorize a later request by itself.

## 23. School Exam participant checks

When the campaign is in the canonical School Exam phase, student entry additionally verifies:

- student is in the finalized qualified set for the event’s pinned eligibility version;
- active School Exam event is the canonical event for the campaign phase;
- student is an active member of an assigned School Exam room;
- room/session status permits check-in/start;
- server time is inside the allowed room window;
- room code/access code is valid when required;
- candidate/exam code is valid when configured;
- the School Exam has a successful certified capacity preflight;
- the room has been provisioned to a canonical `SCHOOL_EXAM_ROOM` Live Exam session.

The portal MUST reuse the existing School Exam/Live Exam orchestration. It MUST NOT create a second School Exam attempt/result model.

## 24. Attempt creation boundary

Clicking `VÀO THI` or entering the rules/preflight pages MUST NOT create an attempt.

For ordinary rounds the attempt is created only after successful preflight when the student explicitly starts the exam. The existing Competition attempt endpoint remains authoritative and MUST revalidate all critical conditions to prevent time-of-check/time-of-use bypasses.

For School Exam, the start action enters the already provisioned canonical Live Exam room/session for that student. It does not convert School Exam participation into an ordinary `competition_round_attempt`.

## 25. Dedicated Exam Player

`/thi/**/lam-bai` renders a dedicated Competition Exam Player.

The player MUST:

- reuse the existing `QuestionRenderer`;
- reuse existing quiz snapshot/scoring/submission contracts;
- render no dashboard menu, chat, shop, achievements, or unrelated navigation;
- preserve autosave/submission safeguards already used by the underlying exam engine;
- clearly show exam/round identity, progress, remaining time when applicable, and submit action;
- prevent accidental navigation during active submission using the project’s existing safe UX patterns.

No new scoring engine is created.

## 26. Submission and ordinary-round result behavior

Ordinary Competition rounds continue using existing Competition attempt submission semantics, including idempotency and server scoring.

After submission, the UI may show score/pass/result immediately only when the canonical round policy permits it. It MUST use the server response and current Competition result/progress state; it MUST not recompute authoritative scoring in the browser.

## 27. School Exam embargo behavior

School Exam result visibility remains:

`Exam → Reconcile → Publication → Ranking`

Before official Publication, the student MUST NOT receive official score/rank through the Competition portal or raw Live Exam result endpoints.

The post-submit message is:

> Bài thi đã được ghi nhận. Kết quả chính thức sẽ được công bố sau khi Ban tổ chức hoàn tất đối soát.

The existing `WITHHELD` behavior remains part of the security boundary.

## 28. Competition Admin responsibility

`/teacher/competition` remains the operational surface for Competition staff. Portal work extends it only where necessary to manage:

- public page draft/preview/publish/archive;
- public hero/SEO fields;
- Competition articles;
- Golden Board configuration;
- versioned award rules;
- public preview.

Existing campaign, round, audience, eligibility, School Exam, incident, retest, reconcile, publish, correction, ranking, certificate, and export operations remain in their current domain services.

Portal-content mutation API boundary:

- `GET|PUT /api/competitions/:campaignId/public-page` — staff read, Admin mutation;
- `POST /api/competitions/:campaignId/public-page/preview` — Admin mutation, returns staff-only preview DTO/URL;
- `POST /api/competitions/:campaignId/public-page/publish` — Admin only;
- `POST /api/competitions/:campaignId/public-page/archive` — Admin only;
- `GET|POST /api/competitions/:campaignId/articles` — scoped staff read, Admin create;
- `GET|PATCH|DELETE /api/competitions/:campaignId/articles/:articleId` — scoped staff read, Admin mutation;
- `GET|PUT /api/competitions/:campaignId/golden-board-config` — scoped staff read, Admin mutation;
- `GET|POST /api/competitions/:campaignId/award-rules` — scoped staff read, Admin creates a new version;
- `POST /api/competitions/:campaignId/award-rules/:version/activate` — Admin only.

Teacher access to the admin surface does not imply publication/mutation permission. Existing Competition staff scoping remains in force.

## 29. Public aggregate relationship

The public content relationship is:

```text
CompetitionCampaign
      │ 1:1
      ▼
CompetitionPublicPage
      ├── CompetitionArticle[]
      ├── GoldenBoardConfig 1:1
      └── AwardRule[] (versioned configuration)
```

The public aggregate references Competition core by `campaign_id` but does not own or mutate Competition core lifecycle data.

## 30. `CompetitionPublicPage` data model

A dedicated table/model stores public presentation state. Minimum fields:

- `id`
- `campaign_id` — unique foreign key to `competition_campaigns.id`;
- `slug` — globally unique, lowercase URL slug;
- `status` — `DRAFT | PREVIEW | PUBLISHED | ARCHIVED`;
- `hero_title`;
- `hero_subtitle`;
- `hero_image_url`;
- `summary`;
- `cta_label` with default `VÀO THI`;
- `seo_title`;
- `seo_description`;
- `og_image_url`;
- `published_at`;
- `archived_at`;
- `created_by`, `created_at`, `updated_by`, `updated_at`.

Slug changes are allowed only before first PUBLISHED state. After first publish the canonical slug is stable to avoid breaking indexed URLs/bookmarks.

## 31. `CompetitionArticle` data model

Minimum fields:

- `id`
- `campaign_id`
- `title`
- `slug`
- `summary`
- `cover_image_url`
- `content`
- `type`
- `status` — `DRAFT | PUBLISHED | ARCHIVED`;
- `published_at`
- `updated_at`
- creator/updater audit fields.

`(campaign_id, slug)` MUST be unique. Anonymous APIs return only PUBLISHED articles whose parent public page is PUBLISHED.

This remains a Competition-specific lightweight content model, not a platform CMS.

## 32. `GoldenBoardConfig` data model

One Golden Board config belongs to one campaign. Minimum fields:

- `campaign_id` — unique;
- `source_event_id` — one School Exam event belonging to the same campaign;
- `enabled`;
- `display_mode` — V1 accepts only `AWARD_WINNERS`;
- `title`;
- `award_rule_version`;
- `updated_by`;
- `updated_at`.

`source_event_id` MUST reference a School Exam event whose `campaign_id` matches the config campaign. `award_rule_version` MUST reference a rule version for the same campaign. The config does not contain winner names or manually entered result rows.

## 33. Versioned Award Rules

Award winners are derived from official rankings through versioned rules rather than manual entry.

Each award rule contains:

- `campaign_id`;
- `version`;
- `scope` — `EVENT` or `GRADE`;
- optional `grade_level` when scope is `GRADE`;
- `rank_from`;
- `rank_to`;
- stable `award_code`;
- public `award_label`;
- `sort_order`;
- rule-set status/audit metadata.

Rules in one active version MUST not overlap for the same scope/grade. Official tie ranks receive the same award when the tied rank falls inside the configured range.

Golden Board reads the configured active rule version. Changing award policy creates a new version instead of silently rewriting historical rule meaning.

## 34. Golden Board derivation pipeline

The only valid public winner pipeline is:

```text
School Exam
→ Reconcile
→ Canonical Official Results
→ Publication
→ Ranking
→ Versioned Award Rules
→ Public Golden Board DTO
```

The derivation MUST read the latest valid PUBLISHED School Exam publication/ranking version for `GoldenBoardConfig.source_event_id` and apply the configured award rule version. `source_event_id` MUST belong to the same campaign, so multiple historical School Exam events cannot make source selection ambiguous.

There is no admin endpoint that accepts a list of winner student IDs or names.

## 35. Correction and republish consistency

When `Result Correction + Republish` creates a newer official publication/ranking version for the configured `source_event_id`:

- Golden Board MUST stop serving winners from the older current version;
- the next read/projection MUST derive from the newest PUBLISHED publication version;
- cache keys, if used, MUST include `publicationVersion` and `awardRuleVersion`;
- the public DTO SHOULD expose these source versions as non-sensitive consistency metadata for diagnostics.

A Golden Board cache/projection is disposable. The official publication/ranking remains the source of truth.

## 36. Golden Board privacy boundary

Golden Board public DTOs use an explicit allowlist. They MUST NOT contain:

- username;
- internal `studentId`;
- email;
- phone number;
- parent/guardian data;
- raw answers;
- attempt history;
- incident data;
- retest data;
- reconcile data;
- room identifiers/codes;
- internal result IDs;
- internal class IDs;
- export/certificate storage paths.

`className`, `gradeLevel`, and `schoolName` are display values only. `schoolName` is resolved from canonical organization/school configuration, not accepted as arbitrary winner input.

## 37. Public API contract

Anonymous API surface:

- `GET /api/public/competitions`
- `GET /api/public/competitions/:slug`
- `GET /api/public/competitions/:slug/articles`
- `GET /api/public/competitions/:slug/articles/:articleSlug`
- `GET /api/public/competitions/:slug/golden-board`

Rules:

- no session required;
- Worker routing dispatches `/api/public/competitions/**` through a dedicated read-only public handler before the authenticated `/api/competitions` and `/api/student/competitions` handlers; public routes never inherit staff DTO serialization or mutation code;
- only PUBLISHED public pages/articles are visible;
- stable public DTOs are defined separately from staff DTOs;
- unknown/non-public resources return a generic public not-found response;
- list endpoints are bounded and paginated where result count can grow;
- article and board responses include safe cache validators when practical.

## 38. Public DTO shapes

Public competition summary contains only presentation fields such as:

- `slug`, `title`, `summary`, `schoolYear`;
- derived public state;
- `startsAt`, `endsAt`, `timezone`;
- hero image;
- safe round schedule summaries;
- content/Golden Board availability flags.

Public campaign detail may additionally include six round display windows and selected published article summaries.

Golden Board winner contains only:

- `fullName`;
- `className`;
- `schoolName`;
- `gradeLevel`;
- `awardCode`;
- `awardLabel`.

No generic serializer from database row to public JSON is permitted.

## 39. Student API adapter and slug resolution

Current authenticated Competition APIs are campaign-ID based. The new URL is slug-based.

The authenticated resolver endpoint is `GET /api/student/competitions/by-slug/:campaignSlug`.

The student portal uses this thin slug resolver/portal adapter to:

1. resolve `CompetitionPublicPage.slug` to canonical `campaign_id`, including non-public page states when the authenticated student is legitimately in the campaign;
2. check Student audience membership;
3. return the existing student campaign/progress DTO plus portal presentation metadata;
4. use canonical IDs only inside authenticated calls after resolution.

Existing attempt/submit/official-result services remain the source of truth. The adapter MUST NOT duplicate attempt, eligibility, result, or ranking logic.

## 40. Student entry preflight API boundary

The implementation adds Student-owned preflight endpoints in the existing Competition student namespace. They MUST be non-mutating with respect to attempts/results:

- `POST /api/student/competitions/:campaignId/rounds/:roundId/preflight` for ordinary rounds;
- `POST /api/student/competitions/:campaignId/school-exam/preflight` for the post-six-round School Exam phase.

The School Exam preflight resolves the configured/provisioned room/session server-side. After READY, the actual School Exam join continues through existing `POST /api/live-exam/join`; that handler still derives Student identity from the authenticated session and remains authoritative for canonical Live Exam participation.

Preflight returns:

- `status: READY | BLOCKED`;
- stable reason codes;
- current server time/window summary;
- attempts remaining for ordinary rounds;
- safe School Exam check-in metadata when applicable.

The subsequent start/join endpoint MUST independently revalidate all critical checks. A preflight response is not a bearer authorization credential.

## 41. Route security matrix

Security classification is fixed:

| Route | Access |
|---|---|
| `/cuoc-thi/**` | PUBLIC |
| `/thi/**` | STUDENT AUTH REQUIRED |
| `/teacher/competition/**` | TEACHER / ADMIN according to existing scopes |
| `/api/public/competitions/**` | PUBLIC READ DTO ONLY |
| `/api/student/competitions/**` | STUDENT-OWNED |
| `/api/competitions/**` | existing staff/admin policy |
| `/api/school-exams/**` | existing scoped staff/admin policy |

Frontend route guards are UX. Worker/API authorization is the security boundary.

## 42. Error and status behavior

Portal-facing errors use stable codes and safe messages.

Examples include:

- public page/article not found;
- student not in campaign audience;
- round not open;
- attempt limit reached;
- quiz mapping unavailable;
- School Exam room/member not ready;
- School Exam preflight required;
- result withheld;
- publication not found.

Authorization errors MUST not reveal whether an unrelated campaign, room, result, or article draft exists.

Transient network failure MUST be distinguishable from business-rule blocking so students are not incorrectly told they are ineligible.

## 43. Caching and freshness

Public competition/article content may use short public caching with ETag/Last-Modified semantics.

Golden Board freshness is stricter:

- cache identity includes campaign slug, latest PUBLISHED publication version, and award rule version;
- republish invalidates or naturally misses the prior key;
- no stale-while-revalidate behavior may intentionally continue presenting an older winner set after the system knows a newer official publication exists.

Authenticated student preflight, attempt, and result reads are not treated as anonymous cacheable content.

## 44. Legacy compatibility and migration

Database migration for the portal adds only the public/content/award configuration tables and indexes required by sections 30–33; it does not rewrite Competition core result tables. Existing campaigns receive one DRAFT `CompetitionPublicPage` during backfill. The slug is generated deterministically from campaign title/school year with a stable collision suffix, and the migration MUST be rerunnable without changing an already-created slug.

Current `/student/competition` is a legacy compatibility entry point.

Rollout behavior:

- keep the route temporarily;
- when the new portal feature is enabled, redirect it to the appropriate `/thi/:campaignSlug` destination or to a Competition chooser if multiple student campaigns are active;
- preserve query-safe internal `returnTo` behavior;
- update student navigation to use the new canonical `/thi/**` route;
- do not delete legacy route handling until bookmarks/navigation tests confirm compatibility.

Current `/student/live-exam/:sessionId` may remain for non-Competition Live Exam. Competition School Exam links must migrate to the dedicated Competition shell rather than globally changing unrelated Live Exam behavior.

## 45. Rollout and feature flags

Portal rollout MUST be reversible without disabling Competition core.

Recommended independent gates:

- public portal read routes/API;
- student dedicated portal;
- legacy Competition redirect;
- Golden Board publication;
- admin public-content editing.

A disabled portal must leave existing Competition backend data and staff operations intact. The rollout plan MUST include staging smoke tests before enabling production navigation.

## 46. Mobile, accessibility, and SEO

**Mobile-first** is mandatory. Primary actions must work comfortably on phone-width layouts and touch targets must be sufficiently large.

Accessibility requirements:

- semantic heading hierarchy;
- keyboard navigation;
- visible focus;
- accessible names/labels;
- status conveyed by text/icon, not color alone;
- reduced-motion support;
- accessible dialogs/alerts;
- no keyboard trap in exam player;
- time/status announcements must avoid excessive screen-reader noise.

Public SEO requirements:

- title;
- meta description;
- canonical URL;
- OpenGraph metadata;
- discoverable sitemap entries for PUBLISHED public pages/articles;
- archived/non-public content removed from active sitemap.

`/thi/**` MUST be `noindex` and excluded from public sitemap.

## 47. Observability, audit, and testing

Staff mutations for public page, article, Golden Board config, award rule version, publish/archive MUST be auditable with actor, target, timestamp, request ID when available, and before/after safe metadata.

Minimum test coverage:

- public API anonymous positive/negative cases;
- DRAFT/PREVIEW/ARCHIVED non-disclosure;
- public DTO forbidden-field tests;
- student role and ownership matrix;
- deep-link login return and open-redirect prevention;
- round-state presentation mapping;
- preflight creates no attempt;
- start/join revalidation after preflight;
- School Exam room/member/window/access checks;
- School Exam result embargo before publication;
- Golden Board derives only PUBLISHED latest version;
- correction + republish changes Golden Board source version;
- tie-aware award rule tests;
- Golden Board source-event cross-campaign rejection;
- no manual winner path;
- legacy redirect behavior;
- responsive route smoke tests;
- keyboard/accessibility regression tests;
- SEO/noindex metadata tests.

Existing Competition/School Exam regression suites MUST remain green.

## 48. Acceptance criteria and implementation guardrails

The design is complete when implementation can satisfy all of the following without changing the approved architecture:

1. Anonymous users can browse `/cuoc-thi` and a PUBLISHED campaign without login.
2. Anonymous users cannot obtain any private Competition/Admin fields from public APIs.
3. Student deep links return to the same `/thi/**` URL after successful Student login.
4. `/thi/**` renders outside `StudentDashboardUI`.
5. Teachers/Admins cannot create student attempts by using the student portal/API.
6. The six-round journey uses the five approved presentation states without creating a new business lifecycle.
7. Rules and preflight occur before attempt creation.
8. Preflight does not create/consume an attempt and start/join revalidates server-side.
9. Exam Player reuses current renderer/scoring/submission contracts and contains no distracting dashboard features.
10. School Exam keeps canonical Live Exam provisioning and WITHHELD result security.
11. School Exam students see no official result/ranking before Publication.
12. Golden Board contains only award winners derived from official latest PUBLISHED ranking plus versioned award rules.
13. No admin workflow can manually type/select winner records as the source of truth.
14. Result Correction + Republish automatically changes the Golden Board source publication version.
15. `/student/competition` remains a compatibility redirect during rollout.
16. Public pages meet mobile/accessibility/SEO requirements and `/thi/**` is noindex.
17. Existing Competition core, School Exam, ranking, correction, certificate, and XLSX behavior is not rebuilt.
18. Production code implementation does not start until this written spec is approved and a detailed implementation plan has been produced with `superpowers:writing-plans`.

---

**Design decision summary:** Public content, authenticated student participation, and staff administration are separate presentation/security zones over one canonical Competition backend. Public-page publication is independent of campaign publication. Golden Board is a privacy-safe projection from the latest official publication/ranking and versioned award rules. Student entry is server-authorized and attempt creation occurs only after preflight. School Exam remains backed by the existing School Exam + Live Exam pipeline and preserves result withholding until official publication.
