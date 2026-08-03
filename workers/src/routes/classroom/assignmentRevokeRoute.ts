import { requireTeacherForAssignment } from '../../classroom/authorization';
import type { ClassroomRouteContext } from '../../classroom/types';
import { parseBody } from '../../utils/helpers';
import { jsonResponse } from '../../utils/response';

interface AssignmentRevocationRow {
    id: string;
    status: string;
    revoked_at?: string | null;
    revoked_by?: string | null;
    revoked_reason?: string | null;
    previous_status?: string | null;
    submission_count_at_revoke?: number | null;
}

const completedSubmissionCount = async (db: D1Database, assignmentId: string): Promise<number> => {
    const row = await db.prepare(`
        SELECT COUNT(*) AS count
        FROM results
        WHERE assignment_id = ?
          AND COALESCE(answers, '') != '{"status":"STARTED"}'
    `).bind(assignmentId).first<{ count: number }>();
    return Number(row?.count || 0);
};

const errorWithCode = (
    code: string,
    message: string,
    status: number,
    data?: Record<string, unknown>,
): Response => jsonResponse({ status: 'error', code, message, ...(data ? { data } : {}) }, status);

const successPayload = (
    row: AssignmentRevocationRow,
    assignmentId: string,
    replayed: boolean,
): Response => jsonResponse({
    status: 'success',
    data: {
        assignmentId,
        status: 'REVOKED',
        previousStatus: String(row.previous_status || ''),
        revokedAt: String(row.revoked_at || ''),
        revokedBy: String(row.revoked_by || ''),
        revokedReason: String(row.revoked_reason || ''),
        submissionCountAtRevoke: Number(row.submission_count_at_revoke || 0),
        replayed,
    },
});

const loadAssignment = (db: D1Database, assignmentId: string) => db.prepare(`
    SELECT id, status, revoked_at, revoked_by, revoked_reason,
           previous_status, submission_count_at_revoke
    FROM assignments
    WHERE id = ?
`).bind(assignmentId).first<AssignmentRevocationRow>();

export async function handleAssignmentRevokeRoute(
    context: ClassroomRouteContext,
): Promise<Response | null> {
    const match = context.path.match(/^\/api\/assignments\/([^/]+)\/revoke$/);
    if (!match || context.method !== 'POST') return null;

    const { request, db, nowIso, user } = context;
    const assignmentId = decodeURIComponent(match[1]);
    const body = await parseBody(request);
    if (!body) return errorWithCode('ASSIGNMENT_REVOKE_REASON_INVALID', 'Dữ liệu thu hồi không hợp lệ.', 400);

    const reason = String(body.reason || '').trim();
    if (reason.length < 5 || reason.length > 300) {
        return errorWithCode(
            'ASSIGNMENT_REVOKE_REASON_INVALID',
            'Lý do thu hồi phải có từ 5 đến 300 ký tự.',
            400,
        );
    }

    const assignmentError = await requireTeacherForAssignment(db, user, assignmentId);
    if (assignmentError) return assignmentError;

    const current = await loadAssignment(db, assignmentId);
    if (!current) return errorWithCode('ASSIGNMENT_NOT_FOUND', 'Không tìm thấy bài đã giao.', 404);
    const currentStatus = String(current.status || '').toUpperCase();
    if (currentStatus === 'REVOKED') return successPayload(current, assignmentId, true);
    if (!['OPEN', 'CLOSED'].includes(currentStatus)) {
        return errorWithCode('ASSIGNMENT_REVOKE_STATUS_INVALID', 'Trạng thái bài giao không thể thu hồi.', 409);
    }

    const submissionCount = await completedSubmissionCount(db, assignmentId);
    if (submissionCount > 0) {
        return errorWithCode(
            'ASSIGNMENT_REVOKE_HAS_SUBMISSIONS',
            'Bài đã có học sinh nộp. Hãy đóng bài để bảo toàn kết quả.',
            409,
            { submissionCount },
        );
    }

    const update = await db.prepare(`
        UPDATE assignments
        SET status = 'REVOKED',
            revoked_at = ?,
            revoked_by = ?,
            revoked_reason = ?,
            previous_status = ?,
            submission_count_at_revoke = 0
        WHERE id = ?
          AND UPPER(COALESCE(status, 'OPEN')) IN ('OPEN', 'CLOSED')
          AND NOT EXISTS (
              SELECT 1 FROM results
              WHERE assignment_id = ?
                AND COALESCE(answers, '') != '{"status":"STARTED"}'
          )
    `).bind(nowIso, user.username, reason, currentStatus, assignmentId, assignmentId).run();

    if (Number(update.meta?.changes || 0) === 1) {
        const revoked = await loadAssignment(db, assignmentId);
        return successPayload(revoked || {
            id: assignmentId,
            status: 'REVOKED',
            revoked_at: nowIso,
            revoked_by: user.username,
            revoked_reason: reason,
            previous_status: currentStatus,
            submission_count_at_revoke: 0,
        }, assignmentId, false);
    }

    const latest = await loadAssignment(db, assignmentId);
    if (String(latest?.status || '').toUpperCase() === 'REVOKED') {
        return successPayload(latest!, assignmentId, true);
    }
    const latestCount = await completedSubmissionCount(db, assignmentId);
    if (latestCount > 0) {
        return errorWithCode(
            'ASSIGNMENT_REVOKE_HAS_SUBMISSIONS',
            'Bài vừa có học sinh nộp nên không thể thu hồi. Hãy đóng bài để bảo toàn kết quả.',
            409,
            { submissionCount: latestCount },
        );
    }
    return errorWithCode('ASSIGNMENT_REVOKE_CONFLICT', 'Bài giao đã thay đổi. Vui lòng tải lại và thử lại.', 409);
}
