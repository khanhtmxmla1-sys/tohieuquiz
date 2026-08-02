import type {
  QuestionBankItem,
  QuestionBankListParams,
  QuestionBankListResponse,
  QuestionBankMetadata,
  QuestionBankScope,
  QuestionBankStatus,
} from '../../../shared/question-bank.contract';

export interface QuestionBankActor {
  username: string;
  role: 'teacher' | 'admin';
}

export interface NormalizedQuestionBankListParams extends QuestionBankListParams {
  scope: QuestionBankScope | 'ALL';
  page: number;
  pageSize: number;
}

export interface QuestionBankWriteRecord<TQuestion = unknown> {
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
  contentHash: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
}

export interface QuestionBankStoredItem<TQuestion = unknown>
  extends QuestionBankItem<TQuestion> {
  contentHash: string;
}

interface QuestionBankRow {
  id: string;
  scope: QuestionBankScope;
  owner_id: string;
  status: QuestionBankStatus;
  question_data: string;
  question_text: string;
  question_type: string;
  difficulty: number | null;
  explanation: string;
  grade: number | null;
  subject: string;
  semester: number | null;
  topic_code: string;
  lesson_code: string;
  source: string;
  tags: string;
  content_hash: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
}

const SCOPES = new Set(['SYSTEM', 'PERSONAL', 'ALL']);
const STATUSES = new Set<QuestionBankStatus>(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const MAX_SEARCH_LENGTH = 120;

const fail = (code: 'VALIDATION_ERROR' | 'FORBIDDEN'): never => {
  throw new Error(code);
};

const parsePositiveInteger = (
  raw: string | null,
  name: string,
  allowed?: readonly number[],
): number | undefined => {
  if (raw === null || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || (allowed && !allowed.includes(value))) {
    return fail('VALIDATION_ERROR');
  }
  return value;
};

const boundedString = (value: string | null, maxLength: number): string | undefined => {
  const normalized = String(value || '').trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
};

export const parseQuestionBankListParams = (
  url: URL,
  actor: QuestionBankActor,
): NormalizedQuestionBankListParams => {
  const searchParams = url.searchParams;
  const rawScope = String(searchParams.get('scope') || 'SYSTEM').trim().toUpperCase();
  if (!SCOPES.has(rawScope)) return fail('VALIDATION_ERROR');
  const scope = rawScope as QuestionBankScope | 'ALL';

  const rawStatus = boundedString(searchParams.get('status'), 32)?.toUpperCase();
  if (rawStatus && !STATUSES.has(rawStatus as QuestionBankStatus)) return fail('VALIDATION_ERROR');
  const status = rawStatus as QuestionBankStatus | undefined;
  if (actor.role === 'teacher' && (scope === 'SYSTEM' || scope === 'ALL') && status && status !== 'PUBLISHED') {
    return fail('FORBIDDEN');
  }

  const ownerId = boundedString(searchParams.get('ownerId'), 128);
  if (actor.role === 'teacher' && ownerId && ownerId !== actor.username) return fail('FORBIDDEN');

  const rawPage = Number(searchParams.get('page') || 1);
  const rawPageSize = Number(searchParams.get('pageSize') || 30);
  if (!Number.isFinite(rawPage) || !Number.isFinite(rawPageSize)) return fail('VALIDATION_ERROR');
  const page = Math.max(1, Math.floor(rawPage));
  const pageSize = Math.min(100, Math.max(1, Math.floor(rawPageSize)));

  return {
    scope,
    ownerId,
    status,
    page,
    pageSize,
    grade: parsePositiveInteger(searchParams.get('grade'), 'grade'),
    semester: parsePositiveInteger(searchParams.get('semester'), 'semester', [1, 2]),
    difficulty: parsePositiveInteger(searchParams.get('difficulty'), 'difficulty', [1, 2, 3]) as 1 | 2 | 3 | undefined,
    subject: boundedString(searchParams.get('subject'), 64)?.toUpperCase(),
    topicCode: boundedString(searchParams.get('topicCode'), 64),
    lessonCode: boundedString(searchParams.get('lessonCode'), 64),
    type: boundedString(searchParams.get('type'), 64)?.toUpperCase(),
    search: boundedString(searchParams.get('search'), MAX_SEARCH_LENGTH),
  };
};

const parseTags = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
};

