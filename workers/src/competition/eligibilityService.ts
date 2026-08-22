import type { CompetitionEligibilityReasonCode } from '../../../shared/competition.contract';
import { auditStatement } from '../utils/audit';
import { generateId } from '../utils/response';
import { competitionCursor, competitionLimit, competitionPage } from './pagination';

interface CompetitionEligibilityCampaignRow {
  id: string;
  status: string;
  audience_snapshot_id: string | null;
  eligibility_policy_json: string;
}

interface CompetitionEligibilityAudienceSnapshotRow {
  id: string;
  campaign_id: string;
  status: 'BUILDING' | 'LOCKED';
}

interface CompetitionEligibilityRoundRow {
  id: string;
  round_number: number;
  status: string;
}

interface CompetitionEligibilityProgressRow {
  student_id: string;
  round_id: string;
  round_number: number;
  is_passed: number;
  best_score: number | null;
  best_attempt_id: string | null;
  progress_version: number | null;
  progress_updated_at: string | null;
}

interface CompetitionEligibilityRow {
  id: string;
  campaign_id: string;
  eligibility_snapshot_version: number;
  student_id: string;
  qualified: number;
  reason_codes_json: string;
  qualified_at: string | null;
  computed_at: string;
  progress_digest: string;
  override_reason: string | null;
  overridden_by: string | null;
  overridden_at: string | null;
}

export interface CompetitionEligibilityView {
  id: string;
  campaignId: string;
  version: number;
  studentId: string;
  qualified: boolean;
  reasonCodes: CompetitionEligibilityReasonCode[];
  qualifiedAt: string | null;
  computedAt: string | null;
  progressDigest: string | null;
  override: {
    reason: string;
    actor: string;
    timestamp: string;
  } | null;
}

export interface CompetitionEligibilitySnapshotSummary {
  campaignId: string;
  version: number;
  memberCount: number;
  qualifiedCount: number;
  computedAt: string | null;
}

function normalizedId(value: string, errorCode: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function mapEligibility(row: CompetitionEligibilityRow): CompetitionEligibilityView {
  const reasonCodes = parseJson<CompetitionEligibilityReasonCode[]>(row.reason_codes_json, []);
  const override = row.override_reason && row.overridden_by && row.overridden_at
    ? {
        reason: row.override_reason,
        actor: row.overridden_by,
        timestamp: row.overridden_at,
      }
    : null;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    version: Number(row.eligibility_snapshot_version),
    studentId: row.student_id,
    qualified: Number(row.qualified) === 1,
    reasonCodes,
    qualifiedAt: row.qualified_at,
    computedAt: row.computed_at,
    progressDigest: row.progress_digest,
    override,
  };
}

async function getCampaignRow(
  db: D1Database,
  campaignId: string,
): Promise<CompetitionEligibilityCampaignRow | null> {
  return db.prepare(`
    SELECT id, status, audience_snapshot_id, eligibility_policy_json
    FROM competition_campaigns
    WHERE id = ?
    LIMIT 1
  `).bind(campaignId).first<CompetitionEligibilityCampaignRow>();
}

async function latestVersion(db: D1Database, campaignId: string): Promise<number> {
  const row = await db.prepare(`
    SELECT COALESCE(MAX(eligibility_snapshot_version), 0) AS version
    FROM competition_eligibility
    WHERE campaign_id = ?
  `).bind(campaignId).first<{ version: number }>();
  return Number(row?.version || 0);
}

async function readVersionRows(
  db: D1Database,
  campaignId: string,
  version: number,
): Promise<CompetitionEligibilityRow[]> {
  const result = await db.prepare(`
    SELECT id, campaign_id, eligibility_snapshot_version, student_id, qualified,
           reason_codes_json, qualified_at, computed_at, progress_digest,
           override_reason, overridden_by, overridden_at
    FROM competition_eligibility
    WHERE campaign_id = ? AND eligibility_snapshot_version = ?
    ORDER BY student_id ASC
  `).bind(campaignId, version).all<CompetitionEligibilityRow>();
  return result.results || [];
}

function summaryFromRows(
  campaignId: string,
  version: number,
  rows: CompetitionEligibilityRow[],
): CompetitionEligibilitySnapshotSummary {
  return {
    campaignId,
    version,
    memberCount: rows.length,
    qualifiedCount: rows.filter((row) => Number(row.qualified) === 1).length,
    computedAt: rows[0]?.computed_at ?? null,
  };
}

