import React, { useEffect, useState } from 'react';
import { Award, CalendarDays, UserRound, X } from 'lucide-react';
import type { ParentCertificateHistoryItem } from '../../../../shared/parent-portal.contract';
import { listCertificates } from '../parentPortalService';

const getParentCertificateImageUrl = (item: ParentCertificateHistoryItem): string | null => (
  item.imageUrl ? `/api/parent/certificates/${encodeURIComponent(item.id)}/image` : null
);

export default function ParentCertificatesPage() {
  const [items, setItems] = useState<ParentCertificateHistoryItem[]>([]);
  const [selected, setSelected] = useState<ParentCertificateHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listCertificates({ page: 1, limit: 50 })
      .then(page => { if (active) setItems(page.items); })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Không tải được chứng nhận.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedImageUrl = selected ? getParentCertificateImageUrl(selected) : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b45309]">Dấu mốc đáng tự hào</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#0f172a] sm:text-3xl">Chứng nhận và thành tích</h1>
        <p className="mt-1 text-sm text-[#64748b]">Lưu lại những thành tích nổi bật trong quá trình học tập của con.</p>
      </div>

      {loading && <p role="status" className="rounded-[20px] border border-[#e2e8f0] bg-white p-6 text-[#64748b]">Đang tải chứng nhận…</p>}
      {error && <p role="alert" className="rounded-[16px] border border-[#fecaca] bg-[#fef2f2] p-4 text-[#b91c1c]">{error}</p>}
      {!loading && !items.length && (
        <div className="rounded-[22px] border border-dashed border-[#fcd34d] bg-[#fffdf5] p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[17px] bg-[#fef3c7] text-[#b45309]"><Award className="h-7 w-7" aria-hidden="true" /></span>
          <p className="mt-4 font-bold text-[#713f12]">Chưa có chứng nhận trong năm học</p>
          <p className="mt-1 text-sm text-[#92400e]">Các thành tích mới sẽ được hiển thị tại đây.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(item => {
          const imageUrl = getParentCertificateImageUrl(item);
          return (
            <button key={item.id} type="button" onClick={() => setSelected(item)} aria-label={`Xem chứng nhận ${item.title}`} className="group overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-white text-left shadow-[0_18px_44px_-38px_rgba(30,58,138,0.7)] transition-[border-color,box-shadow,transform] hover:-translate-y-1 hover:border-[#fcd34d] hover:shadow-[0_24px_52px_-36px_rgba(180,83,9,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">
              {imageUrl ? <img src={imageUrl} alt="" className="aspect-[1.414/1] w-full bg-[#f8fafc] object-cover" loading="lazy" /> : <div className="flex aspect-[1.414/1] items-center justify-center bg-[#fff7d6]"><Award className="h-12 w-12 text-[#b45309]" aria-hidden="true" /></div>}
              <div className="p-4 sm:p-5">
                <span className="inline-flex rounded-[9px] bg-[#fff7d6] px-2.5 py-1 text-xs font-bold text-[#92400e]">Thành tích</span>
                <h2 className="mt-3 line-clamp-2 font-bold text-[#1e293b]">{item.title}</h2>
                <div className="mt-3 space-y-1.5 text-xs text-[#64748b]"><p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[#94a3b8]" aria-hidden="true" />{item.teacherName}</p><p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#94a3b8]" aria-hidden="true" />{new Date(item.issuedAt).toLocaleDateString('vi-VN')}</p></div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Chi tiết chứng nhận" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[26px] border border-white/60 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b45309]">Chứng nhận học tập</p><h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-[#0f172a]">{selected.title}</h2><p className="mt-1 text-sm text-[#64748b]">{selected.message}</p></div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Đóng" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"><X className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            {selectedImageUrl && <img src={selectedImageUrl} alt={`Chứng nhận ${selected.title}`} className="mt-5 w-full rounded-[18px] border border-[#e2e8f0]" />}
          </div>
        </div>
      )}
    </div>
  );
}
