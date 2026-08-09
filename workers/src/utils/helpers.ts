// Shared helpers for Workers API routes
// Shared Worker route helpers

import { jsonResponse } from './response';
import { Question, Assignment, PetData, ShopItem, ResultRow } from '../types';
import {
    CURRENT_MATH_FORMAT_VERSION,
    normalizeIncomingQuestion,
    prepareIncomingQuestion,
} from '../services/questionMath';
import { QuizGradingServiceError, gradeQuizSubmission } from '../services/quizGradingService';
import { prepareQuestionScoringContractForSave } from '../services/questionScoringContract';
import {
    recordScoringShadowObservation,
    resolveQuizScoringRolloutMode,
} from '../services/quizScoringRolloutService';
import type { FeatureFlagSubject } from '../../../shared/feature-rollout.contract';
import { sanitizeSvgDiagram } from '../services/svgDiagramSanitizer';
import {
    deriveQuestionPlainText,
    normalizeQuestionPlainText,
    parseQuestionRichText,
    type QuestionRichTextEnvelopeV1,
} from '../../../shared/question-rich-text.contract';

export class QuestionRichTextValidationError extends Error {
    readonly code = 'INVALID_QUESTION_RICH_TEXT';

    constructor(readonly issue: string) {
        super('Question rich text is invalid.');
        this.name = 'QuestionRichTextValidationError';
    }
}

interface PreparedQuestionRichText {
    value: QuestionRichTextEnvelopeV1;
    serialized: string;
}

const getSubmittedPlainPrompt = (input: Record<string, unknown>): string | undefined => {
    const keys = String(input.type || '').toUpperCase() === 'TRUE_FALSE'
        ? ['mainQuestion', 'question']
        : ['question', 'mainQuestion'];
    for (const key of keys) {
        if (input[key] !== undefined && input[key] !== null) return String(input[key]);
    }
    return undefined;
};

const normalizePlainEchoForComparison = (value: string): string => {
    const { normalized } = normalizeIncomingQuestion({
        question: normalizeQuestionPlainText(value),
    });
    return normalizeQuestionPlainText(String(normalized.question ?? ''));
};

const prepareQuestionRichTextForSave = (input: unknown): PreparedQuestionRichText | undefined => {
    if (input === undefined || input === null || input === '') return undefined;
    let candidate = input;
    if (typeof input === 'string') {
        try {
            candidate = JSON.parse(input);
        } catch {
            throw new QuestionRichTextValidationError('Dữ liệu rich text không phải JSON hợp lệ.');
        }
    }
    const parsed = parseQuestionRichText(candidate);
    if (!parsed.ok) throw new QuestionRichTextValidationError(parsed.error);
    return { value: parsed.value, serialized: JSON.stringify(parsed.value) };
};

