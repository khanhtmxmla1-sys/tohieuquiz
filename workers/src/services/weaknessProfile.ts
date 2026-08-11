import type { Question, ResultRow } from '../types';
import { gradeQuestion } from '../../../src/domain/quiz-scoring';
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

function resolveAnswerCorrectness(questionSources: Array<any>, answerData: any): boolean | null {
    const selectedAnswer = getSelectedAnswer(answerData);
    if (isSkippedAnswer(selectedAnswer)) return null;

    for (const source of questionSources) {
        if (!source || typeof source !== 'object') continue;
        const grading = gradeQuestion({
            ...source,
            id: String(source.id || '__weakness-profile-question__'),
        }, selectedAnswer);
        if (grading.status === 'correct' || grading.status === 'wrong') {
            return grading.isCorrect;
        }
    }

    return getPersistedCorrectness(answerData);
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
        'SELECT id, student_id, class_id, assignment_id, student_name, class_name, quiz_id, quiz_title, score, correct_count, total_questions, time_taken, submitted_at, answers, grading_version FROM results WHERE id = ?',
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
    if (!result.student_id || !result.class_id) return [];
    const rows = await db.prepare(
        `SELECT id, student_id, class_id, assignment_id, student_name, class_name, quiz_id, quiz_title, score, correct_count, total_questions, time_taken, submitted_at, answers, grading_version
         FROM results
         WHERE student_id = ? AND class_id = ?
         ORDER BY submitted_at DESC
         LIMIT 5`,
    ).bind(result.student_id, result.class_id).all<ResultRowWithAnswers>();

    return rows.results || [];
}
