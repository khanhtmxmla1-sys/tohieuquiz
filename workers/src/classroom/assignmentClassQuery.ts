import { requireTeacherForClass } from './authorization';
import type { JWTPayload } from '../utils/jwt';
import { mapAssignment } from '../utils/helpers';
import { jsonResponse } from '../utils/response';

export const getClassAssignmentsResponse = async (
    db: D1Database,
    user: JWTPayload,
    classId: string
): Promise<Response> => {
    const accessError = await requireTeacherForClass(db, user, classId);
    if (accessError) return accessError;
    const rows = await db.prepare(`
        SELECT a.*, s.full_name as student_name
        FROM assignments a
        LEFT JOIN students s ON a.student_id = s.id
        WHERE a.class_id = ?
        ORDER BY a.created_at DESC
    `).bind(classId).all();
    return jsonResponse({
        status: 'success',
        data: rows.results.map((assignment: any) => ({
            ...mapAssignment(assignment),
            studentName: assignment.student_name || '',
        })),
    });
};
