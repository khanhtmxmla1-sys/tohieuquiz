import { formatSystemDateTime, getSystemDefaultDeadline, systemDateTimeLocalToIso } from '../../../utils/dateTime';
import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  ClipboardPlus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Quiz } from '../../../types';
import type {
  InterventionDashboard,
  InterventionGroup,
  InterventionSuggestion,
} from '../../../../shared/intervention.contract';
import {
  addInterventionNote,
  createInterventionAssignments,
  createInterventionGroup,
  getInterventionDashboard,
} from '../../../services/results/interventionService';
import { Card } from '../../common';

interface InterventionPanelProps {
  classNameFilter: string;
  quizId: string;
  quizzes: Quiz[];
  isOnline: boolean;
}

const defaultDeadline = (): string => getSystemDefaultDeadline(7);

const percentage = (value: number): string => `${Math.round(value * 100)}%`;
const scoreDeltaLabel = (value: number): string => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

const SuggestionCard = ({
  suggestion,
  busy,
  onCreate,
}: {
  suggestion: InterventionSuggestion;
  busy: boolean;
  onCreate: () => void;
}) => (
  <article className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-slate-900">{suggestion.title}</h4>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-amber-800">
            Tin cậy {percentage(suggestion.confidence)}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {suggestion.className} · {suggestion.studentCount} học sinh · {suggestion.sampleSize} lượt trả lời
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Điểm trung bình lần đầu {suggestion.averageFirstScore.toFixed(1)} → gần nhất {suggestion.averageLatestScore.toFixed(1)}
          <span className="ml-2 font-semibold">({scoreDeltaLabel(suggestion.averageScoreDelta)})</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestion.students.slice(0, 6).map((student) => (
            <span key={student.studentId} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs text-slate-700">
              {student.studentName} · {student.skillAccuracy}%
            </span>
          ))}
          {suggestion.students.length > 6 && (
            <span className="px-2 py-1 text-xs text-slate-500">+{suggestion.students.length - 6} em</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <RefreshCw size={16} className="animate-spin" /> : <Users size={16} />}
        Tạo nhóm hỗ trợ
      </button>
    </div>
  </article>
);

