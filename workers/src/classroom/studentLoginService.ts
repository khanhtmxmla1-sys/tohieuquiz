import type { Env } from '../types';
import { signJWT } from '../utils/jwt';
import { buildAuthSessionData, withAuthCookie } from '../utils/authSession';
import { errorResponse, hashPassword, jsonResponse, verifyPassword } from '../utils/response';
import { mapLoginPet, mapLoginShopItem } from './studentLoginMappers';

const STUDENT_SESSION_QUERY = `
        SELECT
            s.*, c.name as class_name,
            p.pet_id, p.pet_name, p.level as pet_level, p.exp as pet_exp,
            p.exp_to_next as pet_exp_to_next, p.mood as pet_mood,
            p.items as pet_items, p.last_active as pet_last_active,
            p.image_url as pet_image_url
        FROM students s
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN user_pets p ON p.username = s.username
        WHERE s.username = ?
          AND COALESCE(s.archived_at, '') = ''
          AND COALESCE(c.archived_at, '') = ''
    `;

const toStudentSessionData = (student: any, shopItems: any[]) => ({
    studentId: student.id,
    fullName: student.full_name,
    username: student.username,
    classId: student.class_id,
    className: student.class_name || '',
    avatar: student.avatar || '',
    coins: Number(student.coins) || 0,
    pet: mapLoginPet(student),
    shopItems: shopItems.map(mapLoginShopItem),
});

export const loadStudentSessionData = async (env: Env, username: string) => {
    const student = await env.DB.prepare(STUDENT_SESSION_QUERY).bind(username).first<any>();
    if (!student) return null;
    const shopItems = await env.DB.prepare('SELECT * FROM shop_items').all<any>();
    return toStudentSessionData(student, shopItems.results || []);
};

export const authenticateStudent = async (
    env: Env,
    username: string,
    password: string
): Promise<Response> => {
    const student = await env.DB.prepare(STUDENT_SESSION_QUERY).bind(username).first<any>();
    const passwordCheck = student
        ? await verifyPassword(password, String(student.password_hash || ''))
        : { valid: false, needsRehash: false };
    if (!student || !passwordCheck.valid) {
        return jsonResponse({ status: 'error', message: 'Sai tên đăng nhập hoặc mật khẩu.' });
    }
    if (passwordCheck.needsRehash) {
        const upgradedHash = await hashPassword(password);
        await env.DB.prepare('UPDATE students SET password_hash = ? WHERE id = ?')
            .bind(upgradedHash, student.id).run();
    }

    const shopItems = await env.DB.prepare('SELECT * FROM shop_items').all();
    if (student.pet_id) {
        await env.DB.prepare(
            'UPDATE user_pets SET last_active = ?, mood = ? WHERE username = ?'
        ).bind(new Date().toISOString(), 'happy', student.username).run();
    }
    if (!env.JWT_SECRET) {
        console.error('[Student Login] JWT_SECRET not configured');
        return errorResponse('Authentication service unavailable', 503);
    }
    const token = await signJWT({
        id: student.id, username: student.username, role: 'student',
        fullName: student.full_name, classId: student.class_id,
    }, env.JWT_SECRET, '7d');
    const response = jsonResponse({
        status: 'success',
        data: buildAuthSessionData(env, toStudentSessionData(student, shopItems.results || []), token),
    });
    return withAuthCookie(response, token);
};
