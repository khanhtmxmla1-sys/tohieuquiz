import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CreateResultReportBatchRequest,
  ResultReportAttemptPolicy,
  ResultReportBatchDetail,
  ResultReportCohortReadyItem,
  ResultReportCohortResponse,
  ResultReportDraftInput,
} from '../../../../shared/result-reports.contract';
import { getClasses } from '../../../services/classroomService';
import {
  buildResultReportReviewState,
  ensureResultReportRequestId,
  filterResultReportReviewItems,
  toggleResultReportSelection,
  type ResultReportReviewFilter,
  type ResultReportReviewState,
} from '../model/resultReportDelivery';
import {
  normalizeResultReportDeliveryError,
  resultReportDeliveryService,
} from '../services/resultReportDeliveryService';

export type ResultReportWizardStep = 'scope' | 'review' | 'delivery' | 'summary';
export type ResultReportCommentStyle = ResultReportDraftInput['style'];

interface UseResultReportDeliveryOptions {
  isOpen: boolean;
  className: string;
  quizId: string;
  quizTitle: string;
  requestIdFactory?: () => string;
}

const normalizeClassName = (value: string): string => value
  .normalize('NFC')
  .trim()
  .replace(/^lớp\s+/i, '')
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('vi-VN');

const classify = (score: number): string => {
  if (score >= 9) return 'Xuất sắc';
  if (score >= 8) return 'Giỏi';
  if (score >= 6.5) return 'Khá';
  if (score >= 5) return 'Đạt';
  return 'Cần cố gắng';
};

export const buildResultReportDraft = (
  item: ResultReportCohortReadyItem,
  style: ResultReportCommentStyle,
): ResultReportDraftInput => {
  const name = item.student.fullName;
  const score = item.result.score;
  const level = classify(score).toLocaleLowerCase('vi-VN');
  if (style === 'nghiem_tuc') {
    return {
      resultId: item.result.id,
      style,
      commentMode: 'ai',
      comment: `${name} đạt mức ${level} với ${score}/10 điểm. Em cần rà soát kỹ các phần còn sai và trình bày câu trả lời rõ ràng hơn.`,
      needsImprovement: 'Tập trung sửa lỗi sai, luyện lại dạng bài chưa chắc và kiểm tra bài trước khi nộp.',
      encouragement: 'Cố gắng đều mỗi ngày, kết quả sẽ tiến bộ rõ rệt.',
    };
  }
  if (style === 'vui_ve') {
    return {
      resultId: item.result.id,
      style,
      commentMode: 'ai',
      comment: `${name} đã hoàn thành bài với tinh thần tốt và đạt ${score}/10 điểm. Những phần làm đúng cho thấy em đang nắm bài khá ổn.`,
      needsImprovement: 'Luyện thêm các câu còn nhầm và thử tự giải lại bài sau khi xem đáp án.',
      encouragement: 'Tiếp tục giữ nhịp học vui vẻ này nhé, em đang đi đúng hướng.',
    };
  }
  return {
    resultId: item.result.id,
    style,
    commentMode: 'ai',
    comment: `${name} đã có nhiều cố gắng trong bài làm và đạt ${score}/10 điểm. Em có nền tảng tốt ở các phần đã làm đúng.`,
    needsImprovement: 'Cần luyện thêm những câu còn sai, đọc kỹ đề và trình bày từng bước cẩn thận hơn.',
    encouragement: 'Thầy cô tin rằng em sẽ tiến bộ nếu duy trì sự chăm chỉ này.',
  };
};

const createDraftMap = (
  cohort: ResultReportCohortResponse,
  style: ResultReportCommentStyle,
): Record<string, ResultReportDraftInput> => Object.fromEntries(
  cohort.ready.map((item) => [item.result.id, buildResultReportDraft(item, style)]),
);

