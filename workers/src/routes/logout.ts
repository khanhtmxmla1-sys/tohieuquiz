// Logout Route Handler
// Clears JWT authentication cookie

import { Env } from '../types';
import { jsonResponse } from '../utils/response';
import { withClearedAuthCookie } from '../utils/authSession';

export async function handleLogoutRoute(request: Request, env: Env): Promise<Response> {
    // Create success response
    const response = jsonResponse({
        status: 'success',
        message: 'Logged out successfully',
    });

    return withClearedAuthCookie(response);
}
