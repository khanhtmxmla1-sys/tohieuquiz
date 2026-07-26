import type { Quiz, StudentResult } from '../../../types';
import type { PhieuNhanXet, PhieuPublicLink } from '../../../features/homework/types/phieu.types';

export interface ResultsTabProps {
  results: StudentResult[];
  quizzes: Quiz[];
  onRefresh?: () => Promise<StudentResult[]>;
}

export interface ResultDisplayOverride {
  correctCount: number;
  totalQuestions: number;
  score: number;
}

export interface PhieuCacheEntry {
  savedPhieu: PhieuNhanXet | null;
  publishedLink: PhieuPublicLink | null;
}

export type PhieuCache = Record<string, PhieuCacheEntry>;
