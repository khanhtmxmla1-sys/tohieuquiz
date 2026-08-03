import { QuestionType, type Question } from '../../../types';
import { validateQuestionMath } from '../../../utils/questionMath';
import { extractPlaceholderTokens, normalizeQuestionForGrading } from '../../../domain/quiz-scoring';
import {
    createQuizIssue,
    hasUnsafeMediaValue,
    normalizeAuthoringText,
    questionIssue,
    type ManualQuizIssue,
} from './validationActions';

const asArray = <T = unknown>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const normalized = (value: unknown): string => normalizeAuthoringText(value).toLocaleLowerCase('vi');
const labelsFor = (length: number): string[] => Array.from(
    { length },
    (_, index) => String.fromCharCode(65 + index),
);

const SCORING_ISSUE_EQUIVALENTS: Record<string, string[]> = {
    INVALID_CHOICE_CONTRACT: ['MCQ_OPTIONS_TOO_FEW', 'MCQ_OPTION_EMPTY', 'MCQ_CORRECT_ANSWER_MISSING'],
    INVALID_MULTIPLE_SELECT_CONTRACT: ['MCQ_OPTIONS_TOO_FEW', 'MCQ_OPTION_EMPTY', 'MCQ_CORRECT_ANSWER_MISSING'],
    MISSING_CORRECT_ANSWER: ['SHORT_ANSWER_REQUIRED', 'RIDDLE_CONTENT_INVALID'],
    INVALID_TRUE_FALSE_CONTRACT: ['TRUE_FALSE_ITEMS_REQUIRED', 'TRUE_FALSE_ANSWER_REQUIRED'],
    INVALID_MATCHING_CONTRACT: ['MATCHING_PAIRS_TOO_FEW', 'MATCHING_PAIR_EMPTY'],
    INVALID_BLANK_CONTRACT: [
        'BLANK_COUNT_MISMATCH',
        'BLANK_ID_REQUIRED',
        'BLANK_ID_DUPLICATE',
        'DRAG_DROP_CONTENT_INVALID',
        'DROPDOWN_CONTENT_REQUIRED',
        'DROPDOWN_OPTIONS_INVALID',
        'DROPDOWN_ANSWER_INVALID',
    ],
    INVALID_ORDERING_CONTRACT: ['ORDERING_ITEMS_INVALID', 'ORDERING_CORRECT_ORDER_INVALID'],
    INVALID_CATEGORIZATION_CONTRACT: ['CATEGORIZATION_ID_DUPLICATE', 'CATEGORIZATION_CONTENT_INVALID'],
    INVALID_UNDERLINE_CONTRACT: ['UNDERLINE_CONTENT_INVALID'],
    INVALID_WORD_SCRAMBLE_CONTRACT: ['WORD_SCRAMBLE_CONTENT_INVALID'],
    INVALID_ERROR_CORRECTION_CONTRACT: ['ERROR_CORRECTION_CONTENT_INVALID'],
    QUESTION_NOT_AUTO_GRADABLE: ['QUESTION_NOT_AUTO_GRADABLE'],
    UNSUPPORTED_QUESTION_TYPE: ['QUESTION_TYPE_UNSUPPORTED'],
};

const scoringIssueMessage = (code: string): string => {
    if (code === 'INVALID_MULTIPLE_SELECT_CONTRACT') {
        return 'Mỗi đáp án đúng phải thuộc danh sách phương án và không được khai báo trùng.';
    }
    return `Dữ liệu câu hỏi chưa đủ điều kiện để chấm tự động (${code}).`;
};

const appendScoringContractIssues = (
    question: Question,
    issues: ManualQuizIssue[],
): void => {
    const normalizedQuestion = normalizeQuestionForGrading(question);
    if (normalizedQuestion.ok === true) return;

    for (const scoringIssue of normalizedQuestion.issues) {
        const equivalentCodes = SCORING_ISSUE_EQUIVALENTS[scoringIssue.code] ?? [];
        const alreadyCovered = issues.some((issue) => (
            issue.code === scoringIssue.code || equivalentCodes.includes(issue.code)
        ));
        if (alreadyCovered) continue;
        issues.push(questionIssue(
            question.id,
            scoringIssue.code,
            scoringIssueMessage(scoringIssue.code),
            'correctAnswer',
        ));
    }
};

