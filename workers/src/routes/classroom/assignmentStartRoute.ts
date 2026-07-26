import { requireTeacherForAssignment, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import type { ClassroomRouteContext } from '../../classroom/types';
import { isStudent, requireTeacher } from '../../middleware/jwtAuth';
import { getSmartAssignmentPreview } from '../../services/smartAssignment';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, jsonResponse } from '../../utils/response';

export async function handleAssignmentStartRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, nowIso, user } = context;
    // POST /api/assignments/:id/start
        if (path.match(/\/api\/assignments\/[^/]+\/start/) && method === 'POST') {
            const parts = path.split('/');
            const assignmentId = parts[3];
            if (!assignmentId) return errorResponse('Missing assignment ID');

            const body = await parseBody(request);
            if (!body) return errorResponse('Invalid JSON body');

            if (!isStudent(user)) return errorResponse('Forbidden: Student access required', 403);

            const stu = await db.prepare('SELECT * FROM students WHERE username = ?').bind(user.username).first<any>();
            if (!stu) return jsonResponse({ status: 'error', message: 'Student not found' });

            const asn = await db.prepare('SELECT * FROM assignments WHERE id = ?').bind(assignmentId).first<any>();
            if (!asn) return jsonResponse({ status: 'error', message: 'Assignment not found' });

            const deadline = String(asn.deadline || '');
            const isExpired = deadline ? deadline < nowIso : false;
            const isClosed = String(asn.status || '').toUpperCase() === 'CLOSED' || isExpired;

            if (isExpired && String(asn.status || '').toUpperCase() !== 'CLOSED') {
                await db.prepare("UPDATE assignments SET status = 'CLOSED' WHERE id = ?").bind(assignmentId).run();
            }

            if (String(asn.class_id || '') !== String(stu.class_id || '')) {
                return errorResponse('Forbidden: Assignment is not for your class', 403);
            }
            if (String(asn.student_id || '') && String(asn.student_id || '') !== String(stu.id || '')) {
                return errorResponse('Forbidden: Assignment is not assigned to you', 403);
            }
            if (isClosed) {
                return jsonResponse({ status: 'error', message: 'Assignment is closed', code: 'ASSIGNMENT_CLOSED' });
            }

            const cnt = await db.prepare(
                `SELECT COUNT(*) as cnt FROM results WHERE student_name = ? AND quiz_id = ? AND answers != '{"status":"STARTED"}'`
            ).bind(stu.full_name, asn.quiz_id).first<{ cnt: number }>();
            const attemptCount = cnt?.cnt || 0;
            const maxAttempts = Number(asn.max_attempts) || 1;

            if (attemptCount >= maxAttempts) {
                return jsonResponse({ status: 'error', message: 'Max attempts reached', attemptCount, maxAttempts });
            }
            return jsonResponse({ status: 'success', attemptCount, maxAttempts });
        }
    return null;
}
