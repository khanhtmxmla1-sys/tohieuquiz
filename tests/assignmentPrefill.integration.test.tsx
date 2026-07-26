import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AssignmentTab from '../src/components/TeacherDashboard/AssignmentTab';
import { StudentDetailModal } from '../src/components/teacher/ResultsView/StudentDetailModal';
import { useTeacherDashboardUIStore } from '../src/stores/useTeacherDashboardUIStore';
import { useAssignmentStore } from '../src/stores/useAssignmentStore';
import { useClassStore } from '../src/stores/useClassStore';
import { useRosterStore } from '../src/stores/useRosterStore';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { fetchWeaknessProfile } from '../src/services/weaknessProfileService';
import { getSmartAssignmentPreview } from '../src/services/classroomService';
import { toVietnamDateTimeLocal } from '../src/utils/dateTime';
import { makeWeaknessProfileWeak } from './fixtures/weaknessProfile.fixtures';
import type { Question, Quiz, StudentResult } from '../src/types';
import type {
    Assignment,
    Classroom,
    SmartAssignmentPreviewApiResponse,
    Student,
} from '../src/types/classroom.types';

vi.mock('../src/services/weaknessProfileService', () => ({
    fetchWeaknessProfile: vi.fn(),
}));

vi.mock('../src/services/classroomService', () => ({
    getSmartAssignmentPreview: vi.fn(),
}));

vi.mock('../src/components/common', () => ({
    Button: ({ children, onClick, disabled, icon }: any) => (
        <button type="button" onClick={onClick} disabled={disabled}>
            {icon}
            {children}
        </button>
    ),
    ResponsiveDataView: ({ renderDesktop }: any) => renderDesktop(),
    QuestionReview: ({ question }: any) => (
        <div>{question?.question || question?.mainQuestion || 'Question review'}</div>
    ),
    ErrorBoundary: ({ children }: any) => <>{children}</>,
    Footer: () => null,
}));

vi.mock('../src/features/analytics/components/CompetencyRadar', () => ({
    CompetencyRadar: () => <div>Competency Radar</div>,
}));

vi.mock('../src/features/analytics/components/AIInsightBox', () => ({
    AIInsightBox: () => <div>AI Insight Box</div>,
}));

vi.mock('../src/services/ai/studentAnalysisService', () => ({
    analyzeStudentPerformance: vi.fn(),
}));

vi.mock('html2canvas', () => ({
    default: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
    },
}));

const mockedFetchWeaknessProfile = vi.mocked(fetchWeaknessProfile);
const mockedGetSmartAssignmentPreview = vi.mocked(getSmartAssignmentPreview);

const sampleQuestion: Question = {
    id: 'q1',
    type: 'MCQ',
    question: '1/2 bang bao nhieu?',
    options: ['1/2', '1/3', '2/3', '3/4'],
    correctAnswer: 'A',
    subject: 'math',
    skillCode: 'phan_so',
    subskillCode: 'rut_gon_phan_so',
    difficulty: 1,
};

const quizzes: Quiz[] = [
    {
        id: 'quiz-phan-so-01',
        title: 'On luyen phan so co ban',
        classLevel: '2',
        category: 'on-tap',
        timeLimit: 15,
        createdAt: '2026-04-22T10:00:00.000Z',
        questions: [sampleQuestion],
    },
    {
        id: 'quiz-phan-so-02',
        title: 'Phan so tong hop',
        classLevel: '2',
        category: 'on-tap',
        timeLimit: 20,
        createdAt: '2026-04-22T10:00:00.000Z',
        questions: [sampleQuestion],
    },
    {
        id: 'quiz-on-tap-tu-do',
        title: 'On tap tong hop cuoi tuan',
        classLevel: '2',
        category: 'on-tap',
        timeLimit: 18,
        createdAt: '2026-04-22T10:00:00.000Z',
        questions: [sampleQuestion],
    },
];

