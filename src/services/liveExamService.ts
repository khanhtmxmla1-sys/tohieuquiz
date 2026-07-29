/**
 * Live Exam Service
 * 
 * API calls for Live Exam Session feature.
 * Handles teacher and student interactions with live exams.
 * 
 * Related: CONTEXT.md, ADR-0001 (Polling)
 */

import type {
    LiveExamSession,
    LiveExamParticipant,
    LiveExamStatusResponse,
    LiveExamParticipantsResponse,
    LiveExamResultsResponse,
    LiveExamSubmissionResponse,
    WaitingRoomChatMessage,
    WaitingRoomChatResponse,
    CreateLiveExamRequest,
    JoinLiveExamRequest,
    SubmitAnswersRequest,
    StudentAnswers,
    SendWaitingRoomMessageRequest,
    UpdateWaitingRoomChatSettingsRequest,
} from '../types/liveExam.types';
import { TeacherAction } from '../types/liveExam.types';
import { fetchWithJWTInterceptor } from '../utils/jwtInterceptor';
import { retryWithBackoff, type RetryOptions } from '../utils/boundedRetry';
import { getWorkersApiBaseUrl } from './api/config';

export class LiveExamApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'LiveExamApiError';
        this.status = status;
    }
}

/**
 * Generic API call helper
 */
async function apiCall<T>(
    endpoint: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await fetchWithJWTInterceptor(`${getWorkersApiBaseUrl()}${endpoint}`, {
        ...options,
        credentials: 'include', // Include JWT cookie
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        // Try to parse error as JSON, but handle HTML responses (401 redirects)
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            }
        } catch (e) {
            // Ignore JSON parse errors for HTML responses
        }
        throw new LiveExamApiError(errorMessage, response.status);
    }

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Expected JSON response but got: ' + contentType);
    }

    return response.json();
}

// ============================================================================
// TEACHER API
// ============================================================================

/**
 * Create a new Live Exam Session
 */
export async function createLiveExam(
    data: CreateLiveExamRequest
): Promise<LiveExamSession> {
    const result = await apiCall<{ success: boolean; session: LiveExamSession }>(
        '/api/live-exam/create',
        {
            method: 'POST',
            body: JSON.stringify(data),
        }
    );
    return result.session;
}

/**
 * Get Live Exam Session details (teacher only)
 */
export async function getLiveExamSession(
    sessionId: string
): Promise<LiveExamSession> {
    const result = await apiCall<{ success: boolean; session: LiveExamSession }>(
        `/api/live-exam/${sessionId}`
    );
    return result.session;
}

/**
 * Delete a Live Exam Session (teacher only)
 */
export async function deleteLiveExamSession(sessionId: string): Promise<void> {
    await apiCall<{ success: boolean; message: string }>(
        `/api/live-exam/${sessionId}`,
        {
            method: 'DELETE',
        }
    );
}

/**
 * Control Live Exam Session lifecycle.
 */
type TeacherControlPayload =
    | { action: TeacherAction.OPEN_SESSION }
    | { action: TeacherAction.START_EXAM }
    | { action: TeacherAction.PAUSE_EXAM }
    | { action: TeacherAction.RESUME_EXAM }
    | { action: TeacherAction.PREPARE_END_EARLY }
    | { action: TeacherAction.END_EARLY; confirmationToken: string; reason: string }
    | { action: TeacherAction.EXTEND_PARTICIPANT; participantId: string; extraMinutes: number };

interface TeacherControlResponse {
    success: boolean;
    session: LiveExamSession;
    confirmationToken?: string;
    expiresAt?: string;
    individualEndsAt?: string;
}

async function controlLiveExam(
    sessionId: string,
    payload: TeacherControlPayload,
): Promise<TeacherControlResponse> {
    return apiCall<TeacherControlResponse>(
        `/api/live-exam/${sessionId}/control`,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        },
    );
}

export async function openSession(sessionId: string): Promise<LiveExamSession> {
    return (await controlLiveExam(sessionId, { action: TeacherAction.OPEN_SESSION })).session;
}

export async function startExam(sessionId: string): Promise<LiveExamSession> {
    return (await controlLiveExam(sessionId, { action: TeacherAction.START_EXAM })).session;
}

export async function pauseExam(sessionId: string): Promise<LiveExamSession> {
    return (await controlLiveExam(sessionId, { action: TeacherAction.PAUSE_EXAM })).session;
}

