import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateQuestion } from '../../schemas/quiz.schema.ts';
import { hashQuestionData } from '../../workers/src/services/questionBankContent.ts';
import type {
  CuratedQuestionBankInput,
  Math5Curriculum,
  Math5CurriculumLesson,
} from './math5-types.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const datasetDir = path.join(projectRoot, 'data', 'question-bank', 'math5-semester1');
const topicFileNames = Array.from({ length: 6 }, (_, index) => `topic-${String(index + 1).padStart(2, '0')}.json`);

export interface Math5ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    topics: number;
    lessons: number;
    items: number;
    validItems: number;
    duplicateHashes: number;
  };
  topicCounts: Record<string, number>;
  lessonCounts: Record<string, number>;
  hashes: Record<string, string>;
}

const loadJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

export const loadCommittedMath5Dataset = (): {
  curriculum: Math5Curriculum;
  items: CuratedQuestionBankInput[];
  topicFiles: Array<{ name: string; items: CuratedQuestionBankInput[] }>;
} => {
  const curriculum = loadJson<Math5Curriculum>(path.join(datasetDir, 'curriculum.json'));
  const topicFiles = topicFileNames.map((name) => ({
    name,
    items: loadJson<CuratedQuestionBankInput[]>(path.join(datasetDir, name)),
  }));
  return {
    curriculum,
    topicFiles,
    items: topicFiles.flatMap((file) => file.items),
  };
};

const questionText = (question: Record<string, unknown>): string => String(
  question.question ?? question.mainQuestion ?? '',
).trim();

const roleTag = (item: CuratedQuestionBankInput): string | undefined =>
  item.metadata.tags.find((tag) => tag.startsWith('Vai trò:'));

const validateTypeSemantics = (item: CuratedQuestionBankInput): string[] => {
  const errors: string[] = [];
  const question = item.questionData as unknown as Record<string, unknown>;
  const type = String(question.type || '');

  if (type === 'MCQ') {
    const options = Array.isArray(question.options) ? question.options.map(String) : [];
    const answer = String(question.correctAnswer || '');
    const answerIndex = answer.charCodeAt(0) - 65;
    if (answerIndex < 0 || answerIndex >= options.length) errors.push('MCQ có đáp án ngoài phạm vi lựa chọn.');
    if (new Set(options).size !== options.length) errors.push('MCQ có phương án trùng nhau.');
  }

  if (type === 'MULTIPLE_SELECT') {
    const options = Array.isArray(question.options) ? question.options.map(String) : [];
    const answers = Array.isArray(question.correctAnswers) ? question.correctAnswers.map(String) : [];
    if (answers.length === 0 || new Set(answers).size !== answers.length) errors.push('MULTIPLE_SELECT có đáp án rỗng hoặc trùng.');
    for (const answer of answers) {
      const answerIndex = answer.charCodeAt(0) - 65;
      if (answerIndex < 0 || answerIndex >= options.length) errors.push('MULTIPLE_SELECT có đáp án ngoài phạm vi lựa chọn.');
    }
  }

  if (type === 'ORDERING') {
    const items = Array.isArray(question.items) ? question.items : [];
    const order = Array.isArray(question.correctOrder) ? question.correctOrder.map(Number) : [];
    const expected = Array.from({ length: items.length }, (_, index) => index).sort((a, b) => a - b);
    const actual = [...order].sort((a, b) => a - b);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push('ORDERING không chứa hoán vị đầy đủ.');
  }

  if (type === 'MATCHING') {
    const pairs = Array.isArray(question.pairs) ? question.pairs as Array<Record<string, unknown>> : [];
    const left = pairs.map((pair) => String(pair.left || ''));
    if (new Set(left).size !== left.length) errors.push('MATCHING có vế trái trùng nhau.');
  }

  if (type === 'TRUE_FALSE') {
    const items = Array.isArray(question.items) ? question.items as Array<Record<string, unknown>> : [];
    if (items.length < 2) errors.push('TRUE_FALSE cần ít nhất hai nhận định trong bộ dữ liệu curated.');
    if (!items.some((entry) => entry.isCorrect === true) || !items.some((entry) => entry.isCorrect === false)) {
      errors.push('TRUE_FALSE cần có cả nhận định đúng và sai.');
    }
  }

  if (type === 'CATEGORIZATION') {
    const categories = Array.isArray(question.categories) ? question.categories as Array<Record<string, unknown>> : [];
    const categoryIds = new Set(categories.map((category) => String(category.id || '')));
    const entries = Array.isArray(question.items) ? question.items as Array<Record<string, unknown>> : [];
    if (entries.some((entry) => !categoryIds.has(String(entry.categoryId || '')))) {
      errors.push('CATEGORIZATION có mục trỏ tới nhóm không tồn tại.');
    }
  }

  return errors;
};

