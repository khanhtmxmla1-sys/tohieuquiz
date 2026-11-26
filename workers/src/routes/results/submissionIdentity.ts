import type { JWTPayload } from '../../utils/jwt';
import { isStudent } from '../../middleware/jwtAuth';
import { jsonResponse, errorResponse } from '../../utils/response';
import type { ResultAssignmentPolicy } from './assignmentPolicy';

export const normalizeName = (value: string | null | undefined): string => String(value || '').trim().toLowerCase();

export const getStudentForUser = async (db: D1Database, user: JWTPayload): Promise<any | null> => {
    if (!isStudent(user)) return null;
    return await db.prepare(
        `SELECT students.id, students.username, students.full_name, students.class_id, classes.name AS class_name
         FROM students
         LEFT JOIN classes ON classes.id = students.class_id
         WHERE students.username = ? AND COALESCE(students.archived_at, '') = ''`
    ).bind(user.username).first<any>();
};
export interface ResultClassRow {
    id: string;
    name: string;
    teacher_username: string;
}

export const resultClassError = (
    code: 'RESULT_CLASS_AMBIGUOUS' | 'RESULT_CLASS_FORBIDDEN',
    message: string,
    status: 403 | 409,
): Response => jsonResponse({ status: 'error', code, message }, status);

export const resolveSubmissionClass = async (
    db: D1Database,
    user: JWTPayload,
    input: {
        requestedClassId: string;
        className: string;
        student: any | null;
        assignment: ResultAssignmentPolicy | null;
    },
): Promise<ResultClassRow | Response> => {
    const requestedClassId = String(input.requestedClassId || '').trim();
    const requestedClassName = normalizeName(input.className);

    const loadById = async (classId: string): Promise<ResultClassRow | null> => db.prepare(`
        SELECT id, name, teacher_username
        FROM classes
        WHERE id = ? AND COALESCE(archived_at, '') = ''
        LIMIT 1
    `).bind(classId).first<ResultClassRow>();

    const enforceScopeAndName = (classroom: ResultClassRow): Response | null => {
        if (user.role === 'teacher' && classroom.teacher_username !== user.username) {
            return resultClassError('RESULT_CLASS_FORBIDDEN', 'Class is outside your scope', 403);
        }
        if (requestedClassId && requestedClassId !== classroom.id) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'classId conflicts with the canonical result class', 409);
        }
        if (requestedClassName && normalizeName(classroom.name) !== requestedClassName) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'className does not match classId', 409);
        }
        return null;
    };

    if (input.student) {
        const classId = String(input.student.class_id || '').trim();
        if (!classId) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'Student has no canonical class', 409);
        }
        if (input.assignment && String(input.assignment.class_id) !== classId) {
            return resultClassError('RESULT_CLASS_FORBIDDEN', 'Assignment is outside the student class', 403);
        }
        const classroom = await loadById(classId);
        if (!classroom) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'Student class could not be resolved', 409);
        }
        return classroom;
    }

    if (input.assignment) {
        const classroom = await loadById(String(input.assignment.class_id || ''));
        if (!classroom) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'Assignment class could not be resolved', 409);
        }
        const error = enforceScopeAndName(classroom);
        return error || classroom;
    }

    if (requestedClassId) {
        const classroom = await loadById(requestedClassId);
        if (!classroom) {
            return resultClassError('RESULT_CLASS_AMBIGUOUS', 'classId could not be resolved', 409);
        }
        const error = enforceScopeAndName(classroom);
        return error || classroom;
    }

    if (!requestedClassName) {
        return resultClassError('RESULT_CLASS_AMBIGUOUS', 'A canonical class could not be resolved', 409);
    }

    const matches = await db.prepare(`
        SELECT id, name, teacher_username
        FROM classes
        WHERE LOWER(TRIM(name)) = ? AND COALESCE(archived_at, '') = ''
        ORDER BY id
        LIMIT 3
    `).bind(requestedClassName).all<ResultClassRow>();
    const allMatches = matches.results || [];
    const scopedMatches = user.role === 'teacher'
        ? allMatches.filter((row) => row.teacher_username === user.username)
        : allMatches;

    if (user.role === 'teacher' && scopedMatches.length === 0 && allMatches.length > 0) {
        return resultClassError('RESULT_CLASS_FORBIDDEN', 'Class is outside your scope', 403);
    }
    if (scopedMatches.length !== 1) {
        return resultClassError('RESULT_CLASS_AMBIGUOUS', 'Class name is missing or ambiguous', 409);
    }
    return scopedMatches[0];
};

export const resolveUniqueStudentId = async (
    db: D1Database,
    studentName: string,
    classId: string,
    requestedStudentId = '',
): Promise<string | null> => {
    if (!classId) return null;
    const requestedId = String(requestedStudentId || '').trim();
    if (requestedId) {
        const row = await db.prepare(`
            SELECT id, full_name
            FROM students
            WHERE id = ? AND class_id = ? AND COALESCE(archived_at, '') = ''
            LIMIT 1
        `).bind(requestedId, classId).first<{ id: string; full_name: string }>();
        if (!row) return null;
        if (normalizeName(studentName) && normalizeName(row.full_name) !== normalizeName(studentName)) return null;
        return String(row.id);
    }
    if (!normalizeName(studentName)) return null;
    const rows = await db.prepare(`
        SELECT s.id
        FROM students s
        WHERE s.class_id = ?
          AND LOWER(TRIM(s.full_name)) = ?
          AND COALESCE(s.archived_at, '') = ''
        LIMIT 2
    `).bind(classId, normalizeName(studentName)).all<{ id: string }>();

    return rows.results.length === 1 ? String(rows.results[0].id) : null;
};

