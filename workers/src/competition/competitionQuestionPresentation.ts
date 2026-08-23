import { mapLiveExamQuestionRow } from '../services/liveExamQuestionMapper';

interface CompetitionSnapshotPayload {
  quiz: Record<string, unknown>;
  questions: Array<Record<string, unknown>>;
}

const FORBIDDEN_KEYS = new Set([
  'answer',
  'categoryId',
  'category_id',
  'correct',
  'correct_answer',
  'correctAnswer',
  'correctAnswers',
  'correctOrder',
  'correctWord',
  'correctWordIndexes',
  'correctCategory',
  'correctCategoryId',
  'explanation',
  'isCorrect',
  'wrongWord',
]);

function withoutAnswerKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutAnswerKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !FORBIDDEN_KEYS.has(key))
      .map(([key, child]) => [key, withoutAnswerKeys(child)]),
  );
}

function blankAnswer(blank: unknown): string {
  if (typeof blank === 'string') return blank;
  if (!blank || typeof blank !== 'object') return '';
  const row = blank as Record<string, unknown>;
  return String(row.correctAnswer ?? row.answer ?? row.value ?? '');
}

function presentQuestion(row: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapLiveExamQuestionRow(row) as unknown as Record<string, unknown>;
  const type = String(mapped.type || '').toUpperCase();
  const presented = withoutAnswerKeys(mapped) as Record<string, unknown>;

  if (type === 'MATCHING') {
    const pairs = Array.isArray(mapped.pairs) ? mapped.pairs as Array<Record<string, unknown>> : [];
    delete presented.pairs;
    presented.leftItems = pairs.map((pair, index) => ({ id: `l-${index}`, content: String(pair.left || '') }));
    presented.rightItems = [...pairs].reverse().map((pair, index) => ({ id: `r-${index}`, content: String(pair.right || '') }));
  }

  if (type === 'DRAG_DROP') {
    const blanks = Array.isArray(mapped.blanks) ? mapped.blanks : [];
    const distractors = Array.isArray(mapped.distractors) ? mapped.distractors.map(String) : [];
    const answerPool = blanks.map(blankAnswer).filter(Boolean);
    for (const distractor of distractors) {
      if (!answerPool.includes(distractor)) answerPool.push(distractor);
    }
    presented.blanks = blanks.map((blank, index) => {
      const sanitized = withoutAnswerKeys(blank);
      if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
        return { id: String((sanitized as Record<string, unknown>).id || `blank-${index + 1}`) };
      }
      return { id: `blank-${index + 1}` };
    });
    presented.answerPool = answerPool;
  }

  if (type === 'DROPDOWN') {
    const blanks = Array.isArray(mapped.blanks) ? mapped.blanks : [];
    presented.blanks = blanks.map((blank, index) => {
      const record = blank && typeof blank === 'object' && !Array.isArray(blank)
        ? blank as Record<string, unknown>
        : {};
      return {
        id: String(record.id || `blank-${index + 1}`),
        options: Array.isArray(record.options) ? record.options.map(String) : [],
      };
    });
  }

  return presented;
}

export function buildCompetitionQuestionPresentation(payload: CompetitionSnapshotPayload) {
  return {
    id: String(payload.quiz.id || ''),
    title: String(payload.quiz.title || ''),
    timeLimit: Number(payload.quiz.time_limit || 0),
    questions: payload.questions.map(presentQuestion),
  };
}

export function restoreCompetitionPresentationAnswers(
  questions: Array<Record<string, unknown>>,
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const restored = { ...answers };
  for (const row of questions) {
    if (String(row.type || '').toUpperCase() !== 'MATCHING') continue;
    const mapped = mapLiveExamQuestionRow(row) as unknown as Record<string, unknown>;
    const pairCount = Array.isArray(mapped.pairs) ? mapped.pairs.length : 0;
    const current = answers[String(row.id || '')];
    if (!current || typeof current !== 'object' || Array.isArray(current)) continue;
    restored[String(row.id || '')] = Object.fromEntries(
      Object.entries(current as Record<string, unknown>).map(([key, value]) => {
        if (key === 'selectedLeft' || key === '__shuffledIds') return [key, value];
        const match = String(value || '').match(/^r-(\d+)$/);
        if (!match) return [key, value];
        const presentationIndex = Number(match[1]);
        return [key, `r-${pairCount - 1 - presentationIndex}`];
      }),
    );
  }
  return restored;
}
