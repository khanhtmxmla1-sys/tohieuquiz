import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Quiz } from '../../../../types';
import { getSystemDefaultDeadline, systemDateTimeLocalToIso } from '../../../../utils/dateTime';
import type {
  InterventionAssignmentPreview,
  InterventionGroup,
} from '../../../../../shared/intervention.contract';
import {
  createInterventionAssignments,
  previewInterventionAssignments,
} from '../../../../services/results/interventionService';
import { InterventionAssignmentStatus } from './InterventionAssignmentStatus';
import { InterventionQuizRecommendations } from './InterventionQuizRecommendations';

export interface InterventionAssignmentFormProps {
  group: InterventionGroup;
  quizzes: Quiz[];
  onSaved: () => Promise<void>;
  onClose: () => void;
}

const defaultDeadline = (): string => getSystemDefaultDeadline(7);

export const InterventionAssignmentForm: React.FC<InterventionAssignmentFormProps> = ({
  group,
  quizzes,
  onSaved,
  onClose,
}) => {
  const recommendedQuizIds = useMemo(
    () => new Set(group.recommendedQuizzes.map((quiz) => quiz.quizId)),
    [group.recommendedQuizzes],
  );
  const orderedQuizzes = useMemo(() => [...quizzes].sort((left, right) => {
    const leftRecommended = recommendedQuizIds.has(left.id);
    const rightRecommended = recommendedQuizIds.has(right.id);
    if (leftRecommended !== rightRecommended) return leftRecommended ? -1 : 1;
    return left.title.localeCompare(right.title);
  }), [quizzes, recommendedQuizIds]);
  const initialQuizId = group.recommendedQuizzes[0]?.quizId || orderedQuizzes[0]?.id || '';
  const [quizId, setQuizId] = useState(initialQuizId);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [preview, setPreview] = useState<InterventionAssignmentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef(`intervention-${group.id}-${crypto.randomUUID()}`);

  const deadlineIso = (() => {
    try {
      return systemDateTimeLocalToIso(deadline);
    } catch {
      return '';
    }
  })();
  const deadlineValid = Boolean(deadlineIso) && Date.parse(deadlineIso) > Date.now();
  const attemptsValid = Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 10;
  const canSubmit = Boolean(quizId) && deadlineValid && attemptsValid && !submitting && !previewLoading;

  useEffect(() => {
    let cancelled = false;
    if (!quizId) {
      setPreview(null);
      return () => { cancelled = true; };
    }
    setPreviewLoading(true);
    setPreviewError('');
    void previewInterventionAssignments(group.id, quizId)
      .then((nextPreview) => {
        if (!cancelled) setPreview(nextPreview);
      })
      .catch((error) => {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(error instanceof Error ? error.message : 'Không thể kiểm tra bài đang mở.');
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [group.id, quizId]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    setResultMessage('');
    try {
      const result = await createInterventionAssignments(group.id, {
        quizId,
        deadline: deadlineIso,
        maxAttempts,
        idempotencyKey: idempotencyKeyRef.current,
      });
      setResultMessage(
        `Đã tạo ${result.assignmentIds.length} bài mới · Bỏ qua ${result.skippedAssignmentIds.length} bài đang mở.`,
      );
      await onSaved();
      const refreshedPreview = await previewInterventionAssignments(group.id, quizId);
      setPreview(refreshedPreview);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Không thể giao bài cho nhóm.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4" aria-label={`Tạo bài luyện cho ${group.name}`}>
      <p className="text-sm font-semibold text-slate-900">Kiểm tra bài luyện và xác nhận giao</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Nhóm có {group.members.length} học sinh. Hệ thống chỉ tạo bài mới cho học sinh chưa có bài tương ứng đang mở.
      </p>

      <InterventionQuizRecommendations recommendations={group.recommendedQuizzes} />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <label htmlFor={`intervention-quiz-${group.id}`} className="text-sm font-medium text-slate-700">Bài kiểm tra</label>
          <select
            id={`intervention-quiz-${group.id}`}
            value={quizId}
            onChange={(event) => {
              setQuizId(event.target.value);
              setResultMessage('');
              setSubmitError('');
            }}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Chọn bài</option>
            {orderedQuizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor={`intervention-deadline-${group.id}`} className="text-sm font-medium text-slate-700">Hạn hoàn thành</label>
          <input
            id={`intervention-deadline-${group.id}`}
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">Giờ Hà Nội (GMT+7)</p>
          {!deadlineValid && <p className="mt-1 text-xs font-medium text-red-600">Hạn hoàn thành phải ở tương lai.</p>}
        </div>

        <div>
          <label htmlFor={`intervention-attempts-${group.id}`} className="text-sm font-medium text-slate-700">Số lượt làm</label>
          <input
            id={`intervention-attempts-${group.id}`}
            type="number"
            min={1}
            max={10}
            value={maxAttempts}
            onChange={(event) => setMaxAttempts(Number(event.target.value))}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {!attemptsValid && <p className="mt-1 text-xs font-medium text-red-600">Số lượt làm phải từ 1 đến 10.</p>}
        </div>
      </div>

      <InterventionAssignmentStatus
        preview={preview}
        previewLoading={previewLoading}
        previewError={previewError}
        submitError={submitError}
        resultMessage={resultMessage}
      />

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          Đóng
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          aria-busy={submitting}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <RefreshCw size={16} className="animate-spin" aria-hidden="true" />}
          Giao bài cho nhóm
        </button>
      </div>
    </div>
  );
};

export default InterventionAssignmentForm;
