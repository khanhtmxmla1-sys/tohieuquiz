import React, { useEffect, useState } from 'react';
import type { CreateCompetitionAwardRuleVersionRequest } from '../../../../schemas/competitionPortal.schema';
import type { StaffCompetitionAwardRuleVersionDto } from '../../../../shared/competition-portal.contract';
import { competitionPublicContentService } from './competitionPublicContentService';
import { createCompetitionPortalRequestId } from './publicContentUtils';

interface AwardRuleVersionEditorProps {
  campaignId: string;
  isAdmin: boolean;
}

type RuleForm = {
  scope: 'EVENT' | 'GRADE';
  gradeLevel: string;
  rankFrom: string;
  rankTo: string;
  awardCode: string;
  awardLabel: string;
  sortOrder: string;
};

const inputClassName = 'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

const initialRule: RuleForm = {
  scope: 'EVENT', gradeLevel: '', rankFrom: '1', rankTo: '1', awardCode: 'GOLD', awardLabel: 'Giải Nhất', sortOrder: '1',
};

const AwardRuleVersionEditor: React.FC<AwardRuleVersionEditorProps> = ({ campaignId, isAdmin }) => {
  const [versions, setVersions] = useState<StaffCompetitionAwardRuleVersionDto[]>([]);
  const [rule, setRule] = useState<RuleForm>(initialRule);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void competitionPublicContentService.listAwardRuleVersions(campaignId)
      .then(nextVersions => {
        if (active) setVersions(nextVersions);
      })
      .catch(() => {
        if (active) setError('Không thể tải các phiên bản luật giải.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [campaignId]);

  const createVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin) return;
    const rankFrom = Number(rule.rankFrom);
    const rankTo = Number(rule.rankTo);
    const sortOrder = Number(rule.sortOrder);
    const gradeLevel = Number(rule.gradeLevel);
    if (!rule.awardCode.trim() || !rule.awardLabel.trim() || !Number.isInteger(rankFrom) || rankFrom < 1 || !Number.isInteger(rankTo) || rankTo < rankFrom || !Number.isInteger(sortOrder) || sortOrder < 0 || (rule.scope === 'GRADE' && (!Number.isInteger(gradeLevel) || gradeLevel < 1))) return;
    const rulePayload = rule.scope === 'GRADE'
      ? { scope: 'GRADE' as const, gradeLevel, rankFrom, rankTo, awardCode: rule.awardCode.trim(), awardLabel: rule.awardLabel.trim(), sortOrder }
      : { scope: 'EVENT' as const, rankFrom, rankTo, awardCode: rule.awardCode.trim(), awardLabel: rule.awardLabel.trim(), sortOrder };
    const payload: CreateCompetitionAwardRuleVersionRequest = {
      campaignId,
      rules: [rulePayload],
      requestId: createCompetitionPortalRequestId('award-rules-create'),
    };
    setPending('create');
    setError(null);
    setMessage(null);
    try {
      const created = await competitionPublicContentService.createAwardRuleVersion(payload);
      setVersions(current => [...current, created]);
      setMessage(`Đã tạo phiên bản luật giải v${created.version}.`);
    } catch {
      setError('Không thể tạo phiên bản luật giải.');
    } finally {
      setPending(null);
    }
  };

  const activateVersion = async (version: StaffCompetitionAwardRuleVersionDto) => {
    if (!isAdmin || version.status !== 'DRAFT') return;
    setPending(`activate-${version.version}`);
    setError(null);
    setMessage(null);
    try {
      const activated = await competitionPublicContentService.activateAwardRuleVersion(
        campaignId,
        version.version,
        createCompetitionPortalRequestId('award-rules-activate'),
      );
      setVersions(current => current.map(item => item.id === activated.id ? activated : item));
      setMessage(`Đã kích hoạt phiên bản luật giải v${activated.version}.`);
    } catch {
      setError('Không thể kích hoạt phiên bản luật giải.');
    } finally {
      setPending(null);
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="award-rule-version-editor-title">
      <h3 id="award-rule-version-editor-title" className="text-lg font-bold text-slate-900">Phiên bản luật giải</h3>
      <p className="mt-1 text-sm text-slate-600">Mỗi phiên bản là bất biến sau khi kích hoạt; kết quả thắng được hệ thống tính theo luật đã chọn.</p>
      {loading && <p className="mt-4 text-sm text-slate-600">Đang tải phiên bản luật giải…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      {!loading && (
        <div className="mt-4 space-y-3">
          {versions.length === 0 && <p className="text-sm text-slate-600">Chưa có phiên bản luật giải.</p>}
          {versions.map(version => (
            <div key={version.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">Phiên bản v{version.version} · {version.status}</p>
                {isAdmin && version.status === 'DRAFT' && <button type="button" disabled={Boolean(pending)} onClick={() => void activateVersion(version)} className="min-h-11 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50">Kích hoạt v{version.version}</button>}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {version.rules.map(item => <li key={item.id}>{item.scope === 'GRADE' ? `Khối ${item.gradeLevel} · ` : ''}{item.rankFrom}–{item.rankTo}: {item.awardLabel} ({item.awardCode})</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <form className="mt-4 space-y-3 rounded-lg border border-dashed border-slate-300 bg-white p-3" onSubmit={createVersion}>
          <h4 className="font-semibold text-slate-900">Tạo phiên bản luật giải mới</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">Phạm vi<select aria-label="Phạm vi luật giải" value={rule.scope} onChange={event => setRule(current => ({ ...current, scope: event.target.value as RuleForm['scope'] }))} className={inputClassName}><option value="EVENT">Toàn sự kiện</option><option value="GRADE">Theo khối</option></select></label>
            {rule.scope === 'GRADE' && <label className="text-xs font-semibold text-slate-700">Khối áp dụng<input aria-label="Khối áp dụng cho luật giải" type="number" min="1" max="9" value={rule.gradeLevel} onChange={event => setRule(current => ({ ...current, gradeLevel: event.target.value }))} className={inputClassName} /></label>}
            <label className="text-xs font-semibold text-slate-700">Hạng từ<input aria-label="Hạng từ" type="number" min="1" value={rule.rankFrom} onChange={event => setRule(current => ({ ...current, rankFrom: event.target.value }))} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700">Hạng đến<input aria-label="Hạng đến" type="number" min="1" value={rule.rankTo} onChange={event => setRule(current => ({ ...current, rankTo: event.target.value }))} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700">Mã giải<input aria-label="Mã giải" value={rule.awardCode} onChange={event => setRule(current => ({ ...current, awardCode: event.target.value }))} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700">Tên giải<input aria-label="Tên giải" value={rule.awardLabel} onChange={event => setRule(current => ({ ...current, awardLabel: event.target.value }))} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700">Thứ tự<input aria-label="Thứ tự luật giải" type="number" min="0" value={rule.sortOrder} onChange={event => setRule(current => ({ ...current, sortOrder: event.target.value }))} className={inputClassName} /></label>
          </div>
          <button type="submit" disabled={Boolean(pending)} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Tạo phiên bản luật giải</button>
        </form>
      )}
    </article>
  );
};

export default AwardRuleVersionEditor;
