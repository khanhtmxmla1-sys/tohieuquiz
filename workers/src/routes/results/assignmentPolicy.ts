import { jsonResponse, errorResponse } from '../../utils/response';

export const quizRequiresAccessCode = (value: unknown): boolean => ['1', 'true', 'yes', 'on', 'enabled']
    .includes(String(value ?? '').trim().toLowerCase());

export interface ResultAssignmentPolicy {
    id: string;
    quiz_id: string;
    class_id: string;
    class_name: string;
    student_id: string;
    max_attempts: number;
    status: string;
    deadline: string;
}

export const loadResultAssignmentPolicy = async (
    db: D1Database,
    input: {
        assignmentId: string;
        quizId: string;
        classId: string;
        student: any | null;
    },
): Promise<ResultAssignmentPolicy | null> => {
    const selectColumns = `
        SELECT a.id, a.quiz_id, a.class_id, COALESCE(a.student_id, '') AS student_id,
               a.max_attempts, a.status, a.deadline, c.name AS class_name
        FROM assignments a
        JOIN classes c ON c.id = a.class_id`;

    if (input.assignmentId) {
        return await db.prepare(`${selectColumns} WHERE a.id = ?`)
            .bind(input.assignmentId)
            .first<ResultAssignmentPolicy>();
    }
    if (!input.classId) return null;

    const bindings: unknown[] = [input.quizId, input.classId, new Date().toISOString()];
    let query = `${selectColumns}
        WHERE a.quiz_id = ?
          AND a.class_id = ?
          AND UPPER(COALESCE(a.status, 'OPEN')) = 'OPEN'
          AND (COALESCE(a.deadline, '') = '' OR a.deadline >= ?)`;

    if (input.student) {
        query += `
          AND (COALESCE(a.student_id, '') = '' OR a.student_id = ?)
        ORDER BY CASE WHEN a.student_id = ? THEN 0 ELSE 1 END,
                 datetime(a.created_at) DESC
        LIMIT 1`;
        bindings.push(input.student.id, input.student.id);
    } else {
        query += ` ORDER BY datetime(a.created_at) DESC LIMIT 1`;
    }

    return await db.prepare(query).bind(...bindings).first<ResultAssignmentPolicy>();
};
export const validateResultAssignmentPolicy = (
    assignment: ResultAssignmentPolicy,
    input: { quizId: string; classId: string; student: any | null },
): Response | null => {
    if (
        String(assignment.quiz_id) !== String(input.quizId)
        || String(assignment.class_id) !== String(input.classId)
    ) {
        return errorResponse('Forbidden: Assignment does not match this quiz or class', 403);
    }

    if (input.student && (
        String(assignment.class_id) !== String(input.student.class_id)
        || (String(assignment.student_id || '') && String(assignment.student_id) !== String(input.student.id))
    )) {
        return errorResponse('Forbidden: Assignment is not available to this student', 403);
    }

    const status = String(assignment.status || '').toUpperCase();
    if (status === 'REVOKED') {
        return jsonResponse({
            status: 'error',
            code: 'ASSIGNMENT_REVOKED',
            message: 'Bài đã được giáo viên thu hồi.',
        }, 409);
    }
    const isClosed = status === 'CLOSED';
    const deadline = Date.parse(String(assignment.deadline || ''));
    if (isClosed || (Number.isFinite(deadline) && deadline < Date.now())) {
        return errorResponse('Assignment is closed or expired', 409);
    }

    return null;
};

