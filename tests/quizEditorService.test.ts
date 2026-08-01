import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQuizVersion, getQuizEditorPayload } from '../src/features/manual-quiz-workspace/services/quizEditorService';

describe('quizEditorService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads the unified editor contract through the registered API action', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      quiz: { id: 'quiz-a', revision: 4 },
      questions: [],
      editability: { mode: 'EDIT', canEditStructure: true, canCreateVersion: true, reason: null },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const payload = await getQuizEditorPayload('quiz a');

    expect(payload.quiz.id).toBe('quiz-a');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/quizzes/quiz%20a/editor'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('creates a new editable version through the dedicated endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: 'success',
      data: { id: 'quiz-v2', parentQuizId: 'quiz-a', versionNumber: 2, revision: 1 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const version = await createQuizVersion('quiz-a', 'Bản chỉnh sửa');

    expect(version.id).toBe('quiz-v2');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/quizzes/quiz-a/versions'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ quizId: 'quiz-a', title: 'Bản chỉnh sửa' }),
      }),
    );
  });
});
