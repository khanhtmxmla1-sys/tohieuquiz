import React, { useEffect, useMemo, useState } from 'react';
import type { UpdateCompetitionGoldenBoardConfigRequest } from '../../../../schemas/competitionPortal.schema';
import type { StaffCompetitionAwardRuleVersionDto, StaffCompetitionGoldenBoardConfigDto } from '../../../../shared/competition-portal.contract';
import type { SchoolExamEventView } from '../competitionDashboardService';
import { competitionPublicContentService } from './competitionPublicContentService';
import { createCompetitionPortalRequestId } from './publicContentUtils';

interface GoldenBoardConfigPanelProps {
  campaignId: string;
  isAdmin: boolean;
  schoolExamEvents: SchoolExamEventView[];
}

type GoldenBoardForm = {
  enabled: boolean;
  sourceEventId: string;
  awardRuleVersion: string;
  title: string;
};

const inputClassName = 'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

const toForm = (config: StaffCompetitionGoldenBoardConfigDto | null): GoldenBoardForm => ({
  enabled: config?.enabled || false,
  sourceEventId: config?.sourceEventId || '',
  awardRuleVersion: config?.awardRuleVersion ? String(config.awardRuleVersion) : '',
  title: config?.title || 'Bảng vàng',
});

const GoldenBoardConfigPanel: React.FC<GoldenBoardConfigPanelProps> = ({ campaignId, isAdmin, schoolExamEvents }) => {
  const [config, setConfig] = useState<StaffCompetitionGoldenBoardConfigDto | null>(null);
  const [versions, setVersions] = useState<StaffCompetitionAwardRuleVersionDto[]>([]);
  const [form, setForm] = useState<GoldenBoardForm>(toForm(null));
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const sameCampaignEvents = useMemo(
    () => schoolExamEvents.filter(event => event.campaignId === campaignId),
    [campaignId, schoolExamEvents],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([
      competitionPublicContentService.getGoldenBoardConfig(campaignId),
      competitionPublicContentService.listAwardRuleVersions(campaignId),
    ])
      .then(([nextConfig, nextVersions]) => {
        if (!active) return;
        setConfig(nextConfig);
        setForm(toForm(nextConfig));
        setVersions(nextVersions);
      })
      .catch(() => {
        if (active) setError('Không thể tải cấu hình Golden Board.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [campaignId]);

  const saveConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin || (form.enabled && (!form.sourceEventId || !form.awardRuleVersion))) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const payload: UpdateCompetitionGoldenBoardConfigRequest = {
      enabled: form.enabled,
      sourceEventId: form.enabled ? form.sourceEventId : null,
      awardRuleVersion: form.enabled ? Number(form.awardRuleVersion) : null,
      displayMode: 'AWARD_WINNERS',
      title: form.title.trim() || 'Bảng vàng',
      requestId: createCompetitionPortalRequestId('golden-board-update'),
    };
    try {
      const updated = await competitionPublicContentService.updateGoldenBoardConfig(campaignId, payload);
      setConfig(updated);
      setForm(toForm(updated));
      setMessage('Đã lưu cấu hình Golden Board.');
    } catch {
      setError('Không thể lưu cấu hình Golden Board.');
    } finally {
      setPending(false);
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="golden-board-config-title">
      <h3 id="golden-board-config-title" className="text-lg font-bold text-slate-900">Golden Board</h3>
      <p className="mt-1 text-sm text-slate-600">Chỉ cấu hình nguồn kết quả và phiên bản luật giải; danh sách người thắng do backend tính.</p>
      {loading && <p className="mt-4 text-sm text-slate-600">Đang tải Golden Board…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      {!loading && isAdmin && (
        <form className="mt-4 space-y-3" onSubmit={saveConfig}>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
            <input aria-label="Bật Golden Board" type="checkbox" checked={form.enabled} onChange={event => setForm(current => ({ ...current, enabled: event.target.checked }))} className="h-5 w-5 rounded border-slate-300" />
            Bật Golden Board
          </label>
          <label className="text-xs font-semibold text-slate-700">Tiêu đề Golden Board<input aria-label="Tiêu đề Golden Board" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className={inputClassName} /></label>
          <label className="text-xs font-semibold text-slate-700">Sự kiện nguồn Golden Board<select aria-label="Sự kiện nguồn Golden Board" value={form.sourceEventId} onChange={event => setForm(current => ({ ...current, sourceEventId: event.target.value }))} disabled={!form.enabled} className={inputClassName}><option value="">Chọn sự kiện cùng chiến dịch</option>{sameCampaignEvents.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">Phiên bản luật giải Golden Board<select aria-label="Phiên bản luật giải Golden Board" value={form.awardRuleVersion} onChange={event => setForm(current => ({ ...current, awardRuleVersion: event.target.value }))} disabled={!form.enabled} className={inputClassName}><option value="">Chọn phiên bản</option>{versions.map(version => <option key={version.id} value={version.version}>v{version.version} · {version.status}</option>)}</select></label>
          <p className="text-xs text-slate-500">Chế độ hiển thị: AWARD_WINNERS · không có trường nhập winner hoặc student ID.</p>
          <button type="submit" disabled={pending || (form.enabled && (!form.sourceEventId || !form.awardRuleVersion))} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Lưu cấu hình Golden Board</button>
        </form>
      )}

      {!loading && !isAdmin && (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">Trạng thái</dt><dd className="mt-1 text-slate-900">{config?.enabled ? 'Đang bật' : 'Đang tắt'}</dd></div>
          <div><dt className="font-semibold text-slate-500">Tiêu đề</dt><dd className="mt-1 text-slate-900">{config?.title || '—'}</dd></div>
          <div><dt className="font-semibold text-slate-500">Sự kiện nguồn</dt><dd className="mt-1 text-slate-900">{sameCampaignEvents.find(event => event.id === config?.sourceEventId)?.title || config?.sourceEventId || '—'}</dd></div>
          <div><dt className="font-semibold text-slate-500">Phiên bản luật giải</dt><dd className="mt-1 text-slate-900">{config?.awardRuleVersion ? `v${config.awardRuleVersion}` : '—'}</dd></div>
        </dl>
      )}
    </article>
  );
};

export default GoldenBoardConfigPanel;
