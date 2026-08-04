# End-to-end testing — TôHiệuQuiz

Cypress specs fall into three categories. They are **not** interchangeable: two of
them need a running backend, and one of them needs a specific feature-flag
combination. Running everything in one pass will always produce failures.

## 1. Stubbed specs — run anywhere, run in CI

Every API call is stubbed with `cy.intercept`, so these need nothing but the Vite
dev server on `http://localhost:3001`.

| Spec | Requires |
|---|---|
| `ai-question-blueprint-v3.cy.ts` | `VITE_FEATURE_AI_BLUEPRINT_V3=true` |
| `ai-svg-diagrams.cy.ts` | `VITE_FEATURE_AI_QUIZ_V2=true`, `VITE_FEATURE_AI_BLUEPRINT_V3=true`, `VITE_FEATURE_AI_SVG_DIAGRAMS=true` |
| `ai-quiz-generation-v2.cy.ts` | `VITE_FEATURE_AI_QUIZ_V2=true` and **`VITE_FEATURE_AI_BLUEPRINT_V3=false`** |
| `gift-shop.cy.ts` | `VITE_FEATURE_GIFT_SHOP_V2=true` |
| `manual-quiz-workspace.cy.ts` | default flags |
| `mobile-responsive.cy.ts` | default flags |
| `parent-portal.cy.ts` | `VITE_FEATURE_PARENT_PORTAL_V1=true` |
| `question-scoring-matrix.cy.ts` | default flags; covers all 14 published question types |
| `unified-notifications.cy.ts` | default flags |

`question-scoring-matrix.cy.ts` drives the real student renderers, submits their raw
answer payload to the shared `gradeQuiz` engine through a stubbed `/api/validate`
response, and verifies the authoritative result screen shows `14/14` and `10/10`.
This locks the browser-to-grader contract without exposing correct answers in the
application runtime or requiring a seeded backend.

### The AI flag conflict

`ai-quiz-generation-v2.cy.ts` asserts the V2 pipeline's stage sequence
(`OCR → GENERATE → REPAIR → REVIEW`) and its review screen. Blueprint V3 replaces
that pipeline — `useCreateQuizLogic` computes
`aiBlueprintV3Enabled = aiQuizV2Enabled && isAiBlueprintV3Enabled()` — so with V3
enabled the REPAIR stage never runs and the "Lưu đề" button never appears.

Measured on 2026-07-26:

| `VITE_FEATURE_AI_BLUEPRINT_V3` | `ai-quiz-generation-v2.cy.ts` | `ai-question-blueprint-v3.cy.ts` |
|---|---|---|
| `true` | 2 passing, **3 failing** | 2 passing |
| `false` | **5 passing** | (not applicable) |

This is expected behaviour, not a defect: each spec pins one side of the flag. CI
therefore runs the suite as isolated jobs (`e2e-stubbed`, `e2e-blueprint-v3`, and
`e2e-svg-diagrams`), not several steps sharing one Vite process.

`ai-svg-diagrams.cy.ts` verifies the complete opt-in path with HTTP stubs: teacher
enables the native checkbox, the V3 slot table carries `diagramPolicy`, the SVG is
shown through an `<img>` data URL, the save payload retains all three SVG fields,
and a 320px student session reloads, displays and submits the same question without
horizontal overflow. The spec imports the deterministic V3 audit and rejects its
own generated fixture if it no longer matches the real contracts.

Two steps in one job does not work: `cypress-io/github-action` leaves its `start`
server running, so the second step finds port 3001 occupied, Vite silently moves to
another port, and Cypress keeps talking to the *previous* server — built with the
wrong flag — until it dies with `ECONNREFUSED`. Separate runners make the isolation
real.

### Gift Shop: stubbing at the HTTP layer, and proving the stub still tests something

`gift-shop.cy.ts` covers the flag's whole reason to exist — student spends coins,
gets a voucher, teacher delivers it or cancels and refunds — without a backend.
`VITE_GIFT_SHOP_MODE=api` in both CI and production, so the real path runs over
HTTP to `/api/gift-shop/*`; stubbing there keeps `giftShopService → apiAdapter →
fetch` intact and pins the request/response shapes that unit tests never touch.

Two traps for whoever edits it next:

- **The two endpoint families use different response envelopes.**
  `/api/student-profile` goes through `callWorkerApi` and must be wrapped as
  `{ status: 'success', data }`; `/api/gift-shop/*` goes straight through
  `executeApiAction`, which returns `response.json()` verbatim. Wrapping the
  latter breaks it.
