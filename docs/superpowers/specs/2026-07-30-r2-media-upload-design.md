# R2 Media Upload Design

Date: 2026-07-30

## Goal

Replace direct browser-to-Cloudinary uploads with an authenticated Cloudflare Worker upload flow backed by the existing public R2 asset bucket. The first consumers are homework assignment media, student homework submissions, and quiz-question images.

## Architecture

`Browser -> POST /api/media/uploads -> JWT/session validation -> file validation -> R2 put -> assets.thtohieu.com URL`

The frontend sends the file as the raw request body so upload progress remains measurable without multipart parsing. The request carries only non-secret metadata in headers:

- `Content-Type`
- `X-File-Name`
- `X-Media-Purpose`

Supported purposes:

- `homework-assignment`: teacher/admin; JPG, PNG, WebP, PDF.
- `homework-submission`: student, teacher or admin; JPG, PNG, WebP.
- `quiz-question`: teacher/admin; JPG, PNG, WebP.

## Storage

Reuse the public `OG_IMAGES` R2 binding and isolate uploaded files under the `media/` prefix. This avoids a new bucket/domain migration while preserving clear key ownership.

Example key:

`media/homework-submission/student/2026/07/<uuid>.webp`

The server generates every key. Client filenames and user identifiers never appear in the public path. R2 objects receive immutable cache metadata and minimal custom metadata for operational tracing.

## Security controls

- Explicit API authorization policy and route-handler role checks.
- Cookie/JWT validation through `verifyJWTMiddleware`.
- Closed rate limit for upload requests.
- Maximum 10 MiB per request, checked using both `Content-Length` and actual bytes.
- MIME allowlist by purpose and role.
- Magic-byte verification for JPEG, PNG, WebP and PDF.
- Extension derived from verified MIME, not from the uploaded filename.
- Original filename sanitized and stored only as bounded metadata.
- API response is `no-store`; the R2 object itself is immutable public media.
- Existing Cloudinary URLs remain accepted for old homework records during migration.

## API response

```json
{
  "status": "success",
  "data": {
    "url": "https://assets.thtohieu.com/media/...",
    "key": "media/...",
    "contentType": "image/webp",
    "size": 12345
  }
}
```

## Frontend migration

Create `mediaUploadService.ts` with compression and raw-body XHR upload. Migrate all current direct Cloudinary consumers. The service always includes credentials and reports upload progress. No Cloudinary environment variables are required after migration.

## Compatibility

- Existing persisted `res.cloudinary.com` homework URLs remain valid.
- CSP already permits `assets.thtohieu.com`.
- No D1 migration is required because current records store media URLs as strings.
