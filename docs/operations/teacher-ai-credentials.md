# Teacher AI Credentials — Operations Runbook

This runbook covers encrypted teacher-owned Gemini/DeepSeek API keys. It does **not** authorize production changes by itself. Production migration, secret changes, paid provider calls, rollout, rollback, and key retirement require the normal approval gates.

## Safety properties

- Feature flag: `teacher_ai_byok_v1`; default **off**.
- Worker secret: `AI_CREDENTIAL_KEYRING`.
- Secret JSON shape: `{"activeKeyId":"v2","keys":{"v1":"<base64 32 bytes>","v2":"<base64 32 bytes>"}}`.
- Never put the keyring in frontend variables, Wrangler vars, logs, CI output, shell history, tickets, or chat.
- Never print the secret to verify it. Use presence-only checks.
- Provider keys are never exportable from the application.
- Deleting the TôHiệuQuiz copy does not revoke a Gemini/DeepSeek key at the provider.

## Pre-deployment checklist

1. Verify the approved commit SHA and the intended Cloudflare account/domain/Worker/D1:
   - domain: `thtohieu.com`
   - API: `api.thtohieu.com`
   - Worker: `tohieuquiz-api`
   - D1: `tohieuquiz-db`
2. Confirm CI, security checks, migration tests, and required review are green.
3. Take/check the D1 backup/checkpoint according to the D1 safe-migration runbook.
4. Rehearse migration `0083_teacher_ai_credentials.sql` locally/staging first.
5. Obtain separate approval before applying any remote migration or changing Worker secrets.
6. Generate AES keys with a cryptographically secure tool. Each decoded key must be exactly 32 bytes.
7. Install the keyring through secret input. Do not echo or inspect its value.
8. Deploy Worker/frontend with `teacher_ai_byok_v1` still disabled.
9. Read-only smoke: deployed SHA, health, system-AI path, unauthorized credential route behavior, and credential metadata route.

## Initial rollout

1. Keep global flag disabled until migration and secret presence are verified.
2. Enable only an explicitly approved teacher allowlist.
3. The test teacher enters a disposable/test provider key through the UI. Real provider calls may cost money and require the key owner's approval.
4. Verify save → metadata reload → generate → review/repair → replace → delete.
5. Confirm logs/audit contain only metadata and no canary key/provider Authorization header.
6. Expand only after evidence review: allowlist → 10% → 100%.
7. Stop rollout immediately for any cross-user access, credential leak, unexpected provider fallback, or repeated integration error. For a sample of at least 100 BYOK requests, a BYOK 5xx rate above 1% also stops expansion.

## Master-key rotation

Do not replace the old secret in one step.

1. Generate a new 32-byte key with a new key id.
2. Add it to `keys` while retaining all old keys needed to decrypt existing rows.
3. Set `activeKeyId` to the new id. New saves now encrypt with the new key.
4. Run the internal `rotateCredentialBatch(db, keyring, cursor, limit)` operation in batches of at most 50.
5. Persist the returned cursor/checkpoint outside logs containing sensitive data. Re-running a batch is safe because updates are guarded by credential version and previous key id.
6. If a teacher replaces a key concurrently, count the row as conflicted and let the teacher's newer version win.
7. Continue until no rows use the old key id.
8. Verify counts by key id only; do not decrypt/export values for inspection.
9. Retain old master keys for the approved backup-retention window.
10. Retire an old key from the keyring only after explicit approval and evidence that no live row or retained restore target requires it.

If the old decryption key is missing, rotation must fail closed. Restore the old keyring material before retrying; never overwrite unreadable ciphertext.

## Credential deletion and backup restore

- DELETE removes the live D1 credential row using optimistic version matching.
- It does not revoke the provider key; instruct the teacher to revoke/rotate it at Google/DeepSeek if exposure is suspected.
- Backups may contain an older encrypted row. Do not promise immediate backup erasure.
- Before restoring a backup, disable BYOK.
- Maintain/reapply the approved post-backup deletion list after restore, or keep BYOK disabled until the restored credential state is reconciled.

## Incident response

For suspected credential exposure, cross-account access, vault corruption, or anomalous provider spend:

1. Disable `teacher_ai_byok_v1` immediately; do not delete evidence first.
2. Stop new personal-AI requests and confirm the system-AI path remains isolated.
3. Record incident time, deployed SHA, affected usernames/providers, key ids/versions, request ids, and error codes only. Never copy provider keys, ciphertext, Authorization headers, or prompt bodies into incident notes.
4. Review session/access history and credential audit metadata.
5. If provider-key exposure is possible, notify affected owners to revoke/rotate their provider key.
6. If master-key exposure is possible, create a new master key and follow the rotation procedure while retaining required old keys until re-encryption is complete.
7. If runtime/Cloudflare administrative compromise is suspected, follow the broader incident runbook; encryption at rest is not sufficient protection.
8. Resume rollout only after root cause, tests, review, and approval.

## Rollback

Prefer rollback by flag, not destructive schema changes.

1. Disable `teacher_ai_byok_v1`.
2. Verify no new personal requests are accepted.
3. Roll back application code if necessary.
4. Migration 0083 is additive. The provided rollback removes the BYOK flag, audit table, and credential table, but intentionally leaves inert additive columns on `ai_generation_actions`.
5. Do not run destructive rollback or delete encrypted credentials without explicit approval and backup/recovery review.

## Verification commands for development/CI

These are local/CI checks, not production commands:

```bash
npm run test:run -- tests/aiCredentialCrypto.worker.test.ts tests/aiCredentialsMigration.worker.test.ts
npm run test:run -- tests/aiCredentials.worker.test.ts tests/aiCredentialProviders.worker.test.ts tests/apiAuthorizationMatrix.test.ts tests/workerRouter.worker.test.ts
npm run test:run -- tests/aiByokProxy.worker.test.ts tests/aiProxy.worker.test.ts tests/teacherAiQuotaLedger.worker.test.ts
npm run test:run -- tests/AiCredentialSettings.test.tsx tests/aiByokGeneration.test.ts src/services/ai/__tests__/workerAiClient.test.ts
npm run test:run -- tests/aiCredentialsSecurity.worker.test.ts tests/aiCredentialRotation.worker.test.ts
npx cypress run --e2e --spec "cypress/e2e/ai-personal-keys.cy.ts"
npm run lint
npm run typecheck
npm run typecheck:workers
npm run build
npm run security:check
```
