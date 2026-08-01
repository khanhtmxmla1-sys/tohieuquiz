#!/usr/bin/env node
'use strict';

const {
  loadScoringRuntime,
  normalizeReadOnlyOptions,
  parseCliArgs,
  parseStoredJson,
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

const resultQuery = (limit) => `
SELECT id, quiz_id, score, correct_count, total_questions, answers, grading_version
FROM results
ORDER BY id
LIMIT ${Number(limit)}
`;

function buildHistoricalRegradeReport(resultRows, questionRows, runtime = loadScoringRuntime()) {
  const questionsByQuiz = new Map();
  for (const row of questionRows) {
    try {
      const question = runtime.mapLiveExamQuestionRow(row);
      const quizId = String(row.quiz_id || '');
      if (!questionsByQuiz.has(quizId)) questionsByQuiz.set(quizId, []);
      questionsByQuiz.get(quizId).push(question);
    } catch {
      // The result will be classified UNREGRADABLE when its quiz is processed.
    }
  }

  const issues = [];
  const affected = [];
  const byQuiz = {};
  for (const row of resultRows) {
    const quizId = String(row.quiz_id || '');
    const questions = questionsByQuiz.get(quizId);
    if (!quizId || !questions || questions.length === 0) {
      issues.push({ quizId, resultId: String(row.id), status: 'UNREGRADABLE', code: 'QUIZ_OR_QUESTIONS_MISSING' });
      continue;
    }
    let answers;
    try {
      answers = parseStoredJson(row.answers) || {};
    } catch {
      issues.push({ quizId, resultId: String(row.id), status: 'UNREGRADABLE', code: 'ANSWERS_JSON_INVALID' });
      continue;
    }
    const grading = runtime.gradeQuiz({ questions }, answers);
    if (grading.issues.length > 0) {
      issues.push({ quizId, resultId: String(row.id), status: 'UNREGRADABLE', code: 'INVALID_QUESTION_OR_ANSWER_CONTRACT' });
      continue;
    }
    const oldScore = Number(row.score || 0);
    const oldCorrectCount = Number(row.correct_count || 0);
    const scoreDelta = Number((grading.score - oldScore).toFixed(1));
    const correctDelta = grading.correctCount - oldCorrectCount;
    const quizSummary = byQuiz[quizId] || { results: 0, affected: 0, scoreDeltaTotal: 0 };
    quizSummary.results += 1;
    if (scoreDelta !== 0 || correctDelta !== 0) {
      quizSummary.affected += 1;
      quizSummary.scoreDeltaTotal = Number((quizSummary.scoreDeltaTotal + scoreDelta).toFixed(1));
      affected.push({
        quizId,
        resultId: String(row.id),
        oldScore,
        newScore: grading.score,
        scoreDelta,
        oldCorrectCount,
        newCorrectCount: grading.correctCount,
        correctDelta,
      });
    }
    byQuiz[quizId] = quizSummary;
  }

  return {
    title: 'TôHiệuQuiz Historical Result Regrade Report',
    generatedAt: new Date().toISOString(),
    summary: {
      results: resultRows.length,
      regradable: resultRows.length - issues.length,
      affected: affected.length,
      unregradable: issues.length,
      byQuiz,
    },
    affected,
    issues,
    readOnly: true,
  };
}

function main(argv = process.argv.slice(2)) {
  const options = normalizeReadOnlyOptions(parseCliArgs(argv));
  const questions = queryD1(options, QUESTION_QUERY);
  const results = queryD1(options, resultQuery(options.limit));
  const report = buildHistoricalRegradeReport(results, questions);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const paths = writeReports(`historical-result-regrade-${stamp}`, report, options.reportsDir);
  process.stdout.write(`Historical regrade: results=${report.summary.results} affected=${report.summary.affected} unregradable=${report.summary.unregradable}\n`);
  process.stdout.write(`JSON: ${paths.jsonPath}\nMarkdown: ${paths.markdownPath}\n`);
  return report;
}

if (require.main === module) main();
module.exports = { QUESTION_QUERY, buildHistoricalRegradeReport, main, resultQuery };