// ============ Map question data for D1 insert ============
export function mapQuestionForSave(q: Partial<Question> & { type: string }, quizId: string): string[] {
    const rawQuestion = q as Partial<Question> & {
        type: string;
        mainQuestion?: unknown;
        questionRichText?: unknown;
        question_rich_text?: unknown;
    };
    const preparedRichText = prepareQuestionRichTextForSave(
        rawQuestion.questionRichText ?? rawQuestion.question_rich_text,
    );
    const submittedPlainPrompt = getSubmittedPlainPrompt(rawQuestion as unknown as Record<string, unknown>);
    const semanticQuestion = { ...rawQuestion } as Record<string, unknown> & { type: string };
    delete semanticQuestion.questionRichText;
    delete semanticQuestion.question_rich_text;
    if (preparedRichText) {
        const derivedPrompt = deriveQuestionPlainText(preparedRichText.value);
        semanticQuestion.question = derivedPrompt;
        if (String(semanticQuestion.type || '').toUpperCase() === 'TRUE_FALSE') {
            semanticQuestion.mainQuestion = derivedPrompt;
        }
    }
    const questionRichTextField = preparedRichText?.serialized ?? '';
    const mathNormalizedQuestion = prepareIncomingQuestion(semanticQuestion) as Partial<Question> & { type: string };
    const scoringContract = prepareQuestionScoringContractForSave(mathNormalizedQuestion);
    const normalizedQuestion = scoringContract.question as Partial<Question> & { type: string };
    let options = '';
    let items = '';
    let textField = '';
    let blanksField = '';
    let distractorsField = '';
    let sentenceField = '';
    let wordsField = '';
    let correctWordIndexesField = '';
    const imageField = normalizedQuestion.image || '';

    // Legacy object mapping to strings after server-owned normalization/validation.
    const anyQ = normalizedQuestion as any;
    if (preparedRichText && submittedPlainPrompt !== undefined) {
        const normalizedPersistedPrompt = normalizeQuestionPlainText(String(
            normalizedQuestion.type === 'TRUE_FALSE'
                ? (anyQ.mainQuestion || normalizedQuestion.question || anyQ.question || '')
                : (normalizedQuestion.question || anyQ.question || ''),
        ));
        if (normalizePlainEchoForComparison(submittedPlainPrompt) !== normalizedPersistedPrompt) {
            console.info(JSON.stringify({
                event: 'question_rich_text_plain_mismatch',
                questionType: normalizedQuestion.type,
            }));
        }
    }

    if (normalizedQuestion.type === 'MCQ') {
        options = (anyQ.options || []).join('|');
    } else if (normalizedQuestion.type === 'IMAGE_QUESTION') {
        options = (anyQ.options || []).join('|');
        distractorsField = JSON.stringify(anyQ.optionImages || []);
    } else if (normalizedQuestion.type === 'TRUE_FALSE') {
        items = JSON.stringify(anyQ.items || []);
    } else if (normalizedQuestion.type === 'MATCHING') {
        items = JSON.stringify(anyQ.pairs || []);
    } else if (normalizedQuestion.type === 'MULTIPLE_SELECT') {
        options = (anyQ.options || []).join('|');
    } else if (normalizedQuestion.type === 'DRAG_DROP' || normalizedQuestion.type === 'DROPDOWN') {
        textField = anyQ.text || '';
        blanksField = JSON.stringify(anyQ.blanks || []);
        distractorsField = JSON.stringify(anyQ.distractors || []);
    } else if (normalizedQuestion.type === 'CATEGORIZATION') {
        items = JSON.stringify(anyQ.items || []);
        distractorsField = JSON.stringify(anyQ.categories || []);
    } else if (normalizedQuestion.type === 'ORDERING') {
        items = JSON.stringify(anyQ.items || []);
        anyQ.correctAnswer = JSON.stringify(anyQ.correctOrder || []);
    } else if (normalizedQuestion.type === 'UNDERLINE') {
        items = JSON.stringify(anyQ.words || []);
        anyQ.correctAnswer = JSON.stringify(anyQ.correctWordIndexes || []);
        sentenceField = anyQ.sentence || anyQ.hint || '';
        wordsField = JSON.stringify(anyQ.words || []);
        correctWordIndexesField = JSON.stringify(anyQ.correctWordIndexes || []);
    } else if (normalizedQuestion.type === 'RIDDLE') {
        items = JSON.stringify(anyQ.items || anyQ.riddleLines || []);
        textField = anyQ.text || anyQ.answerLabel || '';
        sentenceField = anyQ.sentence || anyQ.hint || '';
    } else if (normalizedQuestion.type === 'WORD_SCRAMBLE') {
        items = JSON.stringify(anyQ.letters || []);
        textField = anyQ.text || anyQ.hint || '';
        anyQ.correctAnswer = anyQ.correctWord || anyQ.correctAnswer || '';
    } else if (normalizedQuestion.type === 'ERROR_CORRECTION') {
        textField = anyQ.text || anyQ.passage || '';
        distractorsField = anyQ.wrongWord || anyQ.distractors || '';
        anyQ.correctAnswer = anyQ.correctWord || anyQ.correctAnswer || '';
    }

    const correctAnswer = normalizedQuestion.type === 'MULTIPLE_SELECT'
        ? JSON.stringify(anyQ.correctAnswers || anyQ.correctAnswer || [])
        : (anyQ.correctAnswer || normalizedQuestion.correct_answer || '');

    const questionText = normalizedQuestion.type === 'TRUE_FALSE'
        ? (anyQ.mainQuestion || normalizedQuestion.question || anyQ.question)
        : (normalizedQuestion.question || anyQ.question);

    let tagsField = '';
    if (Array.isArray(normalizedQuestion.tags)) {
        tagsField = normalizedQuestion.tags.join(',');
    } else if (typeof normalizedQuestion.tags === 'string') {
        tagsField = normalizedQuestion.tags;
    }

    const subjectField = String((anyQ.subject ?? anyQ.subject_code ?? '') || '');
    const skillCodeField = String((anyQ.skillCode ?? anyQ.skill_code ?? '') || '');
    const subskillCodeField = String((anyQ.subskillCode ?? anyQ.subskill_code ?? '') || '');
    const rawDifficulty = Number(anyQ.difficulty ?? anyQ.difficulty_level ?? anyQ.difficultyLevel);
    const difficultyField = rawDifficulty === 1 || rawDifficulty === 2 || rawDifficulty === 3
        ? rawDifficulty
        : '';
    const rawPoints = Number(anyQ.points);
    const pointsField = Number.isFinite(rawPoints) && rawPoints >= 0 ? rawPoints : '';
    const explanationField = typeof anyQ.explanation === 'string' ? anyQ.explanation : '';
    const imageAltField = typeof anyQ.imageAlt === 'string'
        ? anyQ.imageAlt
        : (typeof anyQ.image_alt === 'string' ? anyQ.image_alt : '');
    const rawSvgContent = typeof anyQ.svgContent === 'string'
        ? anyQ.svgContent
        : (typeof anyQ.svg_content === 'string' ? anyQ.svg_content : '');
    const rawSvgAlt = typeof anyQ.svgAlt === 'string'
        ? anyQ.svgAlt
        : (typeof anyQ.svg_alt === 'string' ? anyQ.svg_alt : '');
    const rawSvgVersion = anyQ.svgVersion ?? anyQ.svg_version;
    let svgContentField = '';
    let svgAltField = '';
    if (rawSvgContent.trim()) {
        const startedAt = Date.now();
        const sanitized = sanitizeSvgDiagram(rawSvgContent);
        const validMetadata = rawSvgAlt.trim().length > 0
            && (rawSvgVersion === 1 || rawSvgVersion === '1');
        if (sanitized.ok && sanitized.sanitizedSvg && validMetadata) {
            svgContentField = sanitized.sanitizedSvg;
            svgAltField = rawSvgAlt.trim();
            console.info(JSON.stringify({
                event: 'question_svg_accepted',
                questionType: normalizedQuestion.type,
                sizeBytes: sanitized.sizeBytes,
                nodeCount: sanitized.nodeCount,
                durationMs: Date.now() - startedAt,
            }));
        } else {
            console.info(JSON.stringify({
                event: 'question_svg_rejected',
                questionType: normalizedQuestion.type,
                issueCodes: validMetadata
                    ? sanitized.issues.map((issue) => issue.code)
                    : ['INVALID_SVG_METADATA'],
                sizeBytes: sanitized.sizeBytes,
                durationMs: Date.now() - startedAt,
            }));
        }
    }

    const result = [
        normalizedQuestion.id || '', quizId, normalizedQuestion.type, questionText || '', questionRichTextField, options, correctAnswer,
        items, textField, blanksField, distractorsField, sentenceField,
        wordsField, correctWordIndexesField, imageField, tagsField,
        subjectField, skillCodeField, subskillCodeField, difficultyField,
        CURRENT_MATH_FORMAT_VERSION, pointsField, explanationField, imageAltField,
        svgContentField, svgAltField, scoringContract.answerSchemaVersion,
    ];

    return result.map(v => (v === undefined || v === null) ? '' : String(v));
}

