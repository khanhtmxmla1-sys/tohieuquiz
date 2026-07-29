import type { Env } from '../../types';
import { requireTeacher } from '../../middleware/jwtAuth';
import { errorResponse, jsonResponse } from '../../utils/response';
import { collectionLimit, decodeCollectionCursor, encodeCollectionCursor } from '../../utils/cursorPagination';
import { getActorAccessFromUser, getAuthenticatedUser } from './auth';
import { mapOrder } from './mappers';
import { ORDER_SELECT } from './orderRepository';
import type { GiftOrderRow } from './types';
import { normalizeStatus } from './values';

export const handleOrderList = async (request: Request, env: Env): Promise<Response> => {
    const url = new URL(request.url);
    const requestedStudentId = String(url.searchParams.get('studentId') || '').trim();
    const classId = String(url.searchParams.get('classId') || '').trim();
    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;

    const actorAccess = getActorAccessFromUser(userOrResponse);
    const status = normalizeStatus(url.searchParams.get('status'));
    let limit: number;
    let cursor: string[] | null;
    try {
        limit = collectionLimit(url);
        cursor = decodeCollectionCursor(url.searchParams.get('cursor'), 'gift-orders', 2);
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Pagination invalid', 400);
    }
    const isStudent = userOrResponse.role === 'student';
    let studentId = requestedStudentId;

    if (isStudent) {
        const authenticatedStudentId = String(userOrResponse.id || '').trim();
        if (!authenticatedStudentId) return errorResponse('Student identity not found', 403);
        if (requestedStudentId && requestedStudentId !== authenticatedStudentId) {
            return errorResponse('Forbidden', 403);
        }
        studentId = authenticatedStudentId;
    } else if (!requireTeacher(userOrResponse)) {
        return errorResponse('Forbidden', 403);
    }

    if (!isStudent && !actorAccess.isAdmin && !actorAccess.teacherClass) {
        return errorResponse('Teacher class assignment not found', 403);
    }

    const effectiveClassScope = isStudent
        ? ''
        : actorAccess.isAdmin
            ? classId
            : (actorAccess.teacherClass || '');
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (studentId) {
        conditions.push('o.student_id = ?');
        params.push(studentId);
    }
    if (effectiveClassScope) {
        conditions.push('(o.class_id = ? OR c.name = ?)');
        params.push(effectiveClassScope, effectiveClassScope);
    }
    if (status && status !== 'ALL') {
        conditions.push('o.status = ?');
        params.push(status);
    }
    if (cursor) {
        conditions.push('(o.updated_at < ? OR (o.updated_at = ? AND o.id < ?))');
        params.push(cursor[0], cursor[0], cursor[1]);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `${ORDER_SELECT} ${whereClause} ORDER BY o.updated_at DESC, o.id DESC LIMIT ?`;
    const rows = await env.DB.prepare(query).bind(...params, limit + 1).all<GiftOrderRow>();
    const sourceRows = rows.results || [];
    const pageRows = sourceRows.slice(0, limit);
    const last = pageRows.at(-1);
    const hasMore = sourceRows.length > limit;
    return jsonResponse({
        data: pageRows.map(mapOrder),
        meta: {
            limit,
            hasMore,
            nextCursor: hasMore && last
                ? encodeCollectionCursor('gift-orders', [last.updated_at, last.id])
                : null,
        },
    });
};