const lessonMap = (curriculum: Math5Curriculum) => new Map<string, {
  lesson: Math5CurriculumLesson;
  topicCode: string;
  topicTitle: string;
}>(curriculum.topics.flatMap((topic) => topic.lessons.map((lesson) => [
  lesson.code,
  { lesson, topicCode: topic.code, topicTitle: topic.title },
] as const)));

export const validateMath5Dataset = async (
  source = loadCommittedMath5Dataset(),
): Promise<Math5ValidationResult> => {
  const { curriculum, items, topicFiles } = source;
  const errors: string[] = [];
  const warnings: string[] = [];
  const lessons = lessonMap(curriculum);
  const topicCounts: Record<string, number> = {};
  const lessonCounts: Record<string, number> = {};
  const hashes: Record<string, string> = {};
  const ids = new Set<string>();
  const hashOwners = new Map<string, string>();
  const wordingOwners = new Map<string, string[]>();
  let validItems = 0;
  let duplicateHashes = 0;

  if (curriculum.topics.length !== 6) errors.push(`Curriculum phải có 6 chủ đề, nhận ${curriculum.topics.length}.`);
  if (lessons.size !== 35) errors.push(`Curriculum phải có 35 bài, nhận ${lessons.size}.`);
  if (items.length !== 350) errors.push(`Dataset phải có 350 câu, nhận ${items.length}.`);

  topicFiles.forEach((file, index) => {
    const expectedTopic = curriculum.topics[index];
    const expectedCount = expectedTopic.lessons.length * 10;
    if (file.items.length !== expectedCount) {
      errors.push(`${file.name} phải có ${expectedCount} câu, nhận ${file.items.length}.`);
    }
    if (file.items.some((item) => item.metadata.topicCode !== expectedTopic.code)) {
      errors.push(`${file.name} chứa câu không thuộc ${expectedTopic.code}.`);
    }
  });

  for (const item of items) {
    const prefix = item.id || '[không có id]';
    if (ids.has(item.id)) errors.push(`${prefix}: ID bị trùng.`);
    ids.add(item.id);

    const parsed = validateQuestion(item.questionData);
    if (!parsed.success) {
      errors.push(`${prefix}: schema không hợp lệ: ${parsed.error.issues.map((issue) => issue.message).join(' | ')}`);
    } else {
      validItems += 1;
    }

    const question = item.questionData as unknown as Record<string, unknown>;
    if ('explanation' in question) errors.push(`${prefix}: không được lưu explanation trong dữ liệu curated.`);
    if ('image' in question || 'imageAlt' in question) errors.push(`${prefix}: V1 không được phụ thuộc hình ảnh.`);
    if (!questionText(question)) errors.push(`${prefix}: thiếu nội dung câu hỏi.`);
    if (item.scope !== 'SYSTEM' || item.status !== 'DRAFT') errors.push(`${prefix}: chỉ được chuẩn bị SYSTEM/DRAFT.`);
    if (item.metadata.grade !== 5 || item.metadata.subject !== 'MATH' || item.metadata.semester !== 1) {
      errors.push(`${prefix}: metadata lớp/môn/học kì không hợp lệ.`);
    }
    if (item.metadata.source !== 'CURATED_ORIGINAL') errors.push(`${prefix}: source phải là CURATED_ORIGINAL.`);

    const lessonInfo = lessons.get(item.metadata.lessonCode);
    if (!lessonInfo) {
      errors.push(`${prefix}: lessonCode không tồn tại: ${item.metadata.lessonCode}.`);
    } else {
      if (lessonInfo.topicCode !== item.metadata.topicCode) {
        errors.push(`${prefix}: topicCode không khớp lessonCode.`);
      }
      for (const requiredTag of ['Toán', 'Lớp 5', 'Học kì 1', lessonInfo.topicTitle, `Bài ${lessonInfo.lesson.number}`, lessonInfo.lesson.title]) {
        if (!item.metadata.tags.includes(requiredTag)) errors.push(`${prefix}: thiếu tag ${requiredTag}.`);
      }
    }

    for (const semanticError of validateTypeSemantics(item)) errors.push(`${prefix}: ${semanticError}`);

    topicCounts[item.metadata.topicCode] = (topicCounts[item.metadata.topicCode] || 0) + 1;
    lessonCounts[item.metadata.lessonCode] = (lessonCounts[item.metadata.lessonCode] || 0) + 1;

    const hash = await hashQuestionData(item.questionData);
    hashes[item.id] = hash;
    const existingHashOwner = hashOwners.get(hash);
    if (existingHashOwner) {
      duplicateHashes += 1;
      errors.push(`${prefix}: trùng nội dung canonical với ${existingHashOwner}.`);
    } else {
      hashOwners.set(hash, item.id);
    }

    const wording = questionText(question).toLocaleLowerCase('vi').replace(/\s+/g, ' ');
    if (wording) wordingOwners.set(wording, [...(wordingOwners.get(wording) || []), item.id]);
  }

  for (const topic of curriculum.topics) {
    const expected = topic.lessons.length * 10;
    if ((topicCounts[topic.code] || 0) !== expected) {
      errors.push(`${topic.code}: phải có ${expected} câu, nhận ${topicCounts[topic.code] || 0}.`);
    }
  }

  const expectedDifficulties = { 1: 4, 2: 4, 3: 2 };
  const expectedRoles: Record<string, number> = {
    'Vai trò: MCQ cơ bản': 4,
    'Vai trò: Trả lời ngắn': 2,
    'Vai trò: Đúng sai': 1,
    'Vai trò: Tương tác': 1,
    'Vai trò: Vận dụng': 2,
  };

  for (const lessonCode of lessons.keys()) {
    const lessonItems = items.filter((item) => item.metadata.lessonCode === lessonCode);
    if (lessonItems.length !== 10) errors.push(`${lessonCode}: phải có 10 câu, nhận ${lessonItems.length}.`);
    const difficultyCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const roleCounts: Record<string, number> = {};
    lessonItems.forEach((item) => {
      const difficulty = Number((item.questionData as unknown as Record<string, unknown>).difficulty);
      difficultyCounts[difficulty] = (difficultyCounts[difficulty] || 0) + 1;
      const role = roleTag(item);
      if (role) roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
    for (const [difficulty, expected] of Object.entries(expectedDifficulties)) {
      if (difficultyCounts[Number(difficulty)] !== expected) {
        errors.push(`${lessonCode}: difficulty ${difficulty} phải có ${expected}, nhận ${difficultyCounts[Number(difficulty)] || 0}.`);
      }
    }
    for (const [role, expected] of Object.entries(expectedRoles)) {
      if ((roleCounts[role] || 0) !== expected) {
        errors.push(`${lessonCode}: ${role} phải có ${expected}, nhận ${roleCounts[role] || 0}.`);
      }
    }
  }

  for (const [wording, owners] of wordingOwners) {
    if (owners.length > 1) warnings.push(`Cụm câu hỏi lặp (${owners.join(', ')}): ${wording}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts: {
      topics: curriculum.topics.length,
      lessons: lessons.size,
      items: items.length,
      validItems,
      duplicateHashes,
    },
    topicCounts,
    lessonCounts,
    hashes,
  };
};

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const result = await validateMath5Dataset();
  console.log(JSON.stringify({
    valid: result.valid,
    counts: result.counts,
    topicCounts: result.topicCounts,
    warningCount: result.warnings.length,
  }, null, 2));
  if (result.warnings.length > 0) {
    console.warn(`Warnings (${result.warnings.length}):`);
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
  if (!result.valid) {
    console.error(`Errors (${result.errors.length}):`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  }
}
