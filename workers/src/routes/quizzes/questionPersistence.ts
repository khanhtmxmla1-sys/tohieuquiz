import { jsonResponse } from '../../utils/response';
import { mapQuestionForSave, QuestionRichTextValidationError } from '../../utils/helpers';
import {
    auditPersistedQuestionRow,
    CURRENT_MATH_FORMAT_VERSION,
    normalizePersistedQuestionRow,
    QuestionMathValidationError,
    type PersistedQuestionRow,
} from '../../services/questionMath';
import { QuestionScoringContractValidationError } from '../../services/questionScoringContract';
import { sanitizeSvgDiagram } from '../../services/svgDiagramSanitizer';
import { deserializeQuestionRichText, serializeQuestionRichText } from '../../../../shared/question-rich-text.contract';

export const buildQuestionInsertStatement = (db: D1Database) => db.prepare(
    `INSERT INTO questions (
        id, quiz_id, type, question, question_rich_text, options, correct_answer, items, text_field,
        blanks, distractors, sentence, words, correct_word_indexes, image, tags,
        subject, skill_code, subskill_code, difficulty, math_format_version, points, explanation, image_alt,
        svg_content, svg_alt, answer_schema_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

export const mapQuestionBatch = (questions: unknown[], quizId: string): string[][] =>
    questions.map((question) => mapQuestionForSave(
        question as Partial<import('../../types').Question> & { type: string },
        quizId,
    ));

export const mathValidationResponse = (error: QuestionMathValidationError): Response => jsonResponse({
    status: 'error',
    code: 'INVALID_MATH_NOTATION',
    message: 'Một hoặc nhiều trường công thức toán học chưa hợp lệ.',
    issues: error.issues.map((issue) => ({
        field: issue.field,
        code: issue.code,
        message: issue.message,
        index: issue.index,
    })),
}, 400);

export const richTextValidationResponse = (error: QuestionRichTextValidationError): Response => jsonResponse({
    status: 'error',
    code: error.code,
    message: 'Định dạng nội dung câu hỏi chưa hợp lệ.',
    issue: error.issue,
}, 400);

export const scoringContractValidationResponse = (
    error: QuestionScoringContractValidationError,
): Response => jsonResponse({
    status: 'error',
    code: 'INVALID_QUESTION_SCORING_CONTRACT',
    message: 'Một hoặc nhiều câu hỏi chưa có hợp đồng đáp án hợp lệ để chấm tự động.',
    issues: error.issues,
}, 400);

export const serializeStoredQuestionRichText = (
    question: { type?: unknown; question_rich_text?: unknown; questionRichText?: unknown },
): string => {
    const rawRichText = question.question_rich_text ?? question.questionRichText;
    const parsed = deserializeQuestionRichText(rawRichText);
    if (rawRichText && !parsed) {
        console.info(JSON.stringify({
            event: 'question_rich_text_copy_fallback',
            questionType: String(question.type ?? ''),
        }));
    }
    return serializeQuestionRichText(parsed);
};

export const copiedQuestionValues = (
    question: import('../../types').Question,
    newQuestionId: string,
    newQuizId: string,
): string[] => {
    const persisted = question as unknown as PersistedQuestionRow;
    const audit = auditPersistedQuestionRow(persisted);
    if (audit.remainingIssues.length > 0) {
        throw new QuestionMathValidationError(audit.remainingIssues);
    }
    const normalized = normalizePersistedQuestionRow(persisted);
    const rawSvgContent = String(question.svgContent ?? question.svg_content ?? '');
    const rawSvgAlt = String(question.svgAlt ?? question.svg_alt ?? '').trim();
    const sanitizedSvg = rawSvgContent.trim() ? sanitizeSvgDiagram(rawSvgContent) : null;
    const svgContent = sanitizedSvg?.ok && sanitizedSvg.sanitizedSvg && rawSvgAlt
        ? sanitizedSvg.sanitizedSvg
        : '';
    const svgAlt = svgContent ? rawSvgAlt : '';
    if (rawSvgContent.trim() && !svgContent) {
        console.info(JSON.stringify({
            event: 'question_svg_copy_rejected',
            questionType: question.type,
            issueCodes: rawSvgAlt
                ? (sanitizedSvg?.issues.map((issue) => issue.code) ?? ['INVALID_SVG'])
                : ['INVALID_SVG_METADATA'],
            sizeBytes: sanitizedSvg?.sizeBytes ?? 0,
        }));
    }
    return [
        newQuestionId,
        newQuizId,
        question.type,
        String(normalized.question ?? ''),
        serializeStoredQuestionRichText(question as unknown as {
            type?: unknown;
            question_rich_text?: unknown;
            questionRichText?: unknown;
        }),
        String(normalized.options ?? ''),
        String(normalized.correct_answer ?? ''),
        String(normalized.items ?? ''),
        String(normalized.text_field ?? ''),
        String(normalized.blanks ?? ''),
        String(normalized.distractors ?? ''),
        String(normalized.sentence ?? ''),
        String(normalized.words ?? ''),
        String(normalized.correct_word_indexes ?? ''),
        question.image || '',
        question.tags || '',
        question.subject || '',
        question.skill_code || '',
        question.subskill_code || '',
        String(question.difficulty || ''),
        String(CURRENT_MATH_FORMAT_VERSION),
        question.points === undefined || question.points === null ? '' : String(question.points),
        question.explanation || '',
        String((question as import('../../types').Question & { imageAlt?: string; image_alt?: string }).imageAlt
            ?? (question as import('../../types').Question & { imageAlt?: string; image_alt?: string }).image_alt
            ?? ''),
        svgContent,
        svgAlt,
        String(question.answer_schema_version || 1),
    ];
};
