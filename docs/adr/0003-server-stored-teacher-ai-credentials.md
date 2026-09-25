# ADR 0003: Server-stored teacher AI credentials

**Status:** Accepted for implementation; production rollout remains disabled pending separate approval.

## Context

Teachers need to reuse one Gemini API key and one DeepSeek API key across devices without placing plaintext credentials in browser storage. TôHiệuQuiz already routes shared AI traffic through the Worker, has authenticated teacher sessions, D1, feature flags, quota/stage policy, and a system AI gateway.

The new capability changes a trust boundary: a teacher's provider key and AI prompt content pass through the TôHiệuQuiz Worker. The design therefore must prevent cross-account key access, avoid plaintext persistence/logging, fail closed when the vault is unavailable, and preserve the existing system-AI path.

## Decision

1. Store credentials in D1 as AES-256-GCM ciphertext only.
2. Keep the encryption keyring only in the Worker secret `AI_CREDENTIAL_KEYRING`; it is independent from JWT, gateway, and provider secrets.
3. Use a fresh random 96-bit IV per encryption and a 128-bit GCM tag.
4. Bind ciphertext with AAD `['teacher-ai-key', 1, username, provider]`. Copying a row to another owner or provider must make decryption fail.
5. Permit one credential per `(username, provider)` with optimistic `version` checks for replace/delete.
6. Derive owner exclusively from the authenticated session. No API accepts an owner username or arbitrary upstream URL.
7. Personal AI traffic goes Worker → Google/DeepSeek directly with server-pinned endpoint/model. It never falls back to the shared gateway or another provider.
8. Bind `source`, credential version, and model to the AI action on first use. Review/repair/regenerate cannot silently switch provider or a replaced/deleted key.
9. V1 is text-only: no PDF/Word upload, image input, OCR, web search, or image generation for personal sources. Existing system AI retains those capabilities.
10. Keep the current daily teacher action quota and stage policy for all sources.
11. Seed `teacher_ai_byok_v1` disabled with teacher audience and zero rollout. GET metadata and DELETE remain available while disabled; save/test/personal inference fail closed.
12. API responses contain metadata only (`configured`, `last4`, versions/timestamps). Plaintext, ciphertext, IV, key id, provider Authorization headers, and raw upstream errors are never returned.
13. Rotation is an internal batch operation only. No public export/decrypt endpoint is introduced.

## Consequences

### Positive

- A teacher enters a key once and can use it on another signed-in device.
- Database-only exposure does not reveal plaintext provider keys without the Worker keyring.
- Key replacement/deletion races are explicit conflicts rather than silent overwrites.
- System AI behavior remains backward-compatible when `source` is absent (`system`).
- A kill switch can stop new BYOK use without deleting encrypted credentials.

### Trade-offs and limits

- A compromised Worker runtime or Cloudflare administrative account can still access plaintext during a request. Encryption at rest does not solve runtime compromise.
- JavaScript does not guarantee physical zeroization of strings in memory.
- Deleting the website copy does not revoke the provider key and does not imply immediate removal from retained D1 backups.
- Provider usage is paid by the teacher while website action quota still applies.
- V1 deliberately restricts capabilities to reduce the security and billing surface.

## Alternatives considered

- **Browser-only storage:** rejected because it does not meet cross-device reuse and increases exposure to browser/XSS/session replay tooling.
- **Ask for the key on every device/session:** rejected for poor usability and repeated secret handling.
- **Send personal keys through the shared AI gateway:** rejected because it broadens credential handling to another trust boundary and makes billing/source isolation less explicit.
- **Automatic provider fallback:** rejected because it can spend a different account's quota or money and violates source binding.
- **Provider OAuth:** not selected for V1 because Gemini/DeepSeek API-key workflows are the current product requirement; OAuth can be evaluated separately.

## Rollout

Migration 0083 is additive and the feature flag is off by default. Production migration, secret configuration, real provider smoke tests, and staged rollout require separate approvals and must follow `docs/operations/teacher-ai-credentials.md`.
