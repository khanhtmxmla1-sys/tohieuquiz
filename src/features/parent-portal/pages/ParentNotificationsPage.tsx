import React, { useEffect, useMemo, useState } from 'react';
import { Award, Bell, BookOpen, ClipboardCheck, FileText, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { ParentNotificationItem, ParentNotificationKind } from '../../../../shared/parent-portal.contract';
import { markAllNotificationsRead } from '../parentPortalService';
import { useParentPortalStore } from '../useParentPortalStore';

const meta: Record<ParentNotificationKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  quiz_result: { label: 'Kết quả', icon: ClipboardCheck },
  result_report: { label: 'Nhận xét', icon: FileText },
  homework_assigned: { label: 'Bài tập mới', icon: BookOpen },
  homework_due: { label: 'Sắp hết hạn', icon: Bell },
  homework_graded: { label: 'Đã chấm', icon: ClipboardCheck },
  class_announcement: { label: 'Thông báo lớp', icon: Megaphone },
  certificate_issued: { label: 'Chứng nhận', icon: Award },
};

const targetFor = (item: ParentNotificationItem): string | null => {
  if (typeof item.payload.resultId === 'string') return `/results/${item.payload.resultId}`;
  if (typeof item.payload.assignmentId === 'string') return '/assignments';
  if (typeof item.payload.certificateId === 'string') return '/certificates';
  return null;
};

export default function ParentNotificationsPage() {
  const notifications = useParentPortalStore(state => state.notifications);
  const isLoading = useParentPortalStore(state => state.isLoading);
  const error = useParentPortalStore(state => state.error);
  const loadNotifications = useParentPortalStore(state => state.loadNotifications);
  const markNotificationRead = useParentPortalStore(state => state.markNotificationRead);
  const navigate = useNavigate();
  const [kind, setKind] = useState<'all' | ParentNotificationKind>('all');

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);
  const visible = useMemo(() => notifications.filter(item => !(item as ParentNotificationItem & { revokedAt?: string | null }).revokedAt && (kind === 'all' || item.kind === kind)), [notifications, kind]);

  const open = async (item: ParentNotificationItem) => {
    if (!item.isRead) await markNotificationRead(item.id);
    const target = targetFor(item);
    if (target) navigate(target);
  };
  const markAll = async () => {
    await markAllNotificationsRead();
    await loadNotifications();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold">Thông báo</h1><p className="mt-1 text-sm text-slate-500">Kết quả, bài tập, thông báo lớp và chứng nhận mới.</p></div><button type="button" onClick={markAll} className="min-h-11 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-bold text-indigo-700 hover:bg-indigo-50">Đánh dấu tất cả đã đọc</button></div>
      <label className="block max-w-xs text-sm font-semibold text-slate-700">Loại thông báo<select value={kind} onChange={event => setKind(event.target.value as typeof kind)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="all">Tất cả</option>{Object.entries(meta).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
      {isLoading && !notifications.length && <p role="status" className="rounded-2xl bg-white p-6 text-slate-500">Đang tải thông báo…</p>}
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}
      {!isLoading && !visible.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Không có thông báo phù hợp.</p>}
      <div className="space-y-3">{visible.map(item => { const Icon = meta[item.kind].icon; return <button key={item.id} type="button" onClick={() => open(item)} aria-label={`${item.title}: ${item.body}`} className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.isRead ? 'border-slate-200 bg-white' : 'border-indigo-200 bg-indigo-50/70'}`}><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700"><Icon className="h-5 w-5" /></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="font-bold text-slate-900">{item.title}</span>{!item.isRead && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">Mới</span>}{item.isImportant && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Quan trọng</span>}</span><span className="mt-1 block text-sm text-slate-600">{item.body}</span><span className="mt-2 block text-xs text-slate-400">{new Date(item.publishedAt).toLocaleString('vi-VN')}</span></span></div></button>; })}</div>
    </div>
  );
}
