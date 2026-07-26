import React, { useEffect, useState } from 'react';
import { Award, X } from 'lucide-react';
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
      .then((page) => {
        if (active) setItems(page.items);
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được chứng nhận.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedImageUrl = selected ? getParentCertificateImageUrl(selected) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Chứng nhận và thành tích</h1>
        <p className="mt-1 text-sm text-slate-500">Những dấu mốc đáng tự hào của con.</p>
      </div>

      {loading && (
        <p role="status" className="rounded-2xl bg-white p-6 text-slate-500">
          Đang tải chứng nhận…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      {!loading && !items.length && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Chưa có chứng nhận trong năm học.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const imageUrl = getParentCertificateImageUrl(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              aria-label={`Xem chứng nhận ${item.title}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="aspect-[1.414/1] w-full bg-slate-100 object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-[1.414/1] items-center justify-center bg-amber-50">
                  <Award className="h-12 w-12 text-amber-600" />
                </div>
              )}
              <div className="p-4">
                <h2 className="font-bold">{item.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {item.teacherName} · {new Date(item.issuedAt).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết chứng nhận"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{selected.title}</h2>
                <p className="text-sm text-slate-500">{selected.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Đóng"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-100"
              >
                <X />
              </button>
            </div>
            {selectedImageUrl && (
              <img
                src={selectedImageUrl}
                alt={`Chứng nhận ${selected.title}`}
                className="mt-4 w-full rounded-2xl border border-slate-200"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
