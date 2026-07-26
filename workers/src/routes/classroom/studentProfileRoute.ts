import { loadStudentSessionData } from '../../classroom/studentLoginService';
import type { ClassroomRouteContext } from '../../classroom/types';
import { errorResponse, jsonResponse } from '../../utils/response';

export async function handleStudentProfileRoute(
    context: ClassroomRouteContext,
): Promise<Response | null> {
    const { env, method, path, user } = context;
    if (path !== '/api/student-profile' || method !== 'GET') return null;
    if (user.role !== 'student') return errorResponse('Forbidden: Student access required', 403);

    const session = await loadStudentSessionData(env, user.username);
    if (!session) return errorResponse('Unauthorized: Student account is unavailable', 401);
    return jsonResponse({ status: 'success', data: session });
}
