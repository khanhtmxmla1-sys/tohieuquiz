import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../../../../stores/useAuthStore';
import { useResultReportDelivery } from '../../hooks/useResultReportDelivery';
import { DeliveryStep } from './DeliveryStep';
import { DeliverySummary } from './DeliverySummary';
import { ResultReportStepper } from './ResultReportStepper';
import { ReviewStep } from './ReviewStep';
import { ScopeStep } from './ScopeStep';

export interface ResultReportDeliveryWizardProps {
  isOpen: boolean;
  className: string;
  quizId: string;
  quizTitle: string;
  onClose: () => void;
  requestIdFactory?: () => string;
}

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const ResultReportDeliveryWizard: React.FC<ResultReportDeliveryWizardProps> = ({
  isOpen,
  className,
  quizId,
  quizTitle,
  onClose,
  requestIdFactory,
}) => {
  const teacherName = useAuthStore((state) => state.fullName) || '';
  const controller = useResultReportDelivery({
    isOpen,
    className,
    quizId,
    quizTitle,
    requestIdFactory,
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const skippedCount = (controller.cohort?.notCompleted.length ?? 0)
    + (controller.cohort?.unresolved.length ?? 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-report-wizard-title"
        aria-label="Tạo và gửi phiếu kết quả"
        className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-[#fffdf7] sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl sm:border sm:border-slate-200"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium text-sky-700">Kết quả học tập</p>
            <h2 id="result-report-wizard-title" className="mt-1 text-xl font-semibold text-slate-900">Tạo và gửi phiếu kết quả</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ tạo phiếu"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {controller.step !== 'summary' && <ResultReportStepper step={controller.step} />}

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fffdf7]">
          {controller.step === 'scope' && (
            <ScopeStep
              className={className}
              quizTitle={quizTitle}
              attemptPolicy={controller.attemptPolicy}
              onAttemptPolicyChange={controller.setAttemptPolicy}
              cohort={controller.cohort}
              isLoading={controller.isLoading}
              error={controller.error}
              onRetry={controller.loadCohort}
              onContinue={controller.goNext}
            />
          )}
          {controller.step === 'review' && controller.reviewState && (
            <ReviewStep
              items={controller.visibleItems}
              allCount={controller.cohort?.ready.length ?? 0}
              selectedResultIds={controller.reviewState.selectedResultIds}
              selectedCount={controller.selectedCount}
              activeItem={controller.activeItem}
              activeDraft={controller.activeDraft}
              className={className}
              quizTitle={quizTitle}
              teacherName={teacherName}
              style={controller.style}
              query={controller.reviewQuery}
              filter={controller.reviewFilter}
              onQueryChange={controller.setReviewQuery}
              onFilterChange={controller.setReviewFilter}
              onStyleChange={controller.setStyle}
              onSelectAll={controller.selectAll}
              onToggle={controller.toggleSelection}
              onActivate={controller.setActiveResultId}
              onDraftChange={controller.updateDraft}
              onRegenerate={controller.regenerateDraft}
              onBack={controller.goBack}
              onContinue={controller.goNext}
            />
          )}
          {controller.step === 'delivery' && (
            <DeliveryStep
              className={className}
              quizTitle={quizTitle}
              selectedCount={controller.selectedCount}
              skippedCount={skippedCount}
              notifyStudents={controller.notifyStudents}
              createParentLinks={controller.createParentLinks}
              prepareExternalList={controller.prepareExternalList}
              isSubmitting={controller.isSubmitting}
              error={controller.error}
              onNotifyStudentsChange={controller.setNotifyStudents}
              onCreateParentLinksChange={controller.setCreateParentLinks}
              onPrepareExternalListChange={controller.setPrepareExternalList}
              onBack={controller.goBack}
              onSubmit={() => void controller.submit()}
            />
          )}
          {controller.step === 'summary' && controller.batchDetail && (
            <DeliverySummary
              detail={controller.batchDetail}
              isSubmitting={controller.isSubmitting}
              onRetry={() => void controller.retryFailed()}
              onRevoke={(itemIds) => void controller.revokeLinks(itemIds)}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};
