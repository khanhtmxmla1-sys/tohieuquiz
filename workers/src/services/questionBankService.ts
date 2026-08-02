import type {
  BulkImportResult,
  CreateQuestionBankItemInput,
  PatchQuestionBankItemInput,
  QuestionBankItem,
  QuestionBankMetadata,
  QuestionBankScope,
  QuestionBankStatus,
} from '../../../shared/question-bank.contract';
import { validateQuestion } from '../../../schemas/quiz.schema';
import { hashQuestionData } from './questionBankContent';
import {
  findQuestionBankDuplicate,
  getQuestionBankStoredItem,
  prepareArchiveQuestionBankItem,
  prepareDeleteLegacyTestBankItem,
  prepareDeletePersonalQuestionBankItem,
  prepareInsertQuestionBankItem,
  preparePatchQuestionBankItem,
  prepareQuestionBankAudit,
  prepareUpsertLegacyTestBankItem,
  type QuestionBankActor,
  type QuestionBankAuditWrite,
  type QuestionBankStoredItem,
  type QuestionBankWriteRecord,
} from './questionBankRepository';

export class QuestionBankServiceError extends Error {
  constructor(
    public readonly code:
      | 'VALIDATION_ERROR'
      | 'FORBIDDEN'
      | 'QUESTION_NOT_FOUND'
      | 'DUPLICATE_QUESTION'
      | 'IMPORT_LIMIT_EXCEEDED'
      | 'INTERNAL_ERROR',
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'QuestionBankServiceError';
  }
}

const fail = (
  code: QuestionBankServiceError['code'],
  status: number,
  message: string,
  details?: unknown,
): never => {
  throw new QuestionBankServiceError(code, status, message, details);
};

const nowIso = (): string => new Date().toISOString();
const createId = (prefix: 'qb' | 'qba'): string => `${prefix}_${crypto.randomUUID()}`;

const normalizeTags = (value: unknown): string[] => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean))];
};

const finiteIntegerOrNull = (
  value: unknown,
  allowed: readonly number[] | null,
  field: string,
): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || (allowed && !allowed.includes(parsed))) {
    return fail('VALIDATION_ERROR', 422, `${field} không hợp lệ.`, { field });
  }
  return parsed;
};

const normalizeMetadata = (
  question: Record<string, unknown>,
  input: Partial<QuestionBankMetadata> | undefined,
  fallback?: QuestionBankMetadata,
): QuestionBankMetadata => ({
  grade: finiteIntegerOrNull(input?.grade ?? fallback?.grade, null, 'grade'),
  subject: String(input?.subject ?? fallback?.subject ?? question.subject ?? '').trim().toUpperCase().slice(0, 64),
  semester: finiteIntegerOrNull(input?.semester ?? fallback?.semester, [1, 2], 'semester'),
  topicCode: String(input?.topicCode ?? fallback?.topicCode ?? '').trim().slice(0, 64),
  lessonCode: String(input?.lessonCode ?? fallback?.lessonCode ?? '').trim().slice(0, 64),
  source: String(input?.source ?? fallback?.source ?? 'MANUAL').trim().toUpperCase().slice(0, 64) || 'MANUAL',
  tags: normalizeTags(input?.tags ?? fallback?.tags ?? question.tags),
});

const validateAndNormalizeQuestion = (questionData: unknown) => {
  const parsed = validateQuestion(questionData);
  if (!parsed.success) {
    return fail(
      'VALIDATION_ERROR',
      422,
      'Dữ liệu câu hỏi không hợp lệ.',
      parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    );
  }
  const question = parsed.data as unknown as Record<string, unknown>;
  const questionText = String(question.question ?? question.mainQuestion ?? '').trim();
  return {
    question,
    questionText,
    questionType: String(question.type || ''),
    difficulty: question.difficulty === 1 || question.difficulty === 2 || question.difficulty === 3
      ? question.difficulty
      : null,
    explanation: String(question.explanation || '').trim(),
  } as const;
};

const publicItem = (item: QuestionBankWriteRecord | QuestionBankStoredItem): QuestionBankItem => ({
  id: item.id,
  scope: item.scope,
  ownerId: item.ownerId,
  status: item.status,
  questionData: item.questionData,
  questionText: item.questionText,
  questionType: item.questionType,
  difficulty: item.difficulty,
  explanation: item.explanation,
  metadata: item.metadata,
  createdBy: item.createdBy,
  updatedBy: item.updatedBy,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  publishedAt: item.publishedAt,
  archivedAt: item.archivedAt,
});

