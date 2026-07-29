import {
  AI_QUESTION_QUALITY_VERSION,
  type AiQuestionQualityCode,
  type AiQuestionQualityInput,
  type AiQuestionQualityIssue,
  type AiQuestionQualitySeverity,
  type AiQuestionQualitySummary,
} from './ai-question-quality.contract';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => (
  typeof value === 'object' && value !== null ? value as UnknownRecord : {}
);

const asTrimmedString = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeText = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const questionStem = (question: UnknownRecord): string => {
  const direct = [
    question.question,
    question.mainQuestion,
    question.sentence,
    question.text,
    question.passage,
  ].map(asTrimmedString).find(Boolean);
  if (direct) return direct;
  if (Array.isArray(question.riddleLines)) {
    return question.riddleLines.map(asTrimmedString).filter(Boolean).join(' ');
  }
  return '';
};

const questionId = (question: UnknownRecord): string | undefined => {
  const value = asTrimmedString(question.id) || asTrimmedString(question.slotId);
  return value || undefined;
};

const createIssue = (
  question: UnknownRecord,
  questionIndex: number,
  code: AiQuestionQualityCode,
  severity: AiQuestionQualitySeverity,
  message: string,
  path?: string,
  discriminator = '',
): AiQuestionQualityIssue => ({
  id: [code, questionId(question) ?? questionIndex, discriminator].filter(Boolean).join(':'),
  code,
  severity,
  questionIndex,
  questionId: questionId(question),
  message,
  path,
});

const stringArray = (value: unknown): string[] => (
  Array.isArray(value) ? value.map(asTrimmedString).filter(Boolean) : []
);

const answerMatchesOptions = (answer: unknown, options: string[]): boolean => {
  const normalizedAnswer = asTrimmedString(answer);
  if (!normalizedAnswer || options.length === 0) return false;
  if (/^[A-Z]$/i.test(normalizedAnswer)) {
    return normalizedAnswer.toUpperCase().charCodeAt(0) - 65 < options.length;
  }
  const candidate = normalizeText(normalizedAnswer);
  return options.some((option) => normalizeText(option) === candidate);
};

const optionGroups = (question: UnknownRecord): Array<{ path: string; options: string[] }> => {
  const groups: Array<{ path: string; options: string[] }> = [];
  const directOptions = stringArray(question.options);
  if (directOptions.length > 0) groups.push({ path: 'options', options: directOptions });
  if (Array.isArray(question.blanks)) {
    question.blanks.forEach((blank, blankIndex) => {
      const options = stringArray(asRecord(blank).options);
      if (options.length > 0) groups.push({ path: `blanks.${blankIndex}.options`, options });
    });
  }
  return groups;
};

const findDuplicateOption = (options: string[]): string | null => {
  const seen = new Map<string, string>();
  for (const option of options) {
    const normalized = normalizeText(option);
    if (!normalized) continue;
    if (seen.has(normalized)) return option;
    seen.set(normalized, option);
  }
  return null;
};

const invalidAnswerPaths = (question: UnknownRecord): string[] => {
  const type = asTrimmedString(question.type).toUpperCase();
  const options = stringArray(question.options);
  if (type === 'MCQ' || type === 'IMAGE_QUESTION') {
    return answerMatchesOptions(question.correctAnswer, options) ? [] : ['correctAnswer'];
  }
  if (type === 'MULTIPLE_SELECT') {
    const answers = stringArray(question.correctAnswers);
    const normalizedAnswers = answers.map((answer) => answer.toUpperCase());
    const hasDuplicate = new Set(normalizedAnswers).size !== normalizedAnswers.length;
    return answers.length > 0
      && !hasDuplicate
      && answers.every((answer) => answerMatchesOptions(answer, options))
      ? []
      : ['correctAnswers'];
  }
  if (type === 'DROPDOWN' && Array.isArray(question.blanks)) {
    return question.blanks.flatMap((blank, blankIndex) => {
      const record = asRecord(blank);
      return answerMatchesOptions(record.correctAnswer, stringArray(record.options))
        ? []
        : [`blanks.${blankIndex}.correctAnswer`];
    });
  }
  return [];
};

