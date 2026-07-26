import React, { useEffect, useRef, useState } from 'react';
import type {
  AnnouncementChannel,
  NotificationPriority,
} from '../../../../shared/notifications.contract';
import { AnnouncementDistributionFields } from './AnnouncementDistributionFields';
import { AnnouncementPreview } from './AnnouncementPreview';
import {
  validateAnnouncementDraft,
  type AnnouncementDraftErrors,
} from './validateAnnouncementDraft';

export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED';
export type AnnouncementAudience = 'ALL' | 'TEACHERS' | 'STUDENTS';

export interface AnnouncementDraft {
  id: string;
  content: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerLink: string;
  bannerImage: string;
  ctaLabel: string;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  priority: NotificationPriority;
  channels: AnnouncementChannel[];
  dismissible: boolean;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  surfaceOverrides: Record<string, unknown>;
}

export const createEmptyAnnouncementDraft = (): AnnouncementDraft => ({
  id: '',
  content: '',
  bannerTitle: '',
  bannerSubtitle: '',
  bannerLink: '',
  bannerImage: '',
  ctaLabel: '',
  status: 'DRAFT',
  audience: 'ALL',
  priority: 'INFO',
  channels: [],
  dismissible: true,
  startsAt: '',
  endsAt: '',
  updatedAt: '',
  surfaceOverrides: {},
});

interface AnnouncementComposerProps {
  initialDraft?: AnnouncementDraft;
  saving?: boolean;
  onChange?: (draft: AnnouncementDraft) => void;
  onSaveDraft?: (draft: AnnouncementDraft) => Promise<void> | void;
  onPublish?: (draft: AnnouncementDraft) => Promise<void> | void;
  onSendTest?: (draft: AnnouncementDraft) => Promise<void> | void;
}

export function AnnouncementComposer({
  initialDraft,
  saving = false,
  onChange,
  onSaveDraft,
  onPublish,
  onSendTest,
}: AnnouncementComposerProps) {
  const [draft, setDraft] = useState(initialDraft ?? createEmptyAnnouncementDraft());
  const [errors, setErrors] = useState<AnnouncementDraftErrors>({});
  const [surface, setSurface] = useState<'LOGIN' | 'TEACHER_DASHBOARD' | 'STUDENT_DASHBOARD'>('LOGIN');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialDraft) setDraft(initialDraft);
  }, [initialDraft]);

  const updateDraft = (next: AnnouncementDraft) => {
    setDraft(next);
    onChange?.(next);
  };
  const saveDraft = async () => {
    const next = { ...draft, status: 'DRAFT' as const };
    updateDraft(next);
    await onSaveDraft?.(next);
  };
  const publish = async () => {
    const nextErrors = validateAnnouncementDraft(draft, 'publish');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }
    await onPublish?.(draft);
  };

  return (
    <div className="space-y-5">
      {Object.keys(errors).length > 0 && (
        <div
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <strong>Hãy kiểm tra lại:</strong>
          <ul className="mt-1 list-disc pl-5">
            {Object.values(errors).map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      )}
      <div
        data-testid="announcement-composer-layout"
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]"
      >
        <section
          data-testid="announcement-content-panel"
          className="min-w-0 space-y-4 rounded-2xl border bg-white p-5"
        >
          <h3 className="text-lg font-bold text-slate-900">Nội dung</h3>
          <label className="block text-sm font-semibold">
            Tiêu đề
            <input
              value={draft.bannerTitle}
              onChange={(event) => updateDraft({ ...draft, bannerTitle: event.target.value })}
              className="mt-1 h-11 w-full rounded-xl border px-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            Nội dung chính
            <textarea
              aria-label="Nội dung chính"
              value={draft.content}
              onChange={(event) => updateDraft({ ...draft, content: event.target.value })}
              className="mt-1 min-h-28 w-full rounded-xl border p-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            Mô tả banner
            <input
              value={draft.bannerSubtitle}
              onChange={(event) => updateDraft({ ...draft, bannerSubtitle: event.target.value })}
              className="mt-1 h-11 w-full rounded-xl border px-3"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Nhãn CTA
              <input
                value={draft.ctaLabel}
                onChange={(event) => updateDraft({ ...draft, ctaLabel: event.target.value })}
                className="mt-1 h-11 w-full rounded-xl border px-3"
              />
            </label>
            <label className="text-sm font-semibold">
              Liên kết
              <input
                value={draft.bannerLink}
                onChange={(event) => updateDraft({ ...draft, bannerLink: event.target.value })}
                className="mt-1 h-11 w-full rounded-xl border px-3"
              />
              {errors.bannerLink && <span className="block text-red-700">{errors.bannerLink}</span>}
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Ảnh
            <input
              value={draft.bannerImage}
              onChange={(event) => updateDraft({ ...draft, bannerImage: event.target.value })}
              className="mt-1 h-11 w-full rounded-xl border px-3"
            />
          </label>
        </section>

        <div
          data-testid="announcement-composer-rail"
          className="min-w-0 space-y-5"
        >
          <div className="rounded-2xl border bg-white p-5">
            <AnnouncementDistributionFields
              draft={draft}
              errors={errors}
              onChange={updateDraft}
            />
          </div>

          <section className="space-y-4 rounded-2xl border bg-slate-50 p-5 xl:sticky xl:top-20">
            <h3 className="text-lg font-bold text-slate-900">Xem trước</h3>
            <div className="flex flex-wrap gap-2">
              {([
                ['LOGIN', 'Đăng nhập'],
                ['TEACHER_DASHBOARD', 'Giáo viên'],
                ['STUDENT_DASHBOARD', 'Học sinh'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={surface === value}
                  onClick={() => setSurface(value)}
                  className="rounded-full border bg-white px-3 py-2 text-sm"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {(['desktop', 'mobile'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={device === value}
                  onClick={() => setDevice(value)}
                  className="rounded-full border bg-white px-3 py-2 text-sm capitalize"
                >
                  {value === 'desktop' ? 'Desktop' : 'Mobile'}
                </button>
              ))}
            </div>
            <AnnouncementPreview draft={draft} surface={surface} device={device} />
          </section>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <button type="button" disabled={saving} onClick={() => void saveDraft()} className="rounded-xl border px-4 py-2 font-semibold">
          Lưu nháp
        </button>
        <button type="button" disabled={saving} onClick={() => void onSendTest?.(draft)} className="rounded-xl border px-4 py-2 font-semibold">
          Gửi thử
        </button>
        <button type="button" disabled={saving} onClick={() => void publish()} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">
          Công bố
        </button>
      </div>
    </div>
  );
}
