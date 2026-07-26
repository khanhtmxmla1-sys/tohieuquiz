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
    TeacherAction,
    StudentAnswers,
    SendWaitingRoomMessageRequest,
    UpdateWaitingRoomChatSettingsRequest,
} from '../types/liveExam.types';
import { fetchWithJWTInterceptor } from '../utils/jwtInterceptor';
import { getWorkersApiBaseUrl } from './api/config';

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
        throw new Error(errorMessage);
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
 * Control Live Exam Session (open, start, end)
 */
export async function controlLiveExam(
    sessionId: string,
    action: TeacherAction
): Promise<LiveExamSession> {
    const result = await apiCall<{ success: boolean; session: LiveExamSession }>(
        `/api/live-exam/${sessionId}/control`,
        {
            method: 'POST',
            body: JSON.stringify({ action }),
        }
    );
    return result.session;
}

/**
 * Open session (scheduled → waiting)
 */
export async function openSession(sessionId: string): Promise<LiveExamSession> {
    return controlLiveExam(sessionId, 'open_session' as TeacherAction);
}

/**
 * Start exam (waiting → active)
 */
export async function startExam(sessionId: string): Promise<LiveExamSession> {
    return controlLiveExam(sessionId, 'start_exam' as TeacherAction);
}

/**
 * End exam early (active → scoring → closed)
 */
export async function endExamEarly(sessionId: string): Promise<LiveExamSession> {
    return controlLiveExam(sessionId, 'end_early' as TeacherAction);
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
export async function submitAnswers(
    sessionId: string,
    answers: StudentAnswers
): Promise<LiveExamSubmissionResponse> {
    const result = await apiCall<{ success: boolean; participant: LiveExamSubmissionResponse['participant'] }>(
        `/api/live-exam/${sessionId}/submit`,
        {
            method: 'POST',
            body: JSON.stringify({ answers }),
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
