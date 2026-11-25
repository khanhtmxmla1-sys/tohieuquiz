import type { Dispatch, SetStateAction } from "react";
import type { CompetitionCampaignView } from "../competitionDashboardService";
import type { AudiencePreview, CampaignDraft } from "./dashboardTypes";

export interface CampaignAudienceSectionProps {
  isAdmin: boolean;
  campaigns: CompetitionCampaignView[];
  selectedCampaignId: string;
  selectedCampaign: CompetitionCampaignView | null;
  loadingCampaigns: boolean;
  loadingDetails: boolean;
  pendingAction: string | null;
  campaignDraft: CampaignDraft;
  audiencePreview: AudiencePreview | null;
  setSelectedCampaignId: (value: string) => void;
  setAudiencePreview: Dispatch<SetStateAction<AudiencePreview | null>>;
  setAudienceFreezeConfirmOpen: (value: boolean) => void;
  setCampaignDraft: Dispatch<SetStateAction<CampaignDraft>>;
  persistCampaign: () => Promise<void>;
  previewAudience: () => Promise<void>;
}

export function CampaignAudienceSection({
  isAdmin,
  campaigns,
  selectedCampaignId,
  selectedCampaign,
  loadingCampaigns,
  loadingDetails,
  pendingAction,
  campaignDraft,
  audiencePreview,
  setSelectedCampaignId,
  setAudiencePreview,
  setAudienceFreezeConfirmOpen,
  setCampaignDraft,
  persistCampaign,
  previewAudience,
}: CampaignAudienceSectionProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">
        Chiến dịch & đối tượng
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Chọn chiến dịch, xem phạm vi học sinh và khóa AudienceSnapshot trước khi
        thi.
      </p>
      <label
        className="mt-4 block text-sm font-semibold text-slate-700"
        htmlFor="competition-campaign-select"
      >
        Chiến dịch
      </label>
      <select
        id="competition-campaign-select"
        value={selectedCampaignId}
        onChange={(event) => {
          setSelectedCampaignId(event.target.value);
          setAudiencePreview(null);
          setAudienceFreezeConfirmOpen(false);
        }}
        disabled={loadingCampaigns || campaigns.length === 0}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        {campaigns.length === 0 && (
          <option value="">
            {loadingCampaigns ? "Đang tải…" : "Chưa có chiến dịch"}
          </option>
        )}
        {campaigns.map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.title}
          </option>
        ))}
      </select>
      {isAdmin &&
        (!selectedCampaign || selectedCampaign.status === "DRAFT") && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-bold text-slate-900">
              {selectedCampaign?.status === "DRAFT"
                ? "Chỉnh chiến dịch DRAFT"
                : "Tạo chiến dịch mới"}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">
                Tên chiến dịch
                <input
                  aria-label="Tên chiến dịch"
                  value={campaignDraft.title}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                Năm học
                <input
                  aria-label="Năm học"
                  value={campaignDraft.schoolYear}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({
                      ...current,
                      schoolYear: event.target.value,
                    }))
                  }
                  placeholder="2026-2027"
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                Múi giờ
                <input
                  aria-label="Múi giờ"
                  value={campaignDraft.timezone}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                Khối tham gia
                <input
                  aria-label="Khối tham gia"
                  value={campaignDraft.gradeLevels}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({
                      ...current,
                      gradeLevels: event.target.value,
                    }))
                  }
                  placeholder="4, 5"
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                Lớp tham gia
                <input
                  aria-label="Lớp tham gia"
                  value={campaignDraft.classIds}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({
                      ...current,
                      classIds: event.target.value,
                    }))
                  }
                  placeholder="class-4a, class-4b"
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                Số vòng cần đạt
                <input
                  aria-label="Số vòng cần đạt"
                  type="number"
                  min="1"
                  max="6"
                  value={campaignDraft.requiredPassedRounds}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({
                      ...current,
                      requiredPassedRounds: event.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                Bắt đầu chiến dịch
                <input
                  aria-label="Bắt đầu chiến dịch"
                  type="datetime-local"
                  value={campaignDraft.startsAt}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({
                      ...current,
                      startsAt: event.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                Kết thúc chiến dịch
                <input
                  aria-label="Kết thúc chiến dịch"
                  type="datetime-local"
                  value={campaignDraft.endsAt}
                  onChange={(event) =>
                    setCampaignDraft((current) => ({
                      ...current,
                      endsAt: event.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void persistCampaign()}
              disabled={pendingAction !== null}
              className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {selectedCampaign?.status === "DRAFT"
                ? "Lưu chiến dịch"
                : "Tạo chiến dịch"}
            </button>
          </div>
        )}
      {selectedCampaign && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <strong className="text-slate-950">{selectedCampaign.title}</strong>
          <div className="mt-1">
            Năm học {selectedCampaign.schoolYear} · Trạng thái{" "}
            {selectedCampaign.status}
          </div>
          <div className="mt-1">
            Audience:{" "}
            {selectedCampaign.audienceSnapshotId
              ? "Đã đóng băng"
              : "Chưa đóng băng"}
          </div>
        </div>
      )}
      {audiencePreview && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
          <strong>{audiencePreview.matchedCount} học sinh phù hợp</strong>
          {audiencePreview.countsByGrade && (
            <div className="mt-1 text-xs">
              Theo khối:{" "}
              {Object.entries(audiencePreview.countsByGrade)
                .map(([grade, count]) => `Khối ${grade}: ${count}`)
                .join(" · ")}
            </div>
          )}
        </div>
      )}
      {isAdmin && (
        <div
          className="mt-4 flex flex-wrap gap-2"
          aria-label="Thao tác quản trị đối tượng"
        >
          <button
            type="button"
            onClick={() => void previewAudience()}
            disabled={
              !selectedCampaign || loadingDetails || pendingAction !== null
            }
            className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Xem trước đối tượng
          </button>
          <button
            type="button"
            onClick={() => setAudienceFreezeConfirmOpen(true)}
            disabled={
              !selectedCampaign ||
              selectedCampaign.status !== "DRAFT" ||
              !audiencePreview ||
              audiencePreview.matchedCount <= 0 ||
              loadingDetails ||
              pendingAction !== null
            }
            className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {selectedCampaign?.audienceSnapshotId
              ? "Tạo lại AudienceSnapshot"
              : "Đóng băng đối tượng"}
          </button>
        </div>
      )}
    </article>
  );
}
