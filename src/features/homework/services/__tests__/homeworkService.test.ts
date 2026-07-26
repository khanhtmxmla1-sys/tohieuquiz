import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestAiSuggestion, performOCR } = vi.hoisted(() => ({
  requestAiSuggestion: vi.fn(),
  performOCR: vi.fn(),
}));

vi.mock('../homeworkBackendService', () => ({
  homeworkBackendService: { requestAiSuggestion, performOCR },
}));

import { homeworkService } from '../homeworkService';

describe('homeworkService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes AI grading through the authenticated Worker', async () => {
    requestAiSuggestion.mockResolvedValue({
      ocrText: 'Bài làm của học sinh', score: 8.5, confidence: 0.95, feedback: 'Làm tốt lắm!',
      criteriaBreakdown: [{ label: 'Trình bày', score: 2, maxScore: 2, comment: 'Sạch sẽ' }],
    });
    const result = await homeworkService.gradeSubmission('submission-1');
    expect(requestAiSuggestion).toHaveBeenCalledWith('submission-1');
    expect(result.score).toBe(8.5);
  });

  it('propagates Worker validation failures without publishing a grade', async () => {
    requestAiSuggestion.mockRejectedValue(new Error('AI response failed validation'));
    await expect(homeworkService.gradeSubmission('submission-1')).rejects.toThrow('validation');
  });

  it('routes OCR through the Worker without a browser token', async () => {
    performOCR.mockResolvedValue('Nội dung đề');
    await expect(homeworkService.performOCR('https://res.cloudinary.com/example/image.png')).resolves.toBe('Nội dung đề');
  });
});