const classes: Classroom[] = [
    {
        id: 'c-001',
        name: '2A',
        teacherUsername: 'teacher_001',
        createdAt: '2026-04-22T10:00:00.000Z',
    },
];

const students: Student[] = [
    {
        id: 's-001',
        fullName: 'Lan',
        username: 'lan.001',
        classId: 'c-001',
    },
];

const result: StudentResult = {
    id: 'result-301',
    studentName: 'Lan',
    studentClass: '2A',
    quizId: 'quiz-current',
    quizTitle: 'Bai kiem tra phan so',
    score: 4,
    correctCount: 4,
    totalQuestions: 10,
    timeTaken: 15,
    submittedAt: '2026-04-22T10:00:00.000Z',
    answers: {
        q1: {
            selectedAnswer: 'B',
            isCorrect: false,
            questionSnapshot: {
                question: sampleQuestion.question,
                type: sampleQuestion.type,
                options: sampleQuestion.options,
                correctAnswer: sampleQuestion.correctAnswer,
                subject: sampleQuestion.subject,
                skillCode: sampleQuestion.skillCode,
                subskillCode: sampleQuestion.subskillCode,
            },
        },
    },
};

const SMART_PREVIEW_DEADLINE_ISO = '2026-04-29T16:59:00.000Z';

function makePreviewResponse(): SmartAssignmentPreviewApiResponse {
    return {
        status: 'success',
        data: {
            student: {
                id: 's-001',
                fullName: 'Lan',
                classId: 'c-001',
                className: '2A',
            },
            weaknessSummary: {
                resultId: 'result-301',
                coveragePercent: 100,
                basedOnResultIds: ['301', '302'],
                topSkill: {
                    subject: 'math',
                    subjectLabel: 'Toan',
                    skillCode: 'phan_so',
                    skillLabel: 'Phan so',
                    subskillCode: 'rut_gon_phan_so',
                    subskillLabel: 'Rut gon phan so',
                    status: 'weak',
                    accuracy: 25,
                    attempted: 4,
                    wrong: 3,
                    targetDifficulty: 1,
                },
            },
            recommendedQuizzes: [
                {
                    quizId: 'quiz-phan-so-01',
                    title: 'On luyen phan so co ban',
                    matchReason: 'Khop sat subskill Rut gon phan so',
                    questionCount: 10,
                    timeLimit: 15,
                    confidence: 0.95,
                    matchBreakdown: {
                        subjectMatched: true,
                        skillMatched: true,
                        subskillMatched: true,
                        matchedViaTags: false,
                        avgDifficulty: 1,
                        targetDifficulty: 1,
                        difficultyDistance: 0,
                        totalScore: 94,
                    },
                },
                {
                    quizId: 'quiz-phan-so-02',
                    title: 'Phan so tong hop',
                    matchReason: 'Khop skill Phan so',
                    questionCount: 12,
                    timeLimit: 20,
                    confidence: 0.78,
                    matchBreakdown: {
                        subjectMatched: true,
                        skillMatched: true,
                        subskillMatched: false,
                        matchedViaTags: false,
                        avgDifficulty: 2,
                        targetDifficulty: 1,
                        difficultyDistance: 1,
                        totalScore: 60,
                    },
                },
            ],
            assignmentDraft: {
                quizId: 'quiz-phan-so-01',
                classId: 'c-001',
                studentId: 's-001',
                deadline: SMART_PREVIEW_DEADLINE_ISO,
                maxAttempts: 1,
            },
            warnings: [],
        },
    };
}

