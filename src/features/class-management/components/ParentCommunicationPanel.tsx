import React, { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Megaphone, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react';
import {
  createParentAnnouncement,
  getParentDelivery,
  listParentAnnouncements,
  revokeParentAnnouncement,
} from '../../parent-portal/parentPortalService';
import type {
  ParentAnnouncementView,
  ParentDeliveryView,
} from '../../parent-portal/types';

interface ParentCommunicationPanelProps {
  classId: string;
}

const accessLabel: Record<ParentDeliveryView['parentAccessStatus'], string> = {
  not_issued: 'Chưa cấp',
  pending: 'Chờ kích hoạt',
  active: 'Đã kích hoạt',
  revoked: 'Đã thu hồi',
};

export default function ParentCommunicationPanel({ classId }: ParentCommunicationPanelProps) {
  const [announcements, setAnnouncements] = useState<ParentAnnouncementView[]>([]);
  const [delivery, setDelivery] = useState<ParentDeliveryView[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [announcementResponse, deliveryResponse] = await Promise.all([
        listParentAnnouncements(classId),
        getParentDelivery(classId),
      ]);
      setAnnouncements(announcementResponse.items);
      setDelivery(deliveryResponse.items);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tải được dữ liệu liên lạc phụ huynh.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, [classId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();
    if (!normalizedTitle || !normalizedBody) {
      setError('Vui lòng nhập đầy đủ tiêu đề và nội dung.');
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await createParentAnnouncement({
        classId,
        title: normalizedTitle,
        body: normalizedBody,
        isImportant,
      });
      setTitle('');
      setBody('');
      setIsImportant(false);
      setMessage(`Đã gửi đến ${response.delivery.createdCount}/${response.delivery.targetCount} phụ huynh.`);
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không gửi được thông báo lớp.');
    } finally {
      setIsSaving(false);
    }
  };

  const revoke = async (announcementId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await revokeParentAnnouncement(announcementId);
      setMessage('Đã thu hồi thông báo khỏi cổng phụ huynh.');
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thu hồi được thông báo.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeCount = delivery.filter(item => item.parentAccessStatus === 'active').length;
  const unreadTotal = delivery.reduce((sum, item) => sum + item.unreadCount, 0);

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-indigo-600">Cổng phụ huynh</p>
          <h3 className="text-lg font-bold text-slate-900">Liên lạc và trạng thái tiếp nhận</h3>
          <p className="mt-1 text-sm text-slate-500">Gửi thông báo chung, kiểm tra kích hoạt và số nội dung chưa đọc.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Tải lại
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-emerald-50 p-4"><ShieldCheck className="h-5 w-5 text-emerald-700" /><p className="mt-2 text-sm text-slate-600">Đã kích hoạt</p><p className="text-2xl font-bold text-slate-900">{activeCount}/{delivery.length}</p></div>
        <div className="rounded-2xl bg-indigo-50 p-4"><BellRing className="h-5 w-5 text-indigo-700" /><p className="mt-2 text-sm text-slate-600">Tổng chưa đọc</p><p className="text-2xl font-bold text-slate-900">{unreadTotal}</p></div>
        <div className="rounded-2xl bg-amber-50 p-4"><Megaphone className="h-5 w-5 text-amber-700" /><p className="mt-2 text-sm text-slate-600">Thông báo đang hoạt động</p><p className="text-2xl font-bold text-slate-900">{announcements.filter(item => item.status === 'PUBLISHED').length}</p></div>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-slate-50 p-4">
        <h4 className="font-bold text-slate-900">Soạn thông báo chung cho lớp</h4>
        <label className="block text-sm font-semibold text-slate-700">
          Tiêu đề thông báo
          <input
            aria-label="Tiêu đề thông báo"
            value={title}
            onChange={event => setTitle(event.target.value.slice(0, 160))}
            maxLength={160}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            required
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Nội dung thông báo
          <textarea
            aria-label="Nội dung thông báo"
            value={body}
            onChange={event => setBody(event.target.value.slice(0, 2000))}
            maxLength={2000}
            rows={4}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            required
          />
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            aria-label="Đánh dấu quan trọng"
            type="checkbox"
            checked={isImportant}
            onChange={event => setIsImportant(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Đánh dấu quan trọng
        </label>
        <button type="submit" disabled={isSaving} className="min-h-11 rounded-xl bg-indigo-600 px-5 font-bold text-white disabled:opacity-50">
          {isSaving ? 'Đang gửi…' : 'Gửi thông báo lớp'}
        </button>
      </form>

      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <h4 className="mb-3 font-bold text-slate-900">Lịch sử thông báo</h4>
          {isLoading && !announcements.length && <p className="text-sm text-slate-500">Đang tải thông báo…</p>}
          {!isLoading && !announcements.length && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Chưa có thông báo lớp.</p>}
          <div className="space-y-3">
            {announcements.map(item => (
              <article key={item.id} className={`rounded-2xl border p-4 ${item.status === 'REVOKED' ? 'border-slate-200 bg-slate-50 opacity-70' : item.isImportant ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {item.isImportant && <AlertTriangle className="h-4 w-4 text-amber-700" />}
                      <h5 className="font-bold text-slate-900">{item.title}</h5>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{item.readCount} đã đọc · {item.unreadCount} chưa đọc</p>
                  </div>
                  {item.status === 'PUBLISHED' && (
                    <button
                      type="button"
                      aria-label={`Thu hồi ${item.title}`}
                      onClick={() => revoke(item.id)}
                      disabled={isSaving}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <ShieldOff className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-3 font-bold text-slate-900">Trạng thái theo học sinh</h4>
          {!isLoading && !delivery.length && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Chưa có học sinh.</p>}
          <div className="max-h-96 divide-y divide-slate-100 overflow-auto rounded-2xl border border-slate-200">
            {delivery.map(item => (
              <div key={item.studentId} className="flex items-center justify-between gap-3 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{item.studentName}</p>
                  <p className="text-xs text-slate-500">{accessLabel[item.parentAccessStatus]}</p>
                </div>
                <div className="text-right">
                  {item.unreadCount > 0 ? <p className="text-sm font-bold text-amber-700">{item.unreadCount} chưa đọc</p> : <p className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />Đã xem hết</p>}
                  {item.lastViewedAt && <p className="text-[11px] text-slate-400">Xem gần nhất {new Date(item.lastViewedAt).toLocaleDateString('vi-VN')}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