const normalizeDifficulty = (value: number | null): 1 | 2 | 3 | null =>
  value === 1 || value === 2 || value === 3 ? value : null;

const mapRow = (row: QuestionBankRow): QuestionBankStoredItem | null => {
  try {
    const questionData = JSON.parse(row.question_data) as unknown;
    return {
      id: row.id,
      scope: row.scope,
      ownerId: row.owner_id,
      status: row.status,
      questionData,
      questionText: row.question_text || '',
      questionType: row.question_type || '',
      difficulty: normalizeDifficulty(row.difficulty),
      explanation: row.explanation || '',
      metadata: {
        grade: row.grade === null ? null : Number(row.grade),
        subject: row.subject || '',
        semester: row.semester === null ? null : Number(row.semester),
        topicCode: row.topic_code || '',
        lessonCode: row.lesson_code || '',
        source: row.source || '',
        tags: parseTags(row.tags),
      },
      contentHash: row.content_hash,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      archivedAt: row.archived_at,
    };
  } catch (error) {
    console.warn('Skipping malformed question-bank row', { itemId: row.id, error });
    return null;
  }
};

const toPublicItem = (item: QuestionBankStoredItem): QuestionBankItem => {
  const { contentHash: _contentHash, ...publicItem } = item;
  return publicItem;
};

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

const buildWhere = (
  actor: QuestionBankActor,
  params: NormalizedQuestionBankListParams,
): { sql: string; bindings: unknown[] } => {
  const clauses: string[] = [];
  const bindings: unknown[] = [];

  if (params.scope === 'SYSTEM') {
    clauses.push('scope = ?');
    bindings.push('SYSTEM');
    if (actor.role === 'teacher') {
      clauses.push('status = ?');
      bindings.push('PUBLISHED');
    } else if (params.status) {
      clauses.push('status = ?');
      bindings.push(params.status);
    }
  } else if (params.scope === 'PERSONAL') {
    clauses.push('scope = ?');
    bindings.push('PERSONAL');
    clauses.push('owner_id = ?');
    bindings.push(params.ownerId || actor.username);
    if (params.status) {
      clauses.push('status = ?');
      bindings.push(params.status);
    }
  } else {
    const ownerId = params.ownerId || actor.username;
    if (actor.role === 'teacher') {
      clauses.push("((scope = 'SYSTEM' AND status = 'PUBLISHED') OR (scope = 'PERSONAL' AND owner_id = ?))");
    } else {
      clauses.push("(scope = 'SYSTEM' OR (scope = 'PERSONAL' AND owner_id = ?))");
    }
    bindings.push(ownerId);
    if (params.status) {
      clauses.push('status = ?');
      bindings.push(params.status);
    }
  }

  const filters: Array<[unknown, string]> = [
    [params.grade, 'grade = ?'],
    [params.subject, 'subject = ?'],
    [params.semester, 'semester = ?'],
    [params.topicCode, 'topic_code = ?'],
    [params.lessonCode, 'lesson_code = ?'],
    [params.difficulty, 'difficulty = ?'],
    [params.type, 'question_type = ?'],
  ];
  for (const [value, clause] of filters) {
    if (value !== undefined) {
      clauses.push(clause);
      bindings.push(value);
    }
  }

  if (params.search) {
    clauses.push("question_text LIKE ? ESCAPE '\\'");
    bindings.push(`%${escapeLike(params.search)}%`);
  }

  return {
    sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '',
    bindings,
  };
};