function makeLowConfidencePreviewResponse(): SmartAssignmentPreviewApiResponse {
    const response = makePreviewResponse();
    if (response.status !== 'success' || !response.data || !('recommendedQuizzes' in response.data)) {
        return response;
    }

    return {
        ...response,
        data: {
            ...response.data,
            recommendedQuizzes: response.data.recommendedQuizzes.map((quiz, index) => (
                index === 0
                    ? {
                        ...quiz,
                        confidence: 0.45,
                    }
                    : quiz
            )),
            warnings: [
                {
                    code: 'LOW_METADATA_COVERAGE',
                    message: 'Do phu metadata chua cao, thay co nen xem nhanh de bai truoc khi giao.',
                },
            ],
            weaknessSummary: {
                ...response.data.weaknessSummary,
                coveragePercent: 55,
            },
        },
    };
}

function resetStores() {
    useTeacherDashboardUIStore.setState({
        activeTab: 'overview',
        assignmentComposerDraft: null,
    });

    useAuthStore.setState({
        isLoggedIn: true,
        username: 'teacher_001',
        teacherName: 'Co Mai',
        isAdmin: false,
        teacherClass: '2A',
        isLoggingIn: false,
        loginError: false,
    });

    useQuizStore.setState({
        view: 'teacher_dash',
        quizzes,
        results: [],
        selectedQuiz: null,
        selectedClassLevel: null,
        selectedCategory: null,
        isLoading: false,
        error: null,
    });

    useClassStore.setState({
        classes,
        isLoading: false,
        error: null,
        fetchClasses: vi.fn(async () => undefined),
        addClass: vi.fn(async () => null),
        removeClass: vi.fn(async () => true),
        clearError: vi.fn(),
    });

    useRosterStore.setState({
        students: { 'c-001': students },
        isLoading: false,
        error: null,
        fetchStudents: vi.fn(async () => undefined),
        addStudent: vi.fn(async () => null),
        addStudentsBulk: vi.fn(async () => null),
        removeStudent: vi.fn(async () => true),
        resetPassword: vi.fn(async () => true),
        clearError: vi.fn(),
    });

    useAssignmentStore.setState({
        assignments: [],
        isLoading: false,
        error: null,
        fetchTeacherAssignments: vi.fn(async () => undefined),
        fetchAllAssignments: vi.fn(async () => undefined),
        fetchAssignments: vi.fn(async () => undefined),
        fetchStudentAssignments: vi.fn(async () => undefined),
        addAssignment: vi.fn(async (payload) => ({
            id: 'assignment-001',
            quizId: payload.quizId,
            classId: payload.classId,
            studentId: payload.studentId,
            deadline: payload.deadline,
            maxAttempts: payload.maxAttempts,
            status: 'OPEN',
            createdAt: '2026-04-22T10:00:00.000Z',
        } as Assignment)),
        removeAssignment: vi.fn(async () => true),
        updateAssignmentDeadline: vi.fn(async () => true),
        updateAssignmentStatus: vi.fn(async () => true),
        startAssignmentAttempt: vi.fn(async () => true),
        resetAssignments: vi.fn(),
        clearError: vi.fn(),
    });
}

function renderHarness() {
    return render(
        <>
            <StudentDetailModal
                result={result}
                questions={[sampleQuestion]}
                onClose={() => undefined}
            />
            <AssignmentTab />
        </>,
    );
}

function getAnalyticsButton() {
    const buttons = screen.getAllByRole('button');
    const button = buttons.find((candidate) => {
        const text = candidate.textContent?.toLowerCase() || '';
        return /ph.*t.*ch/i.test(text) && !/giao bai|dung trong assignmenttab|bo goi y/i.test(text);
    });

    if (!button) {
        throw new Error(`Khong tim thay nut mo tab analytics trong StudentDetailModal. Buttons hien co: ${buttons.map((candidate) => `[${candidate.textContent || ''}]`).join(' | ')}`);
    }

    return button;
}

