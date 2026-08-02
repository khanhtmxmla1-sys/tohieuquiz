import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CuratedQuestionBankInput } from './math5-types.ts';
import { loadCommittedMath5Dataset, validateMath5Dataset } from './validate-math5-dataset.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = path.join(projectRoot, 'data', 'question-bank', 'math5-semester1');
const reportDir = path.join(projectRoot, 'reports', 'question-bank');
const topicNames = Array.from({ length: 6 }, (_, index) => `topic-${String(index + 1).padStart(2, '0')}.json`);

const fileSha256 = (filePath: string): string => crypto
  .createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');

const answerText = (item: CuratedQuestionBankInput): string => {
  const question = item.questionData as unknown as Record<string, unknown>;
  switch (question.type) {
    case 'MCQ': {
      const options = question.options as string[];
      const answer = String(question.correctAnswer);
      const index = answer.charCodeAt(0) - 65;
      return `${answer}. ${options[index]}`;
    }
    case 'SHORT_ANSWER':
      return String(question.correctAnswer);
    case 'TRUE_FALSE':
      return (question.items as Array<Record<string, unknown>>)
        .map((entry, index) => `${index + 1}. ${entry.isCorrect ? 'Đúng' : 'Sai'}`)
        .join('; ');
    case 'MATCHING':
      return (question.pairs as Array<Record<string, unknown>>)
        .map((pair) => `${pair.left} ↔ ${pair.right}`)
        .join('; ');
    case 'MULTIPLE_SELECT': {
      const options = question.options as string[];
      return (question.correctAnswers as string[])
        .map((answer) => `${answer}. ${options[answer.charCodeAt(0) - 65]}`)
        .join('; ');
    }
    case 'ORDERING': {
      const values = question.items as string[];
      return (question.correctOrder as number[]).map((index) => values[index]).join(' → ');
    }
    case 'CATEGORIZATION': {
      const categories = new Map((question.categories as Array<Record<string, unknown>>)
        .map((category) => [String(category.id), String(category.name)]));
      return (question.items as Array<Record<string, unknown>>)
        .map((entry) => `${entry.content} → ${categories.get(String(entry.categoryId))}`)
        .join('; ');
    }
    default:
      return '[Xem cấu trúc JSON]';
  }
};

const promptText = (item: CuratedQuestionBankInput): string => {
  const question = item.questionData as unknown as Record<string, unknown>;
  return String(question.question ?? question.mainQuestion ?? '[Chưa có nội dung]');
};

export const buildMath5Manifest = async () => {
  const { curriculum, items, topicFiles } = loadCommittedMath5Dataset();
  const validation = await validateMath5Dataset();
  if (!validation.valid) throw new Error(`Dataset invalid: ${validation.errors.join(' | ')}`);
  const files = topicFiles.map((file) => ({
    name: file.name,
    topicCode: file.items[0]?.metadata.topicCode || '',
    itemCount: file.items.length,
    sha256: fileSha256(path.join(dataDir, file.name)),
  }));
  const datasetSha256 = crypto
    .createHash('sha256')
    .update(files.map((file) => file.sha256).join(':'))
    .digest('hex');
  return {
    schemaVersion: 1,
    datasetVersion: '2026.08.02.1',
    grade: 5,
    subject: 'MATH',
    semester: 1,
    status: 'DRAFT',
    source: 'CURATED_ORIGINAL',
    curriculumSource: curriculum.source,
    sourceCheckedAt: curriculum.sourceCheckedAt,
    counts: validation.counts,
    topicCounts: validation.topicCounts,
    files,
    datasetSha256,
    importBatches: [100, 100, 100, 50],
    generatedBy: 'scripts/question-bank/generate-math5-dataset.ts',
    validator: 'scripts/question-bank/validate-math5-dataset.ts',
  };
};

export const buildMath5ReviewReport = async (): Promise<string> => {
  const { curriculum, items } = loadCommittedMath5Dataset();
  const validation = await validateMath5Dataset();
  const manifest = await buildMath5Manifest();
  const lines: string[] = [
    '# Báo cáo review ngân hàng câu hỏi Toán lớp 5 học kì I',
    '',
    `- Dataset version: \`${manifest.datasetVersion}\``,
    `- Trạng thái nhập: \`${manifest.status}\``,
    `- Quy mô: ${validation.counts.items} câu / ${validation.counts.lessons} bài / ${validation.counts.topics} chủ đề`,
    `- Schema hợp lệ: ${validation.counts.validItems}/${validation.counts.items}`,
    `- Hash trùng: ${validation.counts.duplicateHashes}`,
    `- Cảnh báo validator: ${validation.warnings.length}`,
    `- SHA-256 dataset: \`${manifest.datasetSha256}\``,
    '',
    '> Dữ liệu không lưu `explanation` theo contract hiện tại. Báo cáo này hiển thị đáp án chuẩn để quản trị viên kiểm tra trước khi nhập.',
    '',
  ];

  for (const topic of curriculum.topics) {
    lines.push(`## ${topic.code} — ${topic.title}`, '');
    for (const lesson of topic.lessons) {
      const lessonItems = items.filter((item) => item.metadata.lessonCode === lesson.code);
      lines.push(`### ${lesson.code} — Bài ${lesson.number}: ${lesson.title}`, '');
      for (const [index, item] of lessonItems.entries()) {
        const question = item.questionData as unknown as Record<string, unknown>;
        lines.push(
          `**Câu ${index + 1} — ${question.type} — Mức ${question.difficulty}**`,
          '',
          promptText(item),
          '',
          `- Đáp án: ${answerText(item)}`,
          `- ID: \`${item.id}\``,
          '',
        );
      }
    }
  }

  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
};

export const writeMath5ReviewArtifacts = async () => {
  fs.mkdirSync(reportDir, { recursive: true });
  const manifest = await buildMath5Manifest();
  const report = await buildMath5ReviewReport();
  fs.writeFileSync(path.join(dataDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(reportDir, 'math5-semester1-review.md'), report, 'utf8');
  return { manifest, reportPath: path.join(reportDir, 'math5-semester1-review.md') };
};

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const result = await writeMath5ReviewArtifacts();
  console.log(`Wrote manifest and review report: ${result.reportPath}`);
}
