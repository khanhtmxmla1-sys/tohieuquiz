import { z } from 'zod';
import { LiveExamStatus, TeacherAction } from '../src/types/liveExam.types';

// ===============================
// Live Exam Settings Schema
// ===============================
export const LiveExamSettingsSchema = z.object({
    randomizeAnswers: z.boolean().default(true),
    showLeaderboard: z.boolean().default(true),
    allowLateJoin: z.boolean().default(false),
    passingScore: z.number().min(0).max(100).optional()
});

// ===============================
// Create Live Exam Request Schema
// ===============================
export const CreateLiveExamRequestSchema = z.object({
    title: z.string()
        .min(3, 'Title must be at least 3 characters')
        .max(200, 'Title must be less than 200 characters'),
    quizId: z.string()
        .min(1, 'Quiz ID is required'),
    classId: z.string().min(1, 'Class ID is required'),
    duration: z.number()
        .min(5, 'Duration must be at least 5 minutes')
        .max(180, 'Duration must be less than 180 minutes'),
    scheduledAt: z.string().datetime().optional(),
    settings: LiveExamSettingsSchema
});

// ===============================
// Join Live Exam Request Schema
// ===============================
export const JoinLiveExamRequestSchema = z.object({
    accessCode: z.string()
        .length(6, 'Access code must be exactly 6 characters')
        .regex(/^[A-Z0-9]{6}$/, 'Access code must contain only uppercase letters and numbers'),
    studentId: z.string().min(1, 'Student ID is required'),
    username: z.string()
        .min(2, 'Username must be at least 2 characters')
        .max(50, 'Username must be less than 50 characters')
});

// ===============================
// Student Answers Schema
// ===============================
export const StudentAnswersSchema = z.record(
    z.string(), // questionId
    z.any()     // answers can be strings, arrays, or objects depending on question type
);

// ===============================
// Submit Answers Request Schema
// ===============================
export const SubmitAnswersRequestSchema = z.object({
    liveExamId: z.string().min(1, 'Live exam ID is required'),
    studentId: z.string().min(1, 'Student ID is required'),
    answers: StudentAnswersSchema
});

// ===============================
// Update Activity Request Schema
// ===============================
export const UpdateActivityRequestSchema = z.object({
    liveExamId: z.string().min(1, 'Live exam ID is required'),
    studentId: z.string().min(1, 'Student ID is required'),
    currentQuestion: z.number().int().positive().optional(),
    answeredCount: z.number().int().min(0)
});

// ===============================
// Teacher Control Request Schema
// ===============================
export const TeacherControlRequestSchema = z.object({
    action: z.nativeEnum(TeacherAction),
    liveExamId: z.string().min(1, 'Live exam ID is required'),
    teacherId: z.string().min(1, 'Teacher ID is required')
});

export const WaitingRoomChatMessageSchema = z.object({
    content: z.string()
        .trim()
        .min(1, 'Chat message is required')
        .max(160, 'Chat message must be at most 160 characters')
});

export const WaitingRoomChatSettingsSchema = z.object({
    enabled: z.boolean()
});

// ===============================
// Anti-cheat Warning Schema
// ===============================
export const AntiCheatWarningSchema = z.object({
    type: z.enum(['tab_switch', 'fullscreen_exit', 'suspicious_timing']),
    timestamp: z.string().datetime(),
    details: z.string().optional()
});

// ===============================
// Live Exam Session Schema (Database)
// ===============================
export const LiveExamSessionSchema = z.object({
    id: z.string(),
    title: z.string(),
    quizId: z.string(),
    teacherId: z.string(),
    classId: z.string().optional(),
    
    // Timing
    duration: z.number(),
    scheduledAt: z.string().datetime().optional(),
    startedAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    closedAt: z.string().datetime().optional(),
    
    // Settings
    settings: LiveExamSettingsSchema,
    
    // State
    status: z.nativeEnum(LiveExamStatus),
    
    // Access
    accessCode: z.string(),
    
    // Metadata
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

// ===============================
// Live Exam Participant Schema (Database)
// ===============================
export const LiveExamParticipantSchema = z.object({
    id: z.string(),
    liveExamId: z.string(),
    studentId: z.string(),
    username: z.string(),
    
    // Timing
    joinedAt: z.string().datetime(),
    startedAt: z.string().datetime().optional(),
    submittedAt: z.string().datetime().optional(),
    
    // Answers
    answers: StudentAnswersSchema.optional(),
    
    // Results
    score: z.number().min(0).max(100).optional(),
    correctCount: z.number().int().min(0).optional(),
    wrongCount: z.number().int().min(0).optional(),
    rank: z.number().int().positive().optional(),
    
    // Anti-cheat
    tabSwitches: z.number().int().min(0).default(0),
    warnings: z.array(AntiCheatWarningSchema).optional(),
    
    // Metadata
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

// ===============================
// Live Exam Activity Schema (Database)
// ===============================
export const LiveExamActivitySchema = z.object({
    liveExamId: z.string(),
    studentId: z.string(),
    currentQuestion: z.number().int().positive().optional(),
    answeredCount: z.number().int().min(0),
    lastActivity: z.string().datetime(),
    isOnline: z.boolean()
});

// ===============================
// Type Inference Helpers
// ===============================
export type CreateLiveExamRequestInput = z.infer<typeof CreateLiveExamRequestSchema>;
export type JoinLiveExamRequestInput = z.infer<typeof JoinLiveExamRequestSchema>;
export type SubmitAnswersRequestInput = z.infer<typeof SubmitAnswersRequestSchema>;
export type UpdateActivityRequestInput = z.infer<typeof UpdateActivityRequestSchema>;
export type TeacherControlRequestInput = z.infer<typeof TeacherControlRequestSchema>;
