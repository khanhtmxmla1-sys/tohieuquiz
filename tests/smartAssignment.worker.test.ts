import { describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env, Question } from '../workers/src/types';
import { handleClassroomRoutes } from '../workers/src/routes/classroom';
import type { ResultRowWithAnswers } from '../workers/src/services/weaknessProfile';

vi.mock('../workers/src/utils/jwt', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../workers/src/utils/jwt')>();
    return {
        ...actual,
        verifyJWT: async (token: string) => {
            try {
                return JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'));
            } catch {
                return null;
            }
        },
    };
});

const TEST_JWT_SECRET = 'test-secret';

function base64UrlEncode(input: string | Uint8Array): string {
    const buffer = typeof input === 'string' ? Buffer.from(input) : Buffer.from(input);
    return buffer.toString('base64url');
}

async function createTestJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64UrlEncode(JSON.stringify({ ...payload, iat: now, exp: now + 3600 }));
    const data = `${header}.${body}`;
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return `${data}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function createTeacherRequest(url: string, init: RequestInit): Promise<Request> {
    const token = await createTestJwt({ username: 'teacher_001', role: 'teacher', fullName: 'Teacher 001' }, TEST_JWT_SECRET);
    return new Request(url, {
        ...init,
        headers: {
            ...Object.fromEntries(new Headers(init.headers || {}).entries()),
            Authorization: `Bearer ${token}`,
        },
    });
}

function createAnswerEntry(selectedAnswer: any, isCorrect: boolean) {
    return { selectedAnswer, isCorrect };
}

function createResult(overrides: Partial<ResultRowWithAnswers>): ResultRowWithAnswers {
    return {
        id: 1,
        student_name: 'Lan',
        class_name: '2A',
        quiz_id: 'quiz-current',
        quiz_title: 'Quiz hien tai',
        score: 6,
        correct_count: 6,
        total_questions: 10,
        time_taken: 10,
        submitted_at: '2026-04-22T10:00:00.000Z',
        answers: '{}',
        ...overrides,
    };
}

function createQuestion(overrides: Partial<Question>): Question {
    return {
        id: 'q1',
        quiz_id: 'quiz-current',
        type: 'MCQ',
        question: 'Question',
        correct_answer: 'A',
        options: 'A|B|C|D',
        items: '',
        text_field: '',
        blanks: '',
        distractors: '',
        sentence: '',
        words: '',
        correct_word_indexes: '',
        image: '',
        tags: '',
        subject: '',
        skill_code: '',
        subskill_code: '',
        ...overrides,
    };
}

function createFakeDb(
    options: {
        results: ResultRowWithAnswers[];
        questions: Question[];
        students?: Array<{ id: string; full_name: string; class_id: string; class_name: string; teacher_username: string }>;
        quizRows?: Array<{
            quiz_id: string;
            title: string;
            time_limit: number;
            subject?: string;
            skill_code?: string;
            subskill_code?: string;
            tags?: string;
            difficulty?: number | string;
            difficulty_level?: number | string;
            difficultyLevel?: number | string;
        }>;
    },
) {
    return {
        prepare(query: string) {
            return {
                bind(...params: any[]) {
                    return {
                        async first<T>() {
                            if (query.includes('SELECT status, token_version, must_change_password')
                                && query.includes('FROM teachers')) {
                                return {
                                    status: 'ACTIVE',
                                    token_version: 1,
                                    must_change_password: 0,
                                } as T;
                            }
                            if (query.includes('FROM results WHERE id = ?')) {
                                return (options.results.find((result) => String(result.id) === String(params[0])) || null) as T;
                            }

                            throw new Error(`Unhandled first query: ${query}`);
                        },
                        async all<T>() {
                            if (query.includes('FROM students s') && query.includes('INNER JOIN classes c')) {
                                const [studentName, teacherUsername] = params;
                                const filtered = (options.students || [])
                                    .filter((student) => student.full_name === studentName && student.teacher_username === teacherUsername)
                                    .map((student) => ({
                                        id: student.id,
                                        full_name: student.full_name,
                                        class_id: student.class_id,
                                        class_name: student.class_name,
                                    }));
                                return { results: filtered as T[] };
                            }

                            if (query.includes('FROM results') && query.includes('student_name = ? AND class_name = ?')) {
                                const [studentName, className] = params;
                                const filtered = options.results
                                    .filter((result) => result.student_name === studentName && result.class_name === className)
                                    .sort((left, right) => right.submitted_at.localeCompare(left.submitted_at))
                                    .slice(0, 5);
                                return { results: filtered as T[] };
                            }

                            if (query.includes('FROM questions WHERE quiz_id IN')) {
                                const filtered = options.questions.filter((question) => params.includes(question.quiz_id));
                                return { results: filtered as T[] };
                            }

                            if (query.includes('FROM quizzes q') && query.includes('INNER JOIN questions qt')) {
                                const currentQuizId = params[0];
                                const rows = (options.quizRows || []).filter((row) => row.quiz_id !== currentQuizId);
                                return { results: rows as T[] };
                            }

                            throw new Error(`Unhandled all query: ${query}`);
                        },
                        async run() {
                            return { success: true };
                        },
                    };
                },
            };
        },
    } as any;
}

function createEnv(db: D1Database): Env {
    return {
        DB: db,
        CLIPROXY_API: '',
        CLIPROXY_TOKEN: '',
        JWT_SECRET: TEST_JWT_SECRET,
    };
}

describe('smart assignment preview route', () => {
    it('returns preview payload for a valid student and matched quiz', async () => {
        const results = [
            createResult({
                id: 301,
                answers: JSON.stringify({
                    q1: createAnswerEntry('B', false),
                    q2: createAnswerEntry('B', false),
                    q3: createAnswerEntry('A', true),
                }),
            }),
            createResult({
                id: 302,
                submitted_at: '2026-04-21T10:00:00.000Z',
                answers: JSON.stringify({
                    q4: createAnswerEntry('B', false),
                }),
            }),
        ];

        const questions = [
            createQuestion({ id: 'q1', quiz_id: 'quiz-current', subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so' }),
            createQuestion({ id: 'q2', quiz_id: 'quiz-current', subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so' }),
            createQuestion({ id: 'q3', quiz_id: 'quiz-current', subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so' }),
            createQuestion({ id: 'q4', quiz_id: 'quiz-current', subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so' }),
        ];

        const db = createFakeDb({
            results,
            questions,
            students: [
                { id: 's-001', full_name: 'Lan', class_id: 'c-001', class_name: '2A', teacher_username: 'teacher_001' },
            ],
            quizRows: [
                { quiz_id: 'quiz-phan-so-01', title: 'On luyen phan so co ban', time_limit: 15, subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so', tags: '#toan,#phan_so,#difficulty_1' },
                { quiz_id: 'quiz-phan-so-01', title: 'On luyen phan so co ban', time_limit: 15, subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so', tags: '#toan,#phan_so,#difficulty_1' },
                { quiz_id: 'quiz-phan-so-02', title: 'Phan so nang cao', time_limit: 20, subject: 'math', skill_code: 'phan_so', subskill_code: 'so_sanh_phan_so', tags: '#toan,#phan_so,#difficulty_3' },
            ],
        });

        const response = await handleClassroomRoutes(
            await createTeacherRequest('https://example.com/api/assignments/smart-preview', {
                method: 'POST',
                body: JSON.stringify({
                    resultId: '301',
                    teacherUsername: 'teacher_001',
                    strategy: 'top_weak_skill',
                    deadlinePreset: '7d',
                    maxAttempts: 1,
                }),
            }),
            createEnv(db),
            '/api/assignments/smart-preview',
            'POST',
        );

        const json = await response.json() as any;

        expect(response.status).toBe(200);
        expect(json.status).toBe('success');
        expect(json.data.student.id).toBe('s-001');
        expect(json.data.weaknessSummary.topSkill.skillCode).toBe('phan_so');
        expect(json.data.weaknessSummary.topSkill.subskillCode).toBe('rut_gon_phan_so');
        expect(json.data.weaknessSummary.topSkill.targetDifficulty).toBe(1);
        expect(json.data.recommendedQuizzes[0].quizId).toBe('quiz-phan-so-01');
        expect(json.data.recommendedQuizzes[0].matchBreakdown.subskillMatched).toBe(true);
        expect(json.data.recommendedQuizzes[0].matchBreakdown.targetDifficulty).toBe(1);
        expect(json.data.assignmentDraft.studentId).toBe('s-001');
    });

    it('prefers exact subskill matches and closer difficulty over skill-only matches', async () => {
        const db = createFakeDb({
            results: [
                createResult({
                    id: 501,
                    answers: JSON.stringify({
                        q1: createAnswerEntry('B', false),
                        q2: createAnswerEntry('B', false),
                        q3: createAnswerEntry('A', true),
                    }),
                }),
            ],
            questions: [
                createQuestion({ id: 'q1', subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so' }),
                createQuestion({ id: 'q2', subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so' }),
                createQuestion({ id: 'q3', subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so' }),
            ],
            students: [
                { id: 's-001', full_name: 'Lan', class_id: 'c-001', class_name: '2A', teacher_username: 'teacher_001' },
            ],
            quizRows: [
                { quiz_id: 'quiz-subskill', title: 'Rut gon phan so co ban', time_limit: 15, subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so', tags: '#toan,#phan_so,#difficulty_1' },
                { quiz_id: 'quiz-subskill', title: 'Rut gon phan so co ban', time_limit: 15, subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so', tags: '#toan,#phan_so,#difficulty_1' },
                { quiz_id: 'quiz-skill-only', title: 'Phan so tong hop', time_limit: 15, subject: 'math', skill_code: 'phan_so', subskill_code: 'so_sanh_phan_so', tags: '#toan,#phan_so,#difficulty_1' },
                { quiz_id: 'quiz-skill-only', title: 'Phan so tong hop', time_limit: 15, subject: 'math', skill_code: 'phan_so', subskill_code: 'so_sanh_phan_so', tags: '#toan,#phan_so,#difficulty_1' },
            ],
        });

        const response = await handleClassroomRoutes(
            await createTeacherRequest('https://example.com/api/assignments/smart-preview', {
                method: 'POST',
                body: JSON.stringify({
                    resultId: '501',
                    teacherUsername: 'teacher_001',
                    strategy: 'top_weak_skill',
                }),
            }),
            createEnv(db),
            '/api/assignments/smart-preview',
            'POST',
        );

        const json = await response.json() as any;

        expect(json.status).toBe('success');
        expect(json.data.recommendedQuizzes[0].quizId).toBe('quiz-subskill');
        expect(json.data.recommendedQuizzes[0].matchBreakdown.subskillMatched).toBe(true);
        expect(json.data.recommendedQuizzes[1].matchBreakdown.subskillMatched).toBe(false);
        expect(json.data.recommendedQuizzes[0].matchBreakdown.totalScore).toBeGreaterThan(
            json.data.recommendedQuizzes[1].matchBreakdown.totalScore,
        );
    });

    it('uses explicit difficulty metadata before tag fallback when ranking quizzes', async () => {
        const db = createFakeDb({
            results: [
                createResult({
                    id: 551,
                    answers: JSON.stringify({
                        q1: createAnswerEntry('B', false),
                        q2: createAnswerEntry('B', false),
                        q3: createAnswerEntry('A', true),
                    }),
                }),
            ],
            questions: [
                createQuestion({ id: 'q1', subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so' }),
                createQuestion({ id: 'q2', subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so' }),
                createQuestion({ id: 'q3', subject: 'math', skill_code: 'phan_so', subskill_code: 'rut_gon_phan_so' }),
            ],
            students: [
                { id: 's-001', full_name: 'Lan', class_id: 'c-001', class_name: '2A', teacher_username: 'teacher_001' },
            ],
            quizRows: [
                {
                    quiz_id: 'quiz-explicit-easy',
                    title: 'Phan so muc de',
                    time_limit: 15,
                    subject: 'math',
                    skill_code: 'phan_so',
                    subskill_code: 'rut_gon_phan_so',
                    difficulty: 1,
                    tags: '#toan,#phan_so,#difficulty_3',
                },
                {
                    quiz_id: 'quiz-explicit-hard',
                    title: 'Phan so muc kho',
                    time_limit: 15,
                    subject: 'math',
                    skill_code: 'phan_so',
                    subskill_code: 'rut_gon_phan_so',
                    difficulty: 3,
                    tags: '#toan,#phan_so,#difficulty_1',
                },
            ],
        });

        const response = await handleClassroomRoutes(
            await createTeacherRequest('https://example.com/api/assignments/smart-preview', {
                method: 'POST',
                body: JSON.stringify({
                    resultId: '551',
                    teacherUsername: 'teacher_001',
                    strategy: 'top_weak_skill',
                }),
            }),
            createEnv(db),
            '/api/assignments/smart-preview',
            'POST',
        );

        const json = await response.json() as any;

        expect(json.status).toBe('success');
        expect(json.data.recommendedQuizzes[0].quizId).toBe('quiz-explicit-easy');
        expect(json.data.recommendedQuizzes[0].matchBreakdown.avgDifficulty).toBe(1);
        expect(json.data.recommendedQuizzes[1].matchBreakdown.avgDifficulty).toBe(3);
        expect(json.data.recommendedQuizzes[0].matchBreakdown.totalScore).toBeGreaterThan(
            json.data.recommendedQuizzes[1].matchBreakdown.totalScore,
        );
    });

    it('returns STUDENT_NOT_FOUND when result context cannot resolve a student', async () => {
        const db = createFakeDb({
            results: [createResult({ id: 401, answers: JSON.stringify({ q1: createAnswerEntry('B', false) }) })],
            questions: [createQuestion({ id: 'q1', subject: 'math', skill_code: 'phan_so' })],
            students: [],
            quizRows: [],
        });

        const response = await handleClassroomRoutes(
            await createTeacherRequest('https://example.com/api/assignments/smart-preview', {
                method: 'POST',
                body: JSON.stringify({
                    resultId: '401',
                    teacherUsername: 'teacher_001',
                    strategy: 'top_weak_skill',
                }),
            }),
            createEnv(db),
            '/api/assignments/smart-preview',
            'POST',
        );

        const json = await response.json() as any;

        expect(response.status).toBe(200);
        expect(json.status).toBe('error');
        expect(json.code).toBe('STUDENT_NOT_FOUND');
    });

    it('returns AMBIGUOUS_STUDENT_MATCH when multiple students match the same result context', async () => {
        const db = createFakeDb({
            results: [createResult({ id: 402, answers: JSON.stringify({ q1: createAnswerEntry('B', false) }) })],
            questions: [createQuestion({ id: 'q1', subject: 'math', skill_code: 'phan_so' })],
            students: [
                { id: 's-001', full_name: 'Lan', class_id: 'c-001', class_name: '2A', teacher_username: 'teacher_001' },
                { id: 's-002', full_name: 'Lan', class_id: 'c-001', class_name: '2A', teacher_username: 'teacher_001' },
            ],
            quizRows: [],
        });

        const response = await handleClassroomRoutes(
            await createTeacherRequest('https://example.com/api/assignments/smart-preview', {
                method: 'POST',
                body: JSON.stringify({
                    resultId: '402',
                    teacherUsername: 'teacher_001',
                    strategy: 'top_weak_skill',
                }),
            }),
            createEnv(db),
            '/api/assignments/smart-preview',
            'POST',
        );

        const json = await response.json() as any;

        expect(response.status).toBe(200);
        expect(json.status).toBe('error');
        expect(json.code).toBe('AMBIGUOUS_STUDENT_MATCH');
        expect(json.data.candidates).toHaveLength(2);
    });

    it('returns NO_RECOMMENDED_QUIZ when no quiz matches the top weak skill', async () => {
        const db = createFakeDb({
            results: [createResult({
                id: 403,
                answers: JSON.stringify({
                    q1: createAnswerEntry('B', false),
                    q2: createAnswerEntry('B', false),
                }),
            })],
            questions: [
                createQuestion({ id: 'q1', subject: 'math', skill_code: 'phan_so' }),
                createQuestion({ id: 'q2', subject: 'math', skill_code: 'phan_so' }),
            ],
            students: [
                { id: 's-001', full_name: 'Lan', class_id: 'c-001', class_name: '2A', teacher_username: 'teacher_001' },
            ],
            quizRows: [
                { quiz_id: 'quiz-khac', title: 'On luyen doc hieu', time_limit: 15, subject: 'vietnamese', skill_code: 'doc_hieu', tags: '#tieng_viet,#doc_hieu' },
            ],
        });

        const response = await handleClassroomRoutes(
            await createTeacherRequest('https://example.com/api/assignments/smart-preview', {
                method: 'POST',
                body: JSON.stringify({
                    resultId: '403',
                    teacherUsername: 'teacher_001',
                    strategy: 'top_weak_skill',
                }),
            }),
            createEnv(db),
            '/api/assignments/smart-preview',
            'POST',
        );

        const json = await response.json() as any;

        expect(response.status).toBe(200);
        expect(json.status).toBe('error');
        expect(json.code).toBe('NO_RECOMMENDED_QUIZ');
    });
});
