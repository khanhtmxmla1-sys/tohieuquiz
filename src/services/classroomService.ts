/**
 * Classroom Service
 *
 * API calls to the Cloudflare Worker for Virtual Classroom features:
 * Classes, Students, Assignments.
 */

// classroomService uses the canonical Worker API adapter
import { callApi } from './apiAdapter';
import {
    Classroom, CreateClassPayload,
    Student, CreateStudentPayload, StudentLoginPayload, StudentSession,
    Assignment, CreateAssignmentPayload,
    SmartAssignmentPreviewApiResponse,
    SmartAssignmentPreviewData, SmartAssignmentPreviewErrorData, SmartAssignmentPreviewRequest,
    ClassroomApiResponse,
} from '../types/classroom.types';


/**
 * Helper to call the canonical Worker API
 */
const callWorkerApi = async <T = any>(action: string, payload: Record<string, any> = {}): Promise<ClassroomApiResponse<T>> => {
    try {
        const data = await callApi<ClassroomApiResponse<T>>(action, payload);
        return data;
    } catch (error: unknown) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        console.error(`[ClassroomService] API Error [${action}]:`, error);
        return { status: 'error', message: normalizedError.message || 'Unknown API error' };
    }
};

/**
 * Get all classes for a teacher
 */
export const getClasses = async (teacherUsername?: string, includeArchived = false): Promise<Classroom[]> => {
    const payload = { ...(teacherUsername ? { teacherUsername } : {}), includeArchived };
    const res = await callWorkerApi<Classroom[]>('get_classes', payload);
    if (res.status === 'success' && Array.isArray(res.data)) {
        return res.data;
    }
    throw new Error(res.message || 'Không thể tải danh sách lớp.');
};

/**
 * Create a new class
 */
export const createClass = async (payload: CreateClassPayload): Promise<Classroom | null> => {
    const res = await callWorkerApi<Classroom>('create_class', payload);
    if (res.status === 'success' && res.data) {
        return res.data;
    }
    throw new Error(res.message || 'Không thể tạo lớp.');
};

/**
 * Delete a class (and optionally its students)
 */
export const deleteClass = async (classId: string): Promise<boolean> => {
    const res = await callWorkerApi('delete_class', { classId });
    if (res.status !== 'success') throw new Error(res.message || 'Không thể lưu trữ lớp.');
    return true;
};

export const restoreClass = async (classId: string): Promise<boolean> => {
    const res = await callWorkerApi('restore_class', { classId });
    if (res.status !== 'success') throw new Error(res.message || 'Không thể khôi phục lớp.');
    return true;
};

// ==========================================
// STUDENT MANAGEMENT
// ==========================================

/**
 * Get students in a class
 * - Teacher role: returns all fields including parentPhone
 * - Student role: omits parentPhone
 */
export const getStudents = async (classId: string, role: 'teacher' | 'student' = 'teacher'): Promise<Student[]> => {
    const res = await callWorkerApi<Student[]>('get_students', { classId, role });
    if (res.status === 'success' && Array.isArray(res.data)) {
        return res.data;
    }
    throw new Error(res.message || 'Không thể tải danh sách học sinh.');
};

/**
 * Add a student to a class (password will be hashed by the Worker)
 */
export const addStudent = async (payload: CreateStudentPayload): Promise<Student | null> => {
    const res = await callWorkerApi<Student>('add_student', payload);
    if (res.status === 'success' && res.data) {
        return res.data;
    }
    throw new Error(res.message || 'Không thể thêm học sinh.');
};

export interface BatchStudentResult {
    successCount: number;
    errorCount: number;
    successes: Student[];
    errors: { username: string; fullName: string; reason: string }[];
}

/**
 * Add multiple students to a class
 */
export const addStudentsBatch = async (students: CreateStudentPayload[]): Promise<BatchStudentResult> => {
    const res = await callWorkerApi<BatchStudentResult>('add_students_batch', { students });
    if (res.status === 'success' && res.data) {
        return res.data;
    }
    console.error('[ClassroomService] addStudentsBatch failed:', res.message);
    throw new Error(res.message || 'Lỗi khi thêm học sinh hàng loạt');
};

/**
 * Delete a student
 */
export const deleteStudent = async (studentId: string): Promise<boolean> => {
    const res = await callWorkerApi('delete_student', { studentId });
    return res.status === 'success';
};

/**
 * Reset student password (admin only)
 */
export const resetStudentPassword = async (
    studentId: string,
    newPassword: string,
    _actorUsername?: string
): Promise<boolean> => {
    const res = await callWorkerApi('reset_student_password', {
        studentId,
        newPassword,
    });
    if (res.status !== 'success') {
        throw new Error(res.message || 'Không thể đặt lại mật khẩu.');
    }
    return true;
};

/**
 * Student changes their own password
 */
