import type {
  ResultReportBatchStatus,
  ResultReportDeliveryItem,
} from '../../../../shared/result-reports.contract';
import type { Env } from '../../types';
import { createParentNotification } from '../../parentPortal/notificationService';
import { createNotification } from '../../services/notificationWriter';
import type { JWTPayload } from '../../utils/jwt';
import { handleUpsertPhieu } from '../phieu/phieuUpsertService';
import { resultSubmissionKey } from '../phieu/phieuRepository';
import { ensureActivePublicPhieuLink } from '../phieu/publicLinkService';
import {
  buildResultReportCohort,
  type ResultReportRosterRow,
  type ResultReportSourceRow,
} from './attemptSelection';
import {
  getOwnedResultReportBatch,
  loadResultReportDeliveryItems,
  updateResultReportBatchStatus,
  updateResultReportDeliveryItem,
  type ResultReportBatchRecord,
  type ResultReportDeliveryItemRecord,
} from './batchRepository';
import { loadResultReportCohortScope } from './cohortRepository';
import type { ResultReportCohortScope } from './types';

export interface CanonicalResultReportPhieuInput {
  resultId: string;
  studentId: string;
  studentName: string;
  classId: string;
  subject: string;
  quizTitle: string;
  submittedAt: string;
  totalQuestions: number;
  correctCount: number;
  score: number;
  commentMode: 'ai' | 'manual';
  style: 'nhe_nhang' | 'nghiem_tuc' | 'vui_ve';
  comment: string;
  needsImprovement: string;
  encouragement: string;
  teacherId: string;
}

export interface ResultReportDeliveryRuntime {
  loadBatch(batchId: string): Promise<ResultReportBatchRecord | null>;
  loadItems(batchId: string, itemIds?: string[]): Promise<ResultReportDeliveryItemRecord[]>;
  loadScope(batch: ResultReportBatchRecord): Promise<ResultReportCohortScope>;
  updateBatchStatus(batchId: string, status: ResultReportBatchStatus): Promise<void>;
  updateItem(itemId: string, patch: Partial<ResultReportDeliveryItemRecord>): Promise<void>;
  upsertPhieu(input: CanonicalResultReportPhieuInput): Promise<{ id: string }>;
  ensureParentLink(input: {
    phieuId: string;
    batchId: string;
    studentName: string;
    expiresAt: string;
  }): Promise<{ id: string; url: string }>;
  insertNotification(input: {
    notificationId: string;
    studentId: string;
    phieuId: string;
    resultId: string;
    batchId: string;
    quizId: string;
    quizTitle: string;
    score: number;
    teacherName: string;
  }): Promise<string>;
  insertParentNotification?(input: {
    studentId: string;
    phieuId: string;
    resultId: string;
    batchId: string;
    quizId: string;
    quizTitle: string;
    teacherName: string;
  }): Promise<void>;
}

const addDays = (value: string, days: number): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return new Date(Date.now() + days * 86400000).toISOString();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

const errorText = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
).slice(0, 1000);

const applyPatch = async (
  runtime: ResultReportDeliveryRuntime,
  item: ResultReportDeliveryItemRecord,
  patch: Partial<ResultReportDeliveryItemRecord>,
): Promise<void> => {
  Object.assign(item, patch);
  await runtime.updateItem(item.id, patch);
};

const toCohort = (scope: ResultReportCohortScope, policy: ResultReportBatchRecord['attemptPolicy']) => {
  const roster: ResultReportRosterRow[] = scope.roster.map((student) => ({
    id: String(student.id),
    fullName: student.full_name,
    username: student.username,
    parentPhone: student.parent_phone ?? null,
  }));
  const results: ResultReportSourceRow[] = scope.results.map((result) => ({
    id: String(result.id),
    studentName: result.student_name,
    score: Number(result.score) || 0,
    correctCount: Number(result.correct_count) || 0,
    totalQuestions: Number(result.total_questions) || 0,
    submittedAt: result.submitted_at,
    quizTitle: result.quiz_title || scope.quiz.title,
  }));
  return buildResultReportCohort(roster, results, policy);
};

