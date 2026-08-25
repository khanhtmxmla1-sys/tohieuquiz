import type {
  CompetitionAwardRuleScope,
  CompetitionAwardRuleVersionStatus,
  CompetitionGoldenBoardDisplayMode,
  StaffCompetitionAwardRuleDto,
  StaffCompetitionAwardRuleVersionDto,
  StaffCompetitionGoldenBoardConfigDto,
} from '../../../shared/competition-portal.contract';
import { auditStatement } from '../utils/audit';

interface AwardRuleVersionRow {
  id: string;
  campaign_id: string;
  version: number;
  status: CompetitionAwardRuleVersionStatus;
  activated_at: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

interface AwardRuleRow {
  id: string;
  campaign_id: string;
  version: number;
  scope: CompetitionAwardRuleScope;
  grade_level: number | null;
  rank_from: number;
  rank_to: number;
  award_code: string;
  award_label: string;
  sort_order: number;
}

interface AwardRuleAggregateRow {
  version_id: string;
  version_campaign_id: string;
  version_number: number;
  version_status: CompetitionAwardRuleVersionStatus;
  version_activated_at: string | null;
  version_created_by: string;
  version_created_at: string;
  version_updated_by: string | null;
  version_updated_at: string;
  rule_id: string | null;
  rule_scope: CompetitionAwardRuleScope | null;
  rule_grade_level: number | null;
  rule_rank_from: number | null;
  rule_rank_to: number | null;
  rule_award_code: string | null;
  rule_award_label: string | null;
  rule_sort_order: number | null;
}

interface GoldenBoardConfigRow {
  id: string;
  campaign_id: string;
  source_event_id: string | null;
  enabled: number;
  display_mode: CompetitionGoldenBoardDisplayMode;
  title: string;
  award_rule_version: number | null;
  updated_by: string;
  updated_at: string;
}

export interface CreateAwardRuleInput {
  scope: CompetitionAwardRuleScope;
  gradeLevel?: number | null;
  rankFrom: number;
  rankTo: number;
  awardCode: string;
  awardLabel: string;
  sortOrder: number;
}

export interface CreateAwardRuleVersionInput {
  campaignId: string;
  rules: CreateAwardRuleInput[];
  requestId: string;
}

export interface UpdateGoldenBoardConfigInput {
  sourceEventId?: string | null;
  enabled?: boolean;
  displayMode?: CompetitionGoldenBoardDisplayMode;
  title?: string;
  awardRuleVersion?: number | null;
  requestId: string;
}

function normalizedId(value: unknown, errorCode: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function mapRule(row: AwardRuleRow): StaffCompetitionAwardRuleDto {
  const base = {
    id: row.id,
    rankFrom: row.rank_from,
    rankTo: row.rank_to,
    awardCode: row.award_code,
    awardLabel: row.award_label,
    sortOrder: row.sort_order,
  };
  return row.scope === 'GRADE'
    ? { ...base, scope: 'GRADE', gradeLevel: row.grade_level as number }
    : { ...base, scope: 'EVENT' };
}

function mapVersion(
  row: AwardRuleVersionRow,
  rules: AwardRuleRow[],
): StaffCompetitionAwardRuleVersionDto {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    version: row.version,
    status: row.status,
    activatedAt: row.activated_at,
    rules: rules.map(mapRule),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

function mapConfig(row: GoldenBoardConfigRow): StaffCompetitionGoldenBoardConfigDto {
  const base = {
    id: row.id,
    campaignId: row.campaign_id,
    displayMode: row.display_mode,
    title: row.title,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
  if (row.enabled === 1) {
    return {
      ...base,
      enabled: true,
      sourceEventId: row.source_event_id as string,
      awardRuleVersion: row.award_rule_version as number,
    };
  }
  return {
    ...base,
    enabled: false,
    sourceEventId: row.source_event_id,
    awardRuleVersion: row.award_rule_version,
  };
}

function validateRule(input: CreateAwardRuleInput, index: number): AwardRuleRow {
  if (input?.scope !== 'EVENT' && input?.scope !== 'GRADE') {
    throw new Error('COMPETITION_AWARD_RULE_SCOPE_INVALID');
  }
  const gradeLevel = input.gradeLevel ?? null;
  if (
    (input.scope === 'EVENT' && gradeLevel !== null)
    || (input.scope === 'GRADE' && (
      gradeLevel === null
      || !Number.isInteger(gradeLevel)
      || gradeLevel < 1
      || gradeLevel > 12
    ))
  ) {
    throw new Error('COMPETITION_AWARD_RULE_GRADE_INVALID');
  }
  if (
    !Number.isInteger(input.rankFrom)
    || input.rankFrom <= 0
    || !Number.isInteger(input.rankTo)
    || input.rankTo < input.rankFrom
  ) {
    throw new Error('COMPETITION_AWARD_RULE_RANK_INVALID');
  }
  const awardCode = normalizedId(input.awardCode, 'COMPETITION_AWARD_RULE_CODE_REQUIRED');
  const awardLabel = normalizedId(input.awardLabel, 'COMPETITION_AWARD_RULE_LABEL_REQUIRED');
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
    throw new Error('COMPETITION_AWARD_RULE_SORT_ORDER_INVALID');
  }
  return {
    id: `competition-award-rule-${crypto.randomUUID()}`,
    campaign_id: '',
    version: 0,
    scope: input.scope,
    grade_level: gradeLevel,
    rank_from: input.rankFrom,
    rank_to: input.rankTo,
    award_code: awardCode,
    award_label: awardLabel,
    sort_order: input.sortOrder,
  } satisfies AwardRuleRow;
}

function validateRules(inputs: CreateAwardRuleInput[]): AwardRuleRow[] {
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 100) {
    throw new Error('COMPETITION_AWARD_RULES_INVALID');
  }
  const rules = inputs.map(validateRule);
  const codes = new Set<string>();
  for (const rule of rules) {
    if (codes.has(rule.award_code)) throw new Error('COMPETITION_AWARD_RULE_CODE_DUPLICATE');
    codes.add(rule.award_code);
  }
  for (let first = 0; first < rules.length; first += 1) {
    for (let second = first + 1; second < rules.length; second += 1) {
      const left = rules[first];
      const right = rules[second];
      if (
        left.scope === right.scope
        && left.grade_level === right.grade_level
        && left.rank_from <= right.rank_to
        && left.rank_to >= right.rank_from
      ) {
        throw new Error('COMPETITION_AWARD_RULE_RANGES_OVERLAP');
      }
    }
  }
  return rules;
}

async function versionRows(
  db: D1Database,
  campaignId: string,
): Promise<AwardRuleVersionRow[]> {
  const result = await db.prepare(`
    SELECT id, campaign_id, version, status, activated_at,
      created_by, created_at, updated_by, updated_at
    FROM competition_award_rule_versions
    WHERE campaign_id = ?
    ORDER BY version DESC
  `).bind(campaignId).all<AwardRuleVersionRow>();
  return result.results;
}

async function rulesForVersions(
  db: D1Database,
  campaignId: string,
): Promise<AwardRuleRow[]> {
  const result = await db.prepare(`
    SELECT id, campaign_id, version, scope, grade_level, rank_from, rank_to,
      award_code, award_label, sort_order
    FROM competition_award_rules
    WHERE campaign_id = ?
    ORDER BY version DESC, sort_order ASC, rank_from ASC, id ASC
  `).bind(campaignId).all<AwardRuleRow>();
  return result.results;
}

function staleMutationGuardStatement(
  db: D1Database,
  targetType: string,
  targetId: string,
  requestId: string,
): D1PreparedStatement {
  return db.prepare(`
    INSERT INTO admin_audit_logs (
      id, actor_username, action, target_type, target_id, request_id,
      before_json, after_json, created_at
    )
    SELECT ?, NULL, 'COMPETITION_GOLDEN_BOARD_STALE_GUARD',
      ?, ?, ?, NULL, NULL, ?
    WHERE changes() <> 1
  `).bind(
    `audit-guard-${crypto.randomUUID()}`,
    targetType,
    targetId,
    requestId,
    new Date().toISOString(),
  );
}

function rethrowWriteError(
  error: unknown,
  operation: 'award-version' | 'activation' | 'config',
): never {
  const message = String(error);
  if (message.includes('admin_audit_logs.actor_username')) {
    throw new Error(operation === 'activation'
      ? 'COMPETITION_AWARD_RULE_VERSION_NOT_DRAFT'
      : 'GOLDEN_BOARD_CONFIG_STALE_WRITE');
  }
  if (message.includes('UNIQUE') && message.includes('competition_award_rule_versions')) {
    throw new Error('COMPETITION_AWARD_RULE_VERSION_CONFLICT');
  }
  if (message.includes('UNIQUE') && message.includes('competition_golden_board_configs')) {
    throw new Error('GOLDEN_BOARD_CONFIG_STALE_WRITE');
  }
  if (message.includes('FOREIGN KEY')) {
    throw new Error(operation === 'award-version'
      ? 'COMPETITION_CAMPAIGN_NOT_FOUND'
      : 'GOLDEN_BOARD_CONFIG_STALE_WRITE');
  }
  if (
    operation === 'config'
    && (
      message.includes('GOLDEN_BOARD_SOURCE_EVENT_CAMPAIGN_MISMATCH')
      || message.includes('GOLDEN_BOARD_AWARD_VERSION_NOT_ACTIVE')
    )
  ) {
    throw new Error('GOLDEN_BOARD_CONFIG_STALE_WRITE');
  }
  if (message.includes('COMPETITION_AWARD_RULE_RANGES_OVERLAP')) {
    throw new Error('COMPETITION_AWARD_RULE_RANGES_OVERLAP');
  }
  throw error;
}

async function requireCampaignExists(db: D1Database, campaignId: string): Promise<void> {
  const campaign = await db.prepare(`
    SELECT id FROM competition_campaigns WHERE id = ? LIMIT 1
  `).bind(campaignId).first<{ id: string }>();
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');
}

export async function createAwardRuleVersion(
  db: D1Database,
  input: CreateAwardRuleVersionInput,
  actorUsername: string,
): Promise<StaffCompetitionAwardRuleVersionDto> {
  const campaignId = normalizedId(input?.campaignId, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const requestId = normalizedId(input?.requestId, 'COMPETITION_REQUEST_ID_REQUIRED');
  const validatedRules = validateRules(input?.rules);
  await requireCampaignExists(db, campaignId);
  const existing = await versionRows(db, campaignId);
  const version = (existing[0]?.version ?? 0) + 1;
  const now = new Date().toISOString();
  const versionRow: AwardRuleVersionRow = {
    id: `competition-award-rule-version-${crypto.randomUUID()}`,
    campaign_id: campaignId,
    version,
    status: 'DRAFT',
    activated_at: null,
    created_by: actor,
    created_at: now,
    updated_by: null,
    updated_at: now,
  };
  const rules = validatedRules.map((rule) => ({ ...rule, campaign_id: campaignId, version }));

  try {
    await db.batch([
      db.prepare(`
        INSERT INTO competition_award_rule_versions (
          id, campaign_id, version, status, activated_at,
          created_by, created_at, updated_by, updated_at
        ) VALUES (?, ?, ?, 'DRAFT', NULL, ?, ?, NULL, ?)
      `).bind(versionRow.id, campaignId, version, actor, now, now),
      ...rules.map((rule) => db.prepare(`
        INSERT INTO competition_award_rules (
          id, campaign_id, version, scope, grade_level, rank_from, rank_to,
          award_code, award_label, sort_order, created_by, created_at, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
      `).bind(
        rule.id, campaignId, version, rule.scope, rule.grade_level,
        rule.rank_from, rule.rank_to, rule.award_code, rule.award_label,
        rule.sort_order, actor, now, now,
      )),
      auditStatement(db, {
        actorUsername: actor,
        action: 'COMPETITION_AWARD_RULE_VERSION_CREATED',
        targetType: 'competition_award_rule_version',
        targetId: versionRow.id,
        requestId,
        after: { campaignId, version, status: 'DRAFT', ruleCount: rules.length },
      }),
    ]);
  } catch (error) {
    rethrowWriteError(error, 'award-version');
  }
  return mapVersion(versionRow, rules);
}

export async function listAwardRuleVersions(
  db: D1Database,
  campaignIdInput: string,
): Promise<StaffCompetitionAwardRuleVersionDto[]> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const result = await db.prepare(`
    SELECT
      versions.id AS version_id,
      versions.campaign_id AS version_campaign_id,
      versions.version AS version_number,
      versions.status AS version_status,
      versions.activated_at AS version_activated_at,
      versions.created_by AS version_created_by,
      versions.created_at AS version_created_at,
      versions.updated_by AS version_updated_by,
      versions.updated_at AS version_updated_at,
      rules.id AS rule_id,
      rules.scope AS rule_scope,
      rules.grade_level AS rule_grade_level,
      rules.rank_from AS rule_rank_from,
      rules.rank_to AS rule_rank_to,
      rules.award_code AS rule_award_code,
      rules.award_label AS rule_award_label,
      rules.sort_order AS rule_sort_order
    FROM competition_award_rule_versions AS versions
    LEFT JOIN competition_award_rules AS rules
      ON rules.campaign_id = versions.campaign_id
      AND rules.version = versions.version
    WHERE versions.campaign_id = ?
    ORDER BY versions.version DESC, rules.sort_order ASC,
      rules.rank_from ASC, rules.id ASC
  `).bind(campaignId).all<AwardRuleAggregateRow>();
  const aggregates = new Map<number, { version: AwardRuleVersionRow; rules: AwardRuleRow[] }>();
  for (const row of result.results) {
    let aggregate = aggregates.get(row.version_number);
    if (!aggregate) {
      aggregate = {
        version: {
          id: row.version_id,
          campaign_id: row.version_campaign_id,
          version: row.version_number,
          status: row.version_status,
          activated_at: row.version_activated_at,
          created_by: row.version_created_by,
          created_at: row.version_created_at,
          updated_by: row.version_updated_by,
          updated_at: row.version_updated_at,
        },
        rules: [],
      };
      aggregates.set(row.version_number, aggregate);
    }
    if (row.rule_id !== null) {
      aggregate.rules.push({
        id: row.rule_id,
        campaign_id: row.version_campaign_id,
        version: row.version_number,
        scope: row.rule_scope as CompetitionAwardRuleScope,
        grade_level: row.rule_grade_level,
        rank_from: row.rule_rank_from as number,
        rank_to: row.rule_rank_to as number,
        award_code: row.rule_award_code as string,
        award_label: row.rule_award_label as string,
        sort_order: row.rule_sort_order as number,
      });
    }
  }
  return [...aggregates.values()].map(({ version, rules }) => mapVersion(version, rules));
}

export async function activateAwardRuleVersion(
  db: D1Database,
  campaignIdInput: string,
  versionInput: number,
  actorUsername: string,
  requestIdInput: string,
): Promise<StaffCompetitionAwardRuleVersionDto> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const requestId = normalizedId(requestIdInput, 'COMPETITION_REQUEST_ID_REQUIRED');
  if (!Number.isInteger(versionInput) || versionInput <= 0) {
    throw new Error('COMPETITION_AWARD_RULE_VERSION_INVALID');
  }
  const before = await db.prepare(`
    SELECT id, campaign_id, version, status, activated_at,
      created_by, created_at, updated_by, updated_at
    FROM competition_award_rule_versions
    WHERE campaign_id = ? AND version = ?
    LIMIT 1
  `).bind(campaignId, versionInput).first<AwardRuleVersionRow>();
  if (!before) throw new Error('COMPETITION_AWARD_RULE_VERSION_NOT_FOUND');
  if (before.status !== 'DRAFT') throw new Error('COMPETITION_AWARD_RULE_VERSION_NOT_DRAFT');
  const rules = (await rulesForVersions(db, campaignId)).filter((rule) => rule.version === versionInput);
  const now = new Date().toISOString();
  const after: AwardRuleVersionRow = {
    ...before,
    status: 'ACTIVE',
    activated_at: now,
    updated_by: actor,
    updated_at: now,
  };
  try {
    await db.batch([
      db.prepare(`
        UPDATE competition_award_rule_versions
        SET status = 'ACTIVE', activated_at = ?, updated_by = ?, updated_at = ?
        WHERE id = ? AND campaign_id = ? AND version = ? AND status = 'DRAFT'
      `).bind(now, actor, now, before.id, campaignId, versionInput),
      staleMutationGuardStatement(
        db, 'competition_award_rule_version', before.id, requestId,
      ),
      auditStatement(db, {
        actorUsername: actor,
        action: 'COMPETITION_AWARD_RULE_VERSION_ACTIVATED',
        targetType: 'competition_award_rule_version',
        targetId: before.id,
        requestId,
        before: { campaignId, version: versionInput, status: before.status, ruleCount: rules.length },
        after: { campaignId, version: versionInput, status: 'ACTIVE', ruleCount: rules.length },
      }),
    ]);
  } catch (error) {
    rethrowWriteError(error, 'activation');
  }
  return mapVersion(after, rules);
}

export async function getGoldenBoardConfig(
  db: D1Database,
  campaignIdInput: string,
): Promise<StaffCompetitionGoldenBoardConfigDto | null> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const row = await db.prepare(`
    SELECT id, campaign_id, source_event_id, enabled, display_mode,
      title, award_rule_version, updated_by, updated_at
    FROM competition_golden_board_configs
    WHERE campaign_id = ?
    LIMIT 1
  `).bind(campaignId).first<GoldenBoardConfigRow>();
  return row ? mapConfig(row) : null;
}