async function openSmartPreviewPanel() {
    await act(async () => {
        fireEvent.click(getAnalyticsButton());
    });

    await waitFor(() => {
        expect(mockedFetchWeaknessProfile).toHaveBeenCalledWith('result-301');
    });

    await screen.findAllByText(/Can uu tien|Can luyen them/i);

    const buttons = await screen.findAllByRole('button');
    const previewButton = buttons.find((candidate) => {
        const text = candidate.textContent?.toLowerCase() || '';
        return /giao.*bai.*on.*loi|dang.*tao.*preview/i.test(text);
    });

    if (!previewButton) {
        throw new Error(`Khong tim thay nut smart preview. Buttons hien co: ${buttons.map((candidate) => `[${candidate.textContent || ''}]`).join(' | ')}`);
    }

    await act(async () => {
        fireEvent.click(previewButton);
    });

    await waitFor(() => {
        expect(mockedGetSmartAssignmentPreview).toHaveBeenCalled();
        expect(screen.getByText(/Ky nang uu tien/i)).toBeInTheDocument();

        const dateInputs = Array.from(document.querySelectorAll('input[type="datetime-local"]')) as HTMLInputElement[];
        expect(dateInputs.some((input) => input.value.length > 0)).toBe(true);
    });
}

describe('assignment prefill integration flow', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        resetStores();
        mockedFetchWeaknessProfile.mockResolvedValue(makeWeaknessProfileWeak());
        mockedGetSmartAssignmentPreview.mockResolvedValue(makePreviewResponse());
    });

    it('moves smart preview into AssignmentTab and hydrates the form', async () => {
        const { container } = renderHarness();

        await openSmartPreviewPanel();
        await act(async () => {
            fireEvent.click(await screen.findByRole('button', { name: /Dung trong AssignmentTab/i }));
        });

        await waitFor(() => {
            expect(useTeacherDashboardUIStore.getState().activeTab).toBe('assignments');
            expect(useTeacherDashboardUIStore.getState().assignmentComposerDraft).not.toBeNull();
        });

        const selects = Array.from(container.querySelectorAll('select')) as HTMLSelectElement[];
        const quizSelect = selects.find(select => Array.from(select.options).some(option => option.value === 'quiz-phan-so-01'))!;
        const classSelect = selects.find(select => Array.from(select.options).some(option => option.value === 'c-001'))!;
        const studentSelect = selects.find(select => Array.from(select.options).some(option => option.value === 's-001'))!;
        const deadlineInputs = Array.from(container.querySelectorAll('input[type="datetime-local"]')) as HTMLInputElement[];
        const assignmentDeadlineInput = deadlineInputs[deadlineInputs.length - 1];
        const numberInputs = Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
        const attemptsInput = numberInputs[numberInputs.length - 1];
        const expectedAssignmentDeadline = toVietnamDateTimeLocal(SMART_PREVIEW_DEADLINE_ISO);

        expect(quizSelect.value).toBe('quiz-phan-so-01');
        expect(classSelect.value).toBe('c-001');
        expect(studentSelect.value).toBe('s-001');
        expect(assignmentDeadlineInput.value).toContain(expectedAssignmentDeadline);
        expect(attemptsInput.value).toBe('1');

        const assignmentArea = screen.getByText(/Da nap goi y tu ket qua hoc sinh/i).closest('div');
        expect(assignmentArea).toBeInTheDocument();
        expect(screen.getByText(/Vi sao de nay duoc goi y/i)).toBeInTheDocument();
        expect(screen.getByText(/^95%$/i)).toBeInTheDocument();
    });

    it('clears the draft when the teacher chooses manual mode', async () => {
        renderHarness();

        await openSmartPreviewPanel();
        await act(async () => {
            fireEvent.click(await screen.findByRole('button', { name: /Dung trong AssignmentTab/i }));
        });

        await waitFor(() => expect(useTeacherDashboardUIStore.getState().assignmentComposerDraft).not.toBeNull());

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Bo goi y/i }));
        });

        await waitFor(() => {
            expect(useTeacherDashboardUIStore.getState().assignmentComposerDraft).toBeNull();
        });

        expect(screen.queryByText(/Vi sao de nay duoc goi y/i)).not.toBeInTheDocument();
    });

    it('shows manual-adjusted state when the teacher picks a non-recommended quiz', async () => {
        const { container } = renderHarness();

        await openSmartPreviewPanel();
        await act(async () => {
            fireEvent.click(await screen.findByRole('button', { name: /Dung trong AssignmentTab/i }));
        });

        const selects = Array.from(container.querySelectorAll('select')) as HTMLSelectElement[];
        const quizSelect = selects.find(select => Array.from(select.options).some(option => option.value === 'quiz-on-tap-tu-do'))!;

        await act(async () => {
            fireEvent.change(quizSelect, { target: { value: 'quiz-on-tap-tu-do' } });
        });

        expect(screen.getByText(/Da chinh tay/i)).toBeInTheDocument();
        expect(screen.getByText(/Ban da chinh de bai hoac doi tuong khac so voi goi y ban dau/i)).toBeInTheDocument();
        expect(screen.getAllByText(/On tap tong hop cuoi tuan/i).length).toBeGreaterThan(0);
    });

    it('surfaces low-confidence warnings inside the assignment insight card', async () => {
        mockedGetSmartAssignmentPreview.mockResolvedValueOnce(makeLowConfidencePreviewResponse());

        renderHarness();

        await openSmartPreviewPanel();
        await act(async () => {
            fireEvent.click(await screen.findByRole('button', { name: /Dung trong AssignmentTab/i }));
        });

        expect(screen.getAllByText(/Do tin cay thap/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Do phu metadata chua cao, thay co nen xem nhanh de bai truoc khi giao/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Do phu metadata duoi 60%, thay co nen xem nhanh de bai truoc khi giao/i)).toBeInTheDocument();
    });

    it('falls back to review mode when the recommended quiz is no longer available', async () => {
        const { container } = renderHarness();

        await openSmartPreviewPanel();

        await act(async () => {
            useQuizStore.setState({
                quizzes: quizzes.filter((quiz) => quiz.id !== 'quiz-phan-so-01'),
            });
        });

        await act(async () => {
            fireEvent.click(await screen.findByRole('button', { name: /Dung trong AssignmentTab/i }));
        });

        await waitFor(() => {
            const selects = Array.from(container.querySelectorAll('select')) as HTMLSelectElement[];
            const quizSelect = selects.find(select => Array.from(select.options).some(option => option.value === 'quiz-on-tap-tu-do'))!;

            expect(quizSelect.value).toBe('');
        });

        expect(screen.getAllByText(/Nen xem lai/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/De goi y ban dau khong con kha dung. Thay co vui long chon lai de bai truoc khi giao/i)).toBeInTheDocument();
        expect(screen.getByText(/De goi y khong con ton tai. Thay co vui long chon mot de khac/i)).toBeInTheDocument();
    });

    it('clears the draft after a successful assignment submit', async () => {
        renderHarness();

        await openSmartPreviewPanel();
        await act(async () => {
            fireEvent.click(await screen.findByRole('button', { name: /Dung trong AssignmentTab/i }));
        });

        await waitFor(() => expect(useTeacherDashboardUIStore.getState().assignmentComposerDraft).not.toBeNull());

        const submitButtons = screen.getAllByRole('button', { name: /Giao bài|Giao bai/i });
        await act(async () => {
            fireEvent.click(submitButtons[submitButtons.length - 1]);
        });

        await waitFor(() => {
            expect(useTeacherDashboardUIStore.getState().assignmentComposerDraft).toBeNull();
        });

        const addAssignment = useAssignmentStore.getState().addAssignment as ReturnType<typeof vi.fn>;
        expect(addAssignment).toHaveBeenCalledWith(
            expect.objectContaining({
                quizId: 'quiz-phan-so-01',
                classId: 'c-001',
                studentId: 's-001',
                maxAttempts: 1,
            }),
        );
    });
});
