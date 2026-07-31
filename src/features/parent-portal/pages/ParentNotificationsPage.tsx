import React, { useEffect, useMemo, useState } from 'react';
import { Award, Bell, BookOpen, ClipboardCheck, FileText, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { ParentNotificationItem, ParentNotificationKind } from '../../../../shared/parent-portal.contract';
import { markAllNotificationsRead } from '../parentPortalService';
import { useParentPortalStore } from '../useParentPortalStore';

const meta: Record<ParentNotificationKind, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  quiz_result: { label: 'Kết quả', icon: ClipboardCheck, tone: 'bg-[#eff6ff] text-[#2563eb]' },
  result_report: { label: 'Nhận xét', icon: FileText, tone: 'bg-[#f5f3ff] text-[#7c3aed]' },
  homework_assigned: { label: 'Bài tập mới', icon: BookOpen, tone: 'bg-[#fff7ed] text-[#c2410c]' },
  homework_due: { label: 'Sắp hết hạn', icon: Bell, tone: 'bg-[#fef2f2] text-[#dc2626]' },
  homework_graded: { label: 'Đã chấm', icon: ClipboardCheck, tone: 'bg-[#ecfdf5] text-[#15803d]' },
  class_announcement: { label: 'Thông báo lớp', icon: Megaphone, tone: 'bg-[#fff7d6] text-[#a16207]' },
  certificate_issued: { label: 'Chứng nhận', icon: Award, tone: 'bg-[#fff7d6] text-[#b45309]' },
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
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Kết nối với nhà trường</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#0f172a] sm:text-3xl">Thông báo</h1><p className="mt-1 text-sm text-[#64748b]">Kết quả, bài tập, thông báo lớp và chứng nhận mới của con.</p></div>
        <button type="button" onClick={markAll} className="min-h-11 rounded-[13px] border border-[#bfdbfe] bg-white px-4 text-sm font-bold text-[#1d4ed8] transition-colors hover:bg-[#eff6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">Đánh dấu tất cả đã đọc</button>
      </div>

      <section className="rounded-[20px] border border-[#e2e8f0] bg-white p-4 shadow-[0_18px_44px_-38px_rgba(30,58,138,0.7)]">
        <label className="block max-w-sm text-sm font-semibold text-[#475569]">Loại thông báo
          <select value={kind} onChange={event => setKind(event.target.value as typeof kind)} className="mt-2 min-h-12 w-full rounded-[13px] border border-[#dbe4f0] bg-[#f8fafc] px-3 text-base text-[#1e293b] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10">
            <option value="all">Tất cả</option>{Object.entries(meta).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
          </select>
        </label>
      </section>

      {isLoading && !notifications.length && <p role="status" className="rounded-[20px] border border-[#e2e8f0] bg-white p-6 text-[#64748b]">Đang tải thông báo…</p>}
      {error && <p role="alert" className="rounded-[16px] border border-[#fecaca] bg-[#fef2f2] p-4 text-[#b91c1c]">{error}</p>}
      {!isLoading && !visible.length && <p className="rounded-[20px] border border-dashed border-[#cbd5e1] bg-white p-8 text-center text-[#64748b]">Không có thông báo phù hợp.</p>}

      <div className="space-y-3">
        {visible.map(item => {
          const Icon = meta[item.kind].icon;
          return (
            <button key={item.id} type="button" onClick={() => open(item)} aria-label={`${item.title}: ${item.body}`} className={`w-full rounded-[20px] border p-4 text-left shadow-[0_16px_38px_-34px_rgba(30,58,138,0.7)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#93c5fd] hover:shadow-[0_22px_48px_-36px_rgba(37,99,235,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${item.isRead ? 'border-[#e2e8f0] bg-white' : 'border-[#bfdbfe] bg-[#f8fbff]'}`}>
              <div className="flex gap-3 sm:gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] ${meta[item.kind].tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-bold text-[#1e293b]">{item.title}</span>{!item.isRead && <span className="rounded-full bg-[#2563eb] px-2 py-0.5 text-[10px] font-bold text-white">Mới</span>}{item.isImportant && <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-bold text-[#92400e]">Quan trọng</span>}</span><span className="mt-1 block text-sm leading-6 text-[#475569]">{item.body}</span><span className="mt-2 block text-xs text-[#94a3b8]">{new Date(item.publishedAt).toLocaleString('vi-VN')}</span></span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
