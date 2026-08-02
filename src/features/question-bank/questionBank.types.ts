import type {
  BulkImportResult as SharedBulkImportResult,
  CreateQuestionBankItemInput as SharedCreateQuestionBankItemInput,
  PatchQuestionBankItemInput as SharedPatchQuestionBankItemInput,
  QuestionBankItem as SharedQuestionBankItem,
  QuestionBankListParams as SharedQuestionBankListParams,
  QuestionBankListResponse as SharedQuestionBankListResponse,
  QuestionBankMetadata,
  QuestionBankPagination,
  QuestionBankScope,
  QuestionBankStatus,
} from '../../../shared/question-bank.contract';
import type { Question, QuestionType } from '../../types';

export type {
  QuestionBankMetadata,
  QuestionBankPagination,
  QuestionBankScope,
  QuestionBankStatus,
};

export type QuestionBankItem = SharedQuestionBankItem<Question>;
export type QuestionBankListResponse = SharedQuestionBankListResponse<Question>;
export type CreateQuestionBankItemInput = SharedCreateQuestionBankItemInput<Question>;
export type PatchQuestionBankItemInput = SharedPatchQuestionBankItemInput<Question>;
export type BulkImportResult = SharedBulkImportResult;

export interface QuestionBankListParams extends Omit<SharedQuestionBankListParams, 'type'> {
  type?: QuestionType | string;
}

export interface QuestionBankFilters {
  scope: QuestionBankScope;
  search: string;
  grade?: number;
  subject?: string;
  semester?: number;
  topicCode?: string;
  lessonCode?: string;
  type?: QuestionType;
  difficulty?: 1 | 2 | 3;
  status?: QuestionBankStatus;
  page: number;
  pageSize: number;
}
