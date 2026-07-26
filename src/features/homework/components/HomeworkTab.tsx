import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Archive, BookText, CalendarClock, ChevronRight, Clock, Copy, LayoutGrid, List, Lock, Pencil, Plus, Search, Unlock, Users } from 'lucide-react';
import { Button } from '../../../components/common';
import { useAuthStore } from '../../../../stores/authStore';
import { useClassStore } from '../../../stores/useClassStore';
import { useHomeworkStore } from '../stores/useHomeworkStore';
import { HomeworkAssignment } from '../types';
import { AssignmentCreator } from './AssignmentCreator';
import { AssignmentSubmissionsView } from './AssignmentSubmissionsView';

type StatusFilter = 'ALL' | 'OPEN' | 'EXPIRED' | 'CLOSED' | 'DRAFT';

const STATUS_META: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Đang mở', className: 'bg-emerald-100 text-emerald-700' },
  EXPIRED: { label: 'Quá hạn', className: 'bg-rose-100 text-rose-700' },
  CLOSED: { label: 'Đã đóng', className: 'bg-slate-200 text-slate-700' },
  DRAFT: { label: 'Bản nháp', className: 'bg-amber-100 text-amber-700' },
  ARCHIVED: { label: 'Đã lưu trữ', className: 'bg-slate-100 text-slate-500' },
};