const validateBlankIdentity = (
    questionId: string,
    textValue: unknown,
    blanksValue: unknown,
    requireExplicitIds: boolean,
): ManualQuizIssue[] => {
    const blanks = asArray<any>(blanksValue);
    const placeholderCount = extractPlaceholderTokens(textValue).length;
    const issues: ManualQuizIssue[] = [];
    if (placeholderCount !== blanks.length) {
        issues.push(questionIssue(
            questionId,
            'BLANK_COUNT_MISMATCH',
            'Số ô trống trong nội dung phải bằng số đáp án đã khai báo.',
            'blanks',
        ));
    }
    const ids = blanks.map((blank, index) => {
        if (blank && typeof blank === 'object' && !Array.isArray(blank)) {
            return String(blank.id ?? '').trim();
        }
        return requireExplicitIds ? '' : `blank-${index}`;
    });
    if (requireExplicitIds && ids.some((id) => !id)) {
        issues.push(questionIssue(
            questionId,
            'BLANK_ID_REQUIRED',
            'Mỗi ô trống cần một mã định danh ổn định.',
            'blanks',
        ));
    }
    const nonEmptyIds = ids.filter(Boolean);
    if (new Set(nonEmptyIds).size !== nonEmptyIds.length) {
        issues.push(questionIssue(
            questionId,
            'BLANK_ID_DUPLICATE',
            'Mã định danh ô trống không được trùng nhau.',
            'blanks',
        ));
    }
    return issues;
};

const promptFor = (question: Question): string => {
    const data = question as any;
    return normalizeAuthoringText(
        question.type === QuestionType.TRUE_FALSE ? data.mainQuestion : data.question,
    );
};

const validateOptions = (
    questionId: string,
    optionsValue: unknown,
    correctValue: unknown,
    multiple = false,
): ManualQuizIssue[] => {
    const options = asArray<string>(optionsValue);
    const issues: ManualQuizIssue[] = [];
    if (options.length < 2) {
        issues.push(questionIssue(questionId, 'MCQ_OPTIONS_TOO_FEW', 'Cần ít nhất hai phương án.', 'options'));
    }
    if (options.some((option) => !normalizeAuthoringText(option))) {
        issues.push(questionIssue(questionId, 'MCQ_OPTION_EMPTY', 'Có phương án đang để trống.', 'options'));
    }
    const nonEmpty = options.map(normalized).filter(Boolean);
    if (new Set(nonEmpty).size !== nonEmpty.length) {
        issues.push(questionIssue(questionId, 'MCQ_OPTION_DUPLICATE', 'Có phương án bị trùng nội dung.', 'options'));
    }

    const labels = new Set(labelsFor(options.length));
    const optionValues = new Set(nonEmpty);
    const answers = multiple ? asArray<string>(correctValue) : [String(correctValue ?? '')];
    const normalizedAnswers = answers.map((answer) => {
        const value = normalizeAuthoringText(answer);
        const optionIdMatch = value.match(/^option-(\d+)$/i);
        if (optionIdMatch) {
            const index = Number(optionIdMatch[1]);
            return index >= 0 && index < options.length ? String.fromCharCode(65 + index) : value.toUpperCase();
        }
        return value.toUpperCase();
    }).filter(Boolean);
    const hasMissing = normalizedAnswers.length === 0 || normalizedAnswers.some((answer) => (
        !labels.has(answer) && !optionValues.has(answer.toLocaleLowerCase('vi'))
    ));
    if (hasMissing) {
        issues.push(questionIssue(
            questionId,
            'MCQ_CORRECT_ANSWER_MISSING',
            multiple ? 'Hãy chọn ít nhất một đáp án đúng còn tồn tại.' : 'Đáp án đúng không khớp với các phương án.',
            multiple ? 'correctAnswers' : 'correctAnswer',
        ));
    }
    return issues;
};

