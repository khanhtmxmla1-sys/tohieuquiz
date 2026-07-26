import { getAdminAssignments } from '../../classroom/assignmentAdminQuery';
import { getClassAssignmentsResponse } from '../../classroom/assignmentClassQuery';
import { getStudentAssignmentsResponse } from '../../classroom/assignmentStudentQuery';
import { getTeacherAssignments } from '../../classroom/assignmentTeacherQuery';
import type { ClassroomRouteContext } from '../../classroom/types';
import { requireAdmin, requireTeacher } from '../../middleware/jwtAuth';
import { errorResponse, jsonResponse } from '../../utils/response';

export async function handleAssignmentListRoute(
    context: ClassroomRouteContext
): Promise<Response | null> {
    const { path, method, db, url, nowIso, user } = context;
    if (path !== '/api/assignments' || method !== 'GET') return null;

    await db.prepare(
        `UPDATE assignments SET status = 'CLOSED' WHERE status = 'OPEN' AND deadline < ?`
    ).bind(nowIso).run();
    const classId = url.searchParams.get('classId');
    const teacherUsername = url.searchParams.get('teacherUsername');
    const studentId = url.searchParams.get('studentId');

    if (url.searchParams.get('all') === 'true') {
        if (!requireAdmin(user)) return errorResponse('Forbidden: Admin access required', 403);
        return jsonResponse({ status: 'success', data: await getAdminAssignments(db) });
    }
    if (teacherUsername) {
        if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher access required', 403);
        const effectiveUsername = requireAdmin(user) ? teacherUsername : user.username;
        return jsonResponse({
            status: 'success', data: await getTeacherAssignments(db, effectiveUsername),
        });
    }
    if (studentId) return getStudentAssignmentsResponse(db, user, studentId);
    if (classId) return getClassAssignmentsResponse(db, user, classId);
    return errorResponse(
        'Missing query parameter: classId, teacherUsername, studentId, or all=true'
    );
}