const auditRecord = (
  actor: QuestionBankActor,
  itemId: string,
  action: QuestionBankAuditWrite['action'],
  before: QuestionBankItem | null,
  after: QuestionBankItem | null,
  createdAt: string,
): QuestionBankAuditWrite => ({
  id: createId('qba'),
  itemId,
  action,
  actorId: actor.username,
  actorRole: actor.role,
  beforeJson: before ? JSON.stringify(before) : null,
  afterJson: after ? JSON.stringify(after) : null,
  createdAt,
});

const mapDatabaseError = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error);
  if (/unique|idx_question_bank_unique_content/i.test(message)) {
    return fail('DUPLICATE_QUESTION', 409, 'Câu hỏi đã tồn tại trong phạm vi này.');
  }
  throw error;
};

export const createQuestionBankItem = async (
  db: D1Database,
  actor: QuestionBankActor,
  input: CreateQuestionBankItemInput,
): Promise<QuestionBankItem> => {
  const scope: QuestionBankScope = input.scope || 'PERSONAL';
  if (scope === 'SYSTEM' && actor.role !== 'admin') {
    return fail('FORBIDDEN', 403, 'Chỉ quản trị viên được tạo câu hỏi hệ thống.');
  }

  const normalized = validateAndNormalizeQuestion(input.questionData);
  const metadata = normalizeMetadata(normalized.question, input.metadata);
  if (scope === 'SYSTEM' && !metadata.subject) {
    return fail('VALIDATION_ERROR', 422, 'Câu hỏi hệ thống phải có môn học.', { field: 'subject' });
  }

  const ownerId = scope === 'SYSTEM'
    ? ''
    : actor.role === 'admin' && input.ownerId?.trim()
      ? input.ownerId.trim().slice(0, 128)
      : actor.username;
  const status: QuestionBankStatus = scope === 'SYSTEM'
    ? input.status || 'DRAFT'
    : 'PUBLISHED';
  const timestamp = nowIso();
  const contentHash = await hashQuestionData(normalized.question);
  const duplicateId = await findQuestionBankDuplicate(db, scope, ownerId, contentHash);
  if (duplicateId) {
    return fail(
      'DUPLICATE_QUESTION',
      409,
      'Câu hỏi đã tồn tại trong phạm vi này.',
      { existingId: duplicateId },
    );
  }

  const item: QuestionBankWriteRecord = {
    id: String(input.id || createId('qb')).trim().slice(0, 160),
    scope,
    ownerId,
    status,
    questionData: normalized.question,
    questionText: normalized.questionText,
    questionType: normalized.questionType,
    difficulty: normalized.difficulty,
    explanation: normalized.explanation,
    metadata,
    contentHash,
    createdBy: actor.username,
    updatedBy: actor.username,
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: status === 'PUBLISHED' ? timestamp : null,
    archivedAt: status === 'ARCHIVED' ? timestamp : null,
  };
  if (!item.id) return fail('VALIDATION_ERROR', 422, 'ID câu hỏi không hợp lệ.', { field: 'id' });

  try {
    if (scope === 'SYSTEM') {
      const visible = publicItem(item);
      await db.batch([
        prepareInsertQuestionBankItem(db, item),
        prepareQuestionBankAudit(db, auditRecord(actor, item.id, 'CREATE', null, visible, timestamp)),
      ]);
    } else {
      await db.batch([
        prepareInsertQuestionBankItem(db, item),
        prepareUpsertLegacyTestBankItem(db, item),
      ]);
    }
  } catch (error) {
    return mapDatabaseError(error);
  }

  return publicItem(item);
};

const mutationAction = (
  before: QuestionBankStatus,
  after: QuestionBankStatus,
): QuestionBankAuditWrite['action'] => {
  if (before !== 'PUBLISHED' && after === 'PUBLISHED') return 'PUBLISH';
  if (after === 'ARCHIVED') return 'ARCHIVE';
  if (before === 'ARCHIVED') return 'RESTORE';
  return 'UPDATE';
};

