import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz, type StudentResult } from '../src/types';

const mocks = vi.hoisted(() => ({ instances: [] as any[] }));

vi.mock('jspdf', () => {
  class MockJsPdf {
    pageCount = 1;
    textCalls: string[] = [];
    savedNames: string[] = [];
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    constructor() { mocks.instances.push(this); }
    text(value: string | string[]) { this.textCalls.push(...(Array.isArray(value) ? value : [value])); }
    splitTextToSize(value: string) { return [String(value)]; }
    getNumberOfPages() { return this.pageCount; }
    addPage() { this.pageCount += 1; }
    save(name: string) { this.savedNames.push(name); }
    addFileToVFS() {} addFont() {} setFont() {} setFontSize() {} setTextColor() {}
    setDrawColor() {} setLineWidth() {} line() {} rect() {} roundedRect() {} setFillColor() {} setPage() {}
  }
  return { default: MockJsPdf };
});

vi.mock('../src/utils/pdfFonts', () => ({ setupUnicodeFont: vi.fn(), FONT_NAME: 'UnicodeFont' }));

import { exportResultToPDF } from '../src/services/pdfExportService';

describe('result PDF math export', () => {
  beforeEach(() => { mocks.instances.length = 0; });

  it('converts common LaTeX into readable math instead of exporting raw commands', async () => {
    const quiz: Quiz = {
      id: 'quiz-pdf-math',
      title: 'Kết quả Toán',
      classLevel: '5',
      category: 'toan',
      timeLimit: 20,
      createdAt: '2026-07-21T00:00:00.000Z',
      questions: [{
        id: 'q1',
        type: QuestionType.SHORT_ANSWER,
        question: 'Tính $\\frac{1}{2} + \\sqrt{9}$',
        correctAnswer: '$\\frac{7}{2}$',
      }],
    };
    const result: StudentResult = {
      id: 'result-pdf-math',
      quizId: quiz.id,
      quizTitle: quiz.title,
      studentName: 'An',
      studentClass: '5A',
      score: 0,
      correctCount: 0,
      totalQuestions: 1,
      timeTaken: 1,
      submittedAt: '2026-07-21T00:00:00.000Z',
      validationDetails: [{ questionId: 'q1', isCorrect: false }],
    };

    await exportResultToPDF({
      quiz,
      result,
      answers: { q1: '$\\frac{3}{2}$' },
      studentName: 'An',
      studentClass: '5A',
    });

    const exportedText = mocks.instances[0].textCalls.join('\n');
    expect(exportedText).toContain('Tính 1/2 + √9');
    expect(exportedText).toContain('3/2');
    expect(exportedText).toContain('7/2');
    expect(exportedText).not.toContain('\\frac');
    expect(exportedText).not.toContain('$');
  });
});
