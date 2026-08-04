import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const MODULE_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(MODULE_PATH), '..');

export const REMOTE_SELECT_SQL = `
SELECT
  quiz_id, id, type, question, options, correct_answer, items, text_field,
  blanks, distractors, sentence, words, correct_word_indexes, image,
  difficulty, answer_schema_version
FROM questions
ORDER BY quiz_id, rowid ASC
`.trim();

const suggestedActionFor = (issueCode) => {
  const actions = {
    MISSING_CORRECT_ANSWER: 'Bổ sung đáp án đúng trước khi xuất bản lại câu hỏi.',
    INVALID_CHOICE_CONTRACT: 'Kiểm tra danh sách phương án và đáp án đúng.',
    INVALID_MULTIPLE_SELECT_CONTRACT: 'Loại bỏ đáp án trùng và bảo đảm mọi đáp án thuộc danh sách phương án.',
    INVALID_TRUE_FALSE_CONTRACT: 'Bổ sung giá trị Đúng/Sai cho mọi mệnh đề.',
    INVALID_MATCHING_CONTRACT: 'Bổ sung đầy đủ hai vế cho các cặp nối.',
    INVALID_BLANK_CONTRACT: 'Kiểm tra mã ô trống và đáp án của từng ô.',
    INVALID_ORDERING_CONTRACT: 'Thiết lập một hoán vị đầy đủ, không trùng thứ tự.',
    INVALID_CATEGORIZATION_CONTRACT: 'Bảo đảm mọi mục tham chiếu đến một nhóm tồn tại.',
    INVALID_UNDERLINE_CONTRACT: 'Chọn ít nhất một từ hợp lệ để gạch chân.',
    INVALID_WORD_SCRAMBLE_CONTRACT: 'Bổ sung danh sách chữ cái và từ đáp án.',
    INVALID_ERROR_CORRECTION_CONTRACT: 'Bổ sung từ sai và từ sửa đúng.',
  };
  return actions[issueCode] ?? 'Mở câu hỏi trong trình sửa đề và hoàn thiện hợp đồng đáp án.';
};

export const parseJsonRows = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray(value.rows)) return value.rows;
  throw new Error('Input JSON phải là một mảng câu hỏi hoặc object có trường rows.');
};

const loadAuditTools = async () => {
  const server = await createServer({
    root: REPO_ROOT,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  try {
    const mapperModule = await server.ssrLoadModule('/workers/src/services/liveExamQuestionMapper.ts');
    const scoringModule = await server.ssrLoadModule('/src/domain/quiz-scoring/normalizeQuestion.ts');
    return {
      mapLiveExamQuestionRow: mapperModule.mapLiveExamQuestionRow,
      normalizeQuestionForGrading: scoringModule.normalizeQuestionForGrading,
    };
  } finally {
    await server.close();
  }
};

const isDatabaseRow = (row) => (
  row && typeof row === 'object' && (
    Object.prototype.hasOwnProperty.call(row, 'quiz_id')
    || Object.prototype.hasOwnProperty.call(row, 'correct_answer')
    || Object.prototype.hasOwnProperty.call(row, 'text_field')
  )
);

export const auditQuestionRows = async (inputRows, auditTools) => {
  const rows = parseJsonRows(inputRows);
  const { mapLiveExamQuestionRow, normalizeQuestionForGrading } = auditTools ?? await loadAuditTools();
  const findings = [];
  const invalidKeys = new Set();

  rows.forEach((row, index) => {
    const question = isDatabaseRow(row) ? mapLiveExamQuestionRow(row) : row;
    const normalized = normalizeQuestionForGrading(question);
    if (normalized.ok === true) return;

    const quizId = String(row?.quiz_id ?? row?.quizId ?? question?.quizId ?? '');
    const questionId = String(normalized.questionId ?? row?.id ?? question?.id ?? '');
    const questionType = String(normalized.type ?? row?.type ?? question?.type ?? 'UNKNOWN');
    invalidKeys.add(`${quizId}:${questionId || index}`);

    normalized.issues.forEach((issue) => {
      findings.push({
        quizId,
        questionId,
        questionType,
        issueCode: issue.code,
        severity: 'ERROR',
        suggestedAction: suggestedActionFor(issue.code),
      });
    });
  });

  const issueCounts = findings.reduce((counts, finding) => {
    counts[finding.issueCode] = (counts[finding.issueCode] ?? 0) + 1;
    return counts;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      auditedQuestions: rows.length,
      validQuestions: rows.length - invalidKeys.size,
      invalidQuestions: invalidKeys.size,
      issueCounts,
    },
    rows: findings,
  };
};

export const parseArgs = (argv) => {
  const options = { remote: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--remote') options.remote = true;
    else if (argument === '--input') options.input = argv[++index];
    else if (argument === '--output') options.output = argv[++index];
    else if (argument === '--database') options.database = argv[++index];
    else if (argument === '--config') options.config = argv[++index];
    else throw new Error(`Tham số không được hỗ trợ: ${argument}`);
  }
  if (!options.output) throw new Error('Bắt buộc chỉ định --output để lưu báo cáo audit.');
  if (options.remote && !options.database) throw new Error('Remote mode yêu cầu --database.');
  if (!options.remote && !options.input) throw new Error('Local mode yêu cầu --input.');
  return options;
};

const loadRemoteRows = (options) => {
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = [
    'wrangler', 'd1', 'execute', options.database,
    '--remote',
    '--command', REMOTE_SELECT_SQL,
    '--json',
  ];
  if (options.config) args.push('--config', options.config);
  else args.push('--config', 'workers/wrangler.toml');

  const command = spawnSync(executable, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (command.status !== 0) {
    throw new Error(command.stderr || 'Không thể đọc dữ liệu D1 từ xa.');
  }
  const parsed = JSON.parse(command.stdout);
  const batches = Array.isArray(parsed) ? parsed : [parsed];
  return batches.flatMap((batch) => batch?.results ?? batch?.result ?? []);
};

export const runQuestionContractAudit = async (argv = process.argv.slice(2)) => {
  const options = parseArgs(argv);
  const sourceRows = options.remote
    ? loadRemoteRows(options)
    : parseJsonRows(JSON.parse(await readFile(resolve(REPO_ROOT, options.input), 'utf8')));
  const report = await auditQuestionRows(sourceRows);
  const outputPath = resolve(REPO_ROOT, options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report.summary)}\n`);
  return report;
};