function reasonCodesFor(
  roundRows: CompetitionEligibilityProgressRow[],
  requiredPassedRounds: number,
): CompetitionEligibilityReasonCode[] {
  const passedRounds = roundRows.filter((row) => Number(row.is_passed) === 1).length;
  if (passedRounds >= requiredPassedRounds) return ['QUALIFIED'];

  const reasons = roundRows
    .filter((row) => Number(row.is_passed) !== 1)
    .map((row) => `ROUND_${Number(row.round_number)}_NOT_PASSED` as CompetitionEligibilityReasonCode);
  if (roundRows.length === 6 && passedRounds === 5) reasons.push('ONLY_5_OF_6_ROUNDS_PASSED');
  return reasons;
}

export async function finalizeCompetitionEligibility(
  db: D1Database,
  campaignIdInput: string,
  actorUsername: string,
  requestId: string,
): Promise<CompetitionEligibilitySnapshotSummary> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const normalizedRequestId = normalizedId(requestId, 'COMPETITION_REQUEST_ID_REQUIRED');
  const campaign = await getCampaignRow(db, campaignId);
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');

  const existingVersion = await latestVersion(db, campaignId);
  if (existingVersion > 0) {
    const existingRows = await readVersionRows(db, campaignId, existingVersion);
    return summaryFromRows(campaignId, existingVersion, existingRows);
  }

  if (!campaign.audience_snapshot_id) throw new Error('COMPETITION_AUDIENCE_NOT_SNAPSHOTTED');
  const audienceSnapshot = await db.prepare(`
    SELECT id, campaign_id, status
    FROM competition_audience_snapshots
    WHERE id = ? AND campaign_id = ?
    LIMIT 1
  `).bind(campaign.audience_snapshot_id, campaignId)
    .first<CompetitionEligibilityAudienceSnapshotRow>();
  if (!audienceSnapshot || audienceSnapshot.status !== 'LOCKED') {
    throw new Error('COMPETITION_AUDIENCE_NOT_SNAPSHOTTED');
  }

  const policy = parseJson<{ requiredRounds?: number; requiredPassedRounds?: number }>(
    campaign.eligibility_policy_json,
    {},
  );
  const requiredRounds = Number(policy.requiredRounds || 6);
  const requiredPassedRounds = Number(policy.requiredPassedRounds || requiredRounds);
  if (!Number.isInteger(requiredRounds) || requiredRounds < 1 || requiredRounds > 6) {
    throw new Error('COMPETITION_ELIGIBILITY_POLICY_INVALID');
  }
  if (
    !Number.isInteger(requiredPassedRounds)
    || requiredPassedRounds < 1
    || requiredPassedRounds > requiredRounds
  ) {
    throw new Error('COMPETITION_ELIGIBILITY_POLICY_INVALID');
  }

  const roundResult = await db.prepare(`
    SELECT id, round_number, status
    FROM competition_rounds
    WHERE campaign_id = ? AND round_number BETWEEN 1 AND ?
    ORDER BY round_number ASC
  `).bind(campaignId, requiredRounds).all<CompetitionEligibilityRoundRow>();
  const rounds = roundResult.results || [];
  const hasRequiredRounds = rounds.length === requiredRounds
    && rounds.every((round, index) => Number(round.round_number) === index + 1);
  if (!hasRequiredRounds) throw new Error('COMPETITION_ELIGIBILITY_ROUNDS_NOT_READY');
  if (rounds.some((round) => round.status !== 'FINALIZED')) {
    throw new Error('COMPETITION_ELIGIBILITY_ROUNDS_NOT_FINALIZED');
  }

  const memberResult = await db.prepare(`
    SELECT student_id
    FROM competition_audience_members
    WHERE audience_snapshot_id = ?
    ORDER BY student_id ASC
  `).bind(audienceSnapshot.id).all<{ student_id: string }>();
  const memberIds = (memberResult.results || []).map((row) => row.student_id);

  const progressResult = await db.prepare(`
    SELECT member.student_id,
           round.id AS round_id,
           round.round_number,
           COALESCE(progress.is_passed, 0) AS is_passed,
           progress.best_score,
           progress.best_attempt_id,
           progress.version AS progress_version,
           progress.updated_at AS progress_updated_at
    FROM competition_audience_members AS member
    CROSS JOIN competition_rounds AS round
    LEFT JOIN competition_round_progress AS progress
      ON progress.campaign_id = round.campaign_id
     AND progress.round_id = round.id
     AND progress.student_id = member.student_id
    WHERE member.audience_snapshot_id = ?
      AND round.campaign_id = ?
      AND round.round_number BETWEEN 1 AND ?
    ORDER BY member.student_id ASC, round.round_number ASC
  `).bind(audienceSnapshot.id, campaignId, requiredRounds).all<CompetitionEligibilityProgressRow>();

  const progressByStudent = new Map<string, CompetitionEligibilityProgressRow[]>();
  for (const row of progressResult.results || []) {
    const rows = progressByStudent.get(row.student_id) || [];
    rows.push(row);
    progressByStudent.set(row.student_id, rows);
  }

  const computedAt = new Date().toISOString();
  const version = existingVersion + 1;
  const rowsToInsert: Array<{
    id: string;
    studentId: string;
    qualified: boolean;
    reasonCodes: CompetitionEligibilityReasonCode[];
    qualifiedAt: string | null;
    progressDigest: string;
  }> = [];

  for (const studentId of memberIds) {
    const progressRows = progressByStudent.get(studentId) || [];
    if (progressRows.length !== requiredRounds) {
      throw new Error('COMPETITION_ELIGIBILITY_PROGRESS_INCOMPLETE');
    }
    const reasonCodes = reasonCodesFor(progressRows, requiredPassedRounds);
    const qualified = reasonCodes.length === 1 && reasonCodes[0] === 'QUALIFIED';
    const digestPayload = progressRows.map((row) => ({
      roundId: row.round_id,
      roundNumber: Number(row.round_number),
      isPassed: Number(row.is_passed) === 1,
      bestScore: row.best_score === null ? null : Number(row.best_score),
      bestAttemptId: row.best_attempt_id,
      progressVersion: row.progress_version === null ? null : Number(row.progress_version),
      progressUpdatedAt: row.progress_updated_at,
    }));
    rowsToInsert.push({
      id: generateId('competition-eligibility'),
      studentId,
      qualified,
      reasonCodes,
      qualifiedAt: qualified ? computedAt : null,
      progressDigest: await sha256Hex(JSON.stringify(digestPayload)),
    });
  }

  const statements: D1PreparedStatement[] = rowsToInsert.map((row) => db.prepare(`
    INSERT INTO competition_eligibility (
      id, campaign_id, eligibility_snapshot_version, student_id, qualified,
      reason_codes_json, qualified_at, computed_at, progress_digest,
      override_reason, overridden_by, overridden_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
  `).bind(
    row.id,
    campaignId,
    version,
    row.studentId,
    row.qualified ? 1 : 0,
    JSON.stringify(row.reasonCodes),
    row.qualifiedAt,
    computedAt,
    row.progressDigest,
  ));

  statements.push(
    db.prepare(`
      UPDATE competition_campaigns
      SET status = 'ELIGIBILITY_LOCKED', updated_at = ?
      WHERE id = ?
    `).bind(computedAt, campaignId),
    auditStatement(db, {
      actorUsername: actor,
      action: 'ELIGIBILITY_FINALIZED',
      targetType: 'competition_campaign',
      targetId: campaignId,
      requestId: normalizedRequestId,
      after: {
        campaignId,
        version,
        memberCount: rowsToInsert.length,
        qualifiedCount: rowsToInsert.filter((row) => row.qualified).length,
      },
    }),
  );
  await db.batch(statements);

  const persistedRows = await readVersionRows(db, campaignId, version);
  if (persistedRows.length !== rowsToInsert.length) {
    throw new Error('COMPETITION_ELIGIBILITY_SNAPSHOT_PERSIST_FAILED');
  }
  const lockedCampaign = await getCampaignRow(db, campaignId);
  if (!lockedCampaign || lockedCampaign.status !== 'ELIGIBILITY_LOCKED') {
    throw new Error('COMPETITION_ELIGIBILITY_LOCK_FAILED');
  }
  return summaryFromRows(campaignId, version, persistedRows);
}

