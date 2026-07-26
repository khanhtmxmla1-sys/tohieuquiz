import type { Env } from '../../types';
import { requireAdmin, verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { JWTPayload } from '../../utils/jwt';
import type { ActorAccess, GiftOrderRow } from './types';

export const getAuthenticatedUser = async (request: Request, env: Env): Promise<JWTPayload | Response> => {
    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    return authResult.user;
};

export const getActorAccessFromUser = (user: JWTPayload): ActorAccess => ({
    isAdmin: requireAdmin(user),
    teacherClass: String(user.classId || '').trim(),
});

export const ensureCanManageOrder = (
    order: GiftOrderRow,
    actorIsAdmin: boolean,
    actorTeacherClass: string,
) => {
    if (actorIsAdmin) return;
    const scopedClass = String(actorTeacherClass || '').trim();
    if (!scopedClass || (scopedClass !== order.class_id && scopedClass !== order.class_name)) {
        throw new Error('Ban khong co quyen xu ly don cua lop nay.');
    }
};
