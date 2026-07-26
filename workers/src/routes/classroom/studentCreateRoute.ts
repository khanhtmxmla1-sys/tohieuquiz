import { canAccessClass, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import { getClassroomById, getStudentById } from '../../classroom/repositories';
import type { ClassroomRouteContext } from '../../classroom/types';
import { normalizeStudentInput, validateStudentInput } from '../../classroom/validation';
import { isStudent } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, hashPassword, jsonResponse, verifyPassword } from '../../utils/response';

export async function handleStudentCreateRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // POST /api/students
        if (path === '/api/students' && method === 'POST') {
            const body = await parseBody(request);
            if (!body) return errorResponse('Invalid JSON body');
            const student = normalizeStudentInput(body);
            const validationError = validateStudentInput(student);
            if (validationError) return errorResponse(validationError, 400);

            const classError = await requireTeacherForClass(db, user, student.classId);
            if (classError) return classError;

            // Check duplicate username
            const existing = await db.prepare('SELECT id FROM students WHERE username = ?').bind(student.username).first();
            if (existing) return jsonResponse({ status: 'error', message: 'Tên đăng nhập đã tồn tại: ' + student.username });

            const pwdHash = await hashPassword(student.password);
            const sId = generateId('s');
            const createdAt = new Date().toISOString();

            await db.prepare(
                'INSERT INTO students (id, full_name, username, password_hash, class_id, parent_phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).bind(sId, student.fullName, student.username, pwdHash, student.classId, student.parentPhone, createdAt).run();

            return jsonResponse({
                status: 'success',
                data: { id: sId, fullName: student.fullName, username: student.username, classId: student.classId, parentPhone: student.parentPhone, createdAt },
            });
        }
    return null;
}