async function validateConfigReferences(
  db: D1Database,
  campaignId: string,
  sourceEventId: string | null,
  awardRuleVersion: number | null,
  enabled: boolean,
): Promise<void> {
  if (sourceEventId !== null) {
    const event = await db.prepare(`
      SELECT id FROM competition_school_exam_events
      WHERE campaign_id = ? AND id = ?
      LIMIT 1
    `).bind(campaignId, sourceEventId).first<{ id: string }>();
    if (!event) throw new Error('GOLDEN_BOARD_SOURCE_EVENT_NOT_FOUND');
  }
  let versionStatus: CompetitionAwardRuleVersionStatus | null = null;
  if (awardRuleVersion !== null) {
    if (!Number.isInteger(awardRuleVersion) || awardRuleVersion <= 0) {
      throw new Error('GOLDEN_BOARD_AWARD_VERSION_NOT_FOUND');
    }
    const version = await db.prepare(`
      SELECT status FROM competition_award_rule_versions
      WHERE campaign_id = ? AND version = ?
      LIMIT 1
    `).bind(campaignId, awardRuleVersion).first<{ status: CompetitionAwardRuleVersionStatus }>();
    if (!version) throw new Error('GOLDEN_BOARD_AWARD_VERSION_NOT_FOUND');
    versionStatus = version.status;
  }
  if (enabled && (sourceEventId === null || awardRuleVersion === null)) {
    throw new Error('GOLDEN_BOARD_CONFIG_SOURCE_REQUIRED');
  }
  if (enabled && versionStatus !== 'ACTIVE') {
    throw new Error('GOLDEN_BOARD_AWARD_VERSION_NOT_ACTIVE');
  }
}

