import { deserializeQuestionRichText } from '../../../../shared/question-rich-text.contract';
const parseJsonArray = (value: unknown): any[] => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const sanitizeQuizForStudent = (
    quiz: Record<string, unknown>,
): Record<string, unknown> => {
    const safeQuiz = { ...quiz };
    delete safeQuiz.access_code;
    delete safeQuiz.accessCode;
    return safeQuiz;
};

export const mapQuestionFromD1 = (question: any): any => {
    const svgContent = String(question?.svgContent ?? question?.svg_content ?? '');
    const svgAlt = String(question?.svgAlt ?? question?.svg_alt ?? '');
    const rawRichText = question?.questionRichText ?? question?.question_rich_text;
    const questionRichText = deserializeQuestionRichText(rawRichText);
    if (rawRichText && !questionRichText) {
        console.info(JSON.stringify({
            event: 'question_rich_text_read_fallback',
            questionType: String(question?.type ?? ''),
        }));
    }
    const mapped = {
        ...question,
        imageAlt: String(question?.imageAlt ?? question?.image_alt ?? '') || undefined,
        svgContent: svgContent || undefined,
        svgAlt: svgContent && svgAlt ? svgAlt : undefined,
        svgVersion: svgContent && svgAlt ? 1 : undefined,
    };
    delete mapped.question_rich_text;
    delete mapped.questionRichText;
    if (questionRichText) mapped.questionRichText = questionRichText;
    delete mapped.image_alt;
    delete mapped.svg_content;
    delete mapped.svg_alt;
    return mapped;
};

export const sanitizeQuestionForStudent = (question: any): any => {
    const safe = mapQuestionFromD1(question);
    for (const field of [
        'correct_answer', 'correctAnswer', 'correct_answers', 'correctAnswers',
        'explanation',
        'correct_order', 'correctOrder', 'correct_word_indexes', 'correctWordIndexes',
        'correct_word', 'correctWord', 'wrong_word', 'wrongWord',
    ]) delete safe[field];

    const type = String(question.type || '').toUpperCase();
    const items = parseJsonArray(question.items);
    if (type === 'MATCHING' && items.some((item) => item && typeof item === 'object' && 'left' in item && 'right' in item)) {
        safe.items = '[]';
        safe.left_items = JSON.stringify(items.map((item, index) => ({
            id: `left-${index}`,
            content: String(item.left),
        })));
        safe.right_items = JSON.stringify(items.map((item, index) => ({
            id: `right-${index}`,
            content: String(item.right),
        })));
    } else if (items.length > 0) {
        safe.items = JSON.stringify(items.map((item) => {
            if (!item || typeof item !== 'object') return item;
            const { isCorrect, isTrue, correct, answer, categoryId, ...rest } = item;
            return rest;
        }));
    }

    const blanks = parseJsonArray(question.blanks);
    if (type === 'DRAG_DROP') {
        const normalizedBlanks = blanks.map((blank, index) => {
            if (blank && typeof blank === 'object') {
                return {
                    id: String(blank.id || `blank-${index}`),
                    correctAnswer: String(blank.correctAnswer ?? blank.answer ?? ''),
                };
            }
            return { id: `blank-${index}`, correctAnswer: String(blank ?? '') };
        });
        const correctChoices = normalizedBlanks.map((blank) => blank.correctAnswer).filter(Boolean);
        const distractors = parseJsonArray(question.distractors).map((item) => String(item ?? '')).filter(Boolean);
        const originalText = String(question.text_field ?? question.text ?? '');
        let placeholderIndex = 0;
        const safeText = originalText.replace(/\[[^\]]*\]/g, () => `[${++placeholderIndex}]`);
        safe.text_field = safeText;
        if ('text' in safe) safe.text = safeText;
        safe.blanks = JSON.stringify(normalizedBlanks.map((blank) => ({ id: blank.id })));
        safe.distractors = JSON.stringify([...correctChoices, ...distractors]);
    } else if (blanks.length > 0 && blanks.some((blank) => blank && typeof blank === 'object')) {
        safe.blanks = JSON.stringify(blanks.map((blank) => {
            if (!blank || typeof blank !== 'object') return blank;
            const { correctAnswer, answer, ...rest } = blank;
            return rest;
        }));
    }
    if (type === 'ERROR_CORRECTION') delete safe.distractors;
    return safe;
};
