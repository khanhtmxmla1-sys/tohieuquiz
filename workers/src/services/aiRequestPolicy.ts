import type { AiWorkflow } from './teacherAiQuotaLedger';

export type AiStage = 'OCR' | 'GENERATE' | 'REVIEW' | 'REPAIR' | 'REGENERATE' | 'GENERIC';

export interface AiRequestMeta {
  actionId: string;
  workflow: AiWorkflow;
  stage: AiStage;
  promptVersion?: 'ai-blueprint-v3';
  blueprintVersion?: 3;
  slotCount?: number;
}

type AiRequestPolicyCode = 'AI_META_REQUIRED' | 'AI_META_INVALID' | 'AI_STAGE_CONFLICT';

interface AiActionPolicyRow {
  action_id: string;
  username: string;
  workflow: AiWorkflow;
  status: 'RESERVED' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  upstream_calls: number;
  ocr_calls: number;
  generate_calls: number;
  review_calls: number;
  repair_calls: number;
}

const ACTION_ID = /^ai-[a-z0-9-]{20,80}$/i;
const WORKFLOWS = new Set<AiWorkflow>(['QUIZ_CREATE', 'QUESTION_REGENERATE', 'GENERIC']);
const STAGES = new Set<AiStage>(['OCR', 'GENERATE', 'REVIEW', 'REPAIR', 'REGENERATE', 'GENERIC']);

const WORKFLOW_STAGES: Record<AiWorkflow, ReadonlySet<AiStage>> = {
  QUIZ_CREATE: new Set<AiStage>(['OCR', 'GENERATE', 'REVIEW', 'REPAIR']),
  QUESTION_REGENERATE: new Set<AiStage>(['REGENERATE']),
  GENERIC: new Set<AiStage>(['GENERIC']),
};

const STAGE_COLUMNS: Record<AiStage, 'ocr_calls' | 'generate_calls' | 'review_calls' | 'repair_calls'> = {
  OCR: 'ocr_calls',
  GENERATE: 'generate_calls',
  REVIEW: 'review_calls',
  REPAIR: 'repair_calls',
  REGENERATE: 'generate_calls',
  GENERIC: 'generate_calls',
};

export class AiRequestPolicyError extends Error {
  constructor(public readonly code: AiRequestPolicyCode) {
    const messages: Record<AiRequestPolicyCode, string> = {
      AI_META_REQUIRED: 'Yêu cầu AI thiếu thông tin định danh thao tác.',
      AI_META_INVALID: 'Thông tin định danh thao tác AI không hợp lệ.',
      AI_STAGE_CONFLICT: 'Bước xử lý AI không hợp lệ hoặc đã được thực hiện.',
    };
    super(messages[code]);
    this.name = 'AiRequestPolicyError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export function parseAiRequestMeta(raw: unknown): AiRequestMeta {
  if (raw === undefined || raw === null) {
    throw new AiRequestPolicyError('AI_META_REQUIRED');
  }
  if (!isRecord(raw)) {
    throw new AiRequestPolicyError('AI_META_INVALID');
  }

  const actionId = typeof raw.actionId === 'string' ? raw.actionId.trim() : '';
  const workflow = typeof raw.workflow === 'string' ? raw.workflow.trim() : '';
  const stage = typeof raw.stage === 'string' ? raw.stage.trim() : '';
  const hasAnyDiagnostics = raw.promptVersion !== undefined
    || raw.blueprintVersion !== undefined
    || raw.slotCount !== undefined;
  const promptVersion = raw.promptVersion;
  const blueprintVersion = raw.blueprintVersion;
  const slotCount = raw.slotCount;

  if (
    !ACTION_ID.test(actionId)
    || !WORKFLOWS.has(workflow as AiWorkflow)
    || !STAGES.has(stage as AiStage)
    || (hasAnyDiagnostics && (
      promptVersion !== 'ai-blueprint-v3'
      || blueprintVersion !== 3
      || !Number.isInteger(slotCount)
      || Number(slotCount) < 1
      || Number(slotCount) > 40
    ))
  ) {
    throw new AiRequestPolicyError('AI_META_INVALID');
  }

  const meta: AiRequestMeta = {
    actionId,
    workflow: workflow as AiWorkflow,
    stage: stage as AiStage,
    ...(hasAnyDiagnostics ? {
      promptVersion: 'ai-blueprint-v3' as const,
      blueprintVersion: 3 as const,
      slotCount: Number(slotCount),
    } : {}),
  };

  if (!WORKFLOW_STAGES[meta.workflow].has(meta.stage)) {
    throw new AiRequestPolicyError('AI_META_INVALID');
  }

  return meta;
}

const readAction = async (
  db: D1Database,
  username: string,
  actionId: string,
): Promise<AiActionPolicyRow | null> => db.prepare(`
  SELECT
    action_id,
    username,
    workflow,
    status,
    upstream_calls,
    ocr_calls,
    generate_calls,
    review_calls,
    repair_calls
  FROM ai_generation_actions
  WHERE action_id = ?
    AND username = ?
  LIMIT 1
`).bind(actionId, username).first<AiActionPolicyRow>();

function assertActionCanRun(
  action: AiActionPolicyRow | null,
  meta: AiRequestMeta,
): asserts action is AiActionPolicyRow {
  if (!action || action.workflow !== meta.workflow) {
    throw new AiRequestPolicyError('AI_STAGE_CONFLICT');
  }
  if (action.status !== 'RESERVED' && action.status !== 'SUCCEEDED') {
    throw new AiRequestPolicyError('AI_STAGE_CONFLICT');
  }

  const count = Number(action[STAGE_COLUMNS[meta.stage]] ?? 0);
  if (!Number.isFinite(count) || count >= 1) {
    throw new AiRequestPolicyError('AI_STAGE_CONFLICT');
  }

  if (meta.stage === 'OCR' && action.generate_calls > 0) {
    throw new AiRequestPolicyError('AI_STAGE_CONFLICT');
  }
  if ((meta.stage === 'REVIEW' || meta.stage === 'REPAIR') && action.generate_calls !== 1) {
    throw new AiRequestPolicyError('AI_STAGE_CONFLICT');
  }
}

export async function authorizeAiStage(
  db: D1Database,
  username: string,
  meta: AiRequestMeta,
): Promise<void> {
  const action = await readAction(db, username, meta.actionId);
  assertActionCanRun(action, meta);
}

const stageOrderCondition = (stage: AiStage): string => {
  if (stage === 'OCR') return 'AND generate_calls = 0';
  if (stage === 'REVIEW' || stage === 'REPAIR') return 'AND generate_calls = 1';
  return '';
};

export async function recordAiStageSuccess(
  db: D1Database,
  username: string,
  meta: AiRequestMeta,
  now = new Date(),
): Promise<void> {
  const column = STAGE_COLUMNS[meta.stage];
  const updated = await db.prepare(`
    UPDATE ai_generation_actions
    SET ${column} = ${column} + 1,
        upstream_calls = upstream_calls + 1,
        updated_at = ?
    WHERE workflow = ?
      AND ${column} < 1
      ${stageOrderCondition(meta.stage)}
      AND status IN ('RESERVED', 'SUCCEEDED')
      AND action_id = ?
      AND username = ?
    RETURNING action_id
  `).bind(now.toISOString(), meta.workflow, meta.actionId, username).first<{ action_id: string }>();

  if (!updated) {
    throw new AiRequestPolicyError('AI_STAGE_CONFLICT');
  }
}
