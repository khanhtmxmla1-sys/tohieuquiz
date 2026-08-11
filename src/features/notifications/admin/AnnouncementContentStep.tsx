import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Link2, Plus } from 'lucide-react';
import type { AnnouncementDraft } from './AnnouncementComposer';
import type { AnnouncementDraftErrors } from './validateAnnouncementDraft';
import type { AnnouncementPresetId } from './announcementPresets';

interface AnnouncementContentStepProps {
  draft: AnnouncementDraft;
  preset: AnnouncementPresetId | null;
  errors: AnnouncementDraftErrors;
  readOnly?: boolean;
  onChange: (draft: AnnouncementDraft) => void;
}

const Counter = ({ value, max }: { value: string; max: number }) => (
  <span className="text-xs font-normal text-slate-500">{value.length}/{max} ký tự</span>
);

export function AnnouncementContentStep({ draft, preset, errors, readOnly = false, onChange }: AnnouncementContentStepProps) {
  const [ctaOpen, setCtaOpen] = useState(Boolean(draft.ctaLabel || draft.bannerLink));
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(draft.bannerImage));
  const isBanner = preset === 'BANNER';

  useEffect(() => {
    if (draft.ctaLabel || draft.bannerLink) setCtaOpen(true);
    if (draft.bannerImage) setAdvancedOpen(true);
  }, [draft.ctaLabel, draft.bannerLink, draft.bannerImage]);

  return (
    <section className="space-y-4" aria-labelledby="announcement-content-title">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Bước 1</p>
        <h3 id="announcement-content-title" className="text-lg font-bold text-slate-900">Nội dung</h3>
        <p className="mt-1 text-sm text-slate-600">Viết ngắn gọn, rõ hành động và chỉ nhập các trường phù hợp với loại thông báo.</p>
      </div>

      {isBanner && (
        <label className="block text-sm font-semibold">
          Tiêu đề
          <input
            aria-label="Tiêu đề"
            value={draft.bannerTitle}
            readOnly={readOnly}
            maxLength={160}
            onChange={(event) => onChange({ ...draft, bannerTitle: event.target.value })}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
          <span className="mt-1 flex justify-end"><Counter value={draft.bannerTitle} max={160} /></span>
        </label>
      )}

      <label className="block text-sm font-semibold">
        Nội dung chính
        <textarea
          aria-label="Nội dung chính"
          value={draft.content}
          readOnly={readOnly}
          maxLength={1000}
          aria-invalid={Boolean(errors.content)}
          aria-describedby={errors.content ? 'announcement-content-error' : undefined}
          onChange={(event) => onChange({ ...draft, content: event.target.value })}
          className="mt-1 min-h-32 w-full rounded-xl border border-slate-200 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        />
        <span className="mt-1 flex items-start justify-between gap-3 text-xs font-normal">
          {errors.content ? <span id="announcement-content-error" data-testid="announcement-content-error" className="text-red-700">{errors.content}</span> : <span />}
          <Counter value={draft.content} max={1000} />
        </span>
      </label>

      {isBanner && (
        <>
          <label className="block text-sm font-semibold">
            Mô tả ngắn
            <input
              aria-label="Mô tả banner"
              value={draft.bannerSubtitle}
              readOnly={readOnly}
              maxLength={300}
              onChange={(event) => onChange({ ...draft, bannerSubtitle: event.target.value })}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
            <span className="mt-1 flex justify-end"><Counter value={draft.bannerSubtitle} max={300} /></span>
          </label>

          {!ctaOpen && !readOnly ? (
            <button type="button" onClick={() => setCtaOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              <Plus aria-hidden="true" className="size-4" />Thêm nút hành động
            </button>
          ) : ctaOpen ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><Link2 aria-hidden="true" className="size-4" />Nút hành động</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Nhãn CTA
                  <input
                    aria-label="Nhãn CTA"
                    value={draft.ctaLabel}
                    readOnly={readOnly}
                    maxLength={80}
                    onChange={(event) => onChange({ ...draft, ctaLabel: event.target.value })}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  />
                  <span className="mt-1 flex justify-end"><Counter value={draft.ctaLabel} max={80} /></span>
                </label>
                <label className="text-sm font-semibold">
                  Liên kết
                  <input
                    aria-label="Liên kết"
                    value={draft.bannerLink}
                    readOnly={readOnly}
                    onChange={(event) => onChange({ ...draft, bannerLink: event.target.value })}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  />
                  {errors.bannerLink && <span className="mt-1 block text-xs text-red-700">{errors.bannerLink}</span>}
                </label>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200">
            <button
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((open) => !open)}
              className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Tùy chọn nâng cao
              {advancedOpen ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
            </button>
            {advancedOpen && (
              <div className="border-t border-slate-200 p-4">
                <label className="block text-sm font-semibold">
                  Ảnh thông báo
                  <input
                    aria-label="Ảnh thông báo"
                    value={draft.bannerImage}
                    readOnly={readOnly}
                    onChange={(event) => onChange({ ...draft, bannerImage: event.target.value })}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  />
                </label>
                <p className="mt-2 text-xs leading-5 text-slate-500">Chỉ dùng URL ảnh từ nguồn media được hệ thống cho phép. Nếu không chắc, hãy để trống.</p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
