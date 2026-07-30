import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Question } from '../src/types';

const apiConfigMocks = vi.hoisted(() => ({
  getWorkersApiBaseUrl: vi.fn(() => ''),
}));

vi.mock('../src/services/api/config', () => ({
  getWorkersApiBaseUrl: apiConfigMocks.getWorkersApiBaseUrl,
}));

import { testBankService } from '../src/services/testBankService';

const fetchMock = vi.fn();

const question: Question = {
  id: 'question-1',
  type: QuestionType.MCQ,
  question: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: 'B',
  difficulty: 1,
  subject: 'toan',
};

beforeEach(() => {
  vi.clearAllMocks();
  apiConfigMocks.getWorkersApiBaseUrl.mockReturnValue('');
  vi.stubGlobal('fetch', fetchMock);
});

describe('testBankService', () => {
  it('loads a teacher-owned bank through the same-origin API with cookie credentials', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(testBankService.getTestBank('teacher/a')).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith('/api/test-bank/teacher/teacher%2Fa', {
      credentials: 'include',
    });
  });

  it('uses the configured Workers API for authenticated writes and encodes identifiers', async () => {
    apiConfigMocks.getWorkersApiBaseUrl.mockReturnValue('https://api.test');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'stored-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    await expect(testBankService.saveQuestion('teacher/a', question, ['math']))
      .resolves.toBe('stored-id');

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.test/api/test-bank', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      teacher_id: 'teacher/a',
      question_data: question,
      tags: ['math'],
    });

    await expect(testBankService.deleteQuestion('item/1')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.test/api/test-bank/item%2F1', {
      method: 'DELETE',
      credentials: 'include',
    });
  });
});
