# Assignment Revocation V1 — Design Specification

**Date:** 2026-08-03  
**Status:** Approved for implementation  
**Scope:** Quiz assignments stored in `assignments` (not `hw_assignments`)

## Problem

A teacher may discover an incorrect question or answer after assigning a quiz. The current system supports closing, reopening, deadline changes, and permanent deletion, but it does not provide a safe way to withdraw an assignment while preserving history.

## Product decision

V1 adds **Thu hồi bài** with conservative rules:

- Teachers/admins may revoke an `OPEN` or `CLOSED` assignment only when it has **zero completed submissions**.
- Started-but-not-submitted attempts do not block revocation.
- An assignment with completed submissions cannot be revoked. The API returns HTTP 409 and the UI directs the teacher to close the assignment instead.
- Revocation is irreversible. To assign the corrected quiz, the teacher creates a new assignment.
- Existing assignment and result records are never deleted by revocation.

## State model

`AssignmentStatus` becomes:

- `OPEN`
- `CLOSED`
- `REVOKED`

Allowed transitions:

- `OPEN -> CLOSED`
- `CLOSED -> OPEN` only through the existing deadline extension flow
- `OPEN -> REVOKED` when completed submissions = 0
- `CLOSED -> REVOKED` when completed submissions = 0
- No transition out of `REVOKED`

## Data model

Add nullable audit columns to `assignments`:

- `revoked_at TEXT`
- `revoked_by TEXT`
- `revoked_reason TEXT`
- `previous_status TEXT`
- `submission_count_at_revoke INTEGER NOT NULL DEFAULT 0`

The fresh schema and D1 migration registry must remain aligned.

## API

### `POST /api/assignments/:assignmentId/revoke`

Request:

```json
{
  "reason": "Phát hiện câu hỏi hoặc đáp án chưa chính xác"
}
```

Rules:

- Session authentication required.
- Teacher must own the assignment's class; admins are allowed.
- Reason is trimmed and must contain 5–300 characters.
- Completed submission count is calculated from `results.assignment_id`, excluding the canonical `{"status":"STARTED"}` placeholder.
- Update is conditional on zero completed submissions to avoid a race with a simultaneous submission.
- Repeating revoke on an already revoked assignment returns HTTP 200 with `replayed: true`.

Success:

```json
{
  "status": "success",
  "data": {
    "assignmentId": "assignment-1",
    "status": "REVOKED",
    "previousStatus": "OPEN",
    "revokedAt": "2026-08-03T16:00:00.000Z",
    "revokedBy": "teacher-a",
    "revokedReason": "Phát hiện câu hỏi hoặc đáp án chưa chính xác",
    "submissionCountAtRevoke": 0,
    "replayed": false
  }
}
```

Errors:

- `400 ASSIGNMENT_REVOKE_REASON_INVALID`
- `403` assignment outside teacher scope
- `404` assignment not found
- `409 ASSIGNMENT_REVOKE_HAS_SUBMISSIONS` with `submissionCount`

## Student safety

- Student assignment lists exclude `REVOKED` rows.
- `POST /api/assignments/:id/start` rejects stale requests with `409 ASSIGNMENT_REVOKED`.
- Result submission rejects an explicitly referenced revoked assignment with `409 ASSIGNMENT_REVOKED`.
- No WebSocket push is required in V1; stale clients fail safely on the next start/submit request.

## Teacher UI

In **Dạy và giao bài → Theo dõi bài giao**:

- Add `Đã thu hồi` to status filters.
- Show a red-gray `Đã thu hồi` badge with audit reason/time where available.
- Replace the exposed permanent-delete action with **Thu hồi bài** for non-revoked rows.
- The confirmation dialog shows quiz title, class/student audience, submission count, and a required reason textarea prefilled with the common correction reason.
- If `submittedCount > 0`, disable revoke and explain that the teacher should close the assignment to preserve results.
- Revoked rows cannot edit deadlines or reopen.
- Keep the legacy DELETE API for backward compatibility, but do not expose it in this UI.

## Non-goals

- Revoking assignments that already have completed submissions.
- Invalidating or deleting submitted results.
- Restoring a revoked assignment.
- Automatically editing or reassigning the quiz.
- Changing the separate `hw_assignments` homework module.

## Observability and rollback

- Audit fields remain on the assignment record.
- Production smoke creates a temporary hidden quiz/class assignment, revokes it, verifies student invisibility and stale-request rejection, then cleans up.
- Migration is additive. Worker rollback is safe because older code ignores the new columns; the columns remain if the Worker is rolled back.