const GroupCard = ({
  group,
  quizzes,
  onSaved,
}: {
  group: InterventionGroup;
  quizzes: Quiz[];
  onSaved: () => Promise<void>;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [showAssignment, setShowAssignment] = useState(false);
  const [quizId, setQuizId] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [creatingAssignments, setCreatingAssignments] = useState(false);
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

  const openAssignment = () => {
    setQuizId((current) => current || orderedQuizzes[0]?.id || '');
    setDeadline(defaultDeadline());
    setIdempotencyKey(`intervention-${group.id}-${crypto.randomUUID()}`);
    setShowAssignment(true);
  };

  const saveNote = async () => {
    if (!note.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await addInterventionNote(group.id, { note: note.trim() });
      setNote('');
      toast.success('Đã lưu ghi chú riêng cho giáo viên.');
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu ghi chú riêng.');
    } finally {
      setSavingNote(false);
    }
  };

  const assign = async () => {
    if (!quizId || !deadline || !idempotencyKey || creatingAssignments) return;
    setCreatingAssignments(true);
    try {
      const result = await createInterventionAssignments(group.id, {
        quizId,
        deadline: systemDateTimeLocalToIso(deadline),
        maxAttempts,
        idempotencyKey,
      });
      toast.success(result.assignmentIds.length
        ? `Đã tạo ${result.assignmentIds.length} bài luyện tập cá nhân.`
        : 'Các học sinh trong nhóm đã có bài luyện tập đang mở.');
      setShowAssignment(false);
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể giao bài cho nhóm.');
    } finally {
      setCreatingAssignments(false);
    }
  };

  return (
    <article className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="font-semibold text-slate-900">{group.name}</h4>
          <p className="mt-1 text-sm text-slate-600">
            {group.className} · {group.members.length} học sinh · độ tin cậy {percentage(group.confidence)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openAssignment}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <ClipboardPlus size={16} /> Tạo bài luyện
          </button>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Chi tiết
          </button>
        </div>
      </div>

      {showAssignment && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4" aria-label={`Tạo bài luyện cho ${group.name}`}>
          <p className="mb-3 text-sm font-semibold text-slate-800">Bước cuối: kiểm tra bài luyện và xác nhận giao</p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Bài kiểm tra
              <select value={quizId} onChange={(event) => setQuizId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">Chọn bài</option>
                {orderedQuizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {recommendedQuizIds.has(quiz.id) ? '★ ' : ''}{quiz.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Hạn hoàn thành
              <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              <span className="mt-1 block text-xs font-normal text-slate-500">Giờ Hà Nội (GMT+7)</span>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Số lượt làm
              <input type="number" min={1} max={10} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setShowAssignment(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Hủy</button>
            <button
              type="button"
              onClick={assign}
              disabled={!quizId || !deadline || creatingAssignments}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creatingAssignments && <RefreshCw size={16} className="animate-spin" />}
              Giao bài cho nhóm
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-blue-100 pt-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.members.map((member) => (
              <div key={member.studentId} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <p className="font-semibold text-slate-800">{member.studentName}</p>
                <p className="mt-1 text-slate-600">
                  Lần đầu {member.firstAttemptScore.toFixed(1)} → gần nhất {member.latestAttemptScore.toFixed(1)}
                </p>
                <p className="mt-1 text-xs text-slate-500">Mức chính xác kỹ năng: {member.skillAccuracy}% · {member.skillSampleSize} mẫu</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
              <ShieldCheck size={16} /> Ghi chú riêng — chỉ giáo viên nhìn thấy
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Ghi lại hoàn cảnh, cách hỗ trợ hoặc điều cần theo dõi..."
              className="mt-2 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={saveNote}
                disabled={!note.trim() || savingNote}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingNote && <RefreshCw size={16} className="animate-spin" />}
                Lưu ghi chú
              </button>
            </div>
            {group.notes.length > 0 && (
              <div className="mt-3 space-y-2">
                {group.notes.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                    {item.note}
                    <span className="ml-2 text-xs text-slate-400">{formatSystemDateTime(item.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

export const InterventionPanel = ({
  classNameFilter,
  quizId,
  quizzes,
  isOnline,
}: InterventionPanelProps) => {
  const [dashboard, setDashboard] = useState<InterventionDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const filters = useMemo(() => ({
    className: classNameFilter && classNameFilter !== 'All' ? classNameFilter : undefined,
    quizId: quizId && quizId !== 'all' ? quizId : undefined,
  }), [classNameFilter, quizId]);

  const load = async () => {
    if (!isOnline) return;
    setIsLoading(true);
    setError('');
    try {
      setDashboard(await getInterventionDashboard(filters));
    } catch (loadError) {
      const normalized = loadError instanceof Error ? loadError : new Error(String(loadError));
      setError(normalized.message || 'Không thể tải nhóm hỗ trợ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filters.className, filters.quizId, isOnline]);

  const createGroup = async (suggestion: InterventionSuggestion) => {
    setBusyAction(`group:${suggestion.key}`);
    try {
      await createInterventionGroup({
        suggestionKey: suggestion.key,
        className: filters.className,
        quizId: filters.quizId,
        studentIds: suggestion.students.map((student) => student.studentId),
      });
      toast.success('Đã tạo nhóm hỗ trợ.');
      await load();
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Không thể tạo nhóm hỗ trợ.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <Card
      as="section"
      title={<span className="inline-flex items-center gap-2"><Sparkles size={20} className="text-amber-600" />Trung tâm hỗ trợ học tập</span>}
      subtitle="Gợi ý dựa trên tối thiểu 3 mẫu, độ tin cậy đủ cao và xu hướng trong 4 tuần gần nhất."
      headerAction={(
        <button
          type="button"
          onClick={() => void load()}
          disabled={!isOnline || isLoading}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Làm mới
        </button>
      )}
    >
      {!isOnline && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">Cần kết nối mạng để tải phân tích và lưu nhóm hỗ trợ.</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {isLoading && !dashboard && <p className="text-sm text-slate-500">Đang phân tích kết quả 28 ngày gần nhất...</p>}
      {dashboard && (
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <BookOpenCheck size={18} className="text-amber-600" />
              <h3 className="font-semibold text-slate-900">Gợi ý mới</h3>
              <span className="text-xs text-slate-500">{dashboard.suggestions.length} nhóm đủ điều kiện</span>
            </div>
            <div className="space-y-3">
              {dashboard.suggestions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Chưa có nhóm nào đủ số mẫu và độ tin cậy với bộ lọc hiện tại.
                </p>
              ) : dashboard.suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.key}
                  suggestion={suggestion}
                  busy={busyAction === `group:${suggestion.key}`}
                  onCreate={() => void createGroup(suggestion)}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h3 className="font-semibold text-slate-900">Nhóm đang theo dõi</h3>
              <span className="text-xs text-slate-500">{dashboard.groups.length} nhóm</span>
            </div>
            <div className="space-y-3">
              {dashboard.groups.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Tạo một nhóm từ gợi ý phía trên để lưu ghi chú riêng và giao bài luyện tập.
                </p>
              ) : dashboard.groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  quizzes={quizzes}
                  onSaved={load}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default InterventionPanel;
