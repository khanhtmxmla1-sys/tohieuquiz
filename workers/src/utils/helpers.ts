// Shared helpers for Workers API routes
// Shared Worker route helpers

import { jsonResponse } from './response';
import { Question, Assignment, PetData, ShopItem, ResultRow } from '../types';
import { CURRENT_MATH_FORMAT_VERSION, prepareIncomingQuestion } from '../services/questionMath';
import { QuizGradingServiceError, gradeQuizSubmission } from '../services/quizGradingService';
import { prepareQuestionScoringContractForSave } from '../services/questionScoringContract';

// ============ Map question data for D1 insert ============
export function mapQuestionForSave(q: Partial<Question> & { type: string }, quizId: string): string[] {
    const mathNormalizedQuestion = prepareIncomingQuestion(q) as Partial<Question> & { type: string };
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

    const result = [
        normalizedQuestion.id || '', quizId, normalizedQuestion.type, questionText || '', options, correctAnswer,
        items, textField, blanksField, distractorsField, sentenceField,
        wordsField, correctWordIndexesField, imageField, tagsField,
        subjectField, skillCodeField, subskillCodeField, difficultyField,
        CURRENT_MATH_FORMAT_VERSION, pointsField, explanationField, imageAltField,
        scoringContract.answerSchemaVersion,
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
    options: { includeCorrectAnswers?: boolean } = {},
): Promise<Response> {
    try {
        const grading = await gradeQuizSubmission(db, body?.quizId, body?.answers || {});
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
            total: grading.totalQuestions,
            totalQuestions: grading.totalQuestions,
            gradingVersion: grading.gradingVersion,
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
