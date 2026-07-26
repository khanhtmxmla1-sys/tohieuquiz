import { requireTeacherForStudent } from './authorization';
import type { JWTPayload } from '../utils/jwt';
import { mapAssignment } from '../utils/helpers';
import { errorResponse, jsonResponse } from '../utils/response';
import { isStudent } from '../middleware/jwtAuth';

export const getStudentAssignmentsResponse = async (
    db: D1Database,
    user: JWTPayload,
    studentId: string
): Promise<Response> => {
    const student = await db.prepare('SELECT * FROM students WHERE id = ?')
        .bind(studentId).first<any>();
    if (!student) return jsonResponse({ status: 'error', message: 'Student not found' });
    if (isStudent(user) && user.username !== student.username) {
        return errorResponse('Forbidden: You can only access your own assignments', 403);
    }
    if (!isStudent(user)) {
        const accessError = await requireTeacherForStudent(db, user, studentId);
        if (accessError) return accessError;
    }

    const assignments = await db.prepare(
        `SELECT * FROM assignments WHERE class_id = ? AND (student_id = '' OR student_id = ?) ORDER BY created_at DESC`
    ).bind(student.class_id, student.id).all();
    if (assignments.results.length === 0) {
        return jsonResponse({ status: 'success', data: [] });
    }

    const assignmentIds = assignments.results.map((assignment: any) => String(assignment.id));
    const placeholders = assignmentIds.map(() => '?').join(',');
    const counts = await db.prepare(
        `SELECT assignment_id, COUNT(*) as cnt
         FROM results
         WHERE assignment_id IN (${placeholders})
           AND (student_id = ? OR (student_id IS NULL AND LOWER(TRIM(student_name)) = LOWER(TRIM(?))))
           AND answers != '{"status":"STARTED"}'
         GROUP BY assignment_id`
    ).bind(...assignmentIds, student.id, student.full_name).all();
    const countMap = new Map(
        (counts.results as any[]).map((row) => [String(row.assignment_id), Number(row.cnt) || 0])
    );
    return jsonResponse({
        status: 'success',
        data: assignments.results.map((assignment: any) => ({
            ...mapAssignment(assignment),
            attemptCount: countMap.get(String(assignment.id)) || 0,
            maxAttempts: Number(assignment.max_attempts) || 1,
        })),
    });
};
