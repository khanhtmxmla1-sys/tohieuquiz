import React from 'react';
import { AlertTriangle, LayoutPanelTop, Radio } from 'lucide-react';
import { ANNOUNCEMENT_PRESETS, type AnnouncementPresetId } from './announcementPresets';

interface AnnouncementTypePickerProps {
  value: AnnouncementPresetId | null;
  readOnly?: boolean;
  onChange: (preset: AnnouncementPresetId) => void;
}

const ICONS = {
  TICKER: Radio,
  BANNER: LayoutPanelTop,
  URGENT: AlertTriangle,
} as const;

export function AnnouncementTypePicker({ value, readOnly = false, onChange }: AnnouncementTypePickerProps) {
  return (
    <fieldset className="space-y-3" disabled={readOnly}>
      <legend className="text-base font-bold text-slate-900">Loại thông báo</legend>
      <div role="radiogroup" aria-label="Loại thông báo" className="grid gap-3 md:grid-cols-3">
        {(Object.keys(ANNOUNCEMENT_PRESETS) as AnnouncementPresetId[]).map((presetId) => {
          const preset = ANNOUNCEMENT_PRESETS[presetId];
          const Icon = ICONS[presetId];
          const selected = value === presetId;
          return (
            <label
              key={presetId}
              className={`flex min-h-24 cursor-pointer gap-3 rounded-2xl border p-4 transition ${selected ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300'} ${readOnly ? 'cursor-default opacity-75' : ''}`}
            >
              <input
                type="radio"
                aria-label={preset.label}
                name="announcement-preset"
                value={presetId}
                checked={selected}
                onChange={() => onChange(presetId)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-bold text-slate-900"><Icon aria-hidden="true" className="size-4" />{preset.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">{preset.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
