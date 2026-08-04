import { describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import { auditGeneratedQuizV3 } from '../src/services/ai/quizAudit';
import { processGeneratedQuizSvg } from '../src/services/ai/svgDiagramProcessing';
import {
  makeBlueprintV3Fixture,
  makeGeneratedQuizV3Fixture,
} from './helpers/aiBlueprintV3Fixtures';

const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="25" /></svg>';
const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"></svg>';

describe('generated quiz SVG processing', () => {
  it('removes an invalid optional SVG without dropping the question', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const raw = {
      title: 'Đề optional',
      questions: [{
        type: QuestionType.MCQ,
        question: 'Câu vẫn trả lời được không cần hình',
        options: ['A', 'B'],
        correctAnswer: 'A',
        difficultyLevel: 1,
        svgContent: maliciousSvg,
        svgAlt: 'Hình lỗi',
        svgVersion: 1,
      }],
    };

    const result = processGeneratedQuizSvg(raw, { diagramMode: 'auto' });
    const quiz = result.quiz as typeof raw;
    expect(quiz.questions).toHaveLength(1);
    expect(quiz.questions[0]).not.toHaveProperty('svgContent');
    expect(result.summary).toMatchObject({ rejected: 1, removedOptional: 1 });
  });

  it('strips SVG fields when diagram mode is off', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const raw = {
      title: 'Đề off',
      questions: [{
        type: QuestionType.MCQ,
        svgContent: validSvg,
        svgAlt: 'Một đường tròn',
        svgVersion: 1,
      }],
    };
    const result = processGeneratedQuizSvg(raw, { diagramMode: 'off' });
    expect((result.quiz as typeof raw).questions[0]).not.toHaveProperty('svgContent');
    expect(result.summary.removedForbidden).toBe(1);
  });

  it('accepts and normalizes a valid SVG with complete metadata', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const raw = {
      title: 'Đề hợp lệ',
      questions: [{
        type: QuestionType.MCQ,
        svgContent: validSvg,
        svgAlt: '  Một đường tròn  ',
        svgVersion: 1,
      }],
    };
    const result = processGeneratedQuizSvg(raw, { diagramMode: 'auto' });
    const question = (result.quiz as typeof raw).questions[0];
    expect(question.svgContent).toContain('<svg');
    expect(question.svgAlt).toBe('Một đường tròn');
    expect(result.summary.accepted).toBe(1);
  });

  it('marks a required slot repairable after invalid SVG is removed', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const baseBlueprint = makeBlueprintV3Fixture();
    const slots = baseBlueprint.slots.map((slot, index) => index === 0
      ? { ...slot, diagramPolicy: 'required' as const }
      : slot);
    const blueprint = { ...baseBlueprint, slots };
    const quiz = makeGeneratedQuizV3Fixture(blueprint);
    quiz.questions[0] = {
      ...quiz.questions[0],
      svgContent: maliciousSvg,
      svgAlt: 'Hình bắt buộc nhưng lỗi',
      svgVersion: 1,
    };

    const processed = processGeneratedQuizSvg(quiz, {
      diagramMode: 'auto',
      blueprintV3: blueprint,
    }).quiz as typeof quiz;
    expect(processed.questions[0]).not.toHaveProperty('svgContent');
    expect(auditGeneratedQuizV3(processed, blueprint)).toContainEqual(expect.objectContaining({
      code: 'DIAGRAM_POLICY_VIOLATION',
      slotIds: [blueprint.slots[0].slotId],
      repairable: true,
    }));
  });
});