export async function processResultReportBatch(
  batchId: string,
  runtime: ResultReportDeliveryRuntime,
  itemIds?: string[],
): Promise<ResultReportBatchStatus> {
  const batch = await runtime.loadBatch(batchId);
  if (!batch) throw new Error('Result report batch not found');
  const items = await runtime.loadItems(batchId, itemIds);
  const scope = await runtime.loadScope(batch);
  const cohort = toCohort(scope, batch.attemptPolicy);
  const readyByResultId = new Map(cohort.ready.map((entry) => [entry.result.id, entry]));
  await runtime.updateBatchStatus(batchId, 'sending');

  for (const item of items) {
    const canonical = readyByResultId.get(item.resultId);
    const now = new Date().toISOString();
    await applyPatch(runtime, item, {
      attemptCount: item.attemptCount + 1,
      lastError: null,
      updatedAt: now,
    });
    if (!canonical || canonical.student.id !== item.studentId) {
      await applyPatch(runtime, item, {
        studentStatus: batch.notifyStudents ? 'unresolved' : 'not_requested',
        parentStatus: batch.createParentLinks ? 'failed' : 'not_requested',
        lastError: 'Result is no longer in the selected cohort',
        updatedAt: now,
      });
      continue;
    }

    let phieuId = item.phieuId;
    if (!phieuId) {
      try {
        const phieu = await runtime.upsertPhieu({
          resultId: item.resultId,
          studentId: canonical.student.id,
          studentName: canonical.student.fullName,
          classId: batch.classId,
          subject: scope.quiz.category || '',
          quizTitle: scope.quiz.title,
          submittedAt: canonical.result.submittedAt,
          totalQuestions: canonical.result.totalQuestions,
          correctCount: canonical.result.correctCount,
          score: canonical.result.score,
          commentMode: item.draft.commentMode === 'ai' ? 'ai' : 'manual',
          style: item.draft.style,
          comment: item.draft.comment,
          needsImprovement: item.draft.needsImprovement,
          encouragement: item.draft.encouragement,
          teacherId: batch.teacherId,
        });
        phieuId = phieu.id;
        await applyPatch(runtime, item, { phieuId, updatedAt: now });
      } catch (error) {
        const message = errorText(error);
        await applyPatch(runtime, item, {
          studentStatus: batch.notifyStudents ? 'failed' : 'not_requested',
          parentStatus: batch.createParentLinks ? 'failed' : 'not_requested',
          lastError: message,
          updatedAt: now,
        });
        continue;
      }
    }

    const errors: string[] = [];
    if (runtime.insertParentNotification) {
      try {
        await runtime.insertParentNotification({
          studentId: canonical.student.id,
          phieuId,
          resultId: item.resultId,
          batchId,
          quizId: batch.quizId,
          quizTitle: batch.quizTitle,
          teacherName: batch.teacherId,
        });
      } catch (error) {
        errors.push(`Parent notification: ${errorText(error)}`);
      }
    }

    if (batch.createParentLinks
      && !['link_created', 'opened', 'revoked'].includes(item.parentStatus)) {
      try {
        const link = await runtime.ensureParentLink({
          phieuId,
          batchId,
          studentName: canonical.student.fullName,
          expiresAt: batch.expiresAt || addDays(batch.createdAt, 30),
        });
        await applyPatch(runtime, item, {
          publicLinkId: link.id,
          parentStatus: 'link_created',
          updatedAt: now,
        });
      } catch (error) {
        errors.push(`Parent link: ${errorText(error)}`);
        await applyPatch(runtime, item, { parentStatus: 'failed', updatedAt: now });
      }
    } else if (!batch.createParentLinks && item.parentStatus !== 'not_requested') {
      await applyPatch(runtime, item, { parentStatus: 'not_requested', updatedAt: now });
    }

    if (batch.notifyStudents && !['sent', 'viewed'].includes(item.studentStatus)) {
      try {
        const notificationId = await runtime.insertNotification({
          notificationId: `rrn-${item.id}`,
          studentId: canonical.student.id,
          phieuId,
          resultId: item.resultId,
          batchId,
          quizId: batch.quizId,
          quizTitle: batch.quizTitle,
          score: canonical.result.score,
          teacherName: batch.teacherId,
        });
        await applyPatch(runtime, item, {
          notificationId,
          studentStatus: 'sent',
          updatedAt: now,
        });
      } catch (error) {
        errors.push(`Student notification: ${errorText(error)}`);
        await applyPatch(runtime, item, { studentStatus: 'failed', updatedAt: now });
      }
    } else if (!batch.notifyStudents && item.studentStatus !== 'not_requested') {
      await applyPatch(runtime, item, { studentStatus: 'not_requested', updatedAt: now });
    }

    await applyPatch(runtime, item, {
      lastError: errors.length > 0 ? errors.join('; ') : null,
      updatedAt: now,
    });
  }

  const refreshed = await runtime.loadItems(batchId);
  const hasFailure = refreshed.some((item) => (
    item.studentStatus === 'failed'
    || item.studentStatus === 'unresolved'
    || item.parentStatus === 'failed'
  ));
  const finalStatus: ResultReportBatchStatus = hasFailure ? 'partial_failed' : 'completed';
  await runtime.updateBatchStatus(batchId, finalStatus);
  return finalStatus;
}