- **Fixtures must be copied per test, not just the array.** The deliver and cancel
  handlers mutate `status` on the order object, so a shallow `[...seedOrders]`
  lets one test leave the next one with no pending order. This was caught by the
  suite itself, not by review.

A fully stubbed spec can easily end up testing only its own stubs, so the
discrimination was measured rather than assumed:

| what was broken | result |
|---|---|
| `VITE_FEATURE_GIFT_SHOP_V2=false` | 3 of 3 fail |
| `idempotencyKey` dropped from the purchase payload in `apiGiftShop.ts` | test 1 fails |

## 2. Live-environment specs — need a real backend, a real student, **and practice content**

These log in for real and assert against live data. They fail fast in a stubbed run
with `studentUsername is required`.

- `student-dashboard-responsive.cy.ts`
- `student-practice-library.cy.ts`

### A student account is not enough

Measured against production on 2026-07-26 with a real student account on an empty
database: **1 of 13 tests passed**. Every failure traced to one missing element,
`[data-testid="subject-practice-grid"] button`.

`buildPracticeCatalog()` marks a subject `available` only when `questionCount > 0`,
and that count comes from `GET /api/practice/topics`, which reads hashtags out of
`questions.tags`. With no tagged questions, every subject renders in the "Sắp có"
list as plain `Đang chuẩn bị` text, `availableSubjects` is empty, and
`SubjectPracticeGrid` never renders the grid the specs click into.

So the environment needs at least one question whose `tags` contains a hashtag
matching a subject alias in `SUBJECT_CONFIG` (`src/features/student-dashboard/model/dashboardConstants.ts`)
— e.g. `#toan` for Toán học. Seed that before blaming the specs.

### Both specs pass again — and why they had rotted

Measured 2026-07-26 after the fix: **13/13 green** against production
(`student-dashboard-responsive` 5/5, `student-practice-library` 8/8).

Three spec-side defects were repaired. They are worth knowing because the same
mistakes are easy to reintroduce:

1. **Assertions bound to Vietnamese copy that changes with state.**
   `assertNoDistractingPulse()` matched a button by
   `/Điểm danh nhận thưởng|Đã điểm danh hôm nay/`, but the attendance label comes
   from `getAttendanceBadgeText()` and has three forms
   (`Đã điểm danh hôm nay`, `Đang tải câu hỏi điểm danh...`,
   `Điểm danh ngày N: +X Xu +Y EXP`); `Điểm danh nhận thưởng` is none of them —
   it only exists in a `<p>` inside `AttendanceModal`. Now selects
   `[data-testid="attendance-check-in"]`.
2. **DOM aliases read after navigation or re-render.** Cypress re-queries DOM
   aliases, so an alias whose element is gone resolves to an empty set.
   `openFirstAvailableSubject()` hit this by reading a title alias after clicking
   through to the subject route, and the loading test hit it again by aliasing a
   topic button on its `Luyện 10 câu` text and re-reading it after the click — the
   click swaps that text to `Đang chuẩn bị...`, so the re-query landed on a
   different, idle card. Titles now go into plain variables and topic cards are
   addressed by `[data-testid="practice-topic-card"]`.
3. **Scroll position surviving client-side navigation.** `src/` had no
   scroll-reset on route change, so after scrolling to `#practice-library` on the
   dashboard the subject page opened mid-page with its sticky header above the
   viewport. At 375px the leftover scroll was large enough that the `h1` sat at
   `top: -324` and Cypress correctly called it invisible. Note the document itself
   measured `scrollWidth === clientWidth === 360`, i.e. there was never any
   horizontal overflow — the layout was fine, only the scroll position was wrong.

   This one was a real product bug, not a stale spec, so the helper carried a
   `win.scrollTo(0, 0)` workaround until it was fixed for real by
   `useScrollReset` (`src/app/useScrollReset.ts`). That workaround is now an
   assertion — `cy.window().its('scrollY').should('equal', 0)` — so the line that
   used to hide the bug is the line that proves it stays fixed. Two tests were
   added alongside it: browser Back and the in-app "Trở về thư viện" button both
   have to put the dashboard back at the offset the student left it, within 50px.

   Worth copying as a habit: when a spec needs a workaround to go green, make the
   workaround the thing you delete first once the product is fixed, and replace it
   with the assertion it was suppressing.

### Not every navigation can show the scroll bug

`route-scroll.cy.ts` covers the same fix without credentials, but only one of its
three tests actually discriminates. Measured on the dev server with the scroll
reset removed from the app entirely:

