import type { ClassroomRouteContext } from '../../classroom/types';
import { handleStudentArchiveRoute } from './studentArchiveRoute';
import { handleStudentAvatarRoute } from './studentAvatarRoute';
import { handleStudentBatchRoute } from './studentBatchRoute';
import { handleStudentChangePasswordRoute } from './studentChangePasswordRoute';
import { handleStudentCreateRoute } from './studentCreateRoute';
import { handleStudentListRoute } from './studentListRoute';
import { handleStudentProfileRoute } from './studentProfileRoute';
import { handleStudentResetPasswordRoute } from './studentResetPasswordRoute';

const handlers = [
    handleStudentProfileRoute, handleStudentListRoute, handleStudentCreateRoute, handleStudentBatchRoute,
    handleStudentArchiveRoute, handleStudentChangePasswordRoute,
    handleStudentResetPasswordRoute, handleStudentAvatarRoute,
];

export async function handleStudentRoutes(context: ClassroomRouteContext): Promise<Response | null> {
    for (const handler of handlers) {
        const response = await handler(context);
        if (response) return response;
    }
    return null;
}