export function createResultReportDeliveryRuntime(
  env: Env,
  user: JWTPayload,
): ResultReportDeliveryRuntime {
  const teacherId = user.username;
  const isAdmin = user.role === 'admin';
  return {
    loadBatch: (batchId) => getOwnedResultReportBatch(env.DB, batchId, teacherId, isAdmin),
    loadItems: (batchId, itemIds) => loadResultReportDeliveryItems(env.DB, batchId, itemIds),
    loadScope: async (batch) => {
      const scope = await loadResultReportCohortScope(env, user, {
        classId: batch.classId,
        quizId: batch.quizId,
        attemptPolicy: batch.attemptPolicy,
      });
      if (scope instanceof Response) {
        const payload = await scope.text();
        throw new Error(payload || 'Unable to load result report scope');
      }
      return scope;
    },
    updateBatchStatus: (batchId, status) => updateResultReportBatchStatus(env.DB, batchId, status),
    updateItem: (itemId, patch) => updateResultReportDeliveryItem(env.DB, itemId, patch),
    upsertPhieu: async (input) => {
      const response = await handleUpsertPhieu(env.DB, {
        submission_id: resultSubmissionKey(input.resultId),
        student_id: input.studentId,
        student_name: input.studentName,
        class_id: input.classId,
        mon_hoc: input.subject,
        ten_bai_tap: input.quizTitle,
        ngay_lam_bai: input.submittedAt,
        tong_cau: input.totalQuestions,
        so_cau_dung: input.correctCount,
        so_cau_sai: Math.max(0, input.totalQuestions - input.correctCount),
        diem_so: input.score,
        nhan_xet_mode: input.commentMode,
        nhan_xet_style: input.style,
        nhan_xet: input.comment,
        noi_dung_co_gang: input.needsImprovement,
        loi_dong_vien: input.encouragement,
        status: 'published',
        created_by: input.teacherId,
      }, env.OG_IMAGES);
      const payload = await response.json<any>();
      if (!response.ok || !payload?.data?.id) {
        throw new Error(payload?.message || 'Unable to save result report');
      }
      return { id: String(payload.data.id) };
    },
    ensureParentLink: async (input) => {
      const link = await ensureActivePublicPhieuLink(env.DB, input);
      return { id: String(link.id || ''), url: String(link.url || '') };
    },
    insertNotification: async (input) => {
      await createNotification(env.DB, {
        id: input.notificationId,
        userId: input.studentId,
        userRole: 'student',
        type: 'result_report_ready',
        priority: 'IMPORTANT',
        title: 'Em có phiếu kết quả mới',
        body: `${user.fullName || input.teacherName} đã gửi kết quả bài “${input.quizTitle}”. Điểm của em: ${input.score}/10.`,
        actionUrl: `/student/results?report=${encodeURIComponent(input.phieuId)}`,
        data: {
          phieu_id: input.phieuId,
          report_id: input.phieuId,
          result_id: input.resultId,
          quiz_id: input.quizId,
          batch_id: input.batchId,
        },
        sourceType: 'result_report',
        sourceId: input.phieuId,
      });
      return input.notificationId;
    },
    insertParentNotification: async (input) => {
      await createParentNotification(env.DB, {
        studentId: input.studentId,
        kind: 'result_report',
        sourceType: 'result_report',
        sourceId: input.phieuId,
        title: 'Có phiếu kết quả và nhận xét mới',
        body: `${user.fullName || input.teacherName} đã gửi nhận xét bài “${input.quizTitle}”.`,
        payload: {
          phieuId: input.phieuId,
          resultId: input.resultId,
          quizId: input.quizId,
        },
        publishedAt: new Date().toISOString(),
        createdBy: user.username,
      });
    },
  };
}

export const mapDeliveryItemForApi = (item: ResultReportDeliveryItemRecord): Partial<ResultReportDeliveryItem> => ({
  id: item.id,
  batchId: item.batchId,
  resultId: item.resultId,
  phieuId: item.phieuId,
  studentId: item.studentId,
  studentName: item.studentName,
  parentPhone: item.parentPhone,
  notificationId: item.notificationId,
  publicLinkId: item.publicLinkId,
  studentStatus: item.studentStatus,
  parentStatus: item.parentStatus,
  attemptCount: item.attemptCount,
  lastError: item.lastError,
});