const collectStrings = (value: unknown, depth = 0): string[] => {
  if (depth > 3) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item, depth + 1));
  if (typeof value === 'object' && value !== null) {
    return Object.values(value as UnknownRecord).flatMap((item) => collectStrings(item, depth + 1));
  }
  return [];
};

const countToken = (value: string, token: string): number => value.split(token).length - 1;

const hasMathParseRisk = (question: UnknownRecord): boolean => {
  const content = collectStrings(question).join(' ');
  const dollarCount = (content.match(/(?<!\\)\$/g) ?? []).length;
  if (dollarCount % 2 !== 0) return true;
  if (countToken(content, '\\(') !== countToken(content, '\\)')) return true;
  if (countToken(content, '\\[') !== countToken(content, '\\]')) return true;
  const fractionCount = countToken(content, '\\frac');
  if (fractionCount > 0) {
    const validFractions = content.match(/\\frac\s*\{[^{}]+\}\s*\{[^{}]+\}/g)?.length ?? 0;
    if (validFractions !== fractionCount) return true;
  }
  return false;
};

const explicitGradeMismatch = (stem: string, classLevel: string): boolean => {
  const expected = classLevel.match(/\d{1,2}/)?.[0];
  if (!expected) return false;
  const mentioned = [...stem.matchAll(/lớp\s*(\d{1,2})/giu)].map((match) => match[1]);
  return mentioned.some((grade) => grade !== expected);
};

export function evaluateAiQuestionQuality(input: AiQuestionQualityInput): AiQuestionQualitySummary {
  const issues: AiQuestionQualityIssue[] = [];
  const normalizedStems = new Map<string, number>();

  input.questions.forEach((rawQuestion, questionIndex) => {
    const question = asRecord(rawQuestion);
    const stem = questionStem(question);
    const normalizedStem = normalizeText(stem);

    if (!stem) {
      issues.push(createIssue(
        question,
        questionIndex,
        'EMPTY_STEM',
        'blocking',
        `Câu ${questionIndex + 1} chưa có nội dung câu hỏi.`,
        'question',
      ));
    } else if (normalizedStem.length >= 8) {
      const firstIndex = normalizedStems.get(normalizedStem);
      if (firstIndex !== undefined) {
        issues.push(createIssue(
          question,
          questionIndex,
          'DUPLICATE_QUESTION',
          'blocking',
          `Câu ${questionIndex + 1} trùng nội dung với câu ${firstIndex + 1}.`,
          'question',
          String(firstIndex),
        ));
      } else {
        normalizedStems.set(normalizedStem, questionIndex);
      }
    }

    optionGroups(question).forEach(({ path, options }, groupIndex) => {
      const duplicate = findDuplicateOption(options);
      if (!duplicate) return;
      issues.push(createIssue(
        question,
        questionIndex,
        'DUPLICATE_OPTION',
        'blocking',
        `Câu ${questionIndex + 1} có phương án bị trùng: “${duplicate}”.`,
        path,
        String(groupIndex),
      ));
    });

    invalidAnswerPaths(question).forEach((path, answerIndex) => {
      issues.push(createIssue(
        question,
        questionIndex,
        'ANSWER_OUTSIDE_OPTIONS',
        'blocking',
        `Câu ${questionIndex + 1} có đáp án đúng không thuộc các phương án đã cho.`,
        path,
        String(answerIndex),
      ));
    });

    if (stem && explicitGradeMismatch(stem, input.classLevel)) {
      issues.push(createIssue(
        question,
        questionIndex,
        'GRADE_MISMATCH',
        'warning',
        `Câu ${questionIndex + 1} nhắc tới khối lớp khác với lớp ${input.classLevel}.`,
        'question',
      ));
    }

    if (hasMathParseRisk(question)) {
      issues.push(createIssue(
        question,
        questionIndex,
        'MATH_PARSE_RISK',
        'warning',
        `Câu ${questionIndex + 1} có biểu thức toán học có thể chưa đóng đủ ký hiệu.`,
      ));
    }
  });

  const blockingCount = issues.filter((issue) => issue.severity === 'blocking').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  return {
    version: AI_QUESTION_QUALITY_VERSION,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    questionCount: input.questions.length,
    blockingCount,
    warningCount,
    canPublish: blockingCount === 0,
    issues,
  };
}
