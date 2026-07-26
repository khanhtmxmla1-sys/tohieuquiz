/**
 * Classroom Types
 *
 * Types for Virtual Classroom feature: Classes, Students, Assignments.
 */

// --- Class ---

export interface Classroom {
    id: string;
    name: string;              // e.g., "Lớp 5A"
    teacherUsername: string;    // Username of the teacher who created the class
    teacherFullName?: string;
    createdAt: string;         // ISO timestamp
    studentCount?: number;
    assignmentCount?: number;
    lastActivityAt?: string;
    archivedAt?: string;
}

export interface CreateClassPayload {
    name: string;
    teacherUsername: string;
}

// --- Student ---

export interface Student {
    id: string;
    fullName: string;
    username: string;          // Unique login identifier (e.g., "an.nguyen.001")
    classId: string;           // Foreign key to Classroom.id
    parentPhone?: string;      // Only visible to teacher
    avatar?: string;           // Avatar sticker key (e.g., "cat", "dog", "robot")
    createdAt?: string;
    archivedAt?: string;
}

export interface CreateStudentPayload {
    fullName: string;
    username: string;
    password: string;          // Plain text input, will be hashed on server
    classId: string;
    parentPhone?: string;
}

export interface StudentLoginPayload {
    username: string;
    password: string;          // Plain text input, verified against hash on server
}

export interface StudentSession {
    studentId: string;
    fullName: string;
    username: string;
    classId: string;
    className?: string;
    avatar?: string;           // Avatar sticker key
    // Gamification fields (loaded on login)
    coins?: number;
    pet?: {
        petId: string;
        petName: string;
        level: number;
        exp: number;
        expToNext: number;
        mood: string;
        items: string[];
        lastActive: string;
    } | null;
    shopItems?: Array<{
        itemId: string;
        name: string;
        price: number;
        type: string;
        category: string;
        assetUrl: string;
    }>;
}


// --- Assignment ---

export type AssignmentStatus = 'OPEN' | 'CLOSED';

export interface Assignment {
    id: string;
    quizId: string;
    classId: string;
    deadline: string;           // ISO timestamp
    maxAttempts: number;        // Max times a student can take this quiz
    status: AssignmentStatus;
    createdAt: string;
    // Computed / joined fields (from server)
    quizTitle?: string;
    className?: string;
    studentId?: string;         // ID of assigned student (if specific)
    studentName?: string;       // Name of assigned student
    submittedCount?: number;    // How many students submitted
    totalStudents?: number;     // Total students in class
    attemptCount?: number;      // How many times current student has submitted
}

export interface CreateAssignmentPayload {
    quizId: string;
    classId: string;
    studentId?: string;         // Optional: if given, assigned only to this student
    deadline: string;           // ISO timestamp
    maxAttempts: number;        // Max times a student can take this quiz (default: 1)
}

export type SmartAssignmentPreviewErrorCode =
    | 'STUDENT_NOT_FOUND'
    | 'AMBIGUOUS_STUDENT_MATCH'
    | 'NO_RECOMMENDED_QUIZ';

export interface SmartAssignmentWarning {
    code: string;
    message: string;
}

export interface SmartAssignmentCandidateStudent {
    id: string;
    fullName: string;
    classId: string;
    className: string;
}

export interface SmartAssignmentTopSkill {
    subject: string;
    subjectLabel: string;
    skillCode: string;
    skillLabel: string;
    subskillCode?: string;
    subskillLabel?: string;
    status: 'weak' | 'needs_practice' | 'stable';
    accuracy: number;
    attempted: number;
    wrong: number;
    targetDifficulty: 1 | 2 | 3;
}

export interface SmartAssignmentMatchBreakdown {
    subjectMatched: boolean;
    skillMatched: boolean;
    subskillMatched: boolean;
    matchedViaTags: boolean;
    avgDifficulty?: number;
    targetDifficulty: 1 | 2 | 3;
    difficultyDistance?: number;
    totalScore: number;
}

export interface SmartAssignmentRecommendedQuiz {
    quizId: string;
    title: string;
    matchReason: string;
    questionCount: number;
    timeLimit: number;
    confidence: number;
    matchBreakdown: SmartAssignmentMatchBreakdown;
}

export interface SmartAssignmentPreviewRequest {
    resultId: string;
    teacherUsername: string;
    strategy: 'top_weak_skill';
    preferredQuizId?: string;
    deadlinePreset?: '3d' | '7d' | '14d' | 'custom';
    maxAttempts?: number;
}

export interface SmartAssignmentPreviewData {
    student: SmartAssignmentCandidateStudent;
    weaknessSummary: {
        resultId: string;
        coveragePercent: number;
        basedOnResultIds: string[];
        topSkill: SmartAssignmentTopSkill;
    };
    recommendedQuizzes: SmartAssignmentRecommendedQuiz[];
    assignmentDraft: CreateAssignmentPayload;
    warnings: SmartAssignmentWarning[];
}

export interface SmartAssignmentPreviewErrorData {
    candidates?: SmartAssignmentCandidateStudent[];
}

export type SmartAssignmentPreviewApiResponse = ClassroomApiResponse<
    SmartAssignmentPreviewData | SmartAssignmentPreviewErrorData
>;

// --- API Response ---

export interface ClassroomApiResponse<T> {
    status: 'success' | 'error';
    data?: T;
    message?: string;
    code?: string;
}
