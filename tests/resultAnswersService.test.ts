import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callApi } from '../src/services/apiAdapter';
import {
    fetchResultAnswerReview,
    fetchResultAnswers,
    fetchResultAnswersBulk,
} from '../src/services/results/resultAnswersService';

vi.mock('../src/services/apiAdapter', () => ({
    callApi: vi.fn(),
}));

const callApiMock = vi.mocked(callApi);

describe('result answer retrieval contracts', () => {
    beforeEach(() => {
        callApiMock.mockReset();
    });

    it('normalizes legacy array answers into a question-id map', async () => {
        callApiMock.mockResolvedValueOnce({
            answers: JSON.stringify([
                { questionId: 'q1', selectedAnswer: 'A' },
                { questionId: 'q2', selectedAnswer: 'B' },
                { selectedAnswer: 'ignored' },
            ]),
        });

        await expect(fetchResultAnswers('result-1')).resolves.toEqual({
            q1: { questionId: 'q1', selectedAnswer: 'A' },
            q2: { questionId: 'q2', selectedAnswer: 'B' },
        });
        expect(callApiMock).toHaveBeenCalledWith('get_result_answers', {
            resultId: 'result-1',
        });
    });

    it('returns server-owned review details together with stored answers', async () => {
        const reviewDetails = [{
            questionId: 'q1',
            type: 'DRAG_DROP',
            status: 'skipped',
            isCorrect: false,
            studentAnswer: { kind: 'empty', lines: [{ value: 'Chưa trả lời' }] },
            correctAnswer: { kind: 'mapping', lines: [{ label: 'Chỗ trống 1', value: '24' }] },
        }];
        callApiMock.mockResolvedValueOnce({
            answers: JSON.stringify({ q1: { selectedAnswer: null, status: 'skipped' } }),
            reviewDetails,
        });

        await expect(fetchResultAnswerReview('result-review')).resolves.toEqual({
            answers: { q1: { selectedAnswer: null, status: 'skipped' } },
            reviewDetails,
        });
    });
    it('returns canonical result metadata for direct-link detail hydration', async () => {
        callApiMock.mockResolvedValueOnce({
            answers: JSON.stringify({ q1: { selectedAnswer: 'B', isCorrect: false } }),
            reviewDetails: [],
            result: {
                id: 'result-detail',
                quizId: 'quiz-1',
                studentName: 'Bình',
                studentClass: '4A',
                score: 5,
                correctCount: 1,
                totalQuestions: 2,
                timeTaken: 120,
                submittedAt: '2026-08-10T10:00:00.000Z',
                answers: { q1: { selectedAnswer: 'B', isCorrect: false } },
            },
        });

        await expect(fetchResultAnswerReview('result-detail')).resolves.toMatchObject({
            result: {
                id: 'result-detail',
                studentName: 'Bình',
                answers: { q1: { selectedAnswer: 'B', isCorrect: false } },
            },
        });
    });

    it('preserves object answers and returns an empty map for invalid JSON', async () => {
        callApiMock
            .mockResolvedValueOnce({ answers: '{"q1":{"selectedAnswer":"C"}}' })
            .mockResolvedValueOnce({ answers: 'invalid-json' });
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(fetchResultAnswers(42)).resolves.toEqual({
            q1: { selectedAnswer: 'C' },
        });
        await expect(fetchResultAnswers(43)).resolves.toEqual({});

        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });

    it('deduplicates IDs and loads bulk answers in batches of 200', async () => {
        const ids = [
            ...Array.from({ length: 401 }, (_, index) => `result-${index + 1}`),
            'result-1',
            '',
        ];

        callApiMock.mockImplementation(async (action, payload: any) => {
            expect(action).toBe('get_result_answers_bulk');
            return {
                data: Object.fromEntries(
                    payload.resultIds.map((resultId: string, index: number) => [
                        resultId,
                        index % 2 === 0
                            ? JSON.stringify([{ questionId: 'q1', selectedAnswer: resultId }])
                            : { q1: { selectedAnswer: resultId } },
                    ])
                ),
            };
        });

        const result = await fetchResultAnswersBulk(ids);
        const payloads = callApiMock.mock.calls.map(([, payload]) => payload as { resultIds: string[] });

        expect(payloads.map(({ resultIds }) => resultIds.length)).toEqual([200, 200, 1]);
        expect(payloads.flatMap(({ resultIds }) => resultIds)).toHaveLength(401);
        expect(result['result-1']).toEqual({
            q1: { questionId: 'q1', selectedAnswer: 'result-1' },
        });
        expect(result['result-2']).toEqual({
            q1: { selectedAnswer: 'result-2' },
        });
    });

    it('rethrows single-result transport failures so detail screens can show a real error state', async () => {
        callApiMock.mockRejectedValueOnce(new Error('network unavailable'));

        await expect(fetchResultAnswerReview('result-1')).rejects.toThrow('network unavailable');
    });

    it('rethrows bulk transport failures so the caller can display an error state', async () => {
        callApiMock.mockRejectedValueOnce(new Error('network unavailable'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(fetchResultAnswersBulk(['result-1'])).rejects.toThrow('network unavailable');

        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });
});
