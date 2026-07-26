import { z } from 'zod';

// ===============================
// Login Credentials Schema
// ===============================
export const LoginCredentialsSchema = z.object({
    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be less than 50 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    password: z.string()
        .min(4, 'Password must be at least 4 characters')
        .max(100, 'Password must be less than 100 characters')
});

// ===============================
// Teacher Schema
// ===============================
export const TeacherSchema = z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(4).max(100),
    fullName: z.string().min(1, 'Full name is required').max(100)
});

// ===============================
// Auth Session Schema (for persistence)
// ===============================
export const AuthSessionSchema = z.object({
    isLoggedIn: z.boolean(),
    teacherName: z.string().nullable(),
    isAdmin: z.boolean()
});

// ===============================
// Student Info Schema (before starting quiz)
// ===============================
export const StudentInfoSchema = z.object({
    studentName: z.string()
        .min(2, 'Tên phải có ít nhất 2 ký tự')
        .max(50, 'Tên không được quá 50 ký tự')
        .regex(/^[\p{L}\s]+$/u, 'Tên chỉ được chứa chữ cái và khoảng trắng'),
    studentClass: z.string()
        .min(2, 'Vui lòng chọn lớp')
        .regex(/^[1-5]A[1-9]$/, 'Lớp không hợp lệ')
});

// ===============================
// Access Code Schema
// ===============================
export const AccessCodeSchema = z.string()
    .length(6, 'Mã truy cập phải có 6 ký tự')
    .regex(/^[A-Z0-9]+$/, 'Mã truy cập chỉ gồm chữ hoa và số');

// ===============================
// Type Exports
// ===============================
export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>;
export type Teacher = z.infer<typeof TeacherSchema>;
export type AuthSession = z.infer<typeof AuthSessionSchema>;
export type StudentInfo = z.infer<typeof StudentInfoSchema>;

// ===============================
// Validation Helper Functions
// ===============================
export const validateLoginCredentials = (data: unknown) =>
    LoginCredentialsSchema.safeParse(data);

export const validateTeacher = (data: unknown) =>
    TeacherSchema.safeParse(data);

export const validateStudentInfo = (data: unknown) =>
    StudentInfoSchema.safeParse(data);

export const validateAccessCode = (code: unknown) =>
    AccessCodeSchema.safeParse(code);
