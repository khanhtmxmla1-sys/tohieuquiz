import type { ClassroomRouteContext } from '../../classroom/types';
import { handleAssignmentCreateRoute } from './assignmentCreateRoute';
import { handleAssignmentDeadlineRoute } from './assignmentDeadlineRoute';
import { handleAssignmentDeleteRoute } from './assignmentDeleteRoute';
import { handleAssignmentListRoute } from './assignmentListRoute';
import { handleAssignmentSmartPreviewRoute } from './assignmentSmartPreviewRoute';
import { handleAssignmentStartRoute } from './assignmentStartRoute';
import { handleAssignmentStatusRoute } from './assignmentStatusRoute';

const handlers = [
    handleAssignmentListRoute, handleAssignmentSmartPreviewRoute,
    handleAssignmentCreateRoute, handleAssignmentDeleteRoute,
    handleAssignmentDeadlineRoute, handleAssignmentStatusRoute,
    handleAssignmentStartRoute,
];

export async function handleAssignmentRoutes(context: ClassroomRouteContext): Promise<Response | null> {
    for (const handler of handlers) {
        const response = await handler(context);
        if (response) return response;
    }
    return null;
}