| navigation | `scrollY` with no fix | catches the bug? |
|---|---|---|
| `/` → `/about` | 0 | no |
| `/about` → `/contact` | 1466 | **yes** |
| Back to `/` | restored correctly | no |

The first hop out of the landing page self-corrects: `/about` is a `React.lazy`
route, `<PageLoading/>` renders first and collapses the document to one viewport
(`scrollHeight` 2370 → 812, measured at 375x812), so the browser clamps `scrollY`
to the new maximum — zero — before the real content arrives. Back self-corrects
too, because `history.scrollRestoration` defaults to `auto`.

Only the lazy → lazy hop keeps the old offset and exposes the bug, so that is the
test carrying the weight. The other two are regression guards, and the file says so
in a comment. Do not repoint this spec at a different pair of routes without
re-measuring — the obvious-looking navigations are exactly the ones that pass on
their own.

`/student/practice/:subjectId` shows the bug for a different reason: it and `/` are
both rendered by `RootView` with no Suspense boundary between them, so the document
never collapses. That path needs a real student account, which is why
`student-practice-library.cy.ts` still carries the assertion for the flow that was
actually reported.

Prefer `data-testid` over Vietnamese copy in these two specs, and never read a DOM
alias across a navigation.

### Two tests were passing without testing anything

A separate audit of every assertion found two **false greens** — worse than red
tests, because they report coverage that does not exist. Both are fixed, and both
fixes were verified by measurement rather than reasoning:

1. **The coming-soon guard asserted a tautology.** `cy.contains(selector, text)`
   yields the element matching the *selector* that contains the text, and only one
   element carries `#practice-library` — the `<section>`. So
   `cy.contains('#practice-library', 'Đang chuẩn bị').should('not.match','button')`
   asserted that a `<section>` is not a `<button>`, and `.parents('button')`
   asserted the section has no button ancestor. Both are always true, so the guard
   could never catch the thing it exists to prevent: a coming-soon row becoming
   clickable. Measured: the old selector returns `SECTION#practice-library`, the
   new `#practice-library li` returns the `LI` row. The guard now also asserts the
   row contains no `<button>`.
2. **The reduced-motion test never applied its own emulation.**
   `Cypress.automation()` is not a queued command — it runs as soon as its
   argument expression is evaluated. Both the set and the reset call sat in
   `cy.wrap(...)` argument position, so they fired back to back before `cy.visit()`
   and cancelled out. The test still passed because Cypress's headless browser
   already reports `prefers-reduced-motion: reduce` by default; on a browser
   defaulting to no-preference it would have failed. Measured: with
   `no-preference` emulated from a queued step, `matchMedia(...).matches` flips to
   `false` and the first dashboard button's `transition-duration` goes from
   `1e-05s` to `0.2s` — which also proves the app's reduce styling is what
   produces the near-zero duration. The emulation calls are now enqueued, and the
   test asserts the reduced-motion state is actually active before measuring, so a
   silent no-op fails loudly instead of passing.

Run them against a deployed environment with a throwaway student account:

```bash
npx cypress run --e2e \
  --spec "cypress/e2e/student-dashboard-responsive.cy.ts,cypress/e2e/student-practice-library.cy.ts" \
  --config baseUrl=https://www.thtohieu.com \
  --env studentUsername=<code>,studentPassword=<pin>
```

Never commit those credentials, and never point them at a real pupil's account.

## 3. Quarantined specs

- `quiz.cy.ts` — inherited from the source system. It asserts the old school
  branding and a "Dành cho Giáo viên" link that no longer exist, and it logs in with
  `admin`/`admin` against a live backend. Both `describe` blocks are `.skip`ped with
  the reasoning in the file header. Rewrite or delete it; do not un-skip as-is.

## Commands

```bash
# Everything CI runs (stubbed only) — needs `npm run dev` in another terminal
npm run cypress:run:stubbed
npm run cypress:run:blueprint-v3   # with VITE_FEATURE_AI_BLUEPRINT_V3=true
npm run cypress:run:svg-diagrams   # with V2 + V3 + SVG flags enabled

# Component tests
npm run cypress:run:component
```

## Component specs

`cypress/component/**` mounts components directly through the Vite dev server and
needs no flags:

- `announcement-composer-layout.cy.tsx`
- `console-hygiene.cy.tsx`
- `math-rendering.cy.tsx`
- `result-report-delivery.cy.tsx`
- `student-dropdown-menu.cy.tsx`