export const updateQuestionBankItem = async (
  db: D1Database,
  actor: QuestionBankActor,
  id: string,
  input: PatchQuestionBankItemInput,
): Promise<QuestionBankItem> => {
  const existing = await getQuestionBankStoredItem(db, id);
  if (!existing) return fail('QUESTION_NOT_FOUND', 404, 'Không tìm thấy câu hỏi.');
  if (existing.scope === 'SYSTEM' && actor.role !== 'admin') {
    return fail('FORBIDDEN', 403, 'Không có quyền sửa câu hỏi hệ thống.');
  }
  if (existing.scope === 'PERSONAL' && actor.role !== 'admin' && existing.ownerId !== actor.username) {
    return fail('FORBIDDEN', 403, 'Không có quyền sửa câu hỏi này.');
  }

  const nextQuestionData = input.questionData ?? existing.questionData;
  const normalized = validateAndNormalizeQuestion(nextQuestionData);
  const metadata = normalizeMetadata(normalized.question, input.metadata, existing.metadata);
  const status = input.status ?? existing.status;
  if (existing.scope === 'PERSONAL' && actor.role !== 'admin' && status !== 'PUBLISHED') {
    return fail('FORBIDDEN', 403, 'Giáo viên không được đổi trạng thái kho cá nhân.');
  }
  const timestamp = nowIso();
  const contentHash = await hashQuestionData(normalized.question);
  const duplicateId = await findQuestionBankDuplicate(
    db,
    existing.scope,
    existing.ownerId,
    contentHash,
    existing.id,
  );
  if (duplicateId) {
    return fail('DUPLICATE_QUESTION', 409, 'Câu hỏi đã tồn tại trong phạm vi này.', { existingId: duplicateId });
  }

  const item: QuestionBankWriteRecord = {
    ...existing,
    status,
    questionData: normalized.question,
    questionText: normalized.questionText,
    questionType: normalized.questionType,
    difficulty: normalized.difficulty,
    explanation: normalized.explanation,
    metadata,
    contentHash,
    updatedBy: actor.username,
    updatedAt: timestamp,
    publishedAt: status === 'PUBLISHED'
      ? existing.publishedAt || timestamp
      : existing.publishedAt,
    archivedAt: status === 'ARCHIVED' ? timestamp : null,
  };

  try {
    if (item.scope === 'SYSTEM') {
      await db.batch([
        preparePatchQuestionBankItem(db, item),
        prepareQuestionBankAudit(db, auditRecord(
          actor,
          item.id,
          mutationAction(existing.status, status),
          publicItem(existing),
          publicItem(item),
          timestamp,
        )),
      ]);
    } else {
      await db.batch([
        preparePatchQuestionBankItem(db, item),
        prepareUpsertLegacyTestBankItem(db, item),
      ]);
    }
  } catch (error) {
    return mapDatabaseError(error);
  }
  return publicItem(item);
};

export const removeQuestionBankItem = async (
  db: D1Database,
  actor: QuestionBankActor,
  id: string,
): Promise<{ status: 'success' }> => {
  const existing = await getQuestionBankStoredItem(db, id);
  if (!existing) return { status: 'success' };

  if (existing.scope === 'SYSTEM') {
    if (actor.role !== 'admin') return fail('FORBIDDEN', 403, 'Không có quyền lưu trữ câu hỏi hệ thống.');
    if (existing.status === 'ARCHIVED') return { status: 'success' };
    const timestamp = nowIso();
    const after = publicItem({
      ...existing,
      status: 'ARCHIVED',
      archivedAt: timestamp,
      updatedAt: timestamp,
      updatedBy: actor.username,
    });
    await db.batch([
      prepareArchiveQuestionBankItem(db, existing.id, actor.username, timestamp),
      prepareQuestionBankAudit(db, auditRecord(
        actor,
        existing.id,
        'ARCHIVE',
        publicItem(existing),
        after,
        timestamp,
      )),
    ]);
    return { status: 'success' };
  }

  if (actor.role !== 'admin' && existing.ownerId !== actor.username) {
    return fail('FORBIDDEN', 403, 'Không có quyền xóa câu hỏi này.');
  }
  await db.batch([
    prepareDeletePersonalQuestionBankItem(db, existing.id),
    prepareDeleteLegacyTestBankItem(db, existing.id),
  ]);
  return { status: 'success' };
};

export const copySystemQuestionToPersonal = async (
  db: D1Database,
  actor: QuestionBankActor,
  id: string,
): Promise<QuestionBankItem> => {
  const source = await getQuestionBankStoredItem(db, id);
  if (!source || source.scope !== 'SYSTEM' || source.status !== 'PUBLISHED') {
    return fail('QUESTION_NOT_FOUND', 404, 'Không tìm thấy câu hỏi hệ thống đã phát hành.');
  }
  return createQuestionBankItem(db, actor, {
    scope: 'PERSONAL',
    questionData: source.questionData,
    metadata: {
      ...source.metadata,
      tags: [...new Set([...source.metadata.tags, 'Sao chép từ kho hệ thống'])],
    },
  });
};