export async function resumeExam(sessionId: string): Promise<LiveExamSession> {
    return (await controlLiveExam(sessionId, { action: TeacherAction.RESUME_EXAM })).session;
}

export async function prepareEndExamEarly(
    sessionId: string,
): Promise<{ confirmationToken: string; expiresAt: string }> {
    const result = await controlLiveExam(sessionId, { action: TeacherAction.PREPARE_END_EARLY });
    if (!result.confirmationToken || !result.expiresAt) {
        throw new Error('Server did not return an early-end confirmation');
    }
    return { confirmationToken: result.confirmationToken, expiresAt: result.expiresAt };
}

export async function endExamEarly(
    sessionId: string,
    confirmationToken: string,
    reason: string,
): Promise<LiveExamSession> {
    return (await controlLiveExam(sessionId, {
        action: TeacherAction.END_EARLY,
        confirmationToken,
        reason,
    })).session;
}

export async function extendParticipantTime(
    sessionId: string,
    participantId: string,
    extraMinutes: number,
): Promise<string> {
    const result = await controlLiveExam(sessionId, {
        action: TeacherAction.EXTEND_PARTICIPANT,
        participantId,
        extraMinutes,
    });
    if (!result.individualEndsAt) throw new Error('Server did not return the participant deadline');
    return result.individualEndsAt;
}

/**
 * Get participants list (teacher polling)
 * Called every 3 seconds by useLiveExamParticipants hook
 */
export async function getParticipants(
    sessionId: string
): Promise<LiveExamParticipantsResponse> {
    return apiCall<LiveExamParticipantsResponse>(
        `/api/live-exam/${sessionId}/participants`
    );
}

// ============================================================================
// STUDENT API
// ============================================================================

/**
 * Join a Live Exam Session with access code
 */
export async function joinLiveExam(
    accessCode: string
): Promise<{ participant: LiveExamParticipant; session: any }> {
    return apiCall<{ success: boolean; participant: LiveExamParticipant; session: any }>(
        '/api/live-exam/join',
        {
            method: 'POST',
            body: JSON.stringify({ accessCode }),
        },
    );
}

/**
 * Get session status (student polling)
 * Called every 3 seconds by useLiveExamStatus hook
 */
export async function getSessionStatus(
    sessionId: string
): Promise<LiveExamStatusResponse> {
    return apiCall<LiveExamStatusResponse>(
        `/api/live-exam/${sessionId}/status`,
        {},
    );
}

/**
 * Submit answers
 */
export interface SubmitAnswersOptions {
    idempotencyKey: string;
    retry?: RetryOptions;
}

const isTransientSubmitError = (error: unknown): boolean => {
    if (!(error instanceof LiveExamApiError)) return true;
    return error.status === 408
        || error.status === 425
        || error.status === 429
        || error.status >= 500;
};

export async function submitAnswers(
    sessionId: string,
    answers: StudentAnswers,
    options: SubmitAnswersOptions,
): Promise<LiveExamSubmissionResponse> {
    const result = await retryWithBackoff(
        () => apiCall<{ success: boolean; participant: LiveExamSubmissionResponse['participant'] }>(
            `/api/live-exam/${sessionId}/submit`,
            {
                method: 'POST',
                body: JSON.stringify({ answers, idempotencyKey: options.idempotencyKey }),
                headers: { 'Idempotency-Key': options.idempotencyKey },
            },
        ),
        {
            maxAttempts: 3,
            baseDelayMs: 300,
            maxDelayMs: 1_500,
            shouldRetry: isTransientSubmitError,
            ...options.retry,
        },
    );

    return {
        participant: result.participant,
    };
}

/**
 * Update activity (progress tracking)
 * Called with every status poll
 */
export interface LiveExamAnswerSnapshot {
    attemptVersion: number;
    answers: StudentAnswers;
    updatedAt: string;
}

export async function getAnswerSnapshot(sessionId: string): Promise<LiveExamAnswerSnapshot | null> {
    const result = await apiCall<{ success: boolean; snapshot: LiveExamAnswerSnapshot | null }>(
        `/api/live-exam/${sessionId}/autosave`,
    );
    return result.snapshot;
}

