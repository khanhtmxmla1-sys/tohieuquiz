import { QuestionType } from '../../types';
import type { QuizBlueprintV3 } from '../../features/quiz-generator/domain/quizBlueprint';
import type { DiagramGenerationMode } from './question-contracts/questionContract.types';
import { sanitizeSvgDiagram } from '../../../shared/svgDiagramSanitizer';

export interface SvgProcessingSummary {
  requested: number;
  accepted: number;
  rejected: number;
  removedOptional: number;
  removedForbidden: number;
  maxSizeBytes: number;
  totalSizeBytes: number;
  durationMs: number;
}

export interface ProcessQuizSvgOptions {
  diagramMode: DiagramGenerationMode;
  blueprintV3?: QuizBlueprintV3;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const deleteSvgFields = (question: Record<string, unknown>): void => {
  delete question.svgContent;
  delete question.svgAlt;
  delete question.svgVersion;
};

const hasStructuredGeometry = (question: Record<string, unknown>): boolean => (
  isRecord(question.geometryData) && Object.keys(question.geometryData).length > 0
);

export function processGeneratedQuizSvg(
  rawQuiz: unknown,
  options: ProcessQuizSvgOptions,
): { quiz: unknown; summary: SvgProcessingSummary } {
  const startedAt = performance.now();
  const summary: SvgProcessingSummary = {
    requested: 0,
    accepted: 0,
    rejected: 0,
    removedOptional: 0,
    removedForbidden: 0,
    maxSizeBytes: 0,
    totalSizeBytes: 0,
    durationMs: 0,
  };

  if (!isRecord(rawQuiz) || !Array.isArray(rawQuiz.questions)) {
    summary.durationMs = performance.now() - startedAt;
    return { quiz: rawQuiz, summary };
  }

  const policyBySlot = new Map<string, 'forbidden' | 'optional' | 'required'>(
    options.blueprintV3?.slots.map((slot) => [slot.slotId, slot.diagramPolicy]) ?? [],
  );
  const questions = rawQuiz.questions.map((rawQuestion) => {
    if (!isRecord(rawQuestion)) return rawQuestion;
    const question = { ...rawQuestion };
    const slotPolicy = typeof question.slotId === 'string'
      ? policyBySlot.get(question.slotId)
      : undefined;
    const policy = slotPolicy
      ?? (options.diagramMode === 'off'
        ? 'forbidden'
        : String(question.type) === QuestionType.GEOMETRY ? 'required' : 'optional');
    const hasAnySvgField = question.svgContent !== undefined
      || question.svgAlt !== undefined
      || question.svgVersion !== undefined;

    if (policy === 'forbidden') {
      if (hasAnySvgField) {
        summary.removedForbidden += 1;
        console.info(JSON.stringify({
          event: 'ai_svg_removed_forbidden',
          questionType: String(question.type || 'UNKNOWN'),
        }));
      }
      deleteSvgFields(question);
      return question;
    }

    if (typeof question.svgContent !== 'string' || !question.svgContent.trim()) {
      if (hasAnySvgField) {
        summary.rejected += 1;
        if (policy === 'optional') summary.removedOptional += 1;
        deleteSvgFields(question);
      }
      return question;
    }

    summary.requested += 1;
    const result = sanitizeSvgDiagram(question.svgContent);
    summary.totalSizeBytes += result.sizeBytes;
    summary.maxSizeBytes = Math.max(summary.maxSizeBytes, result.sizeBytes);
    const rawSvgAlt = typeof question.svgAlt === 'string' ? question.svgAlt : '';
    const validMetadata = rawSvgAlt.trim().length > 0 && question.svgVersion === 1;

    if (!result.ok || !result.sanitizedSvg || !validMetadata) {
      summary.rejected += 1;
      if (policy === 'optional') summary.removedOptional += 1;
      console.info(JSON.stringify({
        event: 'ai_svg_rejected',
        questionType: String(question.type || 'UNKNOWN'),
        diagramPolicy: policy,
        issueCodes: validMetadata ? result.issues.map((issue) => issue.code) : ['INVALID_SVG_METADATA'],
        sizeBytes: result.sizeBytes,
      }));
      deleteSvgFields(question);
      return question;
    }

    question.svgContent = result.sanitizedSvg;
    question.svgAlt = rawSvgAlt.trim();
    question.svgVersion = 1;
    summary.accepted += 1;
    console.info(JSON.stringify({
      event: 'ai_svg_accepted',
      questionType: String(question.type || 'UNKNOWN'),
      diagramPolicy: policy,
      sizeBytes: result.sizeBytes,
      nodeCount: result.nodeCount,
    }));
    return question;
  });

  summary.durationMs = performance.now() - startedAt;
  if (summary.requested > 0 || summary.removedForbidden > 0) {
    console.info(JSON.stringify({
      event: 'ai_svg_processing_summary',
      ...summary,
      averageSizeBytes: summary.requested > 0
        ? Math.round(summary.totalSizeBytes / summary.requested)
        : 0,
    }));
  }

  return { quiz: { ...rawQuiz, questions }, summary };
}

export const questionSatisfiesRequiredDiagram = (question: Record<string, unknown>): boolean => (
  hasStructuredGeometry(question)
  || (typeof question.svgContent === 'string'
    && question.svgContent.trim().length > 0
    && typeof question.svgAlt === 'string'
    && question.svgAlt.trim().length > 0
    && question.svgVersion === 1)
);
