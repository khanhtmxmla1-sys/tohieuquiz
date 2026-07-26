import type { Question, ResultRow } from '../types';
import {
    classifySkillStatus,
    getSubjectLabel,
    resolveExplicitSkillMetadata,
    resolveSkillMetadataFromTags,
    type QuestionSkillMetadataFields,
    type ResolvedSkillMetadata,
    type ResultSkillBreakdownResponse,
    type SkillBreakdownItem,
    type SkillBreakdownSubjectGroup,
    type SupportedSkillSubject,
    type WeaknessProfileResponse,
} from '../../../src/shared/skillTaxonomy';

type AnswerRecord = Record<string, any>;

export interface ResultRowWithAnswers extends ResultRow {
    answers: string;
}

interface NormalizedQuestionRecord extends QuestionSkillMetadataFields {
    id?: string;
    type?: string;
    question?: string;
    correctAnswer?: any;
    items?: any;
    text?: any;
    blanks?: any;
    distractors?: any;
    sentence?: any;
    words?: any;
    correctWordIndexes?: any;
    tags?: string[] | string;
}

interface AggregateBucket {
    metadata: ResolvedSkillMetadata;
    attempted: number;
    correct: number;
    wrong: number;
}

interface AggregationSummary {
    subjects: SkillBreakdownSubjectGroup[];
    unclassifiedQuestionCount: number;
    coveragePercent: number;
}

function parseJsonSafely<T>(value: any, fallback: T): T {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') return value as T;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function isSkippedAnswer(value: any): boolean {
    return value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0);
}

function normalizeQuestionRecord(source: any): NormalizedQuestionRecord {
    if (!source || typeof source !== 'object') return {};

    return {
        id: source.id,
        type: source.type,
        question: source.question || source.mainQuestion || '',
        correctAnswer: source.correct_answer ?? source.correctAnswer,
        items: source.items ?? source.pairs ?? source.riddleLines,
        text: source.text_field ?? source.text ?? source.passage ?? source.answerLabel,
        blanks: source.blanks,
        distractors: source.distractors ?? source.categories ?? source.optionImages ?? source.wrongWord,
        sentence: source.sentence ?? source.hint,
        words: source.words ?? source.letters,
        correctWordIndexes: source.correct_word_indexes ?? source.correctWordIndexes,
        tags: source.tags,
        subject: source.subject,
        skillCode: source.skillCode ?? source.skill_code,
        subskillCode: source.subskillCode ?? source.subskill_code,
    };
}

function getSelectedAnswer(answerData: any): any {
    if (answerData && typeof answerData === 'object' && ('selectedAnswer' in answerData || 'questionSnapshot' in answerData)) {
        return answerData.selectedAnswer;
    }
    return answerData;
}

function getPersistedCorrectness(answerData: any): boolean | null {
    if (answerData && typeof answerData === 'object' && typeof answerData.isCorrect === 'boolean') {
        return answerData.isCorrect;
    }
    return null;
}

function normalizeChoiceList(values: any[]): string[] {
    return Array.from(
        new Set(
            values
                .map((value) => String(value ?? '').trim().toUpperCase())
                .filter(Boolean),
        ),
    ).sort();
}