export const changeStudentPassword = async (
    studentId: string,
    currentPassword: string,
    newPassword: string
): Promise<boolean> => {
    const res = await callWorkerApi('change_student_password', {
        studentId,
        currentPassword,
        newPassword,
    });
    if (res.status !== 'success') {
        throw new Error(res.message || 'Không thể đổi mật khẩu.');
    }
    return true;
};

/**
 * Student login (password verified against hash on server side)
 */
const stripLegacySessionToken = (data: StudentSession & { token?: string }): StudentSession => {
    const { token: _legacyToken, ...session } = data;
    return session;
};

export const studentLogin = async (payload: StudentLoginPayload): Promise<StudentSession | null> => {
    const res = await callWorkerApi<StudentSession & { token?: string }>('student_login', payload);
    if (res.status === 'success' && res.data) return stripLegacySessionToken(res.data);
    return null;
};

export const getStudentProfile = async (): Promise<StudentSession | null> => {
    const res = await callWorkerApi<StudentSession>('student_profile');
    return res.status === 'success' && res.data ? res.data : null;
};

export const logoutSession = async (): Promise<void> => {
    await callWorkerApi('logout');
};

// ==========================================
// ASSIGNMENT MANAGEMENT
// ==========================================

/**
 * Get assignments for a class (auto-closes expired ones server-side)
 */
export const getAssignments = async (classId: string): Promise<Assignment[]> => {
    const res = await callWorkerApi<Assignment[]>('get_assignments', { classId });
    if (res.status === 'success' && Array.isArray(res.data)) {
        return res.data;
    }
    return [];
};

/**
 * Get all assignments for a teacher (across all their classes)
 */
export const getTeacherAssignments = async (teacherUsername: string): Promise<Assignment[]> => {
    const res = await callWorkerApi<Assignment[]>('get_teacher_assignments', { teacherUsername });
    if (res.status === 'success' && Array.isArray(res.data)) {
        return res.data;
    }
    return [];
};

/**
 * Create a new assignment (deadline enforced server-side)
 */
export const createAssignment = async (payload: CreateAssignmentPayload): Promise<Assignment | null> => {
    const res = await callWorkerApi<Assignment>('create_assignment', payload);
    if (res.status === 'success' && res.data) {
        return res.data;
    }
    console.error('[ClassroomService] createAssignment failed:', res.message);
    return null;
};

/**
 * Build a smart assignment preview for one student from an existing result context.
 */
export const getSmartAssignmentPreview = async (
    payload: SmartAssignmentPreviewRequest,
): Promise<SmartAssignmentPreviewApiResponse> => {
    return callWorkerApi<SmartAssignmentPreviewData | SmartAssignmentPreviewErrorData>('get_smart_assignment_preview', payload);
};

/**
 * Delete an assignment
 */
export const deleteAssignment = async (assignmentId: string): Promise<boolean> => {
    const res = await callWorkerApi('delete_assignment', { assignmentId });
    return res.status === 'success';
};

/**
 * Update assignment deadline (server auto-reopens if new deadline is in the future)
 */
export const updateAssignmentDeadline = async (
    assignmentId: string,
    newDeadline: string
): Promise<boolean> => {
    const res = await callWorkerApi('update_assignment_deadline', { assignmentId, newDeadline });
    if (res.status !== 'success') {
        console.error('[ClassroomService] updateAssignmentDeadline failed:', res.message);
    }
    return res.status === 'success';
};

/**
 * Toggle assignment status (OPEN <-> CLOSED)
 */
export const updateAssignmentStatus = async (
    assignmentId: string,
    newStatus: 'OPEN' | 'CLOSED'
): Promise<boolean> => {
    const res = await callWorkerApi('update_assignment_status', { assignmentId, newStatus });
    if (res.status !== 'success') {
        console.error('[ClassroomService] updateAssignmentStatus failed:', res.message);
    }
    return res.status === 'success';
};

/**
 * Get student assignments (for student portal dashboard)
 */
export const getStudentAssignments = async (studentId: string): Promise<Assignment[]> => {
    const res = await callWorkerApi<Assignment[]>('get_student_assignments', { studentId });
    if (res.status === 'success' && Array.isArray(res.data)) {
        return res.data;
    }
    return [];
};

/**
 * Get ALL assignments (for "Bài Tập Lớp" category on HomePage)
 */
export const getAllAssignments = async (): Promise<Assignment[]> => {
    const res = await callWorkerApi<Assignment[]>('get_all_assignments', {});
    if (res.status === 'success' && Array.isArray(res.data)) {
        return res.data;
    }
    return [];
};

/**
 * Start an assignment attempt (tracks attempt count & creates initial result)
 */
export const startAssignmentAttempt = async (assignmentId: string, studentId: string): Promise<boolean> => {
    const res = await callWorkerApi('start_assignment_attempt', { assignmentId, studentId });
    return res.status === 'success';
};

/**
 * Update student avatar
 */
export const updateStudentAvatar = async (studentId: string, avatar: string): Promise<boolean> => {
    const res = await callWorkerApi('update_student_avatar', { studentId, avatar });
    return res.status === 'success';
};
