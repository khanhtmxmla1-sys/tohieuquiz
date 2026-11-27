# Competition route dispatch refactor

Baseline for characterization is `78e204b`. This package preserves the public handler signature and the existing request, response, and authorization behavior.

1. Use the isolated `codex/refactor-competition-route-dispatch` worktree. Record GitNexus impact for each existing symbol moved or edited. The observed HIGH result for `teacherClassIds` was disclosed. The approved adjustment keeps its implementation in the facade. Child handlers use a lazy callback at the original query sites.
2. Add characterization tests and run them against the baseline router. RED → GREEN is N/A for this behavior-preserving extraction. Assert role and rollout gates, portal precedence, class-query timing, validation, response envelopes, and logging. Run the existing SQLite-backed portal/class-scope and school-exam suites alongside the new tests.
3. Extract path parsing, JSON body parsing, and error mapping into `routeSupport.ts`. Preserve differing decode behavior and existing error codes.
4. Extract student routes into `studentRoundRoutes.ts` after the existing student role, identity and portal checks.
5. Extract school exam routes into `schoolExamRoutes.ts` and remaining staff competition routes into `staffCompetitionRoutes.ts`. Keep mutation permissions and the two teacher exceptions in `index.ts`. Preserve portal → school exam → staff order, the original query sites, and asynchronous rejection mapping.
6. Re-run characterization and existing route suites. Run lint, typechecks, build and security gates. Review the actual moved bodies, caller scope, and GitNexus change detection against main.
7. Present the exact diff for approval before commit and push. Require CI and code-owner review before merging. Take separate production approval for the verified Worker artifact. Verify deployment SHA and smoke on read-only endpoints. Roll back to the previous known-good Worker version if the refactor causes a regression.

Scope is the five router files, the parity test file, and this plan. Service behavior, schemas, scoring, database migrations, and flag values are outside the scope.