export const listQuestionBankItems = async (
  db: D1Database,
  actor: QuestionBankActor,
  params: NormalizedQuestionBankListParams,
): Promise<QuestionBankListResponse> => {
  const where = buildWhere(actor, params);
  const countRow = await db.prepare(
    `SELECT COUNT(*) AS total FROM question_bank_items${where.sql}`,
  ).bind(...where.bindings).first<{ total: number }>();
  const totalItems = Math.max(0, Number(countRow?.total || 0));
  const offset = (params.page - 1) * params.pageSize;
  const result = await db.prepare(
    `SELECT * FROM question_bank_items${where.sql} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`,
  ).bind(...where.bindings, params.pageSize, offset).all<QuestionBankRow>();

  const items = (result.results || [])
    .map(mapRow)
    .filter((item): item is QuestionBankStoredItem => item !== null)
    .map(toPublicItem);

  return {
    items,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / params.pageSize),
    },
    appliedFilters: { ...params },
  };
};

const canRead = (actor: QuestionBankActor, item: QuestionBankStoredItem): boolean => {
  if (actor.role === 'admin') return true;
  if (item.scope === 'SYSTEM') return item.status === 'PUBLISHED';
  return item.ownerId === actor.username;
};

export const getQuestionBankStoredItem = async (
  db: D1Database,
  id: string,
): Promise<QuestionBankStoredItem | null> => {
  const row = await db.prepare('SELECT * FROM question_bank_items WHERE id = ? LIMIT 1')
    .bind(id)
    .first<QuestionBankRow>();
  return row ? mapRow(row) : null;
};

export const getQuestionBankItem = async (
  db: D1Database,
  actor: QuestionBankActor,
  id: string,
): Promise<QuestionBankItem | null> => {
  const item = await getQuestionBankStoredItem(db, id);
  return item && canRead(actor, item) ? toPublicItem(item) : null;
};

export const findQuestionBankDuplicate = async (
  db: D1Database,
  scope: QuestionBankScope,
  ownerId: string,
  contentHash: string,
  excludeId?: string,
): Promise<string | null> => {
  const sql = excludeId
    ? 'SELECT id FROM question_bank_items WHERE scope = ? AND owner_id = ? AND content_hash = ? AND id <> ? LIMIT 1'
    : 'SELECT id FROM question_bank_items WHERE scope = ? AND owner_id = ? AND content_hash = ? LIMIT 1';
  const bindings = excludeId
    ? [scope, ownerId, contentHash, excludeId]
    : [scope, ownerId, contentHash];
  const row = await db.prepare(sql).bind(...bindings).first<{ id: string }>();
  return row?.id || null;
};

