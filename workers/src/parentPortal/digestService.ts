import type { ParentDashboardPayload, ParentDigestSnapshot } from '../../../shared/parent-portal.contract';
import { createParentDashboardService, resolveIctWeekWindow } from './dashboardService';
import type { ParentEmailProvider } from './emailProvider';
import { isMinuteInQuietHours } from './accountService';

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

interface DigestCandidateRow {
  link_id: string;
  student_id: string;
  email_normalized: string;
  quiet_hours_enabled: number;
  quiet_hours_start_minute: number;
  quiet_hours_end_minute: number;
}

export interface ParentDigestRunSummary {
  rolloutReady: boolean;
  eligibleCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
}

export function buildParentDigestSnapshot(dashboard: ParentDashboardPayload): ParentDigestSnapshot {
  return {
    weekStart: dashboard.period.weekStart,
    weekEnd: dashboard.period.weekEnd,
    completedQuizzes: dashboard.metrics.completedQuizzes,
    averageScore: dashboard.metrics.averageScore,
    pendingAssignments: dashboard.metrics.pendingAssignments,
    supportAreas: dashboard.subjects
      .filter(subject => subject.correctRate < 75)
      .sort((left, right) => left.correctRate - right.correctRate)
      .slice(0, 3)
      .map(subject => ({
        subject: subject.subject.slice(0, 80),
        correctRate: subject.correctRate,
        confidence: subject.confidence,
      })),
    homeSuggestions: dashboard.recommendations.slice(0, 3).map(item => item.slice(0, 240)),
  };
}