const validateTrueFalse = (question: any): ManualQuizIssue[] => {
    const items = asArray<any>(question.items);
    const issues: ManualQuizIssue[] = [];
    if (items.length === 0) {
        issues.push(questionIssue(question.id, 'TRUE_FALSE_ITEMS_REQUIRED', 'Cần ít nhất một mệnh đề đúng/sai.', 'items'));
    }
    const itemIds = items.map((item) => String(item?.id ?? '').trim());
    if (itemIds.some((id) => !id)) {
        issues.push(questionIssue(question.id, 'TRUE_FALSE_ID_REQUIRED', 'Mỗi mệnh đề cần một mã định danh ổn định.', 'items'));
    }
    const nonEmptyIds = itemIds.filter(Boolean);
    if (new Set(nonEmptyIds).size !== nonEmptyIds.length) {
        issues.push(questionIssue(question.id, 'TRUE_FALSE_ID_DUPLICATE', 'Mã mệnh đề đúng/sai không được trùng nhau.', 'items'));
    }
    items.forEach((item, index) => {
        if (!normalizeAuthoringText(item?.statement)) {
            issues.push(questionIssue(question.id, 'TRUE_FALSE_STATEMENT_EMPTY', `Mệnh đề ${index + 1} đang để trống.`, `items[${index}].statement`));
        }
        if (typeof item?.isCorrect !== 'boolean') {
            issues.push(questionIssue(question.id, 'TRUE_FALSE_ANSWER_REQUIRED', `Mệnh đề ${index + 1} chưa chọn Đúng hoặc Sai.`, `items[${index}].isCorrect`));
        }
    });
    return issues;
};

const validateMatching = (question: any): ManualQuizIssue[] => {
    const pairs = asArray<any>(question.pairs);
    const issues: ManualQuizIssue[] = [];
    if (pairs.length < 2) {
        issues.push(questionIssue(question.id, 'MATCHING_PAIRS_TOO_FEW', 'Cần ít nhất hai cặp để nối.', 'pairs'));
    }
    pairs.forEach((pair, index) => {
        if (!normalizeAuthoringText(pair?.left) || !normalizeAuthoringText(pair?.right)) {
            issues.push(questionIssue(question.id, 'MATCHING_PAIR_EMPTY', `Cặp nối ${index + 1} chưa đủ hai vế.`, `pairs[${index}]`));
        }
    });
    return issues;
};

const validateOrdering = (question: any): ManualQuizIssue[] => {
    const items = asArray<string>(question.items);
    const order = asArray<number>(question.correctOrder);
    const issues: ManualQuizIssue[] = [];
    if (items.length < 2 || items.some((item) => !normalizeAuthoringText(item))) {
        issues.push(questionIssue(question.id, 'ORDERING_ITEMS_INVALID', 'Cần ít nhất hai mục sắp xếp và không được để trống.', 'items'));
    }
    const expected = labelsFor(items.length).map((_, index) => index).sort((a, b) => a - b);
    const actual = [...order].sort((a, b) => a - b);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        issues.push(questionIssue(question.id, 'ORDERING_CORRECT_ORDER_INVALID', 'Thứ tự đúng phải chứa đủ mỗi mục đúng một lần.', 'correctOrder'));
    }
    return issues;
};