export async function listCompetitionEligibility(
  db: D1Database,
  campaignIdInput: string,
  options: { version?: number; classIds?: string[]; limit?: number | string; cursor?: string } = {},
): Promise<{
  campaignId: string;
  version: number;
  items: CompetitionEligibilityView[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const campaign = await getCampaignRow(db, campaignId);
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');
  const version = options.version ?? await latestVersion(db, campaignId);
  if (!Number.isInteger(version) || version <= 0) throw new Error('COMPETITION_ELIGIBILITY_NOT_FINALIZED');
  const limit = competitionLimit(options.limit);
  const scopedClassIds = options.classIds?.map((value) => String(value || '').trim()).filter(Boolean);
  const scope = `competition-eligibility:${campaignId}:${version}:${scopedClassIds?.join(',') || 'all'}`;
  const cursor = competitionCursor(
    options.cursor,
    scope,
    1,
    'COMPETITION_ELIGIBILITY_CURSOR_INVALID',
  );

  if (options.classIds !== undefined && options.classIds.length === 0) {
    return { campaignId, version, items: [], nextCursor: null, hasMore: false, limit };
  }

  const classFilter = scopedClassIds && scopedClassIds.length > 0
    ? ` AND member.class_id_at_snapshot IN (${scopedClassIds.map(() => '?').join(', ')})`
    : '';
  const cursorFilter = cursor ? ' AND eligibility.student_id > ?' : '';
  if (cursor && !cursor[0]) throw new Error('COMPETITION_ELIGIBILITY_CURSOR_INVALID');
  const result = await db.prepare(`
    SELECT eligibility.id, eligibility.campaign_id, eligibility.eligibility_snapshot_version,
           eligibility.student_id, eligibility.qualified, eligibility.reason_codes_json,
           eligibility.qualified_at, eligibility.computed_at, eligibility.progress_digest,
           eligibility.override_reason, eligibility.overridden_by, eligibility.overridden_at
    FROM competition_eligibility AS eligibility
    LEFT JOIN competition_audience_members AS member
      ON member.audience_snapshot_id = ? AND member.student_id = eligibility.student_id
    WHERE eligibility.campaign_id = ?
       AND eligibility.eligibility_snapshot_version = ?${classFilter}${cursorFilter}
    ORDER BY eligibility.student_id ASC
    LIMIT ?
  `).bind(
    campaign.audience_snapshot_id,
    campaignId,
    version,
    ...(scopedClassIds || []),
    ...(cursor ? [cursor[0]] : []),
    limit + 1,
  ).all<CompetitionEligibilityRow>();
  const rows = result.results || [];
  if (rows.length === 0 && options.classIds === undefined) {
    const versionExists = await db.prepare(`
      SELECT 1 AS found
      FROM competition_eligibility
      WHERE campaign_id = ? AND eligibility_snapshot_version = ?
      LIMIT 1
    `).bind(campaignId, version).first<{ found: number }>();
    if (!versionExists) throw new Error('COMPETITION_ELIGIBILITY_VERSION_NOT_FOUND');
  }
  const page = competitionPage(
    rows,
    limit,
    (row) => [row.student_id],
    scope,
  );
  return {
    campaignId,
    version,
    items: page.items.map(mapEligibility),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    limit: page.limit,
  };
}

export async function overrideCompetitionEligibility(
  db: D1Database,
  input: {
    campaignId: string;
    studentId: string;
    qualified: boolean;
    reason: string;
    actorUsername: string;
    requestId: string;
  },
): Promise<CompetitionEligibilityView> {
  const campaignId = normalizedId(input.campaignId, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const studentId = normalizedId(input.studentId, 'COMPETITION_STUDENT_ID_REQUIRED');
  const actor = normalizedId(input.actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const requestId = normalizedId(input.requestId, 'COMPETITION_REQUEST_ID_REQUIRED');
  const reason = String(input.reason || '').trim();
  if (!reason) throw new Error('COMPETITION_ELIGIBILITY_OVERRIDE_REASON_REQUIRED');

  const campaign = await getCampaignRow(db, campaignId);
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');
  const currentVersion = await latestVersion(db, campaignId);
  if (currentVersion <= 0) throw new Error('COMPETITION_ELIGIBILITY_NOT_FINALIZED');

  const currentRows = await readVersionRows(db, campaignId, currentVersion);
  const currentStudent = currentRows.find((row) => row.student_id === studentId);
  if (!currentStudent) throw new Error('COMPETITION_ELIGIBILITY_STUDENT_NOT_FOUND');

  const newVersion = currentVersion + 1;
  const overriddenAt = new Date().toISOString();
  const copiedRows = currentRows.map((row) => {
    const isTarget = row.student_id === studentId;
    const qualified = isTarget ? Boolean(input.qualified) : Number(row.qualified) === 1;
    const reasonCodes = isTarget
      ? (qualified
          ? ['QUALIFIED'] as CompetitionEligibilityReasonCode[]
          : ['ADMINISTRATIVE_BLOCK'] as CompetitionEligibilityReasonCode[])
      : parseJson<CompetitionEligibilityReasonCode[]>(row.reason_codes_json, []);
    return {
      id: generateId('competition-eligibility'),
      studentId: row.student_id,
      qualified,
      reasonCodes,
      qualifiedAt: isTarget
        ? (qualified ? overriddenAt : null)
        : row.qualified_at,
      computedAt: row.computed_at,
      progressDigest: row.progress_digest,
      overrideReason: isTarget ? reason : row.override_reason,
      overriddenBy: isTarget ? actor : row.overridden_by,
      overriddenAt: isTarget ? overriddenAt : row.overridden_at,
    };
  });

  const insertStatements = copiedRows.map((row) => db.prepare(`
    INSERT INTO competition_eligibility (
      id, campaign_id, eligibility_snapshot_version, student_id, qualified,
      reason_codes_json, qualified_at, computed_at, progress_digest,
      override_reason, overridden_by, overridden_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    row.id,
    campaignId,
    newVersion,
    row.studentId,
    row.qualified ? 1 : 0,
    JSON.stringify(row.reasonCodes),
    row.qualifiedAt,
    row.computedAt,
    row.progressDigest,
    row.overrideReason,
    row.overriddenBy,
    row.overriddenAt,
  ));

  await db.batch([
    ...insertStatements,
    auditStatement(db, {
      actorUsername: actor,
      action: 'ELIGIBILITY_OVERRIDDEN',
      targetType: 'competition_eligibility',
      targetId: `${campaignId}:${studentId}`,
      requestId,
      before: mapEligibility(currentStudent),
      after: {
        campaignId,
        version: newVersion,
        studentId,
        qualified: Boolean(input.qualified),
        reason,
        actor,
        timestamp: overriddenAt,
      },
    }),
  ]);

  const persisted = await db.prepare(`
    SELECT id, campaign_id, eligibility_snapshot_version, student_id, qualified,
           reason_codes_json, qualified_at, computed_at, progress_digest,
           override_reason, overridden_by, overridden_at
    FROM competition_eligibility
    WHERE campaign_id = ? AND eligibility_snapshot_version = ? AND student_id = ?
    LIMIT 1
  `).bind(campaignId, newVersion, studentId).first<CompetitionEligibilityRow>();
  if (!persisted) throw new Error('COMPETITION_ELIGIBILITY_OVERRIDE_PERSIST_FAILED');
  return mapEligibility(persisted);
}

export async function getStudentCompetitionEligibility(
  db: D1Database,
  campaignIdInput: string,
  studentIdInput: string,
): Promise<CompetitionEligibilityView> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const studentId = normalizedId(studentIdInput, 'COMPETITION_STUDENT_ID_REQUIRED');
  const campaign = await getCampaignRow(db, campaignId);
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');
  const version = await latestVersion(db, campaignId);
  if (version <= 0) throw new Error('COMPETITION_ELIGIBILITY_NOT_FINALIZED');

  const row = await db.prepare(`
    SELECT id, campaign_id, eligibility_snapshot_version, student_id, qualified,
           reason_codes_json, qualified_at, computed_at, progress_digest,
           override_reason, overridden_by, overridden_at
    FROM competition_eligibility
    WHERE campaign_id = ? AND eligibility_snapshot_version = ? AND student_id = ?
    LIMIT 1
  `).bind(campaignId, version, studentId).first<CompetitionEligibilityRow>();
  if (row) return mapEligibility(row);

  return {
    id: '',
    campaignId,
    version,
    studentId,
    qualified: false,
    reasonCodes: ['NOT_IN_AUDIENCE'],
    qualifiedAt: null,
    computedAt: null,
    progressDigest: null,
    override: null,
  };
}
