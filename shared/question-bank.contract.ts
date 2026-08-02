export type QuestionBankScope = 'SYSTEM' | 'PERSONAL';
export type QuestionBankStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface QuestionBankMetadata {
  grade: number | null;
  subject: string;
  semester: number | null;
  topicCode: string;
  lessonCode: string;
  source: string;
  tags: string[];
}

export interface QuestionBankItem<TQuestion = unknown> {
  id: string;
  scope: QuestionBankScope;
  ownerId: string;
  status: QuestionBankStatus;
  questionData: TQuestion;
  questionText: string;
  questionType: string;
  difficulty: 1 | 2 | 3 | null;
  explanation: string;
  metadata: QuestionBankMetadata;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
}

export interface QuestionBankPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface QuestionBankListParams {
  scope?: QuestionBankScope | 'ALL';
  ownerId?: string;
  status?: QuestionBankStatus;
  page?: number;
  pageSize?: number;
  grade?: number;
  subject?: string;
  semester?: number;
  topicCode?: string;
  lessonCode?: string;
  difficulty?: 1 | 2 | 3;
  type?: string;
  search?: string;
}

export interface QuestionBankListResponse<TQuestion = unknown> {
  items: QuestionBankItem<TQuestion>[];
  pagination: QuestionBankPagination;
  appliedFilters: QuestionBankListParams;
}

export interface CreateQuestionBankItemInput<TQuestion = unknown> {
  id?: string;
  scope?: QuestionBankScope;
  status?: QuestionBankStatus;
  ownerId?: string;
  questionData: TQuestion;
  metadata?: Partial<QuestionBankMetadata>;
}

export interface PatchQuestionBankItemInput<TQuestion = unknown> {
  status?: QuestionBankStatus;
  questionData?: TQuestion;
  metadata?: Partial<QuestionBankMetadata>;
}

export type BulkQuestionBankItemResult =
  | { index: number; status: 'CREATED'; id: string }
  | { index: number; status: 'DUPLICATE'; existingId: string }
  | { index: number; status: 'INVALID'; errors: string[] };

export interface BulkImportResult {
  summary: {
    received: number;
    created: number;
    duplicates: number;
    invalid: number;
  };
  results: BulkQuestionBankItemResult[];
}

export interface QuestionBankApiError {
  error: {
    code:
      | 'VALIDATION_ERROR'
      | 'FORBIDDEN'
      | 'QUESTION_NOT_FOUND'
      | 'DUPLICATE_QUESTION'
      | 'IMPORT_LIMIT_EXCEEDED'
      | 'INTERNAL_ERROR';
    message: string;
    details?: unknown;
  };
}