export const bulkImportSystemItems = async (
  db: D1Database,
  actor: QuestionBankActor,
  inputs: CreateQuestionBankItemInput[],
): Promise<BulkImportResult> => {
  if (actor.role !== 'admin') {
    return fail('FORBIDDEN', 403, 'Chỉ quản trị viên được nhập câu hỏi hệ thống.');
  }
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return fail('VALIDATION_ERROR', 422, 'Danh sách nhập phải có ít nhất một câu hỏi.');
  }
  if (inputs.length > 100) {
    return fail('IMPORT_LIMIT_EXCEEDED', 413, 'Mỗi lần chỉ được nhập tối đa 100 câu hỏi.');
  }

  const results: BulkImportResult['results'] = [];
  const created: Array<{ index: number; item: QuestionBankWriteRecord }> = [];
  const incomingHashes = new Map<string, string>();

  for (const [index, input] of inputs.entries()) {
    try {
      const normalized = validateAndNormalizeQuestion(input.questionData);
      const metadata = normalizeMetadata(normalized.question, input.metadata);
      if (!metadata.subject) {
        fail('VALIDATION_ERROR', 422, 'Câu hỏi hệ thống phải có môn học.', { field: 'subject' });
      }
      const contentHash = await hashQuestionData(normalized.question);
      const incomingId = incomingHashes.get(contentHash);
      if (incomingId) {
        results.push({ index, status: 'DUPLICATE', existingId: incomingId });
        continue;
      }
      const existingId = await findQuestionBankDuplicate(db, 'SYSTEM', '', contentHash);
      if (existingId) {
        results.push({ index, status: 'DUPLICATE', existingId });
        continue;
      }

      const timestamp = nowIso();
      const status: QuestionBankStatus = input.status || 'DRAFT';
      const item: QuestionBankWriteRecord = {
        id: String(input.id || createId('qb')).trim().slice(0, 160),
        scope: 'SYSTEM',
        ownerId: '',
        status,
        questionData: normalized.question,
        questionText: normalized.questionText,
        questionType: normalized.questionType,
        difficulty: normalized.difficulty,
        explanation: normalized.explanation,
        metadata,
        contentHash,
        createdBy: actor.username,
        updatedBy: actor.username,
        createdAt: timestamp,
        updatedAt: timestamp,
        publishedAt: status === 'PUBLISHED' ? timestamp : null,
        archivedAt: status === 'ARCHIVED' ? timestamp : null,
      };
      if (!item.id) fail('VALIDATION_ERROR', 422, 'ID câu hỏi không hợp lệ.', { field: 'id' });
      incomingHashes.set(contentHash, item.id);
      created.push({ index, item });
      results.push({ index, status: 'CREATED', id: item.id });
    } catch (error) {
      if (error instanceof QuestionBankServiceError && error.code === 'VALIDATION_ERROR') {
        const errors = Array.isArray(error.details)
          ? error.details.map((detail) => typeof detail === 'object' && detail && 'message' in detail
            ? String((detail as { message: unknown }).message)
            : String(detail))
          : [error.message];
        results.push({ index, status: 'INVALID', errors });
        continue;
      }
      throw error;
    }
  }

  for (let offset = 0; offset < created.length; offset += 25) {
    const chunk = created.slice(offset, offset + 25);
    const statements: D1PreparedStatement[] = [];
    for (const { item } of chunk) {
      const visible = publicItem(item);
      statements.push(
        prepareInsertQuestionBankItem(db, item),
        prepareQuestionBankAudit(db, auditRecord(
          actor,
          item.id,
          'BULK_IMPORT',
          null,
          visible,
          item.createdAt,
        )),
      );
    }
    if (statements.length > 0) await db.batch(statements);
  }

  results.sort((left, right) => left.index - right.index);
  return {
    summary: {
      received: inputs.length,
      created: results.filter((result) => result.status === 'CREATED').length,
      duplicates: results.filter((result) => result.status === 'DUPLICATE').length,
      invalid: results.filter((result) => result.status === 'INVALID').length,
    },
    results,
  };
};