const toIctParts = (now: Date) => {
  const ict = new Date(now.getTime() + ICT_OFFSET_MS);
  return {
    weekday: (ict.getUTCDay() || 7),
    hour: ict.getUTCHours(),
    minute: ict.getUTCHours() * 60 + ict.getUTCMinutes(),
  };
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const createParentDigestEmail = (snapshot: ParentDigestSnapshot) => {
  const supportText = snapshot.supportAreas.length > 0
    ? snapshot.supportAreas.map(item => `${item.subject}: ${item.correctRate}%`).join(', ')
    : 'Chưa có nội dung cần ưu tiên thêm trong tuần.';
  const suggestions = snapshot.homeSuggestions.length > 0
    ? snapshot.homeSuggestions.map(item => `- ${item}`).join('\n')
    : '- Tiếp tục động viên con duy trì nhịp học hiện tại.';
  const text = [
    `Tóm tắt học tập tuần ${snapshot.weekStart} – ${snapshot.weekEnd}`,
    `Bài đã hoàn thành: ${snapshot.completedQuizzes}`,
    `Điểm trung bình: ${snapshot.averageScore}`,
    `Bài đang chờ: ${snapshot.pendingAssignments}`,
    `Nội dung cần hỗ trợ: ${supportText}`,
    'Gợi ý tại nhà:',
    suggestions,
  ].join('\n');
  const supportHtml = snapshot.supportAreas.length > 0
    ? `<ul>${snapshot.supportAreas.map(item => `<li>${escapeHtml(item.subject)}: ${item.correctRate}%</li>`).join('')}</ul>`
    : '<p>Chưa có nội dung cần ưu tiên thêm trong tuần.</p>';
  const suggestionsHtml = `<ul>${(snapshot.homeSuggestions.length > 0
    ? snapshot.homeSuggestions
    : ['Tiếp tục động viên con duy trì nhịp học hiện tại.'])
    .map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  return {
    subject: `Tóm tắt học tập tuần ${snapshot.weekStart}`,
    text,
    html: `<h1>Tóm tắt học tập tuần</h1><p>${escapeHtml(snapshot.weekStart)} – ${escapeHtml(snapshot.weekEnd)}</p><p>Bài đã hoàn thành: <strong>${snapshot.completedQuizzes}</strong></p><p>Điểm trung bình: <strong>${snapshot.averageScore}</strong></p><p>Bài đang chờ: <strong>${snapshot.pendingAssignments}</strong></p><h2>Nội dung cần hỗ trợ</h2>${supportHtml}<h2>Gợi ý tại nhà</h2>${suggestionsHtml}`,
  };
};

const addDigestAudit = async (
  db: D1Database,
  linkId: string,
  action: 'DIGEST_SENT' | 'DIGEST_FAILED',
  weekStart: string,
  nowIso: string,
): Promise<void> => {
  await db.prepare(`
    INSERT INTO parent_account_audit (id, link_id, action, request_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    `paa-${crypto.randomUUID()}`,
    linkId,
    action,
    `digest:${linkId}:${weekStart}`,
    JSON.stringify({ weekStart }),
    nowIso,
  ).run();
};

export async function runWeeklyParentDigests(
  db: D1Database,
  provider: ParentEmailProvider,
  now = new Date(),
): Promise<ParentDigestRunSummary> {
  if (!provider.ready) {
    return { rolloutReady: false, eligibleCount: 0, sentCount: 0, skippedCount: 0, failedCount: 0 };
  }
  const ict = toIctParts(now);
  const candidates = await db.prepare(`
    SELECT p.link_id, l.student_id, p.email_normalized,
           p.quiet_hours_enabled, p.quiet_hours_start_minute, p.quiet_hours_end_minute
    FROM parent_contact_preferences p
    JOIN parent_links l ON l.id = p.link_id
    WHERE l.status = 'ACTIVE'
      AND p.weekly_digest_enabled = 1
      AND p.email_verified_at IS NOT NULL
      AND p.email_normalized IS NOT NULL
      AND p.digest_weekday = ?
      AND p.digest_hour = ?
  `).bind(ict.weekday, ict.hour).all<DigestCandidateRow>();
  const dashboardService = createParentDashboardService(db);
  const week = resolveIctWeekWindow(undefined, now);
  const summary: ParentDigestRunSummary = {
    rolloutReady: true,
    eligibleCount: candidates.results.length,
    sentCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };

  for (const candidate of candidates.results) {
    if (Number(candidate.quiet_hours_enabled) === 1 && isMinuteInQuietHours(
      ict.minute,
      Number(candidate.quiet_hours_start_minute),
      Number(candidate.quiet_hours_end_minute),
    )) {
      summary.skippedCount += 1;
      continue;
    }
    const runId = `pdr-${crypto.randomUUID()}`;
    const nowIso = now.toISOString();
    const dashboard = await dashboardService.loadDashboard(candidate.student_id, week, now);
    const snapshot = buildParentDigestSnapshot(dashboard);
    const reservation = await db.prepare(`
      INSERT OR IGNORE INTO parent_digest_runs (
        id, link_id, student_id, week_start, status, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)
    `).bind(
      runId,
      candidate.link_id,
      candidate.student_id,
      week.weekStart,
      JSON.stringify(snapshot),
      nowIso,
      nowIso,
    ).run();
    if (Number(reservation.meta.changes || 0) !== 1) {
      summary.skippedCount += 1;
      continue;
    }
    try {
      const email = createParentDigestEmail(snapshot);
      const sent = await provider.send({
        to: candidate.email_normalized,
        ...email,
        idempotencyKey: `parent-digest:${candidate.link_id}:${week.weekStart}`,
      });
      await db.prepare(`
        UPDATE parent_digest_runs
        SET status = 'SENT', provider_message_id = ?, sent_at = ?, updated_at = ?
        WHERE id = ? AND status = 'PENDING'
      `).bind(sent.messageId, nowIso, nowIso, runId).run();
      await addDigestAudit(db, candidate.link_id, 'DIGEST_SENT', week.weekStart, nowIso);
      summary.sentCount += 1;
    } catch (error) {
      const errorCode = error instanceof Error ? error.message.split(':')[0].slice(0, 80) : 'PARENT_EMAIL_FAILED';
      await db.prepare(`
        UPDATE parent_digest_runs
        SET status = 'FAILED', error_code = ?, updated_at = ?
        WHERE id = ? AND status = 'PENDING'
      `).bind(errorCode, nowIso, runId).run();
      await addDigestAudit(db, candidate.link_id, 'DIGEST_FAILED', week.weekStart, nowIso);
      summary.failedCount += 1;
    }
  }
  return summary;
}
