import React from 'react';
import type { CompetitionCampaignView, CompetitionRoundView, SchoolExamEventView } from '../competitionDashboardService';
import CompetitionArticleManager from './CompetitionArticleManager';
import GoldenBoardConfigPanel from './GoldenBoardConfigPanel';
import AwardRuleVersionEditor from './AwardRuleVersionEditor';
import PublicPageEditor from './PublicPageEditor';

export interface CompetitionPublicContentPanelProps {
  campaignId: string;
  isAdmin: boolean;
  schoolExamEvents: SchoolExamEventView[];
  campaign?: CompetitionCampaignView | null;
  rounds?: CompetitionRoundView[];
}

const CompetitionPublicContentPanel: React.FC<CompetitionPublicContentPanelProps> = ({
  campaignId, isAdmin, schoolExamEvents, campaign, rounds,
}) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="competition-public-content-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Public portal</p>
          <h2 id="competition-public-content-title" className="mt-1 text-xl font-bold text-slate-950">Nội dung công khai</h2>
          <p className="mt-2 text-sm text-slate-600">
            Quản lý trang giới thiệu, bài viết, Golden Board và phiên bản luật giải theo chiến dịch đang chọn.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {isAdmin ? 'Admin · có quyền chỉnh sửa' : 'Teacher · chỉ đọc'}
        </span>
      </div>

      {!campaignId ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          Chọn một chiến dịch để xem nội dung công khai.
        </p>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <PublicPageEditor campaignId={campaignId} isAdmin={isAdmin} />
          <CompetitionArticleManager campaignId={campaignId} isAdmin={isAdmin} campaign={campaign} rounds={rounds} />
          <GoldenBoardConfigPanel campaignId={campaignId} isAdmin={isAdmin} schoolExamEvents={schoolExamEvents} />
          <AwardRuleVersionEditor campaignId={campaignId} isAdmin={isAdmin} />
        </div>
      )}
    </section>
  );
};

export default CompetitionPublicContentPanel;
