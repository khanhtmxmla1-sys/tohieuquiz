import { canAccessClass, requireTeacherForClass, requireTeacherForStudent } from '../../classroom/authorization';
import { getClassroomById, getStudentById } from '../../classroom/repositories';
import type { ClassroomRouteContext } from '../../classroom/types';
import { normalizeStudentInput, validateStudentInput } from '../../classroom/validation';
import { isStudent } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, generateId, hashPassword, jsonResponse, verifyPassword } from '../../utils/response';
import { internalErrorResponse } from '../../utils/internalError';

export async function handleStudentBatchRoute(context: ClassroomRouteContext): Promise<Response | null> {
    const { request, path, method, db, url, nowIso, user } = context;
    // POST /api/students/batch
        if (path === '/api/students/batch' && method === 'POST') {
            const body = await parseBody(request);
            if (!body || !Array.isArray(body.students)) return errorResponse('Invalid JSON body');

            if (body.students.length === 0) {
                return jsonResponse({ status: 'success', data: { successCount: 0, errorCount: 0, successes: [], errors: [] }});
            }
            if (body.students.length > 200) return errorResponse('Mỗi lần chỉ được nhập tối đa 200 học sinh', 400);

            const normalizedStudents: Array<ReturnType<typeof normalizeStudentInput>> = body.students.map(normalizeStudentInput);

            const classIds = [...new Set(normalizedStudents.map((s) => s.classId))] as string[];
            if (classIds.length !== 1 || !classIds[0]) return errorResponse('All students must target one valid classId');
            const classError = await requireTeacherForClass(db, user, classIds[0]);
            if (classError) return classError;

            // 1. Get existing usernames to avoid duplicates
            const usernames = normalizedStudents.map((s) => s.username).filter(Boolean);
            // SQLite has a limit on variables, but 50-100 is fine.
            const placeholders = usernames.map(() => '?').join(',');
            const existingResults = usernames.length > 0
                ? await db.prepare(`SELECT username FROM students WHERE username IN (${placeholders})`).bind(...usernames).all()
                : { results: [] as any[] };

            const existingUsernames = new Set(existingResults.results.map((r: any) => r.username));

            const stmts = [];
            const successList = [];
            const errorList = [];

            for (const student of normalizedStudents) {
                const validationError = validateStudentInput(student);
                if (validationError) {
                    errorList.push({ username: student.username, fullName: student.fullName, reason: validationError });
                    continue;
                }
                if (existingUsernames.has(student.username)) {
                    errorList.push({ username: student.username, fullName: student.fullName, reason: 'Tên đăng nhập đã tồn tại' });
                    continue;
                }

                const pwdHash = await hashPassword(student.password);
                const sId = generateId('s');
                const createdAt = new Date().toISOString();

                // In D1, batch expects an array of statement objects.
                // Return from db.prepare(...) is the statement.
                stmts.push(db.prepare(
                    'INSERT INTO students (id, full_name, username, password_hash, class_id, parent_phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(sId, student.fullName, student.username, pwdHash, student.classId, student.parentPhone || '', createdAt));

                successList.push({ id: sId, fullName: student.fullName, username: student.username, classId: student.classId, parentPhone: student.parentPhone || '', createdAt });
                // Add to Set to prevent duplicates within the same batch payload
                existingUsernames.add(student.username);
            }

            if (stmts.length > 0) {
                try {
                    await db.batch(stmts);
                } catch (error: unknown) {
                    return internalErrorResponse(error, request, {
                        context: 'POST /api/students/batch',
                    });
                }
            }

            return jsonResponse({
                status: 'success',
                data: { successCount: successList.length, errorCount: errorList.length, successes: successList, errors: errorList }
            });
        }
    return null;
}
