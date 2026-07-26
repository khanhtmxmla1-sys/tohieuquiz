import { requireAdmin, requireTeacher } from '../middleware/jwtAuth';
import type { JWTPayload } from '../utils/jwt';
import { errorResponse } from '../utils/response';
import { getAssignmentOwner, getClassroomById, getStudentById } from './repositories';

export const canAccessClass = (user: JWTPayload, classroom: any): boolean => {
    if (requireAdmin(user)) return true;
    if (String(classroom?.archived_at || '')) return false;
    if (user.role === 'teacher') {
        return String(classroom?.teacher_username || '') === user.username;
    }
    if (user.role === 'student') {
        return String(classroom?.id || '') === String(user.classId || '');
    }
    return false;
};

export const requireTeacherForClass = async (
    db: D1Database,
    user: JWTPayload,
    classId: string
): Promise<Response | null> => {
    if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher access required', 403);
    const classroom = await getClassroomById(db, classId);
    if (!classroom) return errorResponse('Class not found', 404);
    if (!canAccessClass(user, classroom)) {
        return errorResponse('Forbidden: You do not manage this class', 403);
    }
    return null;
};

export const requireTeacherForStudent = async (
    db: D1Database,
    user: JWTPayload,
    studentId: string
): Promise<Response | null> => {
    if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher access required', 403);
    const student = await getStudentById(db, studentId);
    if (!student) return errorResponse('Student not found', 404);
    return requireTeacherForClass(db, user, student.class_id);
};

export const requireTeacherForAssignment = async (
    db: D1Database,
    user: JWTPayload,
    assignmentId: string
): Promise<Response | null> => {
    if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher access required', 403);
    const assignment = await getAssignmentOwner(db, assignmentId);
    if (!assignment) return errorResponse('Assignment not found', 404);
    return requireTeacherForClass(db, user, assignment.class_id);
};
