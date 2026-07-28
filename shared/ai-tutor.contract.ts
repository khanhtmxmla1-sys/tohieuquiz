import { z } from 'zod';

export const AiTutorDiagnoseRequestSchema = z.object({
  resultId: z.string().trim().min(1).max(128),
}).strict();

const AiTutorQuestionFields = z.object({
  question: z.string().trim().min(1).max(600),
  options: z.array(z.string().trim().min(1).max(300)).length(4),
  correctAnswer: z.string().trim().min(1).max(300),
}).strict();

const validateCorrectAnswer = (
  value: { options: string[]; correctAnswer: string },
  context: z.RefinementCtx,
) => {
  if (!value.options.includes(value.correctAnswer)) {
    context.addIssue({
      code: 'custom',
      path: ['correctAnswer'],
      message: 'correctAnswer must exactly match one of the four options',
    });
  }
};

export const AiTutorProviderPracticeQuestionSchema = AiTutorQuestionFields.superRefine(validateCorrectAnswer);

export const AiTutorPracticeQuestionSchema = AiTutorQuestionFields.extend({
  id: z.string().trim().min(1).max(160),
}).superRefine(validateCorrectAnswer);

export const AiTutorProviderOutputSchema = z.object({
  diagnosis: z.string().trim().min(1).max(500),
  explanation: z.string().trim().max(1500).optional().default(''),
  practiceQuestions: z.array(AiTutorProviderPracticeQuestionSchema).min(2).max(3),
}).strict();

export const AiTutorDiagnosisSchema = z.object({
  diagnosis: z.string().trim().min(1).max(500),
  explanation: z.string().trim().max(1500),
  practiceQuestions: z.array(AiTutorPracticeQuestionSchema).min(2).max(3),
  wrongQuestionCount: z.number().int().min(1).max(3),
}).strict();

export type AiTutorDiagnoseRequest = z.infer<typeof AiTutorDiagnoseRequestSchema>;
export type AiTutorDiagnosis = z.infer<typeof AiTutorDiagnosisSchema>;
export type AiTutorProviderOutput = z.infer<typeof AiTutorProviderOutputSchema>;