export const prepareInsertQuestionBankItem = (
  db: D1Database,
  item: QuestionBankWriteRecord,
): D1PreparedStatement => db.prepare(`INSERT INTO question_bank_items (
  id, scope, owner_id, status, question_data, question_text, question_type,
  difficulty, explanation, grade, subject, semester, topic_code, lesson_code,
  source, tags, content_hash, created_by, updated_by, created_at, updated_at,
  published_at, archived_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .bind(
    item.id,
    item.scope,
    item.ownerId,
    item.status,
    JSON.stringify(item.questionData),
    item.questionText,
    item.questionType,
    item.difficulty,
    item.explanation,
    item.metadata.grade,
    item.metadata.subject,
    item.metadata.semester,
    item.metadata.topicCode,
    item.metadata.lessonCode,
    item.metadata.source,
    JSON.stringify(item.metadata.tags),
    item.contentHash,
    item.createdBy,
    item.updatedBy,
    item.createdAt,
    item.updatedAt,
    item.publishedAt,
    item.archivedAt,
  );

export const insertQuestionBankItem = async (
  db: D1Database,
  item: QuestionBankWriteRecord,
): Promise<void> => {
  await prepareInsertQuestionBankItem(db, item).run();
};

export const preparePatchQuestionBankItem = (
  db: D1Database,
  item: QuestionBankWriteRecord,
): D1PreparedStatement => db.prepare(`UPDATE question_bank_items SET
  scope = ?, owner_id = ?, status = ?, question_data = ?, question_text = ?,
  question_type = ?, difficulty = ?, explanation = ?, grade = ?, subject = ?,
  semester = ?, topic_code = ?, lesson_code = ?, source = ?, tags = ?,
  content_hash = ?, updated_by = ?, updated_at = ?, published_at = ?, archived_at = ?
  WHERE id = ?`)
  .bind(
    item.scope,
    item.ownerId,
    item.status,
    JSON.stringify(item.questionData),
    item.questionText,
    item.questionType,
    item.difficulty,
    item.explanation,
    item.metadata.grade,
    item.metadata.subject,
    item.metadata.semester,
    item.metadata.topicCode,
    item.metadata.lessonCode,
    item.metadata.source,
    JSON.stringify(item.metadata.tags),
    item.contentHash,
    item.updatedBy,
    item.updatedAt,
    item.publishedAt,
    item.archivedAt,
    item.id,
  );

export const patchQuestionBankItem = async (
  db: D1Database,
  item: QuestionBankWriteRecord,
): Promise<void> => {
  await preparePatchQuestionBankItem(db, item).run();
};

export const prepareArchiveQuestionBankItem = (
  db: D1Database,
  id: string,
  actorId: string,
  timestamp: string,
): D1PreparedStatement => db.prepare(`UPDATE question_bank_items
  SET status = 'ARCHIVED', archived_at = ?, updated_at = ?, updated_by = ?
  WHERE id = ? AND scope = 'SYSTEM'`)
  .bind(timestamp, timestamp, actorId, id);

export const archiveQuestionBankItem = async (
  db: D1Database,
  id: string,
  actorId: string,
  timestamp: string,
): Promise<void> => {
  await prepareArchiveQuestionBankItem(db, id, actorId, timestamp).run();
};

export const prepareDeletePersonalQuestionBankItem = (
  db: D1Database,
  id: string,
): D1PreparedStatement => db.prepare(
  "DELETE FROM question_bank_items WHERE id = ? AND scope = 'PERSONAL'",
).bind(id);

export const deletePersonalQuestionBankItem = async (
  db: D1Database,
  id: string,
): Promise<void> => {
  await prepareDeletePersonalQuestionBankItem(db, id).run();
};

export const prepareUpsertLegacyTestBankItem = (
  db: D1Database,
  item: QuestionBankWriteRecord,
): D1PreparedStatement => db.prepare(`INSERT INTO test_bank (
  id, teacher_id, question_data, tags, created_at
) VALUES (?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  teacher_id = excluded.teacher_id,
  question_data = excluded.question_data,
  tags = excluded.tags`)
  .bind(
    item.id,
    item.ownerId,
    JSON.stringify(item.questionData),
    JSON.stringify(item.metadata.tags),
    item.createdAt,
  );

export const prepareDeleteLegacyTestBankItem = (
  db: D1Database,
  id: string,
): D1PreparedStatement => db.prepare('DELETE FROM test_bank WHERE id = ?').bind(id);

export interface QuestionBankAuditWrite {
  id: string;
  itemId: string;
  action: 'CREATE' | 'UPDATE' | 'PUBLISH' | 'ARCHIVE' | 'RESTORE' | 'BULK_IMPORT';
  actorId: string;
  actorRole: 'teacher' | 'admin';
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
}

export const prepareQuestionBankAudit = (
  db: D1Database,
  audit: QuestionBankAuditWrite,
): D1PreparedStatement => db.prepare(`INSERT INTO question_bank_audit (
  id, item_id, action, actor_id, actor_role, before_json, after_json, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  .bind(
    audit.id,
    audit.itemId,
    audit.action,
    audit.actorId,
    audit.actorRole,
    audit.beforeJson,
    audit.afterJson,
    audit.createdAt,
  );