export const HomeworkTab: React.FC = () => {
  const { assignments, deleteAssignment, updateAssignment, addAssignment, fetchTeacherAssignments, isLoading, error } = useHomeworkStore();
  const fetchClasses = useClassStore(state => state.fetchClasses);
  const { username } = useAuthStore();
  const [showCreator, setShowCreator] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAssignment, setSelectedAssignment] = useState<HomeworkAssignment | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<'deadline' | 'progress' | 'pending'>('deadline');

  useEffect(() => {
    if (username) Promise.all([fetchTeacherAssignments(username), fetchClasses(username)]);
  }, [username, fetchTeacherAssignments, fetchClasses]);

  const visibleAssignments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
    return assignments
      .filter(item => statusFilter === 'ALL' || item.effectiveStatus === statusFilter)
      .filter(item => !normalizedQuery || [item.title, item.subject, item.class?.name]
        .some(value => String(value || '').toLocaleLowerCase('vi-VN').includes(normalizedQuery)))
      .sort((a, b) => {
        if (sortBy === 'progress') {
          const ar = (a.submittedCount || 0) / Math.max(a.totalStudents || 1, 1);
          const br = (b.submittedCount || 0) / Math.max(b.totalStudents || 1, 1);
          return br - ar;
        }
        if (sortBy === 'pending') return (b.pendingCount || 0) - (a.pendingCount || 0);
        return Date.parse(a.deadline) - Date.parse(b.deadline);
      });
  }, [assignments, query, statusFilter, sortBy]);

  const summary = useMemo(() => ({
    pending: assignments.reduce((sum, item) => sum + (item.pendingCount || 0), 0),
    expiring: assignments.filter(item => item.effectiveStatus === 'OPEN' && Date.parse(item.deadline) - Date.now() <= 3 * 86400000).length,
    notSubmitted: assignments.reduce((sum, item) => sum + Math.max(0, (item.totalStudents || 0) - (item.submittedCount || 0)), 0),
    needsReview: assignments.reduce((sum, item) => sum + (item.pendingCount || 0), 0),
  }), [assignments]);

  const archive = async (event: React.MouseEvent, assignment: HomeworkAssignment) => {
    event.stopPropagation();
    if (!window.confirm(`Lưu trữ bài “${assignment.title}”? Bài nộp và điểm sẽ được giữ nguyên.`)) return;
    try { await deleteAssignment(assignment.id); toast.success('Đã lưu trữ bài tập'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể lưu trữ bài tập'); }
  };

  const updateDeadline = async (event: React.MouseEvent, assignment: HomeworkAssignment) => {
    event.stopPropagation();
    const current = new Date(assignment.deadline);
    const localValue = new Date(current.getTime() - current.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const value = window.prompt('Nhập hạn nộp mới (YYYY-MM-DDTHH:mm)', localValue);
    if (!value) return;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return toast.error('Hạn nộp không hợp lệ');
    try { await updateAssignment(assignment.id, { deadline: parsed.toISOString(), status: 'OPEN' }); toast.success('Đã gia hạn bài tập'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể gia hạn'); }
  };

  const editAssignment = async (event: React.MouseEvent, assignment: HomeworkAssignment) => {
    event.stopPropagation();
    const title = window.prompt('Tên bài tập', assignment.title);
    if (!title?.trim()) return;
    const description = window.prompt('Hướng dẫn cho học sinh', assignment.description || '') ?? assignment.description;
    const attemptsValue = window.prompt('Số lần nộp tối đa (1-10)', String(assignment.maxAttempts || assignment.max_attempts || 1));
    if (attemptsValue === null) return;
    const maxAttempts = Number(attemptsValue);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) return toast.error('Số lần nộp phải từ 1 đến 10');
    try { await updateAssignment(assignment.id, { title: title.trim(), description, maxAttempts }); toast.success('Đã cập nhật bài tập'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể cập nhật'); }
  };

  const toggleStatus = async (event: React.MouseEvent, assignment: HomeworkAssignment) => {
    event.stopPropagation();
    const nextStatus = assignment.effectiveStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    try { await updateAssignment(assignment.id, { status: nextStatus }); toast.success(nextStatus === 'OPEN' ? 'Đã mở lại bài tập' : 'Đã đóng bài tập'); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể đổi trạng thái'); }
  };

  const duplicate = async (event: React.MouseEvent, assignment: HomeworkAssignment) => {
    event.stopPropagation();
    try {
      await addAssignment({ ...assignment, id: undefined, title: `${assignment.title} (bản sao)`, status: 'DRAFT', teacher_id: username || assignment.teacher_id });
      toast.success('Đã tạo bản sao ở trạng thái bản nháp');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể nhân bản'); }
  };

  if (selectedAssignment) return <AssignmentSubmissionsView assignment={selectedAssignment} onBack={() => setSelectedAssignment(null)} />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Trung tâm Bài tập Tự luận</h1>
          <p className="text-slate-500 mt-1">Theo dõi tiến độ, duyệt gợi ý AI và hỗ trợ đúng học sinh cần giúp đỡ.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-1 flex shadow-sm">
            <button aria-label="Dạng lưới" onClick={() => setViewMode('grid')} className={`p-2 rounded-xl ${viewMode === 'grid' ? 'bg-indigo-50 text-blue-700' : 'text-blue-900'}`}><LayoutGrid className="w-5 h-5" /></button>
            <button
              aria-label="Dạng danh sách"
              onClick={() => setViewMode('list')}
              className={`rounded-xl p-2 ${
                viewMode === 'list'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600'
              }`}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
          <Button variant="primary" onClick={() => setShowCreator(value => !value)} icon={<Plus className={`w-4 h-4 ${showCreator ? 'rotate-45' : ''}`} />} className="rounded-2xl px-6 py-3">
            {showCreator ? 'Đóng' : 'Giao bài tập mới'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          ['Chờ chấm', summary.pending, 'text-blue-700'], ['Sắp hết hạn', summary.expiring, 'text-amber-600'],
          ['Chưa nộp', summary.notSubmitted, 'text-rose-600'], ['Cần xem lại', summary.needsReview, 'text-blue-700'],
        ].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl border border-slate-100 bg-white p-4"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className={`text-2xl font-black ${color}`}>{value}</p></div>)}
      </div>

      {showCreator && <AssignmentCreator onSuccess={() => setShowCreator(false)} />}

      <div className="flex flex-col lg:flex-row gap-3">
        <label className="flex-1 flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm theo tên bài, môn hoặc lớp..." className="w-full outline-none text-sm" />
        </label>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm">
          <option value="ALL">Tất cả trạng thái</option><option value="OPEN">Đang mở</option><option value="EXPIRED">Quá hạn</option><option value="CLOSED">Đã đóng</option><option value="DRAFT">Bản nháp</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm">
          <option value="deadline">Hạn gần nhất</option><option value="pending">Chờ chấm nhiều nhất</option><option value="progress">Tiến độ cao nhất</option>
        </select>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 flex items-center justify-between"><span>{error}</span><button className="font-bold" onClick={() => username && fetchTeacherAssignments(username)}>Thử lại</button></div>}
      {isLoading && assignments.length === 0 && <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">{[1,2,3].map(key => <div key={key} className="h-56 rounded-3xl bg-slate-100 animate-pulse" />)}</div>}

      {!isLoading && visibleAssignments.length > 0 && <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
        {visibleAssignments.map(hw => {
          const total = hw.totalStudents || hw.total_students || 0;
          const submitted = hw.submittedCount || hw.submitted_count || 0;
          const percent = total ? Math.min(100, Math.round(submitted / total * 100)) : 0;
          const status = STATUS_META[hw.effectiveStatus || hw.status || 'OPEN'] || STATUS_META.OPEN;
          return <article key={hw.id} onClick={() => setSelectedAssignment(hw)} className={`group bg-white border border-slate-100 p-5 hover:shadow-xl hover:border-indigo-100 cursor-pointer relative ${viewMode === 'grid' ? 'rounded-3xl' : 'rounded-2xl flex items-center justify-between'}`}>
            <div className="absolute top-3 right-3 flex items-center rounded-xl bg-white/95 border border-slate-100 shadow-sm">
              <button aria-label="Sửa bài" title="Sửa bài" onClick={event => editAssignment(event, hw)} className="p-2 text-slate-400 hover:text-blue-700"><Pencil className="w-4 h-4" /></button>
              <button aria-label="Gia hạn" title="Gia hạn" onClick={event => updateDeadline(event, hw)} className="p-2 text-slate-400 hover:text-blue-700"><CalendarClock className="w-4 h-4" /></button>
              <button aria-label="Đóng hoặc mở bài" title={hw.effectiveStatus === 'OPEN' ? 'Đóng bài' : 'Mở lại'} onClick={event => toggleStatus(event, hw)} className="p-2 text-slate-400 hover:text-blue-700">{hw.effectiveStatus === 'OPEN' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</button>
              <button aria-label="Nhân bản" title="Nhân bản" onClick={event => duplicate(event, hw)} className="p-2 text-slate-400 hover:text-blue-700"><Copy className="w-4 h-4" /></button>
              <button aria-label="Lưu trữ bài" title="Lưu trữ" onClick={event => archive(event, hw)} className="p-2 text-slate-400 hover:text-rose-600"><Archive className="w-4 h-4" /></button>
            </div>
            <div className="flex items-start gap-4 pr-8"><div className="p-3 rounded-2xl bg-indigo-50 text-blue-600"><BookText className="w-6 h-6" /></div><div className="min-w-0"><h3 className="font-bold text-blue-900 truncate">{hw.title}</h3><div className="flex flex-wrap gap-2 mt-2 text-xs text-blue-900"><span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg"><Users className="w-3.5 h-3.5" />Lớp {hw.class?.name || hw.class_id}</span><span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg"><Clock className="w-3.5 h-3.5" />{new Date(hw.deadline).toLocaleString('vi-VN')}</span></div></div></div>
            {viewMode === 'grid' ? (
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Tiến độ nộp bài</span>
                  <span className="font-bold text-blue-700">{submitted}/{total} học sinh · {percent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${status.className}`}>{status.label}</span>
                  <span className="flex items-center text-xs font-bold text-blue-600">Xem chi tiết <ChevronRight className="w-4 h-4" /></span>
                </div>
              </div>
            ) : (
              <div className="pr-8 text-right">
                <p className="text-xs text-slate-500">Đã nộp</p>
                <p className="font-bold text-blue-700">{submitted}/{total}</p>
              </div>
            )}
          </article>;
        })}
      </div>}

      {!isLoading && visibleAssignments.length === 0 && <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200"><BookText className="w-14 h-14 text-slate-300 mx-auto mb-3" /><h3 className="text-lg font-bold text-slate-600">Không tìm thấy bài tập phù hợp</h3><p className="text-slate-400 mt-1">Thử đổi bộ lọc hoặc tạo bài tập mới.</p></div>}
    </div>
  );
};
