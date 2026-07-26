import type { ClassroomRouteContext } from '../../classroom/types';
import { handleClassArchiveRoute } from './classArchiveRoute';
import { handleClassCreateRoute } from './classCreateRoute';
import { handleClassDeleteRoute } from './classDeleteRoute';
import { handleClassListRoute } from './classListRoute';
import { handleClassTeacherRoute } from './classTeacherRoute';

const handlers = [
    handleClassListRoute, handleClassCreateRoute, handleClassTeacherRoute,
    handleClassArchiveRoute, handleClassDeleteRoute,
];

export async function handleClassRoutes(context: ClassroomRouteContext): Promise<Response | null> {
    for (const handler of handlers) {
        const response = await handler(context);
        if (response) return response;
    }
    return null;
}