// ============ Map assignment from DB row ============
export function mapAssignment(a: Assignment): any {
    return {
        id: a.id, quizId: a.quiz_id, classId: a.class_id,
        studentId: a.student_id || '', deadline: a.deadline,
        maxAttempts: Number(a.max_attempts) || 1, status: a.status,
        createdAt: a.created_at,
        revokedAt: a.revoked_at || null,
        revokedBy: a.revoked_by || null,
        revokedReason: a.revoked_reason || null,
        previousStatus: a.previous_status || null,
        submissionCountAtRevoke: Number(a.submission_count_at_revoke) || 0,
    };
}

export function mapAssignments(rows: Assignment[]): any[] {
    return rows.map(mapAssignment);
}

// ============ SHA-256 hash helper ============
export async function hashSHA256(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============ Map pet data from DB row ============
export function mapPetData(pet: PetData): any {
    return {
        petId: pet.pet_id,
        petName: pet.pet_name,
        level: Number(pet.level) || 1,
        exp: Number(pet.exp) || 0,
        expToNext: Number(pet.exp_to_next) || 100,
        mood: pet.mood || 'happy',
        items: typeof pet.items === 'string' ? JSON.parse(pet.items) : [],
        lastActive: pet.last_active || '',
        imageUrl: pet.image_url || '',
    };
}

// ============ Map shop item from DB row ============
export function mapShopItem(i: ShopItem): any {
    return {
        itemId: i.item_id,
        name: i.name,
        price: Number(i.price) || 0,
        type: i.type || 'ACCESSORY',
        category: i.category || '',
        assetUrl: i.asset_url || '',
    };
}


// ============ VALIDATE ANSWERS (Server-side anti-cheat) ============
export async function handleValidateAnswers(
    db: D1Database,
    body: any,
    options: { includeCorrectAnswers?: boolean; subject?: FeatureFlagSubject } = {},
): Promise<Response> {
    try {
        const scoringMode = await resolveQuizScoringRolloutMode(
            db,
            options.subject || { role: 'public', username: null, classIds: [] },
        );
        const grading = await gradeQuizSubmission(db, body?.quizId, body?.answers || {});
        recordScoringShadowObservation(scoringMode, {
            quizId: String(body?.quizId || ''),
            canonicalScore: grading.score,
            canonicalCorrectCount: grading.correctCount,
            canonicalTotalQuestions: grading.totalQuestions,
            submittedScore: body?.score,
            submittedCorrectCount: body?.correctCount,
            submittedTotalQuestions: body?.totalQuestions,
        });
        const questionMap = new Map(grading.questions.map((question) => [String(question.id || ''), question]));
        const details = grading.details.map((detail) => {
            const responseDetail: Record<string, unknown> = {
                questionId: detail.questionId,
                isCorrect: detail.isCorrect,
                status: detail.status,
            };
            if (detail.issueCode) responseDetail.issueCode = detail.issueCode;
            if (options.includeCorrectAnswers) {
                const question = questionMap.get(detail.questionId) || {};
                responseDetail.correctAnswer = question.correctAnswer
                    ?? question.correctAnswers
                    ?? question.correctOrder
                    ?? question.correctWordIndexes
                    ?? question.correctWord
                    ?? null;
            }
            return responseDetail;
        });
        return jsonResponse({
            status: 'success',
            success: true,
            score: grading.score,
            correctCount: grading.correctCount,
            questionCount: grading.questionCount,
            total: grading.totalQuestions,
            totalQuestions: grading.totalQuestions,
            voidedCount: grading.voidedCount,
            gradingVersion: grading.gradingVersion,
            scoringMode,
            details,
        });
    } catch (error) {
        if (error instanceof QuizGradingServiceError) {
            return jsonResponse({
                status: 'error',
                success: false,
                code: error.code,
                message: error.message,
                details: error.details,
            }, error.status);
        }
        throw error;
    }
}
// ============ Parse request body ============
export async function parseBody(request: Request): Promise<any> {
    try {
        const text = await request.text();
        return JSON.parse(text);
    } catch {
        return null;
    }
}

// ============ Extract ID from path ============
// e.g. /api/quizzes/quiz-123 -> "quiz-123"
export function extractIdFromPath(path: string, prefix: string): string {
    const remaining = path.replace(prefix, '');
    // Remove leading slash and any trailing segments
    const parts = remaining.replace(/^\//, '').split('/');
    return parts[0] || '';
}