export const useResultReportDelivery = ({
  isOpen,
  className,
  quizId,
  quizTitle,
  requestIdFactory,
}: UseResultReportDeliveryOptions) => {
  const [step, setStep] = useState<ResultReportWizardStep>('scope');
  const [attemptPolicy, setAttemptPolicyState] = useState<ResultReportAttemptPolicy>('latest');
  const [cohort, setCohort] = useState<ResultReportCohortResponse | null>(null);
  const [reviewState, setReviewState] = useState<ResultReportReviewState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ResultReportDraftInput>>({});
  const [style, setStyleState] = useState<ResultReportCommentStyle>('nhe_nhang');
  const [activeResultId, setActiveResultId] = useState('');
  const [reviewQuery, setReviewQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ResultReportReviewFilter>('all');
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [createParentLinks, setCreateParentLinks] = useState(true);
  const [prepareExternalList, setPrepareExternalList] = useState(false);
  const [batchDetail, setBatchDetail] = useState<ResultReportBatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const styleRef = useRef<ResultReportCommentStyle>('nhe_nhang');

  const reset = useCallback(() => {
    setStep('scope');
    setAttemptPolicyState('latest');
    setCohort(null);
    setReviewState(null);
    setDrafts({});
    styleRef.current = 'nhe_nhang';
    setStyleState('nhe_nhang');
    setActiveResultId('');
    setReviewQuery('');
    setReviewFilter('all');
    setNotifyStudents(true);
    setCreateParentLinks(true);
    setPrepareExternalList(false);
    setBatchDetail(null);
    setError(null);
    requestIdRef.current = null;
  }, []);

  const loadCohort = useCallback(async (policy: ResultReportAttemptPolicy) => {
    setIsLoading(true);
    setError(null);
    try {
      const classes = await getClasses(undefined, false);
      const target = normalizeClassName(className);
      const classroom = classes.find((item) => normalizeClassName(item.name) === target);
      if (!classroom) throw new Error(`Không tìm thấy lớp ${className} trong danh sách được quản lý.`);
      const next = await resultReportDeliveryService.getCohort({
        classId: classroom.id,
        quizId,
        attemptPolicy: policy,
      });
      setCohort(next);
      setReviewState(buildResultReportReviewState(next));
      setDrafts(createDraftMap(next, styleRef.current));
      setActiveResultId(next.ready[0]?.result.id || '');
    } catch (caught) {
      setError(normalizeResultReportDeliveryError(caught).message);
    } finally {
      setIsLoading(false);
    }
  }, [className, quizId]);

  useEffect(() => {
    if (!isOpen) return;
    reset();
    void loadCohort('latest');
  }, [isOpen, loadCohort, reset]);

  const setAttemptPolicy = useCallback((policy: ResultReportAttemptPolicy) => {
    setAttemptPolicyState(policy);
    setStep('scope');
    void loadCohort(policy);
  }, [loadCohort]);

  const selectedCount = reviewState?.selectedResultIds.size ?? 0;
  const visibleItems = useMemo(() => reviewState
    ? filterResultReportReviewItems(reviewState, reviewQuery, reviewFilter)
    : [], [reviewState, reviewQuery, reviewFilter]);
  const activeItem = useMemo(() => cohort?.ready.find((item) => item.result.id === activeResultId)
    || visibleItems[0]
    || cohort?.ready[0]
    || null, [activeResultId, cohort, visibleItems]);
  const activeDraft = activeItem ? drafts[activeItem.result.id] ?? null : null;

  const toggleSelection = useCallback((resultId: string) => {
    setReviewState((current) => current ? toggleResultReportSelection(current, resultId) : current);
  }, []);

  const selectAll = useCallback((selected: boolean) => {
    setReviewState((current) => {
      if (!current) return current;
      return {
        ...current,
        selectedResultIds: selected
          ? new Set(current.cohort.ready.map((item) => item.result.id))
          : new Set(),
      };
    });
  }, []);

  const updateDraft = useCallback((resultId: string, patch: Partial<ResultReportDraftInput>) => {
    setDrafts((current) => ({
      ...current,
      [resultId]: {
        ...current[resultId],
        ...patch,
        resultId,
        commentMode: 'manual',
      },
    }));
  }, []);

  const regenerateDraft = useCallback((resultId: string, nextStyle = style) => {
    const item = cohort?.ready.find((entry) => entry.result.id === resultId);
    if (!item) return;
    setDrafts((current) => ({ ...current, [resultId]: buildResultReportDraft(item, nextStyle) }));
  }, [cohort, style]);

  const setStyle = useCallback((nextStyle: ResultReportCommentStyle) => {
    styleRef.current = nextStyle;
    setStyleState(nextStyle);
    if (!cohort) return;
    setDrafts(createDraftMap(cohort, nextStyle));
  }, [cohort]);

  const goNext = useCallback(() => {
    if (step === 'scope' && cohort && selectedCount > 0) setStep('review');
    else if (step === 'review' && selectedCount > 0) setStep('delivery');
  }, [cohort, selectedCount, step]);

  const goBack = useCallback(() => {
    if (step === 'delivery') setStep('review');
    else if (step === 'review') setStep('scope');
    else if (step === 'summary') setStep('delivery');
  }, [step]);

  const submit = useCallback(async () => {
    if (!cohort || !reviewState || selectedCount === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      requestIdRef.current = ensureResultReportRequestId(
        requestIdRef.current,
        requestIdFactory,
      );
      const payload: CreateResultReportBatchRequest = {
        requestId: requestIdRef.current,
        classId: cohort.class.id,
        quizId: cohort.quiz.id,
        attemptPolicy,
        drafts: cohort.ready
          .filter((item) => reviewState.selectedResultIds.has(item.result.id))
          .map((item) => drafts[item.result.id]),
        notifyStudents,
        createParentLinks,
        expiresInDays: 30,
      };
      const created = await resultReportDeliveryService.createBatch(payload);
      const detail = await resultReportDeliveryService.getBatch(created.batchId);
      setBatchDetail(detail);
      setStep('summary');
    } catch (caught) {
      setError(normalizeResultReportDeliveryError(caught).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [attemptPolicy, cohort, createParentLinks, drafts, notifyStudents, requestIdFactory, reviewState, selectedCount]);

  const retryFailed = useCallback(async () => {
    if (!batchDetail) return;
    const failedIds = batchDetail.items
      .filter((item) => item.studentStatus === 'failed'
        || item.studentStatus === 'unresolved'
        || item.parentStatus === 'failed')
      .map((item) => item.id);
    if (failedIds.length === 0) return;
    setIsSubmitting(true);
    try {
      setBatchDetail(await resultReportDeliveryService.retryBatch(batchDetail.batch.id, failedIds));
    } catch (caught) {
      setError(normalizeResultReportDeliveryError(caught).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [batchDetail]);

  const revokeLinks = useCallback(async (itemIds?: string[]) => {
    if (!batchDetail) return;
    setIsSubmitting(true);
    try {
      setBatchDetail(await resultReportDeliveryService.revokeLinks(batchDetail.batch.id, itemIds));
    } catch (caught) {
      setError(normalizeResultReportDeliveryError(caught).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [batchDetail]);

  return {
    step,
    setStep,
    attemptPolicy,
    setAttemptPolicy,
    cohort,
    reviewState,
    visibleItems,
    activeItem,
    activeDraft,
    drafts,
    style,
    setStyle,
    activeResultId,
    setActiveResultId,
    reviewQuery,
    setReviewQuery,
    reviewFilter,
    setReviewFilter,
    selectedCount,
    toggleSelection,
    selectAll,
    updateDraft,
    regenerateDraft,
    notifyStudents,
    setNotifyStudents,
    createParentLinks,
    setCreateParentLinks,
    prepareExternalList,
    setPrepareExternalList,
    batchDetail,
    isLoading,
    isSubmitting,
    error,
    loadCohort: () => loadCohort(attemptPolicy),
    goNext,
    goBack,
    submit,
    retryFailed,
    revokeLinks,
    quizTitle,
    className,
  };
};
