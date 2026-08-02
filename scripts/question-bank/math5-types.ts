import type { Question } from '../../src/types';

export interface Math5CurriculumLesson {
  code: string;
  number: number;
  title: string;
  page: number | null;
  keywords: string[];
  interactionTypes: string[];
}

export interface Math5CurriculumTopic {
  code: string;
  order: number;
  title: string;
  lessons: Math5CurriculumLesson[];
}

export interface Math5Curriculum {
  schemaVersion: number;
  grade: 5;
  subject: 'MATH';
  semester: 1;
  bookSeries: string;
  source: string;
  sourceCheckedAt: string;
  topics: Math5CurriculumTopic[];
}

export type Math5SlotRole =
  | 'MCQ cơ bản'
  | 'Trả lời ngắn'
  | 'Đúng sai'
  | 'Tương tác'
  | 'Vận dụng';

export interface CuratedQuestionBankInput {
  id: string;
  scope: 'SYSTEM';
  status: 'DRAFT';
  questionData: Question;
  metadata: {
    grade: 5;
    subject: 'MATH';
    semester: 1;
    topicCode: string;
    lessonCode: string;
    source: 'CURATED_ORIGINAL';
    tags: string[];
  };
}

export interface GeneratedMath5Topic {
  code: string;
  title: string;
  items: CuratedQuestionBankInput[];
}

export interface GeneratedMath5Dataset {
  curriculum: Math5Curriculum;
  topics: GeneratedMath5Topic[];
  items: CuratedQuestionBankInput[];
}