const validateDropdown = (question: any): ManualQuizIssue[] => {
    const blanks = asArray<any>(question.blanks);
    const issues: ManualQuizIssue[] = validateBlankIdentity(question.id, question.text, blanks, true);
    if (!normalizeAuthoringText(question.text) || blanks.length === 0) {
        issues.push(questionIssue(question.id, 'DROPDOWN_CONTENT_REQUIRED', 'Cần nội dung và ít nhất một ô chọn.', 'text'));
    }
    blanks.forEach((blank, index) => {
        const options = asArray<string>(blank?.options);
        if (options.length < 2 || options.some((option) => !normalizeAuthoringText(option))) {
            issues.push(questionIssue(question.id, 'DROPDOWN_OPTIONS_INVALID', `Ô chọn ${index + 1} cần ít nhất hai phương án hợp lệ.`, `blanks[${index}].options`));
        }
        const answer = normalized(blank?.correctAnswer);
        if (!answer || !options.map(normalized).includes(answer)) {
            issues.push(questionIssue(question.id, 'DROPDOWN_ANSWER_INVALID', `Đáp án ô chọn ${index + 1} không thuộc danh sách.`, `blanks[${index}].correctAnswer`));
        }
    });
    return issues;
};

const validateQuestionSpecific = (question: Question): ManualQuizIssue[] => {
    const data = question as any;
    const questionId = question.id;
    switch (question.type) {
        case QuestionType.MCQ:
        case QuestionType.IMAGE_QUESTION:
            return validateOptions(question.id, data.options, data.correctAnswer);
        case QuestionType.MULTIPLE_SELECT:
            return validateOptions(question.id, data.options, data.correctAnswers, true);
        case QuestionType.TRUE_FALSE:
            return validateTrueFalse(data);
        case QuestionType.SHORT_ANSWER:
            return normalizeAuthoringText(data.correctAnswer)
                ? [] : [questionIssue(question.id, 'SHORT_ANSWER_REQUIRED', 'Hãy nhập đáp án đúng.', 'correctAnswer')];
        case QuestionType.MATCHING:
            return validateMatching(data);
        case QuestionType.DRAG_DROP: {
            const blanks = asArray<any>(data.blanks);
            const issues = validateBlankIdentity(question.id, data.text, blanks, false);
            const hasValidAnswers = blanks.length > 0 && blanks.every((item) => {
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    return normalizeAuthoringText(item.correctAnswer);
                }
                return normalizeAuthoringText(item);
            });
            if (!normalizeAuthoringText(data.text) || !hasValidAnswers) {
                issues.push(questionIssue(question.id, 'DRAG_DROP_CONTENT_INVALID', 'Nội dung kéo thả cần có văn bản và đáp án cho mỗi ô trống.', 'blanks'));
            }
            return issues;
        }
        case QuestionType.ORDERING:
            return validateOrdering(data);
        case QuestionType.DROPDOWN:
            return validateDropdown(data);
        case QuestionType.UNDERLINE: {
            const words = asArray<string>(data.words);
            const indexes = asArray<number>(data.correctWordIndexes);
            const valid = normalizeAuthoringText(data.sentence)
                && words.length > 0
                && indexes.length > 0
                && indexes.every((index) => Number.isInteger(index) && index >= 0 && index < words.length);
            return valid ? [] : [questionIssue(question.id, 'UNDERLINE_CONTENT_INVALID', 'Câu gạch chân cần nội dung và chỉ số đáp án hợp lệ.', 'correctWordIndexes')];
        }
        case QuestionType.CATEGORIZATION: {
            const categories = asArray<any>(data.categories);
            const items = asArray<any>(data.items);
            const categoryIdList = categories.map((category) => String(category?.id ?? '').trim());
            const itemIdList = items.map((item) => String(item?.id ?? '').trim());
            const categoryIds = new Set(categoryIdList);
            const issues: ManualQuizIssue[] = [];
            const duplicateOrMissingIds = categoryIdList.some((id) => !id)
                || itemIdList.some((id) => !id)
                || new Set(categoryIdList.filter(Boolean)).size !== categoryIdList.filter(Boolean).length
                || new Set(itemIdList.filter(Boolean)).size !== itemIdList.filter(Boolean).length;
            if (duplicateOrMissingIds) {
                issues.push(questionIssue(question.id, 'CATEGORIZATION_ID_DUPLICATE', 'Mã nhóm và mã mục phân loại phải tồn tại và không được trùng.', 'items'));
            }
            const valid = categories.length > 0 && items.length > 0
                && categories.every((category) => normalizeAuthoringText(category?.name))
                && items.every((item) => normalizeAuthoringText(item?.content) && categoryIds.has(String(item?.categoryId ?? '')));
            if (!valid) {
                issues.push(questionIssue(question.id, 'CATEGORIZATION_CONTENT_INVALID', 'Mỗi mục phân loại phải có nội dung và thuộc một nhóm tồn tại.', 'items'));
            }
            return issues;
        }
        case QuestionType.WORD_SCRAMBLE:
            return asArray<string>(data.letters).length >= 2 && normalizeAuthoringText(data.correctWord)
                ? [] : [questionIssue(question.id, 'WORD_SCRAMBLE_CONTENT_INVALID', 'Cần ít nhất hai chữ cái và từ đáp án.', 'letters')];
        case QuestionType.RIDDLE:
            return asArray<string>(data.riddleLines).some((line) => normalizeAuthoringText(line)) && normalizeAuthoringText(data.correctAnswer)
                ? [] : [questionIssue(question.id, 'RIDDLE_CONTENT_INVALID', 'Câu đố cần nội dung và đáp án.', 'riddleLines')];
        case QuestionType.ERROR_CORRECTION:
            return normalizeAuthoringText(data.passage) && normalizeAuthoringText(data.wrongWord) && normalizeAuthoringText(data.correctWord)
                ? [] : [questionIssue(question.id, 'ERROR_CORRECTION_CONTENT_INVALID', 'Cần đoạn văn, từ sai và từ sửa đúng.', 'passage')];
        case QuestionType.GEOMETRY:
            return [questionIssue(
                question.id,
                'QUESTION_NOT_AUTO_GRADABLE',
                'Câu hình học chưa có hợp đồng đáp án để chấm tự động và chưa thể xuất bản.',
                'type',
            )];
        default:
            return [questionIssue(questionId, 'QUESTION_TYPE_UNSUPPORTED', 'Dạng câu hỏi này chưa được hỗ trợ.', 'type')];
    }
};