function configAuditMetadata(row: GoldenBoardConfigRow) {
  return {
    campaignId: row.campaign_id,
    sourceEventId: row.source_event_id,
    enabled: row.enabled === 1,
    displayMode: row.display_mode,
    awardRuleVersion: row.award_rule_version,
  };
}

export async function updateGoldenBoardConfig(
  db: D1Database,
  campaignIdInput: string,
  input: UpdateGoldenBoardConfigInput,
  actorUsername: string,
): Promise<StaffCompetitionGoldenBoardConfigDto> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const requestId = normalizedId(input?.requestId, 'COMPETITION_REQUEST_ID_REQUIRED');
  if (input.displayMode !== undefined && input.displayMode !== 'AWARD_WINNERS') {
    throw new Error('GOLDEN_BOARD_DISPLAY_MODE_INVALID');
  }
  await requireCampaignExists(db, campaignId);
  const before = await db.prepare(`
    SELECT id, campaign_id, source_event_id, enabled, display_mode,
      title, award_rule_version, updated_by, updated_at
    FROM competition_golden_board_configs WHERE campaign_id = ? LIMIT 1
  `).bind(campaignId).first<GoldenBoardConfigRow>();
  const sourceEventId = input.sourceEventId === undefined
    ? (before?.source_event_id ?? null)
    : (input.sourceEventId === null ? null : normalizedId(input.sourceEventId, 'GOLDEN_BOARD_SOURCE_EVENT_NOT_FOUND'));
  const awardRuleVersion = input.awardRuleVersion === undefined
    ? (before?.award_rule_version ?? null)
    : input.awardRuleVersion;
  const enabled = input.enabled ?? (before?.enabled === 1);
  const title = input.title === undefined
    ? (before?.title ?? '')
    : String(input.title).trim();
  if (!title) throw new Error('GOLDEN_BOARD_TITLE_REQUIRED');
  await validateConfigReferences(db, campaignId, sourceEventId, awardRuleVersion, enabled);

  const now = new Date().toISOString();
  const after: GoldenBoardConfigRow = {
    id: before?.id ?? `competition-golden-board-config-${crypto.randomUUID()}`,
    campaign_id: campaignId,
    source_event_id: sourceEventId,
    enabled: enabled ? 1 : 0,
    display_mode: 'AWARD_WINNERS',
    title,
    award_rule_version: awardRuleVersion,
    updated_by: actor,
    updated_at: now,
  };
  const action = before
    ? 'COMPETITION_GOLDEN_BOARD_CONFIG_UPDATED'
    : 'COMPETITION_GOLDEN_BOARD_CONFIG_CREATED';
  const mutation = before
    ? db.prepare(`
      UPDATE competition_golden_board_configs
      SET source_event_id = ?, enabled = ?, display_mode = 'AWARD_WINNERS',
        title = ?, award_rule_version = ?, updated_by = ?, updated_at = ?
      WHERE id = ? AND campaign_id = ? AND source_event_id IS ? AND enabled = ?
        AND display_mode = ? AND title = ? AND award_rule_version IS ?
        AND updated_by = ? AND updated_at = ?
    `).bind(
      sourceEventId, after.enabled, title, awardRuleVersion, actor, now,
      before.id, campaignId, before.source_event_id, before.enabled,
      before.display_mode, before.title, before.award_rule_version,
      before.updated_by, before.updated_at,
    )
    : db.prepare(`
      INSERT INTO competition_golden_board_configs (
        id, campaign_id, source_event_id, enabled, display_mode,
        title, award_rule_version, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, 'AWARD_WINNERS', ?, ?, ?, ?)
    `).bind(
      after.id, campaignId, sourceEventId, after.enabled,
      title, awardRuleVersion, actor, now,
    );
  try {
    await db.batch([
      mutation,
      staleMutationGuardStatement(
        db, 'competition_golden_board_config', after.id, requestId,
      ),
      auditStatement(db, {
        actorUsername: actor,
        action,
        targetType: 'competition_golden_board_config',
        targetId: after.id,
        requestId,
        before: before ? configAuditMetadata(before) : undefined,
        after: configAuditMetadata(after),
      }),
    ]);
  } catch (error) {
    rethrowWriteError(error, 'config');
  }
  return mapConfig(after);
}
