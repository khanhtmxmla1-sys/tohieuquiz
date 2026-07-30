# R2 Media Upload Implementation Plan

> Execute in the isolated `feat/r2-media-upload` worktree using TDD.

## Task 1: Worker upload contract

1. Add failing tests for successful authenticated R2 upload, role/purpose rules, size limits, unsupported MIME, spoofed signatures and missing binding/config.
2. Add an explicit `/api/media/uploads` authorization policy.
3. Implement `handleMediaUploadRoutes` with JWT validation, purpose/role validation, magic-byte checks, server-generated keys and `OG_IMAGES.put`.
4. Wire the handler and a closed upload-specific rate limit into `createWorkerFetch` and Worker dependencies.
5. Run targeted Worker tests and worker typecheck.

## Task 2: Frontend upload client

1. Add failing unit tests for raw-body upload URL, credentials, headers, progress, success parsing and safe error handling.
2. Create `src/services/mediaUploadService.ts` using `getWorkersApiBaseUrl()` and XHR.
3. Keep compression in the new service.
4. Run targeted frontend tests and typecheck.

## Task 3: Consumer migration

1. Migrate homework assignment upload to purpose `homework-assignment`.
2. Migrate student homework submission to purpose `homework-submission`.
3. Migrate manual quiz media and image library to purpose `quiz-question`.
4. Remove the Cloudinary upload implementation and obsolete Vite environment declarations.
5. Update homework media URL allowlist to accept `assets.thtohieu.com` while retaining legacy Cloudinary URLs.
6. Update affected tests and run targeted regression suites.

## Task 4: Configuration and verification

1. Document R2 media prefix use and remove Cloudinary-production setup tasks.
2. Run lint, frontend/worker typecheck, changed tests, production build and security checks.
3. Run GitNexus `detect_changes` and review the final diff.
4. Commit on `feat/r2-media-upload`; do not deploy until release gates pass and the user requests deployment.
