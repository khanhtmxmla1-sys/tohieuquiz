import { authenticateStudent } from '../../classroom/studentLoginService';
import type { Env } from '../../types';
import { parseBody } from '../../utils/helpers';
import { errorResponse } from '../../utils/response';

export async function handleStudentLoginRoute(
    request: Request, env: Env, path: string, method: string
): Promise<Response | null> {
    if (path !== '/api/student-login' || method !== 'POST') return null;
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');
    if (!body.username || !body.password) {
        return errorResponse('Missing username or password');
    }
    return authenticateStudent(env, String(body.username), String(body.password));
}