export const validateQuestionForAuthoring = (question: Question): ManualQuizIssue[] => {
    const issues: ManualQuizIssue[] = [];
    if (!promptFor(question)) {
        issues.push(questionIssue(question.id, 'QUESTION_PROMPT_REQUIRED', 'Nội dung câu hỏi đang để trống.', 'question'));
    }
    issues.push(...validateQuestionSpecific(question));
    appendScoringContractIssues(question, issues);

    const points = Number((question as any).points);
    if (!Number.isFinite(points) || points <= 0) {
        issues.push(createQuizIssue('QUESTION_POINTS_INVALID', 'error', 'Điểm câu hỏi phải lớn hơn 0.', {
            questionId: question.id,
            field: 'points',
            action: 'fix-points',
        }));
    }

    const data = question as any;
    const mediaValues = [data.image, ...asArray<string>(data.optionImages)];
    if (mediaValues.some(hasUnsafeMediaValue)) {
        issues.push(createQuizIssue('MEDIA_NOT_PERSISTED', 'error', 'Ảnh vẫn là dữ liệu tạm thời và chưa được tải lên.', {
            questionId: question.id,
            field: 'image',
            action: 'retry-media',
        }));
    }
    if (question.type === QuestionType.IMAGE_QUESTION && !normalizeAuthoringText(data.image)) {
        issues.push(createQuizIssue('IMAGE_QUESTION_MEDIA_REQUIRED', 'error', 'Câu hỏi hình ảnh cần một ảnh chính.', {
            questionId: question.id,
            field: 'image',
            action: 'retry-media',
        }));
    }

    for (const mathIssue of validateQuestionMath(question)) {
        issues.push(createQuizIssue(
            `MATH_${mathIssue.code.replace(/-/g, '_').toUpperCase()}`,
            'error',
            mathIssue.message,
            {
                questionId: question.id,
                field: mathIssue.field,
                action: 'go-to-question',
            },
        ));
    }
    return issues;
};
