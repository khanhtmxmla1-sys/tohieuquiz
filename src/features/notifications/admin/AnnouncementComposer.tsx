import React, { useEffect, useRef, useState } from 'react';
import type {
  AnnouncementChannel,
  NotificationPriority,
} from '../../../../shared/notifications.contract';
import type { NotificationSurface } from '../selectAnnouncements';
import { AnnouncementContentStep } from './AnnouncementContentStep';
import { AnnouncementDistributionFields } from './AnnouncementDistributionFields';
import { AnnouncementPresetChangeNotice } from './AnnouncementPresetChangeNotice';
import { AnnouncementPublishDialog } from './AnnouncementPublishDialog';
import {
  AnnouncementReviewStep,
  getAnnouncementReviewSurfaces,
} from './AnnouncementReviewStep';
import { AnnouncementTypePicker } from './AnnouncementTypePicker';
import {
  applyAnnouncementPreset,
  hasAnnouncementContent,
  inferAnnouncementPreset,
  presetChangesDelivery,
  type AnnouncementPresetId,
} from './announcementPresets';
import {
  validateAnnouncementDraft,
  type AnnouncementDraftErrors,
} from './validateAnnouncementDraft';

export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED';
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
  readOnly?: boolean;
  onChange?: (draft: AnnouncementDraft) => void;
  onSaveDraft?: (draft: AnnouncementDraft) => Promise<void> | void;
  onPublish?: (draft: AnnouncementDraft) => Promise<void> | void;
}

export function AnnouncementComposer({
  initialDraft,
  saving = false,
  readOnly = false,
  onChange,
  onSaveDraft,
  onPublish,
}: AnnouncementComposerProps) {
  const [draft, setDraft] = useState(initialDraft ?? createEmptyAnnouncementDraft());
  const [errors, setErrors] = useState<AnnouncementDraftErrors>({});
  const [surface, setSurface] = useState<NotificationSurface>('LOGIN');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [pendingPreset, setPendingPreset] = useState<AnnouncementPresetId | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const availableSurfaces = getAnnouncementReviewSurfaces(draft.audience);

  useEffect(() => {
    if (initialDraft) {
      setDraft(initialDraft);
      setPendingPreset(null);
      setPublishDialogOpen(false);
    }
  }, [initialDraft]);

  useEffect(() => {
    if (!availableSurfaces.includes(surface)) {
      setSurface(availableSurfaces[0]);
    }
  }, [draft.audience, surface]);

  const updateDraft = (next: AnnouncementDraft) => {
    if (readOnly) return;
    setDraft(next);
    onChange?.(next);
  };

  const selectedPreset = inferAnnouncementPreset(draft);
  const requestPreset = (preset: AnnouncementPresetId) => {
    if (readOnly || preset === selectedPreset) return;
    if (hasAnnouncementContent(draft) && presetChangesDelivery(draft, preset)) {
      setPendingPreset(preset);
      return;
    }
    updateDraft(applyAnnouncementPreset(draft, preset));
  };

  const applyPendingPreset = () => {
    if (!pendingPreset) return;
    updateDraft(applyAnnouncementPreset(draft, pendingPreset));
    setPendingPreset(null);
  };

  const saveDraft = async () => {
    const next = { ...draft, status: 'DRAFT' as const };
    updateDraft(next);
    await onSaveDraft?.(next);
  };

  const submitPublish = async () => {
    await onPublish?.(draft);
  };

  const requestPublish = async () => {
    const nextErrors = validateAnnouncementDraft(draft, 'publish');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }

    if (draft.audience === 'ALL' || draft.priority === 'URGENT') {
      setPublishDialogOpen(true);
      return;
    }

    await submitPublish();
  };

  const confirmPublish = async () => {
    try {
      await submitPublish();
      setPublishDialogOpen(false);
    } catch {
      // The parent keeps the current draft and surfaces the mutation error.
    }
  };

  const scheduled = draft.status === 'SCHEDULED';
  const primaryLabel = saving
    ? (scheduled ? 'Đang lên lịch…' : 'Đang công bố…')
    : (scheduled ? 'Lên lịch' : 'Công bố ngay');

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
          className="min-w-0 space-y-5 rounded-2xl border bg-white p-5"
        >
          <AnnouncementTypePicker value={selectedPreset} readOnly={readOnly} onChange={requestPreset} />
          {pendingPreset && (
            <AnnouncementPresetChangeNotice
              onApply={applyPendingPreset}
              onCancel={() => setPendingPreset(null)}
            />
          )}
          <AnnouncementContentStep
            draft={draft}
            preset={selectedPreset}
            errors={errors}
            readOnly={readOnly}
            onChange={updateDraft}
          />
        </section>

        <div
          data-testid="announcement-composer-rail"
          className="min-w-0 space-y-5"
        >
          <div className="rounded-2xl border bg-white p-5">
            <AnnouncementDistributionFields
              draft={draft}
              errors={errors}
              readOnly={readOnly}
              onChange={updateDraft}
            />
          </div>

          <AnnouncementReviewStep
            draft={draft}
            surface={surface}
            device={device}
            onSurfaceChange={setSurface}
            onDeviceChange={setDevice}
          />
        </div>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDraft()}
            className="min-h-11 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
          >
            {saving ? 'Đang lưu…' : 'Lưu nháp'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void requestPublish()}
            className="min-h-11 rounded-xl bg-blue-600 px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {primaryLabel}
          </button>
        </div>
      )}

      <AnnouncementPublishDialog
        draft={draft}
        open={publishDialogOpen}
        submitting={saving}
        onCancel={() => setPublishDialogOpen(false)}
        onConfirm={() => void confirmPublish()}
      />
    </div>
  );
}