function evaluateAnswer(question: NormalizedQuestionRecord, studentAnswer: any): boolean | null {
    const questionType = question.type;
    if (!questionType) return null;

    if (questionType === 'MCQ' || questionType === 'IMAGE_QUESTION' || questionType === 'SHORT_ANSWER') {
        if (questionType === 'SHORT_ANSWER') {
            const normalizedStudent = String(studentAnswer ?? '').trim().replace(/^'/, '').toLowerCase();
            const normalizedCorrect = String(question.correctAnswer ?? '').trim().replace(/^'/, '').toLowerCase();
            const correctOptions = normalizedCorrect.split('|').map((item) => item.trim()).filter(Boolean);
            return correctOptions.includes(normalizedStudent);
        }

        let normalizedCorrect = String(question.correctAnswer ?? '').trim().toUpperCase();
        const normalizedStudent = String(studentAnswer ?? '').trim().toUpperCase();
        const letterMatch = normalizedCorrect.match(/^([A-Z])[.)]\s*/);
        if (letterMatch) normalizedCorrect = letterMatch[1];
        return normalizedStudent === normalizedCorrect;
    }

    if (questionType === 'MULTIPLE_SELECT') {
        const normalizedCorrectAnswer = String(question.correctAnswer ?? '').trim();
        let correctRaw: any[] = [];

        if (normalizedCorrectAnswer.startsWith('[') && normalizedCorrectAnswer.endsWith(']')) {
            correctRaw = parseJsonSafely<any[]>(normalizedCorrectAnswer, []);
        } else {
            correctRaw = normalizedCorrectAnswer.split('|');
        }

        const correct = normalizeChoiceList(correctRaw);
        const student = normalizeChoiceList(Array.isArray(studentAnswer) ? studentAnswer : []);
        return correct.length > 0 &&
            student.length > 0 &&
            correct.length === student.length &&
            correct.every((choice, index) => choice === student[index]);
    }

    if (questionType === 'TRUE_FALSE') {
        const items = Array.isArray(question.items) ? question.items : parseJsonSafely<any[]>(question.items, []);
        const studentItems = studentAnswer || {};
        return items.length > 0 && items.every((item: any, index: number) => {
            const actual = item.isCorrect ?? item.isTrue ?? false;
            return studentItems[index] === actual;
        });
    }

    if (questionType === 'MATCHING') {
        const pairs = Array.isArray(question.items) ? question.items : parseJsonSafely<any[]>(question.items, []);
        const studentPairs = studentAnswer || {};
        return pairs.length > 0 && pairs.every((pair: any) => studentPairs[pair.left] === pair.right);
    }

    if (questionType === 'DRAG_DROP') {
        const blanks = Array.isArray(question.blanks) ? question.blanks : parseJsonSafely<any[]>(question.blanks, []);
        const studentBlanks = studentAnswer || {};
        return blanks.length > 0 && blanks.every((blank: any, index: number) => studentBlanks[index] === blank);
    }

    if (questionType === 'DROPDOWN') {
        const blanks = Array.isArray(question.blanks) ? question.blanks : parseJsonSafely<any[]>(question.blanks, []);
        const studentDropdowns = studentAnswer || {};
        return blanks.length > 0 && blanks.every((blank: any, index: number) => {
            const expected = blank.correctAnswer ?? blank.answer;
            return studentDropdowns[index] === expected;
        });
    }

    if (questionType === 'ORDERING') {
        const expectedOrder = Array.isArray(question.correctAnswer)
            ? question.correctAnswer
            : parseJsonSafely<any[]>(question.correctAnswer, []);
        const actualOrder = Array.isArray(studentAnswer) ? studentAnswer : [];
        return expectedOrder.length > 0 &&
            expectedOrder.length === actualOrder.length &&
            expectedOrder.every((value, index) => Number(value) === Number(actualOrder[index]));
    }

    if (questionType === 'UNDERLINE') {
        const expectedIndexes = Array.isArray(question.correctWordIndexes)
            ? question.correctWordIndexes
            : parseJsonSafely<any[]>(question.correctWordIndexes || question.correctAnswer, []);
        const actualIndexes = Array.isArray(studentAnswer) ? studentAnswer : [];
        return expectedIndexes.length > 0 &&
            expectedIndexes.length === actualIndexes.length &&
            expectedIndexes.every((value, index) => Number(value) === Number(actualIndexes[index]));
    }

    if (questionType === 'CATEGORIZATION') {
        const items = Array.isArray(question.items) ? question.items : parseJsonSafely<any[]>(question.items, []);
        const studentCategories = studentAnswer || {};
        return items.length > 0 && items.every((item: any) => studentCategories[item.id] === item.categoryId);
    }

    if (questionType === 'WORD_SCRAMBLE') {
        return String(studentAnswer ?? '').trim().toLowerCase() === String(question.correctAnswer ?? '').trim().toLowerCase();
    }

    if (questionType === 'ERROR_CORRECTION' || questionType === 'RIDDLE') {
        return String(studentAnswer ?? '').trim().toLowerCase() === String(question.correctAnswer ?? '').trim().toLowerCase();
    }

    return null;
}

function resolveAnswerCorrectness(questionSources: Array<any>, answerData: any): boolean | null {
    const persistedCorrectness = getPersistedCorrectness(answerData);
    if (persistedCorrectness !== null) return persistedCorrectness;

    const selectedAnswer = getSelectedAnswer(answerData);
    if (isSkippedAnswer(selectedAnswer)) return null;

    for (const source of questionSources) {
        const normalizedQuestion = normalizeQuestionRecord(source);
        const evaluation = evaluateAnswer(normalizedQuestion, selectedAnswer);
        if (typeof evaluation === 'boolean') return evaluation;
    }

    return null;
}

function resolveQuestionSkillMetadataFromSources(
    dbQuestion: any,
    answerData: any,
): ResolvedSkillMetadata | null {
    const snapshot = answerData && typeof answerData === 'object' ? answerData.questionSnapshot : null;
    const normalizedDbQuestion = normalizeQuestionRecord(dbQuestion);
    const normalizedSnapshot = normalizeQuestionRecord(snapshot);

    return resolveExplicitSkillMetadata(normalizedDbQuestion, 'explicit_db') ||
        resolveExplicitSkillMetadata(normalizedSnapshot, 'explicit_question') ||
        resolveSkillMetadataFromTags(normalizedDbQuestion.tags) ||
        resolveSkillMetadataFromTags(normalizedSnapshot.tags);
}

function buildSubjectGroups(buckets: Map<string, AggregateBucket>): SkillBreakdownSubjectGroup[] {
    const grouped = new Map<SupportedSkillSubject, SkillBreakdownItem[]>();

    for (const bucket of buckets.values()) {
        const accuracy = bucket.attempted === 0 ? 0 : Math.round((bucket.correct / bucket.attempted) * 100);
        const item: SkillBreakdownItem = {
            subject: bucket.metadata.subject,
            subjectLabel: bucket.metadata.subjectLabel,
            skillCode: bucket.metadata.skillCode,
            skillLabel: bucket.metadata.skillLabel,
            attempted: bucket.attempted,
            correct: bucket.correct,
            wrong: bucket.wrong,
            accuracy,
            status: classifySkillStatus(bucket.attempted, bucket.correct, bucket.wrong),
        };

        const subjectItems = grouped.get(bucket.metadata.subject) || [];
        subjectItems.push(item);
        grouped.set(bucket.metadata.subject, subjectItems);
    }

    const statusWeight = { weak: 0, needs_practice: 1, stable: 2 } as const;

    return Array.from(grouped.entries())
        .map(([subject, skills]) => ({
            subject,
            label: getSubjectLabel(subject),
            skills: skills.sort((left, right) => {
                if (statusWeight[left.status] !== statusWeight[right.status]) {
                    return statusWeight[left.status] - statusWeight[right.status];
                }
                if (left.accuracy !== right.accuracy) {
                    return left.accuracy - right.accuracy;
                }
                return left.skillLabel.localeCompare(right.skillLabel);
            }),
        }))
        .sort((left, right) => left.label.localeCompare(right.label));
}

function aggregateResults(
    results: ResultRowWithAnswers[],
    questionsById: Map<string, Question>,
): AggregationSummary {
    const buckets = new Map<string, AggregateBucket>();
    let totalQuestions = 0;
    let classifiedQuestions = 0;
    let unclassifiedQuestionCount = 0;

    for (const result of results) {
        const answers = parseStoredAnswers(result.answers);

        for (const [questionId, answerData] of Object.entries(answers)) {
            if (questionId.startsWith('_')) continue;

            totalQuestions += 1;
            const dbQuestion = questionsById.get(questionId);
            const metadata = resolveQuestionSkillMetadataFromSources(dbQuestion, answerData);

            if (!metadata) {
                unclassifiedQuestionCount += 1;
                continue;
            }

            classifiedQuestions += 1;

            const bucketKey = `${metadata.subject}:${metadata.skillCode}`;
            const existingBucket = buckets.get(bucketKey) || {
                metadata,
                attempted: 0,
                correct: 0,
                wrong: 0,
            };

            const selectedAnswer = getSelectedAnswer(answerData);
            if (!isSkippedAnswer(selectedAnswer)) {
                const isCorrect = resolveAnswerCorrectness([dbQuestion, answerData?.questionSnapshot], answerData);
                if (typeof isCorrect === 'boolean') {
                    existingBucket.attempted += 1;
                    if (isCorrect) existingBucket.correct += 1;
                    else existingBucket.wrong += 1;
                }
            }

            buckets.set(bucketKey, existingBucket);
        }
    }

    return {
        subjects: buildSubjectGroups(buckets),
        unclassifiedQuestionCount,
        coveragePercent: totalQuestions === 0 ? 0 : Math.round((classifiedQuestions / totalQuestions) * 100),
    };
}

export function parseStoredAnswers(rawAnswers: string | null | undefined): AnswerRecord {
    if (!rawAnswers) return {};
    const parsed = parseJsonSafely<any>(rawAnswers, {});

    if (Array.isArray(parsed)) {
        return parsed.reduce<AnswerRecord>((accumulator, item) => {
            if (item && typeof item === 'object' && item.questionId) {
                accumulator[item.questionId] = item;
            }
            return accumulator;
        }, {});
    }

    return parsed && typeof parsed === 'object' ? parsed : {};
}

export function buildResultSkillBreakdownFromData(
    result: ResultRowWithAnswers,
    questions: Question[],
): ResultSkillBreakdownResponse {
    const questionsById = new Map(questions.map((question) => [question.id, question]));
    const summary = aggregateResults([result], questionsById);

    return {
        resultId: String(result.id),
        studentName: result.student_name,
        studentClass: result.class_name,
        quizId: result.quiz_id,
        submittedAt: result.submitted_at,
        subjects: summary.subjects,
        unclassifiedQuestionCount: summary.unclassifiedQuestionCount,
        coveragePercent: summary.coveragePercent,
    };
}

export function buildWeaknessProfileFromData(
    baseResult: ResultRowWithAnswers,
    recentResults: ResultRowWithAnswers[],
    questions: Question[],
): WeaknessProfileResponse {
    const questionsById = new Map(questions.map((question) => [question.id, question]));
    const summary = aggregateResults(recentResults, questionsById);

    return {
        studentName: baseResult.student_name,
        studentClass: baseResult.class_name,
        basedOnResultIds: recentResults.map((result) => String(result.id)),
        updatedAt: new Date().toISOString(),
        subjects: summary.subjects,
        unclassifiedQuestionCount: summary.unclassifiedQuestionCount,
        coveragePercent: summary.coveragePercent,
    };
}

export async function getResultById(db: D1Database, resultId: string): Promise<ResultRowWithAnswers | null> {
    const result = await db.prepare(
        'SELECT id, student_name, class_name, quiz_id, quiz_title, score, correct_count, total_questions, time_taken, submitted_at, answers FROM results WHERE id = ?',
    ).bind(resultId).first<ResultRowWithAnswers>();

    return result || null;
}

export async function getQuestionsForQuizIds(db: D1Database, quizIds: string[]): Promise<Question[]> {
    const filteredQuizIds = Array.from(new Set(quizIds.filter(Boolean)));
    if (filteredQuizIds.length === 0) return [];

    const placeholders = filteredQuizIds.map(() => '?').join(', ');
    const rows = await db.prepare(
        `SELECT * FROM questions WHERE quiz_id IN (${placeholders})`,
    ).bind(...filteredQuizIds).all<Question>();

    return rows.results || [];
}

export async function getRecentResultsForStudentContext(
    db: D1Database,
    result: ResultRowWithAnswers,
): Promise<ResultRowWithAnswers[]> {
    const rows = await db.prepare(
        `SELECT id, student_name, class_name, quiz_id, quiz_title, score, correct_count, total_questions, time_taken, submitted_at, answers
         FROM results
         WHERE student_name = ? AND class_name = ?
         ORDER BY submitted_at DESC
         LIMIT 5`,
    ).bind(result.student_name, result.class_name).all<ResultRowWithAnswers>();

    return rows.results || [];
}