export async function saveAnswerSnapshot(
    sessionId: string,
    snapshot: { attemptVersion: number; idempotencyKey: string; answers: StudentAnswers },
): Promise<LiveExamAnswerSnapshot> {
    const result = await apiCall<{ success: boolean; snapshot: LiveExamAnswerSnapshot }>(
        `/api/live-exam/${sessionId}/autosave`,
        { method: 'PUT', body: JSON.stringify(snapshot), headers: { 'Idempotency-Key': snapshot.idempotencyKey } },
    );
    return result.snapshot;
}

export async function updateActivity(
    sessionId: string,
    data: {
        currentQuestion?: number;
        answeredCount: number;
    }
): Promise<void> {
    await apiCall<{ success: boolean }>(
        `/api/live-exam/${sessionId}/activity`,
        {
            method: 'POST',
            body: JSON.stringify(data),
        },
    );
}

/**
 * Get results after session closes
 */
export async function getResults(
    sessionId: string
): Promise<LiveExamResultsResponse> {
    return apiCall<LiveExamResultsResponse>(
        `/api/live-exam/${sessionId}/results`,
        {},
    );
}

export async function getWaitingRoomChat(
    sessionId: string,
    asTeacher = false
): Promise<WaitingRoomChatResponse> {
    return apiCall<WaitingRoomChatResponse>(
        `/api/live-exam/${sessionId}/chat`,
        {},
    );
}

export async function sendWaitingRoomMessage(
    sessionId: string,
    data: SendWaitingRoomMessageRequest
): Promise<WaitingRoomChatMessage> {
    const result = await apiCall<{ success: boolean; message: WaitingRoomChatMessage }>(
        `/api/live-exam/${sessionId}/chat/message`,
        {
            method: 'POST',
            body: JSON.stringify(data),
        },
    );
    return result.message;
}

export async function sendWaitingRoomAnnouncement(
    sessionId: string,
    data: SendWaitingRoomMessageRequest
): Promise<WaitingRoomChatMessage> {
    const result = await apiCall<{ success: boolean; message: WaitingRoomChatMessage }>(
        `/api/live-exam/${sessionId}/chat/announcement`,
        {
            method: 'POST',
            body: JSON.stringify(data),
        },
    );
    return result.message;
}

export async function updateWaitingRoomChatSettings(
    sessionId: string,
    data: UpdateWaitingRoomChatSettingsRequest
): Promise<void> {
    await apiCall<{ success: boolean }>(
        `/api/live-exam/${sessionId}/chat/settings`,
        {
            method: 'PUT',
            body: JSON.stringify(data),
        },
    );
}

export async function hideWaitingRoomChatMessage(
    sessionId: string,
    messageId: string
): Promise<void> {
    await apiCall<{ success: boolean }>(
        `/api/live-exam/${sessionId}/chat/${messageId}/hide`,
        {
            method: 'PUT',
        },
    );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate access code format (6 uppercase alphanumeric)
 */
export function isValidAccessCode(code: string): boolean {
    return /^[A-Z0-9]{6}$/.test(code);
}

/**
 * Format access code (add spaces for readability)
 * ABC123 → ABC 123
 */
export function formatAccessCode(code: string): string {
    if (code.length !== 6) return code;
    return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/**
 * Parse access code (remove spaces)
 * ABC 123 → ABC123
 */
export function parseAccessCode(code: string): string {
    return code.replace(/\s/g, '').toUpperCase();
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(
    answeredCount: number,
    totalQuestions: number
): number {
    if (totalQuestions === 0) return 0;
    return Math.round((answeredCount / totalQuestions) * 100);
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: string): string {
    switch (status) {
        case 'scheduled':
            return 'gray';
        case 'waiting':
            return 'yellow';
        case 'active':
            return 'green';
        case 'paused':
            return 'yellow';
        case 'scoring':
            return 'blue';
        case 'closed':
            return 'purple';
        default:
            return 'gray';
    }
}

/**
 * Get status label for UI
 */
export function getStatusLabel(status: string): string {
    switch (status) {
        case 'scheduled':
            return 'Đã lên lịch';
        case 'waiting':
            return 'Đang chờ';
        case 'active':
            return 'Đang thi';
        case 'paused':
            return 'Tạm dừng';
        case 'scoring':
            return 'Đang chấm';
        case 'closed':
            return 'Đã kết thúc';
        default:
            return status;
    }
}

/**
 * Get all sessions for a teacher
 */
export async function getTeacherSessions(teacherUsername: string): Promise<LiveExamSession[]> {
    return apiCall<LiveExamSession[]>(`/api/live-exam/teacher/${teacherUsername}/sessions`);
}
