import { useEffect, useState } from 'react';
import { BookOpenCheck, RefreshCw, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Quiz } from '../../../types';
import type { InterventionSuggestion } from '../../../../shared/intervention.contract';
import { createInterventionGroup } from '../../../services/results/interventionService';
import { Card } from '../../common';
import { InterventionHeader } from './intervention/InterventionHeader';
import { InterventionReadiness } from './intervention/InterventionReadiness';
import { InterventionSuggestionCard } from './intervention/InterventionSuggestionCard';
import { InterventionArchivedGroups } from './intervention/InterventionArchivedGroups';
import { InterventionGroupList } from './intervention/InterventionGroupList';
import { useInterventionDashboard } from './intervention/useInterventionDashboard';

interface InterventionPanelProps {
  classNameFilter: string;
  quizId: string;
  quizzes: Quiz[];
  isOnline: boolean;
  onClearFilters?: () => void;
}

const InterventionLoadingState = () => (
  <div
    role="status"
    aria-label="Đang phân tích dữ liệu hỗ trợ học sinh"
    aria-live="polite"
    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
  >
    <span className="sr-only">Đang phân tích dữ liệu hỗ trợ học sinh</span>
    <div className="animate-pulse space-y-3" aria-hidden="true">
      <div className="h-4 w-2/3 rounded bg-slate-200" />
      <div className="h-3 w-full max-w-xl rounded bg-slate-200" />
      <div className="h-3 w-1/2 rounded bg-slate-200" />
    </div>
  </div>
);

export const InterventionPanel = ({
  classNameFilter,
  quizId,
  quizzes,
  isOnline,
  onClearFilters,
}: InterventionPanelProps) => {
  const [busyAction, setBusyAction] = useState('');
  const [pendingFocusGroupId, setPendingFocusGroupId] = useState('');
  const {
    dashboard,
    filters,
    isLoading,
    error,
    isStale,
    reload: load,
  } = useInterventionDashboard({ classNameFilter, quizId, isOnline });
  const hasActiveFilters = Boolean(filters.className || filters.quizId);
  const windowDays = dashboard?.criteria.windowDays || 28;

  const createGroup = async (
    suggestion: InterventionSuggestion,
    input: { name: string; studentIds: string[] },
  ): Promise<'created' | 'stale' | 'failed'> => {
    if (busyAction) return 'failed';
    setBusyAction(`group:${suggestion.key}`);
    try {
      const created = await createInterventionGroup({
        suggestionKey: suggestion.key,
        name: input.name,
        className: filters.className,
        quizId: filters.quizId,
        studentIds: input.studentIds,
      });
      setPendingFocusGroupId(created.id);
      toast.success(`Đã tạo nhóm hỗ trợ với ${input.studentIds.length} học sinh.`);
      await load();
      return 'created';
    } catch (createError) {
      const status = typeof createError === 'object' && createError !== null && 'status' in createError
        ? Number((createError as { status?: unknown }).status)
        : 0;
      const message = createError instanceof Error ? createError.message : 'Không thể tạo nhóm hỗ trợ.';
      if (status === 409 || /no longer available|không còn/i.test(message)) {
        toast.error('Gợi ý đã thay đổi theo dữ liệu mới. Đã tải lại để bạn kiểm tra thành viên còn phù hợp.');
        await load();
        return 'stale';
      }
      toast.error(message);
      return 'failed';
    } finally {
      setBusyAction('');
    }
  };

  useEffect(() => {
    if (!pendingFocusGroupId || !dashboard?.groups.some((group) => group.id === pendingFocusGroupId)) return;
    const element = document.getElementById(`intervention-group-${pendingFocusGroupId}`);
    if (!element) return;
    element.focus();
    setPendingFocusGroupId('');
  }, [dashboard, pendingFocusGroupId]);

  const showReadiness = Boolean(dashboard && dashboard.suggestions.length === 0);
  const showSuggestions = Boolean(dashboard && dashboard.suggestions.length > 0);
  const showGroups = Boolean(dashboard && dashboard.groups.length > 0);

  return (
    <Card as="section" padding="none" aria-label="Gợi ý hỗ trợ học sinh">
      <InterventionHeader
        classNameFilter={classNameFilter}
        quizId={quizId}
        quizzes={quizzes}
        windowDays={windowDays}
        isOnline={isOnline}
        isLoading={isLoading}
        onRefresh={() => void load()}
      />

      <div className="p-4 sm:p-6">
        {!isOnline && (
          <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
            Cần kết nối mạng để tải phân tích và lưu nhóm hỗ trợ.
          </p>
        )}

        {isStale && dashboard && (
          <p role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
            Dữ liệu có thể đã cũ
          </p>
        )}
        {error && (
          <div role="alert" className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              disabled={!isOnline || isLoading}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold text-red-700 disabled:opacity-60"
            >
              <RefreshCw size={16} aria-hidden="true" /> Thử lại
            </button>
          </div>
        )}

        {isLoading && !dashboard && <InterventionLoadingState />}

        {dashboard && (
          <div className="space-y-5">
            {showReadiness && (
              <InterventionReadiness
                readiness={dashboard.readiness}
                minimumSampleSize={dashboard.criteria.minimumSampleSize}
                minimumConfidence={dashboard.criteria.minimumConfidence}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={onClearFilters}
                compact={showGroups}
              />
            )}

            {showSuggestions && (
              <section aria-labelledby="intervention-suggestions-heading">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <BookOpenCheck size={18} className="text-amber-600" aria-hidden="true" />
                  <h3 id="intervention-suggestions-heading" className="font-semibold text-slate-900">Gợi ý mới</h3>
                  <span className="text-xs text-slate-500">{dashboard.suggestions.length} nhóm đủ điều kiện</span>
                </div>
                <div className="space-y-3">
                  {dashboard.suggestions.map((suggestion) => (
                    <InterventionSuggestionCard
                      key={suggestion.key}
                      suggestion={suggestion}
                      busy={busyAction === `group:${suggestion.key}`}
                      onCreate={(input) => createGroup(suggestion, input)}
                    />
                  ))}
                </div>
              </section>
            )}

            {showGroups && (
              <section aria-labelledby="intervention-groups-heading">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Users size={18} className="text-blue-600" aria-hidden="true" />
                  <h3 id="intervention-groups-heading" className="font-semibold text-slate-900">Nhóm đang theo dõi</h3>
                  <span className="text-xs text-slate-500">{dashboard.groups.length} nhóm</span>
                </div>
                <InterventionGroupList
                  groups={dashboard.groups}
                  quizzes={quizzes}
                  onSaved={async () => { await load(); }}
                />
              </section>
            )}

            <InterventionArchivedGroups
              groups={dashboard.archivedGroups}
              quizzes={quizzes}
              onSaved={async () => { await load(); }}
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default InterventionPanel;
