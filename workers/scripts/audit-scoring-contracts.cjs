#!/usr/bin/env node
'use strict';

const {
  loadScoringRuntime,
  malformedJsonFields,
  normalizeReadOnlyOptions,
  parseCliArgs,
  queryD1,
  writeReports,
} = require('./scoring-report-support.cjs');

const QUESTION_QUERY = `
SELECT id, quiz_id, type, question, options, correct_answer, items, text_field, blanks,
       distractors, sentence, words, correct_word_indexes, image, difficulty,
       answer_schema_version
FROM questions
ORDER BY quiz_id, id
`;

function duplicateNormalized(values) {
  const normalized = values.map((value) => String(value || '').trim().toLocaleLowerCase('vi-VN')).filter(Boolean);
  return normalized.length > new Set(normalized).size;
}

function auditQuestionRows(rows, runtime = loadScoringRuntime()) {
  const issues = [];
  const byTypeVersion = {};
  for (const row of rows) {
    const type = String(row.type || 'UNKNOWN');
    const version = Number(row.answer_schema_version || 1);
    const key = `${type}:v${version}`;
    byTypeVersion[key] = (byTypeVersion[key] || 0) + 1;

    for (const field of malformedJsonFields(row)) {
      issues.push({ quizId: row.quiz_id, questionId: row.id, type, code: `MALFORMED_JSON_${field.toUpperCase()}`, severity: 'blocker' });
    }

    let question;
    try {
      question = runtime.mapLiveExamQuestionRow(row);
    } catch {
      issues.push({ quizId: row.quiz_id, questionId: row.id, type, code: 'QUESTION_MAPPING_FAILED', severity: 'blocker' });
      continue;
    }
    const normalized = runtime.normalizeQuestionForGrading(question);
    if (normalized.ok === false) {
      for (const contractIssue of normalized.issues) {
        issues.push({
          quizId: row.quiz_id,
          questionId: row.id,
          type,
          code: contractIssue.code,
          severity: 'blocker',
        });
      }
      continue;
    }

    if (normalized.question.type === 'MATCHING' && version < 2) {
      const pairs = normalized.question.pairs;
      if (duplicateNormalized(pairs.map((pair) => pair.leftText)) || duplicateNormalized(pairs.map((pair) => pair.rightText))) {
        issues.push({ quizId: row.quiz_id, questionId: row.id, type, code: 'AMBIGUOUS_LEGACY_MATCHING_CONTENT', severity: 'blocker' });
      }
    }
  }

  const blockers = issues.filter((issue) => issue.severity === 'blocker').length;
  return {
    title: 'TôHiệuQuiz Scoring Contract Audit',
    generatedAt: new Date().toISOString(),
    summary: {
      questions: rows.length,
      blockers,
      issues: issues.length,
      byTypeVersion,
    },
    issues,
  };
}

function main(argv = process.argv.slice(2)) {
  const options = normalizeReadOnlyOptions(parseCliArgs(argv));
  const rows = queryD1(options, QUESTION_QUERY);
  const report = auditQuestionRows(rows);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const paths = writeReports(`scoring-contract-audit-${stamp}`, report, options.reportsDir);
  process.stdout.write(`Scoring contract audit: questions=${report.summary.questions} blockers=${report.summary.blockers}\n`);
  process.stdout.write(`JSON: ${paths.jsonPath}\nMarkdown: ${paths.markdownPath}\n`);
  if (report.summary.blockers > 0) process.exitCode = 1;
  return report;
}

if (require.main === module) main();
module.exports = { QUESTION_QUERY, auditQuestionRows, main };
