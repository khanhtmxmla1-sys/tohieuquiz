export interface QuestionBankCatalogOption {
  code: string;
  label: string;
}

export const QUESTION_BANK_TOPIC_OPTIONS: QuestionBankCatalogOption[] = Array.from(
  { length: 6 },
  (_, index) => ({
    code: `M5-S1-T${String(index + 1).padStart(2, '0')}`,
    label: `Chủ đề ${index + 1}`,
  }),
);

export const QUESTION_BANK_LESSON_OPTIONS: QuestionBankCatalogOption[] = Array.from(
  { length: 35 },
  (_, index) => ({
    code: `M5-S1-L${String(index + 1).padStart(2, '0')}`,
    label: `Bài ${index + 1}`,
  }),
);
